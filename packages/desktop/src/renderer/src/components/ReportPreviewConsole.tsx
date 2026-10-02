import { Download, Printer, RefreshCw, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { htmlToPdfBytes } from '../lib/html-to-pdf'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PdfViewer } from './PdfViewer'
import { ViewErrorBoundary } from './ViewErrorBoundary'

type ReportPreviewConsoleProps = {
  title: string
  onClose: () => void
  toolbar: ReactNode
  status: string | null
  alerts?: ReactNode
  loading?: boolean
  onRefresh?: () => void
  /** True when there is something to print/save. */
  hasData: boolean
  /** Printable HTML for the PDF preview, print, and save. */
  printHtml: string
  printOptions?: { landscape?: boolean }
  defaultPdfName: string
  refreshDisabled?: boolean
  emptyMessage?: string
}

function ownedPdfBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

export function ReportPreviewConsole({
  title,
  onClose,
  toolbar,
  status,
  alerts,
  loading = false,
  onRefresh,
  hasData,
  printHtml,
  printOptions,
  defaultPdfName,
  refreshDisabled = false,
  emptyMessage = 'No report data for the current filters.',
}: ReportPreviewConsoleProps) {
  const [printing, setPrinting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const landscape = printOptions?.landscape === true

  useEffect(() => {
    if (loading || !hasData || printHtml.trim().length === 0) {
      setPdfBytes(null)
      setPdfError(null)
      setPdfLoading(false)
      return
    }
    let cancelled = false
    setPdfLoading(true)
    setPdfError(null)
    setPdfBytes(null)
    void htmlToPdfBytes(printHtml, { landscape })
      .then((bytes) => {
        if (cancelled) return
        const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
        if (source.byteLength < 5) throw new Error('PDF generation returned empty output')
        const next = ownedPdfBytes(source)
        const header = String.fromCharCode(next[0]!, next[1]!, next[2]!, next[3]!, next[4]!)
        if (header !== '%PDF-') throw new Error('PDF generation returned invalid output')
        setPdfBytes(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPdfBytes(null)
          setPdfError(err instanceof Error ? err.message : 'Could not open the report')
        }
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasData, landscape, loading, printHtml])

  async function handlePrint() {
    if (!hasData || printHtml.trim().length === 0) {
      setActionStatus('Nothing to print.')
      return
    }
    if (typeof window.api?.printHtml !== 'function') {
      setActionStatus(
        'Print is unavailable. Restart the desktop app and try again.',
      )
      return
    }
    setPrinting(true)
    setActionStatus('Opening print dialog…')
    try {
      await window.api.printHtml(printHtml, { landscape })
      setActionStatus(null)
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setPrinting(false)
    }
  }

  async function handleSavePdf() {
    if (!pdfBytes || pdfBytes.byteLength === 0) {
      setActionStatus('Nothing to save.')
      return
    }
    if (typeof window.api?.savePdf !== 'function') {
      setActionStatus(
        'Save PDF is unavailable. Restart the desktop app and try again.',
      )
      return
    }
    setSaving(true)
    setActionStatus('Saving PDF…')
    try {
      const result = await window.api.savePdf({
        defaultName: defaultPdfName,
        data: ownedPdfBytes(pdfBytes),
      })
      if (!('path' in result)) {
        setActionStatus(null)
        return
      }
      setActionStatus(`Saved PDF to ${result.path}`)
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || printing || saving || pdfLoading
  const displayStatus = actionStatus ?? status

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={busy || refreshDisabled}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void handlePrint()}
            disabled={busy || !hasData}
          >
            <Printer className="size-4" />
            {printing ? 'Printing…' : 'Print'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSavePdf()}
            disabled={busy || !pdfBytes}
          >
            <Download className="size-4" />
            {saving ? 'Saving…' : 'Save PDF'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>

      {toolbar}

      {displayStatus ? (
        <Alert className="shrink-0">
          <AlertDescription>{displayStatus}</AlertDescription>
        </Alert>
      ) : null}

      {alerts}

      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ViewErrorBoundary label="The report preview crashed">
            <PdfViewer data={pdfBytes} loading={pdfLoading} error={pdfError} />
          </ViewErrorBoundary>
        )}
      </div>
    </section>
  )
}
