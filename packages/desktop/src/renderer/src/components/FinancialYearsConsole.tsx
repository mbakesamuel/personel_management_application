import type { FinancialYear, User } from '@personel-management-app/shared'
import {
  FolderOpen,
  FolderX,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

type FinancialYearsConsoleProps = {
  user: User
  financialYear: FinancialYear | null
  onFinancialYearChange: (year: FinancialYear | null, nextUser?: User) => void
  onClose: () => void
}

type FormState = {
  appyear: string
  closed: boolean
}

const emptyForm = (): FormState => ({
  appyear: String(new Date().getFullYear()),
  closed: false,
})

export function FinancialYearsConsole({
  user,
  financialYear,
  onFinancialYearChange,
  onClose,
}: FinancialYearsConsoleProps) {
  const canManage = user.permissions.canFinancialYears
  const [years, setYears] = useState<FinancialYear[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'error' | 'info'>('info')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const loadYears = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['financial-years'].$get()
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const data = await res.json()
      setYears(data)
    } catch (err) {
      setStatusTone('error')
      setStatus(err instanceof Error ? err.message : String(err))
      setYears([])
    } finally {
      setLoading(false)
    }
  }, [])

  const syncSessionYear = useCallback(
    async (saved?: FinancialYear | null) => {
      const client = await createApiClient()
      if (saved && !saved.closed) {
        const res = await client.users[':id']['financial-year'].$put({
          param: { id: String(user.id) },
          json: { financialYearId: saved.id },
        })
        if (res.ok) {
          const data = await res.json()
          onFinancialYearChange(data.financialYear, data.user)
          return
        }
      }

      const res = await client['financial-years'].current.$get()
      if (res.ok) {
        const data = await res.json()
        onFinancialYearChange(data.financialYear)
        return
      }

      if (saved && financialYear?.id === saved.id) {
        onFinancialYearChange(saved.closed ? null : saved)
      }
    },
    [user.id, financialYear?.id, onFinancialYearChange],
  )

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  useEffect(() => {
    if (financialYear) {
      setSelectedId(financialYear.id)
    }
  }, [financialYear])

  const visibleYears = useMemo(
    () => (canManage ? years : years.filter((y) => !y.closed)),
    [years, canManage],
  )

  async function setPersonalYear(financialYearId: number | null) {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.users[':id']['financial-year'].$put({
        param: { id: String(user.id) },
        json: { financialYearId },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to update year (${res.status})`)
      }
      const data = await res.json()
      onFinancialYearChange(data.financialYear, data.user)
      setStatusTone('info')
      setStatus(
        data.financialYear
          ? `Opened financial year ${data.financialYear.appyear}.`
          : 'Closed your financial year.',
      )
    } catch (err) {
      setStatusTone('error')
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    if (selectedId == null) {
      setStatusTone('error')
      setStatus('Select a year to open.')
      return
    }
    const year = years.find((y) => y.id === selectedId)
    if (year?.closed) {
      setStatusTone('error')
      setStatus('That year is closed and cannot be opened.')
      return
    }
    if (financialYear?.id === selectedId) {
      setStatusTone('info')
      setStatus('That year is already open.')
      return
    }
    void setPersonalYear(selectedId)
  }

  function handleCloseYear() {
    if (financialYear == null) {
      setStatusTone('error')
      setStatus('You do not have an open financial year.')
      return
    }
    void setPersonalYear(null)
  }

  function openCreate() {
    setDialogMode('create')
    setEditId(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(year: FinancialYear) {
    setEditId(year.id)
    setSelectedId(year.id)
    setDialogMode('edit')
    setForm({
      appyear: String(year.appyear),
      closed: year.closed,
    })
    setDialogOpen(true)
  }

  function requestDelete(year: FinancialYear) {
    setEditId(year.id)
    setSelectedId(year.id)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    const appyear = Number(form.appyear)
    if (!Number.isInteger(appyear) || appyear < 1900 || appyear > 2100) {
      setStatusTone('error')
      setStatus('Enter a valid year between 1900 and 2100.')
      return
    }

    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res =
        dialogMode === 'edit' && editId != null
          ? await client['financial-years'][':id'].$put({
              param: { id: String(editId) },
              json: { appyear, closed: form.closed },
            })
          : await client['financial-years'].$post({
              json: { appyear, closed: form.closed },
            })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }

      const saved = await res.json()
      await syncSessionYear(saved)

      setDialogOpen(false)
      await loadYears()
    } catch (err) {
      setStatusTone('error')
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (editId == null) return

    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['financial-years'][':id'].$delete({
        param: { id: String(editId) },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Delete failed (${res.status})`)
      }

      await syncSessionYear()
      await loadYears()
    } catch (err) {
      setStatusTone('error')
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setConfirmDeleteOpen(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Financial Years</h2>

      <Card className="shrink-0 py-3">
        <CardContent className="px-3 text-sm text-muted-foreground">
          {financialYear ? (
            <p>
              Your open year:{' '}
              <span className="font-semibold text-foreground">
                {financialYear.appyear}
              </span>
              . Only one financial year can be open at a time.
            </p>
          ) : (
            <p>
              You have no open financial year. Open one below before using the
              Appraisal Console.
            </p>
          )}
        </CardContent>
      </Card>

      <Toolbar>
        <Button
          type="button"
          size="sm"
          onClick={handleOpen}
          disabled={loading}
        >
          <FolderOpen className="size-4" />
          Open
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCloseYear}
          disabled={loading || financialYear == null}
        >
          <FolderX className="size-4" />
          Close year
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadYears()}
          disabled={loading}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={openCreate}
            disabled={loading}
          >
            <Plus className="size-4" />
            Add/New
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Done
        </Button>
      </Toolbar>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead>Year</TableHead>
              {canManage ? <TableHead>Definition</TableHead> : null}
              <TableHead>Your status</TableHead>
              {canManage ? (
                <TableHead className="w-24 text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleYears.map((year) => {
              const isSessionOpen = financialYear?.id === year.id
              const isSelected = selectedId === year.id
              return (
                <TableRow
                  key={year.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    'cursor-default',
                    isSessionOpen && 'bg-muted/50',
                  )}
                  onClick={() => setSelectedId(year.id)}
                  onDoubleClick={() => {
                    setSelectedId(year.id)
                    if (!year.closed && !isSessionOpen) {
                      void setPersonalYear(year.id)
                    }
                  }}
                >
                  <TableCell className="font-medium">{year.appyear}</TableCell>
                  {canManage ? (
                    <TableCell>{year.closed ? 'Closed' : 'Open'}</TableCell>
                  ) : null}
                  <TableCell>{isSessionOpen ? 'Opened' : '—'}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Modify financial year"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(year)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete financial year"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            requestDelete(year)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
            {visibleYears.length === 0 && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 2}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {canManage
                    ? 'No financial years defined yet.'
                    : 'No open financial years are available.'}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {status ? (
        <Alert
          className="shrink-0"
          variant={statusTone === 'error' ? 'destructive' : 'default'}
        >
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        <>
          <FormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={
              dialogMode === 'create'
                ? 'Add Financial Year'
                : 'Edit Financial Year'
            }
            subtitle="Define appraisal year and whether it is open for use"
          >
            <FormDialogRow label="Year" htmlFor="fy-appyear">
              <Input
                id="fy-appyear"
                type="number"
                value={form.appyear}
                placeholder="e.g. 2026"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, appyear: e.target.value }))
                }
              />
              <FormDialogHint>Calendar year between 1900 and 2100.</FormDialogHint>
            </FormDialogRow>
            <FormDialogRow label="Status">
              <Select
                value={form.closed ? 'closed' : 'open'}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    closed: value === 'closed',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogError>
              {statusTone === 'error' && dialogOpen ? status : null}
            </FormDialogError>
            <FormDialogActions
              primaryLabel={
                loading
                  ? 'Saving…'
                  : dialogMode === 'create'
                    ? 'Add year'
                    : 'Save changes'
              }
              onPrimary={() => void handleSave()}
              onCancel={() => setDialogOpen(false)}
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
                <AlertDialogTitle>Delete financial year?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the selected financial year.
                  Years that are in use by appraisal records or users cannot be
                  deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDelete()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </section>
  )
}
