import type {
  AppraisalSummaryResponse,
  AppraisalSummarySection,
  FinancialYear,
  SectionOption,
  UnitOption,
  User,
} from '@personel-management-app/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
import { LOGO_DATA_URI } from '../lib/logo'
import {
  buildReportHeaderHtml,
  ReportHeader,
  REPORT_HEADER_PRINT_CSS,
} from './ReportHeader'
import { ReportPreviewConsole } from './ReportPreviewConsole'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AppraisalSummaryConsoleProps = {
  user: User
  financialYear: FinancialYear | null
  onClose: () => void
}

const ALL_VALUE = '__all__'
const EMPTY_SECTIONS: AppraisalSummarySection[] = []

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function SummarySectionPage({
  section,
  appyear,
  pageIndex,
  pageCount,
}: {
  section: AppraisalSummarySection
  appyear: number | null
  pageIndex: number
  pageCount: number
}) {
  const signatory = [section.signatoryName, section.signatoryTitle]
    .filter(Boolean)
    .join(', ')
    .toUpperCase()

  return (
    <article className="summary-page mb-8 overflow-x-auto bg-white p-4 text-[11px] text-black shadow-sm">
      <ReportHeader
        department={section.groupName}
        serviceName={section.unitName}
        title={`${appyear ?? '—'} PERFORMANCE APPRAISALS 1 - 3`}
      />
      <p className="m-0 mt-2 text-left text-[12px] font-bold uppercase">
        SECTION: {section.sectionName}
      </p>

      <table className="mt-2 w-full border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="border border-black bg-muted/40 text-center font-bold uppercase">
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              SN
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              Mat No
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              Name
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              Design
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              D. Eng
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              Dur in Post (Yr)
            </th>
            <th className="border border-black px-0.5 py-1" colSpan={3}>
              Date of Last
            </th>
            <th className="border border-black px-0.5 py-1" colSpan={2}>
              Cat/Ech
            </th>
            <th className="border border-black px-0.5 py-1" colSpan={2}>
              Salary
            </th>
            <th className="border border-black px-0.5 py-1" colSpan={2}>
              Fin. Inc
            </th>
            <th className="border border-black px-0.5 py-1" rowSpan={2}>
              EM&apos;s Remarks
            </th>
          </tr>
          <tr className="border border-black bg-muted/40 text-center font-bold uppercase">
            <th className="border border-black px-0.5 py-1">Prom/Recl</th>
            <th className="border border-black px-0.5 py-1">Merit</th>
            <th className="border border-black px-0.5 py-1">Stat.</th>
            <th className="border border-black px-0.5 py-1">Pres</th>
            <th className="border border-black px-0.5 py-1">Pro</th>
            <th className="border border-black px-0.5 py-1">Pres</th>
            <th className="border border-black px-0.5 py-1">Pros</th>
            <th className="border border-black px-0.5 py-1">Per Month</th>
            <th className="border border-black px-0.5 py-1">Per Year</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={`${section.sectionId}-${row.matric}-${row.sn}`}>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.sn}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.matric}
              </td>
              <td className="border border-black px-0.5 py-0.5 uppercase">
                {row.names ?? ''}
              </td>
              <td className="border border-black px-0.5 py-0.5 uppercase">
                {row.designation ?? ''}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {formatDisplayDate(row.dateEng)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.lengthService ?? ''}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {formatDisplayDate(row.dateLpro)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {formatDisplayDate(row.dateLmer)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {formatDisplayDate(row.dateLstat)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.preCat ?? ''}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center">
                {row.proCat ?? ''}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-right">
                {formatNumber(row.preSalary)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-right">
                {formatNumber(row.proSalary)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-right">
                {formatNumber(row.finIncMonth)}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-right">
                {formatNumber(row.finIncYear)}
              </td>
              <td className="border border-black px-0.5 py-0.5">
                {row.award ?? ''}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td
              className="border border-black px-0.5 py-1 text-right uppercase"
              colSpan={11}
            >
              Total
            </td>
            <td className="border border-black px-0.5 py-1 text-right">
              {formatNumber(section.totals.preSalary)}
            </td>
            <td className="border border-black px-0.5 py-1 text-right">
              {formatNumber(section.totals.proSalary)}
            </td>
            <td className="border border-black px-0.5 py-1 text-right">
              {formatNumber(section.totals.finIncMonth)}
            </td>
            <td className="border border-black px-0.5 py-1 text-right">
              {formatNumber(section.totals.finIncYear)}
            </td>
            <td className="border border-black px-0.5 py-1" />
          </tr>
        </tbody>
      </table>

      {signatory ? (
        <p className="mt-8 text-center text-[12px] font-bold uppercase">
          {signatory}
        </p>
      ) : null}

      <footer className="mt-6 flex justify-between border-t border-black pt-1 text-[10px] font-semibold uppercase">
        <span>Annual Salary Review for {appyear ?? '—'}</span>
        <span>
          Page {pageIndex} of {pageCount}
        </span>
      </footer>
    </article>
  )
}

function buildPrintHtml(
  sections: AppraisalSummarySection[],
  appyear: number | null,
): string {
  const pageCount = sections.length
  const title = `${appyear ?? '—'} PERFORMANCE APPRAISALS 1 - 3`
  const pages = sections
    .map((section, index) => {
      const signatory = [section.signatoryName, section.signatoryTitle]
        .filter(Boolean)
        .join(', ')
        .toUpperCase()

      const bodyRows = section.rows
        .map(
          (row) => `
        <tr>
          <td class="c">${row.sn}</td>
          <td class="c">${escapeHtml(row.matric)}</td>
          <td class="u">${escapeHtml(row.names ?? '')}</td>
          <td class="u">${escapeHtml(row.designation ?? '')}</td>
          <td class="c">${escapeHtml(formatDisplayDate(row.dateEng))}</td>
          <td class="c">${escapeHtml(row.lengthService ?? '')}</td>
          <td class="c">${escapeHtml(formatDisplayDate(row.dateLpro))}</td>
          <td class="c">${escapeHtml(formatDisplayDate(row.dateLmer))}</td>
          <td class="c">${escapeHtml(formatDisplayDate(row.dateLstat))}</td>
          <td class="c">${escapeHtml(row.preCat ?? '')}</td>
          <td class="c">${escapeHtml(row.proCat ?? '')}</td>
          <td class="r">${formatNumber(row.preSalary)}</td>
          <td class="r">${formatNumber(row.proSalary)}</td>
          <td class="r">${formatNumber(row.finIncMonth)}</td>
          <td class="r">${formatNumber(row.finIncYear)}</td>
          <td>${escapeHtml(row.award ?? '')}</td>
        </tr>`,
        )
        .join('')

      const headerHtml = buildReportHeaderHtml({
        department: section.groupName,
        serviceName: section.unitName,
        title,
        logoDataUri: LOGO_DATA_URI,
        escapeHtml,
      })

      return `
      <section class="page">
        ${headerHtml}
        <p class="section-label">SECTION: ${escapeHtml(section.sectionName)}</p>
        <table>
          <thead>
            <tr>
              <th rowspan="2">SN</th>
              <th rowspan="2">Mat No</th>
              <th rowspan="2">Name</th>
              <th rowspan="2">Design</th>
              <th rowspan="2">D. Eng</th>
              <th rowspan="2">Dur in Post (Yr)</th>
              <th colspan="3">Date of Last</th>
              <th colspan="2">Cat/Ech</th>
              <th colspan="2">Salary</th>
              <th colspan="2">Fin. Inc</th>
              <th rowspan="2">EM's Remarks</th>
            </tr>
            <tr>
              <th>Prom/Recl</th>
              <th>Merit</th>
              <th>Stat.</th>
              <th>Pres</th>
              <th>Pro</th>
              <th>Pres</th>
              <th>Pros</th>
              <th>Per Month</th>
              <th>Per Year</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            <tr class="total">
              <td colspan="11" class="r">TOTAL</td>
              <td class="r">${formatNumber(section.totals.preSalary)}</td>
              <td class="r">${formatNumber(section.totals.proSalary)}</td>
              <td class="r">${formatNumber(section.totals.finIncMonth)}</td>
              <td class="r">${formatNumber(section.totals.finIncYear)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        ${signatory ? `<p class="sign">${escapeHtml(signatory)}</p>` : ''}
        <footer class="ftr">
          <span>ANNUAL SALARY REVIEW FOR ${appyear ?? '—'}</span>
          <span>Page ${index + 1} of ${pageCount}</span>
        </footer>
      </section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Appraisal Summary ${appyear ?? ''}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11pt; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    ${REPORT_HEADER_PRINT_CSS}
    .section-label { margin: 6px 0 0; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; }
    th { text-transform: uppercase; font-size: 9pt; }
    .c { text-align: center; }
    .r { text-align: right; }
    .u { text-transform: uppercase; }
    .total { font-weight: 700; }
    .sign { margin-top: 28px; text-align: center; font-weight: 700; text-transform: uppercase; font-size: 11pt; }
    .ftr { margin-top: 18px; display: flex; justify-content: space-between; border-top: 1px solid #000; padding-top: 4px; font-weight: 700; text-transform: uppercase; font-size: 10pt; }
  </style>
</head>
<body>${pages}</body>
</html>`
}

export function AppraisalSummaryConsole({
  user,
  financialYear,
  onClose,
}: AppraisalSummaryConsoleProps) {
  const [years, setYears] = useState<number[]>([])
  const [appyear, setAppyear] = useState<number | null>(null)
  const [unitId, setUnitId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [units, setUnits] = useState<UnitOption[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [report, setReport] = useState<AppraisalSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [yearsLoaded, setYearsLoaded] = useState(false)

  const unrestricted = user.jurisdiction === 'all'
  const scope = user.jurisdiction
  const unitLocked = !unrestricted && (scope === 'unit' || scope === 'section')
  const sectionLocked = !unrestricted && scope === 'section'
  const sessionYear = financialYear?.appyear ?? null

  const loadLookups = useCallback(async () => {
    const client = await createApiClient()
    const [unitsRes, yearsRes] = await Promise.all([
      client.appraisals.units.$get(),
      client.reports['appraisal-letter-years'].$get(),
    ])
    if (unitsRes.ok) setUnits(await unitsRes.json())
    if (!yearsRes.ok) {
      const body = (await yearsRes.json().catch(() => null)) as {
        error?: string
      } | null
      setYears([])
      setStatus(body?.error ?? `Failed to load years (${yearsRes.status})`)
      return
    }
    const data = await yearsRes.json()
    setYears(data.years)
    setAppyear((prev) => {
      if (prev != null && data.years.includes(prev)) return prev
      if (sessionYear != null && data.years.includes(sessionYear)) {
        return sessionYear
      }
      return data.years[0] ?? null
    })
    setYearsLoaded(true)
  }, [sessionYear])

  const loadSections = useCallback(async (unit: string) => {
    const client = await createApiClient()
    const res = await client.appraisals.sections.$get({
      query: unit ? { unitId: unit } : {},
    })
    if (res.ok) setSections(await res.json())
    else setSections([])
  }, [])

  const loadReport = useCallback(async () => {
    if (appyear == null) {
      setReport(null)
      if (yearsLoaded) {
        setStatus(
          years.length === 0
            ? 'No posted salary review data. Use Post on the Appraisal Console first, or import historic salary review.'
            : 'Select a year with posted salary review data to load the summary.',
        )
      }
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.reports['appraisal-summary'].$get({
        query: {
          appyear: String(appyear),
          ...(unitId ? { unitId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load summary (${res.status})`)
      }
      const data = (await res.json()) as AppraisalSummaryResponse
      setReport(data)
      if (data.sections.length === 0) {
        setStatus(
          `No posted salary review data for year ${appyear}. Use Post on the Appraisal Console first.`,
        )
      }
    } catch (err) {
      setReport(null)
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [appyear, unitId, sectionId, years.length, yearsLoaded])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    if (unrestricted) return
    if (scope === 'unit' && user.unitId) setUnitId(user.unitId)
    else if (scope === 'section') {
      if (user.unitId) setUnitId(user.unitId)
      else if (units.length === 1) setUnitId(units[0].id)
      if (user.sectionId != null) setSectionId(String(user.sectionId))
    } else if (scope === 'group' && units.length === 1) {
      setUnitId(units[0].id)
    }
  }, [unrestricted, scope, user.unitId, user.sectionId, units])

  useEffect(() => {
    void loadSections(unitId)
    if (!sectionLocked) setSectionId('')
  }, [unitId, loadSections, sectionLocked])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const sectionsData = report?.sections ?? EMPTY_SECTIONS
  const printOptions = useMemo(() => ({ landscape: true }), [])
  const defaultPdfName =
    appyear != null
      ? `appraisal-summary-${appyear}.pdf`
      : 'appraisal-summary.pdf'

  return (
    <ReportPreviewConsole
      title="Appraisal Summary"
      onClose={onClose}
      status={status}
      loading={loading}
      onRefresh={() => void loadReport()}
      hasData={sectionsData.length > 0}
      getPrintHtml={() => buildPrintHtml(sectionsData, appyear)}
      printOptions={printOptions}
      defaultPdfName={defaultPdfName}
      emptyMessage="No summary pages to display."
      preview={sectionsData.map((section, index) => (
        <SummarySectionPage
          key={section.sectionId ?? section.sectionName}
          section={section}
          appyear={appyear}
          pageIndex={index + 1}
          pageCount={sectionsData.length}
        />
      ))}
      toolbar={
        <Card className="shrink-0 py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="grid gap-1">
              <Label>Appraisal Year</Label>
              <Select
                value={appyear != null ? String(appyear) : undefined}
                onValueChange={(value) => setAppyear(Number(value))}
                disabled={years.length === 0}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label>Unit</Label>
              <Select
                value={unitId || ALL_VALUE}
                onValueChange={(value) =>
                  setUnitId(value === ALL_VALUE ? '' : value)
                }
                disabled={unitLocked}
              >
                <SelectTrigger className="min-w-64">
                  <SelectValue placeholder="All units" />
                </SelectTrigger>
                <SelectContent>
                  {!unitLocked ? (
                    <SelectItem value={ALL_VALUE}>All units</SelectItem>
                  ) : null}
                  {units
                    .filter((unit) => unit.active || unit.id === unitId)
                    .map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unitName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label>Section</Label>
              <Select
                value={sectionId || ALL_VALUE}
                onValueChange={(value) =>
                  setSectionId(value === ALL_VALUE ? '' : value)
                }
                disabled={sectionLocked || (!unitId && sections.length === 0)}
              >
                <SelectTrigger className="min-w-48">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  {!sectionLocked ? (
                    <SelectItem value={ALL_VALUE}>All sections</SelectItem>
                  ) : null}
                  {sections
                    .filter(
                      (section) =>
                        section.active || String(section.id) === sectionId,
                    )
                    .map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.section ?? `Section #${section.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      }
    />
  )
}
