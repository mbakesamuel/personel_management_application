import type {
  DashboardGroupKind,
  DashboardGroupListItem,
  DashboardGroupSummary,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'

export const HUMAN_RESOURCE_GROUP = 'HUMAN_RESOURCE'

const KINDS = new Set<DashboardGroupKind>([
  'HR',
  'WELCOME',
  'COMMUNICATION',
  'ALLOWANCE',
])

export class DashboardGroupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardGroupValidationError'
  }
}

export class DashboardGroupConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardGroupConflictError'
  }
}

function asKind(value: string): DashboardGroupKind {
  if (KINDS.has(value as DashboardGroupKind)) {
    return value as DashboardGroupKind
  }
  return 'WELCOME'
}

function toSummary(row: {
  code: string
  label: string
  kind: string
}): DashboardGroupSummary {
  return {
    code: row.code,
    label: row.label,
    kind: asKind(row.kind),
  }
}

export async function resolveDashboardGroup(
  roleCode: string,
): Promise<DashboardGroupSummary> {
  const assignment = await prisma.dashboardGroupRole.findUnique({
    where: { roleCode },
    include: { group: true },
  })
  if (assignment) return toSummary(assignment.group)

  const fallback = await prisma.dashboardGroup.findUnique({
    where: { code: HUMAN_RESOURCE_GROUP },
  })
  if (!fallback) {
    throw new Error('Human-Resource dashboard group is missing')
  }
  return toSummary(fallback)
}

export async function listDashboardGroups(): Promise<DashboardGroupListItem[]> {
  const rows = await prisma.dashboardGroup.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    include: { assignments: { select: { roleCode: true } } },
  })
  return rows.map((row) => ({
    ...toSummary(row),
    system: row.system,
    roleCodes: row.assignments.map((item) => item.roleCode).sort(),
  }))
}

function codeFromLabel(label: string): string {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  if (!/^[A-Z][A-Z0-9_]*$/.test(base)) {
    throw new DashboardGroupValidationError(
      'Group name must start with a letter',
    )
  }
  return base
}

export async function createDashboardGroup(
  label: string,
): Promise<DashboardGroupListItem> {
  const trimmed = label.trim()
  const duplicate = await prisma.dashboardGroup.findFirst({
    where: { label: trimmed },
  })
  if (duplicate) {
    throw new DashboardGroupConflictError(
      'A dashboard group with this name already exists',
    )
  }

  const base = codeFromLabel(trimmed)
  let code = base
  let suffix = 2
  while (await prisma.dashboardGroup.findUnique({ where: { code } })) {
    const tail = `_${suffix}`
    code = `${base.slice(0, 40 - tail.length)}${tail}`
    suffix += 1
    if (suffix > 50) {
      throw new DashboardGroupConflictError(
        'Could not create a unique group code',
      )
    }
  }

  const last = await prisma.dashboardGroup.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const created = await prisma.dashboardGroup.create({
    data: {
      code,
      label: trimmed,
      kind: 'WELCOME',
      system: false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  })

  return {
    ...toSummary(created),
    system: created.system,
    roleCodes: [],
  }
}

export async function saveDashboardGroupAssignments(
  assignments: { roleCode: string; groupCode: string }[],
): Promise<DashboardGroupListItem[]> {
  const roleCodes = assignments.map((row) => row.roleCode)
  const groupCodes = [...new Set(assignments.map((row) => row.groupCode))]

  const [roles, groups] = await Promise.all([
    roleCodes.length === 0
      ? Promise.resolve([])
      : prisma.tbl_roles.findMany({
          where: { code: { in: roleCodes } },
          select: { code: true },
        }),
    groupCodes.length === 0
      ? Promise.resolve([])
      : prisma.dashboardGroup.findMany({
          where: { code: { in: groupCodes } },
          select: { code: true },
        }),
  ])

  const knownRoles = new Set(roles.map((row) => row.code))
  const missingRole = roleCodes.find((code) => !knownRoles.has(code))
  if (missingRole) {
    throw new DashboardGroupValidationError(`Unknown role ${missingRole}`)
  }

  const knownGroups = new Set(groups.map((row) => row.code))
  const missingGroup = groupCodes.find((code) => !knownGroups.has(code))
  if (missingGroup) {
    throw new DashboardGroupValidationError(
      `Unknown dashboard group ${missingGroup}`,
    )
  }

  await prisma.$transaction([
    prisma.dashboardGroupRole.deleteMany(),
    ...(assignments.length === 0
      ? []
      : [
          prisma.dashboardGroupRole.createMany({
            data: assignments.map((row) => ({
              roleCode: row.roleCode,
              groupCode: row.groupCode,
            })),
          }),
        ]),
  ])

  return listDashboardGroups()
}
