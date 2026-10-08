import { MEMO_LETTERHEAD_CSS, memoLetterheadHtml } from '@personel-management-app/shared'

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]
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

export function roundUp(value: number): number {
  return Math.ceil(value)
}

export function numberWords(value: number): string {
  const n = Math.trunc(Math.abs(value))
  if (n < 20) return ONES[n] ?? String(n)
  if (n < 100) {
    const ten = Math.floor(n / 10)
    const one = n % 10
    return one === 0 ? TENS[ten]! : `${TENS[ten]} ${ONES[one]}`
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100)
    const rest = n % 100
    const head = `${ONES[hundred]} hundred`
    return rest === 0 ? head : `${head} ${numberWords(rest)}`
  }
  if (n < 1000000) {
    const thousand = Math.floor(n / 1000)
    const rest = n % 1000
    const head = `${numberWords(thousand)} thousand`
    return rest === 0 ? head : `${head} ${numberWords(rest)}`
  }
  return String(n)
}

export function daysPhrase(days: number): string {
  return `${numberWords(days)} (${days})`
}

export function moneyPhrase(amount: number): string {
  const formatted = amount.toLocaleString('en-US')
  return `${formatted} frs (${numberWords(amount)} francs)`
}

function ordinal(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

export function memoDateLabel(date: Date): string {
  return `${ordinal(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()}`
}

export function slashDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getUTCFullYear()}`
}

export function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function workingEndDate(
  start: Date,
  days: number,
  holidays: { month: number; day: number }[],
  saturdayWorking = true,
): Date {
  const keys = new Set(holidays.map((holiday) => monthDayKey(holiday.month, holiday.day)))
  let cursor = new Date(start.getTime())
  let counted = 0
  for (let guard = 0; guard < days * 4 + 400; guard += 1) {
    const weekday = cursor.getUTCDay()
    const sunday = weekday === 0
    const saturdayOff = !saturdayWorking && weekday === 6
    const key = monthDayKey(cursor.getUTCMonth() + 1, cursor.getUTCDate())
    if (!sunday && !saturdayOff && !keys.has(key)) {
      counted += 1
      if (counted === days) return cursor
    }
    cursor = addUtcDays(cursor, 1)
  }
  throw new Error('Could not place the leave days on the calendar')
}

export function resumptionDate(end: Date, category9: boolean): Date {
  const next = addUtcDays(end, 1)
  if (category9 && next.getUTCDay() === 0) return addUtcDays(next, 1)
  return next
}

export type LeaveMemoModel = {
  template: 'BELOW_NONE' | 'BELOW_PERMISSION' | 'CATEGORY_9'
  memoRef: string
  memoDate: Date
  earnedDays: number
  mothersLeaveDays: number
  qualifyingChildCount: number
  entitledDays: number
  permissionDays: number
  netDays: number
  travelAllowance: number
  accrualStartDate: Date | null
  accrualEndDate: Date | null
  employeeName: string
  unitName: string | null
  designation: string | null
  matricule: string
  startDate: Date
  endDate: Date
  resumeDate: Date
  fromTitle: string
  throTitle: string
  signatoryPreface: string | null
  signatoryName: string | null
  signatoryTitle: string
  ccText: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ccLines(text: string, extra?: string | null): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (extra?.trim()) lines.push(extra.trim())
  return lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')
}

export function buildLeaveMemoHtml(memo: LeaveMemoModel): string {
  const designation = memo.designation?.trim()
  const letterhead = memoLetterheadHtml({
    fromTitle: memo.fromTitle,
    unitName: memo.unitName,
    toName: memo.employeeName,
    designation: memo.designation,
    throTitle: memo.throTitle,
  })
  const cc =
    memo.template === 'BELOW_NONE'
      ? ccLines(memo.ccText, designation)
      : ccLines(memo.ccText)
  const body =
    memo.template === 'CATEGORY_9'
      ? categoryBody(memo)
      : belowBody(memo)
  const signature =
    memo.template === 'CATEGORY_9'
      ? `<div class="sign-right"><strong>${escapeHtml(memo.signatoryTitle)}</strong></div>`
      : `<div class="sign-center">
          <div>${escapeHtml(memo.signatoryPreface ?? '')}</div>
          <div class="dots">................................</div>
          <div><strong>${escapeHtml(memo.signatoryName ?? '')}</strong></div>
          <div><strong>${escapeHtml(memo.signatoryTitle)}</strong></div>
        </div>`
  const subject =
    memo.template === 'CATEGORY_9' ? 'ANNUAL LEAVE' : 'APPROVAL OF LEAVE'
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${subject}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; margin: 0; }
    ${MEMO_LETTERHEAD_CSS}
    .meta { display: flex; justify-content: space-between; margin-top: 28px; }
    .ref { font-weight: 700; }
    h1 { text-align: center; text-decoration: underline; font-size: 14pt; margin: 22px 0; }
    p { margin: 0 0 12px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    td { padding: 2px 0; vertical-align: bottom; }
    td.days { text-align: right; width: 70px; font-weight: 700; }
    .sign-center { margin-top: 28px; text-align: center; }
    .sign-right { margin-top: 28px; text-align: right; font-weight: 700; }
    .dots { letter-spacing: 1px; margin: 18px 0 4px; }
    .cc { margin-top: 28px; }
  </style>
</head>
<body>
  ${letterhead}
  <div class="meta">
    <div>
      <div class="ref">${escapeHtml(memo.memoRef)}</div>
      <div><strong>Mat. N° ${escapeHtml(memo.matricule)}</strong></div>
    </div>
    <div>${escapeHtml(memoDateLabel(memo.memoDate))}</div>
  </div>
  <h1>${subject}</h1>
  ${body}
  ${signature}
  <div class="cc"><strong>CC:</strong> ${cc}</div>
</body>
</html>`
}

function belowBody(memo: LeaveMemoModel): string {
  const travel = moneyPhrase(memo.travelAllowance)
  const span = `from ${slashDate(memo.startDate)} to ${slashDate(memo.endDate)} and you will resume duty on ${slashDate(memo.resumeDate)}`
  const permission =
    memo.template === 'BELOW_PERMISSION'
      ? `<p>You are due <strong>${daysPhrase(memo.earnedDays + memo.mothersLeaveDays)}</strong> annual leave days. However, permissions/absences in the course of duty taken by you amounts to <strong>${memo.permissionDays} days</strong> (${memo.permissionDays} approved permissions / no unauthorized absence).</p>
         <p>You are now due <strong>${daysPhrase(memo.netDays)}</strong> working days leave ${span}.</p>`
      : `<p>You are due <strong>${daysPhrase(memo.netDays)}</strong> working days leave ${span}.</p>`
  return `<p>We are pleased to inform you that your application for annual leave has been approved.</p>
    ${permission}
    <p>By copy of this memo, FIN.D is requested to pay your leave pay. Upon resumption, you shall also be paid the sum of <strong>${travel}</strong> cfa as leave travel allowance.</p>`
}

function categoryBody(memo: LeaveMemoModel): string {
  const earned =
    memo.accrualStartDate && memo.accrualEndDate
      ? `${slashDate(memo.accrualStartDate)} to ${slashDate(memo.accrualEndDate)}`
      : 'the accrual window'
  const row = (label: string, days: string) =>
    `<tr><td>${label}</td><td class="days">${days}</td></tr>`
  return `<p>Permission has been granted for you to proceed on leave as follows:</p>
    <p><strong>START:</strong> ${slashDate(memo.startDate)}<br/>
    <strong>END:</strong> ${slashDate(memo.endDate)}<br/>
    <strong>RESUME:</strong> ${slashDate(memo.resumeDate)}</p>
    <table>
      ${row(`1) Leave earned from ${earned}`, String(memo.earnedDays))}
      ${row('2) Amount of leave accrued last tour', 'NIL')}
      ${row(
        memo.mothersLeaveDays > 0
          ? `3) Mother's leave: (No. of children: ${memo.qualifyingChildCount})`
          : "3) Mother's leave: (No. of children)",
        memo.mothersLeaveDays > 0 ? String(memo.mothersLeaveDays) : 'NIL',
      )}
      ${row('4) Total leave due (1 + 2 + 3)', String(memo.earnedDays + memo.mothersLeaveDays))}
      ${row('5) Less Permission / Absence', String(memo.permissionDays))}
      ${row('6) Total leave due', String(memo.netDays))}
      ${row('7) Leave to be taken now', String(memo.netDays))}
      ${row('8) Leave accrued this tour', 'NIL')}
    </table>
    <p>Please note that leave travel allowance of <strong>${memo.travelAllowance.toLocaleString('en-US')} francs</strong> will be paid to you on your return from leave.</p>
    <p>Enclosed is a memorandum regarding Medical Examination to be completed by a Corporation Medical Officer. It is necessary that you undergo a Medical Examination prior to departure.</p>
    <p>By copy of this memo, FIN.D is requested to prepare and pay your leave pay.</p>`
}
