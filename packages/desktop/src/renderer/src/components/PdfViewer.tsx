import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.15

type PdfViewerProps = {
  data: Uint8Array | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function PdfViewer({
  data,
  loading = false,
  error = null,
  className,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [docError, setDocError] = useState<string | null>(null)

  // Blob + copy avoids pdf.js detaching the ArrayBuffer held in React state,
  // and survives IPC TypedArray edge cases better than { data: Uint8Array }.
  const file = useMemo(() => {
    if (!data || data.byteLength === 0) return null
    return new Blob([data.slice()], { type: 'application/pdf' })
  }, [data])

  useEffect(() => {
    setNumPages(0)
    setPageNumber(1)
    setDocError(null)
  }, [file])

  const displayError = error ?? docError

  return (
    <div
      className={
        className ??
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-muted/30'
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <span className="min-w-24 px-2 text-center text-sm text-muted-foreground">
            {file && numPages > 0
              ? `Page ${pageNumber} / ${numPages}`
              : 'No pages'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || pageNumber >= numPages}
            onClick={() =>
              setPageNumber((p) =>
                numPages > 0 ? Math.min(numPages, p + 1) : p,
              )
            }
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || scale <= MIN_SCALE}
            onClick={() =>
              setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))
            }
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="min-w-14 text-center text-sm text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!file || scale >= MAX_SCALE}
            onClick={() =>
              setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))
            }
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Generating PDF preview…</p>
        ) : displayError ? (
          <p className="text-sm text-destructive">{displayError}</p>
        ) : !file ? (
          <p className="text-sm text-muted-foreground">
            No PDF preview. Adjust filters and click Preview.
          </p>
        ) : (
          <div className="flex justify-center">
            <Document
              file={file}
              loading={
                <p className="text-sm text-muted-foreground">Loading PDF…</p>
              }
              onLoadSuccess={({ numPages: pages }) => {
                setNumPages(pages)
                setPageNumber(1)
                setDocError(null)
              }}
              onLoadError={(err) => {
                setDocError(err.message || 'Failed to load PDF')
              }}
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  )
}
