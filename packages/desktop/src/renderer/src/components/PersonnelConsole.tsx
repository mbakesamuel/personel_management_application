import {
  canEditWorkflowStatus,
  type EmployeeListResponse,
  type EmployeeOption,
  type User,
  type WorkflowStatus,
} from '@personel-management-app/shared'
import {
  Check,
  Eye,
  FolderOpen,
  MoreHorizontal,
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
import { PersonnelSanctionsDialog } from './personnel/PersonnelSanctionsDialog'
import {
  PERSONNEL_CHILD_TABLES,
  type PersonnelChildTableConfig,
} from './personnel/personnelChildTables'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  active: boolean
  image: string | null
  imageTouched: boolean
  hasImage: boolean
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

function asEmployeeSex(value: string): 'Male' | 'Female' | null {
  const sex = value.trim()
  return sex === 'Male' || sex === 'Female' ? sex : null
}

function emptyForm(): FormState {
  return {
    matricule: '',
    name: '',
    firstname: '',
    dateBirth: '',
    placeBirth: '',
    sex: '',
    nationality: '',
    active: true,
    image: null,
    imageTouched: false,
    hasImage: false,
  }
}

function initials(row: Pick<EmployeeOption, 'firstname' | 'name'>): string {
  const first = row.firstname?.trim().charAt(0) ?? ''
  const last = row.name.trim().charAt(0) ?? ''
  const letters = `${first}${last}`.toUpperCase()
  return letters || '?'
}

function displayName(row: Pick<EmployeeOption, 'firstname' | 'name'>): string {
  return [row.firstname?.trim(), row.name.trim()].filter(Boolean).join(' ')
}

const MAX_IMAGE_BYTES = 1_500_000

function EmployeeAvatar({
  matricule,
  hasImage,
  preview,
  fallback,
}: {
  matricule?: string
  hasImage: boolean
  preview?: string | null
  fallback: string
}) {
  const [src, setSrc] = useState<string | null>(preview ?? null)

  useEffect(() => {
    if (preview) {
      setSrc(preview)
      return
    }
    if (!hasImage || !matricule) {
      setSrc(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    void (async () => {
      try {
        const client = await createApiClient()
        const res = await client.personnel.employees[':matricule'].image.$get({
          param: { matricule },
        })
        if (!res.ok || cancelled) return
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setSrc(objectUrl)
      } catch {
        if (!cancelled) setSrc(null)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [matricule, hasImage, preview])

  return (
    <Avatar>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  )
}

function canMutate(status: WorkflowStatus, canEditValidated: boolean) {
  return canEditWorkflowStatus(status, canEditValidated)
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
  const [sanctionsOpen, setSanctionsOpen] = useState(false)

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
      sex: row.sex ?? '',
      nationality: row.nationality ?? '',
      active: row.active,
      image: null,
      imageTouched: false,
      hasImage: row.hasImage === true,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  function openGeneral(row: EmployeeOption) {
    setSelectedEmployee(row)
    setTab('general')
  }

  function rememberEmployee(row: EmployeeOption) {
    setItems((prev) =>
      prev.map((item) => (item.matricule === row.matricule ? row : item)),
    )
    setSelectedEmployee((prev) =>
      prev?.matricule === row.matricule ? row : prev,
    )
    setViewRow((prev) => (prev?.matricule === row.matricule ? row : prev))
  }

  async function setEmployeeActive(active: boolean) {
    if (!selectedEmployee) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.personnel.employees[':matricule'].$patch({
        param: { matricule: selectedEmployee.matricule },
        json: { active },
      })
      if (!res.ok) {
        throw new Error(await readError(res, 'Could not update active status'))
      }
      const row = (await res.json()) as EmployeeOption
      rememberEmployee(row)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
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
      const sex = asEmployeeSex(form.sex)
      if (dialogMode === 'create') {
        const matricule = form.matricule.trim()
        const name = form.name.trim()
        const dateBirth = form.dateBirth.trim()
        const placeBirth = form.placeBirth.trim()
        if (!matricule || !name || !dateBirth || !placeBirth || !sex) {
          throw new Error('Matricule, surname, birth date, place, and sex are required')
        }
        const payload = {
          matricule,
          name,
          firstname: form.firstname.trim() || null,
          dateBirth,
          placeBirth,
          sex,
          nationality: form.nationality.trim() || null,
          active: form.active,
          ...(form.image ? { image: form.image } : {}),
        }
        const res = await client.personnel.employees.$post({ json: payload })
        if (!res.ok) {
          throw new Error(await readError(res, 'Create failed'))
        }
        rememberEmployee((await res.json()) as EmployeeOption)
      } else {
        if (!editingMatricule) throw new Error('Missing matricule')
        const payload = {
          name: form.name.trim(),
          firstname: form.firstname.trim() || null,
          dateBirth: form.dateBirth.trim(),
          placeBirth: form.placeBirth.trim(),
          sex: sex ?? undefined,
          nationality: form.nationality.trim() || null,
          active: form.active,
          ...(form.imageTouched ? { image: form.image } : {}),
        }
        const res = await client.personnel.employees[':matricule'].$patch({
          param: { matricule: editingMatricule },
          json: payload,
        })
        if (!res.ok) {
          throw new Error(await readError(res, 'Update failed'))
        }
        rememberEmployee((await res.json()) as EmployeeOption)
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
        ['Sex', viewRow.sex ?? '—'],
        ['Nationality', viewRow.nationality ?? '—'],
        ['Active', viewRow.active ? 'Yes' : 'No'],
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
       /*  stats={stats} */
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
        toolbarExtra={
          tab === 'general' && selectedEmployee ? (
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selectedEmployee.active}
                disabled={loading}
                onChange={(e) => void setEmployeeActive(e.target.checked)}
              />
              Active
            </label>
          ) : null
        }
        selectionBar={null}
        table={
          tab === 'general' ? (
            selectedEmployee ? (
              <div className="box-border flex h-full min-h-0 flex-col gap-3 p-3">
                <div
                  className={cn(
                    'grid h-full min-h-0 flex-1 gap-3 overflow-hidden [grid-auto-rows:minmax(0,1fr)]',
                    'grid-cols-2',
                    childTableGridCols(PERSONNEL_CHILD_TABLES.length + 1) === 3
                      ? 'md:grid-cols-3'
                      : 'md:grid-cols-4',
                  )}
                >
                  {PERSONNEL_CHILD_TABLES.map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      className="flex min-h-0 flex-col items-start justify-center gap-1 rounded-xl border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => setChildTable(table)}
                    >
                      <span className="text-sm font-medium">{table.label}</span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {table.description}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex min-h-0 flex-col items-start justify-center gap-1 rounded-xl border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => setSanctionsOpen(true)}
                  >
                    <span className="text-sm font-medium">Sanctions</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      Memos, supporting documents, and sanctions.
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Select an employee on the List tab, then open General from the name
                or the actions menu.
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
                  label="Name"
                  sortKey={sortBy}
                  sortDir="asc"
                  onSort={(col) => setSort(col as SortBy)}
                />
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Engaged</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    {search.trim()
                      ? 'No employees match the search.'
                      : 'No employees found.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.matricule}>
                    <TableCell className="font-medium">{row.matricule}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          matricule={row.matricule}
                          hasImage={row.hasImage === true}
                          fallback={initials(row)}
                        />
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-primary hover:underline"
                          onClick={() => openGeneral(row)}
                        >
                          {displayName(row)}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{row.unitName?.trim() || '—'}</TableCell>
                    <TableCell>
                      <WorkflowBadge status={row.workflowStatus} />
                    </TableCell>
                    <TableCell>{row.dateEng ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openGeneral(row)}>
                            <FolderOpen className="size-4" />
                            Open General
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setViewRow(row)}>
                            <Eye className="size-4" />
                            View
                          </DropdownMenuItem>
                          {canMutate(
                            row.workflowStatus,
                            currentUser.permissions.canEditValidated,
                          ) ? (
                            <DropdownMenuItem onSelect={() => openEdit(row)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          {canReviewWorkflow &&
                          row.workflowStatus === 'PENDING' ? (
                            <>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setReviewNote('')
                                  setReviewAction({
                                    kind: 'validate',
                                    matricule: row.matricule,
                                  })
                                }}
                              >
                                <Check className="size-4" />
                                Validate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setReviewNote('')
                                  setReviewAction({
                                    kind: 'reject',
                                    matricule: row.matricule,
                                  })
                                }}
                              >
                                <XCircle className="size-4" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        <FormDialogRow label="Photo" htmlFor="emp-image">
          <div className="flex items-center gap-3">
            <EmployeeAvatar
              matricule={form.matricule || undefined}
              hasImage={!form.imageTouched && form.hasImage}
              preview={form.imageTouched ? form.image : null}
              fallback={initials({
                firstname: form.firstname,
                name: form.name || ' ',
              })}
            />
            <Input
              id="emp-image"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                if (!file.type.startsWith('image/')) {
                  setFormError('Choose an image file')
                  return
                }
                if (file.size > MAX_IMAGE_BYTES) {
                  setFormError('Image must be 1.5 MB or smaller')
                  return
                }
                const reader = new FileReader()
                reader.onload = () => {
                  const result =
                    typeof reader.result === 'string' ? reader.result : null
                  setFormError(null)
                  setForm((prev) => ({
                    ...prev,
                    image: result,
                    imageTouched: true,
                  }))
                }
                reader.readAsDataURL(file)
              }}
            />
            {form.imageTouched || form.hasImage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    image: null,
                    imageTouched: true,
                    hasImage: false,
                  }))
                }
              >
                Remove
              </Button>
            ) : null}
          </div>
        </FormDialogRow>
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
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
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
        <FormDialogRow label="Active" htmlFor="emp-active">
          <input
            id="emp-active"
            type="checkbox"
            className="size-4 accent-primary"
            checked={form.active}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, active: e.target.checked }))
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
        <div className="mb-4 flex items-center gap-3">
          {viewRow ? (
            <EmployeeAvatar
              matricule={viewRow.matricule}
              hasImage={viewRow.hasImage === true}
              fallback={initials(viewRow)}
            />
          ) : null}
          <p className="m-0 text-sm font-medium">
            {viewRow ? displayName(viewRow) : ''}
          </p>
        </div>
        <CatalogViewGrid rows={viewRows} />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          {viewRow &&
          canMutate(
            viewRow.workflowStatus,
            currentUser.permissions.canEditValidated,
          ) ? (
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
        <PersonnelSanctionsDialog
          open={sanctionsOpen}
          onOpenChange={setSanctionsOpen}
          employee={selectedEmployee}
          currentUser={currentUser}
        />
      ) : null}

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
