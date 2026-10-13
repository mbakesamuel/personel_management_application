import { useCallback, useEffect, useState, type ReactNode } from 'react'
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

type LeaveTypesConsoleProps = {
  onClose: () => void
}

type DocumentRequirement = { id: number; name: string; sortOrder: number }
type DurationRule = {
  id: number
  leaveTypeId?: number
  days: number
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}

type TypeRow = {
  id: number
  code: string
  name: string
  active: boolean
  category?: 'LEAVE' | 'PERMISSION'
  isPaid?: boolean
  deductBalance?: boolean
  maxDays?: number | null
  durationUnit?: 'WORKING_DAYS' | 'CALENDAR_WEEKS'
  description?: string | null
  documentRequirements?: DocumentRequirement[]
  durationRules?: DurationRule[]
}

const emptyTypeForm = {
  code: '',
  name: '',
  active: true,
  category: 'LEAVE' as 'LEAVE' | 'PERMISSION',
  isPaid: true,
  deductBalance: false,
  maxDays: '',
  durationUnit: 'WORKING_DAYS' as 'WORKING_DAYS' | 'CALENDAR_WEEKS',
  description: '',
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

function isoDay(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function currentEligible(row: TypeRow) {
  if (row.category !== 'PERMISSION' || row.isPaid === false) return null
  const today = new Date().toISOString().slice(0, 10)
  return (row.durationRules ?? [])
    .filter((rule) => {
      if (!rule.active) return false
      const from = isoDay(rule.effectiveFrom)
      const to = isoDay(rule.effectiveTo)
      return from <= today && (!to || to >= today)
    })
    .sort((left, right) =>
      isoDay(right.effectiveFrom).localeCompare(isoDay(left.effectiveFrom)),
    )[0]
}

function limitLabel(row: TypeRow) {
  const eligible = currentEligible(row)
  if (row.category === 'PERMISSION' && row.isPaid !== false) {
    return eligible ? String(eligible.days) : '—'
  }
  if (row.maxDays == null) return '—'
  return row.durationUnit === 'CALENDAR_WEEKS'
    ? `${row.maxDays} wk`
    : String(row.maxDays)
}

export function LeaveTypesConsole({ onClose }: LeaveTypesConsoleProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [types, setTypes] = useState<TypeRow[]>([])
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [typeForm, setTypeForm] = useState(emptyTypeForm)
  const [rules, setRules] = useState<DurationRule[]>([])
  const [ruleDays, setRuleDays] = useState('')
  const [ruleFrom, setRuleFrom] = useState('')
  const [ruleTo, setRuleTo] = useState('')
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [supportTypeId, setSupportTypeId] = useState('')
  const [supportNames, setSupportNames] = useState<string[]>([''])
  const [supportSaving, setSupportSaving] = useState(false)
  const [supportStatus, setSupportStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'LEAVE' | 'PERMISSION'>('all')
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const load = useCallback(async () => {
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.leave.types.$get()
      if (!res.ok) throw new Error(await readError(res, 'Failed to load types'))
      setTypes((await res.json()) as TypeRow[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const paidPermission = typeForm.category === 'PERMISSION' && typeForm.isPaid

  useEffect(() => {
    setRuleDays('')
    setRuleFrom('')
    setRuleTo('')
    setRuleError(null)
    if (!open || editingId == null || !paidPermission) {
      setRules([])
      return
    }
    setRules([])
    let cancelled = false
    void (async () => {
      try {
        const client = await createApiClient()
        const res = await client.leave['permission-durations'].$get({
          query: { leaveTypeId: String(editingId) },
        })
        if (!res.ok || cancelled) return
        const rows = (await res.json()) as DurationRule[]
        if (!cancelled) {
          setRules(rows.filter((rule) => rule.leaveTypeId === editingId))
        }
      } catch (err) {
        if (!cancelled) {
          setRuleError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, editingId, paidPermission])

  async function saveSupports() {
    if (!supportTypeId) return
    setSupportSaving(true)
    setSupportStatus(null)
    try {
      const names = supportNames.map((name) => name.trim()).filter(Boolean)
      const client = await createApiClient()
      const res = await client.leave.types[':id']['document-requirements'].$put({
        param: { id: supportTypeId },
        json: { names },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setSupportNames(names.length > 0 ? names : [''])
      setSupportStatus('Saved')
      await load()
    } catch (err) {
      setSupportStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSupportSaving(false)
    }
  }

  async function save() {
    setSaving(true)
    setFormError(null)
    try {
      const client = await createApiClient()
      const pendingPeriod =
        typeForm.category === 'PERMISSION' &&
        typeForm.isPaid &&
        (ruleDays.trim() || ruleFrom || ruleTo)
      if (pendingPeriod && (!ruleDays.trim() || !ruleFrom)) {
        throw new Error('Eligible days need both a number of days and an effective date')
      }
      const json = {
        code: typeForm.code,
        name: typeForm.name,
        active: typeForm.active,
        category: typeForm.category,
        isPaid: typeForm.isPaid,
        deductBalance: typeForm.deductBalance,
        maxDays:
          typeForm.category === 'PERMISSION' && typeForm.isPaid
            ? null
            : typeForm.maxDays.trim()
              ? Number(typeForm.maxDays)
              : null,
        durationUnit: typeForm.durationUnit,
        description: typeForm.description.trim() || null,
      }
      const res =
        editingId == null
          ? await client.leave.types.$post({ json })
          : await client.leave.types[':id'].$patch({
              param: { id: String(editingId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      const savedId =
        editingId ??
        ((await res.json()) as { id?: number }).id ??
        null
      if (pendingPeriod && savedId != null) {
        const ruleRes = await client.leave['permission-durations'].$post({
          json: {
            leaveTypeId: savedId,
            days: Number(ruleDays),
            effectiveFrom: ruleFrom,
            effectiveTo: ruleTo || null,
            active: true,
          },
        })
        if (!ruleRes.ok) throw new Error(await readError(ruleRes, 'Save failed'))
      }
      setRuleDays('')
      setRuleFrom('')
      setRuleTo('')
      setOpen(false)
      setEditingId(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function addRule() {
    if (editingId == null) return
    if (!ruleDays.trim() || !ruleFrom) {
      setRuleError('Days and effective date are required')
      return
    }
    setRuleSaving(true)
    setRuleError(null)
    try {
      const client = await createApiClient()
      const res = await client.leave['permission-durations'].$post({
        json: {
          leaveTypeId: editingId,
          days: Number(ruleDays),
          effectiveFrom: ruleFrom,
          effectiveTo: ruleTo || null,
          active: true,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setRuleDays('')
      setRuleFrom('')
      setRuleTo('')
      const list = await client.leave['permission-durations'].$get({
        query: { leaveTypeId: String(editingId) },
      })
      if (list.ok) {
        const rows = (await list.json()) as DurationRule[]
        setRules(rows.filter((rule) => rule.leaveTypeId === editingId))
      }
      await load()
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : String(err))
    } finally {
      setRuleSaving(false)
    }
  }

  async function removeRule(id: number) {
    if (editingId == null) return
    setRuleSaving(true)
    setRuleError(null)
    try {
      const client = await createApiClient()
      const res = await client.leave['permission-durations'][':id'].$delete({
        param: { id: String(id) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Delete failed'))
      setRules((current) => current.filter((rule) => rule.id !== id))
      await load()
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : String(err))
    } finally {
      setRuleSaving(false)
    }
  }

  const query = search.trim().toLowerCase()
  const visible = types.filter((row) => {
    if (categoryFilter === 'LEAVE' && row.category === 'PERMISSION') return false
    if (categoryFilter === 'PERMISSION' && row.category !== 'PERMISSION') return false
    if (paidFilter === 'paid' && row.isPaid === false) return false
    if (paidFilter === 'unpaid' && row.isPaid !== false) return false
    if (activeFilter === 'active' && !row.active) return false
    if (activeFilter === 'inactive' && row.active) return false
    if (!query) return true
    const haystack = [row.code, row.name, row.description ?? ''].join(' ').toLowerCase()
    return haystack.includes(query)
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leave types</h1>
          <p className="text-sm text-muted-foreground">
            Leave and permission types, and the documents each one requires.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      {status ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}

      <Section title="Leave types">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Search</span>
            <Input
              value={search}
              placeholder="Code, name, or description"
              className="w-56"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Category</span>
            <Select
              value={categoryFilter}
              onValueChange={(value) =>
                setCategoryFilter(
                  value === 'LEAVE' || value === 'PERMISSION' ? value : 'all',
                )
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="LEAVE">Leave</SelectItem>
                <SelectItem value="PERMISSION">Permission</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Paid</span>
            <Select
              value={paidFilter}
              onValueChange={(value) =>
                setPaidFilter(value === 'paid' || value === 'unpaid' ? value : 'all')
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Active</span>
            <Select
              value={activeFilter}
              onValueChange={(value) =>
                setActiveFilter(
                  value === 'active' || value === 'inactive' ? value : 'all',
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setEditingId(null)
              setTypeForm(emptyTypeForm)
              setFormError(null)
              setOpen(true)
            }}
          >
            Add
          </Button>
        </div>
        <SimpleTable
          headers={['Code', 'Name', 'Category', 'Paid', 'Deducts', 'Max', 'Active']}
          emptyLabel={
            types.length === 0 ? 'None yet.' : 'None match the filter.'
          }
          rows={visible.map((row) => [
            row.code,
            row.name,
            row.category === 'PERMISSION' ? 'Permission' : 'Leave',
            row.isPaid === false ? 'No' : 'Yes',
            row.deductBalance ? 'Yes' : 'No',
            limitLabel(row),
            row.active ? 'Yes' : 'No',
          ])}
          onEdit={(index) => {
            const row = visible[index]
            if (!row) return
            setEditingId(row.id)
            setTypeForm({
              code: row.code,
              name: row.name,
              active: row.active,
              category: row.category === 'PERMISSION' ? 'PERMISSION' : 'LEAVE',
              isPaid: row.isPaid !== false,
              deductBalance: row.deductBalance === true,
              maxDays: row.maxDays == null ? '' : String(row.maxDays),
              durationUnit:
                row.durationUnit === 'CALENDAR_WEEKS'
                  ? 'CALENDAR_WEEKS'
                  : 'WORKING_DAYS',
              description: row.description ?? '',
            })
            setFormError(null)
            setOpen(true)
          }}
        />
      </Section>

      <section className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground">
        <div>
          <h2 className="text-sm font-medium">Supporting documents</h2>
          <p className="text-sm text-muted-foreground">
            Named documents required for a leave type. The count is the number of names.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Leave type</span>
          <Select
            value={supportTypeId || undefined}
            onValueChange={(value) => {
              setSupportTypeId(value)
              setSupportStatus(null)
              const type = types.find((row) => String(row.id) === value)
              const names = type?.documentRequirements?.map((row) => row.name) ?? []
              setSupportNames(names.length > 0 ? names : [''])
            }}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {supportTypeId ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {supportNames.filter((name) => name.trim()).length} required
            </p>
            {supportNames.map((name, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={name}
                  placeholder={`Document ${index + 1}`}
                  onChange={(event) =>
                    setSupportNames((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSupportNames((prev) =>
                      prev.length === 1
                        ? ['']
                        : prev.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={supportNames.length >= 12}
                onClick={() => setSupportNames((prev) => [...prev, ''])}
              >
                Add document
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={supportSaving}
                onClick={() => void saveSupports()}
              >
                Save documents
              </Button>
            </div>
            {supportStatus ? (
              <p className="text-sm text-muted-foreground">{supportStatus}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <FormDialog
        open={open}
        wide={paidPermission}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false)
            setEditingId(null)
            setRules([])
            setRuleError(null)
          }
        }}
        title={editingId == null ? 'Add leave type' : 'Change leave type'}
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Code" htmlFor="leave-type-code">
          <Input
            id="leave-type-code"
            value={typeForm.code}
            onChange={(event) =>
              setTypeForm((prev) => ({ ...prev, code: event.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Name" htmlFor="leave-type-name">
          <Input
            id="leave-type-name"
            value={typeForm.name}
            onChange={(event) =>
              setTypeForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </FormDialogRow>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={typeForm.active}
            onChange={(event) =>
              setTypeForm((prev) => ({ ...prev, active: event.target.checked }))
            }
          />
          Active
        </label>
        <FormDialogRow label="Category" htmlFor="leave-type-category">
          <Select
            value={typeForm.category}
            onValueChange={(value) =>
              setTypeForm((prev) => ({
                ...prev,
                category: value === 'PERMISSION' ? 'PERMISSION' : 'LEAVE',
              }))
            }
          >
            <SelectTrigger id="leave-type-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEAVE">Leave</SelectItem>
              <SelectItem value="PERMISSION">Permission</SelectItem>
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Duration unit" htmlFor="leave-type-unit">
          <Select
            value={typeForm.durationUnit}
            onValueChange={(value) =>
              setTypeForm((prev) => ({
                ...prev,
                durationUnit:
                  value === 'CALENDAR_WEEKS' ? 'CALENDAR_WEEKS' : 'WORKING_DAYS',
              }))
            }
          >
            <SelectTrigger id="leave-type-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WORKING_DAYS">Working days</SelectItem>
              <SelectItem value="CALENDAR_WEEKS">Calendar weeks</SelectItem>
            </SelectContent>
          </Select>
        </FormDialogRow>
        {paidPermission ? (
          <p className="text-sm text-muted-foreground">
            Eligible days for a paid permission are set by date below. A request uses the row in force on its start date.
          </p>
        ) : (
          <FormDialogRow label="Max duration" htmlFor="leave-type-max">
            <Input
              id="leave-type-max"
              type="number"
              min={1}
              value={typeForm.maxDays}
              placeholder="Open"
              onChange={(event) =>
                setTypeForm((prev) => ({ ...prev, maxDays: event.target.value }))
              }
            />
          </FormDialogRow>
        )}
        <FormDialogRow label="Description" htmlFor="leave-type-description">
          <Input
            id="leave-type-description"
            value={typeForm.description}
            onChange={(event) =>
              setTypeForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </FormDialogRow>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={typeForm.isPaid}
            onChange={(event) =>
              setTypeForm((prev) => ({ ...prev, isPaid: event.target.checked }))
            }
          />
          Paid
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={typeForm.deductBalance}
            onChange={(event) =>
              setTypeForm((prev) => ({
                ...prev,
                deductBalance: event.target.checked,
              }))
            }
          />
          Deduct annual leave balance
        </label>
        {paidPermission && editingId != null ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              Eligible days for {typeForm.name || 'this permission'}
            </p>
            {ruleError ? (
              <p className="text-sm text-destructive">{ruleError}</p>
            ) : null}
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No periods yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Days</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{rule.days}</TableCell>
                      <TableCell>{isoDay(rule.effectiveFrom)}</TableCell>
                      <TableCell>{isoDay(rule.effectiveTo) || 'Open'}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={ruleSaving}
                          onClick={() => void removeRule(rule.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Days"
                value={ruleDays}
                onChange={(event) => setRuleDays(event.target.value)}
              />
              <Input
                type="date"
                aria-label="Effective from"
                value={ruleFrom}
                onChange={(event) => setRuleFrom(event.target.value)}
              />
              <Input
                type="date"
                aria-label="Effective to"
                value={ruleTo}
                onChange={(event) => setRuleTo(event.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ruleSaving}
              onClick={() => void addRule()}
            >
              {ruleSaving ? 'Saving…' : 'Add period'}
            </Button>
          </div>
        ) : paidPermission ? (
          <p className="text-sm text-muted-foreground">
            Save the type, then open it again to add the eligible days for each period.
          </p>
        ) : null}
        <FormDialogActions
          primaryLabel={saving ? 'Saving…' : 'Save'}
          onPrimary={() => void save()}
          onCancel={() => {
            setOpen(false)
            setEditingId(null)
          }}
          primaryDisabled={saving}
          cancelDisabled={saving}
        />
      </FormDialog>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function SimpleTable({
  headers,
  rows,
  onEdit,
  emptyLabel = 'None yet.',
}: {
  headers: string[]
  rows: string[][]
  onEdit?: (index: number) => void
  emptyLabel?: string
}) {
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
            {onEdit ? <TableHead className="w-24" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={headers.length + (onEdit ? 1 : 0)}
                className="text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={index}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex}>{cell}</TableCell>
                ))}
                {onEdit ? (
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(index)}
                    >
                      Change
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
