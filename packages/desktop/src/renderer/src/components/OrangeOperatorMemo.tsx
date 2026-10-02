import type { CommunicationBatchReport } from '@personel-management-app/shared'

export type OrangeMemoKind = 'adjustment' | 'removal' | 'creation'

export type OrangeMemoRow = {
  name: string
  phone: string
  airtime: number
  data: number
}

type OrangeOperatorMemoProps = {
  kind: OrangeMemoKind
  letterDate: string
  effectDate: string
  rows: OrangeMemoRow[]
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function isOrangeOperator(name: string) {
  return name.toLowerCase().includes('orange')
}

function writtenDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return `${day}${suffix} ${MONTHS[month - 1]} ${year}`
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function subjectFor(kind: OrangeMemoKind) {
  if (kind === 'removal') {
    return 'REMOVAL OF ACCOUNTS FROM CDC FLEET (A/c 4.3882)'
  }
  if (kind === 'creation') {
    return 'CREATION OF A COMMUNICATION KEY ACCOUNT FOR POST PAID AIRTIME EXCHANGE FOR A CDC WORKER'
  }
  return 'ADJUSTMENT OF STATUS IN CDC FLEET, A/c 4.3882'
}

function Body({ kind, effectDate, letterDate }: OrangeOperatorMemoProps) {
  const effect = writtenDate(effectDate)
  if (kind === 'removal') {
    const when =
      effectDate === letterDate ? 'IMMEDIATELY' : `on ${effect}`
    return (
      <>
        <p>
          Kindly COMPLETELY remove the accounts of the below mentioned CDC worker
          from the CDC Subsidized Fleet of the ORANGE Post Paid scheme and downgrade
          to prepaid.
        </p>
        <p>Kindly do this to take effect {when}.</p>
      </>
    )
  }
  if (kind === 'creation') {
    return (
      <>
        <p>
          As per the agreement between ORANGE and CDC, creating an ORANGE
          Communication Key Account for a postpaid Communication Fleet for CDC
          Workers, find below request for a manager to be included in the Subsidized
          Scheme, Acc. 4.3882
        </p>
        <p>Kindly effect this request to commence from {effect}.</p>
      </>
    )
  }
  return (
    <>
      <p>
        Kindly adjust the status of the following manager on the CDC ORANGE Fleet,
        increasing their airtime in the Subsidized Fleet, Acc. 4.3882 as analysed
        below.
      </p>
      <p>Kindly do this to take effect from {effect}.</p>
    </>
  )
}

export function OrangeOperatorMemo(props: OrangeOperatorMemoProps) {
  const { kind, letterDate, rows } = props
  const amountHeaders =
    kind === 'removal'
      ? ['NEW STATUS']
      : kind === 'creation'
        ? ['AIRTIME', 'DATA', 'MONTHLY PACKAGE']
        : ['AIRTIME', 'DATA', 'TOTAL']

  return (
    <article
      className="operator-memo mx-auto max-w-3xl bg-white px-8 py-6 text-black"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="border-b border-black pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center border-2 border-green-800 text-center text-[10px] font-bold leading-tight text-green-800">
            CDC
          </div>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="m-0 text-sm font-bold tracking-wide">
              CAMEROON DEVELOPMENT CORPORATION SOE
            </h1>
            <p className="m-0 text-[10px] leading-snug">
              (STATE OWNED ENTERPRISE TRANSFORMED BY DECREE N° 2016/031 OF 19th
              JANUARY 2016)
            </p>
            <p className="m-0 text-[10px]">SHARE CAPITAL 67,522,516,140 FCFA</p>
            <p className="m-0 mt-1 text-[10px]">
              REGISTRATION N°: RC/L BE/2016/B00155/M2025/2021
              <br />
              TAX PAYER&apos;S N°: M0147000002450
            </p>
          </div>
          <p className="m-0 w-36 shrink-0 text-right text-[10px] leading-snug">
            P.O.BOX 305
            <br />
            BOTA - LIMBE
            <br />
            SOUTH WEST REGION
            <br />
            REPUBLIC OF CAMEROON
          </p>
        </div>
      </header>

      <p className="mt-4 text-right text-sm">{writtenDate(letterDate)}</p>

      <p className="mt-4 mb-0 text-sm">
        The General Manager
        <br />
        <span className="font-semibold">ORANGE CAMEROUN</span>
      </p>
      <p className="mt-3 flex justify-between text-sm">
        <span>Attn: Jim Jabes</span>
        <span>699 94 66 45</span>
      </p>

      <h2 className="mt-5 text-center text-sm font-bold underline">
        {subjectFor(kind)}
      </h2>

      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <Body {...props} />
      </div>

      {kind === 'removal' ? (
        <p className="mt-4 text-sm font-semibold">A/c 4.3882</p>
      ) : null}

      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            {['N°', 'NAME', kind === 'creation' ? 'TEL' : 'PHONE N°', ...amountHeaders].map(
              (label) => (
                <th
                  key={label}
                  className="border border-black px-2 py-1 text-left font-semibold"
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const packageAmount = row.airtime + row.data
            return (
              <tr key={`${row.phone}-${index}`}>
                <td className="border border-black px-2 py-1">{index + 1}</td>
                <td className="border border-black px-2 py-1 uppercase">{row.name}</td>
                <td className="border border-black px-2 py-1">{row.phone}</td>
                {kind === 'removal' ? (
                  <td className="border border-black px-2 py-1 font-semibold">REMOVE</td>
                ) : (
                  <>
                    <td className="border border-black px-2 py-1 text-right">
                      {formatAmount(row.airtime)}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {formatAmount(row.data)}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {formatAmount(packageAmount)}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-6 text-sm">Thanks.</p>
      <div className="mt-16 text-sm">
        <p className="m-0 font-semibold">Noupieple Hugues</p>
        <p className="m-0">Manager Information Systems</p>
      </div>
      <p className="mt-6 text-sm">cc: HOMC</p>

      <footer className="mt-8 grid grid-cols-3 gap-2 border-t border-black pt-2 text-[9px] leading-snug">
        <p className="m-0">
          BOTA TEL. (237) 233 33 22 51
          <br />
          (237) 233 33 26 80
        </p>
        <p className="m-0 text-center">
          WEBSITE: www.cdc-cameroon.com
          <br />
          EMAIL: info@cdc-cameroon.com
        </p>
        <p className="m-0 text-right">
          TIKO TEL. (237) 233 43 17 26
          <br />
          FAX: (237) 233 35 12 51
        </p>
      </footer>
    </article>
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function removalWhen(letterDate: string, effectDate: string) {
  return effectDate === letterDate ? 'IMMEDIATELY' : `on ${writtenDate(effectDate)}`
}

function letterBody(kind: OrangeMemoKind, letterDate: string, effectDate: string) {
  const effect = writtenDate(effectDate)
  if (kind === 'removal') {
    return `<p>Kindly COMPLETELY remove the accounts of the below mentioned CDC worker from the CDC Subsidized Fleet of the ORANGE Post Paid scheme and downgrade to prepaid.</p><p>Kindly do this to take effect ${removalWhen(letterDate, effectDate)}.</p>`
  }
  if (kind === 'creation') {
    return `<p>As per the agreement between ORANGE and CDC, creating an ORANGE Communication Key Account for a postpaid Communication Fleet for CDC Workers, find below request for a manager to be included in the Subsidized Scheme, Acc. 4.3882</p><p>Kindly effect this request to commence from ${escapeHtml(effect)}.</p>`
  }
  return `<p>Kindly adjust the status of the following manager on the CDC ORANGE Fleet, increasing their airtime in the Subsidized Fleet, Acc. 4.3882 as analysed below.</p><p>Kindly do this to take effect from ${escapeHtml(effect)}.</p>`
}

function letterTable(kind: OrangeMemoKind, rows: OrangeMemoRow[]) {
  const phoneHeader = kind === 'creation' ? 'TEL' : 'PHONE N°'
  const amountHeaders =
    kind === 'removal'
      ? ['NEW STATUS']
      : kind === 'creation'
        ? ['AIRTIME', 'DATA', 'MONTHLY PACKAGE']
        : ['AIRTIME', 'DATA', 'TOTAL']
  const head = ['N°', 'NAME', phoneHeader, ...amountHeaders]
    .map((label) => `<th>${label}</th>`)
    .join('')
  const body = rows
    .map((row, index) => {
      const amountCells =
        kind === 'removal'
          ? '<td class="status">REMOVE</td>'
          : `<td class="num">${formatAmount(row.airtime)}</td><td class="num">${formatAmount(row.data)}</td><td class="num">${formatAmount(row.airtime + row.data)}</td>`
      return `<tr><td>${index + 1}</td><td class="name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.phone)}</td>${amountCells}</tr>`
    })
    .join('')
  const account =
    kind === 'removal' ? '<p class="account">A/c 4.3882</p>' : ''
  return `${account}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function letterHtml(kind: OrangeMemoKind, letterDate: string, effectDate: string, rows: OrangeMemoRow[]) {
  return `<article class="letter">
    <header class="letterhead">
      <div class="mark">CDC</div>
      <div class="identity">
        <h1>CAMEROON DEVELOPMENT CORPORATION SOE</h1>
        <p>(STATE OWNED ENTERPRISE TRANSFORMED BY DECREE N° 2016/031 OF 19th JANUARY 2016)</p>
        <p>SHARE CAPITAL 67,522,516,140 FCFA</p>
        <p>REGISTRATION N°: RC/L BE/2016/B00155/M2025/2021<br />TAX PAYER'S N°: M0147000002450</p>
      </div>
      <p class="address">P.O.BOX 305<br />BOTA - LIMBE<br />SOUTH WEST REGION<br />REPUBLIC OF CAMEROON</p>
    </header>
    <p class="date">${escapeHtml(writtenDate(letterDate))}</p>
    <p>The General Manager<br /><strong>ORANGE CAMEROUN</strong></p>
    <p class="attn"><span>Attn: Jim Jabes</span><span>699 94 66 45</span></p>
    <h2>${escapeHtml(subjectFor(kind))}</h2>
    <div class="body">${letterBody(kind, letterDate, effectDate)}</div>
    ${letterTable(kind, rows)}
    <p class="thanks">Thanks.</p>
    <div class="sign">
      <p class="sign-name">Noupieple Hugues</p>
      <p>Manager Information Systems</p>
    </div>
    <p>cc: HOMC</p>
    <footer>
      <p>BOTA TEL. (237) 233 33 22 51<br />(237) 233 33 26 80</p>
      <p>WEBSITE: www.cdc-cameroon.com<br />EMAIL: info@cdc-cameroon.com</p>
      <p>TIKO TEL. (237) 233 43 17 26<br />FAX: (237) 233 35 12 51</p>
    </footer>
  </article>`
}

const REPORT_CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 12pt; }
body { padding: 12mm; }
.toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; margin: -12mm -12mm 8mm; padding: 8px 12mm; background: #f4f4f4; border-bottom: 1px solid #ccc; }
.toolbar button { font: inherit; padding: 6px 14px; cursor: pointer; }
.letter + .letter { break-before: page; }
.letterhead { display: flex; align-items: flex-start; gap: 12px; border-bottom: 1px solid #000; padding-bottom: 8px; }
.mark { width: 48px; height: 48px; flex: none; display: flex; align-items: center; justify-content: center; border: 2px solid #166534; color: #166534; font-size: 10pt; font-weight: 700; }
.identity { flex: 1; text-align: center; }
.identity h1 { margin: 0; font-size: 11pt; letter-spacing: 0.02em; }
.identity p, .address { margin: 2px 0 0; font-size: 8pt; line-height: 1.3; }
.address { width: 130px; flex: none; text-align: right; }
.date { text-align: right; }
.attn { display: flex; justify-content: space-between; }
h2 { text-align: center; font-size: 14pt; text-decoration: underline; }
.body p { line-height: 1.45; text-align: justify; }
.account { font-weight: 700; }
table { width: 100%; border-collapse: collapse; font-size: 11pt; }
th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
td.num { text-align: right; }
td.name { text-transform: uppercase; }
td.status { font-weight: 700; }
.thanks { margin-top: 18px; }
.sign { margin-top: 64px; }
.sign p { margin: 0; }
.sign-name { font-weight: 700; }
footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 28px; border-top: 1px solid #000; padding-top: 6px; font-size: 8pt; line-height: 1.3; }
footer p:nth-child(2) { text-align: center; }
footer p:nth-child(3) { text-align: right; }
.plain h1 { font-size: 14pt; margin-bottom: 4px; }
.plain h2 { text-align: left; text-decoration: none; font-size: 12pt; margin-top: 18px; }
@media print {
  body { padding: 0; }
  .toolbar { display: none !important; }
}
`

export type OrangeMemoLetter = {
  kind: OrangeMemoKind
  letterDate: string
  effectDate: string
  rows: OrangeMemoRow[]
}

export function buildOrangeMemosHtml(letters: OrangeMemoLetter[], title: string) {
  const pages = letters
    .map((letter) =>
      letterHtml(letter.kind, letter.letterDate, letter.effectDate, letter.rows),
    )
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${REPORT_CSS}</style></head><body><div class="toolbar"><button type="button" onclick="window.api.printReportWindow()">Print</button></div>${pages}</body></html>`
}

export function buildPlainBatchReportHtml(report: CommunicationBatchReport) {
  const modifications =
    report.modifications.length === 0
      ? '<p>None</p>'
      : `<table><thead><tr><th>Employee</th><th>Phone</th><th>Service</th><th>Previous</th><th>New</th></tr></thead><tbody>${report.modifications
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.employeeName)}<br />${escapeHtml(row.matricule)}</td><td>${escapeHtml(row.phoneNumber)}</td><td>${escapeHtml(row.serviceName)}</td><td class="num">${row.previousAmount == null ? '—' : formatAmount(row.previousAmount)}</td><td class="num">${formatAmount(row.amount)}</td></tr>`,
          )
          .join('')}</tbody></table>`
  const removals =
    report.removals.length === 0
      ? '<p>None</p>'
      : `<table><thead><tr><th>Employee</th><th>Phone</th><th>End date</th></tr></thead><tbody>${report.removals
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.employeeName)}<br />${escapeHtml(row.matricule)}</td><td>${escapeHtml(row.phoneNumber)}</td><td>${escapeHtml(row.endDate)}</td></tr>`,
          )
          .join('')}</tbody></table>`
  const body = `<article class="letter plain">
    <h1>Communication allowance changes</h1>
    <p>${escapeHtml(report.operatorName)}${report.operatorEmail ? ` · ${escapeHtml(report.operatorEmail)}` : ''}</p>
    <p>Prepared ${escapeHtml(report.createdAt)}. Amounts effective ${escapeHtml(report.effectiveDate)}. Removals end ${escapeHtml(report.endDate)}.</p>
    <h2>Modifications</h2>
    ${modifications}
    <h2>Removals</h2>
    ${removals}
  </article>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Communication allowance changes</title><style>${REPORT_CSS}</style></head><body><div class="toolbar"><button type="button" onclick="window.api.printReportWindow()">Print</button></div>${body}</body></html>`
}

export function batchReportDocument(report: CommunicationBatchReport): {
  html: string
  title: string
} {
  if (isOrangeOperator(report.operatorName)) {
    const letters: OrangeMemoLetter[] = []
    if (report.adjustments.length > 0) {
      letters.push({
        kind: 'adjustment',
        letterDate: report.createdAt,
        effectDate: report.effectiveDate,
        rows: report.adjustments.map((row) => ({
          name: row.employeeName,
          phone: row.phoneNumber,
          airtime: row.airtime,
          data: row.data,
        })),
      })
    }
    if (report.removals.length > 0) {
      letters.push({
        kind: 'removal',
        letterDate: report.createdAt,
        effectDate: report.endDate,
        rows: report.removals.map((row) => ({
          name: row.employeeName,
          phone: row.phoneNumber,
          airtime: 0,
          data: 0,
        })),
      })
    }
    if (report.creations.length > 0) {
      letters.push({
        kind: 'creation',
        letterDate: report.createdAt,
        effectDate: report.effectiveDate,
        rows: report.creations.map((row) => ({
          name: row.employeeName,
          phone: row.phoneNumber,
          airtime: row.airtime,
          data: row.data,
        })),
      })
    }
    return {
      html: buildOrangeMemosHtml(letters, report.operatorName),
      title: report.operatorName,
    }
  }
  return {
    html: buildPlainBatchReportHtml(report),
    title: 'Communication allowance changes',
  }
}
