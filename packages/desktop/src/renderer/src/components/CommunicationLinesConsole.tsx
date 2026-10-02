import type {
  CommunicationLine,
  CommunicationOperator,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  buildCommunicationLinesExcel,
  communicationLineAmount,
  communicationLinePlace,
  communicationLinesExcelName,
} from '../lib/export-communication-lines-excel'
import { buildCommunicationLinesPrintHtml } from '../lib/print-communication-lines'
import { LetterPdfOverlay } from './LetterPdfOverlay'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CommunicationLinesConsoleProps = {
  onClose: () => void
}

const ALL_OPERATORS = '__all__'
const ALL_PLACES = '__all__'

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function CommunicationLinesConsole({ onClose }: CommunicationLinesConsoleProps) {
  const [lines, setLines] = useState<CommunicationLine[]>([])
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [operatorId, setOperatorId] = useState(ALL_OPERATORS)
  const [place, setPlace] = useState(ALL_PLACES)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [linesRes, operatorsRes] = await Promise.all([
        client.communication.lines.$get(),
        client.communication.operators.$get(),
      ])
      if (!linesRes.ok) throw new Error(await readError(linesRes, 'Failed to load lines'))
      if (!operatorsRes.ok) {
        throw new Error(await readError(operatorsRes, 'Failed to load operators'))
      }
      setLines((await linesRes.json()) as CommunicationLine[])
      setOperators((await operatorsRes.json()) as CommunicationOperator[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load lines')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const operatorLines = useMemo(() => {
    if (operatorId === ALL_OPERATORS) return lines
    return lines.filter((row) => String(row.operatorId) === operatorId)
  }, [lines, operatorId])

  const places = useMemo(() => {
    const names = new Set<string>()
    for (const row of operatorLines) {
      const label = communicationLinePlace(row)
      if (label) names.add(label)
    }
    return [...names].sort((left, right) => left.localeCompare(right))
  }, [operatorLines])

  useEffect(() => {
    if (place !== ALL_PLACES && !places.includes(place)) {
      setPlace(ALL_PLACES)
    }
  }, [place, places])

  const visible = useMemo(() => {
    if (place === ALL_PLACES) return operatorLines
    return operatorLines.filter((row) => communicationLinePlace(row) === place)
  }, [operatorLines, place])

  const selectedOperator = operators.find((row) => String(row.id) === operatorId)
  const selectedPlace = place === ALL_PLACES ? undefined : place

  function openPrint() {
    if (visible.length === 0) {
      setStatus('Nothing to print.')
      return
    }
    setStatus(null)
    setPreviewHtml(
      buildCommunicationLinesPrintHtml(
        visible,
        selectedOperator?.name,
        selectedPlace,
      ),
    )
  }

  async function exportExcel() {
    if (visible.length === 0) {
      setStatus('No records to export.')
      return
    }
    setExporting(true)
    setStatus(null)
    try {
      if (typeof window.api?.saveFile !== 'function') {
        throw new Error('Save file is not available in this environment.')
      }
      const result = await window.api.saveFile({
        defaultName: communicationLinesExcelName(
          selectedOperator?.name,
          selectedPlace,
        ),
        data: buildCommunicationLinesExcel(visible),
      })
      if ('ok' in result && result.ok) {
        const name = result.path.replace(/^.*[/\\]/, '')
        setStatus(`Exported ${visible.length} record(s) to ${name}.`)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Communication lines</h1>
          <p className="text-sm text-muted-foreground">
            Open lines with the latest position and unit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={openPrint}
            disabled={exporting || loading || visible.length === 0}
          >
            Print
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void exportExcel()}
            disabled={exporting || loading || visible.length === 0}
          >
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <Select value={operatorId} onValueChange={setOperatorId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="All operators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OPERATORS}>All operators</SelectItem>
            {operators
              .filter((row) => row.isActive)
              .map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {row.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={place} onValueChange={setPlace}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="All groups/services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLACES}>All groups/services</SelectItem>
            {places.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status ? <p className="mb-3 text-sm text-muted-foreground">{status}</p> : null}

      {loading && lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open lines.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Group/Service</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.matricule}</TableCell>
                <TableCell>{row.employeeName}</TableCell>
                <TableCell>{row.position ?? '—'}</TableCell>
                <TableCell>{row.phoneNumber}</TableCell>
                <TableCell>{row.operatorName}</TableCell>
                <TableCell>{communicationLineAmount(row)}</TableCell>
                <TableCell>{communicationLinePlace(row) || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
    {previewHtml ? (
      <LetterPdfOverlay
        html={previewHtml}
        title="Communication lines"
        landscape
        onClose={() => setPreviewHtml(null)}
      />
    ) : null}
    </div>
  )
}
