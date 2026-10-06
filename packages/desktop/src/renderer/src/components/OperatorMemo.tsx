import type { CommunicationBatchReport } from '@personel-management-app/shared'
import directorSignature from '../assets/director-signature.png?inline'
import letterfoot from '../assets/header-F.png?inline'
import letterhead from '../assets/header-H.png?inline'
import organizationStamp from '../assets/organization-stamp.png?inline'
import { REPORT_COMPANY_NAME } from './ReportHeader'

export type OperatorMemoKind = 'adjustment' | 'removal' | 'creation'

export type OperatorMemoRow = {
  name: string
  phone: string
  airtime: number
  data: number
  accountNo?: string | null
}

type OperatorMemoProps = {
  kind: OperatorMemoKind
  letterDate: string
  effectDate: string
  rows: OperatorMemoRow[]
  signatoryName: string | null
  signatoryTitle: string | null
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

const ORANGE_ACCOUNT = '4.3882'

export function isOrangeOperator(name: string) {
  return name.toLowerCase().includes('orange')
}

export function isMtnOperator(name: string) {
  return name.toLowerCase().includes('mtn')
}

export function isGmOperator(name: string) {
  return name.toLowerCase().includes('gm')
}

type MemoOperator = 'orange' | 'mtn' | 'other'

function memoOperator(name: string): MemoOperator {
  if (isOrangeOperator(name)) return 'orange'
  if (isMtnOperator(name)) return 'mtn'
  return 'other'
}

type AccountPlacement = { mode: 'letter'; account: string } | { mode: 'row' }

function accountPlacement(
  operator: MemoOperator,
  rows: OperatorMemoRow[],
): AccountPlacement | null {
  if (operator === 'orange') return { mode: 'letter', account: ORANGE_ACCOUNT }
  if (operator !== 'mtn') return null
  const accounts = rows.map((row) => row.accountNo?.trim() || '')
  const unique = [...new Set(accounts.filter((value) => value.length > 0))]
  const shared = unique[0]
  if (shared && unique.length === 1 && accounts.every((value) => value === shared)) {
    return { mode: 'letter', account: shared }
  }
  if (unique.length > 0) return { mode: 'row' }
  return null
}

function fleetWord(operator: MemoOperator, operatorName: string) {
  if (operator === 'orange') return 'ORANGE'
  if (operator === 'mtn') return 'MTN'
  return escapeHtml(operatorName)
}

//date parts for the letter
function dateParts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return null
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return { day, suffix, month: MONTHS[month - 1], year }
}

function writtenDate(iso: string) {
  const parts = dateParts(iso)
  if (!parts) return iso
  return `${parts.day}${parts.suffix} ${parts.month} ${parts.year}`
}

function writtenDateHtml(iso: string) {
  const parts = dateParts(iso)
  if (!parts) return escapeHtml(iso)
  return `${parts.day}<sup>${parts.suffix}</sup> ${parts.month} ${parts.year}`
}

function WrittenDate({ iso }: { iso: string }) {
  const parts = dateParts(iso)
  if (!parts) return iso
  return (
    <>
      {parts.day}
      <sup>{parts.suffix}</sup> {parts.month} {parts.year}
    </>
  )
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function subjectFor(kind: OperatorMemoKind, account: string | null = ORANGE_ACCOUNT) {
  if (kind === 'removal') {
    return account
      ? `REMOVAL OF ACCOUNTS FROM CDC FLEET (A/c ${account})`
      : 'REMOVAL OF ACCOUNTS FROM CDC FLEET'
  }
  if (kind === 'creation') {
    return 'CREATION OF A COMMUNICATION KEY ACCOUNT FOR POST PAID AIRTIME EXCHANGE FOR A CDC WORKER'
  }
  return account
    ? `ADJUSTMENT OF STATUS IN CDC FLEET, A/c ${account}`
    : 'ADJUSTMENT OF STATUS IN CDC FLEET'
}

function Body({ kind, effectDate, letterDate }: OperatorMemoProps) {
  const effect = writtenDate(effectDate)
  if (kind === 'removal') {
    const when = effectDate === letterDate ? 'IMMEDIATELY' : effect
    return (
      <>
        <p>
          Kindly COMPLETELY remove the accounts of the below mentioned CDC worker(s)
          from the CDC Subsidized Fleet of the ORANGE Post Paid scheme and downgrade
          to prepaid.
        </p>
        <p>Kindly do this with effect {when}.</p>
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

export function OperatorMemo(props: OperatorMemoProps) {
  const { kind, letterDate, rows, signatoryName, signatoryTitle } = props
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
      <p className="mt-4 text-right text-sm">
        <WrittenDate iso={letterDate} />
      </p>

      <p className="mt-4 mb-0 text-sm">
        The General Manager
        <br />
        <span className="font-semibold text-[#ff7900]">ORANGE CAMEROUN</span>
      </p>
      <p className="mt-3 flex justify-start gap-8 text-sm">
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
      <div className="mt-8 text-sm">
        <div className="mb-2 flex items-end gap-4">
          <img src={directorSignature} alt="Director signature" className="h-16 w-auto" />
          <img src={organizationStamp} alt="Organizational stamp" className="h-24 w-auto" />
        </div>
        {signatoryName ? <p className="m-0 font-semibold">{signatoryName}</p> : null}
        {signatoryTitle ? <p className="m-0">{signatoryTitle}</p> : null}
      </div>
      <p className="mt-6 text-sm">cc: HOMC</p>
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
  return effectDate === letterDate ? 'IMMEDIATELY' : writtenDate(effectDate)
}

function letterBody(
  kind: OperatorMemoKind,
  letterDate: string,
  effectDate: string,
  operatorName: string,
  placement: AccountPlacement | null,
) {
  const operator = memoOperator(operatorName)
  const effect = writtenDate(effectDate)
  const word = fleetWord(operator, operatorName)
  const acc =
    placement?.mode === 'letter' ? `, Acc. ${escapeHtml(placement.account)}` : ''
  if (kind === 'removal') {
    return `<p>Kindly COMPLETELY remove the accounts of the below mentioned CDC worker(s) from the CDC Subsidized Fleet of the ${word} Post Paid scheme and downgrade to prepaid.</p><p>Kindly do this to take effect ${escapeHtml(removalWhen(letterDate, effectDate))}.</p>`
  }
  if (kind === 'creation') {
    const article = operator === 'other' ? 'a' : 'an'
    return `<p>As per the agreement between ${word} and CDC, creating ${article} ${word} Communication Key Account for a postpaid Communication Fleet for CDC Workers, find below request for a manager to be included in the Subsidized Scheme${acc}</p><p>Kindly effect this request to commence from ${escapeHtml(effect)}.</p>`
  }
  return `<p>Kindly adjust the status of the following manager on the CDC ${word} Fleet, increasing their airtime in the Subsidized Fleet${acc} as analysed below.</p><p>Kindly do this to take effect from ${escapeHtml(effect)}.</p>`
}

type OperatorLetterAddress = {
  operatorName: string
  operatorEmail: string | null
  operatorPhone: string | null
  operatorAddress: string | null
  signatoryName: string | null
  signatoryTitle: string | null
}

function addresseeHtml(address: OperatorLetterAddress) {
  if (isOrangeOperator(address.operatorName)) {
    return `<p>The General Manager<br /><strong class="operator-name">ORANGE CAMEROUN</strong></p>
    <p class="attn"><span>Attn: Jim Jabes</span><span>699 94 66 45</span></p>`
  }
  const lines =
    memoOperator(address.operatorName) === 'mtn'
      ? [
          'The General Manager',
          `<strong class="operator-name">${escapeHtml(address.operatorName)}</strong>`,
        ]
      : [`<strong class="operator-name">${escapeHtml(address.operatorName)}</strong>`]
  if (address.operatorAddress?.trim()) {
    lines.push(escapeHtml(address.operatorAddress.trim()).replaceAll('\n', '<br />'))
  }
  const contact = [address.operatorPhone, address.operatorEmail].filter(
    (value): value is string => Boolean(value?.trim()),
  )
  const contactHtml =
    contact.length > 0
      ? `<p class="attn">${contact.map((value) => `<span>${escapeHtml(value.trim())}</span>`).join('')}</p>`
      : ''
  return `<p>${lines.join('<br />')}</p>${contactHtml}`
}

function letterTable(
  kind: OperatorMemoKind,
  rows: OperatorMemoRow[],
  placement: AccountPlacement | null,
) {
  const perRow = placement?.mode === 'row'
  const phoneHeader = kind === 'creation' ? 'TEL' : 'PHONE N°'
  const amountHeaders =
    kind === 'removal'
      ? ['NEW STATUS']
      : kind === 'creation'
        ? ['AIRTIME', 'DATA', 'MONTHLY PACKAGE']
        : ['AIRTIME', 'DATA', 'TOTAL']
  const head = [
    'N°',
    'NAME',
    phoneHeader,
    ...(perRow ? ['ACCOUNT'] : []),
    ...amountHeaders,
  ]
    .map((label) => `<th>${label}</th>`)
    .join('')
  const body = rows
    .map((row, index) => {
      const accountCell = perRow
        ? `<td>${escapeHtml(row.accountNo?.trim() || '')}</td>`
        : ''
      const amountCells =
        kind === 'removal'
          ? '<td class="status">REMOVE</td>'
          : `<td class="num">${formatAmount(row.airtime)}</td><td class="num">${formatAmount(row.data)}</td><td class="num">${formatAmount(row.airtime + row.data)}</td>`
      return `<tr><td>${index + 1}</td><td class="name">${escapeHtml(row.name)}</td><td>${escapeHtml(row.phone)}</td>${accountCell}${amountCells}</tr>`
    })
    .join('')
  const account =
    kind === 'removal' && placement?.mode === 'letter'
      ? `<p class="account">A/c ${escapeHtml(placement.account)}</p>`
      : ''
  return `${account}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}
/* Operator Letter HTML Builder */
function letterHtml(
  kind: OperatorMemoKind,
  letterDate: string,
  effectDate: string,
  rows: OperatorMemoRow[],
  address: OperatorLetterAddress,
) {
  const placement = accountPlacement(memoOperator(address.operatorName), rows)
  const letterAccount = placement?.mode === 'letter' ? placement.account : null
  return `<article class="letter">
    <p class="date">${writtenDateHtml(letterDate)}</p>
    ${addresseeHtml(address)}
    <h2>${escapeHtml(subjectFor(kind, letterAccount))}</h2>
    <div class="body">${letterBody(kind, letterDate, effectDate, address.operatorName, placement)}</div>
    ${letterTable(kind, rows, placement)}
    <p class="thanks">Thanks.</p>
    <div class="sign">
      <div class="sign-marks">
        <img class="signature" src="${directorSignature}" alt="Director signature" />
        <img class="stamp" src="${organizationStamp}" alt="Organizational stamp" />
      </div>
      ${address.signatoryName ? `<p class="sign-name">${escapeHtml(address.signatoryName)}</p>` : ''}
      ${address.signatoryTitle ? `<p>${escapeHtml(address.signatoryTitle)}</p>` : ''}
    </div>
    <p>cc: HOMC</p>
  </article>`
}

const PAGE_CSS = `
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; color: #000; font-family: "Times New Roman", Times, serif; font-size: 12pt; }
body { padding: 12mm; }
.toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: flex-end; margin: -12mm -12mm 8mm; padding: 8px 12mm; background: #f4f4f4; border-bottom: 1px solid #ccc; }
.toolbar button { font: inherit; padding: 6px 14px; cursor: pointer; }
table { width: calc(100% - 1px); border-collapse: collapse; font-size: 11pt; }
th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
th:last-child, td:last-child { border-right: 1px solid #000; }
td.num { text-align: right; }
@media print {
  body { padding: 0; }
  .toolbar { display: none !important; }
}
`

const LETTER_CSS = `
${PAGE_CSS}
@page { size: A4; margin: 2mm 10mm 2mm 10mm; }
.letterhead, .letterfoot { position: fixed; left: 50%; z-index: 1; width: 190mm; height: auto; transform: translateX(-50%); }
.letterhead { top: 16mm; }
.letterfoot { bottom: 4mm; }
.letter { padding-top: 8mm; padding-bottom: 52mm; }
.letter + .letter { break-before: page; }
.date { text-align: right; }
.attn { display: flex; justify-content: flex-start; gap: 2rem; }
.operator-name { color: #ff7900; }
h2 { text-align: center; font-size: 14pt; text-decoration: underline; }
.body p { line-height: 1.45; text-align: justify; }
.account { font-weight: 700; }
td.name { text-transform: uppercase; }
td.status { font-weight: 700; }
.thanks { margin-top: 18px; }
.sign { margin-top: 24px; }
.sign-marks { display: flex; align-items: flex-end; gap: 16px; min-height: 28mm; }
.signature { height: 18mm; width: auto; }
.stamp { height: 28mm; width: auto; }
.sign p { margin: 0; }
.sign-name { font-weight: 700; }
@media print {
  .letterhead { top: 2mm; }
  .letterfoot { bottom: 2mm; }
  .letter { padding-top: 40mm; padding-bottom: 40mm; }
}
`

const PLAIN_CSS = `
${PAGE_CSS}
@page { size: A4; margin: 8mm 4mm 8mm 4mm; }
.plain-head { text-align: center; }
.plain-head p { margin: 0; }
.plain-head .company { font-weight: 700; }
.plain h1 { font-size: 14pt; margin: 12px 0 4px; text-align: center; }
.plain h2 { text-align: left; text-decoration: none; font-size: 12pt; margin-top: 18px; }
.prepared { width: fit-content; margin-top: 18px; margin-left: 10px; text-align: left; }
.prepared p { margin: 0 0 16px; }
`

export type OperatorMemoLetter = {
  kind: OperatorMemoKind
  letterDate: string
  effectDate: string
  rows: OperatorMemoRow[]
}

function documentHtml(title: string, pages: string, css: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${css}</style></head><body><div class="toolbar"><button type="button" onclick="window.api.printReportWindow()">Print</button></div>${pages}</body></html>`
}

export function buildOperatorMemosHtml(
  letters: OperatorMemoLetter[],
  address: OperatorLetterAddress,
) {
  const pages = letters
    .map((letter) =>
      letterHtml(letter.kind, letter.letterDate, letter.effectDate, letter.rows, address),
    )
    .join('')
  return documentHtml(
    address.operatorName,
    `<img class="letterhead" src="${letterhead}" alt="Cameroon Development Corporation" /><img class="letterfoot" src="${letterfoot}" alt="CDC offices and contact" />${pages}`,
    LETTER_CSS,
  )
}

function monthYear(iso: string) {
  const [year, month] = iso.split('-').map(Number)
  const name = year && month ? MONTHS[month - 1] : undefined
  if (!name || !year) return iso
  return `${name} ${year}`.toUpperCase()
}

function fleetPeriodLabel(effectiveDate: string, endDate: string) {
  const start = monthYear(effectiveDate)
  const end = monthYear(endDate)
  return start === end ? start : `${start} – ${end}`
}

function designationCell(value: string | null) {
  return escapeHtml(value?.trim() || '—')
}

/* GM's memo for communication allowance changes */
function plainBatchArticle(report: CommunicationBatchReport) {
  const actions = [
    report.creations.length > 0 ? { word: 'ADD', place: 'TO' } : null,
    report.modifications.length > 0 ? { word: 'MODIFY', place: 'IN THE' } : null,
    report.removals.length > 0 ? { word: 'REMOVE', place: 'FROM' } : null,
  ].filter((action) => action != null)
  const last = actions[actions.length - 1]
  const actionPhrase = last ? `TO ${actions.map((action) => action.word).join('/')} ${last.place} ` : 'FROM '
  const modifications =
    report.modifications.length === 0
      ? ''
      : `<h2>Modification</h2><table><thead><tr><th>SN</th><th>Employee</th><th>Designation</th><th>Phone</th><th>Service</th><th>Previous Amt</th><th>New Amount</th></tr></thead><tbody>${report.modifications
          .map(
            (row, index) =>
              `<tr><td>${index + 1}</td><td>${escapeHtml(row.employeeName)}<br />${escapeHtml(row.matricule)}</td><td>${designationCell(row.designation)}</td><td>${escapeHtml(row.phoneNumber)}</td><td>${escapeHtml(row.serviceName)}</td><td class="num">${row.previousAmount == null ? '—' : formatAmount(row.previousAmount)}</td><td class="num">${formatAmount(row.amount)}</td></tr>`,
          )
          .join('')}</tbody></table>`
  const removals =
    report.removals.length === 0
      ? ''
      : `<h2>Removal</h2><table><thead><tr><th>SN</th><th>Employee</th><th>Designation</th><th>Phone</th><th>End date</th></tr></thead><tbody>${report.removals
          .map(
            (row, index) =>
              `<tr><td>${index + 1}</td><td>${escapeHtml(row.employeeName)}<br />${escapeHtml(row.matricule)}</td><td>${designationCell(row.designation)}</td><td>${escapeHtml(row.phoneNumber)}</td><td>${escapeHtml(row.endDate)}</td></tr>`,
          )
          .join('')}</tbody></table>`
  const creations =
    report.creations.length === 0
      ? ''
      : `<h2>Addition</h2><table><thead><tr><th>SN</th><th>Employee</th><th>Designation</th><th>Phone</th><th>Amount</th></tr></thead><tbody>${report.creations
          .map(
            (row, index) =>
              `<tr><td>${index + 1}</td><td>${escapeHtml(row.employeeName)}<br />${escapeHtml(row.matricule)}</td><td>${designationCell(row.designation)}</td><td>${escapeHtml(row.phoneNumber)}</td><td class="num">${formatAmount(row.airtime)}</td></tr>`,
          )
          .join('')}</tbody></table>`
  const period = fleetPeriodLabel(report.effectiveDate, report.endDate)
  return `<article class="plain">
    <header class="plain-head">
      <h1 class="company">${escapeHtml(REPORT_COMPANY_NAME)}</h1>
      <h3>Information Systems Department</h3>
      <h5>NAMES OF WORKERS ${actionPhrase}FLEET FOR ${escapeHtml(period)}</h5>
    </header>
    ${creations}
    ${modifications}
    ${removals}
    <div class="prepared">
      <p>Prepared By</p>
      <p>Name:</p>
      <p>Signature:</p>
    </div>
  </article>`
}

export function buildPlainBatchReportHtml(report: CommunicationBatchReport) {
  return documentHtml('Communication allowance changes', plainBatchArticle(report), PLAIN_CSS)
}

function letterAddress(report: CommunicationBatchReport): OperatorLetterAddress {
  return {
    operatorName: report.operatorName,
    operatorEmail: report.operatorEmail,
    operatorPhone: report.operatorPhone,
    operatorAddress: report.operatorAddress,
    signatoryName: report.signatoryName,
    signatoryTitle: report.signatoryTitle,
  }
}

function accountNoOf(row: { phoneNumber: string; accountNo?: string | null }) {
  return row.accountNo ?? null
}

function packageMemoRows(
  rows: CommunicationBatchReport['adjustments'],
): OperatorMemoRow[] {
  return rows.map((row) => ({
    name: row.employeeName,
    phone: row.phoneNumber,
    airtime: row.airtime,
    data: row.data,
    accountNo: accountNoOf(row),
  }))
}

function removalMemoRows(report: CommunicationBatchReport): OperatorMemoRow[] {
  return report.removals.map((row) => ({
    name: row.employeeName,
    phone: row.phoneNumber,
    airtime: 0,
    data: 0,
    accountNo: row.accountNo,
  }))
}

export function batchReportDocument(report: CommunicationBatchReport): {
  html: string
  title: string
} {
  const address = letterAddress(report)
  if (isGmOperator(report.operatorName)) {
    return {
      html: buildPlainBatchReportHtml(report),
      title: 'Communication allowance changes',
    }
  }
  if (isOrangeOperator(report.operatorName) || isMtnOperator(report.operatorName)) {
    const letters: OperatorMemoLetter[] = []
    if (report.adjustments.length > 0) {
      letters.push({
        kind: 'adjustment',
        letterDate: report.createdAt,
        effectDate: report.effectiveDate,
        rows: packageMemoRows(report.adjustments),
      })
    }
    if (report.removals.length > 0) {
      letters.push({
        kind: 'removal',
        letterDate: report.createdAt,
        effectDate: report.endDate,
        rows: removalMemoRows(report),
      })
    }
    if (report.creations.length > 0) {
      letters.push({
        kind: 'creation',
        letterDate: report.createdAt,
        effectDate: report.effectiveDate,
        rows: packageMemoRows(report.creations),
      })
    }
    return {
      html: buildOperatorMemosHtml(letters, address),
      title: report.operatorName,
    }
  }
  if (report.creations.length > 0) {
    const creation = letterHtml(
      'creation',
      report.createdAt,
      report.effectiveDate,
      packageMemoRows(report.creations),
      address,
    )
    const hasOther = report.modifications.length > 0 || report.removals.length > 0
    const pages = hasOther
      ? `${creation}${plainBatchArticle({ ...report, creations: [] })}`
      : creation
    return {
      html: documentHtml(
        report.operatorName,
        pages,
        hasOther ? `${LETTER_CSS}${PLAIN_CSS}` : LETTER_CSS,
      ),
      title: report.operatorName,
    }
  }
  return {
    html: buildPlainBatchReportHtml(report),
    title: 'Communication allowance changes',
  }
}
