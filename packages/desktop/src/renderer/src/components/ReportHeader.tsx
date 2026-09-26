import { useState } from 'react'
import { LOGO_SRC } from '../lib/logo'

export const REPORT_COMPANY_NAME = 'CAMEROON DEVELOPMENT CORPORATION'

export type ReportHeaderProps = {
  department: string | null
  serviceName: string | null
  title: string
}

function CdcTileFallback() {
  return (
    <div
      className="grid size-14 shrink-0 grid-cols-2 gap-0.5"
      aria-hidden="true"
    >
      {['C', 'D', 'C', ''].map((letter, i) => (
        <span
          key={i}
          className={
            letter
              ? 'flex items-center justify-center border border-emerald-800 bg-emerald-700 text-[11px] font-bold leading-none text-white'
              : 'border border-emerald-800 bg-white'
          }
        >
          {letter}
        </span>
      ))}
    </div>
  )
}

function ReportLogo() {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <CdcTileFallback />
  }

  return (
    <img
      className="block size-14 object-contain"
      src={LOGO_SRC}
      alt={`${REPORT_COMPANY_NAME} logo`}
      onError={() => setHasError(true)}
    />
  )
}

export function ReportHeader({
  department,
  serviceName,
  title,
}: ReportHeaderProps) {
  return (
    <header className="grid grid-cols-[3.5rem_1fr] items-start gap-x-3 gap-y-1 border-b border-black pb-2 text-center text-black">
      <div className="row-span-3 flex items-start justify-center">
        <ReportLogo />
      </div>

      <div className="min-w-0">
        <p className="m-0 text-xs font-bold uppercase tracking-wide">
          {REPORT_COMPANY_NAME}
        </p>
        {department ? (
          <p className="m-0 mt-0.5 text-[11px] font-bold uppercase tracking-wide">
            {department}
          </p>
        ) : null}
        {serviceName ? (
          <p className="m-0 mt-0.5 text-[11px] font-bold uppercase tracking-wide">
            {serviceName}
          </p>
        ) : null}
      </div>

      <h1 className="m-0 mt-1 text-[13px] font-bold uppercase tracking-wide underline">
        {title}
      </h1>
    </header>
  )
}

/** Print-safe header markup mirroring ReportHeader (logo as data URI or tile fallback). */
export function buildReportHeaderHtml(options: {
  department: string | null
  serviceName: string | null
  title: string
  logoDataUri?: string | null
  escapeHtml: (value: string) => string
}): string {
  const { department, serviceName, title, logoDataUri, escapeHtml } = options
  const logo =
    logoDataUri && logoDataUri.length > 0
      ? `<img class="rh-logo" src="${logoDataUri}" alt="" />`
      : `<div class="rh-tiles" aria-hidden="true">
          <span>C</span><span>D</span><span>C</span><span class="empty"></span>
        </div>`

  return `
    <header class="rh">
      <div class="rh-logo-wrap">${logo}</div>
      <div class="rh-company">
        <p class="rh-company-name">${escapeHtml(REPORT_COMPANY_NAME)}</p>
        ${
          department
            ? `<p class="rh-line">${escapeHtml(department)}</p>`
            : ''
        }
        ${
          serviceName
            ? `<p class="rh-line">${escapeHtml(serviceName)}</p>`
            : ''
        }
      </div>
      <h1 class="rh-title">${escapeHtml(title)}</h1>
    </header>`
}

/** Minimal styles for Electron print HTML (no Tailwind in the print window). */
export const REPORT_HEADER_PRINT_CSS = `
.rh {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 4px 10px;
  align-items: start;
  border-bottom: 1px solid #000;
  padding-bottom: 6px;
  text-align: center;
}
.rh-logo-wrap { grid-row: 1 / span 3; }
.rh-logo { width: 52px; height: 52px; object-fit: contain; display: block; }
.rh-tiles {
  width: 52px; height: 52px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;
}
.rh-tiles span {
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #065f46; background: #047857; color: #fff;
  font-size: 11pt; font-weight: 700;
}
.rh-tiles span.empty { background: #fff; color: transparent; }
.rh-company-name, .rh-line {
  margin: 0; font-weight: 700; text-transform: uppercase;
}
.rh-company-name { font-size: 12pt; }
.rh-line { font-size: 11pt; margin-top: 2px; }
.rh-title {
  margin: 4px 0 0; font-size: 13pt; font-weight: 700;
  text-transform: uppercase; text-decoration: underline;
}
`
