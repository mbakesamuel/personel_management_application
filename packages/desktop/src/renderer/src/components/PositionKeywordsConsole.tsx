import type { PositionKeyword } from '@personel-management-app/shared'
import { Eye, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogPagination,
  CatalogScreen,
  CatalogSortableTh,
  CatalogStatusBadge,
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

type PositionKeywordsConsoleProps = {
  onClose: () => void
}

type FormState = {
  id: number | null
  keyword: string
  active: boolean
}

const PAGE_SIZE = 10

function emptyForm(): FormState {
  return { id: null, keyword: '', active: true }
}

export function PositionKeywordsConsole({
  onClose,
}: PositionKeywordsConsoleProps) {
  const [rows, setRows] = useState<PositionKeyword[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [viewRow, setViewRow] = useState<PositionKeyword | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['position-keywords'].$get()
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? 'Failed to load position keywords')
      }
      setRows((await res.json()) as PositionKeyword[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const table = useCatalogTable({
    rows,
    getId: (row) => row.id,
    pageSize: PAGE_SIZE,
    matchesSearch: (row, q) =>
      [row.id, row.keyword, row.active ? 'active' : 'inactive'].some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    getSortValue: (row, key) => {
      if (key === 'keyword') return row.keyword
      if (key === 'active') return row.active ? 1 : 0
      return row.id
    },
    defaultSortKey: 'keyword',
  })

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Keywords',
        value: rows.length,
        icon: KeyRound,
        tone: 'blue',
      },
      {
        label: 'Active',
        value: rows.filter((r) => r.active).length,
        icon: KeyRound,
        tone: 'emerald',
      },
      {
        label: 'Inactive',
        value: rows.filter((r) => !r.active).length,
        icon: KeyRound,
        tone: 'slate',
      },
    ],
    [rows],
  )

  function openCreate() {
    setDialogMode('create')
    setFormError(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(row: PositionKeyword) {
    setDialogMode('edit')
    setFormError(null)
    setForm({ id: row.id, keyword: row.keyword, active: row.active })
    setDialogOpen(true)
  }

  async function handleSave() {
    setLoading(true)
    setFormError(null)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res =
        dialogMode === 'create'
          ? await client['position-keywords'].$post({
              json: {
                keyword: form.keyword.trim(),
                active: form.active,
              },
            })
          : await client['position-keywords'][':id'].$put({
              param: { id: String(form.id) },
              json: {
                keyword: form.keyword.trim(),
                active: form.active,
              },
            })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
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
    if (!deleteId) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['position-keywords'][':id'].$delete({
        param: { id: String(deleteId) },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? 'Delete failed')
      }
      setConfirmDeleteOpen(false)
      setDeleteId(null)
      setViewRow(null)
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const viewRows: Array<[string, string]> = viewRow
    ? [
        ['ID', String(viewRow.id)],
        ['Keyword', viewRow.keyword],
        ['Status', viewRow.active ? 'Active' : 'Inactive'],
      ]
    : []

  return (
    <>
      <CatalogScreen
        brandIcon={KeyRound}
        title="Position keywords"
        subtitle="Job-title keywords for future allowance eligibility"
        headerActions={
          <>
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              disabled={loading}
            >
              <Plus className="size-4" />
              Add Keyword
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle="All Keywords"
        cardSubtitle={
          loading ? 'Loading…' : `${table.filteredCount} records`
        }
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search keywords…"
        table={
          <DataTable
            loading={loading}
            emptyLabel={
              table.search
                ? 'No keywords match the search.'
                : 'No position keywords yet.'
            }
            colSpan={4}
            header={
              <TableRow>
                <CatalogSortableTh
                  label="ID"
                  column="id"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <CatalogSortableTh
                  label="Keyword"
                  column="keyword"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <CatalogSortableTh
                  label="Status"
                  column="active"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            }
          >
            {table.paginated.map((row) => (
              <TableRow
                key={row.id}
                onDoubleClick={() => setViewRow(row)}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {row.id}
                </TableCell>
                <TableCell>{row.keyword}</TableCell>
                <TableCell>
                  <CatalogStatusBadge active={row.active} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={loading}
                      title="View"
                      onClick={() => setViewRow(row)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={loading}
                      title="Edit"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      disabled={loading}
                      title="Delete"
                      onClick={() => {
                        setDeleteId(row.id)
                        setConfirmDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
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
        title={
          dialogMode === 'create'
            ? 'Add keyword'
            : `Edit — #${form.id ?? ''}`
        }
        subtitle="Keywords used to match job titles for allowances"
      >
        <FormDialogRow label="Keyword" htmlFor="pk-keyword">
          <Input
            id="pk-keyword"
            value={form.keyword}
            placeholder="e.g. Supervisor"
            onChange={(e) =>
              setForm((prev) => ({ ...prev, keyword: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Status">
          <Select
            value={form.active ? 'active' : 'inactive'}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, active: value === 'active' }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Saving…'
              : dialogMode === 'create'
                ? 'Add keyword'
                : 'Save changes'
          }
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading || !form.keyword.trim()}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewRow != null}
        onOpenChange={(open) => {
          if (!open) setViewRow(null)
        }}
        title="Keyword details"
        subtitle={viewRow ? `#${viewRow.id}` : undefined}
      >
        <CatalogViewGrid rows={viewRows} />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          {viewRow ? (
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setViewRow(null)}
          >
            Close
          </Button>
        </div>
      </FormDialog>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete keyword?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the keyword from the catalog. It cannot be undone.
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
