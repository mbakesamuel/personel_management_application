import type {
  DecisionLevelCode,
  DecisionScope,
  OfficialMemo,
  OfficialMemoCreateInput,
  OfficialMemoSignatory,
  OfficialMemoSignatoryListQuery,
  OfficialMemoSignatoryUpsertInput,
  OfficialMemoUpdateInput,
} from '@personel-management-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { getDecisionLevel, listDecisionLevels } from './decision.service.js'
import { unitMatchIds } from './live-employee.service.js'

export class OfficialMemoNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'OfficialMemoNotFoundError'
  }
}

export class OfficialMemoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfficialMemoValidationError'
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
    throw new OfficialMemoValidationError('Effective date is invalid')
  }
  return date
}

function codeFromName(name: string): string {
  const code = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  if (!code) throw new OfficialMemoValidationError('Name is required')
  return code
}

function mapMemo(row: {
  id: number
  code: string
  name: string
  system: boolean
  sortOrder: number
}): OfficialMemo {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    system: row.system,
    sortOrder: row.sortOrder,
  }
}

async function hydrateSignatories(
  rows: {
    id: number
    memoId: number
    levelCode: string
    signatory: string | null
    title: string
    catFrom: number
    catTo: number
    tbl_unit_id: string | null
    tbl_group_id: string | null
    effdate: Date
  }[],
): Promise<OfficialMemoSignatory[]> {
  const unitIds = [
    ...new Set(rows.map((row) => row.tbl_unit_id).filter((id): id is string => Boolean(id))),
  ]
  const groupIds = [
    ...new Set(rows.map((row) => row.tbl_group_id).filter((id): id is string => Boolean(id))),
  ]
  const [units, groups] = await Promise.all([
    unitIds.length
      ? prisma.tbl_unit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, unit_name: true },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.tbl_group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, group_name: true },
        })
      : Promise.resolve([]),
  ])
  const unitNameById = new Map(units.map((unit) => [unit.id, unit.unit_name]))
  const groupNameById = new Map(groups.map((group) => [group.id, group.group_name]))
  return rows.map((row) => ({
    id: row.id,
    memoId: row.memoId,
    levelCode: row.levelCode as DecisionLevelCode,
    name: row.signatory?.trim() || null,
    title: row.title,
    catFrom: row.catFrom,
    catTo: row.catTo,
    unitId: row.tbl_unit_id,
    unitName: row.tbl_unit_id ? (unitNameById.get(row.tbl_unit_id) ?? null) : null,
    groupId: row.tbl_group_id,
    groupName: row.tbl_group_id ? (groupNameById.get(row.tbl_group_id) ?? null) : null,
    effdate: toDateOnly(row.effdate),
  }))
}

export async function listOfficialMemos(): Promise<OfficialMemo[]> {
  const rows = await prisma.tbl_official_memo.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  return rows.map(mapMemo)
}

export async function createOfficialMemo(
  input: OfficialMemoCreateInput,
): Promise<OfficialMemo> {
  const name = input.name.trim()
  const base = codeFromName(name)
  const existing = await prisma.tbl_official_memo.findMany({
    select: { code: true, sortOrder: true },
  })
  const codes = new Set(existing.map((row) => row.code))
  let code = base
  let suffix = 2
  while (codes.has(code)) {
    const tail = `_${suffix}`
    code = `${base.slice(0, 40 - tail.length)}${tail}`
    suffix += 1
  }
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1
  const row = await prisma.tbl_official_memo.create({
    data: { code, name, system: false, sortOrder },
  })
  return mapMemo(row)
}

export async function updateOfficialMemo(
  id: number,
  input: OfficialMemoUpdateInput,
): Promise<OfficialMemo> {
  try {
    const row = await prisma.tbl_official_memo.update({
      where: { id },
      data: { name: input.name.trim() },
    })
    return mapMemo(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OfficialMemoNotFoundError('Memo type not found')
    }
    throw err
  }
}

export async function deleteOfficialMemo(id: number): Promise<void> {
  const row = await prisma.tbl_official_memo.findUnique({ where: { id } })
  if (!row) throw new OfficialMemoNotFoundError('Memo type not found')
  if (row.system) {
    throw new OfficialMemoValidationError('This memo type is part of the system and cannot be deleted')
  }
  await prisma.tbl_official_memo.delete({ where: { id } })
}

export async function listOfficialMemoSignatories(
  query: OfficialMemoSignatoryListQuery,
): Promise<OfficialMemoSignatory[]> {
  const rows = await prisma.tbl_official_memo_signatory.findMany({
    where: {
      memoId: query.memoId,
      ...(query.levelCode ? { levelCode: query.levelCode } : {}),
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return hydrateSignatories(rows)
}

async function normalizeSignatory(input: OfficialMemoSignatoryUpsertInput): Promise<{
  memoId: number
  levelCode: DecisionLevelCode
  name: string | null
  title: string
  catFrom: number
  catTo: number
  unitId: string | null
  groupId: string | null
  effdate: Date
  scope: DecisionScope
  levelTitle: string
}> {
  const memo = await prisma.tbl_official_memo.findUnique({
    where: { id: input.memoId },
    select: { id: true },
  })
  if (!memo) throw new OfficialMemoValidationError('Memo type was not found')
  const level = await getDecisionLevel(input.levelCode)
  const name = input.name.trim() || null
  const title = input.title.trim()
  if (!title) throw new OfficialMemoValidationError('Title is required')
  if (
    !Number.isInteger(input.catFrom) ||
    !Number.isInteger(input.catTo) ||
    input.catFrom < 1 ||
    input.catTo < input.catFrom
  ) {
    throw new OfficialMemoValidationError('Category range is invalid')
  }

  let unitId = input.unitId?.trim() || null
  let groupId = input.groupId?.trim() || null
  if (level.scope === 'unit') {
    if (!unitId) throw new OfficialMemoValidationError('Unit is required for this level')
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    })
    if (!unit) throw new OfficialMemoValidationError(`Unit ${unitId} was not found`)
    groupId = null
  } else if (level.scope === 'group') {
    if (!groupId) throw new OfficialMemoValidationError('Group is required for this level')
    const group = await prisma.tbl_group.findUnique({
      where: { id: groupId },
      select: { id: true },
    })
    if (!group) throw new OfficialMemoValidationError(`Group ${groupId} was not found`)
    unitId = null
  } else {
    unitId = null
    groupId = null
  }

  return {
    memoId: memo.id,
    levelCode: level.code,
    name,
    title,
    catFrom: input.catFrom,
    catTo: input.catTo,
    unitId,
    groupId,
    effdate: parseDateInput(input.effdate),
    scope: level.scope,
    levelTitle: level.title,
  }
}

async function assertNoSameDateOverlap(
  data: {
    memoId: number
    levelCode: DecisionLevelCode
    unitId: string | null
    groupId: string | null
    effdate: Date
    scope: DecisionScope
    levelTitle: string
  },
  excludeId?: number,
): Promise<void> {
  const targetDate = toDateOnly(data.effdate)
  const rows = await prisma.tbl_official_memo_signatory.findMany({
    where: {
      memoId: data.memoId,
      levelCode: data.levelCode,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
      ...(data.scope === 'unit' && data.unitId ? { tbl_unit_id: data.unitId } : {}),
      ...(data.scope === 'group' && data.groupId ? { tbl_group_id: data.groupId } : {}),
    },
    select: { signatory: true, title: true, effdate: true },
  })
  const clash = rows.find((row) => toDateOnly(row.effdate) === targetDate)
  if (!clash) return
  const where =
    data.scope === 'unit'
      ? ' for this unit'
      : data.scope === 'group'
        ? ' for this group'
        : ''
  const holder = clash.signatory?.trim() || clash.title
  throw new OfficialMemoValidationError(
    `${data.levelTitle}${where} already has a holder effective ${targetDate} (${holder}).`,
  )
}

function mapWriteError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new OfficialMemoValidationError(
      'Another holder is already assigned to this office on that effective date.',
    )
  }
  throw err
}

export async function createOfficialMemoSignatory(
  input: OfficialMemoSignatoryUpsertInput,
): Promise<OfficialMemoSignatory> {
  const data = await normalizeSignatory(input)
  await assertNoSameDateOverlap(data)
  try {
    const row = await prisma.tbl_official_memo_signatory.create({
      data: {
        memoId: data.memoId,
        levelCode: data.levelCode,
        signatory: data.name,
        title: data.title,
        catFrom: data.catFrom,
        catTo: data.catTo,
        tbl_unit_id: data.unitId,
        tbl_group_id: data.groupId,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateSignatories([row])
    return item
  } catch (err) {
    mapWriteError(err)
  }
}

export async function updateOfficialMemoSignatory(
  id: number,
  input: OfficialMemoSignatoryUpsertInput,
): Promise<OfficialMemoSignatory> {
  const data = await normalizeSignatory(input)
  await assertNoSameDateOverlap(data, id)
  try {
    const row = await prisma.tbl_official_memo_signatory.update({
      where: { id },
      data: {
        memoId: data.memoId,
        levelCode: data.levelCode,
        signatory: data.name,
        title: data.title,
        catFrom: data.catFrom,
        catTo: data.catTo,
        tbl_unit_id: data.unitId,
        tbl_group_id: data.groupId,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateSignatories([row])
    return item
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OfficialMemoNotFoundError('Assignment not found')
    }
    mapWriteError(err)
  }
}

export async function deleteOfficialMemoSignatory(id: number): Promise<void> {
  try {
    await prisma.tbl_official_memo_signatory.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OfficialMemoNotFoundError('Assignment not found')
    }
    throw err
  }
}

export async function resolveOfficialMemoSignatory(input: {
  code: string
  category: number | null
  unitId: string | null
  groupId: string | null
  asOf: Date
}): Promise<{ name: string | null; title: string | null } | null> {
  if (input.category == null || !Number.isInteger(input.category)) return null
  const memo = await prisma.tbl_official_memo.findUnique({
    where: { code: input.code },
    select: { id: true },
  })
  if (!memo) return null
  const [holders, levels] = await Promise.all([
    prisma.tbl_official_memo_signatory.findMany({
      where: {
        memoId: memo.id,
        effdate: { lte: input.asOf },
        catFrom: { lte: input.category },
        catTo: { gte: input.category },
      },
      orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
    }),
    listDecisionLevels(),
  ])
  const levelByCode = new Map(levels.map((level) => [level.code, level]))
  const unitIds = input.unitId ? new Set(unitMatchIds([input.unitId])) : null
  for (const holder of holders) {
    const level = levelByCode.get(holder.levelCode as DecisionLevelCode)
    if (!level) continue
    if (level.scope === 'unit') {
      if (!unitIds || !holder.tbl_unit_id || !unitIds.has(holder.tbl_unit_id)) continue
    } else if (level.scope === 'group') {
      if (!input.groupId || holder.tbl_group_id !== input.groupId) continue
    }
    return {
      name: holder.signatory?.trim() || null,
      title: holder.title.trim() || level.title,
    }
  }
  return null
}

export async function resolvePinnedUnitSignatory(input: {
  code: string
  unitId: string
  asOf: Date
}): Promise<{ name: string | null; title: string | null }> {
  const memo = await prisma.tbl_official_memo.findUnique({
    where: { code: input.code },
    select: { id: true },
  })
  if (!memo) return { name: null, title: null }
  const holder = await prisma.tbl_official_memo_signatory.findFirst({
    where: {
      memoId: memo.id,
      levelCode: 'UNIT_MANAGER',
      tbl_unit_id: { in: unitMatchIds([input.unitId]) },
      effdate: { lte: input.asOf },
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return {
    name: holder?.signatory?.trim() || null,
    title: holder?.title.trim() || null,
  }
}
