import type { CommunicationLine } from '@personel-management-app/shared'
import { LOGO_DATA_URI } from './logo'
import {
  communicationLineAmount,
  communicationLinePlace,
} from './export-communication-lines-excel'
import {
  buildReportHeaderHtml,
  REPORT_HEADER_PRINT_CSS,
} from '../components/ReportHeader'

const ROWS_PER_PAGE = 22
const TITLE = 'COMMUNICATION LINES'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function chunk<T>(rows: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size))
  }
  return pages
}

function rowHtml(row: CommunicationLine): string {
  const place = communicationLinePlace(row)
  return `
        <tr>
          <td class="c">${escapeHtml(row.matricule)}</td>
          <td class="u wrap"><div>${escapeHtml(row.employeeName)}</div></td>
          <td class="u wrap"><div>${escapeHtml(row.position ?? '—')}</div></td>
          <td class="c">${escapeHtml(row.phoneNumber)}</td>
          <td>${escapeHtml(row.operatorName)}</td>
          <td>${escapeHtml(communicationLineAmount(row))}</td>
          <td>${escapeHtml(place || '—')}</td>
        </tr>`
}

export function buildCommunicationLinesPrintHtml(
  rows: CommunicationLine[],
  operatorName?: string,
  serviceName?: string,
): string {
  const pages = chunk(rows, ROWS_PER_PAGE)
  const pageCount = pages.length
  const department = operatorName?.trim() || null
  const service = serviceName?.trim() || null
  const body = pages
    .map((pageRows, index) => {
      const headerHtml = buildReportHeaderHtml({
        department,
        serviceName: service,
        title: TITLE,
        logoDataUri: LOGO_DATA_URI,
        escapeHtml,
      })
      return `
      <section class="page">
        ${headerHtml}
        <table>
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Name</th>
              <th>Position</th>
              <th>Phone</th>
              <th>Operator</th>
              <th>Amount</th>
              <th>Group/Service</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.map(rowHtml).join('')}
          </tbody>
        </table>
        <footer class="ftr">
          <span>${TITLE}</span>
          <span>Page ${index + 1} of ${pageCount}</span>
        </footer>
      </section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${TITLE}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm 2mm 8mm 2mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Arial Narrow", Arial, sans-serif; color: #000; font-size: 9pt; }
    .page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      min-height: 192mm;
    }
    .page:last-child { page-break-after: auto; }
    ${REPORT_HEADER_PRINT_CSS}
    .rh-company-name, .rh-line, .rh-title { font-family: "Arial Narrow", Arial, sans-serif; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
    th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; font-size: 10pt; }
    th { text-transform: uppercase; }
    .c { text-align: center; }
    .u { text-transform: uppercase; }
    td.wrap div {
      display: inline-block;
      max-width: 42mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: bottom;
    }
    .ftr { margin-top: auto; display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 4px; font-weight: 700; text-transform: uppercase; font-size: 10pt; }
  </style>
</head>
<body>${body}</body>
</html>`
}
