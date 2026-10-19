import { Eye, RefreshCw, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LetterPdfOverlay } from './LetterPdfOverlay'

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
  const [previewOpen, setPreviewOpen] = useState(false)
  const landscape = printOptions?.landscape === true
  const canPreview = hasData && printHtml.trim().length > 0

  // Auto-open when a report finishes loading with data; close when data goes away.
  useEffect(() => {
    if (loading) return
    if (canPreview) {
      setPreviewOpen(true)
    } else {
      setPreviewOpen(false)
    }
  }, [loading, canPreview, printHtml])

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
              disabled={loading || refreshDisabled}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={loading || !canPreview}
          >
            <Eye className="size-4" />
            Preview
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>

      {toolbar}

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {alerts}

      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : !canPreview ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Report ready. Open Preview for the full-window print view.
          </p>
        )}
      </div>

      {previewOpen && canPreview ? (
        <LetterPdfOverlay
          html={printHtml}
          title={title}
          landscape={landscape}
          defaultPdfName={defaultPdfName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  )
}
