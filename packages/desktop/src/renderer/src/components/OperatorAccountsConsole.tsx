import type {
  CommunicationOperator,
  OperatorAccount,
} from '@personel-management-app/shared'
import { CreditCard, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogPagination,
  CatalogScreen,
  CatalogSortableTh,
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

type OperatorAccountsConsoleProps = {
  onClose: () => void
}

type AccountForm = {
  operatorId: string
  accountNo: string
}

const EMPTY_FORM: AccountForm = { operatorId: '', accountNo: '' }

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function OperatorAccountsConsole({ onClose }: OperatorAccountsConsoleProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [accounts, setAccounts] = useState<OperatorAccount[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [operatorsRes, accountsRes] = await Promise.all([
        client.communication.operators.$get(),
        client.communication['operator-accounts'].$get(),
      ])
      if (!operatorsRes.ok) {
        throw new Error(await readError(operatorsRes, 'Failed to load operators'))
      }
      if (!accountsRes.ok) {
        throw new Error(await readError(accountsRes, 'Failed to load accounts'))
      }
      setOperators((await operatorsRes.json()) as CommunicationOperator[])
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

  const table = useCatalogTable({
    rows: accounts,
    getId: (row) => row.id,
    matchesSearch: (row, query) =>
      [row.operatorName, row.accountNo].join(' ').toLowerCase().includes(query),
    getSortValue: (row, key) =>
      key === 'account' ? row.accountNo : row.operatorName,
    defaultSortKey: 'operator',
  })

  const stats: CatalogStat[] = [
    { label: 'Accounts', value: accounts.length, icon: CreditCard, tone: 'blue' },
  ]

  function openCreate() {
    setFormError(null)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(row: OperatorAccount) {
    setFormError(null)
    setEditingId(row.id)
    setForm({ operatorId: String(row.operatorId), accountNo: row.accountNo })
    setDialogOpen(true)
  }

  async function saveAccount() {
    setFormError(null)
    setLoading(true)
    try {
      if (!form.operatorId) throw new Error('Select an operator')
      if (!form.accountNo.trim()) throw new Error('Account number is required')
      const client = await createApiClient()
      const json = {
        operatorId: Number(form.operatorId),
        accountNo: form.accountNo.trim(),
      }
      const res =
        editingId == null
          ? await client.communication['operator-accounts'].$post({ json })
          : await client.communication['operator-accounts'][':id'].$patch({
              param: { id: String(editingId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setDialogOpen(false)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  async function removeAccount(row: OperatorAccount) {
    if (!window.confirm(`Delete account ${row.accountNo} for ${row.operatorName}?`)) {
      return
    }
    setStatus(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const res = await client.communication['operator-accounts'][':id'].$delete({
        param: { id: String(row.id) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Delete failed'))
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <CatalogScreen
        brandIcon={CreditCard}
        title="Operator accounts"
        subtitle="Account numbers used when registering a fleet line"
        headerActions={
          <>
            <Button type="button" size="sm" onClick={openCreate} disabled={loading}>
              <Plus className="size-4" />
              Add account
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle="All accounts"
        filterTabs={null}
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search accounts…"
        selectionBar={null}
        table={
          loading && accounts.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <CatalogSortableTh
                    label="Operator"
                    column="operator"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Account"
                    column="account"
                    sortKey={table.sortKey}
                    sortDir={table.sortDir}
                    onSort={table.toggleSort}
                  />
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paginated.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.operatorName}</TableCell>
                    <TableCell>{row.accountNo}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeAccount(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        }
        pagination={
          <CatalogPagination
            pageStart={table.pageStart}
            pageEnd={table.pageEnd}
            total={table.sorted.length}
            page={table.page}
            totalPages={table.totalPages}
            onPageChange={table.setPage}
          />
        }
      />
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId == null ? 'Add account' : 'Edit account'}
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Operator">
          <Select
            value={form.operatorId || undefined}
            onValueChange={(value) => setForm((prev) => ({ ...prev, operatorId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {operators.map((row) => (
                <SelectItem key={row.id} value={String(row.id)}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Account number" htmlFor="operator-account-no">
          <Input
            id="operator-account-no"
            value={form.accountNo}
            onChange={(e) => setForm((prev) => ({ ...prev, accountNo: e.target.value }))}
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveAccount()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
        />
      </FormDialog>
    </div>
  )
}
