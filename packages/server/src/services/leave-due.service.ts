import type { LeaveDueQuery, LeaveDueRow, User } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  ForbiddenError,
  orgScopeForUser,
  unitIdsForUser,
} from './authz.service.js'
import {
  annualLeaveAccrual,
  completedMonths,
  completedYears,
  effectiveOn,
  leaveAccrualStart,
} from './leave.service.js'
import {
  formatEmployeeName,
  unitCodesMatch,
  unitMatchIds,
} from './live-employee.service.js'

const MIN_DUE_MONTHS = 12

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function utcDateOnly(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function unitIdsForQuery(
  user: User,
  query: LeaveDueQuery,
): Promise<string[] | null> {
  const scope = await orgScopeForUser(user)
  if (!scope.unrestricted) {
    if (query.groupId && scope.groupId && query.groupId !== scope.groupId) {
      throw new ForbiddenError('Group is outside your oversight scope')
    }
    if (query.zoneId && !scope.zoneIds.includes(query.zoneId)) {
      throw new ForbiddenError('Zone is outside your oversight scope')
    }
    if (
      query.unitId &&
      !scope.unitIds.some((unitId) => unitCodesMatch(unitId, query.unitId!))
    ) {
      throw new ForbiddenError('Unit is outside your oversight scope')
    }
  }

  const allowed = await unitIdsForUser(user)
  if (allowed !== null && allowed.length === 0) return []

  if (query.unitId) {
    return unitMatchIds([query.unitId])
  }

  if (query.groupId || query.zoneId) {
    const units = await prisma.tbl_unit.findMany({
      where: {
        ...(query.groupId ? { groupid: query.groupId } : {}),
        ...(query.zoneId ? { zoneId: query.zoneId } : {}),
        ...(allowed ? { id: { in: unitMatchIds(allowed) } } : {}),
      },
      select: { id: true },
    })
    return unitMatchIds(units.map((unit) => unit.id))
  }

  return allowed === null ? null : unitMatchIds(allowed)
}

export async function listLeaveDue(
  user: User,
  query: LeaveDueQuery,
): Promise<LeaveDueRow[]> {
  const unitIds = await unitIdsForQuery(user, query)
  if (unitIds !== null && unitIds.length === 0) return []

  const asOf = todayUtc()
  const employees = await prisma.tbl_employee.findMany({
    where: {
      active: true,
      workflowStatus: 'VALIDATED',
      ...(unitIds ? { currentUnitId: { in: unitIds } } : {}),
      ...(query.matricule
        ? { matricule: { contains: query.matricule.trim() } }
        : {}),
    },
    select: {
      matricule: true,
      name: true,
      firstname: true,
      sex: true,
      currentUnitId: true,
    },
  })
  if (employees.length === 0) return []

  const matricules = employees.map((employee) => employee.matricule)
  const [
    histories,
    employments,
    classifications,
    movements,
    pendingRequests,
    motherSetting,
    policy,
    entitlement,
    monthlyRate,
    seniorityRules,
  ] = await Promise.all([
    prisma.tbl_employee_leave_history.findMany({
      where: { matricule: { in: matricules } },
      select: { matricule: true, leaveEndDate: true, resumedDate: true },
      orderBy: { leaveEndDate: 'desc' },
    }),
    prisma.tbl_emp_employment.findMany({
      where: {
        matricule: { in: matricules },
        workflowStatus: 'VALIDATED',
        current: true,
      },
      select: { matricule: true, dateEng: true, jobEng: true },
    }),
    prisma.tbl_emp_class.findMany({
      where: { matricule: { in: matricules }, workflowStatus: 'VALIDATED' },
      orderBy: [{ letter_date: 'desc' }, { effective_date: 'desc' }, { id: 'desc' }],
      select: { matricule: true, category: true },
    }),
    prisma.tbl_emp_movement.findMany({
      where: { matricule: { in: matricules }, workflowStatus: 'VALIDATED' },
      orderBy: [{ Eff_date: 'desc' }, { id: 'desc' }],
      select: { matricule: true, Position: true },
    }),
    prisma.tbl_leave_request.findMany({
      where: { matricule: { in: matricules }, workflowStatus: 'PENDING' },
      select: { matricule: true },
    }),
    prisma.tbl_leave_mother_setting.findUnique({
      where: { id: 1 },
      select: { daysPerChild: true, maxAgeYears: true },
    }),
    prisma.tbl_leave_calculation_policy.findFirst({
      where: effectiveOn(asOf),
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.tbl_leave_entitlement_rule.findFirst({
      where: effectiveOn(asOf),
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.tbl_leave_monthly_rate_rule.findFirst({
      where: effectiveOn(asOf),
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.tbl_leave_seniority_rule.findMany({
      where: effectiveOn(asOf),
      orderBy: { minYears: 'desc' },
    }),
  ])

  const latestResume = new Map<string, Date>()
  for (const row of histories) {
    if (row.resumedDate) {
      const current = latestResume.get(row.matricule)
      if (!current || row.resumedDate > current) {
        latestResume.set(row.matricule, row.resumedDate)
      }
    }
  }
  const employmentByMatric = new Map(
    employments.map((row) => [row.matricule, row]),
  )
  const categoryByMatric = new Map<string, string>()
  for (const row of classifications) {
    if (!categoryByMatric.has(row.matricule)) {
      categoryByMatric.set(row.matricule, row.category)
    }
  }
  const positionByMatric = new Map<string, string | null>()
  for (const row of movements) {
    if (!positionByMatric.has(row.matricule)) {
      positionByMatric.set(row.matricule, row.Position)
    }
  }
  const pending = new Set(pendingRequests.map((row) => row.matricule))

  const unitCodes = [
    ...new Set(
      employees
        .map((employee) => employee.currentUnitId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const units = unitCodes.length
    ? await prisma.tbl_unit.findMany({
        where: { id: { in: unitMatchIds(unitCodes) } },
        select: { id: true, unit_name: true, groupid: true, zoneId: true },
      })
    : []
  const groupIds = [...new Set(units.map((unit) => unit.groupid))]
  const zoneIds = [...new Set(units.map((unit) => unit.zoneId))]
  const [groups, zones] = await Promise.all([
    groupIds.length
      ? prisma.tbl_group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, group_name: true },
        })
      : [],
    zoneIds.length
      ? prisma.tbl_zone.findMany({
          where: { id: { in: zoneIds } },
          select: { id: true, zone_name: true },
        })
      : [],
  ])
  const groupNameById = new Map(groups.map((group) => [group.id, group.group_name]))
  const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.zone_name]))

  function placeFor(unitId: string | null) {
    if (!unitId) {
      return { unitName: null, groupName: null, zoneName: null }
    }
    const unit = units.find((row) => unitCodesMatch(row.id, unitId))
    if (!unit) return { unitName: null, groupName: null, zoneName: null }
    return {
      unitName: unit.unit_name,
      groupName: groupNameById.get(unit.groupid) ?? null,
      zoneName: zoneNameById.get(unit.zoneId) ?? null,
    }
  }

  type DueCandidate = {
    matricule: string
    name: string
    sex: string | null
    designation: string | null
    category: string | null
    groupName: string | null
    zoneName: string | null
    unitName: string | null
    lastReturnDate: Date | null
    accrualStartDate: Date
    completedMonths: number
    serviceYears: number
  }

  const due: DueCandidate[] = []
  for (const employee of employees) {
    const employment = employmentByMatric.get(employee.matricule)
    if (!employment?.dateEng) continue
    const resumedDate = latestResume.get(employee.matricule) ?? null
    const accrualStartDate = leaveAccrualStart({
      resumedDate,
      dateEng: employment.dateEng,
    })
    const months = completedMonths(accrualStartDate, asOf)
    if (months < MIN_DUE_MONTHS) continue
    const place = placeFor(employee.currentUnitId)
    due.push({
      matricule: employee.matricule,
      name: formatEmployeeName(employee.name, employee.firstname),
      sex: employee.sex,
      designation:
        positionByMatric.get(employee.matricule) ?? employment.jobEng ?? null,
      category: categoryByMatric.get(employee.matricule) ?? null,
      groupName: place.groupName,
      zoneName: place.zoneName,
      unitName: place.unitName,
      lastReturnDate: resumedDate,
      accrualStartDate,
      completedMonths: months,
      serviceYears: completedYears(employment.dateEng, asOf),
    })
  }

  const mothersApply =
    (motherSetting?.daysPerChild ?? 0) > 0 &&
    (motherSetting?.maxAgeYears ?? 0) > 0
  const femaleMatricules = mothersApply
    ? due.filter((row) => row.sex === 'Female').map((row) => row.matricule)
    : []
  const children = femaleMatricules.length
    ? await prisma.tbl_emp_family_member.findMany({
        where: {
          matricule: { in: femaleMatricules },
          relationship: 'CHILD',
          workflowStatus: 'VALIDATED',
          current: true,
        },
        select: { matricule: true, dateOfBirth: true },
      })
    : []
  const birthsByMatric = new Map<string, Date[]>()
  for (const child of children) {
    const list = birthsByMatric.get(child.matricule) ?? []
    list.push(child.dateOfBirth)
    birthsByMatric.set(child.matricule, list)
  }

  const rows: LeaveDueRow[] = due.map((row) => {
    const seniority = seniorityRules.find(
      (rule) =>
        rule.minYears <= row.serviceYears &&
        (rule.maxYears == null || rule.maxYears >= row.serviceYears),
    )
    let earnedDays: number | null = null
    if (policy && seniority) {
      const methodReady =
        policy.method === 'METHOD_1' ? entitlement != null : monthlyRate != null
      if (methodReady) {
        const accrual = annualLeaveAccrual({
          method: policy.method,
          annualDays: entitlement?.annualDays ?? null,
          monthlyDays: monthlyRate?.monthlyDays ?? null,
          seniorityBonusDays: seniority.bonusDays,
          eligibleMonths: row.completedMonths,
        })
        const qualifying =
          row.sex === 'Female' && mothersApply
            ? (birthsByMatric.get(row.matricule) ?? []).filter(
                (birth) =>
                  completedYears(birth, asOf) < (motherSetting?.maxAgeYears ?? 0),
              ).length
            : 0
        earnedDays =
          accrual.earnedDays.toNumber() +
          qualifying * (motherSetting?.daysPerChild ?? 0)
      }
    }
    return {
      matricule: row.matricule,
      name: row.name,
      designation: row.designation,
      category: row.category,
      groupName: row.groupName,
      zoneName: row.zoneName,
      unitName: row.unitName,
      lastReturnDate: row.lastReturnDate ? utcDateOnly(row.lastReturnDate) : null,
      accrualStartDate: utcDateOnly(row.accrualStartDate),
      completedMonths: row.completedMonths,
      durationYears: Math.floor(row.completedMonths / 12),
      durationMonths: row.completedMonths % 12,
      earnedDays,
      application: pending.has(row.matricule) ? 'Pending' : null,
    }
  })

  rows.sort(
    (left, right) =>
      right.completedMonths - left.completedMonths ||
      left.name.localeCompare(right.name),
  )
  return rows
}
