import type { User } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  resolveLiveEmployee,
  unitCodesMatch,
} from './live-employee.service.js'
import {
  getRankForJurisdictionCode,
  getScopeKindForJurisdictionCode,
} from './jurisdictions.service.js'
import {
  getJurisdictionForRole,
  getScopeKindForRole,
} from './roles.service.js'

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function requirePermission(
  user: User,
  flag: keyof User['permissions'],
  message = 'You do not have permission for this action',
): Promise<void> {
  if (!user.permissions[flag]) {
    throw new ForbiddenError(message)
  }
}

export async function requireAnyPermission(
  user: User,
  flags: Array<keyof User['permissions']>,
  message = 'You do not have permission for this action',
): Promise<void> {
  if (!flags.some((flag) => user.permissions[flag])) {
    throw new ForbiddenError(message)
  }
}

export type OrgScope =
  | { unrestricted: true }
  | {
      unrestricted: false
      groupId: string | null
      zoneId: string | null
      zoneIds: string[]
      unitIds: string[]
      sectionIds: number[] | null
    }

function emptyScope(): Exclude<OrgScope, { unrestricted: true }> {
  return {
    unrestricted: false,
    groupId: null,
    zoneId: null,
    zoneIds: [],
    unitIds: [],
    sectionIds: null,
  }
}

/**
 * Resolves the organizational records a user may view or manage.
 * Resolution uses the role jurisdiction's scopeKind.
 */
export async function orgScopeForUser(user: User): Promise<OrgScope> {
  const scopeKind = await getScopeKindForRole(user.role)

  if (scopeKind === 'all') {
    return { unrestricted: true }
  }

  if (scopeKind === 'group') {
    if (!user.groupId) return emptyScope()
    const [zones, units] = await Promise.all([
      prisma.tbl_zone.findMany({
        where: { groupId: user.groupId },
        select: { id: true },
      }),
      prisma.tbl_unit.findMany({
        where: { groupid: user.groupId },
        select: { id: true },
      }),
    ])
    return {
      unrestricted: false,
      groupId: user.groupId,
      zoneId: null,
      zoneIds: zones.map((z) => z.id),
      unitIds: units.map((u) => u.id),
      sectionIds: null,
    }
  }

  if (scopeKind === 'zone') {
    if (!user.zoneId) return emptyScope()
    const zone = await prisma.tbl_zone.findUnique({
      where: { id: user.zoneId },
      select: { id: true, groupId: true },
    })
    if (!zone) return emptyScope()
    const units = await prisma.tbl_unit.findMany({
      where: { zoneId: zone.id },
      select: { id: true },
    })
    return {
      unrestricted: false,
      groupId: zone.groupId,
      zoneId: zone.id,
      zoneIds: [zone.id],
      unitIds: units.map((u) => u.id),
      sectionIds: null,
    }
  }

  if (scopeKind === 'unit') {
    if (!user.unitId) return emptyScope()
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: user.unitId },
      select: { id: true, groupid: true, zoneId: true },
    })
    if (!unit) return emptyScope()
    return {
      unrestricted: false,
      groupId: unit.groupid,
      zoneId: unit.zoneId,
      zoneIds: unit.zoneId ? [unit.zoneId] : [],
      unitIds: [unit.id],
      sectionIds: null,
    }
  }

  // section
  if (user.sectionId == null) {
    return { ...emptyScope(), sectionIds: [] }
  }
  const section = await prisma.tbl_section.findUnique({
    where: { id: user.sectionId },
    select: { id: true, tbl_unit_id: true },
  })
  if (!section?.tbl_unit_id) {
    return { ...emptyScope(), sectionIds: [] }
  }
  const unit = await prisma.tbl_unit.findUnique({
    where: { id: section.tbl_unit_id },
    select: { id: true, groupid: true, zoneId: true },
  })
  return {
    unrestricted: false,
    groupId: unit?.groupid ?? null,
    zoneId: unit?.zoneId ?? null,
    zoneIds: unit?.zoneId ? [unit.zoneId] : [],
    unitIds: unit ? [unit.id] : [],
    sectionIds: [section.id],
  }
}

export async function sectionIdsForUser(
  user: User,
): Promise<number[] | null> {
  const scopeKind = await getScopeKindForRole(user.role)

  if (scopeKind === 'all') return null

  if (scopeKind === 'section') {
    return user.sectionId != null ? [user.sectionId] : []
  }

  const unitIds = await unitIdsForUser(user)
  if (unitIds === null) return null
  if (unitIds.length === 0) return []
  const rows = await prisma.tbl_section.findMany({
    where: { tbl_unit_id: { in: unitIds } },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function assertEmployeeInScope(
  user: User,
  matric: string,
): Promise<void> {
  const allowedUnits = await unitIdsForUser(user)
  if (allowedUnits === null) return

  if (allowedUnits.length === 0) {
    throw new ForbiddenError('No organizational scope assigned')
  }

  const live = await resolveLiveEmployee(matric)
  if (
    !live?.codeUnit ||
    !allowedUnits.some((unitId) => unitCodesMatch(unitId, live.codeUnit!))
  ) {
    throw new ForbiddenError('Employee is outside your oversight scope')
  }
}

export async function unitIdsForUser(user: User): Promise<string[] | null> {
  const scope = await orgScopeForUser(user)
  if (scope.unrestricted) return null
  return scope.unitIds
}

export function roleCodeOrFallback(role: string) {
  return role
}

/**
 * Whether a managed user account falls inside the actor's organizational
 * jurisdiction (group includes that group's units and sections).
 */
export async function isUserRecordInScope(
  actor: User,
  target: User,
): Promise<boolean> {
  const scope = await orgScopeForUser(actor)
  if (scope.unrestricted) return true

  const targetScopeKind = await getScopeKindForJurisdictionCode(
    target.jurisdiction,
  )
  if (targetScopeKind === 'all') return false

  const actorRank = await getRankForJurisdictionCode(
    await getJurisdictionForRole(actor.role),
  )
  const targetRank = await getRankForJurisdictionCode(target.jurisdiction)
  if (targetRank > actorRank) return false

  if (targetScopeKind === 'group') {
    return (
      target.groupId != null &&
      scope.groupId != null &&
      target.groupId === scope.groupId
    )
  }

  if (targetScopeKind === 'zone') {
    return (
      target.zoneId != null && scope.zoneIds.includes(target.zoneId)
    )
  }

  if (targetScopeKind === 'unit') {
    return target.unitId != null && scope.unitIds.includes(target.unitId)
  }

  if (targetScopeKind === 'section') {
    if (target.sectionId == null) return false
    if (scope.sectionIds !== null) {
      return scope.sectionIds.includes(target.sectionId)
    }
    const section = await prisma.tbl_section.findUnique({
      where: { id: target.sectionId },
      select: { tbl_unit_id: true },
    })
    return (
      section?.tbl_unit_id != null &&
      scope.unitIds.includes(section.tbl_unit_id)
    )
  }

  return false
}

export async function assertUserRecordInScope(
  actor: User,
  target: User,
  message = 'User is outside your oversight scope',
): Promise<void> {
  if (!(await isUserRecordInScope(actor, target))) {
    throw new ForbiddenError(message)
  }
}

/**
 * Ensures a create/update payload would place the user inside the actor's
 * jurisdiction and not assign a wider role than the actor holds.
 */
export async function assertUserAssignmentInScope(
  actor: User,
  assignment: {
    role: string
    groupId: string | null
    zoneId: string | null
    unitId: string | null
    sectionId: number | null
  },
): Promise<void> {
  const targetJurisdiction = await getJurisdictionForRole(assignment.role)
  const actorJurisdiction = await getJurisdictionForRole(actor.role)
  const scope = await orgScopeForUser(actor)
  const targetScopeKind =
    await getScopeKindForJurisdictionCode(targetJurisdiction)

  if (!scope.unrestricted) {
    if (targetScopeKind === 'all') {
      throw new ForbiddenError(
        'You cannot create or assign unrestricted (all) users',
      )
    }
    const actorRank = await getRankForJurisdictionCode(actorJurisdiction)
    const targetRank = await getRankForJurisdictionCode(targetJurisdiction)
    if (targetRank > actorRank) {
      throw new ForbiddenError(
        'You cannot assign a role with wider jurisdiction than your own',
      )
    }
  }

  const synthetic: User = {
    id: 0,
    username: null,
    role: assignment.role,
    groupId: assignment.groupId,
    zoneId: assignment.zoneId,
    unitId: assignment.unitId,
    sectionId: assignment.sectionId,
    financialYearId: null,
    mustChangePassword: false,
    permissions: {
      canAppraisals: false,
      canFinancialYears: false,
      canOrganization: false,
      canPersonnel: false,
      canLeave: false,
      canLeaveValidate: false,
      canAllowances: false,
      canAllowanceTypes: false,
      canAllowanceCatalog: false,
      canAllowanceRates: false,
      canAllowanceAllocations: false,
      canPositionKeywords: false,
      canAllowanceMatrix: false,
      canCommunicationAllowance: false,
      canValidate: false,
      canDemoteClassification: false,
      canEditValidated: false,
      canLetterCc: false,
      canDecisionMatrix: false,
      canThroughOfficers: false,
      canImportHistory: false,
      canExportHistory: false,
      canImportFleet: false,
      canUsers: false,
      canRoles: false,
    },
    jurisdiction: targetJurisdiction,
  }

  await assertUserRecordInScope(
    actor,
    synthetic,
    'The selected organizational scope is outside your oversight',
  )
}
