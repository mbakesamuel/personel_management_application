import type {
  DecisionAssignment,
  DecisionAssignmentListQuery,
  DecisionAssignmentUpsertInput,
  DecisionLevel,
  DecisionLevelCode,
  DecisionScope,
} from '@perf-appraisal-app/shared'
import { DECISION_LEVEL_CODES, DECISION_SCOPES } from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class DecisionNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'DecisionNotFoundError'
  }
}

export class DecisionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecisionValidationError'
  }
}

function isLevelCode(value: string): value is DecisionLevelCode {
  return (DECISION_LEVEL_CODES as readonly string[]).includes(value)
}

function isScope(value: string): value is DecisionScope {
  return (DECISION_SCOPES as readonly string[]).includes(value)
}

function mapLevel(row: {
  code: string
  title: string
  cat_from: number
  cat_to: number
  scope: string
}): DecisionLevel {
  if (!isLevelCode(row.code) || !isScope(row.scope)) {
    throw new DecisionValidationError(
      `Invalid decision level row: ${row.code}/${row.scope}`,
    )
  }
  return {
    code: row.code,
    title: row.title,
    catFrom: row.cat_from,
    catTo: row.cat_to,
    scope: row.scope,
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
    throw new DecisionValidationError('Effective date is invalid')
  }
  return date
}

async function hydrateAssignments(
  rows: {
    id: number
    level_code: string
    signatory: string
    title: string
    tbl_unit_id: string | null
    tbl_group_id: string | null
    effdate: Date
  }[],
): Promise<DecisionAssignment[]> {
  const unitIds = [
    ...new Set(
      rows.map((r) => r.tbl_unit_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  const groupIds = [
    ...new Set(
      rows.map((r) => r.tbl_group_id).filter((id): id is string => Boolean(id)),
    ),
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

  const unitNameById = new Map(units.map((u) => [u.id, u.unit_name]))
  const groupNameById = new Map(groups.map((g) => [g.id, g.group_name]))

  return rows.map((row) => {
    if (!isLevelCode(row.level_code)) {
      throw new DecisionValidationError(
        `Unknown decision level ${row.level_code}`,
      )
    }
    return {
      id: row.id,
      levelCode: row.level_code,
      name: row.signatory,
      title: row.title,
      unitId: row.tbl_unit_id,
      unitName: row.tbl_unit_id
        ? (unitNameById.get(row.tbl_unit_id) ?? null)
        : null,
      groupId: row.tbl_group_id,
      groupName: row.tbl_group_id
        ? (groupNameById.get(row.tbl_group_id) ?? null)
        : null,
      effdate: toDateOnly(row.effdate),
    }
  })
}

export async function listDecisionLevels(): Promise<DecisionLevel[]> {
  const rows = await prisma.tbl_decision_level.findMany({
    orderBy: { cat_from: 'asc' },
  })
  return rows.map(mapLevel)
}

export async function getDecisionLevel(
  code: DecisionLevelCode,
): Promise<DecisionLevel> {
  const row = await prisma.tbl_decision_level.findUnique({ where: { code } })
  if (!row) {
    throw new DecisionNotFoundError(`Decision level ${code} is not defined`)
  }
  return mapLevel(row)
}

export async function listDecisionAssignments(
  query: DecisionAssignmentListQuery,
): Promise<DecisionAssignment[]> {
  const rows = await prisma.tbl_decision_assignment.findMany({
    where: {
      ...(query.levelCode ? { level_code: query.levelCode } : {}),
      ...(query.unitId ? { tbl_unit_id: query.unitId } : {}),
      ...(query.groupId ? { tbl_group_id: query.groupId } : {}),
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return hydrateAssignments(rows)
}

async function normalizeAssignmentInput(
  input: DecisionAssignmentUpsertInput,
): Promise<{
  levelCode: DecisionLevelCode
  name: string
  title: string
  unitId: string | null
  groupId: string | null
  effdate: Date
}> {
  const level = await getDecisionLevel(input.levelCode)
  const name = input.name.trim()
  const title = input.title.trim()
  if (!name) {
    throw new DecisionValidationError('Name is required')
  }
  if (!title) {
    throw new DecisionValidationError('Title is required')
  }

  let unitId = input.unitId?.trim() || null
  let groupId = input.groupId?.trim() || null

  if (level.scope === 'unit') {
    if (!unitId) {
      throw new DecisionValidationError('Unit is required for this level')
    }
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    })
    if (!unit) {
      throw new DecisionValidationError(`Unit ${unitId} was not found`)
    }
    groupId = null
  } else if (level.scope === 'group') {
    if (!groupId) {
      throw new DecisionValidationError('Group is required for this level')
    }
    const group = await prisma.tbl_group.findUnique({
      where: { id: groupId },
      select: { id: true },
    })
    if (!group) {
      throw new DecisionValidationError(`Group ${groupId} was not found`)
    }
    unitId = null
  } else {
    unitId = null
    groupId = null
  }

  return {
    levelCode: level.code,
    name,
    title,
    unitId,
    groupId,
    effdate: parseDateInput(input.effdate),
  }
}

async function assertNoSameDateOverlap(
  data: {
    levelCode: DecisionLevelCode
    unitId: string | null
    groupId: string | null
    effdate: Date
  },
  excludeId?: number,
): Promise<void> {
  const level = await getDecisionLevel(data.levelCode)
  const targetDate = toDateOnly(data.effdate)

  const rows = await prisma.tbl_decision_assignment.findMany({
    where: {
      level_code: data.levelCode,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
      ...(level.scope === 'unit' && data.unitId
        ? { tbl_unit_id: data.unitId }
        : {}),
      ...(level.scope === 'group' && data.groupId
        ? { tbl_group_id: data.groupId }
        : {}),
    },
    select: {
      signatory: true,
      effdate: true,
    },
  })

  const clash = rows.find((row) => toDateOnly(row.effdate) === targetDate)
  if (!clash) return

  if (level.scope === 'unit') {
    throw new DecisionValidationError(
      `${level.title} for this unit already has a holder effective ${targetDate} (${clash.signatory}).`,
    )
  }
  if (level.scope === 'group') {
    throw new DecisionValidationError(
      `${level.title} for this group already has a holder effective ${targetDate} (${clash.signatory}).`,
    )
  }
  throw new DecisionValidationError(
    `${level.title} already has a holder effective ${targetDate} (${clash.signatory}).`,
  )
}

function mapWriteError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new DecisionValidationError(
      'Another holder is already assigned to this office on that effective date.',
    )
  }
  throw err
}

export async function createDecisionAssignment(
  input: DecisionAssignmentUpsertInput,
): Promise<DecisionAssignment> {
  const data = await normalizeAssignmentInput(input)
  await assertNoSameDateOverlap(data)
  try {
    const row = await prisma.tbl_decision_assignment.create({
      data: {
        level_code: data.levelCode,
        signatory: data.name,
        title: data.title,
        tbl_unit_id: data.unitId,
        tbl_group_id: data.groupId,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateAssignments([row])
    return item
  } catch (err) {
    mapWriteError(err)
  }
}

export async function updateDecisionAssignment(
  id: number,
  input: DecisionAssignmentUpsertInput,
): Promise<DecisionAssignment> {
  const data = await normalizeAssignmentInput(input)
  await assertNoSameDateOverlap(data, id)
  try {
    const row = await prisma.tbl_decision_assignment.update({
      where: { id },
      data: {
        level_code: data.levelCode,
        signatory: data.name,
        title: data.title,
        tbl_unit_id: data.unitId,
        tbl_group_id: data.groupId,
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
      throw new DecisionNotFoundError('Assignment not found')
    }
    mapWriteError(err)
  }
}

export async function deleteDecisionAssignment(id: number): Promise<void> {
  try {
    await prisma.tbl_decision_assignment.delete({ where: { id } })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new DecisionNotFoundError('Assignment not found')
    }
    throw err
  }
}

export async function resolveDecisionSignatory(input: {
  category: number | null
  unitId: string | null
  groupId: string | null
  asOf: Date
}): Promise<{ name: string | null; title: string | null } | null> {
  if (input.category == null || !Number.isInteger(input.category)) {
    return null
  }

  const levels = await listDecisionLevels()
  const level = levels.find(
    (row) => input.category! >= row.catFrom && input.category! <= row.catTo,
  )
  if (!level) return null

  const assignment = await prisma.tbl_decision_assignment.findFirst({
    where: {
      level_code: level.code,
      effdate: { lte: input.asOf },
      ...(level.scope === 'unit'
        ? input.unitId
          ? { tbl_unit_id: input.unitId }
          : { id: -1 }
        : {}),
      ...(level.scope === 'group'
        ? input.groupId
          ? { tbl_group_id: input.groupId }
          : { id: -1 }
        : {}),
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })

  if (!assignment) {
    return { name: null, title: level.title }
  }

  return {
    name: assignment.signatory,
    title: assignment.title || level.title,
  }
}
