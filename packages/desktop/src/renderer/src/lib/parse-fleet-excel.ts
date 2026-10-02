import type {
  FleetImportDetail,
  FleetImportRegistration,
  FleetImportResult,
} from '@personel-management-app/shared'
import * as XLSX from 'xlsx'

export type FleetImportSheet = FleetImportResult['errors'][number]['sheet']

export type FleetImportParseError = {
  sheet: FleetImportSheet
  row: number
  message: string
}

export type ParsedFleetExcel = {
  registrations: FleetImportRegistration[]
  details: FleetImportDetail[]
  errors: FleetImportParseError[]
}

const REGISTRATION_ALIASES: Record<string, keyof FleetImportRegistration> = {
  id: 'id',
  matricule: 'matricule',
  operator_id: 'operatorId',
  operatorid: 'operatorId',
  allowanceid: 'allowanceId',
  allowance_id: 'allowanceId',
  accountno: 'accountNo',
  account_no: 'accountNo',
  phonenumber: 'phoneNumber',
  phone_number: 'phoneNumber',
  phone: 'phoneNumber',
  effectivedate: 'effectiveDate',
  effective_date: 'effectiveDate',
  enddate: 'endDate',
  end_date: 'endDate',
  replacedbyid: 'replacedById',
  replaced_by_id: 'replacedById',
  isactive: 'isActive',
  is_active: 'isActive',
  includedinbatch: 'includedInBatch',
  included_in_batch: 'includedInBatch',
  createdat: 'createdAt',
  created_at: 'createdAt',
  updatedat: 'updatedAt',
  updated_at: 'updatedAt',
}

const DETAIL_ALIASES: Record<string, keyof FleetImportDetail> = {
  id: 'id',
  fleetregistrationid: 'fleetRegistrationId',
  fleet_registration_id: 'fleetRegistrationId',
  serviceid: 'serviceId',
  service_id: 'serviceId',
  amount: 'amount',
  effectivedate: 'effectiveDate',
  effective_date: 'effectiveDate',
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-]+/g, '_')
}

function normalizeSheet(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-]+/g, '_')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(value: Date): string | 'invalid' {
  if (Number.isNaN(value.getTime()) || value.getFullYear() < 1) return 'invalid'
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
}

function excelSerialToDate(serial: number): Date {
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400 * 1000)
  return new Date(utc)
}

function parseDateCell(value: unknown): string | null | 'invalid' {
  if (value == null || value === '') return null
  if (typeof value === 'string' && value.trim().startsWith('0000')) return 'invalid'
  if (value instanceof Date) return toIsoDate(value)
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
      if (y < 1) return 'invalid'
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
      if (year < 1) return 'invalid'
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
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const text = value.trim().replace(/,/g, '')
    if (!text) return null
    const n = Number(text)
    if (!Number.isFinite(n)) return 'invalid'
    return Math.trunc(n)
  }
  return 'invalid'
}

function parseAmountCell(value: unknown): number | null | 'invalid' {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const text = value.trim().replace(/,/g, '')
    if (!text) return null
    const n = Number(text)
    if (!Number.isFinite(n)) return 'invalid'
    return n
  }
  return 'invalid'
}

function parseStringCell(value: unknown, maxLen: number): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, maxLen)
}

function parseBoolCell(value: unknown): boolean | null | 'invalid' {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
    return 'invalid'
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (!text) return null
    if (['true', 'yes', 'y', '1'].includes(text)) return true
    if (['false', 'no', 'n', '0'].includes(text)) return false
  }
  return 'invalid'
}

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheetName = workbook.SheetNames.find(
    (item) => normalizeSheet(item) === name,
  )
  if (!sheetName) return null
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return null
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  })
}

function mapRow(
  raw: Record<string, unknown>,
  aliases: Record<string, string>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [header, value] of Object.entries(raw)) {
    const field = aliases[normalizeHeader(header)]
    if (!field) continue
    mapped[field] = value
  }
  return mapped
}

export async function parseFleetExcel(file: File): Promise<ParsedFleetExcel> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const errors: FleetImportParseError[] = []
  const registrationRows = sheetRows(workbook, 'fleet_registration')
  const detailRows = sheetRows(workbook, 'fleet_reg_details')

  if (!registrationRows) {
    errors.push({
      sheet: 'fleet_registration',
      row: 0,
      message: 'Sheet fleet_registration was not found',
    })
  }
  if (!detailRows) {
    errors.push({
      sheet: 'fleet_reg_details',
      row: 0,
      message: 'Sheet fleet_reg_details was not found',
    })
  }

  const registrations: FleetImportRegistration[] = []
  ;(registrationRows ?? []).forEach((raw, index) => {
    const excelRow = index + 2
    const mapped = mapRow(raw, REGISTRATION_ALIASES)
    const id = parseIntCell(mapped.id)
    const operatorId = parseIntCell(mapped.operatorId)
    const matricule = parseStringCell(mapped.matricule, 191)
    const allowanceId = parseStringCell(mapped.allowanceId, 191)
    const phoneNumber = parseStringCell(mapped.phoneNumber, 191)
    const effectiveDate = parseDateCell(mapped.effectiveDate)

    if (id === 'invalid' || id == null || id < 1) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing or invalid id',
      })
      return
    }
    if (!matricule) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing matricule',
      })
      return
    }
    if (operatorId === 'invalid' || operatorId == null || operatorId < 1) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing or invalid operator_id',
      })
      return
    }
    if (!allowanceId) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing allowanceId',
      })
      return
    }
    if (!phoneNumber) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing phoneNumber',
      })
      return
    }
    if (effectiveDate === 'invalid' || !effectiveDate) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Missing or invalid effectiveDate',
      })
      return
    }

    const row: FleetImportRegistration = {
      row: excelRow,
      id,
      matricule,
      operatorId,
      allowanceId,
      phoneNumber,
      effectiveDate,
    }

    const accountNo = parseStringCell(mapped.accountNo, 191)
    row.accountNo = accountNo

    const endDate = parseDateCell(mapped.endDate)
    if (endDate === 'invalid') {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Invalid endDate',
      })
      return
    }
    if (endDate) row.endDate = endDate

    const replacedById = parseIntCell(mapped.replacedById)
    if (replacedById === 'invalid' || (replacedById != null && replacedById < 1)) {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Invalid replacedById',
      })
      return
    }
    if (replacedById != null) row.replacedById = replacedById

    const isActive = parseBoolCell(mapped.isActive)
    if (isActive === 'invalid') {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Invalid isActive',
      })
      return
    }
    if (isActive != null) row.isActive = isActive

    const includedInBatch = parseBoolCell(mapped.includedInBatch)
    if (includedInBatch === 'invalid') {
      errors.push({
        sheet: 'fleet_registration',
        row: excelRow,
        message: 'Invalid includedInBatch',
      })
      return
    }
    if (includedInBatch != null) row.includedInBatch = includedInBatch

    for (const field of ['createdAt', 'updatedAt'] as const) {
      const parsed = parseDateCell(mapped[field])
      if (parsed === 'invalid') {
        errors.push({
          sheet: 'fleet_registration',
          row: excelRow,
          message: `Invalid ${field}`,
        })
        return
      }
      if (parsed) row[field] = parsed
    }

    registrations.push(row)
  })

  const details: FleetImportDetail[] = []
  ;(detailRows ?? []).forEach((raw, index) => {
    const excelRow = index + 2
    const mapped = mapRow(raw, DETAIL_ALIASES)
    const fleetRegistrationId = parseIntCell(mapped.fleetRegistrationId)
    const serviceId = parseIntCell(mapped.serviceId)
    const amount = parseAmountCell(mapped.amount)
    const effectiveDate = parseDateCell(mapped.effectiveDate)
    const id = parseIntCell(mapped.id)

    if (id === 'invalid' || (id != null && id < 1)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: excelRow,
        message: 'Invalid id',
      })
      return
    }
    if (
      fleetRegistrationId === 'invalid' ||
      fleetRegistrationId == null ||
      fleetRegistrationId < 1
    ) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: excelRow,
        message: 'Missing or invalid fleetRegistrationId',
      })
      return
    }
    if (serviceId === 'invalid' || serviceId == null || serviceId < 1) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: excelRow,
        message: 'Missing or invalid serviceId',
      })
      return
    }
    if (amount === 'invalid' || amount == null || amount < 0) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: excelRow,
        message: 'Missing or invalid amount',
      })
      return
    }
    if (effectiveDate === 'invalid' || !effectiveDate) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: excelRow,
        message: 'Missing or invalid effectiveDate',
      })
      return
    }

    const row: FleetImportDetail = {
      row: excelRow,
      fleetRegistrationId,
      serviceId,
      amount,
      effectiveDate,
    }
    if (id != null) row.id = id
    details.push(row)
  })

  return { registrations, details, errors }
}
