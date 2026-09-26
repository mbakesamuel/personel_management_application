import type { DashboardResponse, User } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import {
  sectionIdsForUser,
  unitIdsForUser,
} from './authz.service.js'
import {
  resolveLiveEmployees,
  unitCodesMatch,
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

  return { scopeLabel, appyear, appraisals, allowances }
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
    const codeUnit = matric ? (live.get(matric)?.codeUnit ?? null) : null
    if (!inUnitScope(codeUnit, unitIds)) continue
    if (row.tbl_award_id == null) inProgress += 1
    else awarded += 1
  }

  let posted = 0
  if (sectionIds && sectionIds.length === 0) {
    posted = 0
  } else {
    posted = await prisma.tbl_salaryreview.count({
      where: {
        appyear,
        ...(sectionIds ? { tbl_section_id: { in: sectionIds } } : {}),
      },
    })
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
    const codeUnit = live.get(row.matricule)?.codeUnit ?? null
    if (!inUnitScope(codeUnit, unitIds)) continue
    if (row.workflowStatus === 'PENDING') counts.pending += 1
    else if (row.workflowStatus === 'VALIDATED') counts.validated += 1
    else if (row.workflowStatus === 'REJECTED') counts.rejected += 1
  }
  return counts
}
