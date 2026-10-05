import {
  type CommunicationBatchReport,
  type CommunicationMemoDraftRow,
  type CommunicationOperator,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApiClient } from '../api/client'
import { LetterPdfOverlay } from './LetterPdfOverlay'
import { batchReportDocument } from './OperatorMemo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export type CorrespondenceFocus = {
  operatorIds: number[]
  fleetRegistrationId: number
  endDate: string
}

type AllowanceChangesConsoleProps = {
  onClose: () => void
  focus?: CorrespondenceFocus | null
}

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatAmount(value: number | null) {
  if (value == null) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function actionLabel(action: CommunicationMemoDraftRow['action']) {
  if (action === 'CREATION') return 'Addition'
  if (action === 'REMOVAL') return 'Removal'
  return 'Modification'
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function AllowanceChangesConsole({
  onClose,
  focus = null,
}: AllowanceChangesConsoleProps) {
  const initialOperatorId = focus?.operatorIds[0]
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [rows, setRows] = useState<CommunicationMemoDraftRow[]>([])
  const [operatorId, setOperatorId] = useState(
    initialOperatorId == null ? '' : String(initialOperatorId),
  )
  const [effectiveDate, setEffectiveDate] = useState(today())
  const [endDate, setEndDate] = useState(focus?.endDate ?? today())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const appliedSelection = useRef<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<'preview' | 'save' | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [letter, setLetter] = useState<{ html: string; title: string } | null>(null)

  const loadOperators = useCallback(async () => {
    const client = await createApiClient()
    const operatorsRes = await client.communication.operators.$get()
    if (!operatorsRes.ok) throw new Error(await readError(operatorsRes, 'Failed to load operators'))
    setOperators((await operatorsRes.json()) as CommunicationOperator[])
  }, [])

  const loadDraft = useCallback(async (nextOperatorId: string) => {
    if (!nextOperatorId) {
      setRows([])
      return
    }
    const client = await createApiClient()
    const res = await client.communication['memo-draft'].$get({
      query: { operatorId: nextOperatorId },
    })
    if (!res.ok) throw new Error(await readError(res, 'Failed to load changes'))
    setRows((await res.json()) as CommunicationMemoDraftRow[])
  }, [])

  useEffect(() => {
    void loadOperators().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load')
    })
  }, [loadOperators])

  useEffect(() => {
    void loadDraft(operatorId).catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load changes')
    })
  }, [loadDraft, operatorId])

  useEffect(() => {
    if (!focus) return
    if (appliedSelection.current === focus.fleetRegistrationId) return
    if (!rows.some((row) => row.fleetRegistrationId === focus.fleetRegistrationId)) return
    setSelected(new Set([focus.fleetRegistrationId]))
    appliedSelection.current = focus.fleetRegistrationId
  }, [focus, rows])

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [row.employeeName, row.matricule, row.phoneNumber, row.accountNo ?? '', actionLabel(row.action)]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [rows, search])

  function chooseOperator(value: string) {
    setOperatorId(value)
    setSelected(new Set())
    setSearch('')
    setStatus(null)
  }

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function memoPayload() {
    return {
      operatorId: Number(operatorId),
      effectiveDate,
      endDate,
      fleetRegistrationIds: [...selected],
    }
  }

  function readyToDraft(): boolean {
    if (!operatorId) {
      setStatus('Choose an operator')
      return false
    }
    if (selected.size === 0) {
      setStatus('Check at least one line')
      return false
    }
    return true
  }

  async function previewMemo() {
    setStatus(null)
    if (!readyToDraft()) return
    setLoading('preview')
    try {
      const client = await createApiClient()
      const res = await client.communication.batches.preview.$post({
        json: memoPayload(),
      })
      if (!res.ok) throw new Error(await readError(res, 'Preview failed'))
      setLetter(batchReportDocument((await res.json()) as CommunicationBatchReport))
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(null)
    }
  }

  async function saveMemo() {
    setStatus(null)
    if (!readyToDraft()) return
    setLoading('save')
    try {
      const client = await createApiClient()
      const res = await client.communication.batches.$post({
        json: memoPayload(),
      })
      if (!res.ok) throw new Error(await readError(res, 'Memo failed'))
      setLetter(batchReportDocument((await res.json()) as CommunicationBatchReport))
      setSelected(new Set())
      await loadDraft(operatorId)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Memo failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
        <div className="no-print mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Memo Management</h1>
            <p className="text-sm text-muted-foreground">
              Draft a memo from lines that changed since the last memo. Saving does not change the fleet.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>

        {status ? <p className="no-print mb-3 text-sm text-destructive">{status}</p> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Operator
            <Select value={operatorId || undefined} onValueChange={chooseOperator}>
              <SelectTrigger>
                <SelectValue placeholder="Choose operator" />
              </SelectTrigger>
              <SelectContent>
                {operators
                  .filter((row) => row.isActive)
                  .map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Amount effective date
            <Input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Removal end date
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selected.size} line{selected.size === 1 ? '' : 's'} marked
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, matricule, or phone…"
              className="w-64"
              disabled={!operatorId}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void previewMemo()}
              disabled={loading != null || !operatorId || selected.size === 0}
            >
              {loading === 'preview' ? 'Working…' : 'Preview'}
            </Button>
            <Button type="button" onClick={() => void saveMemo()} disabled={loading != null || !operatorId}>
              {loading === 'save' ? 'Saving…' : 'Save memo'}
            </Button>
          </div>
        </div>

        <section className="no-print mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Employee</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Airtime</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.fleetRegistrationId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(row.fleetRegistrationId)}
                      onChange={(event) => toggle(row.fleetRegistrationId, event.target.checked)}
                      aria-label={`Include ${row.employeeName}`}
                    />
                  </TableCell>
                  <TableCell>
                    {row.employeeName}
                    <span className="block text-xs text-muted-foreground">{row.matricule}</span>
                  </TableCell>
                  <TableCell>{actionLabel(row.action)}</TableCell>
                  <TableCell>{row.phoneNumber || '—'}</TableCell>
                  <TableCell>{row.accountNo || '—'}</TableCell>
                  <TableCell>
                    {row.action === 'CREATION' ? (
                      formatAmount(row.airtime)
                    ) : (
                      <span>
                        {formatAmount(row.previousAirtime)}
                        <span className="text-muted-foreground"> → </span>
                        {formatAmount(row.airtime)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.action === 'CREATION' ? (
                      formatAmount(row.data)
                    ) : (
                      <span>
                        {formatAmount(row.previousData)}
                        <span className="text-muted-foreground"> → </span>
                        {formatAmount(row.data)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {operatorId && rows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No changes to send for this operator.
            </p>
          ) : null}
          {operatorId && rows.length > 0 && visibleRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No lines match the search.</p>
          ) : null}
        </section>
      </div>
      {letter ? (
        <LetterPdfOverlay
          html={letter.html}
          title={letter.title}
          onClose={() => setLetter(null)}
        />
      ) : null}
    </div>
  )
}
