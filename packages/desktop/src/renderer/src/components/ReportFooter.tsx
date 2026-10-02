import type { ReactNode } from 'react'

export type ReportFooterProps = {
  /** Role shown under the printed name. */
  label: string
  name?: string | null
  children?: ReactNode
}

export function ReportFooter({
  label,
  name = null,
  children,
}: ReportFooterProps) {
  return (
    <footer className="mt-7 flex justify-center text-center text-black">
      <div className="min-w-48">
        <div className="h-16" aria-hidden="true" />       
        {name ? (
          <p className="m-0 text-xs font-bold uppercase tracking-wide">{name}</p>
        ) : null}
        <p className="m-0 text-[11px] font-bold uppercase tracking-wide">
          {label}
        </p>
        {children}
      </div>
    </footer>
  )
}

/** Print-safe signature markup mirroring ReportFooter. */
export function buildReportFooterHtml(options: {
  name?: string | null
  label?: string | null
  escapeHtml: (value: string) => string
}): string {
  const { name, label, escapeHtml } = options
  const printedName = name?.trim() ?? ''
  const printedLabel = label?.trim() ?? ''
  if (!printedName && !printedLabel) return ''

  return `
    <footer class="rf">
      <div class="rf-signature">
        <div class="rf-space" aria-hidden="true"></div>
        ${printedName ? `<p class="rf-name">${escapeHtml(printedName)}</p>` : ''}
        ${printedLabel ? `<p class="rf-label">${escapeHtml(printedLabel)}</p>` : ''}
      </div>
    </footer>`
}

/** Minimal styles for Electron print HTML (no Tailwind in the print window). */
export const REPORT_FOOTER_PRINT_CSS = `
.rf {
  margin-top: 28px;
  display: flex;
  justify-content: center;
  text-align: center;
}
.rf-signature { min-width: 12rem; }
.rf-space { height: 64px; }
.rf-name, .rf-label {
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}
.rf-name { font-size: 12pt; }
.rf-label { font-size: 11pt; }
`
