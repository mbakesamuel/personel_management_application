import type {
  DecisionLevel,
  DecisionLevelCode,
  GroupOption,
  OfficialMemo,
  OfficialMemoSignatory,
  UnitOption,
} from '@personel-management-app/shared'
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

type OfficialMemoConsoleProps = {
  onClose: () => void
}

type HolderForm = {
  name: string
  title: string
  catFrom: string
  catTo: string
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

function emptyHolder(title = '', catFrom = '', catTo = ''): HolderForm {
  return { name: '', title, catFrom, catTo, effdate: todayIso(), unitId: '', groupId: '' }
}

async function readError(res: Response, fallback: string) {
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  return payload?.error ?? fallback
}

export function OfficialMemoConsole({ onClose }: OfficialMemoConsoleProps) {
  const [memos, setMemos] = useState<OfficialMemo[]>([])
  const [levels, setLevels] = useState<DecisionLevel[]>([])
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null)
  const [selectedLevelCode, setSelectedLevelCode] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<OfficialMemoSignatory[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [holderOpen, setHolderOpen] = useState(false)
  const [holderMode, setHolderMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<HolderForm>(emptyHolder())
  const [confirmDelete, setConfirmDelete] = useState<'holder' | 'memo' | null>(null)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoMode, setMemoMode] = useState<'create' | 'rename'>('create')
  const [memoName, setMemoName] = useState('')

  const selectedMemo = memos.find((memo) => memo.id === selectedMemoId) ?? null
  const selectedLevel = levels.find((level) => level.code === selectedLevelCode) ?? null

  const loadLookups = useCallback(async () => {
    const client = await createApiClient()
    const [memosRes, levelsRes, unitsRes, groupsRes] = await Promise.all([
      client['official-memos'].$get(),
      client['decision-levels'].$get(),
      client.organization.units.$get(),
      client.organization.groups.$get(),
    ])
    if (memosRes.ok) {
      const next = (await memosRes.json()) as OfficialMemo[]
      setMemos(next)
      setSelectedMemoId((prev) => prev ?? next[0]?.id ?? null)
    }
    if (levelsRes.ok) {
      const nextLevels = (await levelsRes.json()) as DecisionLevel[]
      setLevels(nextLevels)
      setSelectedLevelCode((prev) => prev ?? nextLevels[0]?.code ?? null)
    }
    if (unitsRes.ok) setUnits((await unitsRes.json()) as UnitOption[])
    if (groupsRes.ok) setGroups((await groupsRes.json()) as GroupOption[])
  }, [])

  const loadAssignments = useCallback(async () => {
    if (selectedMemoId == null || !selectedLevelCode) {
      setAssignments([])
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['official-memos'].signatories.$get({
        query: {
          memoId: String(selectedMemoId),
          levelCode: selectedLevelCode as DecisionLevelCode,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to load holders'))
      setAssignments((await res.json()) as OfficialMemoSignatory[])
      setSelectedId(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [selectedMemoId, selectedLevelCode])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  function openCreateHolder() {
    if (!selectedMemo || !selectedLevel) {
      setStatus('Select a memo type and an office first.')
      return
    }
    const current = assignments[0]
    setHolderMode('create')
    setForm(
      emptyHolder(
        selectedLevel.title,
        current ? String(current.catFrom) : '',
        current ? String(current.catTo) : '',
      ),
    )
    setHolderOpen(true)
  }

  function openEditHolder(row: OfficialMemoSignatory) {
    setSelectedId(row.id)
    setHolderMode('edit')
    setForm({
      name: row.name ?? '',
      title: row.title,
      catFrom: String(row.catFrom),
      catTo: String(row.catTo),
      effdate: row.effdate,
      unitId: row.unitId ?? '',
      groupId: row.groupId ?? '',
    })
    setHolderOpen(true)
  }

  async function saveHolder() {
    if (!selectedMemo || !selectedLevel) return
    const catFrom = Number(form.catFrom)
    const catTo = Number(form.catTo)
    if (!Number.isInteger(catFrom) || !Number.isInteger(catTo) || catFrom < 1 || catTo < catFrom) {
      setStatus('Enter a category range, with category to at least category from.')
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const body = {
        memoId: selectedMemo.id,
        levelCode: selectedLevel.code,
        name: form.name.trim(),
        title: form.title.trim(),
        catFrom,
        catTo,
        effdate: form.effdate,
        unitId: selectedLevel.scope === 'unit' ? form.unitId || null : null,
        groupId: selectedLevel.scope === 'group' ? form.groupId || null : null,
      }
      const res =
        holderMode === 'create'
          ? await client['official-memos'].signatories.$post({ json: body })
          : await client['official-memos'].signatories[':id'].$put({
              param: { id: String(selectedId) },
              json: body,
            })
      if (!res.ok) throw new Error(await readError(res, `Save failed (${res.status})`))
      setHolderOpen(false)
      await loadAssignments()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function saveMemo() {
    const name = memoName.trim()
    if (!name) {
      setStatus('Name is required')
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res =
        memoMode === 'create'
          ? await client['official-memos'].$post({ json: { name } })
          : await client['official-memos'][':id'].$put({
              param: { id: String(selectedMemoId) },
              json: { name },
            })
      if (!res.ok) throw new Error(await readError(res, `Save failed (${res.status})`))
      const saved = (await res.json()) as OfficialMemo
      setMemoOpen(false)
      await loadLookups()
      setSelectedMemoId(saved.id)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function confirmRemoval() {
    if (confirmDelete === 'holder') {
      if (selectedId == null) return
      setLoading(true)
      setStatus(null)
      try {
        const client = await createApiClient()
        const res = await client['official-memos'].signatories[':id'].$delete({
          param: { id: String(selectedId) },
        })
        if (!res.ok) throw new Error(await readError(res, 'Delete failed'))
        setConfirmDelete(null)
        await loadAssignments()
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
      return
    }
    if (selectedMemoId == null) return
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['official-memos'][':id'].$delete({
        param: { id: String(selectedMemoId) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Delete failed'))
      setConfirmDelete(null)
      setSelectedMemoId(null)
      await loadLookups()
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
      <h2 className="m-0 shrink-0 text-xl font-bold">Memo signatories</h2>
      <Card className="shrink-0 py-3">
        <CardContent className="grid gap-3 px-3">
          <p className="text-sm text-muted-foreground">
            Choose who signs each memo. The category range is set on the holder
            for that memo, and the name can be left blank.
          </p>
          <div className="flex flex-wrap gap-2">
            {memos.map((memo) => (
              <Button
                key={memo.id}
                type="button"
                size="sm"
                variant={memo.id === selectedMemoId ? 'default' : 'outline'}
                onClick={() => setSelectedMemoId(memo.id)}
              >
                {memo.name}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <Button
                key={level.code}
                type="button"
                size="sm"
                variant={level.code === selectedLevelCode ? 'default' : 'outline'}
                onClick={() => setSelectedLevelCode(level.code)}
              >
                {level.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Toolbar>
        <Button type="button" size="sm" onClick={openCreateHolder} disabled={loading || !selectedMemo}>
          <Plus className="size-4" />
          Add holder
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => {
            setMemoMode('create')
            setMemoName('')
            setMemoOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add memo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || !selectedMemo}
          onClick={() => {
            setMemoMode('rename')
            setMemoName(selectedMemo?.name ?? '')
            setMemoOpen(true)
          }}
        >
          <Pencil className="size-4" />
          Rename
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || !selectedMemo || selectedMemo.system}
          onClick={() => setConfirmDelete('memo')}
        >
          <Trash2 className="size-4" />
          Delete memo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
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
              <TableHead>Categories</TableHead>
              {showUnit ? <TableHead>Unit</TableHead> : null}
              {showGroup ? <TableHead>Group</TableHead> : null}
              <TableHead>Effective date</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((row) => (
              <TableRow key={row.id} onDoubleClick={() => openEditHolder(row)}>
                <TableCell>{row.name ?? ''}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>
                  {row.catFrom}–{row.catTo}
                </TableCell>
                {showUnit ? <TableCell>{row.unitName ?? row.unitId}</TableCell> : null}
                {showGroup ? <TableCell>{row.groupName ?? row.groupId}</TableCell> : null}
                <TableCell>{formatDisplayDate(row.effdate)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Modify holder"
                      disabled={loading}
                      onClick={() => openEditHolder(row)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete holder"
                      disabled={loading}
                      onClick={() => {
                        setSelectedId(row.id)
                        setConfirmDelete('holder')
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
                  colSpan={showUnit || showGroup ? 7 : 6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No holders assigned for this memo and office.
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
      <Dialog open={holderOpen} onOpenChange={setHolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {holderMode === 'create' ? 'Add holder' : 'Modify holder'}
              {selectedLevel ? ` — ${selectedLevel.title}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="memo-holder-name">Name</Label>
              <Input
                id="memo-holder-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Optional. Leave blank to print the title only"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="memo-holder-title">Title</Label>
              <Input
                id="memo-holder-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            {showUnit ? (
              <div className="grid gap-1">
                <Label>Unit</Label>
                <Select
                  value={form.unitId || undefined}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, unitId: value }))}
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
                  onValueChange={(value) => setForm((prev) => ({ ...prev, groupId: value }))}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="memo-holder-from">Category from</Label>
                <Input
                  id="memo-holder-from"
                  inputMode="numeric"
                  value={form.catFrom}
                  onChange={(event) => setForm((prev) => ({ ...prev, catFrom: event.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="memo-holder-to">Category to</Label>
                <Input
                  id="memo-holder-to"
                  inputMode="numeric"
                  value={form.catTo}
                  onChange={(event) => setForm((prev) => ({ ...prev, catTo: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="memo-holder-date">Effective date</Label>
              <Input
                id="memo-holder-date"
                type="date"
                value={form.effdate}
                onChange={(event) => setForm((prev) => ({ ...prev, effdate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHolderOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveHolder()} disabled={loading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={memoOpen} onOpenChange={setMemoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{memoMode === 'create' ? 'Add memo type' : 'Rename memo type'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            <Label htmlFor="memo-type-name">Name</Label>
            <Input
              id="memo-type-name"
              value={memoName}
              onChange={(event) => setMemoName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMemoOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveMemo()} disabled={loading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete != null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDelete === 'memo' ? 'Delete this memo type?' : 'Delete this assignment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete === 'memo'
                ? 'Holders for this memo type are removed with it.'
                : 'Earlier dated assignments for the same office are kept.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemoval()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}