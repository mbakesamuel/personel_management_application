import { Prisma } from '@prisma/client'
import type {
  AllowanceDashboard,
  CommunicationDashboard,
  DashboardMonthBar,
  DashboardResponse,
  DashboardSexBar,
  DashboardSlice,
  DashboardWorkforce,
  HomeDashboardResponse,
  User,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  sectionIdsForUser,
  unitIdsForUser,
} from './authz.service.js'
import { resolveDashboardGroup } from './dashboard-groups.service.js'
import {
  resolveLiveEmployees,
  unitCodesMatch,
  unitMatchIds,
} from './live-employee.service.js'

function inUnitScope(
  codeUnit: string | null,
  unitIds: string[] | null,
): boolean {
  if (unitIds === null) return true
  if (!codeUnit || unitIds.length === 0) return false
  return unitIds.some((id) => unitCodesMatch(id, codeUnit))
}

async function scopeLabelFor(user: User): Promise<string> {
  const jurisdiction = await prisma.tbl_jurisdiction.findUnique({
    where: { code: user.jurisdiction },
    select: { label: true },
  })
  const base = jurisdiction?.label?.trim() || user.jurisdiction
  if (user.jurisdiction === 'all') return base

  if (user.sectionId != null) {
    const section = await prisma.tbl_section.findUnique({
      where: { id: user.sectionId },
      select: { section: true },
    })
    const name = section?.section?.trim()
    if (name) return `${base} — ${name}`
  }
  if (user.unitId) {
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: user.unitId },
      select: { unit_name: true },
    })
    if (unit?.unit_name) return `${base} — ${unit.unit_name}`
  }
  if (user.zoneId) {
    const zone = await prisma.tbl_zone.findUnique({
      where: { id: user.zoneId },
      select: { zone_name: true },
    })
    if (zone?.zone_name) return `${base} — ${zone.zone_name}`
  }
  if (user.groupId) {
    const group = await prisma.tbl_group.findUnique({
      where: { id: user.groupId },
      select: { group_name: true },
    })
    if (group?.group_name) return `${base} — ${group.group_name}`
  }
  return base
}

export async function buildDashboard(user: User): Promise<DashboardResponse> {
  const scopeLabel = await scopeLabelFor(user)
  const yearRow = user.financialYearId
    ? await prisma.tbl_financialyear.findUnique({
        where: { id: user.financialYearId },
        select: { appyear: true },
      })
    : null
  const appyear = yearRow?.appyear ?? null

  const [unitIds, sectionIds] = await Promise.all([
    unitIdsForUser(user),
    sectionIdsForUser(user),
  ])

  const appraisals = user.permissions.canAppraisals
    ? await appraisalCounts(appyear, unitIds, sectionIds)
    : null
  const allowances = user.permissions.canAllowances
    ? await allowanceCounts(unitIds)
    : null

  const workforce = await workforceCharts(appyear, unitIds)

  return { scopeLabel, appyear, appraisals, allowances, workforce }
}

async function buildCommunicationDashboard(): Promise<CommunicationDashboard> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [
    openLines,
    closedLines,
    incompleteRegistrations,
    openRows,
    operators,
    details,
    batchesThisMonth,
  ] = await Promise.all([
      prisma.fleetRegistration.count({ where: { endDate: null } }),
      prisma.fleetRegistration.count({ where: { endDate: { not: null } } }),
      prisma.fleetRegistration.count({
        where: { endDate: null, fleetRegDetails: { none: {} } },
      }),
      prisma.fleetRegistration.findMany({
        where: { endDate: null },
        select: { matricule: true },
      }),
      prisma.tbl_operator.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.fleetRegDetails.findMany({
        where: {
          fleetRegistration: { endDate: null },
        },
        select: {
          id: true,
          fleetRegistrationId: true,
          operator_id: true,
          phoneNumber: true,
          serviceId: true,
          amount: true,
          service: { select: { name: true } },
        },
        orderBy: [{ id: 'desc' }],
      }),
      prisma.communicationBatch.count({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ])

  const employees = new Set(openRows.map((row) => row.matricule))
  const counts = new Map<number, number>()
  const counted = new Set<string>()

  const best = new Map<string, { amount: number; name: string }>()
  for (const row of details) {
    const lineKey = `${row.fleetRegistrationId}:${row.operator_id}`
    if (!counted.has(lineKey)) {
      counted.add(lineKey)
      counts.set(row.operator_id, (counts.get(row.operator_id) ?? 0) + 1)
    }
    const key = `${row.fleetRegistrationId}:${row.operator_id}:${row.phoneNumber ?? ''}:${row.serviceId}`
    if (best.has(key)) continue
    best.set(key, { amount: row.amount, name: row.service.name })
  }

  let airtimeTotal = 0
  let dataTotal = 0
  for (const item of best.values()) {
    const name = item.name.trim().toLowerCase()
    if (name === 'airtime') airtimeTotal += item.amount
    else if (name === 'data') dataTotal += item.amount
  }

  return {
    openLines,
    closedLines,
    employeesOnOpenLines: employees.size,
    operators: operators
      .map((operator) => ({
        name: operator.name,
        openLines: counts.get(operator.id) ?? 0,
      }))
      .sort(
        (left, right) =>
          right.openLines - left.openLines ||
          left.name.localeCompare(right.name),
      ),
    airtimeTotal,
    dataTotal,
    batchesThisMonth,
    incompleteRegistrations,
  }
}

async function buildAllowanceDashboard(): Promise<AllowanceDashboard> {
  const rows = await prisma.tbl_allowance_allocation.findMany({
    where: { current: true },
    select: {
      matricule: true,
      allowanceAmt: true,
      workflowStatus: true,
      allowance: { select: { allowanceName: true } },
    },
  })

  const employees = new Set<string>()
  const amounts = new Map<string, number>()
  let pending = 0
  let validated = 0
  let rejected = 0
  let totalAmount = 0

  for (const row of rows) {
    employees.add(row.matricule)
    totalAmount += row.allowanceAmt
    const name = row.allowance.allowanceName.trim() || 'Allowance'
    amounts.set(name, (amounts.get(name) ?? 0) + row.allowanceAmt)
    if (row.workflowStatus === 'PENDING') pending += 1
    else if (row.workflowStatus === 'VALIDATED') validated += 1
    else if (row.workflowStatus === 'REJECTED') rejected += 1
  }

  return {
    currentAllocations: rows.length,
    employeesAllocated: employees.size,
    pending,
    validated,
    rejected,
    totalAmount,
    allowances: [...amounts.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort(
        (left, right) =>
          right.amount - left.amount || left.name.localeCompare(right.name),
      ),
  }
}

export async function buildHomeDashboard(
  user: User,
): Promise<HomeDashboardResponse> {
  const group = await resolveDashboardGroup(user.role)
  if (group.kind === 'HR') {
    return {
      group,
      hr: await buildDashboard(user),
      communication: null,
      allowance: null,
    }
  }
  if (group.kind === 'COMMUNICATION') {
    return {
      group,
      hr: null,
      communication: await buildCommunicationDashboard(),
      allowance: null,
    }
  }
  if (group.kind === 'ALLOWANCE') {
    return {
      group,
      hr: null,
      communication: null,
      allowance: await buildAllowanceDashboard(),
    }
  }
  return { group, hr: null, communication: null, allowance: null }
}

async function appraisalCounts(
  appyear: number | null,
  unitIds: string[] | null,
  sectionIds: number[] | null,
): Promise<DashboardResponse['appraisals']> {
  if (appyear == null) {
    return { inProgress: 0, awarded: 0, posted: 0 }
  }
  if (unitIds && unitIds.length === 0) {
    return { inProgress: 0, awarded: 0, posted: 0 }
  }

  const rows = await prisma.tbl_perfappraisal.findMany({
    where: { appyear },
    select: { matric: true, tbl_award_id: true },
  })
  const matrics = [
    ...new Set(
      rows
        .map((row) => row.matric?.trim())
        .filter((matric): matric is string => Boolean(matric)),
    ),
  ]
  const live = await resolveLiveEmployees(matrics)

  let inProgress = 0
  let awarded = 0
  for (const row of rows) {
    const matric = row.matric?.trim()
    const person = matric ? live.get(matric) : undefined
    if (!person || !inUnitScope(person.codeUnit, unitIds)) continue
    if (row.tbl_award_id == null) inProgress += 1
    else awarded += 1
  }

  let posted = 0
  if (sectionIds && sectionIds.length === 0) {
    posted = 0
  } else {
    const postedRows = await prisma.tbl_salaryreview.findMany({
      where: {
        appyear,
        ...(sectionIds ? { tbl_section_id: { in: sectionIds } } : {}),
      },
      select: { matric: true },
    })
    const postedLive = await resolveLiveEmployees(
      postedRows
        .map((row) => row.matric?.trim())
        .filter((matric): matric is string => Boolean(matric)),
    )
    posted = postedRows.filter((row) => {
      const matric = row.matric?.trim()
      return matric ? postedLive.has(matric) : false
    }).length
  }

  return { inProgress, awarded, posted }
}

async function allowanceCounts(
  unitIds: string[] | null,
): Promise<DashboardResponse['allowances']> {
  const empty = { pending: 0, validated: 0, rejected: 0 }
  if (unitIds && unitIds.length === 0) return empty

  const rows = await prisma.tbl_allowance_allocation.findMany({
    where: {
      current: true,
      workflowStatus: { in: ['PENDING', 'VALIDATED', 'REJECTED'] },
    },
    select: { matricule: true, workflowStatus: true },
  })
  const live = await resolveLiveEmployees(rows.map((row) => row.matricule))
  const counts = { ...empty }
  for (const row of rows) {
    const person = live.get(row.matricule)
    if (!person || !inUnitScope(person.codeUnit, unitIds)) continue
    if (row.workflowStatus === 'PENDING') counts.pending += 1
    else if (row.workflowStatus === 'VALIDATED') counts.validated += 1
    else if (row.workflowStatus === 'REJECTED') counts.rejected += 1
  }
  return counts
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function scopeSql(unitIds: string[] | null): Prisma.Sql {
  if (unitIds === null) return Prisma.sql`TRUE`
  const ids = unitMatchIds(unitIds)
  if (ids.length === 0) return Prisma.sql`FALSE`
  return Prisma.sql`e.currentUnitId IN (${Prisma.join(ids)})`
}

function countOf(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') return Number(value)
  return value ?? 0
}

function labelOf(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? ''
  return trimmed || fallback
}

function pivotSex(
  rows: { label: string; sex: string; value: number }[],
): DashboardSexBar[] {
  const map = new Map<string, DashboardSexBar>()
  for (const row of rows) {
    const entry = map.get(row.label) ?? { label: row.label, male: 0, female: 0 }
    if (row.sex === 'Male') entry.male += row.value
    else if (row.sex === 'Female') entry.female += row.value
    map.set(row.label, entry)
  }
  return [...map.values()]
}

function compareCategory(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.localeCompare(b)
}

function topPlaces(rows: DashboardSlice[], limit: number): DashboardSlice[] {
  const ranked = [...rows].sort((a, b) => b.value - a.value)
  const top = ranked.slice(0, limit)
  const rest = ranked.slice(limit).reduce((sum, row) => sum + row.value, 0)
  if (rest > 0) top.push({ label: 'Other', value: rest })
  return top
}

function emptyWorkforce(): DashboardWorkforce {
  return {
    sex: [],
    category: [],
    group: [],
    workStatus: [],
    place: [],
    movement: MONTHS.map((label) => ({
      label,
      engagements: 0,
      departures: 0,
    })),
  }
}

async function workforceCharts(
  appyear: number | null,
  unitIds: string[] | null,
): Promise<DashboardWorkforce> {
  const year = appyear ?? new Date().getFullYear()
  if (unitIds && unitIds.length === 0) return emptyWorkforce()

  const scope = scopeSql(unitIds)
  const [sexRows, categoryRows, groupRows, workRows, placeRows, engagementRows, departureRows] =
    await Promise.all([
      prisma.$queryRaw<{ sex: string; c: bigint }[]>(Prisma.sql`
        SELECT e.sex AS sex, COUNT(*) AS c
        FROM tbl_employee e
        WHERE e.active = 1
          AND e.sex IN ('Male', 'Female')
          AND ${scope}
        GROUP BY e.sex
      `),
      prisma.$queryRaw<{ category: string | null; sex: string; c: bigint }[]>(Prisma.sql`
        SELECT c.category AS category, e.sex AS sex, COUNT(*) AS c
        FROM tbl_emp_class c
        INNER JOIN tbl_employee e ON e.matricule = c.matricule
        WHERE c.current = 1
          AND c.workflowStatus = 'VALIDATED'
          AND e.active = 1
          AND e.sex IN ('Male', 'Female')
          AND ${scope}
        GROUP BY c.category, e.sex
      `),
      prisma.$queryRaw<{ group_name: string | null; sex: string; c: bigint }[]>(Prisma.sql`
        SELECT g.group_name AS group_name, e.sex AS sex, COUNT(*) AS c
        FROM tbl_employee e
        INNER JOIN tbl_unit u ON u.id = e.currentUnitId
        INNER JOIN tbl_group g ON g.id = u.groupid
        WHERE e.active = 1
          AND e.sex IN ('Male', 'Female')
          AND ${scope}
        GROUP BY g.group_name, e.sex
      `),
      prisma.$queryRaw<{ workStat: string | null; c: bigint }[]>(Prisma.sql`
        SELECT em.workStat AS workStat, COUNT(*) AS c
        FROM tbl_emp_employment em
        INNER JOIN tbl_employee e ON e.matricule = em.matricule
        WHERE em.current = 1
          AND em.workflowStatus = 'VALIDATED'
          AND e.active = 1
          AND ${scope}
        GROUP BY em.workStat
      `),
      prisma.$queryRaw<{ placeEng: string | null; c: bigint }[]>(Prisma.sql`
        SELECT em.placeEng AS placeEng, COUNT(*) AS c
        FROM tbl_emp_employment em
        INNER JOIN tbl_employee e ON e.matricule = em.matricule
        WHERE em.current = 1
          AND em.workflowStatus = 'VALIDATED'
          AND e.active = 1
          AND ${scope}
        GROUP BY em.placeEng
      `),
      prisma.$queryRaw<{ month: number | bigint; c: bigint }[]>(Prisma.sql`
        SELECT MONTH(em.dateEng) AS month, COUNT(*) AS c
        FROM tbl_emp_employment em
        INNER JOIN tbl_employee e ON e.matricule = em.matricule
        WHERE em.current = 1
          AND em.workflowStatus = 'VALIDATED'
          AND e.active = 1
          AND YEAR(em.dateEng) = ${year}
          AND ${scope}
        GROUP BY MONTH(em.dateEng)
      `),
      prisma.$queryRaw<{ month: number | bigint; c: bigint }[]>(Prisma.sql`
        SELECT MONTH(d.effectiveDate) AS month, COUNT(*) AS c
        FROM tbl_emp_departure d
        INNER JOIN tbl_employee e ON e.matricule = d.matricule
        WHERE d.workflowStatus = 'VALIDATED'
          AND d.effectiveDate >= '1970-01-01'
          AND YEAR(d.effectiveDate) = ${year}
          AND e.active = 1
          AND ${scope}
        GROUP BY MONTH(d.effectiveDate)
      `),
    ])

  const sexOrder = ['Male', 'Female']
  const sex: DashboardSlice[] = sexOrder.map((label) => ({
    label,
    value: countOf(sexRows.find((row) => row.sex === label)?.c),
  }))

  const category = pivotSex(
    categoryRows.map((row) => ({
      label: labelOf(row.category, 'Unknown'),
      sex: row.sex,
      value: countOf(row.c),
    })),
  ).sort((a, b) => compareCategory(a.label, b.label))

  const group = pivotSex(
    groupRows.map((row) => ({
      label: labelOf(row.group_name, 'Unknown'),
      sex: row.sex,
      value: countOf(row.c),
    })),
  ).sort((a, b) => a.label.localeCompare(b.label))

  const workStatus = workRows
    .map((row) => ({
      label: labelOf(row.workStat, 'Unknown'),
      value: countOf(row.c),
    }))
    .sort((a, b) => b.value - a.value)

  const place = topPlaces(
    placeRows.map((row) => ({
      label: labelOf(row.placeEng, 'Unknown'),
      value: countOf(row.c),
    })),
    8,
  )

  const engagements = new Map(
    engagementRows.map((row) => [countOf(row.month), countOf(row.c)]),
  )
  const departures = new Map(
    departureRows.map((row) => [countOf(row.month), countOf(row.c)]),
  )
  const movement: DashboardMonthBar[] = MONTHS.map((label, index) => ({
    label,
    engagements: engagements.get(index + 1) ?? 0,
    departures: departures.get(index + 1) ?? 0,
  }))

  return { sex, category, group, workStatus, place, movement }
}
