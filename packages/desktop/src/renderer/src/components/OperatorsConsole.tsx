import type { CommunicationOperator } from '@personel-management-app/shared'
import { Phone, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type OperatorsConsoleProps = {
  onClose: () => void
}

type PrefixRangeForm = {
  start: string
  end: string
}

type OperatorForm = {
  name: string
  email: string
  phone: string
  address: string
  isActive: boolean
  usesAccounts: boolean
  prefixes: PrefixRangeForm[]
}

const EMPTY_OPERATOR: OperatorForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  isActive: true,
  usesAccounts: true,
  prefixes: [{ start: '', end: '' }],
}

function formatRanges(prefixes: CommunicationOperator['prefixes']) {
  if (prefixes.length === 0) return '—'
  return prefixes.map((range) => `${range.start}–${range.end}`).join(', ')
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function OperatorsConsole({ onClose }: OperatorsConsoleProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOperatorId, setEditingOperatorId] = useState<number | null>(null)
  const [operatorForm, setOperatorForm] = useState<OperatorForm>(EMPTY_OPERATOR)
  const [viewRows, setViewRows] = useState<Array<[string, string]> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const operatorsRes = await client.communication.operators.$get()
      if (!operatorsRes.ok) {
        throw new Error(await readError(operatorsRes, 'Failed to load operators'))
      }
      setOperators((await operatorsRes.json()) as CommunicationOperator[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const operatorsTable = useCatalogTable({
    rows: operators,
    getId: (row) => row.id,
    matchesSearch: (row, query) =>
      [
        row.name,
        row.email,
        row.phone,
        row.prefixes.map((range) => `${range.start} ${range.end}`).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    getSortValue: (row, key) => (key === 'name' ? row.name : (row.email ?? '')),
    defaultSortKey: 'name',
  })

  const stats: CatalogStat[] = [
    { label: 'Operators', value: operators.length, icon: Phone, tone: 'blue' },
  ]

  function openCreate() {
    setFormError(null)
    setEditingOperatorId(null)
    setOperatorForm(EMPTY_OPERATOR)
    setDialogOpen(true)
  }

  async function saveOperator() {
    setFormError(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const json = {
        name: operatorForm.name.trim(),
        email: operatorForm.email.trim(),
        phone: operatorForm.phone.trim(),
        address: operatorForm.address.trim(),
        isActive: operatorForm.isActive,
        usesAccounts: operatorForm.usesAccounts,
        prefixes: operatorForm.usesAccounts
          ? operatorForm.prefixes
              .map((range) => ({ start: range.start.trim(), end: range.end.trim() }))
              .filter((range) => range.start || range.end)
          : [],
      }
      const res =
        editingOperatorId == null
          ? await client.communication.operators.$post({ json })
          : await client.communication.operators[':id'].$patch({
              param: { id: String(editingOperatorId) },
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

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <CatalogScreen
        brandIcon={Phone}
        title="Operators"
        subtitle="MTN, Orange, GM, and their number prefixes"
        headerActions={
          <>
            <Button type="button" size="sm" onClick={openCreate} disabled={loading}>
              <Plus className="size-4" />
              Add Operator
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle="All operators"
        filterTabs={null}
        search={operatorsTable.search}
        onSearchChange={operatorsTable.setSearch}
        searchPlaceholder="Search operators…"
        selectionBar={null}
        table={
          loading && operators.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <CatalogSortableTh
                    label="Name"
                    column="name"
                    sortKey={operatorsTable.sortKey}
                    sortDir={operatorsTable.sortDir}
                    onSort={operatorsTable.toggleSort}
                  />
                  <TableHead>Phone</TableHead>
                  <TableHead>Prefixes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorsTable.paginated.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() =>
                          setViewRows([
                            ['Name', row.name],
                            ['Email', row.email ?? '—'],
                            ['Phone', row.phone ?? '—'],
                            ['Address', row.address ?? '—'],
                            ['Prefixes', formatRanges(row.prefixes)],
                            ['Status', row.isActive ? 'Active' : 'Inactive'],
                          ])
                        }
                      >
                        {row.name}
                      </button>
                    </TableCell>
                    <TableCell>{row.phone ?? '—'}</TableCell>
                    <TableCell>{formatRanges(row.prefixes)}</TableCell>
                    <TableCell>{row.isActive ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingOperatorId(row.id)
                          setOperatorForm({
                            name: row.name,
                            email: row.email ?? '',
                            phone: row.phone ?? '',
                            address: row.address ?? '',
                            isActive: row.isActive,
                            usesAccounts: row.usesAccounts,
                            prefixes:
                              row.prefixes.length > 0
                                ? row.prefixes.map((range) => ({
                                    start: range.start,
                                    end: range.end,
                                  }))
                                : [{ start: '', end: '' }],
                          })
                          setFormError(null)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
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
            pageStart={operatorsTable.pageStart}
            pageEnd={operatorsTable.pageEnd}
            total={operatorsTable.sorted.length}
            page={operatorsTable.page}
            totalPages={operatorsTable.totalPages}
            onPageChange={operatorsTable.setPage}
          />
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false)
        }}
        title={editingOperatorId == null ? 'Add operator' : 'Edit operator'}
        subtitle="MTN, Orange, GM, and their number prefixes"
      >
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogRow label="Name" htmlFor="op-name">
          <Input
            id="op-name"
            value={operatorForm.name}
            onChange={(e) => setOperatorForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </FormDialogRow>
        <FormDialogRow label="Email" htmlFor="op-email">
          <Input
            id="op-email"
            value={operatorForm.email}
            onChange={(e) => setOperatorForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </FormDialogRow>
        <FormDialogRow label="Phone" htmlFor="op-phone">
          <Input
            id="op-phone"
            value={operatorForm.phone}
            onChange={(e) => setOperatorForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </FormDialogRow>
        <FormDialogRow label="Address" htmlFor="op-address">
          <Input
            id="op-address"
            value={operatorForm.address}
            onChange={(e) => setOperatorForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </FormDialogRow>
        <FormDialogRow label="Uses prefixes and accounts" htmlFor="op-uses-accounts">
          <input
            id="op-uses-accounts"
            type="checkbox"
            className="size-4 accent-primary"
            checked={operatorForm.usesAccounts}
            onChange={(e) =>
              setOperatorForm((prev) => ({ ...prev, usesAccounts: e.target.checked }))
            }
          />
        </FormDialogRow>
        {operatorForm.usesAccounts ? (
          <FormDialogRow label="Prefix ranges">
            <div className="space-y-2">
              {operatorForm.prefixes.map((range, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label="Range start"
                    placeholder="650"
                    value={range.start}
                    onChange={(e) =>
                      setOperatorForm((prev) => ({
                        ...prev,
                        prefixes: prev.prefixes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, start: e.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    aria-label="Range end"
                    placeholder="654"
                    value={range.end}
                    onChange={(e) =>
                      setOperatorForm((prev) => ({
                        ...prev,
                        prefixes: prev.prefixes.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, end: e.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOperatorForm((prev) => ({
                        ...prev,
                        prefixes:
                          prev.prefixes.length === 1
                            ? [{ start: '', end: '' }]
                            : prev.prefixes.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOperatorForm((prev) => ({
                    ...prev,
                    prefixes: [...prev.prefixes, { start: '', end: '' }],
                  }))
                }
              >
                Add range
              </Button>
            </div>
          </FormDialogRow>
        ) : null}
        <FormDialogRow label="Active" htmlFor="op-active">
          <input
            id="op-active"
            type="checkbox"
            className="size-4 accent-primary"
            checked={operatorForm.isActive}
            onChange={(e) =>
              setOperatorForm((prev) => ({ ...prev, isActive: e.target.checked }))
            }
          />
        </FormDialogRow>
        <FormDialogActions
          primaryLabel={loading ? 'Saving…' : 'Save'}
          onPrimary={() => void saveOperator()}
          onCancel={() => setDialogOpen(false)}
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
