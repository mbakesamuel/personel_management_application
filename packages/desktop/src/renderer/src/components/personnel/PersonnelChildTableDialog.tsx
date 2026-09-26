import type { EmployeeOption, User, WorkflowStatus } from '@perf-appraisal-app/shared'
import { Check, Pencil, Plus, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  asRecord,
  buildPayload,
  canMutateChild,
  emptyFormValues,
  formValuesFromRow,
  normalizeEmploymentUnit,
  pickLatestValidatedToUnitId,
  rowId,
  rowWorkflowStatus,
  validateRequired,
  type LookupKind,
  type PersonnelChildTableConfig,
} from './personnelChildTables'

type LookupOption = { value: string; label: string }

type PersonnelChildTableDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PersonnelChildTableConfig | null
  employee: EmployeeOption
  currentUser: User
}

function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const styles: Record<WorkflowStatus, string> = {
    PENDING:
      'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    VALIDATED:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    SUPERSEDED:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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

function getChildApi(
  client: Awaited<ReturnType<typeof createApiClient>>,
  resource: string,
) {
  const personnel = client.personnel as unknown as Record<
    string,
    {
      $get: (args: { query: Record<string, string | undefined> }) => Promise<Response>
      $post: (args: { json: Record<string, unknown> }) => Promise<Response>
      [':id']: {
        $patch: (args: {
          param: { id: string }
          json: Record<string, unknown>
        }) => Promise<Response>
        validate: {
          $post: (args: {
            param: { id: string }
            json: { reviewNote?: string }
          }) => Promise<Response>
        }
        reject: {
          $post: (args: {
            param: { id: string }
            json: { reviewNote?: string }
          }) => Promise<Response>
        }
      }
    }
  >
  return personnel[resource]
}

export function PersonnelChildTableDialog({
  open,
  onOpenChange,
  config,
  employee,
  currentUser,
}: PersonnelChildTableDialogProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [lookups, setLookups] = useState<Partial<Record<LookupKind, LookupOption[]>>>(
    {},
  )

  const [rowDialogOpen, setRowDialogOpen] = useState(false)
  const [rowDialogMode, setRowDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewKind, setReviewKind] = useState<'validate' | 'reject'>('validate')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewId, setReviewId] = useState<number | null>(null)

  const canReview = currentUser.permissions.canValidate
  const selectedRow = useMemo(
    () => rows.find((r) => rowId(r) === selectedId) ?? null,
    [rows, selectedId],
  )

  const loadRows = useCallback(async () => {
    if (!config || !open) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const api = getChildApi(client, config.id)
      if (!api?.$get) throw new Error('Child API unavailable')
      const res = await api.$get({
        query: { matricule: employee.matricule },
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to load rows'))
      const data = (await res.json()) as unknown
      const list = Array.isArray(data) ? data.map(asRecord) : []
      setRows(list)
      setSelectedId((prev) =>
        prev != null && list.some((r) => rowId(r) === prev)
          ? prev
          : list.length > 0
            ? rowId(list[0])
            : null,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [config, employee.matricule, open])

  const loadLookups = useCallback(async () => {
    if (!config || !open) return
    const needed = new Set(
      config.fields.map((f) => f.lookup).filter(Boolean) as LookupKind[],
    )
    if (needed.size === 0) return

    try {
      const client = await createApiClient()
      const next: Partial<Record<LookupKind, LookupOption[]>> = {}

      if (needed.has('marital')) {
        const res = await client.personnel.lookups['marital-statuses'].$get({
          query: {},
        })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: string
            marital_status?: string
          }>
          next.marital = data.map((r) => ({
            value: r.id,
            label: r.marital_status ?? r.id,
          }))
        }
      }

      if (needed.has('insuranceCentre')) {
        const res = await client.personnel.lookups['insurance-centres'].$get({
          query: {},
        })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: string
            centreName?: string
          }>
          next.insuranceCentre = data.map((r) => ({
            value: r.id,
            label: r.centreName ?? r.id,
          }))
        }
      }

      if (needed.has('transferType')) {
        const res = await client.personnel.lookups['transfer-types'].$get({
          query: {},
        })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: number
            Type_transfer?: string
          }>
          next.transferType = data.map((r) => ({
            value: String(r.id),
            label: r.Type_transfer ?? String(r.id),
          }))
        }
      }

      if (needed.has('unit')) {
        const res = await client.organization.units.$get()
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: string
            unitName?: string
            unit_name?: string
          }>
          next.unit = data.map((r) => ({
            value: r.id,
            label: r.unitName ?? r.unit_name ?? r.id,
          }))
        }
      }

      if (needed.has('contractType')) {
        next.contractType = [
          { value: 'UNSPECIFIED', label: 'Unspecified' },
          { value: 'SPECIFIED', label: 'Specified' },
        ]
      }

      setLookups(next)
    } catch {
      // Lookups are best-effort; forms still open with empty selects.
    }
  }, [config, open])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  async function openCreate() {
    if (!config) return
    if (config.id === 'employments' && rows.length > 0) {
      setStatus('Employee already has an employment record')
      return
    }
    setRowDialogMode('create')
    setEditingId(null)
    const values = emptyFormValues(config.fields)

    if (config.id === 'employee-movements') {
      let fromUnit = pickLatestValidatedToUnitId(rows)
      if (!fromUnit) {
        try {
          const client = await createApiClient()
          const res = await client.personnel.employments.$get({
            query: { matricule: employee.matricule, current: 'true' },
          })
          if (res.ok) {
            const data = (await res.json()) as unknown
            const list = Array.isArray(data) ? data.map(asRecord) : []
            const current =
              list.find(
                (r) =>
                  r.current === true && r.workflowStatus === 'VALIDATED',
              ) ?? list[0]
            fromUnit = normalizeEmploymentUnit(current?.unit)
          }
        } catch {
          // Prefill is best-effort; form still opens.
        }
      }
      if (fromUnit) values.From_unit_id = fromUnit
    }

    setForm(values)
    setFormError(null)
    setRowDialogOpen(true)
  }

  function openEdit() {
    if (!config || !selectedRow) return
    const id = rowId(selectedRow)
    if (id == null) return
    if (!canMutateChild(rowWorkflowStatus(selectedRow))) {
      setStatus('Only PENDING or REJECTED rows can be edited')
      return
    }
    setRowDialogMode('edit')
    setEditingId(id)
    setForm(formValuesFromRow(config.fields, selectedRow, config.id))
    setFormError(null)
    setRowDialogOpen(true)
  }

  function openReview(kind: 'validate' | 'reject') {
    if (!selectedRow) return
    const id = rowId(selectedRow)
    if (id == null) return
    if (rowWorkflowStatus(selectedRow) !== 'PENDING') {
      setStatus('Only PENDING rows can be validated or rejected')
      return
    }
    setReviewKind(kind)
    setReviewId(id)
    setReviewNote('')
    setReviewOpen(true)
  }

  async function handleSaveRow() {
    if (!config) return
    setFormError(null)
    const missing = validateRequired(config.fields, form, config.id)
    if (missing) {
      setFormError(missing)
      return
    }
    setLoading(true)
    try {
      const client = await createApiClient()
      const api = getChildApi(client, config.id)
      if (!api) throw new Error('Child API unavailable')

      if (rowDialogMode === 'create') {
        const payload = buildPayload(
          config.fields,
          form,
          employee.matricule,
          config.id,
        )
        const res = await api.$post({ json: payload })
        if (!res.ok) throw new Error(await readError(res, 'Create failed'))
      } else {
        if (editingId == null) throw new Error('Missing row id')
        const payload = buildPayload(config.fields, form, undefined, config.id)
        const res = await api[':id'].$patch({
          param: { id: String(editingId) },
          json: payload,
        })
        if (!res.ok) throw new Error(await readError(res, 'Update failed'))
      }
      setRowDialogOpen(false)
      await loadRows()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmReview() {
    if (!config || reviewId == null) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const api = getChildApi(client, config.id)
      if (!api) throw new Error('Child API unavailable')
      const endpoint =
        reviewKind === 'validate' ? api[':id'].validate : api[':id'].reject
      const res = await endpoint.$post({
        param: { id: String(reviewId) },
        json: { reviewNote: reviewNote.trim() || undefined },
      })
      if (!res.ok) throw new Error(await readError(res, 'Review failed'))
      setReviewOpen(false)
      await loadRows()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!config) return null

  const title = `${config.label} ${employee.matricule} ${employee.name}${
    employee.firstname ? ` ${employee.firstname}` : ''
  }`

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        subtitle="Records for the selected employee"
        wide
        className="sm:max-w-4xl"
      >
        <FormDialogError>{status}</FormDialogError>
        <div className="flex min-h-72 gap-4">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={config.columns.length + 1}
                      className="text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={config.columns.length + 1}
                      className="text-muted-foreground"
                    >
                      No records for this employee.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const id = rowId(row)
                    const wf = rowWorkflowStatus(row)
                    return (
                      <TableRow
                        key={id ?? JSON.stringify(row)}
                        data-state={selectedId === id ? 'selected' : undefined}
                        className={cn(
                          'cursor-pointer',
                          selectedId === id && 'bg-muted',
                        )}
                        onClick={() => id != null && setSelectedId(id)}
                      >
                        {config.columns.map((col) => (
                          <TableCell key={col.key}>{col.getValue(row)}</TableCell>
                        ))}
                        <TableCell>
                          <WorkflowBadge status={wf} />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex w-28 shrink-0 flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-start"
              disabled={
                loading ||
                (config.id === 'employments' && rows.length > 0)
              }
              onClick={() => void openCreate()}
            >
              <Plus className="size-4" />
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-start"
              disabled={
                loading ||
                !selectedRow ||
                (config.id === 'employments' &&
                  !canMutateChild(rowWorkflowStatus(selectedRow)))
              }
              onClick={openEdit}
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
                  className="justify-start"
                  disabled={
                    loading ||
                    !selectedRow ||
                    rowWorkflowStatus(selectedRow) !== 'PENDING'
                  }
                  onClick={() => openReview('validate')}
                >
                  <Check className="size-4" />
                  Validate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  disabled={
                    loading ||
                    !selectedRow ||
                    rowWorkflowStatus(selectedRow) !== 'PENDING'
                  }
                  onClick={() => openReview('reject')}
                >
                  <XCircle className="size-4" />
                  Reject
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="mt-auto justify-start"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              OK
            </Button>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={rowDialogOpen}
        onOpenChange={setRowDialogOpen}
        title={
          rowDialogMode === 'create'
            ? `Add ${config.label}`
            : `Change ${config.label}`
        }
        subtitle={`${employee.matricule} — ${employee.name}`}
        wide={config.id === 'employee-classifications'}
      >
        <FormDialogError>{formError}</FormDialogError>
        <div
          className={cn(
            config.id === 'employee-classifications' &&
              'grid grid-cols-1 gap-x-4 sm:grid-cols-2',
          )}
        >
          {config.fields.map((field) => {
            const options = field.lookup ? lookups[field.lookup] ?? [] : []
            const endRequired =
              field.name === 'endDate' && form.contractType === 'SPECIFIED'
            const label =
              field.required || endRequired
                ? `${field.label} *`
                : field.label
            const isClassifications = config.id === 'employee-classifications'
            const control =
              field.type === 'select' ? (
                <Select
                  value={form[field.name] || undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, [field.name]: value }))
                  }
                >
                  <SelectTrigger id={`child-${field.name}`} className="w-full">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`child-${field.name}`}
                  type={
                    field.type === 'date'
                      ? 'date'
                      : field.type === 'number'
                        ? 'number'
                        : 'text'
                  }
                  value={form[field.name] ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                />
              )
            return (
              <div
                key={field.name}
                className={cn(
                  isClassifications &&
                    field.name === 'comment' &&
                    'sm:col-span-2',
                )}
              >
                <FormDialogRow
                  label={label}
                  htmlFor={`child-${field.name}`}
                  className={
                    isClassifications
                      ? 'sm:grid-cols-1 sm:gap-1 py-1'
                      : undefined
                  }
                >
                  {control}
                </FormDialogRow>
              </div>
            )
          })}
        </div>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void handleSaveRow()}
          onCancel={() => setRowDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title={reviewKind === 'validate' ? 'Validate record' : 'Reject record'}
        subtitle={config.label}
      >
        <FormDialogRow label="Review note" htmlFor="child-review-note">
          <Textarea
            id="child-review-note"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            placeholder="Optional review note"
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Working…'
              : reviewKind === 'validate'
                ? 'Validate'
                : 'Reject'
          }
          onPrimary={() => void confirmReview()}
          onCancel={() => setReviewOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>
    </>
  )
}
