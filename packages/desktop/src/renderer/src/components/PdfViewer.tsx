import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'

// The current pdf.js build calls Map/Uint8Array methods that Electron 35 does
// not have. The legacy build includes those methods and must be paired with
// the legacy worker.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
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

function isCancelledRender(err: unknown): boolean {
  return err instanceof Error && err.name === 'RenderingCancelledException'
}

export function PdfViewer({
  data,
  loading = false,
  error = null,
  className,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [docError, setDocError] = useState<string | null>(null)

  // Copy into a Blob so pdf.js cannot detach the ArrayBuffer held in state.
  const file = useMemo(() => {
    if (!data || data.byteLength === 0) return null
    try {
      const copy = new Uint8Array(data.byteLength)
      copy.set(data)
      return new Blob([copy], { type: 'application/pdf' })
    } catch {
      return null
    }
  }, [data])

  useEffect(() => {
    setNumPages(0)
    setPageNumber(1)
    setDocError(null)
  }, [file])

  useEffect(() => {
    if (!file || loading || error) return
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    void (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        task = getDocument({
          data: bytes,
          isOffscreenCanvasSupported: false,
        })
        const pdf = await task.promise
        if (cancelled) return
        pdfRef.current = pdf
        setNumPages(pdf.numPages)
      } catch (err) {
        if (cancelled || isCancelledRender(err)) return
        setDocError(err instanceof Error ? err.message : 'Failed to load PDF')
      }
    })()
    return () => {
      cancelled = true
      pdfRef.current = null
      void task?.destroy()
    }
  }, [file, loading, error])

  useEffect(() => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || numPages === 0) return
    let cancelled = false
    let renderTask: RenderTask | null = null
    const safePage = Math.min(Math.max(pageNumber, 1), numPages)
    void (async () => {
      try {
        const page = await pdf.getPage(safePage)
        if (cancelled) return
        const pixelRatio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: scale * pixelRatio })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`
        renderTask = page.render({ canvas, viewport })
        await renderTask.promise
      } catch (err) {
        if (cancelled || isCancelledRender(err)) return
        setDocError(err instanceof Error ? err.message : 'Failed to draw the PDF page')
      }
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [numPages, pageNumber, scale])

  const displayError = error ?? docError
  const showCanvas = Boolean(file) && !loading && !displayError && numPages > 0

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
            {!showCanvas ? (
              <p className="text-sm text-muted-foreground">Loading PDF…</p>
            ) : null}
            <canvas
              ref={canvasRef}
              className={showCanvas ? 'block bg-white shadow-sm' : 'hidden'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
