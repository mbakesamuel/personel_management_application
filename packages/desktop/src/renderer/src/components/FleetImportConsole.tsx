import type { FleetImportResult } from '@personel-management-app/shared'
import { FileSpreadsheet, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import {
  parseFleetExcel,
  type FleetImportParseError,
  type ParsedFleetExcel,
} from '../lib/parse-fleet-excel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

type FleetImportConsoleProps = {
  onClose: () => void
}

export function FleetImportConsole({ onClose }: FleetImportConsoleProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedFleetExcel | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [result, setResult] = useState<FleetImportResult | null>(null)
  const [shownErrors, setShownErrors] = useState<FleetImportParseError[]>([])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    setParsed(null)
    setResult(null)
    setShownErrors([])
    setStatus(null)
    setProgress(0)
    setLoading(true)
    try {
      const next = await parseFleetExcel(file)
      setParsed(next)
      setShownErrors(next.errors.slice(0, 12))
      const ready = next.registrations.length + next.details.length
      if (ready === 0) {
        setStatus(
          next.errors.length > 0
            ? `No valid rows. ${next.errors.length} row(s) skipped.`
            : 'No data rows found.',
        )
      } else {
        setStatus(
          `Ready to import ${next.registrations.length} registration(s) and ${next.details.length} amount(s)` +
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

  async function handleBaseline() {
    setLoading(true)
    setProgress(15)
    setStatus('Recording the current fleet as already communicated…')
    try {
      const client = await createApiClient()
      const res = await client.communication.fleet.baseline.$post()
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Baseline failed (${res.status})`)
      }
      const result = await res.json()
      setProgress(100)
      setStatus(
        result.linesInserted === 0
          ? 'Every registration and operator pair already has a snapshot. Allowance changes is unchanged.'
          : `Recorded ${result.linesInserted} line(s) on ${result.pairsBaselined} registration and operator pair(s) as already communicated.`,
      )
    } catch (err) {
      setProgress(0)
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!parsed) return
    if (parsed.registrations.length + parsed.details.length === 0) return
    if (parsed.registrations.length > 5000 || parsed.details.length > 20000) {
      setStatus(
        'This workbook is too large. Import at most 5,000 registrations and 20,000 amounts.',
      )
      return
    }
    setLoading(true)
    setProgress(15)
    setResult(null)
    setStatus('Importing…')
    try {
      const client = await createApiClient()
      const res = await client.communication.fleet.import.$post({
        json: {
          registrations: parsed.registrations,
          details: parsed.details,
        },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Import failed (${res.status})`)
      }
      const batch = await res.json()
      setResult(batch)
      setShownErrors(
        [...parsed.errors, ...batch.errors].slice(0, 12),
      )
      setProgress(100)
      const skipped = parsed.errors.length + batch.skipped
      setStatus(
        `Imported ${batch.registrationsInserted} registration(s) and ${batch.detailsInserted} amount(s)` +
          (skipped > 0 ? `, ${skipped} skipped` : '') +
          '.',
      )
    } catch (err) {
      setProgress(0)
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const previewErrors = shownErrors
  const errorTotal = result
    ? (parsed?.errors.length ?? 0) + result.errors.length
    : (parsed?.errors.length ?? 0)
  const canImport =
    !!parsed &&
    parsed.registrations.length + parsed.details.length > 0 &&
    !loading

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Import fleet</h2>

      <Card className="shrink-0 py-3">
        <CardContent className="grid gap-3 px-3">
          <p className="text-sm text-muted-foreground">
            Import a workbook with sheets named fleet_registration and
            fleet_reg_details. Operator, account, and phone belong on the
            detail sheet. If a detail row omits them, the matching registration
            row is used. Existing ids are left unchanged. Source ids are kept
            so amounts and transfers stay linked. Imported amounts are recorded
            as already communicated, so they do not appear on Allowance changes.
            Use the baseline action once for fleet data that is already in the
            database. Later edits still appear. Lines that already have a memo
            are left alone.
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
                <span className="font-semibold">Registrations:</span>{' '}
                {parsed.registrations.length}
              </div>
              <div>
                <span className="font-semibold">Amounts:</span>{' '}
                {parsed.details.length}
              </div>
              <div>
                <span className="font-semibold">Skipped:</span>{' '}
                {result
                  ? parsed.errors.length + result.skipped
                  : parsed.errors.length}
              </div>
            </div>
            {previewErrors.length > 0 ? (
              <div className="grid gap-1">
                <Label>Skip details</Label>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {previewErrors.map((item) => (
                    <li key={`${item.sheet}-${item.row}-${item.message}`}>
                      {item.sheet} row {item.row}: {item.message}
                    </li>
                  ))}
                  {errorTotal > previewErrors.length ? (
                    <li>…and {errorTotal - previewErrors.length} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {result ? (
              <div className="text-sm">
                Inserted {result.registrationsInserted} registration(s) and{' '}
                {result.detailsInserted} amount(s).
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
          disabled={!canImport}
        />
        <ActionButton
          icon={<FileSpreadsheet size={16} />}
          label="Mark current fleet as already sent"
          onClick={() => void handleBaseline()}
          disabled={loading}
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
