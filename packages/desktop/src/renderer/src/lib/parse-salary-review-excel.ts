import type { SalaryReviewImportRow } from '@perf-appraisal-app/shared'
import * as XLSX from 'xlsx'

export type ParsedSalaryReviewExcel = {
  rows: SalaryReviewImportRow[]
  years: number[]
  errors: { row: number; message: string }[]
}

const FIELD_ALIASES: Record<string, keyof SalaryReviewImportRow> = {
  appyear: 'appyear',
  app_year: 'appyear',
  matric: 'matric',
  names: 'names',
  tbl_section_id: 'tbl_section_id',
  section_id: 'tbl_section_id',
  designation: 'designation',
  dateeng: 'dateeng',
  date_eng: 'dateeng',
  lengthservice: 'lengthservice',
  length_service: 'lengthservice',
  date_lpro: 'date_lpro',
  date_lmer: 'date_lmer',
  date_lmerit: 'date_lmer',
  date_lstat: 'date_lstat',
  precat: 'precat',
  pre_cat: 'precat',
  procat: 'procat',
  pro_cat: 'procat',
  presalary: 'presalary',
  pre_salary: 'presalary',
  prosalary: 'prosalary',
  pro_salary: 'prosalary',
  finincmonth: 'finincmonth',
  fin_inc_month: 'finincmonth',
  finincyear: 'finincyear',
  fin_inc_year: 'finincyear',
  award: 'award',
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-]+/g, '_')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
}

function excelSerialToDate(serial: number): Date {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400 * 1000)
  return new Date(utc)
}

function parseDateCell(value: unknown): string | null | 'invalid' {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'invalid'
    return toIsoDate(value)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 1) return 'invalid'
    return toIsoDate(excelSerialToDate(value))
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (iso) {
      const y = Number(iso[1])
      const m = Number(iso[2])
      const d = Number(iso[3])
      const date = new Date(y, m - 1, d)
      if (date.getFullYear() !== y || date.getMonth() !== m - 1) return 'invalid'
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (dmy) {
      const day = Number(dmy[1])
      const month = Number(dmy[2])
      let year = Number(dmy[3])
      if (year < 100) year += year >= 70 ? 1900 : 2000
      const date = new Date(year, month - 1, day)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return 'invalid'
      }
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }
  return 'invalid'
}

function parseIntCell(value: unknown): number | null | 'invalid' {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const text = value.trim().replace(/,/g, '')
    if (!text) return null
    const n = Number(text)
    if (!Number.isFinite(n)) return 'invalid'
    return Math.trunc(n)
  }
  return 'invalid'
}

function parseStringCell(value: unknown, maxLen: number): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, maxLen)
}

export async function parseSalaryReviewExcel(
  file: File,
): Promise<ParsedSalaryReviewExcel> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], years: [], errors: [{ row: 0, message: 'Workbook has no sheets' }] }
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return { rows: [], years: [], errors: [{ row: 0, message: 'First sheet is empty' }] }
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  })

  const rows: SalaryReviewImportRow[] = []
  const errors: { row: number; message: string }[] = []
  const years = new Set<number>()

  rawRows.forEach((raw, index) => {
    const excelRow = index + 2
    const mapped: Partial<Record<keyof SalaryReviewImportRow, unknown>> = {}
    for (const [header, value] of Object.entries(raw)) {
      const field = FIELD_ALIASES[normalizeHeader(header)]
      if (!field) continue
      mapped[field] = value
    }

    const appyear = parseIntCell(mapped.appyear)
    const matric = parseStringCell(mapped.matric, 6)
    if (appyear === 'invalid' || appyear == null) {
      errors.push({ row: excelRow, message: 'Missing or invalid appyear' })
      return
    }
    if (!matric) {
      errors.push({ row: excelRow, message: 'Missing matric' })
      return
    }

    const row: SalaryReviewImportRow = {
      appyear,
      matric,
    }

    const names = parseStringCell(mapped.names, 255)
    if (names) row.names = names
    const designation = parseStringCell(mapped.designation, 255)
    if (designation) row.designation = designation
    const lengthservice = parseStringCell(mapped.lengthservice, 255)
    if (lengthservice) row.lengthservice = lengthservice
    const precat = parseStringCell(mapped.precat, 255)
    if (precat) row.precat = precat
    const procat = parseStringCell(mapped.procat, 255)
    if (procat) row.procat = procat
    const award = parseStringCell(mapped.award, 255)
    if (award) row.award = award

    const sectionId = parseIntCell(mapped.tbl_section_id)
    if (sectionId === 'invalid') {
      errors.push({ row: excelRow, message: 'Invalid tbl_section_id' })
      return
    }
    if (sectionId != null) row.tbl_section_id = sectionId

    for (const field of [
      'presalary',
      'prosalary',
      'finincmonth',
      'finincyear',
    ] as const) {
      const parsed = parseIntCell(mapped[field])
      if (parsed === 'invalid') {
        errors.push({ row: excelRow, message: `Invalid ${field}` })
        return
      }
      if (parsed != null) row[field] = parsed
    }

    for (const field of [
      'dateeng',
      'date_lpro',
      'date_lmer',
      'date_lstat',
    ] as const) {
      const parsed = parseDateCell(mapped[field])
      if (parsed === 'invalid') {
        errors.push({
          row: excelRow,
          message: `Invalid ${field}`,
        })
        return
      }
      if (parsed) row[field] = parsed
    }

    rows.push(row)
    years.add(appyear)
  })

  return {
    rows,
    years: [...years].sort((a, b) => a - b),
    errors,
  }
}
