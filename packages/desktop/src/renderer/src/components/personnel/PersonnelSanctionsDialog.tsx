import { canEditWorkflowStatus, type EmployeeOption, type User, type WorkflowStatus } from '@personel-management-app/shared'
import { Check, Download, Paperclip, Pencil, Plus, Trash2, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApiClient } from '../../api/client'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from '../form-dialog'
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

type MemoTypeOption = { id: number; code: string; name: string }
type SanctionOption = { id: number; sanctionName: string }

type AttachmentRow = {
  id: number
  originalName: string
  remarks: string | null
}

type MemoRow = {
  id: number
  memoTypeId: number
  memoType?: { name?: string }
  memoNumber: string | null
  memoDate: string
  subject: string
  details: string | null
  incidentDate: string | null
  effectiveDate: string | null
  workflowStatus: WorkflowStatus
  createdById: number
  attachments: AttachmentRow[]
}

type SanctionRow = {
  id: number
  memoId: number | null
  sanctionId: number
  sanction?: { sanctionName?: string }
  reason: string | null
  startDate: string | null
  endDate: string | null
  active: boolean
  workflowStatus: WorkflowStatus
  createdById: number
}

type MemoForm = {
  memoTypeId: string
  memoNumber: string
  memoDate: string
  subject: string
  details: string
  incidentDate: string
  effectiveDate: string
}

type SanctionForm = {
  sanctionId: string
  reason: string
  startDate: string
  endDate: string
}

const emptyMemoForm = (): MemoForm => ({
  memoTypeId: '',
  memoNumber: '',
  memoDate: '',
  subject: '',
  details: '',
  incidentDate: '',
  effectiveDate: '',
})

const emptySanctionForm = (): SanctionForm => ({
  sanctionId: '',
  reason: '',
  startDate: '',
  endDate: '',
})

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const styles: Record<WorkflowStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    VALIDATED:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    SUPERSEDED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        styles[status],
      )}
    >
      {status}
    </span>
  )
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

type PersonnelSanctionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeOption
  currentUser: User
}

export function PersonnelSanctionsDialog({
  open,
  onOpenChange,
  employee,
  currentUser,
}: PersonnelSanctionsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [memos, setMemos] = useState<MemoRow[]>([])
  const [sanctions, setSanctions] = useState<SanctionRow[]>([])
  const [memoTypes, setMemoTypes] = useState<MemoTypeOption[]>([])
  const [sanctionTypes, setSanctionTypes] = useState<SanctionOption[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedSanctionId, setSelectedSanctionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [memoOpen, setMemoOpen] = useState(false)
  const [memoMode, setMemoMode] = useState<'create' | 'edit'>('create')
  const [memoForm, setMemoForm] = useState<MemoForm>(emptyMemoForm)
  const [memoError, setMemoError] = useState<string | null>(null)

  const [sanctionOpen, setSanctionOpen] = useState(false)
  const [sanctionMode, setSanctionMode] = useState<'create' | 'edit'>('create')
  const [sanctionForm, setSanctionForm] = useState<SanctionForm>(emptySanctionForm)
  const [sanctionError, setSanctionError] = useState<string | null>(null)

  const [review, setReview] = useState<{
    kind: 'memo' | 'sanction'
    action: 'validate' | 'reject'
    id: number
  } | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const canReview = currentUser.permissions.canValidate
  const selectedMemo = useMemo(
    () => memos.find((row) => row.id === selectedId) ?? null,
    [memos, selectedId],
  )
  const memoSanctions = useMemo(
    () => sanctions.filter((row) => row.memoId === selectedId),
    [sanctions, selectedId],
  )
  const selectedSanction = memoSanctions.find((row) => row.id === selectedSanctionId) ?? null
  const documentsEditable =
    selectedMemo != null &&
    (selectedMemo.workflowStatus === 'PENDING' ||
      selectedMemo.workflowStatus === 'REJECTED')

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [memoRes, sanctionRes, typeRes, nameRes] = await Promise.all([
        client.personnel['employee-memos'].$get({
          query: { matricule: employee.matricule },
        }),
        client.personnel['employee-sanctions'].$get({
          query: { matricule: employee.matricule },
        }),
        client.personnel.lookups['memo-types'].$get({ query: {} }),
        client.personnel.lookups.sanctions.$get({ query: {} }),
      ])
      if (!memoRes.ok) throw new Error(await readError(memoRes, 'Failed to load memos'))
      if (!sanctionRes.ok) {
        throw new Error(await readError(sanctionRes, 'Failed to load sanctions'))
      }
      if (!typeRes.ok) throw new Error(await readError(typeRes, 'Failed to load memo types'))
      if (!nameRes.ok) {
        throw new Error(await readError(nameRes, 'Failed to load sanction names'))
      }
      const memoRows = (await memoRes.json()) as MemoRow[]
      const sanctionRows = (await sanctionRes.json()) as SanctionRow[]
      setMemos(memoRows)
      setSanctions(sanctionRows)
      setMemoTypes((await typeRes.json()) as MemoTypeOption[])
      setSanctionTypes((await nameRes.json()) as SanctionOption[])
      setSelectedId((prev) =>
        prev != null && memoRows.some((row) => row.id === prev)
          ? prev
          : memoRows[0]?.id ?? null,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setMemos([])
      setSanctions([])
    } finally {
      setLoading(false)
    }
  }, [employee.matricule, open])

  useEffect(() => {
    void load()
  }, [load])

  function openCreateMemo() {
    setMemoMode('create')
    setMemoForm(emptyMemoForm())
    setMemoError(null)
    setMemoOpen(true)
  }

  function openEditMemo() {
    if (!selectedMemo) return
    if (
      !canEditWorkflowStatus(
        selectedMemo.workflowStatus,
        currentUser.permissions.canEditValidated,
      )
    ) {
      setStatus('Only pending or rejected memos can be edited')
      return
    }
    setMemoMode('edit')
    setMemoForm({
      memoTypeId: String(selectedMemo.memoTypeId),
      memoNumber: selectedMemo.memoNumber ?? '',
      memoDate: dateInput(selectedMemo.memoDate),
      subject: selectedMemo.subject,
      details: selectedMemo.details ?? '',
      incidentDate: dateInput(selectedMemo.incidentDate),
      effectiveDate: dateInput(selectedMemo.effectiveDate),
    })
    setMemoError(null)
    setMemoOpen(true)
  }

  async function saveMemo() {
    if (!memoForm.memoTypeId || !memoForm.memoDate || !memoForm.subject.trim()) {
      setMemoError('Type, date, and subject are required')
      return
    }
    setLoading(true)
    setMemoError(null)
    try {
      const client = await createApiClient()
      const json = {
        memoTypeId: Number(memoForm.memoTypeId),
        memoNumber: memoForm.memoNumber.trim() || null,
        memoDate: memoForm.memoDate,
        subject: memoForm.subject.trim(),
        details: memoForm.details.trim() || null,
        incidentDate: memoForm.incidentDate || null,
        effectiveDate: memoForm.effectiveDate || null,
      }
      const res =
        memoMode === 'create'
          ? await client.personnel['employee-memos'].$post({
              json: { matricule: employee.matricule, ...json },
            })
          : await client.personnel['employee-memos'][':id'].$patch({
              param: { id: String(selectedId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setMemoOpen(false)
      await load()
    } catch (err) {
      setMemoError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function openReview(kind: 'memo' | 'sanction', action: 'validate' | 'reject') {
    const row = kind === 'memo' ? selectedMemo : selectedSanction
    if (!row || row.workflowStatus !== 'PENDING') {
      setStatus('Only pending records can be validated or rejected')
      return
    }
    setReview({ kind, action, id: row.id })
    setReviewNote('')
  }

  async function confirmReview() {
    if (!review) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const api =
        review.kind === 'memo'
          ? client.personnel['employee-memos'][':id']
          : client.personnel['employee-sanctions'][':id']
      const endpoint =
        review.action === 'validate' ? api.validate : api.reject
      const res = await endpoint.$post({
        param: { id: String(review.id) },
        json: { reviewNote: reviewNote.trim() || undefined },
      } as { param: { id: string } })
      if (!res.ok) throw new Error(await readError(res, 'Review failed'))
      setReview(null)
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(file: File) {
    if (!selectedMemo) return
    setLoading(true)
    setStatus(null)
    try {
      const config = await window.api.getServerConfig()
      if (!config.serverUrl) throw new Error('Server URL is not set')
      const body = new FormData()
      body.append('file', file)
      const headers: Record<string, string> = {
        'x-user-id': String(currentUser.id),
      }
      if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`
      const res = await fetch(
        `${config.serverUrl.replace(/\/$/, '')}/personnel/employee-memos/${selectedMemo.id}/attachments`,
        { method: 'POST', headers, body },
      )
      if (!res.ok) throw new Error(await readError(res, 'Upload failed'))
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function downloadFile(attachment: AttachmentRow) {
    if (!selectedMemo) return
    try {
      const client = await createApiClient()
      const res = await client.personnel['employee-memos'][':id'].attachments[
        ':attachmentId'
      ].$get({
        param: {
          id: String(selectedMemo.id),
          attachmentId: String(attachment.id),
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Download failed'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  async function removeFile(attachmentId: number) {
    if (!selectedMemo) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.personnel['employee-memos'][':id'].attachments[
        ':attachmentId'
      ].$delete({
        param: {
          id: String(selectedMemo.id),
          attachmentId: String(attachmentId),
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Remove failed'))
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function openCreateSanction() {
    if (!selectedMemo || selectedMemo.workflowStatus !== 'VALIDATED') {
      setStatus('A sanction can be added only after the memo is validated')
      return
    }
    setSanctionMode('create')
    setSanctionForm(emptySanctionForm())
    setSanctionError(null)
    setSanctionOpen(true)
  }

  function openEditSanction() {
    if (!selectedSanction) return
    if (
      !canEditWorkflowStatus(
        selectedSanction.workflowStatus,
        currentUser.permissions.canEditValidated,
      )
    ) {
      setStatus('Only pending or rejected sanctions can be edited')
      return
    }
    setSanctionMode('edit')
    setSanctionForm({
      sanctionId: String(selectedSanction.sanctionId),
      reason: selectedSanction.reason ?? '',
      startDate: dateInput(selectedSanction.startDate),
      endDate: dateInput(selectedSanction.endDate),
    })
    setSanctionError(null)
    setSanctionOpen(true)
  }

  async function saveSanction() {
    if (!selectedMemo || !sanctionForm.sanctionId) {
      setSanctionError('Sanction is required')
      return
    }
    setLoading(true)
    setSanctionError(null)
    try {
      const client = await createApiClient()
      const json = {
        sanctionId: Number(sanctionForm.sanctionId),
        reason: sanctionForm.reason.trim() || null,
        startDate: sanctionForm.startDate || null,
        endDate: sanctionForm.endDate || null,
      }
      const res =
        sanctionMode === 'create'
          ? await client.personnel['employee-sanctions'].$post({
              json: {
                matricule: employee.matricule,
                memoId: selectedMemo.id,
                ...json,
              },
            })
          : await client.personnel['employee-sanctions'][':id'].$patch({
              param: { id: String(selectedSanctionId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setSanctionOpen(false)
      await load()
    } catch (err) {
      setSanctionError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const title = `Sanctions ${employee.matricule} ${employee.name}${
    employee.firstname ? ` ${employee.firstname}` : ''
  }`

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        subtitle="Memos, documents, and sanctions for the selected employee"
        wide
        className="sm:max-w-5xl"
      >
        <FormDialogError>{status}</FormDialogError>
        <div className="flex min-h-64 gap-4">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && memos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : memos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No memos for this employee.
                    </TableCell>
                  </TableRow>
                ) : (
                  memos.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'cursor-pointer',
                        selectedId === row.id && 'bg-muted',
                      )}
                      onClick={() => {
                        setSelectedId(row.id)
                        setSelectedSanctionId(null)
                      }}
                    >
                      <TableCell>{row.memoType?.name ?? '—'}</TableCell>
                      <TableCell>{row.memoNumber ?? '—'}</TableCell>
                      <TableCell>{dateInput(row.memoDate) || '—'}</TableCell>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>
                        <WorkflowBadge status={row.workflowStatus} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex w-36 shrink-0 flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-start"
              disabled={loading}
              onClick={openCreateMemo}
            >
              <Plus className="size-4" />
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-start"
              disabled={loading || !selectedMemo}
              onClick={openEditMemo}
            >
              <Pencil className="size-4" />
              Change
            </Button>
            {canReview ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={
                    loading || selectedMemo?.workflowStatus !== 'PENDING'
                  }
                  onClick={() => openReview('memo', 'validate')}
                >
                  <Check className="size-4" />
                  Validate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={
                    loading || selectedMemo?.workflowStatus !== 'PENDING'
                  }
                  onClick={() => openReview('memo', 'reject')}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="mt-auto w-full justify-start"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              OK
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Documents</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || !documentsEditable}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="size-4" />
                Attach
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void uploadFile(file)
                }}
              />
            </div>
            <div className="max-h-40 overflow-auto rounded-md border">
              <Table>
                <TableBody>
                  {!selectedMemo || selectedMemo.attachments.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        {selectedMemo
                          ? 'No documents on this memo.'
                          : 'Select a memo.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedMemo.attachments.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="max-w-0 truncate">
                          {file.originalName}
                        </TableCell>
                        <TableCell className="w-20 text-right">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => void downloadFile(file)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={!documentsEditable || loading}
                            onClick={() => void removeFile(file.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Sanctions</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    loading || selectedMemo?.workflowStatus !== 'VALIDATED'
                  }
                  onClick={openCreateSanction}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading || !selectedSanction}
                  onClick={openEditSanction}
                >
                  <Pencil className="size-4" />
                  Change
                </Button>
                {canReview ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        loading || selectedSanction?.workflowStatus !== 'PENDING'
                      }
                      onClick={() => openReview('sanction', 'validate')}
                    >
                      Validate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        loading || selectedSanction?.workflowStatus !== 'PENDING'
                      }
                      onClick={() => openReview('sanction', 'reject')}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="max-h-40 overflow-auto rounded-md border">
              <Table>
                <TableBody>
                  {memoSanctions.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground">
                        {selectedMemo?.workflowStatus === 'VALIDATED'
                          ? 'No sanctions on this memo.'
                          : 'Validate the memo before adding a sanction.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    memoSanctions.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'cursor-pointer',
                          selectedSanctionId === row.id && 'bg-muted',
                        )}
                        onClick={() => setSelectedSanctionId(row.id)}
                      >
                        <TableCell>
                          {row.sanction?.sanctionName ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.active ? 'Active' : 'Inactive'}
                        </TableCell>
                        <TableCell>
                          <WorkflowBadge status={row.workflowStatus} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </FormDialog>

      <FormDialog
        open={memoOpen}
        onOpenChange={setMemoOpen}
        title={memoMode === 'create' ? 'Add memo' : 'Change memo'}
        subtitle={`${employee.matricule} — ${employee.name}`}
      >
        <FormDialogError>{memoError}</FormDialogError>
        <FormDialogRow label="Type *" htmlFor="memo-type">
          <Select
            value={memoForm.memoTypeId || undefined}
            onValueChange={(value) =>
              setMemoForm((prev) => ({ ...prev, memoTypeId: value }))
            }
          >
            <SelectTrigger id="memo-type" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {memoTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Number" htmlFor="memo-number">
          <Input
            id="memo-number"
            value={memoForm.memoNumber}
            onChange={(event) =>
              setMemoForm((prev) => ({ ...prev, memoNumber: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Date *" htmlFor="memo-date">
          <Input
            id="memo-date"
            type="date"
            value={memoForm.memoDate}
            onChange={(event) =>
              setMemoForm((prev) => ({ ...prev, memoDate: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Subject *" htmlFor="memo-subject">
          <Input
            id="memo-subject"
            value={memoForm.subject}
            onChange={(event) =>
              setMemoForm((prev) => ({ ...prev, subject: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Details" htmlFor="memo-details">
          <Textarea
            id="memo-details"
            rows={3}
            value={memoForm.details}
            onChange={(event) =>
              setMemoForm((prev) => ({ ...prev, details: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Incident date" htmlFor="memo-incident">
          <Input
            id="memo-incident"
            type="date"
            value={memoForm.incidentDate}
            onChange={(event) =>
              setMemoForm((prev) => ({
                ...prev,
                incidentDate: event.target.value,
              }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Effective date" htmlFor="memo-effective">
          <Input
            id="memo-effective"
            type="date"
            value={memoForm.effectiveDate}
            onChange={(event) =>
              setMemoForm((prev) => ({
                ...prev,
                effectiveDate: event.target.value,
              }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveMemo()}
          onCancel={() => setMemoOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={sanctionOpen}
        onOpenChange={setSanctionOpen}
        title={sanctionMode === 'create' ? 'Add sanction' : 'Change sanction'}
        subtitle={selectedMemo?.subject}
      >
        <FormDialogError>{sanctionError}</FormDialogError>
        <FormDialogRow label="Sanction *" htmlFor="sanction-type">
          <Select
            value={sanctionForm.sanctionId || undefined}
            onValueChange={(value) =>
              setSanctionForm((prev) => ({ ...prev, sanctionId: value }))
            }
          >
            <SelectTrigger id="sanction-type" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {sanctionTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.sanctionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Reason" htmlFor="sanction-reason">
          <Textarea
            id="sanction-reason"
            rows={3}
            value={sanctionForm.reason}
            onChange={(event) =>
              setSanctionForm((prev) => ({ ...prev, reason: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Start" htmlFor="sanction-start">
          <Input
            id="sanction-start"
            type="date"
            value={sanctionForm.startDate}
            onChange={(event) =>
              setSanctionForm((prev) => ({
                ...prev,
                startDate: event.target.value,
              }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="End" htmlFor="sanction-end">
          <Input
            id="sanction-end"
            type="date"
            value={sanctionForm.endDate}
            onChange={(event) =>
              setSanctionForm((prev) => ({ ...prev, endDate: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveSanction()}
          onCancel={() => setSanctionOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={review != null}
        onOpenChange={(next) => {
          if (!next) setReview(null)
        }}
        title={
          review?.action === 'validate' ? 'Validate record' : 'Reject record'
        }
        subtitle={review?.kind === 'sanction' ? 'Sanction' : 'Memo'}
      >
        <FormDialogRow label="Review note" htmlFor="sanction-review-note">
          <Textarea
            id="sanction-review-note"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            rows={3}
            placeholder="Optional review note"
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Working…'
              : review?.action === 'validate'
                ? 'Validate'
                : 'Reject'
          }
          onPrimary={() => void confirmReview()}
          onCancel={() => setReview(null)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>
    </>
  )
}
