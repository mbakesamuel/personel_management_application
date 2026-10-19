import type {
  AppraisalListQuery,
  AppraisalSummaryResponse,
  AppraisalSummaryRow,
  AppraisalSummarySection,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  resolveLiveEmployees,
  unitCodesMatch,
  unitMatchIds,
} from './live-employee.service.js'

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function unitInScope(
  unitId: string,
  scopeUnitIds: string[] | null,
): boolean {
  if (scopeUnitIds === null) return true
  return scopeUnitIds.some((allowed) => unitCodesMatch(allowed, unitId))
}

/**
 * Units to keep after jurisdiction + optional unit/section filters.
 * null = unrestricted / no unit filter. Empty = nothing visible.
 */
async function resolveFilterUnitIds(
  query: AppraisalListQuery,
  scopeUnitIds: string[] | null,
): Promise<string[] | null> {
  if (
    scopeUnitIds === null &&
    query.sectionId == null &&
    query.unitId == null
  ) {
    return null
  }

  if (query.sectionId != null) {
    const section = await prisma.tbl_section.findUnique({
      where: { id: query.sectionId },
      select: { tbl_unit_id: true },
    })
    const unitId = section?.tbl_unit_id
    if (!unitId || !unitInScope(unitId, scopeUnitIds)) {
      return []
    }
    return [unitId]
  }

  if (query.unitId != null) {
    if (!unitInScope(query.unitId, scopeUnitIds)) {
      return []
    }
    return [query.unitId]
  }

  return scopeUnitIds ?? []
}

export async function buildAppraisalSummary(
  query: AppraisalListQuery,
  scopeUnitIds: string[] | null = null,
): Promise<AppraisalSummaryResponse> {
  const appyear = query.appyear ?? null
  if (appyear == null) {
    return { appyear: null, sections: [] }
  }

  const filterUnitIds = await resolveFilterUnitIds(query, scopeUnitIds)
  if (filterUnitIds && filterUnitIds.length === 0) {
    return { appyear, sections: [] }
  }

  const where: {
    appyear: number
    matric?: string
  } = { appyear }

  if (query.matric?.trim()) {
    where.matric = query.matric.trim()
  }

  const loaded = await prisma.tbl_salaryreview.findMany({
    where,
    orderBy: [{ tbl_section_id: 'asc' }, { matric: 'asc' }],
  })
  const live = await resolveLiveEmployees(
    loaded
      .map((row) => row.matric?.trim())
      .filter((matric): matric is string => Boolean(matric)),
  )
  const rows = loaded.filter((row) => {
    const matric = row.matric?.trim()
    if (!matric) return false
    const person = live.get(matric)
    if (!person) return false
    if (filterUnitIds === null) return true
    if (!person.codeUnit) return false
    return filterUnitIds.some((id) => unitCodesMatch(id, person.codeUnit!))
  })

  if (rows.length === 0) {
    return { appyear, sections: [] }
  }

  const sectionIds = [
    ...new Set(
      rows
        .map((r) =>
          r.tbl_section_id != null ? Math.trunc(r.tbl_section_id) : null,
        )
        .filter((id): id is number => id != null),
    ),
  ]

  const sections = sectionIds.length
    ? await prisma.tbl_section.findMany({
        where: { id: { in: sectionIds } },
      })
    : []
  const sectionById = new Map(sections.map((s) => [s.id, s]))

  const unitIdsFromSections = sections
    .map((s) => s.tbl_unit_id)
    .filter((id): id is string => Boolean(id))
  const unitIdsFromLive = rows
    .map((r) => {
      const matric = r.matric?.trim()
      return matric ? (live.get(matric)?.codeUnit ?? null) : null
    })
    .filter((id): id is string => Boolean(id))
  const unitIds = [...new Set([...unitIdsFromSections, ...unitIdsFromLive])]

  const units = unitIds.length
    ? await prisma.tbl_unit.findMany({
        where: { id: { in: unitMatchIds(unitIds) } },
      })
    : []
  const unitById = new Map(units.map((u) => [u.id, u]))

  // Resolve padded live codes (e.g. "1") to stored unit ids ("001").
  function resolveUnitRow(code: string | null | undefined) {
    if (!code) return null
    return (
      units.find((u) => unitCodesMatch(u.id, code)) ??
      unitById.get(code) ??
      null
    )
  }

  const groupIds = [...new Set(units.map((u) => u.groupid).filter(Boolean))]
  const groups = groupIds.length
    ? await prisma.tbl_group.findMany({ where: { id: { in: groupIds } } })
    : []
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const storedUnitIds = units.map((u) => u.id)
  const signatories = storedUnitIds.length
    ? await prisma.tbl_unit_signatory.findMany({
        where: { tbl_unit_id: { in: storedUnitIds } },
        orderBy: { effdate: 'desc' },
      })
    : []
  const signatoryByUnit = new Map<
    string,
    { name: string | null; title: string | null }
  >()
  for (const row of signatories) {
    if (!row.tbl_unit_id || signatoryByUnit.has(row.tbl_unit_id)) continue
    signatoryByUnit.set(row.tbl_unit_id, {
      name: row.signatory,
      title: row.title,
    })
  }

  type Bucket = {
    sectionId: number | null
    sectionName: string
    unitId: string | null
    unitName: string | null
    groupName: string | null
    signatoryName: string | null
    signatoryTitle: string | null
    rows: AppraisalSummaryRow[]
  }

  const buckets = new Map<string, Bucket>()

  for (const row of rows) {
    const matric = row.matric?.trim() ?? ''
    const person = matric ? live.get(matric) : undefined
    const sectionId =
      row.tbl_section_id != null ? Math.trunc(row.tbl_section_id) : null
    const section = sectionId != null ? sectionById.get(sectionId) : null
    const liveUnit = resolveUnitRow(person?.codeUnit)
    const unitId = section?.tbl_unit_id ?? liveUnit?.id ?? null
    const unit = unitId
      ? (unitById.get(unitId) ?? resolveUnitRow(unitId))
      : liveUnit

    // Prefer stored section; otherwise one page per live unit (Posted rows
    // have null section id).
    const key =
      sectionId != null
        ? `s:${sectionId}`
        : unit?.id
          ? `u:${unit.id}`
          : '__none__'

    let bucket = buckets.get(key)
    if (!bucket) {
      const group = unit ? groupById.get(unit.groupid) : null
      const signatory = unit?.id ? signatoryByUnit.get(unit.id) : null
      bucket = {
        sectionId,
        sectionName: section?.section ?? unit?.unit_name ?? 'Unassigned',
        unitId: unit?.id ?? null,
        unitName: unit?.unit_name ?? null,
        groupName: group?.group_name ?? null,
        signatoryName: signatory?.name ?? null,
        signatoryTitle: signatory?.title ?? null,
        rows: [],
      }
      buckets.set(key, bucket)
    }

    bucket.rows.push({
      sn: 0,
      matric: row.matric ?? '',
      names: row.names,
      designation: row.designation,
      dateEng: toDateOnly(row.dateeng),
      lengthService: row.lengthservice,
      dateLpro: toDateOnly(row.date_lpro),
      dateLmer: toDateOnly(row.date_lmer),
      dateLstat: toDateOnly(row.date_lstat),
      preCat: row.precat,
      proCat: row.procat,
      preSalary: row.presalary ?? 0,
      proSalary: row.prosalary ?? 0,
      finIncMonth: row.finincmonth ?? 0,
      finIncYear: row.finincyear ?? 0,
      award: row.award,
    })
  }

  const resultSections: AppraisalSummarySection[] = [...buckets.values()]
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName))
    .map((bucket) => {
      const numbered = bucket.rows.map((r, index) => ({
        ...r,
        sn: index + 1,
      }))
      return {
        sectionId: bucket.sectionId,
        sectionName: bucket.sectionName,
        unitId: bucket.unitId,
        unitName: bucket.unitName,
        groupName: bucket.groupName,
        signatoryName: bucket.signatoryName,
        signatoryTitle: bucket.signatoryTitle,
        rows: numbered,
        totals: {
          preSalary: numbered.reduce((s, r) => s + r.preSalary, 0),
          proSalary: numbered.reduce((s, r) => s + r.proSalary, 0),
          finIncMonth: numbered.reduce((s, r) => s + r.finIncMonth, 0),
          finIncYear: numbered.reduce((s, r) => s + r.finIncYear, 0),
        },
      }
    })

  return { appyear, sections: resultSections }
}
