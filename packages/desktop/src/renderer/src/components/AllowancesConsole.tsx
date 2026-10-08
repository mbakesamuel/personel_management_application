import type {
  AllowanceAllocationEligibility,
  AllowanceAllocationOption,
  AllowanceEmployeeOption,
  AllowanceOption,
  AllowanceRateOption,
  AllowanceTypeOption,
  PositionKeyword,
  User,
  WorkflowStatus,
} from '@personel-management-app/shared'
import { canEditWorkflowStatus, isAdmin } from '@personel-management-app/shared'
import {
  Banknote,
  Check,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogFilterTabs,
  CatalogPagination,
  CatalogScreen,
  CatalogSelectionBar,
  CatalogSortableTh,
  CatalogViewGrid,
  useCatalogTable,
  type CatalogStat,
} from './catalog'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogHint,
  FormDialogRow,
} from './form-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { cn } from '@/lib/utils'

type AllowancesConsoleProps = {
  currentUser: User
  onClose: () => void
}

type TabKey = 'types' | 'allowances' | 'rates' | 'allocations'

const ALL_TABS: TabKey[] = ['types', 'allowances', 'rates', 'allocations']

const TAB_PERMISSION: Record<TabKey, keyof User['permissions']> = {
  types: 'canAllowanceTypes',
  allowances: 'canAllowanceCatalog',
  rates: 'canAllowanceRates',
  allocations: 'canAllowanceAllocations',
}

function allowedAllowanceTabs(permissions: User['permissions']): TabKey[] {
  if (!permissions.canAllowances) return []
  return ALL_TABS.filter((key) => permissions[TAB_PERMISSION[key]])
}

type TypeForm = { id: string; allowanceTypeName: string }
type AllowanceForm = {
  id: string
  allowanceName: string
  allowanceTypeId: string
}
type RateForm = {
  allowanceId: string
  positionKeywordId: string
  allowanceAmtMin: string
  allowanceAmtMax: string
  effectiveDate: string
}
type AllocationForm = {
  matricule: string
  employeeName: string
  designation: string
  allowanceId: string
  allowanceAmt: string
  selectedAllowanceIds: string[]
  amountsByAllowanceId: Record<string, string>
  effectiveDate: string
}

type ViewState =
  | { kind: 'type'; row: AllowanceTypeOption }
  | { kind: 'allowance'; row: AllowanceOption }
  | { kind: 'rate'; row: AllowanceRateOption }
  | { kind: 'allocation'; row: AllowanceAllocationOption }

type ReviewAction = {
  kind: 'validate' | 'reject'
  target:
    | { entity: 'type'; id: string }
    | { entity: 'allowance'; id: string }
    | { entity: 'rate'; id: number }
    | { entity: 'allocation'; id: number }
}

const PAGE_SIZE = 10
const NONE_TYPE = '__none__'
const NONE_POSITION = '__none__'

const SEARCH_PLACEHOLDER: Record<TabKey, string> = {
  types: 'Search types…',
  allowances: 'Search allowances…',
  rates: 'Search rates…',
  allocations: 'Search allocations…',
}

const CARD_TITLE: Record<TabKey, string> = {
  types: 'All Types',
  allowances: 'All Allowances',
  rates: 'All Rates',
  allocations: 'All Allocations',
}

const ADD_LABEL: Record<TabKey, string> = {
  types: 'Type',
  allowances: 'Allowance',
  rates: 'Rate',
  allocations: 'Allocation',
}

function canDelete(status: WorkflowStatus) {
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

function CurrentBadge({ current }: { current: boolean }) {
  if (!current) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
      Current
    </span>
  )
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatAmountRange(min: number, max: number) {
  if (min === max) return formatAmount(min)
  return `${formatAmount(min)} – ${formatAmount(max)}`
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function AllowancesConsole({
  currentUser,
  onClose,
}: AllowancesConsoleProps) {
  const allowedTabs = useMemo(
    () => allowedAllowanceTabs(currentUser.permissions),
    [currentUser.permissions],
  )
  const [tab, setTab] = useState<TabKey>(
    () => allowedAllowanceTabs(currentUser.permissions)[0] ?? 'types',
  )
  const [types, setTypes] = useState<AllowanceTypeOption[]>([])
  const [allowances, setAllowances] = useState<AllowanceOption[]>([])
  const [rates, setRates] = useState<AllowanceRateOption[]>([])
  const [keywords, setKeywords] = useState<PositionKeyword[]>([])
  const [allocations, setAllocations] = useState<AllowanceAllocationOption[]>(
    [],
  )
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    | { entity: 'type'; id: string }
    | { entity: 'allowance'; id: string }
    | { entity: 'rate'; id: number }
    | { entity: 'allocation'; id: number }
    | null
  >(null)
  const [viewState, setViewState] = useState<ViewState | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingAllocationId, setEditingAllocationId] = useState<number | null>(
    null,
  )
  const [editingRateId, setEditingRateId] = useState<number | null>(null)

  const [typeForm, setTypeForm] = useState<TypeForm>({
    id: '',
    allowanceTypeName: '',
  })
  const [allowanceForm, setAllowanceForm] = useState<AllowanceForm>({
    id: '',
    allowanceName: '',
    allowanceTypeId: '',
  })
  const [rateForm, setRateForm] = useState<RateForm>({
    allowanceId: '',
    positionKeywordId: '',
    allowanceAmtMin: '',
    allowanceAmtMax: '',
    effectiveDate: '',
  })
  const [allocationForm, setAllocationForm] = useState<AllocationForm>({
    matricule: '',
    employeeName: '',
    designation: '',
    allowanceId: '',
    allowanceAmt: '',
    selectedAllowanceIds: [],
    amountsByAllowanceId: {},
    effectiveDate: '',
  })
  const [eligibility, setEligibility] =
    useState<AllowanceAllocationEligibility | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const eligibilityReqId = useRef(0)
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeResults, setEmployeeResults] = useState<
    AllowanceEmployeeOption[]
  >([])
  const [employeeSearching, setEmployeeSearching] = useState(false)

  const validatedTypes = useMemo(
    () => types.filter((row) => row.workflowStatus === 'VALIDATED'),
    [types],
  )
  const validatedAllowances = useMemo(
    () => allowances.filter((row) => row.workflowStatus === 'VALIDATED'),
    [allowances],
  )
  const activeKeywords = useMemo(
    () => keywords.filter((row) => row.active),
    [keywords],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const perms = currentUser.permissions
      const needTypes =
        perms.canAllowanceTypes || perms.canAllowanceCatalog
      const needAllowances =
        perms.canAllowanceCatalog ||
        perms.canAllowanceRates ||
        perms.canAllowanceAllocations
      const needRates = perms.canAllowanceRates
      const needAllocations = perms.canAllowanceAllocations
      const needKeywords = perms.canAllowanceRates

      const [typesRes, allowancesRes, ratesRes, allocationsRes, keywordsRes] =
        await Promise.all([
          needTypes ? client.allowances.types.$get() : null,
          needAllowances ? client.allowances.$get() : null,
          needRates ? client.allowances.rates.$get({ query: {} }) : null,
          needAllocations
            ? client.allowances.allocations.$get({ query: {} })
            : null,
          needKeywords ? client['position-keywords'].$get() : null,
        ])

      if (typesRes && !typesRes.ok) {
        throw new Error(await readError(typesRes, 'Failed to load types'))
      }
      if (allowancesRes && !allowancesRes.ok) {
        throw new Error(
          await readError(allowancesRes, 'Failed to load allowances'),
        )
      }
      if (ratesRes && !ratesRes.ok) {
        throw new Error(await readError(ratesRes, 'Failed to load rates'))
      }
      if (allocationsRes && !allocationsRes.ok) {
        throw new Error(
          await readError(allocationsRes, 'Failed to load allocations'),
        )
      }
      if (keywordsRes && !keywordsRes.ok) {
        throw new Error(
          await readError(keywordsRes, 'Failed to load keywords'),
        )
      }

      setTypes(
        typesRes
          ? ((await typesRes.json()) as AllowanceTypeOption[])
          : [],
      )
      setAllowances(
        allowancesRes
          ? ((await allowancesRes.json()) as AllowanceOption[])
          : [],
      )
      setRates(
        ratesRes ? ((await ratesRes.json()) as AllowanceRateOption[]) : [],
      )
      setAllocations(
        allocationsRes
          ? ((await allocationsRes.json()) as AllowanceAllocationOption[])
          : [],
      )
      setKeywords(
        keywordsRes
          ? ((await keywordsRes.json()) as PositionKeyword[])
          : [],
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [currentUser.permissions])

  const loadEligibility = useCallback(async (matricule: string) => {
    const reqId = ++eligibilityReqId.current
    setEligibilityLoading(true)
    setFormError(null)
    try {
      const client = await createApiClient()
      const res = await client.allowances.allocations.eligibility.$get({
        query: { matricule },
      })
      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to load eligibility'))
      }
      const data = (await res.json()) as AllowanceAllocationEligibility
      if (reqId !== eligibilityReqId.current) return
      setEligibility(data)
      setAllocationForm((prev) => ({
        ...prev,
        employeeName: data.name || prev.employeeName,
        designation: data.designation?.trim() || prev.designation || '',
        selectedAllowanceIds: [],
        amountsByAllowanceId: {},
      }))
    } catch (err) {
      if (reqId !== eligibilityReqId.current) return
      setEligibility(null)
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      if (reqId === eligibilityReqId.current) {
        setEligibilityLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    setStatus(null)
  }, [tab])

  useEffect(() => {
    if (!dialogOpen || tab !== 'allocations' || dialogMode !== 'create') return
    if (allocationForm.matricule) return
    const q = employeeQuery.trim()
    if (q.length < 1) {
      setEmployeeResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setEmployeeSearching(true)
        try {
          const client = await createApiClient()
          const res = await client.allowances.employees.$get({
            query: { q },
          })
          if (!res.ok || cancelled) return
          setEmployeeResults((await res.json()) as AllowanceEmployeeOption[])
        } catch {
          if (!cancelled) setEmployeeResults([])
        } finally {
          if (!cancelled) setEmployeeSearching(false)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [dialogOpen, dialogMode, employeeQuery, tab, allocationForm.matricule])

  const matchesTypeSearch = useCallback(
    (row: AllowanceTypeOption, q: string) =>
      [row.id, row.allowanceTypeName, row.workflowStatus].some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    [],
  )
  const matchesAllowanceSearch = useCallback(
    (row: AllowanceOption, q: string) =>
      [
        row.id,
        row.allowanceName,
        row.allowanceTypeName ?? '',
        row.workflowStatus,
      ].some((v) => String(v).toLowerCase().includes(q)),
    [],
  )
  const matchesRateSearch = useCallback(
    (row: AllowanceRateOption, q: string) =>
      [
        row.id,
        row.allowanceName,
        row.positionKeyword ?? 'default',
        String(row.allowanceAmtMin),
        String(row.allowanceAmtMax),
        formatAmountRange(row.allowanceAmtMin, row.allowanceAmtMax),
        row.effectiveDate,
        row.workflowStatus,
        row.current ? 'current' : '',
      ].some((v) => String(v).toLowerCase().includes(q)),
    [],
  )
  const matchesAllocationSearch = useCallback(
    (row: AllowanceAllocationOption, q: string) =>
      [
        row.matricule,
        row.employeeName,
        row.allowanceName,
        String(row.allowanceAmt),
        row.effectiveDate,
        row.workflowStatus,
        row.current ? 'current' : '',
      ].some((v) => String(v).toLowerCase().includes(q)),
    [],
  )

  const typesTable = useCatalogTable({
    rows: types,
    getId: (row) => row.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesTypeSearch,
    getSortValue: (row, key) => {
      if (key === 'name') return row.allowanceTypeName
      if (key === 'status') return row.workflowStatus
      return row.id
    },
    defaultSortKey: 'name',
  })

  const allowancesTable = useCatalogTable({
    rows: allowances,
    getId: (row) => row.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesAllowanceSearch,
    getSortValue: (row, key) => {
      if (key === 'name') return row.allowanceName
      if (key === 'type') return row.allowanceTypeName ?? ''
      if (key === 'status') return row.workflowStatus
      return row.id
    },
    defaultSortKey: 'name',
  })

  const ratesTable = useCatalogTable({
    rows: rates,
    getId: (row) => row.id,
    pageSize: PAGE_SIZE,
    matchesTab: (row, activeTab) =>
      activeTab === 'all' || row.allowanceId === activeTab,
    matchesSearch: matchesRateSearch,
    getSortValue: (row, key) => {
      if (key === 'allowance') return row.allowanceName
      if (key === 'position') return row.positionKeyword ?? ''
      if (key === 'amount') return row.allowanceAmtMin
      if (key === 'date') return row.effectiveDate
      if (key === 'status') return row.workflowStatus
      if (key === 'current') return row.current ? 1 : 0
      return row.id
    },
    defaultSortKey: 'date',
    defaultSortDir: 'desc',
  })

  const allocationsTable = useCatalogTable({
    rows: allocations,
    getId: (row) => row.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesAllocationSearch,
    getSortValue: (row, key) => {
      if (key === 'matricule') return row.matricule
      if (key === 'employee') return row.employeeName
      if (key === 'allowance') return row.allowanceName
      if (key === 'amount') return row.allowanceAmt
      if (key === 'date') return row.effectiveDate
      if (key === 'status') return row.workflowStatus
      if (key === 'current') return row.current ? 1 : 0
      return row.id
    },
    defaultSortKey: 'date',
    defaultSortDir: 'desc',
  })

  const activeTable =
    tab === 'types'
      ? typesTable
      : tab === 'allowances'
        ? allowancesTable
        : tab === 'rates'
          ? ratesTable
          : allocationsTable

  const allowanceFilterTabs = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...validatedAllowances
        .slice()
        .sort((a, b) => a.allowanceName.localeCompare(b.allowanceName))
        .map((row) => ({ value: row.id, label: row.allowanceName })),
    ],
    [validatedAllowances],
  )

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Types',
        value: types.length,
        icon: Wallet,
        tone: 'blue',
      },
      {
        label: 'Allowances',
        value: allowances.length,
        icon: Banknote,
        tone: 'teal',
      },
      {
        label: 'Pending',
        value: [...types, ...allowances, ...rates, ...allocations].filter(
          (row) => row.workflowStatus === 'PENDING',
        ).length,
        icon: Search,
        tone: 'amber',
      },
      {
        label: 'Current rates',
        value: rates.filter((row) => row.current).length,
        icon: Check,
        tone: 'slate',
      },
    ],
    [types, allowances, rates, allocations],
  )

  function openCreate() {
    if (!allowedTabs.includes(tab)) return
    setDialogMode('create')
    setFormError(null)
    setEditingAllocationId(null)
    setEditingRateId(null)
    setEmployeeQuery('')
    setEmployeeResults([])
    if (tab === 'types') {
      setTypeForm({ id: '', allowanceTypeName: '' })
    } else if (tab === 'allowances') {
      setAllowanceForm({ id: '', allowanceName: '', allowanceTypeId: '' })
    } else if (tab === 'rates') {
      setRateForm({
        allowanceId:
          ratesTable.activeTab !== 'all' ? ratesTable.activeTab : '',
        positionKeywordId: '',
        allowanceAmtMin: '',
        allowanceAmtMax: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
      })
    } else {
      setEligibility(null)
      setAllocationForm({
        matricule: '',
        employeeName: '',
        designation: '',
        allowanceId: '',
        allowanceAmt: '',
        selectedAllowanceIds: [],
        amountsByAllowanceId: {},
        effectiveDate: new Date().toISOString().slice(0, 10),
      })
    }
    setDialogOpen(true)
  }

  function openEditType(row: AllowanceTypeOption) {
    setDialogMode('edit')
    setFormError(null)
    setTypeForm({ id: row.id, allowanceTypeName: row.allowanceTypeName })
    setDialogOpen(true)
  }

  function openEditAllowance(row: AllowanceOption) {
    setDialogMode('edit')
    setFormError(null)
    setAllowanceForm({
      id: row.id,
      allowanceName: row.allowanceName,
      allowanceTypeId: row.allowanceTypeId ?? '',
    })
    setDialogOpen(true)
  }

  function openEditRate(row: AllowanceRateOption) {
    setDialogMode('edit')
    setFormError(null)
    setEditingRateId(row.id)
    setRateForm({
      allowanceId: row.allowanceId,
      positionKeywordId:
        row.positionKeywordId != null ? String(row.positionKeywordId) : '',
      allowanceAmtMin: String(row.allowanceAmtMin),
      allowanceAmtMax: String(row.allowanceAmtMax),
      effectiveDate: row.effectiveDate,
    })
    setDialogOpen(true)
  }

  function openEditAllocation(row: AllowanceAllocationOption) {
    setDialogMode('edit')
    setFormError(null)
    setEditingAllocationId(row.id)
    setEligibility(null)
    setAllocationForm({
      matricule: row.matricule,
      employeeName: row.employeeName,
      designation: '',
      allowanceId: row.allowanceId,
      allowanceAmt: String(row.allowanceAmt),
      selectedAllowanceIds: [],
      amountsByAllowanceId: {},
      effectiveDate: row.effectiveDate,
    })
    setDialogOpen(true)
    void loadEligibility(row.matricule)
  }

  async function saveDialog() {
    setFormError(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      let res: Response
      if (tab === 'types') {
        const payload = {
          id: typeForm.id.trim(),
          allowanceTypeName: typeForm.allowanceTypeName.trim(),
        }
        if (!payload.id || !payload.allowanceTypeName) {
          throw new Error('ID and name are required')
        }
        res =
          dialogMode === 'edit'
            ? await client.allowances.types[':id'].$put({
                param: { id: payload.id },
                json: payload,
              })
            : await client.allowances.types.$post({ json: payload })
      } else if (tab === 'allowances') {
        const payload = {
          id: allowanceForm.id.trim(),
          allowanceName: allowanceForm.allowanceName.trim(),
          allowanceTypeId: allowanceForm.allowanceTypeId.trim() || null,
        }
        if (!payload.id || !payload.allowanceName) {
          throw new Error('ID and name are required')
        }
        res =
          dialogMode === 'edit'
            ? await client.allowances[':id'].$put({
                param: { id: payload.id },
                json: payload,
              })
            : await client.allowances.$post({ json: payload })
      } else if (tab === 'rates') {
        const minAmt = Number(rateForm.allowanceAmtMin)
        const maxAmt = Number(rateForm.allowanceAmtMax)
        if (!Number.isFinite(minAmt) || !Number.isFinite(maxAmt)) {
          throw new Error('Min and max amounts must be numbers')
        }
        if (minAmt > maxAmt) {
          throw new Error('Minimum amount must be ≤ maximum amount')
        }
        const payload = {
          allowanceId: rateForm.allowanceId.trim(),
          positionKeywordId: rateForm.positionKeywordId
            ? Number(rateForm.positionKeywordId)
            : null,
          allowanceAmtMin: minAmt,
          allowanceAmtMax: maxAmt,
          effectiveDate: rateForm.effectiveDate.trim(),
        }
        if (!payload.allowanceId || !payload.effectiveDate) {
          throw new Error('Allowance and effective date are required')
        }
        res =
          dialogMode === 'edit'
            ? await client.allowances.rates[':id'].$put({
                param: { id: String(editingRateId) },
                json: payload,
              })
            : await client.allowances.rates.$post({ json: payload })
      } else if (dialogMode === 'create') {
        const items = allocationForm.selectedAllowanceIds.map((allowanceId) => {
          const eligible = eligibility?.allowances.find(
            (row) => row.id === allowanceId,
          )
          if (
            !eligible ||
            eligible.rateMin == null ||
            eligible.rateMax == null
          ) {
            throw new Error(
              `No validated rate band for ${allowanceId}; cannot allocate`,
            )
          }
          const amount = Number(
            allocationForm.amountsByAllowanceId[allowanceId],
          )
          if (!Number.isFinite(amount)) {
            throw new Error(`Enter a valid amount for ${allowanceId}`)
          }
          return { allowanceId, allowanceAmt: amount }
        })
        const payload = {
          matricule: allocationForm.matricule.trim(),
          items,
          effectiveDate: allocationForm.effectiveDate.trim(),
        }
        if (
          !payload.matricule ||
          payload.items.length === 0 ||
          !payload.effectiveDate
        ) {
          throw new Error(
            'Employee, at least one eligible allowance with amount, and effective date are required',
          )
        }
        res = await client.allowances.allocations.batch.$post({ json: payload })
      } else {
        if (editingAllocationId == null) {
          throw new Error('Missing allocation id')
        }
        const amount = Number(allocationForm.allowanceAmt)
        if (!Number.isFinite(amount)) {
          throw new Error('Enter a valid amount')
        }
        const payload = {
          allowanceId: allocationForm.allowanceId.trim(),
          allowanceAmt: amount,
          effectiveDate: allocationForm.effectiveDate.trim(),
        }
        if (!payload.allowanceId || !payload.effectiveDate) {
          throw new Error('Allowance and effective date are required')
        }
        res = await client.allowances.allocations[':id'].$put({
          param: { id: String(editingAllocationId) },
          json: payload,
        })
      }
      if (!res.ok) {
        throw new Error(await readError(res, 'Save failed'))
      }
      setDialogOpen(false)
      await loadAll()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      let res: Response
      if (deleteTarget.entity === 'type') {
        res = await client.allowances.types[':id'].$delete({
          param: { id: deleteTarget.id },
        })
      } else if (deleteTarget.entity === 'allowance') {
        res = await client.allowances[':id'].$delete({
          param: { id: deleteTarget.id },
        })
      } else if (deleteTarget.entity === 'rate') {
        res = await client.allowances.rates[':id'].$delete({
          param: { id: String(deleteTarget.id) },
        })
      } else {
        res = await client.allowances.allocations[':id'].$delete({
          param: { id: String(deleteTarget.id) },
        })
      }
      if (!res.ok) {
        throw new Error(await readError(res, 'Delete failed'))
      }
      setConfirmDeleteOpen(false)
      setDeleteTarget(null)
      setViewState(null)
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitReview() {
    if (!reviewAction) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const body = { reviewNote: reviewNote.trim() || null }
      const { kind, target } = reviewAction
      let res: Response
      if (target.entity === 'type') {
        res =
          kind === 'validate'
            ? await client.allowances.types[':id'].validate.$post({
                param: { id: target.id },
                json: body,
              })
            : await client.allowances.types[':id'].reject.$post({
                param: { id: target.id },
                json: body,
              })
      } else if (target.entity === 'allowance') {
        res =
          kind === 'validate'
            ? await client.allowances[':id'].validate.$post({
                param: { id: target.id },
                json: body,
              })
            : await client.allowances[':id'].reject.$post({
                param: { id: target.id },
                json: body,
              })
      } else if (target.entity === 'rate') {
        res =
          kind === 'validate'
            ? await client.allowances.rates[':id'].validate.$post({
                param: { id: String(target.id) },
                json: body,
              })
            : await client.allowances.rates[':id'].reject.$post({
                param: { id: String(target.id) },
                json: body,
              })
      } else {
        res =
          kind === 'validate'
            ? await client.allowances.allocations[':id'].validate.$post({
                param: { id: String(target.id) },
                json: body,
              })
            : await client.allowances.allocations[':id'].reject.$post({
                param: { id: String(target.id) },
                json: body,
              })
      }
      if (!res.ok) {
        throw new Error(
          await readError(
            res,
            kind === 'validate' ? 'Validate failed' : 'Reject failed',
          ),
        )
      }
      setReviewAction(null)
      setReviewNote('')
      setViewState(null)
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const viewRows: Array<[string, string]> = viewState
    ? viewState.kind === 'type'
      ? [
          ['ID', viewState.row.id],
          ['Name', viewState.row.allowanceTypeName],
          ['Status', viewState.row.workflowStatus],
          ['Review note', viewState.row.reviewNote ?? '—'],
        ]
      : viewState.kind === 'allowance'
        ? [
            ['ID', viewState.row.id],
            ['Name', viewState.row.allowanceName],
            ['Type', viewState.row.allowanceTypeName ?? '—'],
            ['Status', viewState.row.workflowStatus],
            ['Review note', viewState.row.reviewNote ?? '—'],
          ]
        : viewState.kind === 'rate'
          ? [
              ['ID', String(viewState.row.id)],
              ['Allowance', viewState.row.allowanceName],
              ['Position', viewState.row.positionKeyword ?? 'Default (all)'],
              [
                'Amount',
                formatAmountRange(
                  viewState.row.allowanceAmtMin,
                  viewState.row.allowanceAmtMax,
                ),
              ],
              ['Effective date', viewState.row.effectiveDate],
              ['Current', viewState.row.current ? 'Yes' : 'No'],
              ['Status', viewState.row.workflowStatus],
              ['Review note', viewState.row.reviewNote ?? '—'],
            ]
          : [
              ['ID', String(viewState.row.id)],
              ['Matricule', viewState.row.matricule],
              ['Employee', viewState.row.employeeName],
              ['Allowance', viewState.row.allowanceName],
              ['Amount', formatAmount(viewState.row.allowanceAmt)],
              ['Effective date', viewState.row.effectiveDate],
              ['Current', viewState.row.current ? 'Yes' : 'No'],
              ['Status', viewState.row.workflowStatus],
              ['Review note', viewState.row.reviewNote ?? '—'],
            ]
    : []

  const viewPending =
    viewState != null && viewState.row.workflowStatus === 'PENDING'
  const canReviewWorkflow = currentUser.permissions.canValidate
  const viewEditable =
    viewState != null &&
    canEditWorkflowStatus(
      viewState.row.workflowStatus,
      currentUser.permissions.canEditValidated,
    )
  const canUseCurrentTab = allowedTabs.includes(tab)

  useEffect(() => {
    if (allowedTabs.length === 0) return
    if (!allowedTabs.includes(tab)) {
      setTab(allowedTabs[0]!)
    }
  }, [allowedTabs, tab])

  if (allowedTabs.length === 0) {
    return (
      <CatalogScreen
        brandIcon={Wallet}
        title="Allowances Management"
        subtitle="Types, definitions, rates, and employee allocations"
        headerActions={
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        }
        error={null}
        stats={[]}
        entityTabs={null}
        cardTitle="No access"
        cardSubtitle="Your role has no allowance tab permissions"
        filterTabs={null}
        search=""
        onSearchChange={() => undefined}
        searchPlaceholder=""
        selectionBar={null}
        table={
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Ask an administrator to grant Allowance types, catalog, rates, or
            allocations access.
          </div>
        }
        pagination={null}
      />
    )
  }

  return (
    <>
      <CatalogScreen
        brandIcon={Wallet}
        title="Allowances Management"
        subtitle="Types, definitions, rates, and employee allocations"
        headerActions={
          <>
            {canUseCurrentTab ? (
              <Button
                type="button"
                size="sm"
                onClick={openCreate}
                disabled={loading}
              >
                <Plus className="size-4" />
                Add {ADD_LABEL[tab]}
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
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as TabKey)}
          >
            <TabsList>
              {allowedTabs.includes('types') ? (
                <TabsTrigger value="types">Types</TabsTrigger>
              ) : null}
              {allowedTabs.includes('allowances') ? (
                <TabsTrigger value="allowances">Allowances</TabsTrigger>
              ) : null}
              {allowedTabs.includes('rates') ? (
                <TabsTrigger value="rates">Rates</TabsTrigger>
              ) : null}
              {allowedTabs.includes('allocations') ? (
                <TabsTrigger value="allocations">Allocations</TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>
        }
        cardTitle={CARD_TITLE[tab]}
        cardSubtitle={
          loading ? 'Loading…' : `${activeTable.filteredCount} records`
        }
        filterTabs={
          tab === 'rates' ? (
            <CatalogFilterTabs
              tabs={allowanceFilterTabs}
              value={ratesTable.activeTab}
              onChange={ratesTable.setActiveTab}
            />
          ) : null
        }
        search={activeTable.search}
        onSearchChange={activeTable.setSearch}
        searchPlaceholder={SEARCH_PLACEHOLDER[tab]}
        selectionBar={
          <CatalogSelectionBar
            count={activeTable.selectedIds.size}
            onClear={activeTable.clearSelection}
          />
        }
        table={
          tab === 'types' ? (
            <DataTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No types match the search.'
                  : 'No allowance types yet.'
              }
              colSpan={5}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={typesTable.allPageSelected}
                    onChange={typesTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={typesTable.sortKey}
                    sortDir={typesTable.sortDir}
                    onSort={typesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Name"
                    column="name"
                    sortKey={typesTable.sortKey}
                    sortDir={typesTable.sortDir}
                    onSort={typesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="status"
                    sortKey={typesTable.sortKey}
                    sortDir={typesTable.sortDir}
                    onSort={typesTable.toggleSort}
                  />
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {typesTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    typesTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'type', row })}
                >
                  <SelectCell
                    checked={typesTable.selectedIds.has(row.id)}
                    onChange={() => typesTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.allowanceTypeName}</TableCell>
                  <TableCell>
                    <WorkflowBadge status={row.workflowStatus} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    canEdit={canEditWorkflowStatus(
                      row.workflowStatus,
                      currentUser.permissions.canEditValidated,
                    )}
                    canDelete={canDelete(row.workflowStatus)}
                    canReview={
                      row.workflowStatus === 'PENDING' && canReviewWorkflow
                    }
                    onView={() => setViewState({ kind: 'type', row })}
                    onEdit={() => openEditType(row)}
                    onDelete={() => {
                      setDeleteTarget({ entity: 'type', id: row.id })
                      setConfirmDeleteOpen(true)
                    }}
                    onValidate={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'validate',
                        target: { entity: 'type', id: row.id },
                      })
                    }}
                    onReject={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'reject',
                        target: { entity: 'type', id: row.id },
                      })
                    }}
                  />
                </TableRow>
              ))}
            </DataTable>
          ) : tab === 'allowances' ? (
            <DataTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No allowances match the search.'
                  : 'No allowances yet.'
              }
              colSpan={6}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={allowancesTable.allPageSelected}
                    onChange={allowancesTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={allowancesTable.sortKey}
                    sortDir={allowancesTable.sortDir}
                    onSort={allowancesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Name"
                    column="name"
                    sortKey={allowancesTable.sortKey}
                    sortDir={allowancesTable.sortDir}
                    onSort={allowancesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Type"
                    column="type"
                    sortKey={allowancesTable.sortKey}
                    sortDir={allowancesTable.sortDir}
                    onSort={allowancesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="status"
                    sortKey={allowancesTable.sortKey}
                    sortDir={allowancesTable.sortDir}
                    onSort={allowancesTable.toggleSort}
                  />
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {allowancesTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    allowancesTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() =>
                    setViewState({ kind: 'allowance', row })
                  }
                >
                  <SelectCell
                    checked={allowancesTable.selectedIds.has(row.id)}
                    onChange={() => allowancesTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.allowanceName}</TableCell>
                  <TableCell>{row.allowanceTypeName ?? '—'}</TableCell>
                  <TableCell>
                    <WorkflowBadge status={row.workflowStatus} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    canEdit={canEditWorkflowStatus(
                      row.workflowStatus,
                      currentUser.permissions.canEditValidated,
                    )}
                    canDelete={canDelete(row.workflowStatus)}
                    canReview={
                      row.workflowStatus === 'PENDING' && canReviewWorkflow
                    }
                    onView={() => setViewState({ kind: 'allowance', row })}
                    onEdit={() => openEditAllowance(row)}
                    onDelete={() => {
                      setDeleteTarget({ entity: 'allowance', id: row.id })
                      setConfirmDeleteOpen(true)
                    }}
                    onValidate={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'validate',
                        target: { entity: 'allowance', id: row.id },
                      })
                    }}
                    onReject={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'reject',
                        target: { entity: 'allowance', id: row.id },
                      })
                    }}
                  />
                </TableRow>
              ))}
            </DataTable>
          ) : tab === 'rates' ? (
            <DataTable
              loading={loading}
              emptyLabel={
                activeTable.search || ratesTable.activeTab !== 'all'
                  ? 'No rates match the filters.'
                  : 'No rates yet.'
              }
              colSpan={9}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={ratesTable.allPageSelected}
                    onChange={ratesTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Allowance"
                    column="allowance"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Position"
                    column="position"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Amount"
                    column="amount"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Effective"
                    column="date"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Current"
                    column="current"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="status"
                    sortKey={ratesTable.sortKey}
                    sortDir={ratesTable.sortDir}
                    onSort={ratesTable.toggleSort}
                  />
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {ratesTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    ratesTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'rate', row })}
                >
                  <SelectCell
                    checked={ratesTable.selectedIds.has(row.id)}
                    onChange={() => ratesTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium tabular-nums">
                    {row.id}
                  </TableCell>
                  <TableCell>{row.allowanceName}</TableCell>
                  <TableCell>
                    {row.positionKeyword ?? (
                      <span className="text-muted-foreground">Default</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatAmountRange(row.allowanceAmtMin, row.allowanceAmtMax)}
                  </TableCell>
                  <TableCell>{row.effectiveDate}</TableCell>
                  <TableCell>
                    <CurrentBadge current={row.current} />
                  </TableCell>
                  <TableCell>
                    <WorkflowBadge status={row.workflowStatus} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    canEdit={canEditWorkflowStatus(
                      row.workflowStatus,
                      currentUser.permissions.canEditValidated,
                    )}
                    canDelete={canDelete(row.workflowStatus)}
                    canReview={
                      row.workflowStatus === 'PENDING' && canReviewWorkflow
                    }
                    onView={() => setViewState({ kind: 'rate', row })}
                    onEdit={() => openEditRate(row)}
                    onDelete={() => {
                      setDeleteTarget({ entity: 'rate', id: row.id })
                      setConfirmDeleteOpen(true)
                    }}
                    onValidate={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'validate',
                        target: { entity: 'rate', id: row.id },
                      })
                    }}
                    onReject={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'reject',
                        target: { entity: 'rate', id: row.id },
                      })
                    }}
                  />
                </TableRow>
              ))}
            </DataTable>
          ) : (
            <DataTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No allocations match the search.'
                  : 'No allocations yet.'
              }
              colSpan={9}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={allocationsTable.allPageSelected}
                    onChange={allocationsTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="Matricule"
                    column="matricule"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Employee"
                    column="employee"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Allowance"
                    column="allowance"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Amount"
                    column="amount"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Effective"
                    column="date"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Current"
                    column="current"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="status"
                    sortKey={allocationsTable.sortKey}
                    sortDir={allocationsTable.sortDir}
                    onSort={allocationsTable.toggleSort}
                  />
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {allocationsTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    allocationsTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() =>
                    setViewState({ kind: 'allocation', row })
                  }
                >
                  <SelectCell
                    checked={allocationsTable.selectedIds.has(row.id)}
                    onChange={() => allocationsTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.matricule}</TableCell>
                  <TableCell>{row.employeeName}</TableCell>
                  <TableCell>{row.allowanceName}</TableCell>
                  <TableCell>{formatAmount(row.allowanceAmt)}</TableCell>
                  <TableCell>{row.effectiveDate}</TableCell>
                  <TableCell>
                    <CurrentBadge current={row.current} />
                  </TableCell>
                  <TableCell>
                    <WorkflowBadge status={row.workflowStatus} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    canEdit={canEditWorkflowStatus(
                      row.workflowStatus,
                      currentUser.permissions.canEditValidated,
                    )}
                    canDelete={canDelete(row.workflowStatus)}
                    canReview={
                      row.workflowStatus === 'PENDING' && canReviewWorkflow
                    }
                    onView={() => setViewState({ kind: 'allocation', row })}
                    onEdit={() => openEditAllocation(row)}
                    onDelete={() => {
                      setDeleteTarget({ entity: 'allocation', id: row.id })
                      setConfirmDeleteOpen(true)
                    }}
                    onValidate={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'validate',
                        target: { entity: 'allocation', id: row.id },
                      })
                    }}
                    onReject={() => {
                      setReviewNote('')
                      setReviewAction({
                        kind: 'reject',
                        target: { entity: 'allocation', id: row.id },
                      })
                    }}
                  />
                </TableRow>
              ))}
            </DataTable>
          )
        }
        pagination={
          <CatalogPagination
            pageStart={activeTable.pageStart}
            pageEnd={activeTable.pageEnd}
            total={activeTable.sorted.length}
            page={activeTable.page}
            totalPages={activeTable.totalPages}
            onPageChange={activeTable.setPage}
          />
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`${dialogMode === 'create' ? 'Add' : 'Edit'} ${ADD_LABEL[tab]}`}
        subtitle={
          dialogMode === 'create' && isAdmin(currentUser.role)
            ? 'As administrator, this record will be validated immediately'
            : 'Allowance catalog and workflow records'
        }
        wide={tab === 'allocations'}
      >
        {tab === 'types' ? (
          <>
            <FormDialogRow label="ID" htmlFor="allowance-type-id">
              <Input
                id="allowance-type-id"
                value={typeForm.id}
                disabled={dialogMode === 'edit'}
                placeholder="e.g. TRANS"
                onChange={(e) =>
                  setTypeForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Name" htmlFor="allowance-type-name">
              <Input
                id="allowance-type-name"
                value={typeForm.allowanceTypeName}
                placeholder="e.g. Transport"
                onChange={(e) =>
                  setTypeForm((prev) => ({
                    ...prev,
                    allowanceTypeName: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {tab === 'allowances' ? (
          <>
            <FormDialogRow label="ID" htmlFor="allowance-id">
              <Input
                id="allowance-id"
                value={allowanceForm.id}
                disabled={dialogMode === 'edit'}
                placeholder="e.g. FUEL"
                onChange={(e) =>
                  setAllowanceForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Name" htmlFor="allowance-name">
              <Input
                id="allowance-name"
                value={allowanceForm.allowanceName}
                placeholder="e.g. Fuel allowance"
                onChange={(e) =>
                  setAllowanceForm((prev) => ({
                    ...prev,
                    allowanceName: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Type">
              <Select
                value={allowanceForm.allowanceTypeId || NONE_TYPE}
                onValueChange={(value) =>
                  setAllowanceForm((prev) => ({
                    ...prev,
                    allowanceTypeId: value === NONE_TYPE ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_TYPE}>None</SelectItem>
                  {validatedTypes
                    .concat(
                      types.filter(
                        (row) =>
                          row.id === allowanceForm.allowanceTypeId &&
                          row.workflowStatus !== 'VALIDATED',
                      ),
                    )
                    .map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.allowanceTypeName}
                        {row.workflowStatus === 'VALIDATED'
                          ? ''
                          : ` (${row.workflowStatus})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogHint>
              Only validated types appear for new selections.
            </FormDialogHint>
          </>
        ) : null}

        {tab === 'rates' ? (
          <>
            {dialogMode === 'edit' && editingRateId != null ? (
              <FormDialogRow label="ID">
                <Input value={String(editingRateId)} disabled />
              </FormDialogRow>
            ) : null}
            <FormDialogRow label="Allowance">
              <Select
                value={rateForm.allowanceId || undefined}
                onValueChange={(value) =>
                  setRateForm((prev) => ({ ...prev, allowanceId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select allowance" />
                </SelectTrigger>
                <SelectContent>
                  {validatedAllowances
                    .concat(
                      allowances.filter(
                        (row) =>
                          row.id === rateForm.allowanceId &&
                          row.workflowStatus !== 'VALIDATED',
                      ),
                    )
                    .map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.allowanceName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Position">
              <Select
                value={rateForm.positionKeywordId || NONE_POSITION}
                onValueChange={(value) =>
                  setRateForm((prev) => ({
                    ...prev,
                    positionKeywordId: value === NONE_POSITION ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default (all positions)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_POSITION}>
                    Default (all positions)
                  </SelectItem>
                  {activeKeywords
                    .concat(
                      keywords.filter(
                        (row) =>
                          String(row.id) === rateForm.positionKeywordId &&
                          !row.active,
                      ),
                    )
                    .map((row) => (
                      <SelectItem key={row.id} value={String(row.id)}>
                        {row.keyword}
                        {!row.active ? ' (inactive)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormDialogHint>
                Leave default for a band that applies to all positions.
              </FormDialogHint>
            </FormDialogRow>
            <FormDialogRow label="Min amount" htmlFor="rate-amt-min">
              <Input
                id="rate-amt-min"
                type="number"
                value={rateForm.allowanceAmtMin}
                placeholder="0"
                onChange={(e) =>
                  setRateForm((prev) => ({
                    ...prev,
                    allowanceAmtMin: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Max amount" htmlFor="rate-amt-max">
              <Input
                id="rate-amt-max"
                type="number"
                value={rateForm.allowanceAmtMax}
                placeholder="0"
                onChange={(e) =>
                  setRateForm((prev) => ({
                    ...prev,
                    allowanceAmtMax: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Effective" htmlFor="rate-date">
              <Input
                id="rate-date"
                type="date"
                value={rateForm.effectiveDate}
                onChange={(e) =>
                  setRateForm((prev) => ({
                    ...prev,
                    effectiveDate: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {tab === 'allocations' ? (
          <>
            <FormDialogRow label="Employee" htmlFor="alloc-employee">
              {dialogMode === 'edit' ? (
                <Input
                  id="alloc-employee"
                  value={`${allocationForm.matricule} — ${allocationForm.employeeName}`}
                  disabled
                />
              ) : (
                <div className="grid gap-2">
                  <Input
                    id="alloc-employee"
                    value={employeeQuery}
                    placeholder="Search matricule or name…"
                    onChange={(e) => {
                      setEmployeeQuery(e.target.value)
                      setEligibility(null)
                      setAllocationForm((prev) => ({
                        ...prev,
                        matricule: '',
                        employeeName: '',
                        designation: '',
                        selectedAllowanceIds: [],
                        amountsByAllowanceId: {},
                      }))
                    }}
                  />
                  {allocationForm.matricule ? (
                    <p className="text-sm text-muted-foreground">
                      Selected: {allocationForm.matricule} —{' '}
                      {allocationForm.employeeName}
                    </p>
                  ) : null}
                  {employeeSearching ? (
                    <p className="text-xs text-muted-foreground">Searching…</p>
                  ) : null}
                  {employeeResults.length > 0 ? (
                    <div className="max-h-40 overflow-auto rounded-md border">
                      {employeeResults.map((emp) => (
                        <button
                          key={emp.matricule}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setAllocationForm((prev) => ({
                              ...prev,
                              matricule: emp.matricule,
                              employeeName: emp.name,
                              designation: emp.designation?.trim() || '',
                              selectedAllowanceIds: [],
                              amountsByAllowanceId: {},
                            }))
                            setEmployeeQuery(`${emp.matricule} — ${emp.name}`)
                            setEmployeeResults([])
                            void loadEligibility(emp.matricule)
                          }}
                        >
                          <span>{emp.name}</span>
                          <span className="text-muted-foreground">
                            {emp.matricule}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </FormDialogRow>
            <FormDialogRow label="Position">
              <Input
                value={
                  eligibilityLoading && !allocationForm.designation
                    ? 'Loading…'
                    : allocationForm.designation ||
                      eligibility?.designation?.trim() ||
                      '—'
                }
                disabled
              />
            </FormDialogRow>
            {allocationForm.matricule ? (
              <FormDialogRow label="Keywords">
                {eligibilityLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : eligibility && eligibility.matchedKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {eligibility.matchedKeywords.map((kw) => (
                      <span
                        key={kw.id}
                        className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        {kw.keyword}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No position keywords match this title.
                  </p>
                )}
              </FormDialogRow>
            ) : null}
            {dialogMode === 'create' ? (
              <FormDialogRow label="Eligible allowances">
                {!allocationForm.matricule ? (
                  <p className="text-sm text-muted-foreground">
                    Select an employee to see eligible allowances.
                  </p>
                ) : eligibilityLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading eligibility…
                  </p>
                ) : !(
                    allocationForm.designation ||
                    eligibility?.designation?.trim()
                  ) ? (
                  <p className="text-sm text-muted-foreground">
                    No current position found for this employee.
                  </p>
                ) : !eligibility ? (
                  <p className="text-sm text-muted-foreground">
                    Loading eligibility…
                  </p>
                ) : eligibility.matchedKeywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No keywords match this position. Update position keywords
                    or the job title.
                  </p>
                ) : eligibility.allowances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Matched keywords have no linked allowances in the matrix.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="w-10 px-2 py-2 text-left font-medium" />
                          <th className="px-2 py-2 text-left font-medium">
                            Allowance
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Rate band
                          </th>
                          <th className="w-28 px-2 py-2 text-left font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibility.allowances.map((row) => {
                          const checked =
                            allocationForm.selectedAllowanceIds.includes(row.id)
                          const hasBand =
                            row.rateMin != null && row.rateMax != null
                          return (
                            <tr
                              key={row.id}
                              className="border-t hover:bg-muted/40"
                            >
                              <td className="px-2 py-2">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={checked}
                                  disabled={!hasBand}
                                  aria-label={row.allowanceName}
                                  onChange={(e) => {
                                    if (!hasBand) return
                                    const on = e.target.checked
                                    setAllocationForm((prev) => {
                                      const selected = on
                                        ? [...prev.selectedAllowanceIds, row.id]
                                        : prev.selectedAllowanceIds.filter(
                                            (id) => id !== row.id,
                                          )
                                      const amounts = {
                                        ...prev.amountsByAllowanceId,
                                      }
                                      if (on) {
                                        amounts[row.id] =
                                          row.rateMin != null
                                            ? String(row.rateMin)
                                            : amounts[row.id] || ''
                                      } else {
                                        delete amounts[row.id]
                                      }
                                      return {
                                        ...prev,
                                        selectedAllowanceIds: selected,
                                        amountsByAllowanceId: amounts,
                                      }
                                    })
                                  }}
                                />
                              </td>
                              <td className="px-2 py-2 font-medium">
                                {row.allowanceName}
                                {row.allowanceTypeName ? (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {row.allowanceTypeName}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                {hasBand
                                  ? formatAmountRange(row.rateMin!, row.rateMax!)
                                  : 'No rate configured'}
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  className="h-8"
                                  disabled={!checked || !hasBand}
                                  value={
                                    allocationForm.amountsByAllowanceId[
                                      row.id
                                    ] ?? ''
                                  }
                                  placeholder={
                                    hasBand ? String(row.rateMin) : ''
                                  }
                                  min={row.rateMin ?? undefined}
                                  max={row.rateMax ?? undefined}
                                  onChange={(e) =>
                                    setAllocationForm((prev) => ({
                                      ...prev,
                                      amountsByAllowanceId: {
                                        ...prev.amountsByAllowanceId,
                                        [row.id]: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {allocationForm.selectedAllowanceIds.length > 0 ? (
                  <FormDialogHint>
                    {allocationForm.selectedAllowanceIds.length} selected
                  </FormDialogHint>
                ) : null}
              </FormDialogRow>
            ) : (
              <>
                <FormDialogRow label="Allowance">
                  <Select
                    value={allocationForm.allowanceId || undefined}
                    onValueChange={(value) =>
                      setAllocationForm((prev) => ({
                        ...prev,
                        allowanceId: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select allowance" />
                    </SelectTrigger>
                    <SelectContent>
                      {validatedAllowances
                        .concat(
                          allowances.filter(
                            (row) =>
                              row.id === allocationForm.allowanceId &&
                              row.workflowStatus !== 'VALIDATED',
                          ),
                        )
                        .map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.allowanceName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormDialogRow>
                <FormDialogRow label="Amount" htmlFor="alloc-amt">
                  <Input
                    id="alloc-amt"
                    type="number"
                    value={allocationForm.allowanceAmt}
                    placeholder="0"
                    onChange={(e) =>
                      setAllocationForm((prev) => ({
                        ...prev,
                        allowanceAmt: e.target.value,
                      }))
                    }
                  />
                </FormDialogRow>
              </>
            )}
            <FormDialogRow label="Effective" htmlFor="alloc-date">
              <Input
                id="alloc-date"
                type="date"
                value={allocationForm.effectiveDate}
                onChange={(e) =>
                  setAllocationForm((prev) => ({
                    ...prev,
                    effectiveDate: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {formError ? <FormDialogError>{formError}</FormDialogError> : null}
        {dialogMode === 'create' && isAdmin(currentUser.role) ? (
          <FormDialogHint>
            Administrator create bypasses pending review and marks the record
            as validated.
          </FormDialogHint>
        ) : null}
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Saving…'
              : dialogMode === 'create'
                ? `Add ${ADD_LABEL[tab].toLowerCase()}`
                : 'Save changes'
          }
          onPrimary={() => void saveDialog()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewState != null}
        onOpenChange={(open) => {
          if (!open) setViewState(null)
        }}
        title="Record details"
        subtitle={
          viewState
            ? `${viewState.kind} · ${
                viewState.kind === 'allocation'
                  ? viewState.row.matricule
                  : viewState.row.id
              }`
            : undefined
        }
      >
        <CatalogViewGrid rows={viewRows} />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          {viewPending && canReviewWorkflow ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  if (!viewState) return
                  setReviewNote('')
                  setReviewAction({
                    kind: 'validate',
                    target:
                      viewState.kind === 'type'
                        ? { entity: 'type', id: viewState.row.id }
                        : viewState.kind === 'allowance'
                          ? { entity: 'allowance', id: viewState.row.id }
                          : viewState.kind === 'rate'
                            ? { entity: 'rate', id: viewState.row.id }
                            : {
                                entity: 'allocation',
                                id: viewState.row.id,
                              },
                  })
                }}
              >
                <Check className="size-4" />
                Validate
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={loading}
                onClick={() => {
                  if (!viewState) return
                  setReviewNote('')
                  setReviewAction({
                    kind: 'reject',
                    target:
                      viewState.kind === 'type'
                        ? { entity: 'type', id: viewState.row.id }
                        : viewState.kind === 'allowance'
                          ? { entity: 'allowance', id: viewState.row.id }
                          : viewState.kind === 'rate'
                            ? { entity: 'rate', id: viewState.row.id }
                            : {
                                entity: 'allocation',
                                id: viewState.row.id,
                              },
                  })
                }}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </>
          ) : null}
          {viewEditable && viewState ? (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                if (viewState.kind === 'type') openEditType(viewState.row)
                else if (viewState.kind === 'allowance')
                  openEditAllowance(viewState.row)
                else if (viewState.kind === 'rate') openEditRate(viewState.row)
                else openEditAllocation(viewState.row)
                setViewState(null)
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setViewState(null)}
          >
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
            ? 'Validate record'
            : 'Reject record'
        }
        subtitle={
          reviewAction?.kind === 'validate'
            ? 'Mark this pending record as validated'
            : 'Reject this pending record'
        }
      >
        <FormDialogRow label="Note" htmlFor="review-note">
          <textarea
            id="review-note"
            value={reviewNote}
            rows={3}
            placeholder="Optional review note"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onChange={(e) => setReviewNote(e.target.value)}
          />
        </FormDialogRow>
        <FormDialogHint>
          Signed in as {currentUser.username ?? `user #${currentUser.id}`}.
          {!isAdmin(currentUser.role)
            ? ' You cannot validate a record you created.'
            : null}
        </FormDialogHint>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Working…'
              : reviewAction?.kind === 'validate'
                ? 'Validate'
                : 'Reject'
          }
          onPrimary={() => void submitReview()}
          onCancel={() => {
            setReviewAction(null)
            setReviewNote('')
          }}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
            <AlertDialogDescription>
              Only pending or rejected records can be deleted. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DataTable({
  header,
  children,
  loading,
  emptyLabel,
  colSpan,
}: {
  header: ReactNode
  children: ReactNode
  loading: boolean
  emptyLabel: string
  colSpan: number
}) {
  const childArray = Array.isArray(children) ? children : [children]
  const empty = childArray.filter(Boolean).length === 0
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-muted">{header}</TableHeader>
      <TableBody>
        {loading && empty ? (
          <TableRow>
            <TableCell
              colSpan={colSpan}
              className="px-3 py-6 text-center text-muted-foreground"
            >
              Loading…
            </TableCell>
          </TableRow>
        ) : empty ? (
          <TableRow>
            <TableCell
              colSpan={colSpan}
              className="px-3 py-6 text-center text-muted-foreground"
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          children
        )}
      </TableBody>
    </Table>
  )
}

function SelectAllHead({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableHead className="w-10">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
        aria-label="Select all on page"
      />
    </TableHead>
  )
}

function SelectCell({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableCell>
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
        aria-label="Select row"
      />
    </TableCell>
  )
}

function RowActions({
  disabled,
  canEdit,
  canDelete,
  canReview,
  onView,
  onEdit,
  onDelete,
  onValidate,
  onReject,
}: {
  disabled?: boolean
  canEdit: boolean
  canDelete: boolean
  canReview: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onValidate: () => void
  onReject: () => void
}) {
  return (
    <TableCell className="text-right">
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          disabled={disabled}
          onClick={onView}
          title="View"
        >
          <Eye className="size-4" />
        </Button>
        {canEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={disabled}
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
        {canReview ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={disabled}
              onClick={onValidate}
              title="Validate"
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-destructive"
              disabled={disabled}
              onClick={onReject}
              title="Reject"
            >
              <XCircle className="size-4" />
            </Button>
          </>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive"
            disabled={disabled}
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </TableCell>
  )
}
