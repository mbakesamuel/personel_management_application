import {
  PHONE_OUTSIDE_PREFIX_RANGES,
  phoneMatchesPrefixRanges,
  type AllowanceEmployeeOption,
  type CommunicationAllowanceOption,
  type CommunicationAmount,
  type CommunicationOperator,
  type CommunicationRegistration,
  type CommunicationServiceOption,
} from '@personel-management-app/shared'
import { Phone, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogPagination,
  CatalogScreen,
  CatalogSortableTh,
  CatalogViewGrid,
  useCatalogTable,
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
}

type DialogKind = 'registration' | 'remove' | 'transfer' | 'amount' | null

type RegistrationForm = {
  matricule: string
  employeeName: string
  operatorId: string
  allowanceId: string
  accountNo: string
  phoneNumber: string
  effectiveDate: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatRanges(prefixes: CommunicationOperator['prefixes']) {
  if (prefixes.length === 0) return '—'
  return prefixes.map((range) => `${range.start}–${range.end}`).join(', ')
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
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

export function RegistrationsConsole({ onClose }: RegistrationsConsoleProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [registrations, setRegistrations] = useState<CommunicationRegistration[]>([])
  const [amounts, setAmounts] = useState<CommunicationAmount[]>([])
  const [services, setServices] = useState<CommunicationServiceOption[]>([])
  const [allowances, setAllowances] = useState<CommunicationAllowanceOption[]>([])
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({
    matricule: '',
    employeeName: '',
    operatorId: '',
    allowanceId: '',
    accountNo: '',
    phoneNumber: '',
    effectiveDate: today(),
  })
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeHits, setEmployeeHits] = useState<AllowanceEmployeeOption[]>([])
  const [actionRegistration, setActionRegistration] =
    useState<CommunicationRegistration | null>(null)
  const [endDate, setEndDate] = useState(today())
  const [transferOperatorId, setTransferOperatorId] = useState('')
  const [transferAccount, setTransferAccount] = useState('')
  const [transferPhone, setTransferPhone] = useState('')
  const [transferDate, setTransferDate] = useState(today())
  const [amountRegistrationId, setAmountRegistrationId] = useState('')
  const [amountServiceId, setAmountServiceId] = useState('')
  const [amountValue, setAmountValue] = useState('')
  const [amountDate, setAmountDate] = useState(today())
  const [viewRows, setViewRows] = useState<Array<[string, string]> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [operatorsRes, registrationsRes, amountsRes, servicesRes, allowancesRes] =
        await Promise.all([
          client.communication.operators.$get(),
          client.communication.registrations.$get(),
          client.communication.amounts.$get(),
          client.communication.services.$get(),
          client.communication.allowances.$get(),
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
      setOperators((await operatorsRes.json()) as CommunicationOperator[])
      setRegistrations((await registrationsRes.json()) as CommunicationRegistration[])
      setAmounts((await amountsRes.json()) as CommunicationAmount[])
      setServices((await servicesRes.json()) as CommunicationServiceOption[])
      setAllowances((await allowancesRes.json()) as CommunicationAllowanceOption[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const registrationsTable = useCatalogTable({
    rows: registrations,
    getId: (row) => row.id,
    matchesSearch: (row, query) =>
      [row.matricule, row.employeeName, row.operatorName, row.accountNo, row.phoneNumber]
        .join(' ')
        .toLowerCase()
        .includes(query),
    getSortValue: (row, key) =>
      key === 'employee' ? row.employeeName : key === 'operator' ? row.operatorName : row.effectiveDate,
    defaultSortKey: 'employee',
  })

  const openRegistrations = useMemo(
    () => registrations.filter((row) => row.endDate == null),
    [registrations],
  )
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

  const stats: CatalogStat[] = [
    { label: 'Open registrations', value: openRegistrations.length, icon: Phone, tone: 'emerald' },
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
      operatorId: '',
      allowanceId: communicationAllowances[0]?.id ?? '',
      accountNo: '',
      phoneNumber: '',
      effectiveDate: today(),
    })
    setEmployeeQuery('')
    setEmployeeHits([])
    setDialog('registration')
  }

  function openAmount(row: CommunicationRegistration) {
    setActionRegistration(row)
    setAmountRegistrationId(String(row.id))
    setAmountServiceId(services[0] ? String(services[0].id) : '')
    setAmountValue('')
    setAmountDate(today())
    setFormError(null)
    setDialog('amount')
  }

  function currentAmount(registrationId: number, serviceId: number): number | null {
    const match = amounts.find(
      (item) =>
        item.fleetRegistrationId === registrationId &&
        item.serviceId === serviceId &&
        item.current,
    )
    return match ? match.amount : null
  }

  function registrationDetails(row: CommunicationRegistration): Array<[string, string]> {
    const history = amounts
      .filter((item) => item.fleetRegistrationId === row.id)
      .sort(
        (a, b) =>
          b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id,
      )
    return [
      ['Employee', `${row.employeeName} (${row.matricule})`],
      ['Operator', row.operatorName],
      ['Allowance', row.allowanceName],
      ['Account', row.accountNo ?? '—'],
      ['Phone', row.phoneNumber],
      ['Joined', row.effectiveDate],
      ['Ended', row.endDate ?? '—'],
      ['Status', row.endDate == null ? 'Open' : 'Closed'],
      ...(history.length === 0
        ? ([['Amounts', '—']] as Array<[string, string]>)
        : history.map(
            (item) =>
              [
                `${item.serviceName} · ${item.effectiveDate}`,
                `${formatAmount(item.amount)}${item.current ? ' · current' : ''}`,
              ] as [string, string],
          )),
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
      if (!registrationForm.operatorId) throw new Error('Select an operator')
      const operator = activeOperators.find(
        (row) => String(row.id) === registrationForm.operatorId,
      )
      if (
        operator &&
        !phoneMatchesPrefixRanges(registrationForm.phoneNumber, operator.prefixes)
      ) {
        throw new Error(PHONE_OUTSIDE_PREFIX_RANGES)
      }
      const client = await createApiClient()
      const res = await client.communication.registrations.$post({
        json: {
          matricule: registrationForm.matricule,
          operatorId: Number(registrationForm.operatorId),
          allowanceId: registrationForm.allowanceId,
          accountNo: registrationForm.accountNo.trim(),
          phoneNumber: registrationForm.phoneNumber.trim(),
          effectiveDate: registrationForm.effectiveDate,
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
      setDialog(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveTransfer() {
    if (!actionRegistration) return
    setFormError(null)
    setLoading(true)
    try {
      const operator = activeOperators.find((row) => String(row.id) === transferOperatorId)
      if (operator && !phoneMatchesPrefixRanges(transferPhone, operator.prefixes)) {
        throw new Error(PHONE_OUTSIDE_PREFIX_RANGES)
      }
      const client = await createApiClient()
      const res = await client.communication.registrations[':id'].transfer.$post({
        param: { id: String(actionRegistration.id) },
        json: {
          operatorId: Number(transferOperatorId),
          accountNo: transferAccount.trim(),
          phoneNumber: transferPhone.trim(),
          effectiveDate: transferDate,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Transfer failed'))
      setDialog(null)
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
      const client = await createApiClient()
      const res = await client.communication.amounts.$post({
        json: {
          fleetRegistrationId: Number(amountRegistrationId),
          serviceId: Number(amountServiceId),
          amount,
          effectiveDate: amountDate,
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

  const registrationOperator = activeOperators.find(
    (row) => String(row.id) === registrationForm.operatorId,
  )
  const transferOperator = activeOperators.find((row) => String(row.id) === transferOperatorId)
  const amountRegistration = registrations.find(
    (row) => String(row.id) === amountRegistrationId,
  )

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <CatalogScreen
        brandIcon={Phone}
        title="Registration"
        subtitle="Employee lines, and Airtime or Data amounts"
        headerActions={
          <>
            <Button type="button" size="sm" onClick={openCreate} disabled={loading}>
              <Plus className="size-4" />
              Add Registration
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle="All registrations"
        cardSubtitle="Current Airtime and Data are the latest amounts on or before today"
        filterTabs={null}
        search={registrationsTable.search}
        onSearchChange={registrationsTable.setSearch}
        searchPlaceholder="Search registrations…"
        selectionBar={null}
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
                  <TableHead>Account</TableHead>
                  <TableHead>Phone</TableHead>
                  {services.map((service) => (
                    <TableHead key={service.id}>{service.name}</TableHead>
                  ))}
                  <TableHead>Joined</TableHead>
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
                        onClick={() => setViewRows(registrationDetails(row))}
                      >
                        {row.employeeName}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {row.matricule}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>{row.operatorName}</TableCell>
                    <TableCell>{row.accountNo ?? '—'}</TableCell>
                    <TableCell>{row.phoneNumber}</TableCell>
                    {services.map((service) => {
                      const value = currentAmount(row.id, service.id)
                      return (
                        <TableCell key={service.id}>
                          {value == null ? '—' : formatAmount(value)}
                        </TableCell>
                      )
                    })}
                    <TableCell>{row.effectiveDate}</TableCell>
                    <TableCell>
                      <StatusPill open={row.endDate == null} />
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {row.endDate == null ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openAmount(row)}
                          >
                            Amount
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActionRegistration(row)
                              setEndDate(today())
                              setFormError(null)
                              setDialog('remove')
                            }}
                          >
                            Remove
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActionRegistration(row)
                              const other = activeOperators.find((op) => op.id !== row.operatorId)
                              setTransferOperatorId(other ? String(other.id) : '')
                              setTransferAccount('')
                              setTransferPhone('')
                              setTransferDate(today())
                              setFormError(null)
                              setDialog('transfer')
                            }}
                          >
                            Transfer
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{row.endDate}</span>
                      )}
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
        subtitle="One open operator per employee"
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
            <Button type="button" variant="outline" onClick={() => void searchEmployees()}>
              Find
            </Button>
          </div>
          {registrationForm.matricule ? (
            <p className="mt-2 text-sm">
              {registrationForm.employeeName} ({registrationForm.matricule})
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
        <FormDialogRow label="Operator">
          <Select
            value={registrationForm.operatorId || undefined}
            onValueChange={(value) => {
              const operator = activeOperators.find((row) => String(row.id) === value)
              setRegistrationForm((prev) => ({
                ...prev,
                operatorId: value,
                accountNo: operator?.usesAccounts ? prev.accountNo : '',
              }))
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
        {activeOperators.find((row) => String(row.id) === registrationForm.operatorId)
          ?.usesAccounts ? (
          <FormDialogRow label="Account" htmlFor="reg-account">
            <Input
              id="reg-account"
              value={registrationForm.accountNo}
              onChange={(e) =>
                setRegistrationForm((prev) => ({ ...prev, accountNo: e.target.value }))
              }
            />
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="Phone" htmlFor="reg-phone">
          <Input
            id="reg-phone"
            value={registrationForm.phoneNumber}
            onChange={(e) =>
              setRegistrationForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
            }
          />
          {registrationOperator && registrationOperator.prefixes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Must start with {formatRanges(registrationOperator.prefixes)}
            </p>
          ) : null}
        </FormDialogRow>
        <FormDialogRow label="Joined" htmlFor="reg-date">
          <Input
            id="reg-date"
            type="date"
            value={registrationForm.effectiveDate}
            onChange={(e) =>
              setRegistrationForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveRegistration()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'remove'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Remove from operator"
        subtitle={
          actionRegistration
            ? `${actionRegistration.employeeName} · ${actionRegistration.operatorName}`
            : undefined
        }
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
          primaryLabel={loading ? 'Saving…' : 'Remove'}
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
        title="Transfer operator"
        subtitle="Closes this registration and copies the amounts in force"
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="New operator">
          <Select
            value={transferOperatorId || undefined}
            onValueChange={(value) => {
              const operator = activeOperators.find((row) => String(row.id) === value)
              setTransferOperatorId(value)
              if (!operator?.usesAccounts) setTransferAccount('')
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {activeOperators
                .filter((row) => row.id !== actionRegistration?.operatorId)
                .map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        {activeOperators.find((row) => String(row.id) === transferOperatorId)?.usesAccounts ? (
          <FormDialogRow label="New account" htmlFor="transfer-account">
            <Input
              id="transfer-account"
              value={transferAccount}
              onChange={(e) => setTransferAccount(e.target.value)}
            />
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="New phone" htmlFor="transfer-phone">
          <Input
            id="transfer-phone"
            value={transferPhone}
            onChange={(e) => setTransferPhone(e.target.value)}
          />
          {transferOperator && transferOperator.prefixes.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Must start with {formatRanges(transferOperator.prefixes)}
            </p>
          ) : null}
        </FormDialogRow>
        <FormDialogRow label="Transfer date" htmlFor="transfer-date">
          <Input
            id="transfer-date"
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Transfer'}
          onPrimary={() => void saveTransfer()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={dialog === 'amount'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Add amount"
        subtitle="Inserts a new Airtime or Data amount. Earlier rows stay as history."
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Registration">
          <p className="text-sm font-medium">
            {amountRegistration
              ? `${amountRegistration.employeeName} · ${amountRegistration.operatorName}`
              : '—'}
          </p>
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
        </FormDialogRow>
        <FormDialogRow label="Effective" htmlFor="amount-date">
          <Input
            id="amount-date"
            type="date"
            value={amountDate}
            onChange={(e) => setAmountDate(e.target.value)}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveAmount()}
          onCancel={() => setDialog(null)}
          primaryDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewRows != null}
        onOpenChange={(open) => {
          if (!open) setViewRows(null)
        }}
        title="Details"
      >
        {viewRows ? <CatalogViewGrid rows={viewRows} /> : null}
        <FormDialogActions
          primaryLabel="Close"
          onPrimary={() => setViewRows(null)}
          onCancel={() => setViewRows(null)}
        />
      </FormDialog>
    </div>
  )
}
