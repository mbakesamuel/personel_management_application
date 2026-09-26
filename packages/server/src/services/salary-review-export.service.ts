import type {
  SalaryReviewExportQuery,
  SalaryReviewExportResponse,
  SalaryReviewExportRow,
  SalaryReviewExportSection,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function sectionPk(raw: number | null | undefined): number | null {
  if (raw == null) return null
  const id = Math.trunc(raw)
  return Number.isFinite(id) ? id : null
}

async function resolveAllowedSectionIds(
  query: SalaryReviewExportQuery,
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

function toExportRow(
  row: {
    appyear: number | null
    matric: string | null
    names: string | null
    tbl_section_id: number | null
    designation: string | null
    dateeng: Date | null
    lengthservice: string | null
    date_lpro: Date | null
    date_lmer: Date | null
    date_lstat: Date | null
    precat: string | null
    procat: string | null
    presalary: number | null
    prosalary: number | null
    finincmonth: number | null
    finincyear: number | null
    award: string | null
  },
  sectionId: number | null,
): SalaryReviewExportRow {
  return {
    appyear: row.appyear,
    matric: row.matric,
    names: row.names,
    tbl_section_id: sectionId,
    designation: row.designation,
    dateeng: toDateOnly(row.dateeng),
    lengthservice: row.lengthservice,
    date_lpro: toDateOnly(row.date_lpro),
    date_lmer: toDateOnly(row.date_lmer),
    date_lstat: toDateOnly(row.date_lstat),
    precat: row.precat,
    procat: row.procat,
    presalary: row.presalary,
    prosalary: row.prosalary,
    finincmonth: row.finincmonth,
    finincyear: row.finincyear,
    award: row.award,
  }
}

export async function listSalaryReviewYears(
  scopeSectionIds: number[] | null,
): Promise<number[]> {
  const rows = await prisma.tbl_salaryreview.findMany({
    where: scopeSectionIds
      ? { tbl_section_id: { in: scopeSectionIds } }
      : undefined,
    distinct: ['appyear'],
    select: { appyear: true },
    orderBy: { appyear: 'desc' },
  })
  return rows
    .map((row) => row.appyear)
    .filter((year): year is number => year != null)
}

export async function exportSalaryReview(
  query: SalaryReviewExportQuery,
  scopeSectionIds: number[] | null = null,
): Promise<SalaryReviewExportResponse> {
  const appyear = query.appyear
  const allowedSections = await resolveAllowedSectionIds(
    query,
    scopeSectionIds,
  )
  if (allowedSections && allowedSections.length === 0) {
    return { appyear, unitName: null, sections: [] }
  }

  const [rows, selectedUnit] = await Promise.all([
    prisma.tbl_salaryreview.findMany({
      where: {
        appyear,
        ...(allowedSections
          ? { tbl_section_id: { in: allowedSections } }
          : {}),
      },
      orderBy: [{ tbl_section_id: 'asc' }, { matric: 'asc' }],
    }),
    query.unitId
      ? prisma.tbl_unit.findUnique({
          where: { id: query.unitId },
          select: { unit_name: true },
        })
      : Promise.resolve(null),
  ])

  const unitName = selectedUnit?.unit_name ?? null
  const includeEmptySections = Boolean(query.unitId) && query.sectionId == null

  type Bucket = {
    sectionId: number | null
    sectionName: string
    unitId: string | null
    unitName: string | null
    rows: SalaryReviewExportRow[]
  }
  const buckets = new Map<string, Bucket>()

  function ensureBucket(
    sectionId: number | null,
    sectionName: string,
    unitId: string | null,
    unitLabel: string | null,
  ): Bucket {
    const key = sectionId != null ? String(sectionId) : '__none__'
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        sectionId,
        sectionName,
        unitId,
        unitName: unitLabel,
        rows: [],
      }
      buckets.set(key, bucket)
    }
    return bucket
  }

  if (includeEmptySections && allowedSections) {
    const sections = await prisma.tbl_section.findMany({
      where: { id: { in: allowedSections } },
      orderBy: { section: 'asc' },
    })
    const unitIds = [
      ...new Set(
        sections
          .map((section) => section.tbl_unit_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const units = unitIds.length
      ? await prisma.tbl_unit.findMany({ where: { id: { in: unitIds } } })
      : []
    const unitById = new Map(units.map((unit) => [unit.id, unit.unit_name]))
    for (const section of sections) {
      ensureBucket(
        section.id,
        section.section ?? `Section #${section.id}`,
        section.tbl_unit_id,
        section.tbl_unit_id
          ? (unitById.get(section.tbl_unit_id) ?? null)
          : unitName,
      )
    }
  }

  const rowSectionIds = [
    ...new Set(
      rows
        .map((row) => sectionPk(row.tbl_section_id))
        .filter((id): id is number => id != null),
    ),
  ]
  const missingIds = rowSectionIds.filter(
    (id) => !buckets.has(String(id)),
  )
  const extraSections = missingIds.length
    ? await prisma.tbl_section.findMany({ where: { id: { in: missingIds } } })
    : []
  const sectionById = new Map(
    extraSections.map((section) => [section.id, section]),
  )
  const extraUnitIds = [
    ...new Set(
      extraSections
        .map((section) => section.tbl_unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const extraUnits = extraUnitIds.length
    ? await prisma.tbl_unit.findMany({ where: { id: { in: extraUnitIds } } })
    : []
  const extraUnitById = new Map(
    extraUnits.map((unit) => [unit.id, unit.unit_name]),
  )

  for (const row of rows) {
    const sectionId = sectionPk(row.tbl_section_id)
    const key = sectionId != null ? String(sectionId) : '__none__'
    let bucket = buckets.get(key)
    if (!bucket) {
      const section = sectionId != null ? sectionById.get(sectionId) : null
      const unitId = section?.tbl_unit_id ?? null
      bucket = ensureBucket(
        sectionId,
        section?.section ?? (sectionId != null ? `Section #${sectionId}` : 'Unassigned'),
        unitId,
        unitId ? (extraUnitById.get(unitId) ?? null) : unitName,
      )
    }
    bucket.rows.push(toExportRow(row, sectionId))
  }

  const sections: SalaryReviewExportSection[] = [...buckets.values()].sort(
    (a, b) => {
      if (a.sectionId == null) return 1
      if (b.sectionId == null) return -1
      return a.sectionName.localeCompare(b.sectionName)
    },
  )

  return { appyear, unitName, sections }
}
