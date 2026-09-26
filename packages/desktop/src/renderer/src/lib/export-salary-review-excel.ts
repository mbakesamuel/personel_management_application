import type {
  SalaryReviewExportResponse,
  SalaryReviewExportRow,
  SalaryReviewExportSection,
} from '@perf-appraisal-app/shared'
import * as XLSX from 'xlsx'
import { formatDisplayDate } from './format-date'

const HEADERS = [
  'appyear',
  'matric',
  'names',
  'tbl_section_id',
  'designation',
  'dateeng',
  'lengthservice',
  'date_lpro',
  'date_lmer',
  'date_lstat',
  'precat',
  'procat',
  'presalary',
  'prosalary',
  'finincmonth',
  'finincyear',
  'award',
] as const

const COL_WIDTHS = HEADERS.map((header) => ({
  wch: Math.max(header.length + 2, 14),
}))

export function salaryReviewExcelDefaultName(
  appyear: number,
  unitId?: string,
): string {
  return unitId
    ? `salary-review-${appyear}-${unitId}.xlsx`
    : `salary-review-${appyear}.xlsx`
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

function itemRow(row: SalaryReviewExportRow): (string | number)[] {
  return [
    row.appyear ?? '',
    row.matric ?? '',
    row.names ?? '',
    row.tbl_section_id ?? '',
    row.designation ?? '',
    formatDisplayDate(row.dateeng),
    row.lengthservice ?? '',
    formatDisplayDate(row.date_lpro),
    formatDisplayDate(row.date_lmer),
    formatDisplayDate(row.date_lstat),
    row.precat ?? '',
    row.procat ?? '',
    row.presalary ?? '',
    row.prosalary ?? '',
    row.finincmonth ?? '',
    row.finincyear ?? '',
    row.award ?? '',
  ]
}

function writeWorkbook(workbook: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  if (out instanceof Uint8Array) return out
  if (out instanceof ArrayBuffer) return new Uint8Array(out)
  return new Uint8Array(out as ArrayLike<number>)
}

function sectionTitle(section: SalaryReviewExportSection): string {
  if (section.unitName) return section.unitName
  return 'All units'
}

export function buildSalaryReviewExcel(
  data: SalaryReviewExportResponse,
): Uint8Array {
  const workbook = XLSX.utils.book_new()
  const used = new Set<string>()
  const fallbackUnit = data.unitName ?? 'All units'

  for (const section of data.sections) {
    const rows = [
      [sectionTitle(section) || fallbackUnit, `Year ${data.appyear}`],
      [`SECTION: ${section.sectionName}`],
      [...HEADERS],
      ...section.rows.map(itemRow),
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
      [fallbackUnit, `Year ${data.appyear}`],
      [...HEADERS],
    ])
    sheet['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(workbook, sheet, 'SalaryReview')
  }

  return writeWorkbook(workbook)
}
