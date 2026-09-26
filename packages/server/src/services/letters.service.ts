import type {
  AppraisalLetter,
  AppraisalLettersResponse,
  AppraisalListQuery,
  SkippedAppraisalLetter,
} from '@perf-appraisal-app/shared'
import {
  awardIncludesFinanceCc,
  fillTemplate,
  formatMemoDate,
  normalizeAwardKey,
  parseCatEchelon,
  templateForAward,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import { resolveDecisionSignatory } from './decision.service.js'
import { resolveLetterCcLabels } from './letter-cc.service.js'
import { resolveSectionThroTitle } from './section-thro.service.js'

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

function sectionPk(raw: number | null | undefined): number | null {
  if (raw == null) return null
  const id = Math.trunc(raw)
  return Number.isFinite(id) ? id : null
}

function numericCategory(preCat: string, proCat: string): number | null {
  const raw = preCat.trim() || proCat.trim()
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) ? parsed : null
}

export async function buildAppraisalLetters(
  query: AppraisalListQuery,
  scopeSectionIds: number[] | null = null,
): Promise<AppraisalLettersResponse> {
  const appyear = query.appyear ?? null
  if (appyear == null) {
    return { letters: [], skipped: [] }
  }

  const allowedSections = await resolveAllowedSectionIds(
    query,
    scopeSectionIds,
  )
  if (allowedSections && allowedSections.length === 0) {
    return { letters: [], skipped: [] }
  }

  const requestedMatric = query.matric?.trim() || null
  const rows = await prisma.tbl_salaryreview.findMany({
    where: {
      appyear,
      ...(requestedMatric ? { matric: requestedMatric } : {}),
      ...(allowedSections
        ? { tbl_section_id: { in: allowedSections } }
        : {}),
    },
    orderBy: [{ matric: 'asc' }, { id: 'asc' }],
  })

  const sectionIds = [
    ...new Set(
      rows
        .map((r) => sectionPk(r.tbl_section_id))
        .filter((id): id is number => id != null),
    ),
  ]
  const sections = sectionIds.length
    ? await prisma.tbl_section.findMany({
        where: { id: { in: sectionIds } },
      })
    : []
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

  const memoDate = formatMemoDate()
  const asOf = new Date()
  const ccByUnit = new Map<string, string[]>()
  const signatoryByKey = new Map<
    string,
    { name: string | null; title: string | null } | null
  >()
  const throBySection = new Map<number, string>()
  const letters: AppraisalLetter[] = []
  const skipped: SkippedAppraisalLetter[] = []

  async function ccForUnit(
    unitId: string | null,
    award: string | null,
  ): Promise<string[]> {
    const key = `${unitId ?? ''}|${awardIncludesFinanceCc(award) ? '1' : '0'}`
    const cached = ccByUnit.get(key)
    if (cached) return cached
    const labels = await resolveLetterCcLabels(unitId, award)
    ccByUnit.set(key, labels)
    return labels
  }

  async function signatoryFor(
    category: number | null,
    unitId: string | null,
    groupId: string | null,
  ) {
    const key = `${category ?? ''}|${unitId ?? ''}|${groupId ?? ''}`
    if (signatoryByKey.has(key)) return signatoryByKey.get(key) ?? null
    const signatory = await resolveDecisionSignatory({
      category,
      unitId,
      groupId,
      asOf,
    })
    signatoryByKey.set(key, signatory)
    return signatory
  }

  async function throFor(sectionId: number | null): Promise<string> {
    if (sectionId == null) return resolveSectionThroTitle({ sectionId, asOf })
    const cached = throBySection.get(sectionId)
    if (cached) return cached
    const title = await resolveSectionThroTitle({ sectionId, asOf })
    throBySection.set(sectionId, title)
    return title
  }

  for (const row of rows) {
    const matric = row.matric
    const names = row.names ?? null
    const award = row.award ?? null
    const key = normalizeAwardKey(award)

    if (!matric) {
      skipped.push({
        salaryReviewId: row.id,
        matric,
        names,
        award,
        reason: 'Missing matric',
      })
      continue
    }

    if (key === 'not due') {
      skipped.push({
        salaryReviewId: row.id,
        matric,
        names,
        award,
        reason: 'Not Due — no letter',
      })
      continue
    }

    const template = templateForAward(award)
    if (!template) {
      skipped.push({
        salaryReviewId: row.id,
        matric,
        names,
        award,
        reason: award ? `No template for award "${award}"` : 'No award set',
      })
      continue
    }

    const sectionId = sectionPk(row.tbl_section_id)
    const section = sectionId != null ? (sectionById.get(sectionId) ?? null) : null
    const unitId = section?.tbl_unit_id ?? null
    const unit = unitId ? (unitById.get(unitId) ?? null) : null
    const unitName = unit?.unit_name ?? null
    const groupId = unit?.groupid ?? null
    const designation = row.designation ?? null
    const sectionName = section?.section ?? null

    const pre = parseCatEchelon(row.precat)
    const pro = parseCatEchelon(row.procat)
    const effectiveYear = String(appyear + 1)
    const signatory = await signatoryFor(
      numericCategory(pre.category, pro.category),
      unitId,
      groupId,
    )
    const throTitle = await throFor(sectionId)

    const vars = {
      names: names ?? matric,
      matric,
      appyear: String(appyear),
      effectiveYear,
      award: award ?? '',
      preCat: pre.category,
      preEch: pre.echelon,
      proCat: pro.category,
      proEch: pro.echelon,
      designation: designation ?? '',
      section: sectionName ?? '',
      unitName: unitName ?? '',
    }

    const designationParts = [designation, sectionName].filter(Boolean)
    const fromTitle = (signatory?.title ?? 'ESTATE MANAGER').toUpperCase()

    letters.push({
      salaryReviewId: row.id,
      appyear,
      matric,
      names,
      award,
      subject: template.subject,
      paragraphs: template.paragraphs.map((p) => fillTemplate(p, vars)),
      fromTitle,
      unitName,
      designationLine: designationParts.join(' - '),
      signatoryName: signatory?.name ?? null,
      signatoryTitle: signatory?.title ?? fromTitle,
      throTitle,
      memoDate,
      cc: [...(await ccForUnit(unitId, award))],
    })
  }

  return { letters, skipped }
}
