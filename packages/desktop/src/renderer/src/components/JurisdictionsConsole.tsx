import type { Jurisdiction, ScopeKind } from '@personel-management-app/shared'
import { SCOPE_KINDS } from '@personel-management-app/shared'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogHint,
  FormDialogRow,
} from './form-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Toolbar } from '@/components/ui/toolbar'
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

type JurisdictionsConsoleProps = {
  onClose: () => void
}

type FormState = {
  code: string
  label: string
  rank: string
  scopeKind: ScopeKind
  active: boolean
}

const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
  section: 'Section',
  unit: 'Unit',
  zone: 'Zone',
  group: 'Group',
  all: 'All',
}

function emptyForm(): FormState {
  return {
    code: '',
    label: '',
    rank: '1',
    scopeKind: 'section',
    active: true,
  }
}

export function JurisdictionsConsole({ onClose }: JurisdictionsConsoleProps) {
  const [rows, setRows] = useState<Jurisdiction[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.jurisdictions.$get()
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(
          body?.error ?? `Failed to load jurisdictions (${res.status})`,
        )
      }
      setRows(await res.json())
      setSelectedCode(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  function openCreate() {
    setDialogMode('create')
    setSelectedCode(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(row: Jurisdiction) {
    setSelectedCode(row.code)
    setDialogMode('edit')
    setForm({
      code: row.code,
      label: row.label,
      rank: String(row.rank),
      scopeKind: row.scopeKind,
      active: row.active,
    })
    setDialogOpen(true)
  }

  function requestDelete(row: Jurisdiction) {
    if (row.system) {
      setStatus('System jurisdictions cannot be deleted.')
      return
    }
    setSelectedCode(row.code)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    if (!form.label.trim()) {
      setStatus('Label is required.')
      return
    }
    const rank = Number(form.rank)
    if (!Number.isInteger(rank) || rank < 1) {
      setStatus('Rank must be a positive integer.')
      return
    }
    if (dialogMode === 'create' && !form.code.trim()) {
      setStatus('Code is required.')
      return
    }

    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res =
        dialogMode === 'edit' && selectedCode
          ? await client.jurisdictions[':code'].$put({
              param: { code: selectedCode },
              json: {
                label: form.label.trim(),
                rank,
                scopeKind: form.scopeKind,
                active: form.active,
              },
            })
          : await client.jurisdictions.$post({
              json: {
                code: form.code.trim().toLowerCase(),
                label: form.label.trim(),
                rank,
                scopeKind: form.scopeKind,
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
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedCode) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.jurisdictions[':code'].$delete({
        param: { code: selectedCode },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Delete failed (${res.status})`)
      }
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setConfirmDeleteOpen(false)
    }
  }

  const editingSystem =
    dialogMode === 'edit' &&
    rows.find((r) => r.code === selectedCode)?.system === true
  const scopeKindLocked = editingSystem

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Jurisdictions</h2>

      {status ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Toolbar>
        <Button
          type="button"
          size="sm"
          onClick={openCreate}
          disabled={loading}
        >
          <Plus className="size-4" />
          Add
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Scope kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.code}
                className="cursor-default"
                onDoubleClick={() => openEdit(row)}
              >
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.rank}</TableCell>
                <TableCell>{SCOPE_KIND_LABELS[row.scopeKind]}</TableCell>
                <TableCell>{row.active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit jurisdiction"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(row)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete jurisdiction"
                      disabled={loading || row.system}
                      onClick={(e) => {
                        e.stopPropagation()
                        requestDelete(row)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No jurisdictions defined yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          dialogMode === 'create' ? 'Add jurisdiction' : 'Edit jurisdiction'
        }
        subtitle="Catalog entry used by roles for scope resolution"
      >
        <FormDialogRow label="Code" htmlFor="jurisdiction-code">
          <Input
            id="jurisdiction-code"
            value={form.code}
            disabled={dialogMode === 'edit'}
            className="font-mono lowercase"
            placeholder="e.g. regional"
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                code: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, ''),
              }))
            }
          />
          <FormDialogHint>
            Starts with a–z; use a–z, 0–9, or underscore only.
          </FormDialogHint>
        </FormDialogRow>
        <FormDialogRow label="Label" htmlFor="jurisdiction-label">
          <Input
            id="jurisdiction-label"
            value={form.label}
            placeholder="e.g. Regional"
            onChange={(e) =>
              setForm((prev) => ({ ...prev, label: e.target.value }))
            }
          />
        </FormDialogRow>
        <FormDialogRow label="Rank" htmlFor="jurisdiction-rank">
          <Input
            id="jurisdiction-rank"
            type="number"
            min={1}
            value={form.rank}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, rank: e.target.value }))
            }
          />
          <FormDialogHint>
            Narrower scopes use lower ranks (section &lt; unit &lt; zone &lt;
            group &lt; all).
          </FormDialogHint>
        </FormDialogRow>
        <FormDialogRow label="Scope kind">
          <Select
            value={form.scopeKind}
            disabled={scopeKindLocked}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                scopeKind: value as ScopeKind,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {SCOPE_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormDialogRow>
        <FormDialogRow label="Status">
          <Select
            value={form.active ? 'active' : 'inactive'}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                active: value === 'active',
              }))
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
        <FormDialogError>{dialogOpen ? status : null}</FormDialogError>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Saving…'
              : dialogMode === 'create'
                ? 'Add jurisdiction'
                : 'Save changes'
          }
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete jurisdiction?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete jurisdiction <strong>{selectedCode}</strong>? Roles that
              still reference it must be updated first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
