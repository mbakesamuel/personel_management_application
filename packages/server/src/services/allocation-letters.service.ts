import type {
  AllocationLetter,
  AllocationLetterListQuery,
  AllocationLetterRow,
  AllocationLettersResponse,
} from '@personel-management-app/shared'
import { formatMemoDate } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { resolveLetterCcLabels } from './letter-cc.service.js'
import {
  resolveLiveEmployee,
  resolveLiveEmployees,
  unitCodesMatch,
} from './live-employee.service.js'
import { resolveSectionThroTitle } from './section-thro.service.js'

const FROM_TITLE = 'General Manager'
const LETTER_REFS = ['GM/FIN/9', 'MC/FIN/19'] as const
const CLOSING_LINE =
  'The Financial Director will pay you the amounts accordingly.'
const CONDITIONS = [
  'The monthly allowances are tied to the post and not to the individual, therefore they shall be paid to you depending on the position you hold at any given time.',
  'Your allocation into PCUS shall be suspended if and when your are provided an allocated/pool car/motorcycle and shall be paid subject to certification of effective use of the car for the corporation business during the month or part thereof by your Head of Department/service.',
  'The award and payment of the Production/Performance Allowance shall be done strictly as per GMs circular GM/ST/2 of 27th February, 2015.',
] as const

function isPcusAllowance(name: string): boolean {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (
    normalized.includes('PCUS') ||
    normalized.includes('PERSONNELCAR') ||
    normalized.includes('PERSONELCAR')
  )
}

function toDateOnlyLabel(value: Date): string {
  return formatMemoDate(value)
}

async function resolveGmSignatory(asOf: Date): Promise<{
  name: string | null
  title: string | null
}> {
  const assignment = await prisma.tbl_decision_assignment.findFirst({
    where: {
      level_code: 'GM',
      effdate: { lte: asOf },
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  if (!assignment) {
    return { name: null, title: 'GENERAL MANAGER' }
  }
  return {
    name: assignment.signatory?.trim() || null,
    title: (assignment.title?.trim() || 'GENERAL MANAGER').toUpperCase(),
  }
}

async function resolveThroTitle(input: {
  sectionId: number | null
  unitName: string | null
  asOf: Date
}): Promise<string> {
  if (input.sectionId != null) {
    const title = await resolveSectionThroTitle({
      sectionId: input.sectionId,
      asOf: input.asOf,
    })
    if (title && title !== 'HEAD OF SECTION') return title
  }
  const unit = input.unitName?.trim()
  if (unit) return `EM, ${unit}`.toUpperCase()
  return 'EM'
}

async function unitIdsForScope(
  scopeSectionIds: number[] | null,
): Promise<string[] | null> {
  if (scopeSectionIds === null) return null
  if (scopeSectionIds.length === 0) return []
  const sections = await prisma.tbl_section.findMany({
    where: { id: { in: scopeSectionIds } },
    select: { tbl_unit_id: true },
  })
  return [
    ...new Set(
      sections
        .map((s) => s.tbl_unit_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ]
}

export async function buildAllocationLetters(
  query: AllocationLetterListQuery,
  scopeSectionIds: number[] | null = null,
): Promise<AllocationLettersResponse> {
  const asOf = new Date()
  const memoDate = formatMemoDate(asOf)
  const requestedMatric = query.matric?.trim() || null

  const scopeUnitIds = await unitIdsForScope(scopeSectionIds)
  if (scopeUnitIds && scopeUnitIds.length === 0) {
    return { letters: [] }
  }

  let filterUnitId = query.unitId?.trim() || null
  let filterSectionId = query.sectionId ?? null

  if (filterSectionId != null) {
    const section = await prisma.tbl_section.findUnique({
      where: { id: filterSectionId },
      select: { id: true, tbl_unit_id: true },
    })
    if (!section) return { letters: [] }
    if (
      scopeSectionIds &&
      !scopeSectionIds.includes(filterSectionId)
    ) {
      return { letters: [] }
    }
    filterUnitId = section.tbl_unit_id?.trim() || filterUnitId
  }

  if (filterUnitId && scopeUnitIds) {
    const allowed = scopeUnitIds.some((id) => unitCodesMatch(id, filterUnitId!))
    if (!allowed) return { letters: [] }
  }

  const allocations = await prisma.tbl_allowance_allocation.findMany({
    where: {
      current: true,
      workflowStatus: 'VALIDATED',
      ...(requestedMatric ? { matricule: requestedMatric } : {}),
    },
    include: {
      allowance: { select: { id: true, allowanceName: true } },
      employee: { select: { name: true, firstname: true } },
    },
    orderBy: [{ matricule: 'asc' }, { effectiveDate: 'asc' }, { id: 'asc' }],
  })

  if (allocations.length === 0) {
    return { letters: [] }
  }

  const matricules = [...new Set(allocations.map((row) => row.matricule))]
  const liveByMatric = await resolveLiveEmployees(matricules)
  const gm = await resolveGmSignatory(asOf)

  const byMatric = new Map<string, typeof allocations>()
  for (const row of allocations) {
    const live = liveByMatric.get(row.matricule) ?? null
    if (!live) continue
    const codeUnit = live.codeUnit

    if (filterUnitId) {
      if (!codeUnit || !unitCodesMatch(codeUnit, filterUnitId)) continue
    } else if (scopeUnitIds) {
      if (
        !codeUnit ||
        !scopeUnitIds.some((id) => unitCodesMatch(id, codeUnit))
      ) {
        continue
      }
    }

    const bucket = byMatric.get(row.matricule) ?? []
    bucket.push(row)
    byMatric.set(row.matricule, bucket)
  }

  const letters: AllocationLetter[] = []

  for (const [matricule, rows] of byMatric) {
    const live =
      liveByMatric.get(matricule) ?? (await resolveLiveEmployee(matricule))
    const names =
      live?.names?.trim() ||
      [rows[0]?.employee.name, rows[0]?.employee.firstname]
        .filter((part) => part && part.trim())
        .join(' ')
        .trim() ||
      null
    const designation = live?.designation?.trim() || null
    const designationLine = designation ? `(${designation})` : '(—)'
    const positionTitle = designation || 'your current position'
    const unitId = live?.codeUnit ?? null
    const unitName = live?.unitName ?? null

    const throTitle = await resolveThroTitle({
      sectionId: filterSectionId,
      unitName,
      asOf,
    })

    const tableRows: AllocationLetterRow[] = rows.map((row) => {
      const allowanceName = row.allowance.allowanceName.trim()
      return {
        allowanceId: row.allowanceId,
        allowanceName,
        monthlyAmount: row.allowanceAmt,
        areaToCover: isPcusAllowance(allowanceName) ? 'Area of Operation' : '',
      }
    })

    const allowanceNames = tableRows.map((row) =>
      row.allowanceName.toUpperCase(),
    )
    const subject = `ADMISSION INTO ${allowanceNames.join(' AND ')}`

    const earliest = rows.reduce((min, row) =>
      row.effectiveDate < min.effectiveDate ? row : min,
    )
    const effectiveDateLabel = toDateOnlyLabel(earliest.effectiveDate)

    const openingParagraph = `By virtue of your position as ${positionTitle}, I am pleased to inform you that you have been admitted into the under-mentioned Allowance Schemes with effect from ${effectiveDateLabel} as follows:`

    const cc = await resolveLetterCcLabels(unitId)

    letters.push({
      matricule,
      names,
      designationLine,
      positionTitle,
      unitId,
      unitName,
      fromTitle: FROM_TITLE,
      refs: [...LETTER_REFS],
      throTitle,
      memoDate,
      effectiveDateLabel,
      subject,
      openingParagraph,
      rows: tableRows,
      conditions: [...CONDITIONS],
      closingLine: CLOSING_LINE,
      signatoryName: gm.name,
      signatoryTitle: gm.title,
      cc,
    })
  }

  letters.sort((a, b) => a.matricule.localeCompare(b.matricule))
  return { letters }
}
