import { Download, Eye, Printer, RefreshCw, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { htmlToPdfBytes } from '../lib/html-to-pdf'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type ReportPreviewConsoleProps = {
  title: string
  onClose: () => void
  toolbar: ReactNode
  /** On-screen report content (React pages). */
  preview: ReactNode
  status: string | null
  alerts?: ReactNode
  loading?: boolean
  onRefresh?: () => void
  /** True when there is something to print/save. */
  hasData: boolean
  /** Build printable HTML on demand (Print / Save PDF). */
  getPrintHtml: () => string
  printOptions?: { landscape?: boolean }
  defaultPdfName: string
  refreshDisabled?: boolean
  emptyMessage?: string
}

export function ReportPreviewConsole({
  title,
  onClose,
  toolbar,
  preview,
  status,
  alerts,
  loading = false,
  onRefresh,
  hasData,
  getPrintHtml,
  printOptions,
  defaultPdfName,
  refreshDisabled = false,
  emptyMessage = 'No report data for the current filters.',
}: ReportPreviewConsoleProps) {
  const [printing, setPrinting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const landscape = printOptions?.landscape === true

  function handlePreview() {
    if (!hasData) {
      setActionStatus('Nothing to preview.')
      return
    }
    setActionStatus(null)
    onRefresh?.()
  }

  async function handlePrint() {
    if (!hasData) {
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
      const html = getPrintHtml()
      await window.api.printHtml(html, { landscape })
      setActionStatus(null)
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setPrinting(false)
    }
  }

  async function handleSavePdf() {
    if (!hasData) {
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
      const html = getPrintHtml()
      const data = await htmlToPdfBytes(html, { landscape })
      const bytes =
        data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)
      if (bytes.byteLength === 0) {
        throw new Error('PDF generation returned empty output')
      }
      const result = await window.api.savePdf({
        defaultName: defaultPdfName,
        data: bytes,
      })
      if ('cancelled' in result && result.cancelled) {
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

  const busy = loading || printing || saving
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
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={busy || !hasData}
          >
            <Eye className="size-4" />
            Preview
          </Button>
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
            disabled={busy || !hasData}
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

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : hasData ? (
          preview
        ) : (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </section>
  )
}
