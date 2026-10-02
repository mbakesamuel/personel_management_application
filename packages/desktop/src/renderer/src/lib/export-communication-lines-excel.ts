import type { CommunicationLine } from '@personel-management-app/shared'
import * as XLSX from 'xlsx'

const HEADERS = [
  'Matricule',
  'Name',
  'Position',
  'Phone',
  'Operator',
  'Amount',
  'Group/Service',
] as const

function formatAmount(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function communicationLineAmount(row: CommunicationLine): string {
  return `Airtime ${formatAmount(row.airtime)}, Data ${formatAmount(row.data)}`
}

export function communicationLinePlace(row: CommunicationLine): string {
  const parts = [row.groupName, row.unitName].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  return parts.join(' / ')
}

function fileSlug(value?: string): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ?? ''
  )
}

export function communicationLinesExcelName(
  operatorName?: string,
  place?: string,
): string {
  const parts = [fileSlug(operatorName), fileSlug(place)].filter(Boolean)
  return parts.length
    ? `communication-lines-${parts.join('-')}.xlsx`
    : 'communication-lines.xlsx'
}

function writeWorkbook(workbook: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  if (out instanceof Uint8Array) return out
  if (out instanceof ArrayBuffer) return new Uint8Array(out)
  return new Uint8Array(out as ArrayLike<number>)
}

export function buildCommunicationLinesExcel(rows: CommunicationLine[]): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    ...rows.map((row) => [
      row.matricule,
      row.employeeName,
      row.position ?? '',
      row.phoneNumber,
      row.operatorName,
      communicationLineAmount(row),
      communicationLinePlace(row),
    ]),
  ])
  sheet['!cols'] = HEADERS.map((header) => ({ wch: Math.max(header.length + 2, 18) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Communication lines')
  return writeWorkbook(workbook)
}
