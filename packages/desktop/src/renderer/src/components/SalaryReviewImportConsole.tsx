import type { SalaryReviewImportResult } from '@perf-appraisal-app/shared'
import { FileSpreadsheet, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import {
  parseSalaryReviewExcel,
  type ParsedSalaryReviewExcel,
} from '../lib/parse-salary-review-excel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

type SalaryReviewImportConsoleProps = {
  onClose: () => void
}

const CHUNK = 40

export function SalaryReviewImportConsole({
  onClose,
}: SalaryReviewImportConsoleProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedSalaryReviewExcel | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [result, setResult] = useState<SalaryReviewImportResult | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setParsed(null)
    setResult(null)
    setStatus(null)
    setProgress(0)
    setLoading(true)
    try {
      const next = await parseSalaryReviewExcel(file)
      setParsed(next)
      if (next.rows.length === 0) {
        setStatus(
          next.errors.length > 0
            ? `No valid rows. ${next.errors.length} row(s) skipped.`
            : 'No data rows found in the first sheet.',
        )
      } else {
        setStatus(
          `Ready to import ${next.rows.length} row(s)` +
            (next.years.length
              ? ` for year(s) ${next.years.join(', ')}`
              : '') +
            (next.errors.length
              ? `. ${next.errors.length} row(s) will be skipped.`
              : '.'),
        )
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    setLoading(true)
    setProgress(0)
    setResult(null)
    setStatus('Importing…')
    const totals: SalaryReviewImportResult = {
      inserted: 0,
      replaced: 0,
      skipped: parsed.errors.length,
      errors: [...parsed.errors],
    }
    try {
      const client = await createApiClient()
      const total = parsed.rows.length
      for (let i = 0; i < parsed.rows.length; i += CHUNK) {
        const chunk = parsed.rows.slice(i, i + CHUNK)
        const res = await client.appraisals['salary-review'].import.$post({
          json: { rows: chunk },
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(body?.error ?? `Import failed (${res.status})`)
        }
        const batch = await res.json()
        totals.inserted += batch.inserted
        totals.replaced += batch.replaced
        totals.skipped += batch.skipped
        totals.errors.push(
          ...batch.errors.map((item) => ({
            row: item.row + i,
            message: item.message,
          })),
        )
        const current = Math.min(i + chunk.length, total)
        setProgress(Math.round((current / total) * 100))
        setStatus(`Importing: ${current} of ${total}`)
      }
      setResult(totals)
      setProgress(100)
      setStatus(
        `Imported ${totals.inserted} record(s)` +
          (totals.replaced > 0 ? ` (${totals.replaced} replaced)` : '') +
          (totals.skipped > 0 ? `, ${totals.skipped} skipped` : '') +
          '.',
      )
    } catch (err) {
      setProgress(0)
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const previewErrors = (parsed?.errors ?? []).slice(0, 12)

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">
        Import Historic Appraisals
      </h2>

      <Card className="shrink-0 py-3">
        <CardContent className="grid gap-3 px-3">
          <p className="text-sm text-muted-foreground">
            Import an Access export of tbl_salaryreview (.xlsx or .xls). Existing
            rows with the same matric and year are replaced. Import prior years
            only — posting a year from Appraisal Console still rebuilds that
            year&apos;s salary review.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="size-4" />
              Choose Excel file
            </Button>
            <span className="text-sm text-muted-foreground">
              {fileName ?? 'No file selected'}
            </span>
          </div>
        </CardContent>
      </Card>

      {parsed ? (
        <Card className="min-h-0 flex-1 overflow-y-auto py-3">
          <CardContent className="grid gap-3 px-3">
            <div className="grid gap-1 text-sm">
              <div>
                <span className="font-semibold">Valid rows:</span> {parsed.rows.length}
              </div>
              <div>
                <span className="font-semibold">Years:</span>{' '}
                {parsed.years.length ? parsed.years.join(', ') : '—'}
              </div>
              <div>
                <span className="font-semibold">Skipped:</span> {parsed.errors.length}
              </div>
            </div>
            {previewErrors.length > 0 ? (
              <div className="grid gap-1">
                <Label>Skip details</Label>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {previewErrors.map((item) => (
                    <li key={`${item.row}-${item.message}`}>
                      Row {item.row}: {item.message}
                    </li>
                  ))}
                  {parsed.errors.length > previewErrors.length ? (
                    <li>
                      …and {parsed.errors.length - previewErrors.length} more
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {result ? (
              <div className="text-sm">
                Inserted {result.inserted}, replaced {result.replaced}, skipped{' '}
                {result.skipped}.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-3 rounded-md border bg-background px-3 py-2">
        <span className="text-sm font-semibold">Progress</span>
        <Progress value={progress} className="flex-1" />
      </div>

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <aside className="flex shrink-0 flex-wrap gap-2">
        <ActionButton
          icon={<FileSpreadsheet size={16} />}
          label="Import"
          onClick={() => void handleImport()}
          disabled={loading || !parsed || parsed.rows.length === 0}
        />
        <ActionButton
          icon={<X size={16} />}
          label="Close"
          onClick={onClose}
          disabled={loading}
        />
      </aside>
    </section>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-auto min-h-12 items-start justify-start gap-2 whitespace-normal px-3 py-2.5 text-left"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 leading-snug break-words">{label}</span>
    </Button>
  )
}
