import type {
  AppraisalListQuery,
  AppraisalSummaryResponse,
  AppraisalSummaryRow,
  AppraisalSummarySection,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function resolveAllowedSectionIds(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null,
): Promise<number[] | null> {
  if (
    scopeSectionIds === null &&
    query.sectionId == null &&
    query.unitId == null
  ) {
    return null
  }

  let sectionIds: number[]

  if (query.sectionId != null) {
    if (scopeSectionIds && !scopeSectionIds.includes(query.sectionId)) {
      return []
    }
    sectionIds = [query.sectionId]
  } else if (query.unitId != null) {
    const unitSections = (
      await prisma.tbl_section.findMany({
        where: { tbl_unit_id: query.unitId },
        select: { id: true },
      })
    ).map((s) => s.id)
    sectionIds = scopeSectionIds
      ? unitSections.filter((id) => scopeSectionIds.includes(id))
      : unitSections
  } else {
    sectionIds = scopeSectionIds ?? []
  }

  return sectionIds
}

export async function buildAppraisalSummary(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null = null,
): Promise<AppraisalSummaryResponse> {
  const appyear = query.appyear ?? null
  if (appyear == null) {
    return { appyear: null, sections: [] }
  }

  const allowedSections = await resolveAllowedSectionIds(
    query,
    scopeSectionIds,
  )
  if (allowedSections && allowedSections.length === 0) {
    return { appyear, sections: [] }
  }

  const where: {
    appyear: number
    matric?: string
    tbl_section_id?: { in: number[] }
  } = { appyear }

  if (query.matric?.trim()) {
    where.matric = query.matric.trim()
  }
  if (allowedSections) {
    where.tbl_section_id = { in: allowedSections }
  }

  const rows = await prisma.tbl_salaryreview.findMany({
    where,
    orderBy: [{ tbl_section_id: 'asc' }, { matric: 'asc' }],
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

  const sections = await prisma.tbl_section.findMany({
    where: { id: { in: sectionIds } },
  })
  const sectionById = new Map(sections.map((s) => [s.id, s]))

  const unitIds = [
    ...new Set(
      sections
        .map((s) => s.tbl_unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const units = unitIds.length
    ? await prisma.tbl_unit.findMany({ where: { id: { in: unitIds } } })
    : []
  const unitById = new Map(units.map((u) => [u.id, u]))

  const groupIds = [...new Set(units.map((u) => u.groupid).filter(Boolean))]
  const groups = groupIds.length
    ? await prisma.tbl_group.findMany({ where: { id: { in: groupIds } } })
    : []
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const signatories = unitIds.length
    ? await prisma.tbl_unit_signatory.findMany({
        where: { tbl_unit_id: { in: unitIds } },
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
    const sectionId =
      row.tbl_section_id != null ? Math.trunc(row.tbl_section_id) : null
    const key = sectionId != null ? String(sectionId) : '__none__'
    let bucket = buckets.get(key)
    if (!bucket) {
      const section = sectionId != null ? sectionById.get(sectionId) : null
      const unitId = section?.tbl_unit_id ?? null
      const unit = unitId ? unitById.get(unitId) : null
      const group = unit ? groupById.get(unit.groupid) : null
      const signatory = unitId ? signatoryByUnit.get(unitId) : null
      bucket = {
        sectionId,
        sectionName: section?.section ?? 'Unassigned',
        unitId,
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
