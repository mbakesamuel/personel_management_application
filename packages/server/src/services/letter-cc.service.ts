import {
  filterLetterCcForAward,
  type LetterCcCreateInput,
  type LetterCcHideInput,
  type LetterCcItem,
  type LetterCcMoveInput,
  type LetterCcUnitExtra,
  type LetterCcUnitOverlay,
  type LetterCcUpdateInput,
} from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class LetterCcConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LetterCcConflictError'
  }
}

export class LetterCcNotFoundError extends Error {
  constructor(message = 'Letter CC copy not found') {
    super(message)
    this.name = 'LetterCcNotFoundError'
  }
}

export class LetterCcValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LetterCcValidationError'
  }
}

function mapRow(row: {
  id: number
  label: string
  sort_order: number
  active: boolean
}): LetterCcItem {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
    active: row.active,
  }
}

function normalizeLabel(label: string): string {
  return label.trim()
}

async function assertUniqueLabel(label: string, excludeId?: number) {
  const key = label.toLowerCase()
  const rows = await prisma.tbl_letter_cc.findMany({
    select: { id: true, label: true },
  })
  const clash = rows.find(
    (row) =>
      row.label.trim().toLowerCase() === key && row.id !== excludeId,
  )
  if (clash) {
    throw new LetterCcConflictError(
      `Letter CC copy "${label}" already exists`,
    )
  }
}

export async function listLetterCc(): Promise<LetterCcItem[]> {
  const rows = await prisma.tbl_letter_cc.findMany({
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function listActiveLetterCcLabels(): Promise<string[]> {
  return resolveLetterCcLabels(null)
}

function mapExtra(row: {
  id: number
  tbl_unit_id: string
  label: string
  sort_order: number
  active: boolean
}): LetterCcUnitExtra {
  return {
    id: row.id,
    unitId: row.tbl_unit_id,
    label: row.label,
    sortOrder: row.sort_order,
    active: row.active,
  }
}

async function assertUnitExists(unitId: string) {
  const unit = await prisma.tbl_unit.findUnique({
    where: { id: unitId },
    select: { id: true },
  })
  if (!unit) {
    throw new LetterCcNotFoundError('Unit not found')
  }
}

export async function resolveLetterCcLabels(
  unitId: string | null,
  award?: string | null,
): Promise<string[]> {
  const globals = await prisma.tbl_letter_cc.findMany({
    where: { active: true },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    select: { id: true, label: true },
  })

  let labels: string[]
  if (!unitId) {
    labels = globals.map((row) => row.label)
  } else {
    const [hides, extras] = await Promise.all([
      prisma.tbl_unit_letter_cc_hide.findMany({
        where: { tbl_unit_id: unitId },
        select: { letter_cc_id: true },
      }),
      prisma.tbl_unit_letter_cc.findMany({
        where: { tbl_unit_id: unitId, active: true },
        orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        select: { label: true },
      }),
    ])
    const hideSet = new Set(hides.map((row) => row.letter_cc_id))
    labels = [
      ...globals.filter((row) => !hideSet.has(row.id)).map((row) => row.label),
      ...extras.map((row) => row.label),
    ]
  }

  return filterLetterCcForAward(labels, award)
}

export async function getUnitLetterCcOverlay(
  unitId: string,
): Promise<LetterCcUnitOverlay> {
  await assertUnitExists(unitId)
  const [defaults, hides, extras] = await Promise.all([
    listLetterCc(),
    prisma.tbl_unit_letter_cc_hide.findMany({
      where: { tbl_unit_id: unitId },
      select: { letter_cc_id: true },
    }),
    prisma.tbl_unit_letter_cc.findMany({
      where: { tbl_unit_id: unitId },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    }),
  ])
  const hideSet = new Set(hides.map((row) => row.letter_cc_id))

  return {
    unitId,
    defaults: defaults.map((row) => ({
      ...row,
      included: row.active && !hideSet.has(row.id),
    })),
    extras: extras.map(mapExtra),
  }
}

export async function setUnitLetterCcHidden(
  unitId: string,
  input: LetterCcHideInput,
): Promise<LetterCcUnitOverlay> {
  await assertUnitExists(unitId)
  const global = await prisma.tbl_letter_cc.findUnique({
    where: { id: input.letterCcId },
  })
  if (!global) {
    throw new LetterCcNotFoundError()
  }
  if (!global.active && !input.hidden) {
    throw new LetterCcValidationError(
      'Inactive corporation copies cannot be included on a unit',
    )
  }

  if (input.hidden) {
    await prisma.tbl_unit_letter_cc_hide.upsert({
      where: {
        tbl_unit_id_letter_cc_id: {
          tbl_unit_id: unitId,
          letter_cc_id: input.letterCcId,
        },
      },
      create: {
        tbl_unit_id: unitId,
        letter_cc_id: input.letterCcId,
      },
      update: {},
    })
  } else {
    await prisma.tbl_unit_letter_cc_hide.deleteMany({
      where: {
        tbl_unit_id: unitId,
        letter_cc_id: input.letterCcId,
      },
    })
  }

  return getUnitLetterCcOverlay(unitId)
}

async function assertExtraLabelAvailable(
  unitId: string,
  label: string,
  excludeId?: number,
) {
  const key = label.toLowerCase()
  const globals = await prisma.tbl_letter_cc.findMany({
    select: { label: true },
  })
  if (globals.some((row) => row.label.trim().toLowerCase() === key)) {
    throw new LetterCcConflictError(
      `Letter CC copy "${label}" already exists as a corporation default. Include it for this unit instead.`,
    )
  }

  const extras = await prisma.tbl_unit_letter_cc.findMany({
    where: { tbl_unit_id: unitId },
    select: { id: true, label: true },
  })
  const clash = extras.find(
    (row) =>
      row.label.trim().toLowerCase() === key && row.id !== excludeId,
  )
  if (clash) {
    throw new LetterCcConflictError(
      `Letter CC copy "${label}" already exists for this unit`,
    )
  }
}

export async function createUnitLetterCcExtra(
  unitId: string,
  input: LetterCcCreateInput,
): Promise<LetterCcUnitOverlay> {
  await assertUnitExists(unitId)
  const label = normalizeLabel(input.label)
  await assertExtraLabelAvailable(unitId, label)

  const max = await prisma.tbl_unit_letter_cc.aggregate({
    where: { tbl_unit_id: unitId },
    _max: { sort_order: true },
  })

  try {
    await prisma.tbl_unit_letter_cc.create({
      data: {
        tbl_unit_id: unitId,
        label,
        sort_order: (max._max.sort_order ?? 0) + 1,
        active: input.active,
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new LetterCcConflictError(
        `Letter CC copy "${label}" already exists for this unit`,
      )
    }
    throw err
  }

  return getUnitLetterCcOverlay(unitId)
}

export async function updateUnitLetterCcExtra(
  unitId: string,
  id: number,
  input: LetterCcUpdateInput,
): Promise<LetterCcUnitOverlay> {
  await assertUnitExists(unitId)
  const existing = await prisma.tbl_unit_letter_cc.findFirst({
    where: { id, tbl_unit_id: unitId },
  })
  if (!existing) {
    throw new LetterCcNotFoundError()
  }

  const data: { label?: string; active?: boolean } = {}
  if (input.label != null) {
    const label = normalizeLabel(input.label)
    await assertExtraLabelAvailable(unitId, label, id)
    data.label = label
  }
  if (input.active != null) {
    data.active = input.active
  }

  try {
    await prisma.tbl_unit_letter_cc.update({
      where: { id },
      data,
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new LetterCcConflictError(
        `Letter CC copy "${data.label ?? existing.label}" already exists for this unit`,
      )
    }
    throw err
  }

  return getUnitLetterCcOverlay(unitId)
}

export async function moveUnitLetterCcExtra(
  unitId: string,
  id: number,
  input: LetterCcMoveInput,
): Promise<LetterCcUnitOverlay> {
  await assertUnitExists(unitId)
  const rows = await prisma.tbl_unit_letter_cc.findMany({
    where: { tbl_unit_id: unitId },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) {
    throw new LetterCcNotFoundError()
  }

  const swapIndex = input.direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return getUnitLetterCcOverlay(unitId)
  }

  const current = rows[index]
  const neighbor = rows[swapIndex]
  const currentOrder = current.sort_order
  const neighborOrder = neighbor.sort_order

  if (currentOrder === neighborOrder) {
    await prisma.$transaction([
      prisma.tbl_unit_letter_cc.update({
        where: { id: current.id },
        data: {
          sort_order: neighborOrder + (input.direction === 'up' ? -1 : 1),
        },
      }),
      prisma.tbl_unit_letter_cc.update({
        where: { id: neighbor.id },
        data: { sort_order: currentOrder },
      }),
    ])
  } else {
    await prisma.$transaction([
      prisma.tbl_unit_letter_cc.update({
        where: { id: current.id },
        data: { sort_order: neighborOrder },
      }),
      prisma.tbl_unit_letter_cc.update({
        where: { id: neighbor.id },
        data: { sort_order: currentOrder },
      }),
    ])
  }

  return getUnitLetterCcOverlay(unitId)
}

export async function createLetterCc(
  input: LetterCcCreateInput,
): Promise<LetterCcItem> {
  const label = normalizeLabel(input.label)
  await assertUniqueLabel(label)

  const max = await prisma.tbl_letter_cc.aggregate({
    _max: { sort_order: true },
  })
  const sortOrder = (max._max.sort_order ?? 0) + 1

  try {
    const row = await prisma.tbl_letter_cc.create({
      data: {
        label,
        sort_order: sortOrder,
        active: input.active,
      },
    })
    return mapRow(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new LetterCcConflictError(
        `Letter CC copy "${label}" already exists`,
      )
    }
    throw err
  }
}

export async function updateLetterCc(
  id: number,
  input: LetterCcUpdateInput,
): Promise<LetterCcItem> {
  const existing = await prisma.tbl_letter_cc.findUnique({ where: { id } })
  if (!existing) {
    throw new LetterCcNotFoundError()
  }

  const data: { label?: string; active?: boolean } = {}
  if (input.label != null) {
    const label = normalizeLabel(input.label)
    await assertUniqueLabel(label, id)
    data.label = label
  }
  if (input.active != null) {
    data.active = input.active
  }

  try {
    const row = await prisma.tbl_letter_cc.update({
      where: { id },
      data,
    })
    return mapRow(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new LetterCcConflictError(
        `Letter CC copy "${data.label ?? existing.label}" already exists`,
      )
    }
    throw err
  }
}

export async function moveLetterCc(
  id: number,
  input: LetterCcMoveInput,
): Promise<LetterCcItem[]> {
  const rows = await prisma.tbl_letter_cc.findMany({
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  })
  const index = rows.findIndex((row) => row.id === id)
  if (index < 0) {
    throw new LetterCcNotFoundError()
  }

  const swapIndex = input.direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return rows.map(mapRow)
  }

  const current = rows[index]
  const neighbor = rows[swapIndex]
  const currentOrder = current.sort_order
  const neighborOrder = neighbor.sort_order

  if (currentOrder === neighborOrder) {
    await prisma.$transaction([
      prisma.tbl_letter_cc.update({
        where: { id: current.id },
        data: { sort_order: neighborOrder + (input.direction === 'up' ? -1 : 1) },
      }),
      prisma.tbl_letter_cc.update({
        where: { id: neighbor.id },
        data: { sort_order: currentOrder },
      }),
    ])
  } else {
    await prisma.$transaction([
      prisma.tbl_letter_cc.update({
        where: { id: current.id },
        data: { sort_order: neighborOrder },
      }),
      prisma.tbl_letter_cc.update({
        where: { id: neighbor.id },
        data: { sort_order: currentOrder },
      }),
    ])
  }

  return listLetterCc()
}
