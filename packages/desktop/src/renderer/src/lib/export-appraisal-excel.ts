import type { AppraisalListItem } from '@perf-appraisal-app/shared'
import * as XLSX from 'xlsx'
import { formatDisplayDate } from './format-date'

const HEADERS = [
  'Matric',
  'Names',
  'Date_LMerit',
  'Date_LStat',
  'Date_LPro',
  'Length',
  'Pre_Cat',
  'Pro_Cat',
  'Award',
] as const

const COL_WIDTHS = HEADERS.map((header) => ({
  wch: Math.max(header.length + 2, 14),
}))

export type AppraisalExcelSection = {
  sectionId: number | null
  sectionName: string
  items: AppraisalListItem[]
}

export type AppraisalExcelWorkbookInput = {
  unitName: string
  appyear: number
  sections: AppraisalExcelSection[]
}

export function appraisalExcelDefaultName(
  appyear: number | null,
  unitId?: string,
): string {
  if (appyear != null && unitId) return `appraisals-${appyear}-${unitId}.xlsx`
  if (appyear != null) return `appraisals-${appyear}.xlsx`
  return 'appraisals.xlsx'
}

function excelSheetName(
  name: string,
  used: Set<string>,
  sectionId: number | null,
): string {
  const cleaned =
    name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Section'
  let candidate = cleaned.slice(0, 31)
  if (used.has(candidate.toLowerCase()) && sectionId != null) {
    const suffix = ` (${sectionId})`
    candidate = `${cleaned.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`.slice(
      0,
      31,
    )
  }
  let unique = candidate
  let n = 2
  while (used.has(unique.toLowerCase())) {
    const suffix = ` (${n})`
    unique = `${candidate.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    n += 1
  }
  used.add(unique.toLowerCase())
  return unique
}

function itemRow(row: AppraisalListItem): string[] {
  return [
    row.matric ?? '',
    row.names ?? '',
    formatDisplayDate(row.dateLmerit),
    formatDisplayDate(row.dateLstat),
    formatDisplayDate(row.dateLpro),
    row.lengthservice ?? '',
    row.preCat ?? '',
    row.proCat ?? '',
    row.award ?? '',
  ]
}

function writeWorkbook(workbook: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  if (out instanceof Uint8Array) return out
  if (out instanceof ArrayBuffer) return new Uint8Array(out)
  return new Uint8Array(out as ArrayLike<number>)
}

export function buildAppraisalExcel(
  input: AppraisalExcelWorkbookInput,
): Uint8Array {
  const workbook = XLSX.utils.book_new()
  const used = new Set<string>()

  for (const section of input.sections) {
    const rows = [
      [input.unitName, `Year ${input.appyear}`],
      [`SECTION: ${section.sectionName}`],
      [...HEADERS],
      ...section.items.map(itemRow),
    ]
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      excelSheetName(section.sectionName, used, section.sectionId),
    )
  }

  if (workbook.SheetNames.length === 0) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [input.unitName, `Year ${input.appyear}`],
      [...HEADERS],
    ])
    sheet['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(workbook, sheet, 'Appraisals')
  }

  return writeWorkbook(workbook)
}
