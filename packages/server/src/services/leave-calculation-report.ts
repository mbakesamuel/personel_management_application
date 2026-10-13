export type CalculationReportModel = {
  employeeName: string
  matricule: string
  leaveTypeName: string
  applicationDate: Date
  calculatedAt: Date
  accrualStartDate: Date
  accrualStartReason: string
  engagementDate: Date | null
  eligibleMonths: number
  serviceYears: number
  policyName: string
  policyCode: string
  method: 'METHOD_1' | 'METHOD_2'
  basicDays: number
  seniorityDays: number
  seniorityBand: string | null
  monthlyAccrual: number
  entitledDays: number
  qualifyingChildCount: number
  mothersLeaveDays: number
  daysPerChild: number
  maxAgeYears: number
  entitlementAnnualDays: number | null
  monthlyRateDays: number | null
  categoryLabel: string | null
  category9: boolean
  lastTourDays: number
  permissionBalance: number
  permissionDays: number
  leaveDaysDue: number
  grossDays: number
  netDays: number
  balancesPosted: boolean
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function displayDate(value: Date): string {
  const [year, month, day] = value.toISOString().slice(0, 10).split('-')
  return `${day}-${month}-${year}`
}

function figure(value: number): string {
  const rounded = Math.round(value * 10000) / 10000
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
}

function methodText(model: CalculationReportModel): string {
  const basic = figure(model.basicDays)
  const seniority = figure(model.seniorityDays)
  const monthly = figure(model.monthlyAccrual)
  if (model.method === 'METHOD_1') {
    const entitlement =
      model.entitlementAnnualDays == null
        ? `Basic days stored with this calculation are ${basic}.`
        : `The annual entitlement in force is ${figure(model.entitlementAnnualDays)} days, and that is the basic days.`
    return `${entitlement} Monthly accrual is basic days plus seniority days, divided by 12: (${basic} + ${seniority}) / 12 = ${monthly}.`
  }
  const rate =
    model.monthlyRateDays == null
      ? `Basic days stored with this calculation are ${basic}.`
      : `The monthly rate in force is ${figure(model.monthlyRateDays)} days, so basic days are that rate times 12, which is ${basic}.`
  return `${rate} Monthly accrual is the monthly rate plus seniority days divided by 12, which is ${monthly}.`
}

function balanceText(model: CalculationReportModel): string {
  const due = figure(model.leaveDaysDue)
  const posted = model.balancesPosted
    ? 'These figures were recorded when the leave was approved. They are not recalculated from the accounts after posting.'
    : 'These balances are the current accounts. They have not been posted, and this worksheet does not change them.'
  const category = model.categoryLabel
    ? `The employee category is ${model.categoryLabel}.`
    : 'No category is recorded for this employee.'
  const lastTour = model.category9
    ? `${category} Category 9 and above adds the accrued last-tour balance of ${figure(model.lastTourDays)} days. Gross days are ${figure(model.grossDays)}.`
    : `${category} The category is below 9, so no last-tour balance is added. Gross days remain ${figure(model.grossDays)}.`
  const permission = model.balancesPosted
    ? `Permission days applied against the gross are ${figure(model.permissionDays)}.`
    : `Outstanding permission days are ${figure(model.permissionBalance)}. The days applied are the smaller of that balance and the gross, which is ${figure(model.permissionDays)}.`
  return `<p>Leave days due before these balances are ${due}.</p>
    <p>${escapeHtml(lastTour)}</p>
    <p>${escapeHtml(permission)} Net days before any choice of days to grant are ${figure(model.netDays)}.</p>
    <p>${escapeHtml(posted)} Days granted, the leave end date, travel allowance, and the approval memo are not part of this worksheet.</p>`
}

export function buildLeaveCalculationReportHtml(
  model: CalculationReportModel,
): string {
  const unrounded = model.monthlyAccrual * model.eligibleMonths
  const band = model.seniorityBand
    ? `The seniority band matching the stored bonus is ${model.seniorityBand}.`
    : 'The stored seniority days are shown without a matching band.'
  const engagement = model.engagementDate
    ? displayDate(model.engagementDate)
    : 'not recorded'
  const motherProduct = model.daysPerChild * model.qualifyingChildCount
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave calculation</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
    h1 { font-size: 16pt; margin: 0 0 4px; }
    h2 { font-size: 12pt; margin: 16px 0 6px; }
    p { margin: 0 0 8px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #ccc; vertical-align: top; }
    th { width: 12rem; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Leave calculation</h1>
  <p>This worksheet explains the figures stored when leave was calculated.</p>
  <table>
    ${row('Employee', model.employeeName)}
    ${row('Matricule', model.matricule)}
    ${row('Leave type', model.leaveTypeName)}
    ${row('Application date', displayDate(model.applicationDate))}
    ${row('Calculated on', displayDate(model.calculatedAt))}
  </table>
  <h2>Due period</h2>
  <p>Leave is due from ${escapeHtml(displayDate(model.accrualStartDate))} to ${escapeHtml(displayDate(model.applicationDate))}. The start is ${escapeHtml(model.accrualStartReason)}.</p>
  <h2>Eligible months</h2>
  <p>Eligible months are the completed calendar months in that period. A month counts when the end day is on or after the start day. Eligible months: ${figure(model.eligibleMonths)}.</p>
  <h2>Length of service</h2>
  <p>Length of service is the completed years from the engagement date (${escapeHtml(engagement)}) to the application date. Length of service: ${figure(model.serviceYears)} years.</p>
  <h2>Policy</h2>
  <p>Policy ${escapeHtml(model.policyCode)}, ${escapeHtml(model.policyName)}, ${model.method === 'METHOD_1' ? 'method 1' : 'method 2'}.</p>
  <p>${escapeHtml(methodText(model))}</p>
  <h2>Seniority</h2>
  <p>Seniority days are ${figure(model.seniorityDays)}. ${escapeHtml(band)}</p>
  <h2>Earned days</h2>
  <p>Monthly accrual times eligible months is ${figure(model.monthlyAccrual)} × ${figure(model.eligibleMonths)} = ${figure(unrounded)}. Rounded up, earned days are ${figure(model.entitledDays)}.</p>
  <h2>Mother's leave</h2>
  <p>The mother's leave setting is ${figure(model.daysPerChild)} days for each qualifying child under ${figure(model.maxAgeYears)} years. Qualifying children: ${figure(model.qualifyingChildCount)}. ${figure(model.daysPerChild)} × ${figure(model.qualifyingChildCount)} = ${figure(motherProduct)}. The stored mother's leave is ${figure(model.mothersLeaveDays)} days. Leave days due are earned days plus mother's leave: ${figure(model.entitledDays)} + ${figure(model.mothersLeaveDays)} = ${figure(model.leaveDaysDue)}.</p>
  <h2>Balances still to apply at approval</h2>
  ${balanceText(model)}
</body>
</html>`
}
