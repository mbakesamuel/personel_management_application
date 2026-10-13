import type {
  UnitThroAssignment,
  UnitThroListQuery,
  UnitThroUpsertInput,
} from '@personel-management-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class UnitThroNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'UnitThroNotFoundError'
  }
}

export class UnitThroValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnitThroValidationError'
  }
}

function toDateOnly(value: Date | null | undefined): string {
  if (!value) return ''
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateInput(value: string): Date {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
    )
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new UnitThroValidationError('Effective date is invalid')
  }
  return date
}

async function hydrateAssignments(
  rows: {
    id: number
    tbl_unit_id: string
    signatory: string
    title: string
    effdate: Date
  }[],
): Promise<UnitThroAssignment[]> {
  const unitIds = [...new Set(rows.map((row) => row.tbl_unit_id))]
  const units = unitIds.length
    ? await prisma.tbl_unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unit_name: true },
      })
    : []
  const unitNameById = new Map(units.map((unit) => [unit.id, unit.unit_name]))

  return rows.map((row) => ({
    id: row.id,
    unitId: row.tbl_unit_id,
    unitName: unitNameById.get(row.tbl_unit_id) ?? null,
    name: row.signatory,
    title: row.title,
    effdate: toDateOnly(row.effdate),
  }))
}

async function normalizeInput(input: UnitThroUpsertInput): Promise<{
  unitId: string
  name: string
  title: string
  effdate: Date
}> {
  const unitId = input.unitId.trim()
  const name = input.name.trim()
  const title = input.title.trim()
  if (!unitId) {
    throw new UnitThroValidationError('Unit is required')
  }
  if (!name) {
    throw new UnitThroValidationError('Name is required')
  }
  if (!title) {
    throw new UnitThroValidationError('Title is required')
  }

  const unit = await prisma.tbl_unit.findUnique({
    where: { id: unitId },
    select: { id: true },
  })
  if (!unit) {
    throw new UnitThroValidationError(`Unit ${unitId} was not found`)
  }

  return {
    unitId,
    name,
    title,
    effdate: parseDateInput(input.effdate),
  }
}

async function findSameDate(
  unitId: string,
  effdate: Date,
  excludeId?: number,
): Promise<{ id: number; signatory: string } | null> {
  const targetDate = toDateOnly(effdate)
  const rows = await prisma.tbl_unit_thro.findMany({
    where: {
      tbl_unit_id: unitId,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, signatory: true, effdate: true },
  })
  const clash = rows.find((row) => toDateOnly(row.effdate) === targetDate)
  return clash ? { id: clash.id, signatory: clash.signatory } : null
}

function mapWriteError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new UnitThroValidationError(
      'Another holder is already assigned to this unit on that effective date.',
    )
  }
  throw err
}

export async function listUnitThroAssignments(
  query: UnitThroListQuery,
): Promise<UnitThroAssignment[]> {
  const rows = await prisma.tbl_unit_thro.findMany({
    where: { tbl_unit_id: query.unitId.trim() },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return hydrateAssignments(rows)
}

export async function createUnitThroAssignment(
  input: UnitThroUpsertInput,
): Promise<UnitThroAssignment> {
  const data = await normalizeInput(input)
  const existing = await findSameDate(data.unitId, data.effdate)
  if (existing) {
    return updateUnitThroAssignment(existing.id, input)
  }
  try {
    const row = await prisma.tbl_unit_thro.create({
      data: {
        tbl_unit_id: data.unitId,
        signatory: data.name,
        title: data.title,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateAssignments([row])
    return item
  } catch (err) {
    mapWriteError(err)
  }
}

export async function updateUnitThroAssignment(
  id: number,
  input: UnitThroUpsertInput,
): Promise<UnitThroAssignment> {
  const data = await normalizeInput(input)
  const clash = await findSameDate(data.unitId, data.effdate, id)
  if (clash) {
    throw new UnitThroValidationError(
      `This unit already has a Through holder effective ${toDateOnly(data.effdate)} (${clash.signatory}).`,
    )
  }
  try {
    const row = await prisma.tbl_unit_thro.update({
      where: { id },
      data: {
        tbl_unit_id: data.unitId,
        signatory: data.name,
        title: data.title,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateAssignments([row])
    return item
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new UnitThroNotFoundError('Assignment not found')
    }
    mapWriteError(err)
  }
}

export async function deleteUnitThroAssignment(id: number): Promise<void> {
  try {
    await prisma.tbl_unit_thro.delete({ where: { id } })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new UnitThroNotFoundError('Assignment not found')
    }
    throw err
  }
}

function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  )
}

export async function resolveUnitThroTitle(input: {
  unitId: string | null
  asOf: Date
}): Promise<string> {
  if (!input.unitId) return 'HEAD OF SECTION'

  const assignment = await prisma.tbl_unit_thro.findFirst({
    where: {
      tbl_unit_id: input.unitId,
      effdate: { lte: endOfUtcDay(input.asOf) },
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })

  const title = assignment?.title?.trim()
  return (title || 'HEAD OF SECTION').toUpperCase()
}
