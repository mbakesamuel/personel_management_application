import type {
  AppraisalDetail,
  AppraisalListItem,
  AppraisalListQuery,
  AppraisalUpsertInput,
  AwardOption,
  MatricLookupMode,
  MatricLookupResult,
  SectionOption,
  UnitOption,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import {
  findMatriculesForUnits,
  resolveLiveEmployee,
  resolveLiveEmployees,
} from './live-employee.service.js'
import { resolveMatricLookup } from './matric-lookup.service.js'



function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function ageFrom(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1
  }
  return age
}

async function unitIdsFromSectionIds(sectionIds: number[]): Promise<string[]> {
  if (sectionIds.length === 0) return []
  const rows = await prisma.tbl_section.findMany({
    where: { id: { in: sectionIds } },
    select: { tbl_unit_id: true },
  })
  return [
    ...new Set(
      rows
        .map((row) => row.tbl_unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
}

async function matricsForFilters(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null,
): Promise<string[] | null> {
  if (
    scopeSectionIds === null &&
    query.sectionId == null &&
    query.unitId == null
  ) {
    return null
  }

  let unitIds: string[]

  if (query.sectionId != null) {
    if (scopeSectionIds && !scopeSectionIds.includes(query.sectionId)) {
      return []
    }
    unitIds = await unitIdsFromSectionIds([query.sectionId])
  } else if (query.unitId != null) {
    const scopeUnits =
      scopeSectionIds != null
        ? await unitIdsFromSectionIds(scopeSectionIds)
        : null
    if (scopeUnits && !scopeUnits.includes(query.unitId)) {
      return []
    }
    unitIds = [query.unitId]
  } else {
    unitIds = await unitIdsFromSectionIds(scopeSectionIds ?? [])
  }

  if (unitIds.length === 0) {
    return []
  }

  return findMatriculesForUnits(unitIds)
}

function employeeDetailsFromLive(
  live: {
    unitName: string | null
    designation: string | null
    dateEng: Date | null
    dateBirth: Date
  } | null,
): AppraisalDetail['employee'] {
  return {
    section: live?.unitName ?? null,
    designation: live?.designation ?? null,
    dateEngaged: toDateOnly(live?.dateEng),
    dateOfBirth: toDateOnly(live?.dateBirth),
    presentAge: ageFrom(live?.dateBirth),
    lengthService: null,
  }
}

export async function listAppraisals(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null = null,
): Promise<{ items: AppraisalListItem[]; total: number }> {
  const matricFilter = await matricsForFilters(query, scopeSectionIds)

  if (matricFilter && matricFilter.length === 0) {
    return { items: [], total: 0 }
  }

  const rows = await prisma.tbl_perfappraisal.findMany({
    where: {
      ...(query.appyear != null ? { appyear: query.appyear } : {}),
      ...(matricFilter ? { matric: { in: matricFilter } } : {}),
    },
    orderBy: [{ matric: 'asc' }, { id: 'asc' }],
  })

  const matrics = [
    ...new Set(rows.map((r) => r.matric).filter((m): m is string => Boolean(m))),
  ]
  const awardIds = [
    ...new Set(
      rows.map((r) => r.tbl_award_id).filter((id): id is number => id != null),
    ),
  ]

  const [people, awards] = await Promise.all([
    resolveLiveEmployees(matrics),
    awardIds.length
      ? prisma.tbl_award.findMany({
          where: { id: { in: awardIds } },
          select: { id: true, award: true },
        })
      : Promise.resolve([]),
  ])

  const awardById = new Map(awards.map((a) => [a.id, a.award ?? null]))

  const items: AppraisalListItem[] = rows.map((row) => {
    const live = row.matric ? people.get(row.matric) : undefined
    return {
      id: row.id,
      appyear: row.appyear,
      matric: row.matric,
      names: live?.names ?? null,
      dateLmerit: toDateOnly(row.date_lmerit),
      dateLstat: toDateOnly(row.date_lstat),
      dateLpro: toDateOnly(row.date_lpro),
      lengthservice: row.lengthservice,
      preCat: row.pre_cat,
      proCat: row.pro_cat,
      award: row.tbl_award_id != null ? (awardById.get(row.tbl_award_id) ?? null) : null,
      awardId: row.tbl_award_id,
      sectionId: null,
      sectionName: live?.unitName ?? null,
    }
  })

  return { items, total: items.length }
}

export async function getAppraisalDetail(
  id: number,
): Promise<AppraisalDetail | null> {
  const row = await prisma.tbl_perfappraisal.findUnique({ where: { id } })
  if (!row?.matric) return null

  const live = await resolveLiveEmployee(row.matric)
  const employee = employeeDetailsFromLive(live)

  return {
    id: row.id,
    appyear: row.appyear,
    matric: row.matric,
    names: live?.names ?? null,
    preCat: row.pre_cat,
    proCat: row.pro_cat,
    dateLmerit: toDateOnly(row.date_lmerit),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardId: row.tbl_award_id,
    lengthservice: row.lengthservice,
    employee: {
      ...employee,
      lengthService: row.lengthservice ?? employee.lengthService,
    },
  }
}

export async function lookupEmployeeByMatric(
  matric: string,
  appyear: number,
  mode: MatricLookupMode = 'create',
): Promise<MatricLookupResult> {
  return resolveMatricLookup(matric, appyear, mode)
}

export async function upsertAppraisal(
  input: AppraisalUpsertInput,
): Promise<AppraisalDetail> {
  const data = {
    appyear: input.appyear,
    matric: input.matric,
    date_lmerit: parseDateInput(input.dateLmerit),
    date_lstat: parseDateInput(input.dateLstat),
    date_lpro: parseDateInput(input.dateLpro),
    lengthservice: input.lengthservice ?? null,
    pre_cat: input.preCat ?? null,
    pro_cat: input.proCat ?? null,
    tbl_award_id: input.awardId ?? null,
  }

  const row = input.id
    ? await prisma.tbl_perfappraisal.update({ where: { id: input.id }, data })
    : await prisma.tbl_perfappraisal.create({ data })

  const detail = await getAppraisalDetail(row.id)
  if (!detail) {
    throw new Error('Failed to load appraisal after save')
  }
  return detail
}

export async function deleteAppraisal(id: number): Promise<void> {
  await prisma.tbl_perfappraisal.delete({ where: { id } })
}

export async function listAwards(): Promise<AwardOption[]> {
  const rows = await prisma.tbl_award.findMany({ orderBy: { id: 'asc' } })
  return rows.map((r) => ({ id: r.id, award: r.award }))
}

export async function listUnits(): Promise<UnitOption[]> {
  const rows = await prisma.tbl_unit.findMany({
    orderBy: { unit_name: 'asc' },
    select: {
      id: true,
      unit_name: true,
      groupid: true,
      zoneId: true,
      active: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    unitName: r.unit_name,
    groupId: r.groupid,
    zoneId: r.zoneId,
    active: r.active,
  }))
}

export async function listSections(unitId?: string): Promise<SectionOption[]> {
  const rows = await prisma.tbl_section.findMany({
    where: unitId != null ? { tbl_unit_id: unitId } : undefined,
    orderBy: { section: 'asc' },
    select: {
      id: true,
      section: true,
      tbl_unit_id: true,
      active: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    unitId: r.tbl_unit_id,
    active: r.active,
  }))
}
