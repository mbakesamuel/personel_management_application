import type {
  DecisionAssignment,
  DecisionLevel,
  DecisionLevelCode,
  GroupOption,
  UnitOption,
} from '@perf-appraisal-app/shared'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
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
import { Card, CardContent } from '@/components/ui/card'
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

type DecisionMatricConsoleProps = {
  onClose: () => void
}

type FormState = {
  name: string
  title: string
  effdate: string
  unitId: string
  groupId: string
}

function todayIso(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

function emptyForm(title = ''): FormState {
  return {
    name: '',
    title,
    effdate: todayIso(),
    unitId: '',
    groupId: '',
  }
}

export function DecisionMatricConsole({ onClose }: DecisionMatricConsoleProps) {
  const [levels, setLevels] = useState<DecisionLevel[]>([])
  const [selectedLevelCode, setSelectedLevelCode] = useState<string | null>(
    null,
  )
  const [assignments, setAssignments] = useState<DecisionAssignment[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const selectedLevel =
    levels.find((level) => level.code === selectedLevelCode) ?? null

  const loadLookups = useCallback(async () => {
    const client = await createApiClient()
    const [levelsRes, unitsRes, groupsRes] = await Promise.all([
      client['decision-levels'].$get(),
      client.organization.units.$get(),
      client.organization.groups.$get(),
    ])
    if (levelsRes.ok) {
      const nextLevels = await levelsRes.json()
      setLevels(nextLevels)
      setSelectedLevelCode((prev) => prev ?? nextLevels[0]?.code ?? null)
    }
    if (unitsRes.ok) setUnits(await unitsRes.json())
    if (groupsRes.ok) setGroups(await groupsRes.json())
  }, [])

  const loadAssignments = useCallback(async () => {
    if (!selectedLevelCode) {
      setAssignments([])
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['decision-levels'].assignments.$get({
        query: { levelCode: selectedLevelCode as DecisionLevelCode },
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      setAssignments(await res.json())
      setSelectedId(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [selectedLevelCode])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  function openCreate() {
    if (!selectedLevel) {
      setStatus('Select a decision level first.')
      return
    }
    setDialogMode('create')
    setForm(emptyForm(selectedLevel.title))
    setDialogOpen(true)
  }

  function openEdit(row: DecisionAssignment) {
    setSelectedId(row.id)
    setDialogMode('edit')
    setForm({
      name: row.name,
      title: row.title,
      effdate: row.effdate,
      unitId: row.unitId ?? '',
      groupId: row.groupId ?? '',
    })
    setDialogOpen(true)
  }

  function requestDelete(row: DecisionAssignment) {
    setSelectedId(row.id)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    if (!selectedLevel) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const body = {
        levelCode: selectedLevel.code,
        name: form.name.trim(),
        title: form.title.trim(),
        effdate: form.effdate,
        unitId: selectedLevel.scope === 'unit' ? form.unitId || null : null,
        groupId: selectedLevel.scope === 'group' ? form.groupId || null : null,
      }
      const res =
        dialogMode === 'create'
          ? await client['decision-levels'].assignments.$post({ json: body })
          : await client['decision-levels'].assignments[':id'].$put({
              param: { id: String(selectedId) },
              json: body,
            })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? `Save failed (${res.status})`)
      }
      setDialogOpen(false)
      await loadAssignments()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (selectedId == null) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['decision-levels'].assignments[':id'].$delete({
        param: { id: String(selectedId) },
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? `Delete failed (${res.status})`)
      }
      setConfirmDeleteOpen(false)
      await loadAssignments()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const showUnit = selectedLevel?.scope === 'unit'
  const showGroup = selectedLevel?.scope === 'group'

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <h2 className="m-0 shrink-0 text-xl font-bold">Decision Matrix</h2>

      <Card className="shrink-0 py-3">
        <CardContent className="grid gap-3 px-3">
          <p className="text-sm text-muted-foreground">
            Assign the people who sign appraisal letters for each category
            band, with an effective date.
          </p>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <Button
                key={level.code}
                type="button"
                size="sm"
                variant={
                  level.code === selectedLevelCode ? 'default' : 'outline'
                }
                onClick={() => setSelectedLevelCode(level.code)}
              >
                {level.title} ({level.catFrom}–{level.catTo})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Toolbar>
        <Button
          type="button"
          size="sm"
          onClick={openCreate}
          disabled={loading || !selectedLevel}
        >
          <Plus className="size-4" />
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          <X className="size-4" />
          Close
        </Button>
      </Toolbar>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-md border bg-background">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                {showUnit ? <TableHead>Unit</TableHead> : null}
                {showGroup ? <TableHead>Group</TableHead> : null}
                <TableHead>Effective date</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-default"
                  onDoubleClick={() => openEdit(row)}
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  {showUnit ? (
                    <TableCell>{row.unitName ?? row.unitId}</TableCell>
                  ) : null}
                  {showGroup ? (
                    <TableCell>{row.groupName ?? row.groupId}</TableCell>
                  ) : null}
                  <TableCell>{formatDisplayDate(row.effdate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modify holder"
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
                        aria-label="Delete holder"
                        disabled={loading}
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
              {assignments.length === 0 && !loading ? (
                <TableRow>
                  <TableCell
                    colSpan={showUnit || showGroup ? 6 : 5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No holders assigned for this level.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

      {status ? (
        <Alert className="shrink-0">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Add holder' : 'Modify holder'}
              {selectedLevel ? ` — ${selectedLevel.title}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="decision-name">Name</Label>
              <Input
                id="decision-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Signatory name as it should appear"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="decision-title">Title</Label>
              <Input
                id="decision-title"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="e.g. Estate Manager"
              />
            </div>
            {showUnit ? (
              <div className="grid gap-1">
                <Label>Unit</Label>
                <Select
                  value={form.unitId || undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, unitId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units
                      .filter((unit) => unit.active || unit.id === form.unitId)
                      .map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unitName} ({unit.id})
                        {unit.active ? '' : ' (inactive)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {showGroup ? (
              <div className="grid gap-1">
                <Label>Group</Label>
                <Select
                  value={form.groupId || undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, groupId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups
                      .filter((group) => group.active || group.id === form.groupId)
                      .map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.groupName} ({group.id})
                        {group.active ? '' : ' (inactive)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label htmlFor="decision-effdate">Effective date</Label>
              <Input
                id="decision-effdate"
                type="date"
                value={form.effdate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, effdate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the holder record. Earlier dated assignments for the
              same office are kept.
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
    </section>
  )
}
