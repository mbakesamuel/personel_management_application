import type {
  LetterCcItem,
  LetterCcUnitExtra,
  LetterCcUnitOverlay,
  UnitOption,
} from '@perf-appraisal-app/shared'
import { ArrowDown, ArrowUp, Pencil, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Toolbar } from '@/components/ui/toolbar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type LetterCopiesConsoleProps = {
  onClose: () => void
}

type FormState = {
  label: string
  active: boolean
}

const CORPORATION = '__corporation__'

const emptyForm = (): FormState => ({
  label: '',
  active: true,
})

async function readApiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { error?: string }
    if (parsed.error) return parsed.error
  } catch {
    // keep raw text
  }
  return text || `Request failed (${res.status})`
}

function defaultStatus(row: LetterCcItem & { included?: boolean }): string {
  if (!row.active) return 'Inactive'
  if (row.included === false) return 'Hidden'
  return 'Active'
}

export function LetterCopiesConsole({ onClose }: LetterCopiesConsoleProps) {
  const [units, setUnits] = useState<UnitOption[]>([])
  const [unitId, setUnitId] = useState('')
  const [items, setItems] = useState<LetterCcItem[]>([])
  const [overlay, setOverlay] = useState<LetterCcUnitOverlay | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm)

  const unitMode = Boolean(unitId)
  const extras = overlay?.extras ?? []

  const loadUnits = useCallback(async () => {
    const client = await createApiClient()
    const res = await client.organization.units.$get()
    if (res.ok) setUnits(await res.json())
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      if (unitId) {
        const res = await client['letter-cc'].units[':unitId'].$get({
          param: { unitId },
        })
        if (!res.ok) throw new Error(await readApiError(res))
        const data = await res.json()
        setOverlay(data)
        setItems([])
      } else {
        const res = await client['letter-cc'].$get()
        if (!res.ok) throw new Error(await readApiError(res))
        setItems(await res.json())
        setOverlay(null)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setItems([])
      setOverlay(null)
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => {
    void loadUnits()
  }, [loadUnits])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  function openCreate() {
    setDialogMode('create')
    setForm(emptyForm())
    setSelectedId(null)
    setDialogOpen(true)
  }

  function openEditGlobal(item: LetterCcItem) {
    setSelectedId(item.id)
    setDialogMode('edit')
    setForm({ label: item.label, active: item.active })
    setDialogOpen(true)
  }

  function openEditExtra(item: LetterCcUnitExtra) {
    setSelectedId(item.id)
    setDialogMode('edit')
    setForm({ label: item.label, active: item.active })
    setDialogOpen(true)
  }

  async function handleSave() {
    const label = form.label.trim()
    if (!label) {
      setStatus('Label is required.')
      return
    }

    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      if (unitMode) {
        const res =
          dialogMode === 'edit' && selectedId != null
            ? await client['letter-cc'].units[':unitId'].extras[':id'].$patch({
                param: { unitId, id: String(selectedId) },
                json: { label, active: form.active },
              })
            : await client['letter-cc'].units[':unitId'].extras.$post({
                param: { unitId },
                json: { label, active: form.active },
              })
        if (!res.ok) throw new Error(await readApiError(res))
        setDialogOpen(false)
        setOverlay(await res.json())
      } else {
        const res =
          dialogMode === 'edit' && selectedId != null
            ? await client['letter-cc'][':id'].$patch({
                param: { id: String(selectedId) },
                json: { label, active: form.active },
              })
            : await client['letter-cc'].$post({
                json: { label, active: form.active },
              })
        if (!res.ok) throw new Error(await readApiError(res))
        setDialogOpen(false)
        await loadItems()
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMoveGlobal(item: LetterCcItem, direction: 'up' | 'down') {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['letter-cc'][':id'].move.$patch({
        param: { id: String(item.id) },
        json: { direction },
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setItems(await res.json())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleMoveExtra(
    item: LetterCcUnitExtra,
    direction: 'up' | 'down',
  ) {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['letter-cc'].units[':unitId'].extras[
        ':id'
      ].move.$patch({
        param: { unitId, id: String(item.id) },
        json: { direction },
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setOverlay(await res.json())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleInclude(item: LetterCcItem, included: boolean) {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['letter-cc'].units[':unitId'].hides.$patch({
        param: { unitId },
        json: { letterCcId: item.id, hidden: !included },
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setOverlay(await res.json())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Letter copies (CC)</h2>

      <Toolbar>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Add/New
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="grid max-w-md shrink-0 gap-1">
        <Label>Unit</Label>
        <Select
          value={unitId || CORPORATION}
          onValueChange={(value) =>
            setUnitId(value === CORPORATION ? '' : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Corporation defaults" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CORPORATION}>Corporation defaults</SelectItem>
            {units
              .filter((unit) => unit.active || unit.id === unitId)
              .map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.unitName}
                  {unit.active ? '' : ' (inactive)'}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
        {unitMode ? (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Copy</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Include</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overlay?.defaults ?? []).map((row) => (
                <TableRow key={`default-${row.id}`}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>Corporation</TableCell>
                  <TableCell>{defaultStatus(row)}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={row.included}
                      disabled={loading || !row.active}
                      aria-label={`Include ${row.label} for this unit`}
                      onChange={(e) =>
                        void handleToggleInclude(row, e.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {extras.map((row, index) => (
                <TableRow
                  key={`extra-${row.id}`}
                  className="cursor-default"
                  onDoubleClick={() => openEditExtra(row)}
                >
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell>This unit</TableCell>
                  <TableCell>{row.active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={row.active}
                      disabled={loading}
                      aria-label={`Include ${row.label} for this unit`}
                      onChange={(e) => {
                        void (async () => {
                          setLoading(true)
                          setStatus(null)
                          try {
                            const client = await createApiClient()
                            const res = await client['letter-cc'].units[
                              ':unitId'
                            ].extras[':id'].$patch({
                              param: { unitId, id: String(row.id) },
                              json: { active: e.target.checked },
                            })
                            if (!res.ok) {
                              throw new Error(await readApiError(res))
                            }
                            setOverlay(await res.json())
                          } catch (err) {
                            setStatus(
                              err instanceof Error ? err.message : String(err),
                            )
                          } finally {
                            setLoading(false)
                          }
                        })()
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move copy up"
                        disabled={loading || index === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleMoveExtra(row, 'up')
                        }}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move copy down"
                        disabled={loading || index === extras.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleMoveExtra(row, 'down')
                        }}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modify letter copy"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditExtra(row)
                        }}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(overlay?.defaults.length ?? 0) === 0 &&
              extras.length === 0 &&
              !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No letter copies defined yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Copy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow
                  key={item.id}
                  className="cursor-default"
                  onDoubleClick={() => openEditGlobal(item)}
                >
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell>{item.active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move copy up"
                        disabled={loading || index === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleMoveGlobal(item, 'up')
                        }}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move copy down"
                        disabled={loading || index === items.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleMoveGlobal(item, 'down')
                        }}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modify letter copy"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditGlobal(item)
                        }}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No letter copies defined yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </div>

      {status ? (
        <Alert className="shrink-0" variant="destructive">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create'
                ? unitMode
                  ? 'Add unit letter copy'
                  : 'Add letter copy'
                : unitMode
                  ? 'Edit unit letter copy'
                  : 'Edit letter copy'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="letter-cc-label">Copy</Label>
              <Input
                id="letter-cc-label"
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
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
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
