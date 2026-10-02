import { Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { htmlToPdfBytes } from '../lib/html-to-pdf'
import { PdfViewer } from './PdfViewer'
import { ViewErrorBoundary } from './ViewErrorBoundary'
import { Button } from '@/components/ui/button'

type LetterPdfOverlayProps = {
  html: string
  title: string
  landscape?: boolean
  onClose: () => void
}

export function LetterPdfOverlay({
  html,
  title,
  landscape = false,
  onClose,
}: LetterPdfOverlayProps) {
  const [data, setData] = useState<Uint8Array | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    void htmlToPdfBytes(html, landscape ? { landscape: true } : undefined)
      .then((bytes) => {
        if (cancelled) return
        const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
        if (source.byteLength < 5) throw new Error('PDF generation returned empty output')
        const next = new Uint8Array(source.byteLength)
        next.set(source)
        const header = String.fromCharCode(next[0]!, next[1]!, next[2]!, next[3]!, next[4]!)
        if (header !== '%PDF-') throw new Error('PDF generation returned invalid output')
        setData(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Could not open the letter')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [html, landscape])

  async function printLetter() {
    setPrintError(null)
    if (typeof window.api?.printHtml !== 'function') {
      setPrintError('Print is unavailable. Restart the desktop app and try again.')
      return
    }
    setPrinting(true)
    try {
      await window.api.printHtml(
        html,
        landscape ? { landscape: true } : undefined,
      )
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <h2 className="m-0 truncate text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={printing || loading || !data}
            onClick={() => void printLetter()}
          >
            <Printer className="size-4" />
            {printing ? 'Printing…' : 'Print'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>
      {printError ? (
        <p className="mb-2 shrink-0 text-sm text-destructive">{printError}</p>
      ) : null}
      <ViewErrorBoundary label="The letter preview crashed">
        <PdfViewer data={data} loading={loading} error={error} />
      </ViewErrorBoundary>
    </div>
  )
}
