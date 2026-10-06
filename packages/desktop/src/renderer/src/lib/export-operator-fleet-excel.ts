import type { CommunicationMemoDraftRow } from '@personel-management-app/shared'
import * as XLSX from 'xlsx'
import { REPORT_COMPANY_NAME } from '../components/ReportHeader'

const ADDITION_HEADERS = [
  'CLIENT NAME',
  'Account Number',
  'User Name',
  'Telephone',
  'IMSI',
  'PACKAGE',
  'DATA',
  'CLI',
] as const

const REMOVAL_HEADERS = ['Nom', 'Numero', 'Action', "DATE DE PRISE D'EFFET"] as const

const MODIFICATION_HEADERS = [
  'Account',
  'CLIENT',
  'NOM',
  'TELEPHONE',
  'PACKAGE ACTUEL',
  'NEW DATA PACKAGE',
  'PACKAGE CHANGE',
  'TO APPLY',
] as const

const CURRENT_MTN_PACKAGE = 'MTN ELIT CORPORATE PACKAGE'
const REMOVAL_ACTION = 'PREPAYE'

export type OperatorFleetAdditionRow = {
  clientName: string
  accountNumber: string
  userName: string
  telephone: string
  imsi: string
  packageName: string
  data: number
  cli: number
}

export type OperatorFleetRemovalRow = {
  nom: string
  numero: string
  action: string
  effectDate: string
}

export type OperatorFleetModificationRow = {
  account: string
  client: string
  nom: string
  telephone: string
  currentPackage: string
  newDataPackage: string
  packageChange: string
  toApply: string
}

export type OperatorFleetSheets = {
  additions: OperatorFleetAdditionRow[]
  modifications: OperatorFleetModificationRow[]
  removals: OperatorFleetRemovalRow[]
}

function isMtnOperator(name: string) {
  return name.toLowerCase().includes('mtn')
}

function isGmOperator(name: string) {
  return name.toLowerCase().includes('gm')
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function mtnFlexi(amount: number) {
  return `MTN BIZ FLEXI ${formatAmount(amount)}`
}

function accountOf(operatorName: string, accountNo: string | null) {
  if (isGmOperator(operatorName)) return ''
  return accountNo?.trim() ?? ''
}

export function displayDate(iso: string | null): string {
  if (!iso) return ''
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

export function firstOfNextMonth(from = new Date()): string {
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  const day = String(next.getDate()).padStart(2, '0')
  const month = String(next.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${next.getFullYear()}`
}

function fileSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function operatorFleetExcelName(operatorName: string): string {
  const slug = fileSlug(operatorName)
  return slug ? `fleet-export-${slug}.xlsx` : 'fleet-export.xlsx'
}

export function operatorFleetSheets(
  operatorName: string,
  rows: CommunicationMemoDraftRow[],
  from = new Date(),
): OperatorFleetSheets {
  const mtn = isMtnOperator(operatorName)
  const toApply = firstOfNextMonth(from)
  const additions: OperatorFleetAdditionRow[] = []
  const modifications: OperatorFleetModificationRow[] = []
  const removals: OperatorFleetRemovalRow[] = []
  for (const row of rows) {
    if (row.action === 'CREATION') {
      additions.push({
        clientName: REPORT_COMPANY_NAME,
        accountNumber: accountOf(operatorName, row.accountNo),
        userName: row.employeeName,
        telephone: row.phoneNumber,
        imsi: '',
        packageName: mtn ? mtnFlexi(row.airtime) : '',
        data: row.data,
        cli: row.airtime,
      })
    } else if (row.action === 'REMOVAL') {
      removals.push({
        nom: row.employeeName,
        numero: row.phoneNumber,
        action: REMOVAL_ACTION,
        effectDate: displayDate(row.endDate),
      })
    } else {
      modifications.push({
        account: accountOf(operatorName, row.accountNo),
        client: REPORT_COMPANY_NAME,
        nom: row.employeeName,
        telephone: row.phoneNumber,
        currentPackage: mtn ? CURRENT_MTN_PACKAGE : '',
        newDataPackage: '',
        packageChange: mtn ? mtnFlexi(row.airtime) : '',
        toApply,
      })
    }
  }
  return { additions, modifications, removals }
}

function writeWorkbook(workbook: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  if (out instanceof Uint8Array) return out
  if (out instanceof ArrayBuffer) return new Uint8Array(out)
  return new Uint8Array(out as ArrayLike<number>)
}

function sheetFrom(headers: readonly string[], rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows])
  sheet['!cols'] = headers.map((header, index) => {
    const widest = rows.reduce((width, row) => {
      const cell = row[index]
      const length = cell == null ? 0 : String(cell).length
      return Math.max(width, length)
    }, header.length)
    return { wch: Math.max(widest + 2, 14) }
  })
  return sheet
}

export function buildOperatorFleetExcel(sheets: OperatorFleetSheets): Uint8Array {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFrom(
      ADDITION_HEADERS,
      sheets.additions.map((row) => [
        row.clientName,
        row.accountNumber,
        row.userName,
        row.telephone,
        row.imsi,
        row.packageName,
        row.data,
        row.cli,
      ]),
    ),
    'Addition',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFrom(
      MODIFICATION_HEADERS,
      sheets.modifications.map((row) => [
        row.account,
        row.client,
        row.nom,
        row.telephone,
        row.currentPackage,
        row.newDataPackage,
        row.packageChange,
        row.toApply,
      ]),
    ),
    'Modification',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFrom(
      REMOVAL_HEADERS,
      sheets.removals.map((row) => [row.nom, row.numero, row.action, row.effectDate]),
    ),
    'Removal',
  )
  return writeWorkbook(workbook)
}
