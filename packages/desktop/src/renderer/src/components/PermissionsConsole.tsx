import type { User, WorkflowStatus } from '@personel-management-app/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
import { LetterPdfOverlay } from './LetterPdfOverlay'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from './form-dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PermissionsConsoleProps = {
  currentUser: User
  onClose: () => void
}

type DocumentRequirement = { id: number; name: string; sortOrder: number }
type PermissionType = {
  id: number
  name: string
  active: boolean
  category?: 'LEAVE' | 'PERMISSION'
  isPaid?: boolean
  maxDays?: number | null
  documentRequirements?: DocumentRequirement[]
}
type Attachment = {
  id: number
  originalName: string
  requirementId: number | null
}
type PermissionRequest = {
  id: number
  days: number
  applicationDate: string
  startDate: string
  endDate: string | null
  resumeDate: string | null
  reason: string | null
  workflowStatus: WorkflowStatus
  leaveTypeId: number | null
  leaveType?: {
    name?: string
    documentRequirements?: DocumentRequirement[]
  } | null
  attachments: Attachment[]
}
type LedgerRow = {
  id: number
  days: number
  kind: 'CREDIT' | 'DEBIT'
  note: string | null
  createdAt: string
}

function day(value: string | null | undefined) {
  return formatDisplayDate(value) || '—'
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [resumeDate, setResumeDate] = useState('')
  const [eligibleDays, setEligibleDays] = useState<number | null>(null)
  const [eligibleReady, setEligibleReady] = useState(false)
  const [paid, setPaid] = useState(false)
  const [reason, setReason] = useState('')
  const [memoHtml, setMemoHtml] = useState<string | null>(null)
  const [review, setReview] = useState<'validate' | 'reject' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [types, setTypes] = useState<PermissionType[]>([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const requirementTarget = useRef<number | null>(null)

  const selected = requests.find((row) => row.id === selectedId) ?? null
  const canReview = currentUser.permissions.canLeaveValidate
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

  useEffect(() => {
    void (async () => {
      const client = await createApiClient()
      const res = await client.leave.types.$get()
      if (res.ok) setTypes((await res.json()) as PermissionType[])
    })()
  }, [])

  useEffect(() => {
    if (!open || !loadedMatricule || !startDate) {
      setEndDate('')
      setResumeDate('')
      setEligibleDays(null)
      setEligibleReady(false)
      return
    }
    const requested = Number(days)
    const hasDays = Number.isInteger(requested) && requested >= 1
    setEligibleReady(false)
    let cancelled = false
    void (async () => {
      const client = await createApiClient()
      const res = await client.permissions.span.$get({
        query: {
          matricule: loadedMatricule,
          startDate,
          ...(hasDays ? { days: String(requested) } : {}),
          ...(paid && leaveTypeId ? { leaveTypeId } : {}),
        },
      })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as {
        endDate: string | null
        resumeDate: string | null
        eligibleDays: number | null
      }
      if (cancelled) return
      setEndDate(hasDays ? (body.endDate ?? '') : '')
      setResumeDate(hasDays ? (body.resumeDate ?? '') : '')
      setEligibleDays(paid && leaveTypeId ? body.eligibleDays : null)
      setEligibleReady(Boolean(paid && leaveTypeId))
    })()
    return () => {
      cancelled = true
    }
  }, [open, loadedMatricule, startDate, days, paid, leaveTypeId])

  async function save() {
    if (!applicationDate || !startDate || !days) {
      setFormError('Days, application date, and start date are required')
      return
    }
    if (paid && !leaveTypeId) {
      setFormError('Choose a paid permission type')
      return
    }
    if (paid && eligibleReady && eligibleDays != null && Number(days) > eligibleDays) {
      setFormError(
        `This permission allows at most ${eligibleDays} days from that date`,
      )
      return
    }
    setLoading(true)
    setFormError(null)
    try {
      const client = await createApiClient()
      const json = {
        days: Number(days),
        applicationDate,
        startDate,
        reason: reason.trim() || null,
        leaveTypeId: paid && leaveTypeId ? Number(leaveTypeId) : null,
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

  async function printMemo(id: number) {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.permissions.requests[':id'].memo.$get({
        param: { id: String(id) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not build the memo'))
      const body = (await res.json()) as { html: string }
      setMemoHtml(body.html)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
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

  async function upload(file: File, requirementId: number | null) {
    if (!selected) return
    setLoading(true)
    setStatus(null)
    try {
      const config = await window.api.getServerConfig()
      if (!config.serverUrl) throw new Error('Server URL is not set')
      const body = new FormData()
      body.append('file', file)
      if (requirementId != null) body.append('requirementId', String(requirementId))
      const headers: Record<string, string> = { 'x-user-id': String(currentUser.id) }
      if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`
      const res = await fetch(
        `${config.serverUrl.replace(/\/$/, '')}/permissions/requests/${selected.id}/attachments`,
        { method: 'POST', headers, body },
      )
      if (!res.ok) throw new Error(await readError(res, 'Upload failed'))
      await load(loadedMatricule)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function openAttachment(file: Attachment) {
    if (!selected) return
    setStatus(null)
    try {
      const config = await window.api.getServerConfig()
      if (!config.serverUrl) throw new Error('Server URL is not set')
      const headers: Record<string, string> = { 'x-user-id': String(currentUser.id) }
      if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`
      const res = await fetch(
        `${config.serverUrl.replace(/\/$/, '')}/permissions/requests/${selected.id}/attachments/${file.id}`,
        { headers },
      )
      if (!res.ok) throw new Error(await readError(res, 'Download failed'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function removeAttachment(attachmentId: number) {
    if (!selected) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.permissions.requests[':id'].attachments[':attachmentId'].$delete({
        param: { id: String(selected.id), attachmentId: String(attachmentId) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Remove failed'))
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
          <h1 className="text-lg font-semibold">Permission requests</h1>
          <p className="text-sm text-muted-foreground">
            Event permissions stay off the annual leave balance unless the type
            deducts it. A request with no type still adds permission days.
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
        <label className="space-y-1 space-x-2 text-sm">
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
            setStartDate('')
            setEndDate('')
            setResumeDate('')
            setPaid(false)
            setReason('')
            setLeaveTypeId('')
            setFormError(null)
            setOpen(true)
          }}
        >
          Register Permission
        </Button>
        {loadedMatricule ? (
          <p className="text-sm">
            Account balance: <strong>{balance ?? 0}</strong> day(s)
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
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Memo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
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
                  <TableCell>{day(row.startDate)}</TableCell>
                  <TableCell>{day(row.endDate)}</TableCell>
                  <TableCell>{row.leaveType?.name ?? '—'}</TableCell>
                  <TableCell>{row.days}</TableCell>
                  <TableCell>{row.reason || '—'}</TableCell>
                  <TableCell>{row.workflowStatus}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={(event) => {
                        event.stopPropagation()
                        void printMemo(row.id)
                      }}
                    >
                      Print
                    </Button>
                  </TableCell>
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
              setApplicationDate(selected.applicationDate.slice(0, 10))
              setStartDate(selected.startDate.slice(0, 10))
              setEndDate(selected.endDate ? selected.endDate.slice(0, 10) : '')
              setResumeDate(selected.resumeDate ? selected.resumeDate.slice(0, 10) : '')
              setPaid(selected.leaveTypeId != null)
              setReason(selected.reason ?? '')
              setLeaveTypeId(selected.leaveTypeId ? String(selected.leaveTypeId) : '')
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
      {selected ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Supporting documents</h2>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              const requirementId = requirementTarget.current
              requirementTarget.current = null
              event.target.value = ''
              if (file) void upload(file, requirementId)
            }}
          />
          {(selected.leaveType?.documentRequirements ?? []).map((requirement) => {
            const files = selected.attachments.filter(
              (file) => file.requirementId === requirement.id,
            )
            return (
              <div key={requirement.id} className="space-y-1 rounded-md border px-3 py-2">
                <div className="text-sm font-medium">{requirement.name}</div>
                {files.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Required</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {files.map((file) => (
                      <li key={file.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-left underline"
                          onClick={() => void openAttachment(file)}
                        >
                          {file.originalName}
                        </button>
                        {editable ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => void removeAttachment(file.id)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => {
                      requirementTarget.current = requirement.id
                      fileRef.current?.click()
                    }}
                  >
                    Attach
                  </Button>
                ) : null}
              </div>
            )
          })}
          {editable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => {
                requirementTarget.current = null
                fileRef.current?.click()
              }}
            >
              Attach other document
            </Button>
          ) : null}
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Permission Account ledger</h2>
        <div className="overflow-auto rounded-md border w-[50%]">
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
        wide
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingId(null)
        }}
        title={editingId == null ? 'Permission Registration' : 'Edit permission'}
        subtitle={loadedMatricule}
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Permission Type">
          <div className="flex h-9 items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="permission-payment"
                checked={!paid}
                onChange={() => {
                  setPaid(false)
                  setLeaveTypeId('')
                }}
              />
              Unpaid
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="permission-payment"
                checked={paid}
                onChange={() => setPaid(true)}
              />
              Paid
            </label>
          </div>
        </FormDialogRow>
        {paid ? (
          <FormDialogRow label="Type" htmlFor="permission-type">
            <Select
              value={leaveTypeId || undefined}
              onValueChange={setLeaveTypeId}
            >
              <SelectTrigger id="permission-type" className="w-full">
                <SelectValue placeholder="Select a paid permission" />
              </SelectTrigger>
              <SelectContent>
                {types
                  .filter(
                    (type) =>
                      type.active &&
                      type.category === 'PERMISSION' &&
                      type.isPaid === true,
                  )
                  .map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="Application date" htmlFor="permission-date">
          <Input
            id="permission-date"
            type="date"
            value={applicationDate}
            onChange={(event) => setApplicationDate(event.target.value)}
          />
        </FormDialogRow>
        <FormDialogRow label="Start date" htmlFor="permission-start">
          <Input
            id="permission-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </FormDialogRow>
        {paid && leaveTypeId ? (
          <FormDialogRow label="Eligible days">
            <Input
              readOnly
              value={
                !startDate || !eligibleReady
                  ? ''
                  : eligibleDays == null
                    ? 'None for this start date'
                    : String(eligibleDays)
              }
            />
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="No. Days Req." htmlFor="permission-days">
          <Input
            id="permission-days"
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </FormDialogRow>
        
        
        <FormDialogRow label="End date" htmlFor="permission-end">
          <Input id="permission-end" type="date" value={endDate} readOnly />
        </FormDialogRow>
        <FormDialogRow label="Resumption" htmlFor="permission-resume">
          <Input id="permission-resume" type="date" value={resumeDate} readOnly />
        </FormDialogRow>
        <FormDialogRow label="Reason" htmlFor="permission-reason">
         <Textarea
            id="permission-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}  
            placeholder="... to enable you ..."
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
      {memoHtml ? (
        <LetterPdfOverlay
          html={memoHtml}
          title="Permission"
          onClose={() => setMemoHtml(null)}
        />
      ) : null}
    </div>
  )
}
