import type { User, WorkflowStatus } from '@personel-management-app/shared'
import { useCallback, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from './form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PermissionsConsoleProps = {
  currentUser: User
  onClose: () => void
}

type PermissionRequest = {
  id: number
  days: number
  applicationDate: string
  reason: string | null
  workflowStatus: WorkflowStatus
}
type LedgerRow = {
  id: number
  days: number
  kind: 'CREDIT' | 'DEBIT'
  note: string | null
  createdAt: string
}

function day(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—'
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function PermissionsConsole({ currentUser, onClose }: PermissionsConsoleProps) {
  const [matricule, setMatricule] = useState('')
  const [loadedMatricule, setLoadedMatricule] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [requests, setRequests] = useState<PermissionRequest[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [days, setDays] = useState('')
  const [applicationDate, setApplicationDate] = useState('')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState<'validate' | 'reject' | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const selected = requests.find((row) => row.id === selectedId) ?? null
  const canReview = currentUser.permissions.canValidate
  const editable =
    selected?.workflowStatus === 'PENDING' || selected?.workflowStatus === 'REJECTED'

  const load = useCallback(async (target: string) => {
    const trimmed = target.trim()
    if (!trimmed) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [requestRes, ledgerRes, balanceRes] = await Promise.all([
        client.permissions.requests.$get({ query: { matricule: trimmed } }),
        client.permissions.ledger.$get({ query: { matricule: trimmed } }),
        client.permissions.account.$get({ query: { matricule: trimmed } }),
      ])
      if (!requestRes.ok) throw new Error(await readError(requestRes, 'Failed to load permissions'))
      if (!ledgerRes.ok) throw new Error(await readError(ledgerRes, 'Failed to load the account'))
      if (!balanceRes.ok) throw new Error(await readError(balanceRes, 'Failed to load the balance'))
      const rows = (await requestRes.json()) as PermissionRequest[]
      setRequests(rows)
      setLedger((await ledgerRes.json()) as LedgerRow[])
      setBalance(((await balanceRes.json()) as { balanceDays: number }).balanceDays)
      setLoadedMatricule(trimmed)
      setSelectedId((prev) =>
        prev != null && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  async function save() {
    if (!applicationDate || !days) {
      setFormError('Days and application date are required')
      return
    }
    setLoading(true)
    setFormError(null)
    try {
      const client = await createApiClient()
      const json = {
        days: Number(days),
        applicationDate,
        reason: reason.trim() || null,
      }
      const res =
        editingId == null
          ? await client.permissions.requests.$post({
              json: { ...json, matricule: loadedMatricule },
            })
          : await client.permissions.requests[':id'].$patch({
              param: { id: String(editingId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setOpen(false)
      await load(loadedMatricule)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmReview() {
    if (!selected || !review) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const endpoint =
        review === 'validate'
          ? client.permissions.requests[':id'].validate
          : client.permissions.requests[':id'].reject
      const res = await endpoint.$post({
        param: { id: String(selected.id) },
        json: { reviewNote: reviewNote.trim() || undefined },
      } as { param: { id: string } })
      if (!res.ok) throw new Error(await readError(res, 'Review failed'))
      setReview(null)
      await load(loadedMatricule)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Permission days accumulate here. Leave deducts them when a leave is processed.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void load(matricule)
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Matricule</span>
          <Input
            value={matricule}
            onChange={(event) => setMatricule(event.target.value)}
            className="w-48"
          />
        </label>
        <Button type="submit" disabled={loading || !matricule.trim()}>
          Load
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!loadedMatricule || loading}
          onClick={() => {
            setEditingId(null)
            setDays('')
            setApplicationDate('')
            setReason('')
            setFormError(null)
            setOpen(true)
          }}
        >
          Apply
        </Button>
        {loadedMatricule ? (
          <p className="text-sm">
            Account balance: <strong>{balance ?? 0}</strong> days
          </p>
        ) : null}
      </form>
      {status ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}
      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applied</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {loadedMatricule
                    ? 'No permission applications for this employee.'
                    : 'Enter a matricule and load permissions.'}
                </TableCell>
              </TableRow>
            ) : (
              requests.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('cursor-pointer', selectedId === row.id && 'bg-muted')}
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell>{day(row.applicationDate)}</TableCell>
                  <TableCell>{row.days}</TableCell>
                  <TableCell>{row.reason || '—'}</TableCell>
                  <TableCell>{row.workflowStatus}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {selected ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !editable}
            onClick={() => {
              setEditingId(selected.id)
              setDays(String(selected.days))
              setApplicationDate(day(selected.applicationDate))
              setReason(selected.reason ?? '')
              setFormError(null)
              setOpen(true)
            }}
          >
            Change
          </Button>
          {canReview ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || selected.workflowStatus !== 'PENDING'}
                onClick={() => {
                  setReviewNote('')
                  setReview('validate')
                }}
              >
                Validate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || selected.workflowStatus !== 'PENDING'}
                onClick={() => {
                  setReviewNote('')
                  setReview('reject')
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Account ledger</h2>
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No account movements yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{day(row.createdAt)}</TableCell>
                    <TableCell>{row.kind === 'CREDIT' ? 'Added' : 'Deducted'}</TableCell>
                    <TableCell>{row.days}</TableCell>
                    <TableCell>{row.note || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingId(null)
        }}
        title={editingId == null ? 'Apply for permission' : 'Change permission'}
        subtitle={loadedMatricule}
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Days" htmlFor="permission-days">
          <Input
            id="permission-days"
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogRow label="Application date" htmlFor="permission-date">
          <Input
            id="permission-date"
            type="date"
            value={applicationDate}
            onChange={(event) => setApplicationDate(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogRow label="Reason" htmlFor="permission-reason">
          <Textarea
            id="permission-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void save()}
          onCancel={() => setOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={review != null}
        onOpenChange={(next) => {
          if (!next) setReview(null)
        }}
        title={review === 'validate' ? 'Validate permission' : 'Reject permission'}
      >
        <FormDialogRow label="Review note" htmlFor="permission-review">
          <Textarea
            id="permission-review"
            rows={3}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={
            loading ? 'Working…' : review === 'validate' ? 'Validate' : 'Reject'
          }
          onPrimary={() => void confirmReview()}
          onCancel={() => setReview(null)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>
    </div>
  )
}
