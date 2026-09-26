import type {
  EmployeeListResponse,
  EmployeeOption,
  User,
  WorkflowStatus,
} from '@perf-appraisal-app/shared'
import {
  Check,
  Eye,
  FolderOpen,
  Pencil,
  Plus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogPagination,
  CatalogScreen,
  CatalogSortableTh,
  CatalogViewGrid,
  type CatalogStat,
} from './catalog'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogHint,
  FormDialogRow,
} from './form-dialog'
import { PersonnelChildTableDialog } from './personnel/PersonnelChildTableDialog'
import {
  PERSONNEL_CHILD_TABLES,
  type PersonnelChildTableConfig,
} from './personnel/personnelChildTables'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PersonnelConsoleProps = {
  currentUser: User
  onClose: () => void
}

type TabKey = 'list' | 'general' | 'details' | 'designation' | 'salary'

type FormState = {
  matricule: string
  name: string
  firstname: string
  dateBirth: string
  placeBirth: string
  sex: string
  nationality: string
}

type SortBy = 'matricule' | 'name'

const PAGE_SIZE = 20

const FUTURE_TABS: Array<{ value: TabKey; label: string; disabled?: boolean }> =
  [
    { value: 'list', label: 'List' },
    { value: 'general', label: 'General' },
    { value: 'details', label: 'Details', disabled: true },
    { value: 'designation', label: 'Designation', disabled: true },
    { value: 'salary', label: 'Salary', disabled: true },
  ]

function emptyForm(): FormState {
  return {
    matricule: '',
    name: '',
    firstname: '',
    dateBirth: '',
    placeBirth: '',
    sex: '',
    nationality: '',
  }
}

function canMutate(status: WorkflowStatus) {
  return status === 'PENDING' || status === 'REJECTED'
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

/** 3 cols for ≤12 tables (3×3 / 3×4), 4 cols for ≤16+ (4×4). */
function childTableGridCols(n: number): 3 | 4 {
  return n <= 12 ? 3 : 4
}

export function PersonnelConsole({
  currentUser,
  onClose,
}: PersonnelConsoleProps) {
  const [tab, setTab] = useState<TabKey>('list')
  const [items, setItems] = useState<EmployeeOption[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingMatricule, setEditingMatricule] = useState<string | null>(null)
  const [viewRow, setViewRow] = useState<EmployeeOption | null>(null)
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeOption | null>(null)
  const [childTable, setChildTable] =
    useState<PersonnelChildTableConfig | null>(null)

  const [reviewAction, setReviewAction] = useState<{
    kind: 'validate' | 'reject'
    matricule: string
  } | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const canReviewWorkflow = currentUser.permissions.canValidate
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, total)

  const loadPage = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const employeesApi = client.personnel?.employees
      if (!employeesApi?.$get) {
        throw new Error(
          'Personnel API client is unavailable. Restart the desktop app.',
        )
      }
      const res = await employeesApi.$get({
        query: {
          page: String(page),
          limit: String(PAGE_SIZE),
          search: search.trim() || undefined,
          sortBy,
        },
      })
      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to load employees'))
      }
      const data = (await res.json()) as EmployeeListResponse
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
      if (typeof data.page === 'number' && data.page !== page) {
        setPage(data.page)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [page, search, sortBy])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchDraft === search) return
      setPage(1)
      setSearch(searchDraft)
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchDraft, search])

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Employees',
        value: total,
        icon: Users,
        tone: 'blue',
      },
      {
        label: 'On this page',
        value: items.length,
        icon: Users,
        tone: 'slate',
      },
    ],
    [total, items.length],
  )

  function setSort(column: SortBy) {
    setSortBy(column)
    setPage(1)
  }

  function openCreate() {
    setDialogMode('create')
    setEditingMatricule(null)
    setForm(emptyForm())
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(row: EmployeeOption) {
    setDialogMode('edit')
    setEditingMatricule(row.matricule)
    setForm({
      matricule: row.matricule,
      name: row.name,
      firstname: row.firstname ?? '',
      dateBirth: row.dateBirth,
      placeBirth: row.placeBirth,
      sex: row.sex,
      nationality: row.nationality ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  function openGeneral(row: EmployeeOption) {
    setSelectedEmployee(row)
    setTab('general')
  }

  function handleTabChange(value: string) {
    const next = value as TabKey
    setTab(next)
  }

  async function handleSave() {
    setFormError(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      if (dialogMode === 'create') {
        const payload = {
          matricule: form.matricule.trim(),
          name: form.name.trim(),
          firstname: form.firstname.trim() || null,
          dateBirth: form.dateBirth.trim(),
          placeBirth: form.placeBirth.trim(),
          sex: form.sex.trim(),
          nationality: form.nationality.trim() || null,
        }
        if (
          !payload.matricule ||
          !payload.name ||
          !payload.dateBirth ||
          !payload.placeBirth ||
          !payload.sex
        ) {
          throw new Error('Matricule, surname, birth date, place, and sex are required')
        }
        const res = await client.personnel.employees.$post({ json: payload })
        if (!res.ok) {
          throw new Error(await readError(res, 'Create failed'))
        }
      } else {
        if (!editingMatricule) throw new Error('Missing matricule')
        const payload = {
          name: form.name.trim(),
          firstname: form.firstname.trim() || null,
          dateBirth: form.dateBirth.trim(),
          placeBirth: form.placeBirth.trim(),
          sex: form.sex.trim(),
          nationality: form.nationality.trim() || null,
        }
        const res = await client.personnel.employees[':matricule'].$patch({
          param: { matricule: editingMatricule },
          json: payload,
        })
        if (!res.ok) {
          throw new Error(await readError(res, 'Update failed'))
        }
      }
      setDialogOpen(false)
      await loadPage()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmReview() {
    if (!reviewAction) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const path =
        reviewAction.kind === 'validate'
          ? client.personnel.employees[':matricule'].validate
          : client.personnel.employees[':matricule'].reject
      const res = await path.$post({
        param: { matricule: reviewAction.matricule },
        json: { reviewNote: reviewNote.trim() || null },
      })
      if (!res.ok) {
        throw new Error(await readError(res, 'Review failed'))
      }
      setReviewAction(null)
      setReviewNote('')
      await loadPage()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const viewRows: Array<[string, string]> = viewRow
    ? [
        ['Matricule', viewRow.matricule],
        ['Surname', viewRow.name],
        ['First name', viewRow.firstname ?? '—'],
        ['Date of birth', viewRow.dateBirth],
        ['Place of birth', viewRow.placeBirth],
        ['Sex', viewRow.sex],
        ['Nationality', viewRow.nationality ?? '—'],
        ['Status', viewRow.workflowStatus],
        ['Review note', viewRow.reviewNote ?? '—'],
      ]
    : []

  return (
    <>
      <CatalogScreen
        brandIcon={Users}
        title="Personnel"
        subtitle="Employee records and related personnel data"
        headerActions={
          <>
            {tab === 'list' ? (
              <Button
                type="button"
                size="sm"
                onClick={openCreate}
                disabled={loading}
              >
                <Plus className="size-4" />
                Add employee
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        entityTabs={
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              {FUTURE_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  disabled={t.disabled}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
        cardTitle={
          tab === 'general'
            ? selectedEmployee
              ? `General — ${selectedEmployee.matricule}`
              : 'General'
            : 'All employees'
        }
        cardSubtitle={
          tab === 'general'
            ? selectedEmployee
              ? `${selectedEmployee.name}${
                  selectedEmployee.firstname
                    ? ` ${selectedEmployee.firstname}`
                    : ''
                }`
              : 'Select an employee on List'
            : loading
              ? 'Loading…'
              : `${total} records`
        }
        filterTabs={
          tab === 'list' ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Sort by</span>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="personnel-sort"
                  className="accent-primary"
                  checked={sortBy === 'matricule'}
                  onChange={() => setSort('matricule')}
                />
                Matr. No
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="personnel-sort"
                  className="accent-primary"
                  checked={sortBy === 'name'}
                  onChange={() => setSort('name')}
                />
                Surname
              </label>
            </div>
          ) : null
        }
        search={searchDraft}
        onSearchChange={setSearchDraft}
        searchPlaceholder="Search matricule, surname, first name…"
        showSearch={tab === 'list'}
        toolbarExtra={null}
        selectionBar={null}
        table={
          tab === 'general' ? (
            selectedEmployee ? (
              <div className="box-border flex h-full min-h-0 flex-col p-3">
                <div
                  className={cn(
                    'grid h-full min-h-0 flex-1 gap-3 overflow-hidden [grid-auto-rows:minmax(0,1fr)]',
                    'grid-cols-2',
                    childTableGridCols(PERSONNEL_CHILD_TABLES.length) === 3
                      ? 'md:grid-cols-3'
                      : 'md:grid-cols-4',
                  )}
                >
                  {PERSONNEL_CHILD_TABLES.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      className="flex min-h-0 items-center justify-center rounded-xl border bg-card px-3 py-2 text-center text-sm font-medium shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => setChildTable(table)}
                    >
                      {table.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Select an employee on the List tab, then open General (folder
                icon) to manage related records.
              </div>
            )
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <CatalogSortableTh
                  column="matricule"
                  label="Matricule"
                  sortKey={sortBy}
                  sortDir="asc"
                  onSort={(col) => setSort(col as SortBy)}
                />
                <CatalogSortableTh
                  column="name"
                  label="Surname"
                  sortKey={sortBy}
                  sortDir="asc"
                  onSort={(col) => setSort(col as SortBy)}
                />
                <TableHead>First name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {search.trim()
                      ? 'No employees match the search.'
                      : 'No employees found.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.matricule}>
                    <TableCell className="font-medium">{row.matricule}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.firstname ?? '—'}</TableCell>
                    <TableCell>
                      <WorkflowBadge status={row.workflowStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openGeneral(row)}
                          aria-label="Open General"
                          title="Open General"
                        >
                          <FolderOpen className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setViewRow(row)}
                          aria-label="View"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {canMutate(row.workflowStatus) ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => openEdit(row)}
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        {canReviewWorkflow &&
                        row.workflowStatus === 'PENDING' ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setReviewNote('')
                                setReviewAction({
                                  kind: 'validate',
                                  matricule: row.matricule,
                                })
                              }}
                              aria-label="Validate"
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                setReviewNote('')
                                setReviewAction({
                                  kind: 'reject',
                                  matricule: row.matricule,
                                })
                              }}
                              aria-label="Reject"
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )
        }
        pagination={
          tab === 'list' ? (
            <CatalogPagination
              pageStart={pageStart}
              pageEnd={pageEnd}
              total={total}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === 'create' ? 'Add employee' : 'Edit employee'}
        subtitle="Core identity fields from the employee record"
      >
        <FormDialogError>{formError}</FormDialogError>
        {dialogMode === 'create' ? (
          <FormDialogRow label="Matricule" htmlFor="emp-matricule">
            <Input
              id="emp-matricule"
              value={form.matricule}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, matricule: e.target.value }))
              }
            />
          </FormDialogRow>
        ) : (
          <FormDialogHint>
            Matricule <strong>{form.matricule}</strong> cannot be changed.
          </FormDialogHint>
        )}
        <FormDialogRow label="Surname" htmlFor="emp-name">
          <Input
            id="emp-name"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="First name" htmlFor="emp-firstname">
          <Input
            id="emp-firstname"
            value={form.firstname}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, firstname: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Date of birth" htmlFor="emp-dob">
          <Input
            id="emp-dob"
            type="date"
            value={form.dateBirth}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, dateBirth: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Place of birth" htmlFor="emp-pob">
          <Input
            id="emp-pob"
            value={form.placeBirth}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, placeBirth: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Sex" htmlFor="emp-sex">
          <Select
            value={form.sex || undefined}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, sex: value }))
            }
          >
            <SelectTrigger id="emp-sex">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="F">F</SelectItem>
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Nationality" htmlFor="emp-nationality">
          <Input
            id="emp-nationality"
            value={form.nationality}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, nationality: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewRow != null}
        onOpenChange={(open) => {
          if (!open) setViewRow(null)
        }}
        title="Employee"
        subtitle={viewRow ? `${viewRow.matricule} — ${viewRow.name}` : undefined}
      >
        <CatalogViewGrid rows={viewRows} />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          {viewRow && canMutate(viewRow.workflowStatus) ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                openEdit(viewRow)
                setViewRow(null)
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setViewRow(null)}>
            Close
          </Button>
        </div>
      </FormDialog>

      <FormDialog
        open={reviewAction != null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewAction(null)
            setReviewNote('')
          }
        }}
        title={
          reviewAction?.kind === 'validate'
            ? 'Validate employee'
            : 'Reject employee'
        }
        subtitle={
          reviewAction
            ? `Matricule ${reviewAction.matricule}`
            : undefined
        }
      >
        <FormDialogRow label="Review note" htmlFor="emp-review-note">
          <Textarea
            id="emp-review-note"
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
              : reviewAction?.kind === 'validate'
                ? 'Validate'
                : 'Reject'
          }
          onPrimary={() => void confirmReview()}
          onCancel={() => {
            setReviewAction(null)
            setReviewNote('')
          }}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      {selectedEmployee ? (
        <PersonnelChildTableDialog
          open={childTable != null}
          onOpenChange={(next) => {
            if (!next) setChildTable(null)
          }}
          config={childTable}
          employee={selectedEmployee}
          currentUser={currentUser}
        />
      ) : null}
    </>
  )
}
