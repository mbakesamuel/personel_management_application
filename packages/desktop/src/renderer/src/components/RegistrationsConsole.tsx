import {
  PHONE_OUTSIDE_PREFIX_RANGES,
  phoneMatchesPrefixRanges,
  type AllowanceEmployeeOption,
  type CommunicationAllowanceOption,
  type CommunicationAmount,
  type CommunicationOperator,
  type CommunicationRegistration,
  type CommunicationServiceOption,
  type OperatorAccount,
} from '@personel-management-app/shared'
import { ArrowRightLeft, CalendarOff, List, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogPagination,
  CatalogScreen,
  CatalogSortableTh,
  CatalogViewGrid,
  useCatalogTable,
  useFitPageSize,
  type CatalogStat,
} from './catalog'
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

type RegistrationsConsoleProps = {
  onClose: () => void
  variant?: 'open' | 'closed'
  onAppointmentClosed?: (focus: {
    operatorIds: number[]
    fleetRegistrationId: number
    endDate: string
  }) => void
}

type DialogKind = 'registration' | 'remove' | 'transfer' | 'amount' | 'modify' | 'delete-lines' | null

type RegistrationForm = {
  matricule: string
  employeeName: string
  allowanceId: string
  appointmentDate: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatRanges(prefixes: CommunicationOperator['prefixes']) {
  if (prefixes.length === 0) return '—'
  return prefixes.map((range) => `${range.start}–${range.end}`).join(', ')
}

function phonePrefixError(
  phone: string,
  operator: CommunicationOperator | undefined,
  checked: boolean,
): string | null {
  if (!checked || !operator || !phone.trim()) return null
  if (phoneMatchesPrefixRanges(phone, operator.prefixes)) return null
  return PHONE_OUTSIDE_PREFIX_RANGES
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function moneyCents(value: number): number {
  return Math.round(value * 100)
}

function formatPlainMoney(value: number): string {
  const cents = moneyCents(value)
  if (cents % 100 === 0) return String(cents / 100)
  return (cents / 100).toFixed(2)
}

function amountsInForce(
  rows: CommunicationAmount[],
  registrationId: number,
): CommunicationAmount[] {
  const best = new Map<string, CommunicationAmount>()
  for (const row of rows) {
    if (row.fleetRegistrationId !== registrationId || !row.current) continue
    const key = `${row.operatorId}\0${row.phoneNumber}\0${row.serviceId}`
    const previous = best.get(key)
    if (!previous || row.id > previous.id) best.set(key, row)
  }
  return [...best.values()]
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

function StatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={
        open
          ? 'inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }
    >
      {open ? 'Open' : 'Closed'}
    </span>
  )
}

export function RegistrationsConsole({
  onClose,
  onAppointmentClosed,
  variant = 'open',
}: RegistrationsConsoleProps) {
  const closed = variant === 'closed'
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [accounts, setAccounts] = useState<OperatorAccount[]>([])
  const [registrations, setRegistrations] = useState<CommunicationRegistration[]>([])
  const [amounts, setAmounts] = useState<CommunicationAmount[]>([])
  const [services, setServices] = useState<CommunicationServiceOption[]>([])
  const [allowances, setAllowances] = useState<CommunicationAllowanceOption[]>([])
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({
    matricule: '',
    employeeName: '',
    allowanceId: '',
    appointmentDate: today(),
  })
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeHits, setEmployeeHits] = useState<AllowanceEmployeeOption[]>([])
  const [actionRegistration, setActionRegistration] =
    useState<CommunicationRegistration | null>(null)
  const [endDate, setEndDate] = useState(today())
  const [transferOperatorId, setTransferOperatorId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
  const [transferPhone, setTransferPhone] = useState('')
  const [transferPhoneChecked, setTransferPhoneChecked] = useState(false)
  const [selectedDetailIds, setSelectedDetailIds] = useState<number[]>([])
  const [modifyAmounts, setModifyAmounts] = useState<Record<number, string>>({})
  const [amountRegistrationId, setAmountRegistrationId] = useState('')
  const [amountOperatorId, setAmountOperatorId] = useState('')
  const [amountAccountId, setAmountAccountId] = useState('')
  const [amountPhone, setAmountPhone] = useState('')
  const [amountPhoneChecked, setAmountPhoneChecked] = useState(false)
  const [amountServiceId, setAmountServiceId] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [amountAdjustments, setAmountAdjustments] = useState<Record<number, string>>({})
  const [viewRegistrationId, setViewRegistrationId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [operatorsRes, registrationsRes, amountsRes, servicesRes, allowancesRes, accountsRes] =
        await Promise.all([
          client.communication.operators.$get(),
          client.communication.registrations.$get(),
          client.communication.amounts.$get(),
          client.communication.services.$get(),
          client.communication.allowances.$get(),
          client.communication['operator-accounts'].$get(),
        ])
      if (!operatorsRes.ok) throw new Error(await readError(operatorsRes, 'Failed to load operators'))
      if (!registrationsRes.ok) {
        throw new Error(await readError(registrationsRes, 'Failed to load registrations'))
      }
      if (!amountsRes.ok) throw new Error(await readError(amountsRes, 'Failed to load amounts'))
      if (!servicesRes.ok) throw new Error(await readError(servicesRes, 'Failed to load services'))
      if (!allowancesRes.ok) {
        throw new Error(await readError(allowancesRes, 'Failed to load allowances'))
      }
      if (!accountsRes.ok) {
        throw new Error(await readError(accountsRes, 'Failed to load accounts'))
      }
      setOperators((await operatorsRes.json()) as CommunicationOperator[])
      setRegistrations((await registrationsRes.json()) as CommunicationRegistration[])
      setAmounts((await amountsRes.json()) as CommunicationAmount[])
      setServices((await servicesRes.json()) as CommunicationServiceOption[])
      setAllowances((await allowancesRes.json()) as CommunicationAllowanceOption[])
      setAccounts((await accountsRes.json()) as OperatorAccount[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tableViewportRef = useRef<HTMLDivElement>(null)
  const pageSize = useFitPageSize(tableViewportRef)

  const listedRegistrations = useMemo(
    () =>
      registrations.filter((row) => (closed ? row.endDate != null : row.endDate == null)),
    [closed, registrations],
  )

  const registrationsTable = useCatalogTable({
    rows: listedRegistrations,
    getId: (row) => row.id,
    pageSize,
    matchesSearch: (row, query) =>
      [
        row.matricule,
        row.employeeName,
        row.operators.map((operator) => operator.name).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    getSortValue: (row, key) =>
      key === 'employee'
        ? row.employeeName
        : key === 'operator'
          ? row.operators.map((operator) => operator.name).join(', ')
          : key === 'ended'
            ? (row.endDate ?? '')
            : key === 'id'
              ? row.id
              : row.appointmentDate,
    defaultSortKey: closed ? 'ended' : 'id',
    defaultSortDir: 'desc',
  })

  const activeOperators = useMemo(
    () => operators.filter((row) => row.isActive),
    [operators],
  )
  const communicationAllowances = useMemo(
    () =>
      allowances.filter((row) =>
        row.allowanceName.toLowerCase().includes('communication'),
      ),
    [allowances],
  )

  const stats: CatalogStat[] = closed
    ? [
        {
          label: 'Closed registrations',
          value: listedRegistrations.length,
          icon: CalendarOff,
          tone: 'slate',
        },
      ]
    : [
        {
          label: 'Open registrations',
          value: listedRegistrations.length,
          icon: Phone,
          tone: 'emerald',
        },
        {
          label: 'Current amounts',
          value: amounts.filter((row) => row.current).length,
          icon: Phone,
          tone: 'teal',
        },
      ]

  function openCreate() {
    setFormError(null)
    setRegistrationForm({
      matricule: '',
      employeeName: '',
      allowanceId: communicationAllowances[0]?.id ?? '',
      appointmentDate: today(),
    })
    setEmployeeQuery('')
    setEmployeeHits([])
    setDialog('registration')
  }

  function openAmount(row: CommunicationRegistration) {
    setActionRegistration(row)
    setAmountRegistrationId(String(row.id))
    setAmountOperatorId('')
    setAmountAccountId('')
    setAmountPhone('')
    setAmountPhoneChecked(false)
    setAmountServiceId(services[0] ? String(services[0].id) : '')
    setAmountValue('')
    setAmountAdjustments({})
    setFormError(null)
    setDialog('amount')
  }

  function currentAmount(registrationId: number, serviceId: number): number | null {
    const matches = amounts.filter(
      (item) =>
        item.fleetRegistrationId === registrationId &&
        item.serviceId === serviceId &&
        item.current,
    )
    if (matches.length === 0) return null
    return matches.reduce((sum, item) => sum + item.amount, 0)
  }

  function registrationHeader(row: CommunicationRegistration): Array<[string, string]> {
    return [
      ['Employee', `${row.employeeName} (${row.matricule})`],
      [
        'Operators',
        row.operators.map((operator) => operator.name).join(', ') || '—',
      ],
      ['Allowance', row.allowanceName],
      ['Appointment date', row.appointmentDate],
      ['Ended', row.endDate ?? '—'],
      ['Status', row.endDate == null ? 'Open' : 'Closed'],
    ]
  }

  async function searchEmployees() {
    setFormError(null)
    try {
      const client = await createApiClient()
      const res = await client.communication.employees.$get({
        query: { q: employeeQuery },
      })
      if (!res.ok) throw new Error(await readError(res, 'Employee search failed'))
      setEmployeeHits((await res.json()) as AllowanceEmployeeOption[])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Employee search failed')
    }
  }

  async function saveRegistration() {
    setFormError(null)
    setLoading(true)
    try {
      if (!registrationForm.matricule) throw new Error('Choose an employee')
      const client = await createApiClient()
      const res = await client.communication.registrations.$post({
        json: {
          matricule: registrationForm.matricule,
          allowanceId: registrationForm.allowanceId,
          appointmentDate: registrationForm.appointmentDate,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setDialog(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveRemove() {
    if (!actionRegistration) return
    setFormError(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const res = await client.communication.registrations[':id'].remove.$post({
        param: { id: String(actionRegistration.id) },
        json: { endDate },
      })
      if (!res.ok) throw new Error(await readError(res, 'Remove failed'))
      const focus = {
        operatorIds: actionRegistration.operators.map((operator) => operator.id),
        fleetRegistrationId: actionRegistration.id,
        endDate,
      }
      setDialog(null)
      onAppointmentClosed?.(focus)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setLoading(false)
    }
  }

  function openModify() {
    setModifyAmounts(
      Object.fromEntries(selectedLines.map((line) => [line.id, String(line.amount)])),
    )
    setFormError(null)
    setDialog('modify')
  }

  function openDeleteLines() {
    setFormError(null)
    setDialog('delete-lines')
  }

  async function saveModify() {
    if (selectedLines.length === 0) return
    setFormError(null)
    setLoading(true)
    try {
      const lines = selectedLines.map((line) => {
        const raw = modifyAmounts[line.id]?.trim() ?? ''
        const amount = Number(raw)
        if (raw === '' || !Number.isFinite(amount) || amount < 0) {
          throw new Error(`Enter an amount for ${line.operatorName} ${line.serviceName}`)
        }
        return { id: line.id, amount }
      })
      const client = await createApiClient()
      const res = await client.communication.amounts.update.$post({
        json: { lines },
      })
      if (!res.ok) throw new Error(await readError(res, 'Modify failed'))
      setDialog(null)
      setSelectedDetailIds([])
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Modify failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveDeleteLines() {
    if (selectedDetailIds.length === 0) return
    setFormError(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const res = await client.communication.amounts.delete.$post({
        json: { detailIds: selectedDetailIds },
      })
      if (!res.ok) throw new Error(await readError(res, 'Remove failed'))
      setDialog(null)
      setSelectedDetailIds([])
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setLoading(false)
    }
  }

  function openTransfer() {
    setTransferOperatorId('')
    setTransferAccountId('')
    setTransferPhone('')
    setTransferPhoneChecked(false)
    setFormError(null)
    setDialog('transfer')
  }

  function toggleDetail(id: number, checked: boolean) {
    setSelectedDetailIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    )
  }

  async function saveTransfer() {
    if (selectedDetailIds.length === 0) return
    setFormError(null)
    setLoading(true)
    try {
      const operator = activeOperators.find((row) => String(row.id) === transferOperatorId)
      if (!operator) throw new Error('Choose an operator')
      if (operator.usesAccounts && !transferAccountId) {
        throw new Error('Account is required for this operator')
      }
      const client = await createApiClient()
      const res = await client.communication.amounts.transfer.$post({
        json: {
          detailIds: selectedDetailIds,
          operatorId: Number(transferOperatorId),
          operatorAccountId: operator.usesAccounts ? Number(transferAccountId) : null,
          phoneNumber: transferPhone.trim(),
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Transfer failed'))
      setDialog(null)
      setSelectedDetailIds([])
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveAmount() {
    setFormError(null)
    setLoading(true)
    try {
      const amount = Number(amountValue)
      if (!Number.isFinite(amount)) throw new Error('Enter an amount')
      if (!amountOperatorId) throw new Error('Select an operator')
      const operator = activeOperators.find((row) => String(row.id) === amountOperatorId)
      if (operator?.usesAccounts && !amountAccountId) {
        throw new Error('Account is required for this operator')
      }
      const client = await createApiClient()
      const res = await client.communication.amounts.$post({
        json: {
          fleetRegistrationId: Number(amountRegistrationId),
          serviceId: Number(amountServiceId),
          amount,
          operatorId: Number(amountOperatorId),
          operatorAccountId: operator?.usesAccounts ? Number(amountAccountId) : null,
          phoneNumber: amountPhone.trim(),
          adjustments: amountAdjustmentPayload,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setDialog(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const viewRegistration =
    registrations.find((row) => row.id === viewRegistrationId) ?? null
  const viewLines = viewRegistration
    ? amountsInForce(amounts, viewRegistration.id).sort(
        (a, b) =>
          a.operatorName.localeCompare(b.operatorName) ||
          a.serviceName.localeCompare(b.serviceName) ||
          a.id - b.id,
      )
    : []
  const selectedLines = viewLines.filter((line) => selectedDetailIds.includes(line.id))
  const modifyEntries = selectedLines.map((line) => {
    const raw = modifyAmounts[line.id]?.trim() ?? ''
    const amount = raw === '' ? null : Number(raw)
    return {
      line,
      amount: amount != null && Number.isFinite(amount) && amount >= 0 ? amount : null,
    }
  })
  const modifyValid =
    modifyEntries.length > 0 && modifyEntries.every((entry) => entry.amount != null)
  const modifyProjected = viewLines.reduce((sum, line) => {
    const edited = modifyEntries.find((entry) => entry.line.id === line.id)
    if (!edited) return sum + line.amount
    return sum + (edited.amount ?? 0)
  }, 0)
  const modifyAllowance = viewRegistration?.allowanceAmt ?? null
  const modifyWithin =
    modifyAllowance != null &&
    modifyValid &&
    moneyCents(modifyProjected) <= moneyCents(modifyAllowance)
  const blockedOperatorIds = new Set(selectedLines.map((line) => line.operatorId))
  const amountOperator = activeOperators.find((row) => String(row.id) === amountOperatorId)
  const transferOperator = activeOperators.find((row) => String(row.id) === transferOperatorId)
  const transferPhoneError = phonePrefixError(transferPhone, transferOperator, transferPhoneChecked)
  const transferMergeLines = viewLines.filter((line) => {
    if (!transferOperatorId || selectedDetailIds.includes(line.id)) return false
    if (String(line.operatorId) !== transferOperatorId) return false
    if (line.phoneNumber !== transferPhone.trim()) return false
    return selectedLines.some((selected) => selected.serviceId === line.serviceId)
  })
  const amountPhoneError = phonePrefixError(amountPhone, amountOperator, amountPhoneChecked)
  const amountRegistration = registrations.find(
    (row) => String(row.id) === amountRegistrationId,
  )
  const amountInForceLines =
    amountRegistrationId === ''
      ? []
      : amountsInForce(amounts, Number(amountRegistrationId))
  const amountLineKey = `${amountOperatorId}\0${amountPhone.trim()}\0${amountServiceId}`
  const amountReplacing = amountOperatorId !== '' && amountServiceId !== ''
  const otherAmountLines = amountReplacing
    ? amountInForceLines.filter(
        (row) =>
          `${row.operatorId}\0${row.phoneNumber}\0${row.serviceId}` !== amountLineKey,
      )
    : amountInForceLines
  const inForceNow = amountInForceLines.reduce((sum, row) => sum + row.amount, 0)
  function adjustedAmount(row: CommunicationAmount): number | null {
    const raw = amountAdjustments[row.id]
    if (raw == null) return row.amount
    if (raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
  const otherAmounts = otherAmountLines.map((row) => adjustedAmount(row))
  const otherAmountsValid = otherAmounts.every((value) => value != null)
  const enteredAmount = amountValue.trim() === '' ? null : Number(amountValue)
  const enteredAmountValid = enteredAmount != null && Number.isFinite(enteredAmount)
  const projectedTotal =
    otherAmounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) +
    (amountReplacing && enteredAmountValid ? enteredAmount : 0)
  const allowanceAmt = amountRegistration?.allowanceAmt ?? null
  const totalsMatch =
    allowanceAmt != null &&
    amountReplacing &&
    enteredAmountValid &&
    otherAmountsValid &&
    moneyCents(projectedTotal) <= moneyCents(allowanceAmt)
  const employeeHasOpenRegistration =
    registrationForm.matricule !== '' &&
    registrations.some(
      (row) => row.matricule === registrationForm.matricule && row.endDate == null,
    )
  const amountAdjustmentPayload = otherAmountLines.flatMap((row) => {
    const amount = adjustedAmount(row)
    if (amount == null || moneyCents(amount) === moneyCents(row.amount)) return []
    return [{ detailId: row.id, amount }]
  })

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <CatalogScreen
        brandIcon={Phone}
        title={closed ? 'Closed registrations' : 'Registration'}
        subtitle={
          closed
            ? 'Appointments that already have an end date'
            : 'Employee lines, and Airtime or Data amounts'
        }
        headerActions={
          <>
            {closed ? null : (
              <Button
                type="button"
                size="sm"
                onClick={openCreate}
                disabled={loading}
              >
                <Plus className="size-4" />
                Add 
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle={closed ? 'Closed registrations' : 'All registrations'}
        cardSubtitle={
          closed
            ? 'Airtime and Data are the amounts on the registration when it was closed'
            : 'Current Airtime and Data are the latest amounts on or before today'
        }
        filterTabs={null}
        search={registrationsTable.search}
        onSearchChange={registrationsTable.setSearch}
        searchPlaceholder="Search registrations…"
        selectionBar={null}
        tableViewportRef={tableViewportRef}
        table={
          loading && registrations.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <CatalogSortableTh
                    label="Employee"
                    column="employee"
                    sortKey={registrationsTable.sortKey}
                    sortDir={registrationsTable.sortDir}
                    onSort={registrationsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Operator"
                    column="operator"
                    sortKey={registrationsTable.sortKey}
                    sortDir={registrationsTable.sortDir}
                    onSort={registrationsTable.toggleSort}
                  />
                  {services.map((service) => (
                    <TableHead key={service.id}>{service.name}</TableHead>
                  ))}
                  <TableHead>Appointment</TableHead>
                  {closed ? (
                    <CatalogSortableTh
                      label="Ended"
                      column="ended"
                      sortKey={registrationsTable.sortKey}
                      sortDir={registrationsTable.sortDir}
                      onSort={registrationsTable.toggleSort}
                    />
                  ) : null}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrationsTable.paginated.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() => {
                          setViewRegistrationId(row.id)
                          setSelectedDetailIds([])
                        }}
                      >
                        {row.employeeName}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {row.matricule}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      {row.operators.map((operator) => operator.name).join(', ') || '—'}
                    </TableCell>
                    {services.map((service) => {
                      const value = currentAmount(row.id, service.id)
                      return (
                        <TableCell key={service.id}>
                          {value == null ? '—' : formatAmount(value)}
                        </TableCell>
                      )
                    })}
                    <TableCell>{row.appointmentDate}</TableCell>
                    {closed ? <TableCell>{row.endDate}</TableCell> : null}
                    <TableCell>
                      <StatusPill open={row.endDate == null} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewRegistrationId(row.id)
                            setSelectedDetailIds([])
                          }}
                        >
                          <List className="size-4" />
                          Details
                        </Button>
                        {closed ? null : (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setActionRegistration(row)
                              setEndDate(today())
                              setFormError(null)
                              setDialog('remove')
                            }}
                          >
                            <CalendarOff className="size-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }
        pagination={
          <CatalogPagination
            pageStart={registrationsTable.pageStart}
            pageEnd={registrationsTable.pageEnd}
            total={registrationsTable.sorted.length}
            page={registrationsTable.page}
            totalPages={registrationsTable.totalPages}
            onPageChange={registrationsTable.setPage}
          />
        }
      />

      <FormDialog
        open={dialog === 'registration'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Add registration"
        subtitle="One open allowance appointment per employee"
        wide
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Employee" htmlFor="reg-employee">
          <div className="flex gap-2">
            <Input
              id="reg-employee"
              value={employeeQuery}
              placeholder="Matricule or name"
              onChange={(e) => setEmployeeQuery(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Find"
              onClick={() => void searchEmployees()}
            >
              <Search className="size-4" />
            </Button>
          </div>
          {registrationForm.matricule ? (
            <p className="mt-2 text-sm">
              {registrationForm.employeeName} ({registrationForm.matricule})
            </p>
          ) : null}
          {employeeHasOpenRegistration ? (
            <p className="mt-2 text-xs text-destructive">
              This employee already has an open registration
            </p>
          ) : null}
          {employeeHits.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-auto rounded-md border">
              {employeeHits.map((hit) => (
                <li key={hit.matricule}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setRegistrationForm((prev) => ({
                        ...prev,
                        matricule: hit.matricule,
                        employeeName: hit.name,
                      }))
                      setEmployeeHits([])
                    }}
                  >
                    {hit.name} · {hit.matricule}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </FormDialogRow>
        <FormDialogRow label="Allowance">
          <Select
            value={registrationForm.allowanceId || undefined}
            onValueChange={(value) =>
              setRegistrationForm((prev) => ({ ...prev, allowanceId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select allowance" />
            </SelectTrigger>
            <SelectContent>
              {communicationAllowances.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.allowanceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Appointment date" htmlFor="reg-date">
          <Input
            id="reg-date"
            type="date"
            value={registrationForm.appointmentDate}
            onChange={(e) =>
              setRegistrationForm((prev) => ({ ...prev, appointmentDate: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveRegistration()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading || employeeHasOpenRegistration}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'remove'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Close appointment"
        subtitle="Use this when the employee is no longer eligible for the communication allowance."
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="End date" htmlFor="remove-date">
          <Input
            id="remove-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Close'}
          primaryVariant="destructive"
          onPrimary={() => void saveRemove()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'transfer'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title={selectedLines.length > 1 ? 'Transfer lines' : 'Transfer line'}
        subtitle={
          selectedLines.length === 0
            ? 'Select service lines to transfer'
            : selectedLines
                .map(
                  (line) =>
                    `${line.operatorName} · ${line.serviceName} · ${formatAmount(line.amount)}`,
                )
                .join(', ')
        }
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="New operator">
          <Select
            value={transferOperatorId || undefined}
            onValueChange={(value) => {
              const operator = activeOperators.find((row) => String(row.id) === value)
              setTransferOperatorId(value)
              if (!operator?.usesAccounts) setTransferAccountId('')
              if (transferPhone.trim()) setTransferPhoneChecked(true)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {activeOperators
                .filter((row) => !blockedOperatorIds.has(row.id))
                .map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        {activeOperators.find((row) => String(row.id) === transferOperatorId)?.usesAccounts ? (
          <FormDialogRow label="New account">
            <Select
              value={transferAccountId || undefined}
              onValueChange={setTransferAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((row) => String(row.operatorId) === transferOperatorId)
                  .map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.accountNo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="New phone" htmlFor="transfer-phone">
          <Input
            id="transfer-phone"
            value={transferPhone}
            onChange={(e) => setTransferPhone(e.target.value)}
            onBlur={() => setTransferPhoneChecked(true)}
          />
          {transferOperator && transferOperator.prefixes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              If set, must start with {formatRanges(transferOperator.prefixes)}
            </p>
          ) : null}
          {transferPhoneError ? (
            <p className="mt-2 text-xs text-destructive">{transferPhoneError}</p>
          ) : null}
          {transferMergeLines.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {transferMergeLines
                .map((line) => `${line.serviceName} will be added to the existing line`)
                .join('. ')}
            </p>
          ) : null}
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Transfer'}
          onPrimary={() => void saveTransfer()}
          onCancel={() => setDialog(null)}
          primaryDisabled={
            loading || !transferOperatorId || selectedLines.length === 0 || Boolean(transferPhoneError)
          }
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'amount'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Add amount"
        subtitle="The amounts in force cannot go over this employee's allowance allocation."
        wide
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Registration">
          <p className="text-sm font-medium">
            {amountRegistration
              ? `${amountRegistration.employeeName} · ${amountRegistration.matricule}`
              : '—'}
          </p>
        </FormDialogRow>
        <FormDialogRow label="Allocation">
          {allowanceAmt == null ? (
            <p className="text-sm text-destructive">
              No current allowance allocation for this employee
            </p>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{formatAmount(allowanceAmt)}</p>
              <p className="text-xs text-muted-foreground">
                In force {formatAmount(inForceNow)}
                {enteredAmountValid ? ` · After this save ${formatAmount(projectedTotal)}` : ''}
              </p>
            </div>
          )}
        </FormDialogRow>
        <FormDialogRow label="Operator">
          <Select
            value={amountOperatorId || undefined}
            onValueChange={(value) => {
              setAmountOperatorId(value)
              setAmountAccountId('')
              if (amountPhone.trim()) setAmountPhoneChecked(true)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {activeOperators.map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        {amountOperator?.usesAccounts ? (
          <FormDialogRow label="Account">
            <Select value={amountAccountId || undefined} onValueChange={setAmountAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((row) => String(row.operatorId) === amountOperatorId)
                  .map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.accountNo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="Phone" htmlFor="amount-phone">
          <Input
            id="amount-phone"
            value={amountPhone}
            onChange={(e) => setAmountPhone(e.target.value)}
            onBlur={() => setAmountPhoneChecked(true)}
          />
          {amountOperator && amountOperator.prefixes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              If set, must start with {formatRanges(amountOperator.prefixes)}
            </p>
          ) : null}
          {amountPhoneError ? (
            <p className="mt-2 text-xs text-destructive">{amountPhoneError}</p>
          ) : null}
        </FormDialogRow>
        <FormDialogRow label="Service">
          <Select value={amountServiceId || undefined} onValueChange={setAmountServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Amount" htmlFor="amount-value">
          <Input
            id="amount-value"
            inputMode="decimal"
            value={amountValue}
            onChange={(e) => setAmountValue(e.target.value)}
          />
          {allowanceAmt != null && enteredAmountValid && otherAmountsValid && !totalsMatch ? (
            <p className="mt-2 text-xs text-destructive">
              Amounts in force total {formatPlainMoney(projectedTotal)}, but the allowance
              allocation is {formatPlainMoney(allowanceAmt)}
            </p>
          ) : null}
          {allowanceAmt != null &&
          enteredAmountValid &&
          otherAmountsValid &&
          totalsMatch &&
          moneyCents(projectedTotal) < moneyCents(allowanceAmt) ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatAmount(allowanceAmt - projectedTotal)} still unallocated
            </p>
          ) : null}
        </FormDialogRow>
        {otherAmountLines.length > 0 ? (
          <FormDialogRow label="Other amounts">
            <div className="max-h-40 space-y-2 overflow-auto">
              {otherAmountLines.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_6.5rem] items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {row.operatorName} · {row.phoneNumber || 'No phone'} · {row.serviceName}
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`${row.operatorName} ${row.serviceName} amount`}
                    value={amountAdjustments[row.id] ?? String(row.amount)}
                    onChange={(e) =>
                      setAmountAdjustments((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </FormDialogRow>
        ) : null}
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveAmount()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading || Boolean(amountPhoneError) || !totalsMatch}
        />
      </FormDialog>

      <FormDialog
        open={viewRegistration != null}
        onOpenChange={(open) => {
          if (!open) {
            setViewRegistrationId(null)
            setSelectedDetailIds([])
          }
        }}
        title="Registration Details"
        wide
      >
        {viewRegistration ? (
          <CatalogViewGrid rows={registrationHeader(viewRegistration)} />
        ) : null}
        <div className="mt-4 space-y-2">
          {viewLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No amounts on this registration.</p>
          ) : (
            viewLines.map((line) => (
              <label key={line.id} className="flex items-center gap-2 text-sm">
                {viewRegistration?.endDate == null ? (
                  <input
                    type="checkbox"
                    checked={selectedDetailIds.includes(line.id)}
                    onChange={(event) => toggleDetail(line.id, event.target.checked)}
                    aria-label={`Transfer ${line.operatorName} ${line.serviceName}`}
                  />
                ) : null}
                <span>
                  {line.operatorName} · {line.serviceName} · {formatAmount(line.amount)}
                  {line.phoneNumber ? ` · ${line.phoneNumber}` : ''}
                  {line.accountNo ? ` · ${line.accountNo}` : ''}
                </span>
              </label>
            ))
          )}
        </div>
        {viewRegistration != null && viewRegistration.endDate == null ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openAmount(viewRegistration)}
            >
              <Plus className="size-4" />
              Add amount
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedLines.length === 0}
              onClick={openModify}
            >
              <Pencil className="size-4" />
              {selectedLines.length > 1
                ? `Modify ${selectedLines.length} lines`
                : 'Modify amount'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedLines.length === 0}
              onClick={openDeleteLines}
            >
              <Trash2 className="size-4" />
              {selectedLines.length > 1
                ? `Remove ${selectedLines.length} lines`
                : 'Remove line'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedLines.length === 0}
              onClick={openTransfer}
            >
              <ArrowRightLeft className="size-4" />
              {selectedLines.length > 1
                ? `Transfer ${selectedLines.length} lines`
                : 'Transfer'}
            </Button>
          </div>
        ) : null}
        <FormDialogActions
          primaryLabel="Close"
          onPrimary={() => {
            setViewRegistrationId(null)
            setSelectedDetailIds([])
          }}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'modify'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Modify amounts"
        subtitle="The amounts in force cannot go over this employee's allowance allocation."
      >
        {modifyEntries.map(({ line }) => (
          <FormDialogRow
            key={line.id}
            label={`${line.operatorName} · ${line.serviceName}`}
            htmlFor={`modify-${line.id}`}
          >
            <Input
              id={`modify-${line.id}`}
              inputMode="decimal"
              value={modifyAmounts[line.id] ?? ''}
              onChange={(event) =>
                setModifyAmounts((prev) => ({ ...prev, [line.id]: event.target.value }))
              }
            />
          </FormDialogRow>
        ))}
        {modifyAllowance != null && modifyValid && !modifyWithin ? (
          <p className="mt-2 text-xs text-destructive">
            Amounts in force total {formatPlainMoney(modifyProjected)}, but the allowance
            allocation is {formatPlainMoney(modifyAllowance)}
          </p>
        ) : null}
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveModify()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading || !modifyWithin}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'delete-lines'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Remove lines"
        subtitle="The appointment stays open. Only the selected service lines are removed."
      >
        <p className="text-sm">
          {selectedLines.length === 1
            ? `${selectedLines[0]?.operatorName} · ${selectedLines[0]?.serviceName}`
            : `${selectedLines.length} lines`}
        </p>
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogActions
          primaryLabel={loading ? 'Removing…' : 'Remove'}
          primaryVariant="destructive"
          onPrimary={() => void saveDeleteLines()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading || selectedLines.length === 0}
        />
      </FormDialog>
    </div>
  )
}
