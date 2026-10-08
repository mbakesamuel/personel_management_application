import type { EmployeeOption, User, WorkflowStatus } from '@personel-management-app/shared'
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
  canChangeEmployment,
  canMutateChild,
  employmentDisplayStatus,
  emptyFormValues,
  formValuesFromRow,
  isEmploymentDetailField,
  openEmploymentContract,
  resolveMovementFromUnit,
  unitCodesMatch,
  rowId,
  rowWorkflowStatus,
  validateRequired,
  type LookupKind,
  type PersonnelChildTableConfig,
} from './personnelChildTables'

type LookupOption = { value: string; label: string }

type UnitLookupRow = {
  id: string
  unitName?: string
  unit_name?: string
}

function mapUnitOptions(rows: UnitLookupRow[]): LookupOption[] {
  return rows
    .filter((row) => row.id)
    .map((row) => ({
      value: row.id,
      label: row.unitName ?? row.unit_name ?? row.id,
    }))
}

function alignUnitValue(value: string, options: LookupOption[]): string {
  if (!value) return ''
  return (
    options.find((option) => unitCodesMatch(option.value, value))?.value ??
    value
  )
}

function movementFieldOptions(
  field: { name: string; lookup?: LookupKind },
  lookups: Partial<Record<LookupKind, LookupOption[]>>,
  fromUnitId: string,
): LookupOption[] {
  const options = field.lookup ? (lookups[field.lookup] ?? []) : []
  if (field.name !== 'To_unit_id') return options
  const from = fromUnitId.trim()
  if (!from) return options
  return options.filter((option) => !unitCodesMatch(option.value, from))
}

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

function isCurrentFamilyMember(row: Record<string, unknown>) {
  return (
    row.workflowStatus === 'VALIDATED' && row.current === true
  )
}

function familyWifeCount(rows: Record<string, unknown>[]) {
  return rows.filter(
    (row) => isCurrentFamilyMember(row) && row.relationship === 'SPOUSE',
  ).length
}

function familyChildCount(rows: Record<string, unknown>[]) {
  return rows.filter(
    (row) => isCurrentFamilyMember(row) && row.relationship === 'CHILD',
  ).length
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
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [rowDialogOpen, setRowDialogOpen] = useState(false)
  const [rowDialogMode, setRowDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [lockEmploymentFields, setLockEmploymentFields] = useState(false)
  const [revisionContractId, setRevisionContractId] = useState<number | null>(
    null,
  )

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewKind, setReviewKind] = useState<'validate' | 'reject'>('validate')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [reviewResource, setReviewResource] = useState<string | null>(null)

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
    if (needed.size === 0) {
      setLookupError(null)
      return
    }

    try {
      const client = await createApiClient()
      const next: Partial<Record<LookupKind, LookupOption[]>> = {}
      let lookupMessage: string | null = null

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
        } else {
          lookupMessage = await readError(res, 'Failed to load insurance centres')
        }
      }

      if (needed.has('diploma')) {
        const res = await client.personnel.lookups.diplomas.$get({
          query: {},
        })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: string
            deplomaName?: string
          }>
          next.diploma = data.map((r) => ({
            value: r.id,
            label: r.deplomaName ?? r.id,
          }))
        } else {
          lookupMessage = await readError(res, 'Failed to load diplomas')
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

      if (needed.has('unit') || needed.has('unitAll')) {
        const [scopedRes, allRes] = await Promise.all([
          client.personnel.lookups.units.$get({ query: {} }),
          client.personnel.lookups.units.$get({ query: { all: '1' } }),
        ])
        if (scopedRes.ok) {
          next.unit = mapUnitOptions(
            (await scopedRes.json()) as UnitLookupRow[],
          )
        }
        if (allRes.ok) {
          next.unitAll = mapUnitOptions(
            (await allRes.json()) as UnitLookupRow[],
          )
        }
        if (!scopedRes.ok || !allRes.ok) {
          const failed = !scopedRes.ok ? scopedRes : allRes
          lookupMessage = await readError(failed, 'Failed to load units')
        }
      }

      if (needed.has('departure')) {
        const res = await client.personnel.lookups['departure-types'].$get({
          query: {},
        })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            id: number
            type_departure?: string
          }>
          next.departure = data.map((r) => ({
            value: String(r.id),
            label: r.type_departure ?? String(r.id),
          }))
        } else {
          lookupMessage = await readError(res, 'Failed to load departure types')
        }
      }

      setLookupError(lookupMessage)

      if (needed.has('contractType')) {
        next.contractType = [
          { value: 'UNSPECIFIED', label: 'Unspecified' },
          { value: 'SPECIFIED', label: 'Specified' },
        ]
      }

      if (needed.has('familyRelationship')) {
        next.familyRelationship = [
          { value: 'SPOUSE', label: 'Spouse' },
          { value: 'CHILD', label: 'Child' },
        ]
      }

      if (needed.has('sexKind')) {
        next.sexKind = [
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
        ]
      }

      setLookups(next)
    } catch (err) {
      if (needed.has('unit') || needed.has('unitAll')) {
        setLookupError(
          err instanceof Error ? err.message : 'Failed to load units',
        )
      }
    }
  }, [config, open])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  function ensureUnitOption(option: { value: string; label: string }) {
    setLookups((prev) => {
      const units = prev.unit ?? []
      if (units.some((item) => item.value === option.value)) return prev
      return { ...prev, unit: [...units, option] }
    })
  }

  useEffect(() => {
    if (!rowDialogOpen || config?.id !== 'employee-movements') return

    const scoped = lookups.unit ?? []
    const allUnits = lookups.unitAll ?? []

    if (rowDialogMode === 'create') {
      const fromUnit = resolveMovementFromUnit(rows, scoped)
      if (!fromUnit) return
      setForm((prev) => {
        const current = prev.From_unit_id?.trim() ?? ''
        const from =
          !current || unitCodesMatch(current, fromUnit.value)
            ? fromUnit.value
            : current
        const to = prev.To_unit_id?.trim() ?? ''
        const nextTo = from && to && unitCodesMatch(from, to) ? '' : to
        if (from === current && nextTo === to) return prev
        return { ...prev, From_unit_id: from, To_unit_id: nextTo }
      })
      ensureUnitOption(fromUnit)
      return
    }

    const fromId = String(selectedRow?.From_unit_id ?? '').trim()
    if (
      fromId &&
      !scoped.some((option) => unitCodesMatch(option.value, fromId))
    ) {
      const nested = asRecord(selectedRow?.From_unit)
      const nameRaw = nested.unit_name
      ensureUnitOption({
        value: fromId,
        label:
          typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : fromId,
      })
    }

    setForm((prev) => {
      const from = alignUnitValue(prev.From_unit_id?.trim() ?? '', scoped)
      const alignedTo = alignUnitValue(prev.To_unit_id?.trim() ?? '', allUnits)
      const to =
        from && alignedTo && unitCodesMatch(from, alignedTo) ? '' : alignedTo
      if (from === (prev.From_unit_id ?? '') && to === (prev.To_unit_id ?? '')) {
        return prev
      }
      return { ...prev, From_unit_id: from, To_unit_id: to }
    })
  }, [
    rowDialogOpen,
    rowDialogMode,
    config?.id,
    rows,
    lookups.unit,
    lookups.unitAll,
    selectedRow,
  ])

  async function openCreate() {
    if (!config) return
    if (config.id === 'employments' && rows.length > 0) {
      setStatus('Employee already has an employment record')
      return
    }
    setRowDialogMode('create')
    setEditingId(null)
    setLockEmploymentFields(false)
    setRevisionContractId(null)
    const values = emptyFormValues(config.fields)

    if (config.id === 'employee-movements') {
      const fromUnit = resolveMovementFromUnit(rows, lookups.unit ?? [])
      if (fromUnit) {
        values.From_unit_id = fromUnit.value
        ensureUnitOption(fromUnit)
      }
    }

    setForm(values)
    setFormError(null)
    setRowDialogOpen(true)
  }

  function openEdit() {
    if (!config || !selectedRow) return
    const id = rowId(selectedRow)
    if (id == null) return
    const status = rowWorkflowStatus(selectedRow)
    const revisingContract =
      config.id === 'employments' && status === 'VALIDATED'
    if (config.id === 'employments') {
      if (!canChangeEmployment(status)) {
        setStatus('This employment cannot be changed')
        return
      }
    } else if (
      !canMutateChild(status, currentUser.permissions.canEditValidated)
    ) {
      setStatus('Only PENDING or REJECTED rows can be edited')
      return
    }
    const openContract = revisingContract
      ? openEmploymentContract(selectedRow)
      : null
    setLockEmploymentFields(revisingContract)
    setRevisionContractId(openContract ? rowId(openContract) : null)
    setRowDialogMode('edit')
    setEditingId(id)
    setForm(formValuesFromRow(config.fields, selectedRow, config.id))
    setFormError(null)
    setRowDialogOpen(true)
  }

  function openReview(kind: 'validate' | 'reject') {
    if (!config || !selectedRow) return
    const id = rowId(selectedRow)
    if (id == null) return
    const reviewingContract =
      config.id === 'employments' &&
      rowWorkflowStatus(selectedRow) === 'VALIDATED' &&
      openEmploymentContract(selectedRow) != null
    const targetId = reviewingContract
      ? rowId(openEmploymentContract(selectedRow) ?? {})
      : id
    const targetStatus = reviewingContract
      ? employmentDisplayStatus(selectedRow)
      : rowWorkflowStatus(selectedRow)
    if (targetId == null || targetStatus !== 'PENDING') {
      setStatus('Only PENDING rows can be validated or rejected')
      return
    }
    setReviewKind(kind)
    setReviewId(targetId)
    setReviewResource(reviewingContract ? 'contracts' : config.id)
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

      if (lockEmploymentFields) {
        if (editingId == null) throw new Error('Missing employment id')
        const contractsApi = getChildApi(client, 'contracts')
        if (!contractsApi) throw new Error('Contract API unavailable')
        const contract = {
          contractType: form.contractType?.trim() ?? '',
          startDate: form.startDate?.trim() ?? '',
          endDate: form.endDate?.trim() || null,
        }
        const res =
          revisionContractId != null
            ? await contractsApi[':id'].$patch({
                param: { id: String(revisionContractId) },
                json: contract,
              })
            : await contractsApi.$post({
                json: { employmentId: editingId, ...contract },
              })
        if (!res.ok) throw new Error(await readError(res, 'Update failed'))
      } else if (rowDialogMode === 'create') {
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
      const api = getChildApi(client, reviewResource ?? config.id)
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
        <FormDialogError>{status ?? lookupError}</FormDialogError>
        {config.id === 'family-infos' ? (
          <p className="text-sm text-muted-foreground">
            Wives {familyWifeCount(rows)} · Children {familyChildCount(rows)} ·
            Marital status{' '}
            {familyWifeCount(rows) >= 1
              ? 'Married'
              : (employee.maritalStatus ?? '—')}
          </p>
        ) : null}
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
                    const wf =
                      config.id === 'employments'
                        ? employmentDisplayStatus(row)
                        : rowWorkflowStatus(row)
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

          <div className="flex w-36 shrink-0 flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-start"
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
              className="w-full justify-start"
              disabled={
                loading ||
                !selectedRow ||
                (config.id === 'employments' &&
                  !canChangeEmployment(rowWorkflowStatus(selectedRow)))
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
                  className="w-full justify-start"
                  disabled={
                    loading ||
                    !selectedRow ||
                    (config.id === 'employments'
                      ? employmentDisplayStatus(selectedRow)
                      : rowWorkflowStatus(selectedRow)) !== 'PENDING'
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
                  className="w-full justify-start"
                  disabled={
                    loading ||
                    !selectedRow ||
                    (config.id === 'employments'
                      ? employmentDisplayStatus(selectedRow)
                      : rowWorkflowStatus(selectedRow)) !== 'PENDING'
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
              className="mt-auto w-full justify-start"
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
            : lockEmploymentFields
              ? 'Change contract'
              : `Change ${config.label}`
        }
        subtitle={`${employee.matricule} — ${employee.name}`}
        wide={config.id === 'employee-classifications'}
      >
        <FormDialogError>{formError ?? lookupError}</FormDialogError>
        <div
          className={cn(
            config.id === 'employee-classifications' &&
              'grid grid-cols-1 gap-x-4 sm:grid-cols-2',
          )}
        >
          {config.fields.map((field) => {
            const options = movementFieldOptions(
              field,
              lookups,
              form.From_unit_id ?? '',
            )
            const endRequired =
              field.name === 'endDate' && form.contractType === 'SPECIFIED'
            const label =
              field.required || endRequired
                ? `${field.label} *`
                : field.label
            const isClassifications = config.id === 'employee-classifications'
            const fieldLocked =
              lockEmploymentFields && isEmploymentDetailField(field.name)
            const control =
              field.type === 'select' ? (
                <Select
                  value={form[field.name] || undefined}
                  disabled={fieldLocked}
                  onValueChange={(value) =>
                    setForm((prev) => {
                      const next = { ...prev, [field.name]: value }
                      if (
                        field.name === 'From_unit_id' &&
                        next.To_unit_id &&
                        unitCodesMatch(next.To_unit_id, value)
                      ) {
                        next.To_unit_id = ''
                      }
                      return next
                    })
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
                  disabled={fieldLocked}
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
        subtitle={reviewResource === 'contracts' ? 'Contract' : config.label}
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
