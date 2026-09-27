import type {
  GroupOption,
  SectionOption,
  UnitOption,
  User,
  ZoneOption,
} from '@personel-management-app/shared'
import {
  Building2,
  Eye,
  FolderTree,
  Layers,
  MapPinned,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogFilterTabs,
  CatalogPagination,
  CatalogScreen,
  CatalogSelectionBar,
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
  FormDialogHint,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type OrganizationConsoleProps = {
  currentUser: User
  onClose: () => void
}

type TabKey = 'groups' | 'zones' | 'units' | 'sections'

type GroupForm = { id: string; groupName: string; active: boolean }
type ZoneForm = { id: string; zoneName: string; groupId: string; active: boolean }
type UnitForm = {
  id: string
  unitName: string
  groupId: string
  zoneId: string
  active: boolean
}
type SectionForm = { section: string; unitId: string; active: boolean }

type ViewState =
  | { kind: 'group'; row: GroupOption }
  | { kind: 'zone'; row: ZoneOption }
  | { kind: 'unit'; row: UnitOption }
  | { kind: 'section'; row: SectionOption }

const NONE_UNIT = '__none__'
const PAGE_SIZE = 10

const SEARCH_PLACEHOLDER: Record<TabKey, string> = {
  groups: 'Search groups…',
  zones: 'Search zones…',
  units: 'Search units…',
  sections: 'Search sections…',
}

const CARD_TITLE: Record<TabKey, string> = {
  groups: 'All Groups',
  zones: 'All Zones',
  units: 'All Units',
  sections: 'All Sections',
}

function selectableGroups(groups: GroupOption[], currentId?: string) {
  return groups.filter((group) => group.active || group.id === currentId)
}

function selectableZones(
  zones: ZoneOption[],
  groupId?: string,
  currentId?: string,
) {
  return zones.filter(
    (zone) =>
      (zone.active || zone.id === currentId) &&
      (!groupId || zone.groupId === groupId),
  )
}

function selectableUnits(units: UnitOption[], currentId?: string) {
  return units.filter((unit) => unit.active || unit.id === currentId)
}

function statusLabel(active: boolean) {
  return active ? 'Active' : 'Inactive'
}

export function OrganizationConsole({
  currentUser,
  onClose,
}: OrganizationConsoleProps) {
  const [tab, setTab] = useState<TabKey>('groups')
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [viewState, setViewState] = useState<ViewState | null>(null)
  const scoped = currentUser.jurisdiction !== 'all'

  const [groupForm, setGroupForm] = useState<GroupForm>({
    id: '',
    groupName: '',
    active: true,
  })
  const [zoneForm, setZoneForm] = useState<ZoneForm>({
    id: '',
    zoneName: '',
    groupId: '',
    active: true,
  })
  const [unitForm, setUnitForm] = useState<UnitForm>({
    id: '',
    unitName: '',
    groupId: '',
    zoneId: '',
    active: true,
  })
  const [sectionForm, setSectionForm] = useState<SectionForm>({
    section: '',
    unitId: '',
    active: true,
  })

  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.groupName])),
    [groups],
  )
  const zoneNameById = useMemo(
    () => new Map(zones.map((z) => [z.id, z.zoneName])),
    [zones],
  )
  const unitNameById = useMemo(
    () => new Map(units.map((u) => [u.id, u.unitName])),
    [units],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [groupsRes, zonesRes, unitsRes, sectionsRes] = await Promise.all([
        client.organization.groups.$get(),
        client.organization.zones.$get({ query: {} }),
        client.organization.units.$get(),
        client.organization.sections.$get({ query: {} }),
      ])
      if (
        !groupsRes.ok ||
        !zonesRes.ok ||
        !unitsRes.ok ||
        !sectionsRes.ok
      ) {
        throw new Error('Failed to load organization data')
      }
      setGroups(await groupsRes.json())
      setZones(await zonesRes.json())
      setUnits(await unitsRes.json())
      setSections(await sectionsRes.json())
      setSelectedId(null)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const matchesGroupSearch = useCallback(
    (row: GroupOption, q: string) =>
      [row.id, row.groupName, statusLabel(row.active)].some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    [],
  )
  const matchesZoneSearch = useCallback(
    (row: ZoneOption, q: string) =>
      [
        row.id,
        row.zoneName,
        groupNameById.get(row.groupId) ?? row.groupId,
        statusLabel(row.active),
      ].some((v) => String(v).toLowerCase().includes(q)),
    [groupNameById],
  )
  const matchesUnitSearch = useCallback(
    (row: UnitOption, q: string) =>
      [
        row.id,
        row.unitName,
        zoneNameById.get(row.zoneId) ?? row.zoneId,
        groupNameById.get(row.groupId) ?? row.groupId,
        statusLabel(row.active),
      ].some((v) => String(v).toLowerCase().includes(q)),
    [groupNameById, zoneNameById],
  )
  const matchesSectionSearch = useCallback(
    (row: SectionOption, q: string) =>
      [
        row.id,
        row.section,
        row.unitId,
        row.unitId ? (unitNameById.get(row.unitId) ?? row.unitId) : '',
        statusLabel(row.active),
      ].some((v) => String(v ?? '').toLowerCase().includes(q)),
    [unitNameById],
  )

  const getGroupSort = useCallback(
    (row: GroupOption, key: string) =>
      key === 'groupName'
        ? row.groupName
        : key === 'active'
          ? statusLabel(row.active)
          : row.id,
    [],
  )
  const getZoneSort = useCallback(
    (row: ZoneOption, key: string) =>
      key === 'zoneName'
        ? row.zoneName
        : key === 'group'
          ? (groupNameById.get(row.groupId) ?? row.groupId)
          : key === 'active'
            ? statusLabel(row.active)
            : row.id,
    [groupNameById],
  )
  const getUnitSort = useCallback(
    (row: UnitOption, key: string) =>
      key === 'unitName'
        ? row.unitName
        : key === 'zone'
          ? (zoneNameById.get(row.zoneId) ?? row.zoneId)
          : key === 'group'
            ? (groupNameById.get(row.groupId) ?? row.groupId)
            : key === 'active'
              ? statusLabel(row.active)
              : row.id,
    [groupNameById, zoneNameById],
  )
  const getSectionSort = useCallback(
    (row: SectionOption, key: string) =>
      key === 'section'
        ? (row.section ?? '')
        : key === 'unit'
          ? row.unitId
            ? (unitNameById.get(row.unitId) ?? row.unitId)
            : ''
          : key === 'active'
            ? statusLabel(row.active)
            : row.id,
    [unitNameById],
  )

  const matchesUnitTab = useCallback(
    (row: UnitOption, zoneTab: string) =>
      zoneTab === 'all' || row.zoneId === zoneTab,
    [],
  )

  const groupsTable = useCatalogTable({
    rows: groups,
    getId: (r) => r.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesGroupSearch,
    getSortValue: getGroupSort,
    defaultSortKey: 'groupName',
  })
  const zonesTable = useCatalogTable({
    rows: zones,
    getId: (r) => r.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesZoneSearch,
    getSortValue: getZoneSort,
    defaultSortKey: 'zoneName',
  })
  const unitsTable = useCatalogTable({
    rows: units,
    getId: (r) => r.id,
    pageSize: PAGE_SIZE,
    matchesTab: matchesUnitTab,
    matchesSearch: matchesUnitSearch,
    getSortValue: getUnitSort,
    defaultSortKey: 'unitName',
  })
  const sectionsTable = useCatalogTable({
    rows: sections,
    getId: (r) => r.id,
    pageSize: PAGE_SIZE,
    matchesSearch: matchesSectionSearch,
    getSortValue: getSectionSort,
    defaultSortKey: 'section',
  })

  const activeTable =
    tab === 'groups'
      ? groupsTable
      : tab === 'zones'
        ? zonesTable
        : tab === 'units'
          ? unitsTable
          : sectionsTable

  useEffect(() => {
    setSelectedId(null)
    setStatus(null)
  }, [tab])

  const zoneFilterTabs = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...zones
        .slice()
        .sort((a, b) => a.zoneName.localeCompare(b.zoneName))
        .map((z) => ({ value: z.id, label: z.zoneName })),
    ],
    [zones],
  )

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Groups',
        value: groups.length,
        icon: Building2,
        tone: 'blue',
      },
      {
        label: 'Zones',
        value: zones.length,
        icon: MapPinned,
        tone: 'teal',
      },
      {
        label: 'Units',
        value: units.length,
        icon: Layers,
        tone: 'slate',
      },
      {
        label: 'Active units',
        value: units.filter((u) => u.active).length,
        icon: Layers,
        tone: 'emerald',
      },
      {
        label: 'Sections',
        value: sections.length,
        icon: FolderTree,
        tone: 'amber',
      },
    ],
    [groups.length, zones.length, units, sections.length],
  )

  function openCreate() {
    setViewState(null)
    setDialogMode('create')
    if (tab === 'groups') {
      setGroupForm({ id: '', groupName: '', active: true })
    }
    if (tab === 'zones') {
      setZoneForm({
        id: '',
        zoneName: '',
        groupId: selectableGroups(groups)[0]?.id ?? '',
        active: true,
      })
    }
    if (tab === 'units') {
      const firstGroup = selectableGroups(groups)[0]?.id ?? ''
      const zoneFromTab =
        unitsTable.activeTab !== 'all' ? unitsTable.activeTab : ''
      const firstZone =
        (zoneFromTab &&
          selectableZones(zones, firstGroup).find((z) => z.id === zoneFromTab)
            ?.id) ||
        selectableZones(zones, firstGroup)[0]?.id ||
        ''
      const groupForZone =
        zones.find((z) => z.id === firstZone)?.groupId ?? firstGroup
      setUnitForm({
        id: '',
        unitName: '',
        groupId: groupForZone,
        zoneId: firstZone,
        active: true,
      })
    }
    if (tab === 'sections') {
      setSectionForm({
        section: '',
        unitId: selectableUnits(units)[0]?.id ?? '',
        active: true,
      })
    }
    setDialogOpen(true)
  }

  function openEditGroup(row: GroupOption) {
    setViewState(null)
    setSelectedId(row.id)
    setDialogMode('edit')
    setGroupForm({ id: row.id, groupName: row.groupName, active: row.active })
    setDialogOpen(true)
  }

  function openEditZone(row: ZoneOption) {
    setViewState(null)
    setSelectedId(row.id)
    setDialogMode('edit')
    setZoneForm({
      id: row.id,
      zoneName: row.zoneName,
      groupId: row.groupId,
      active: row.active,
    })
    setDialogOpen(true)
  }

  function openEditUnit(row: UnitOption) {
    setViewState(null)
    setSelectedId(row.id)
    setDialogMode('edit')
    setUnitForm({
      id: row.id,
      unitName: row.unitName,
      groupId: row.groupId,
      zoneId: row.zoneId,
      active: row.active,
    })
    setDialogOpen(true)
  }

  function openEditSection(row: SectionOption) {
    setViewState(null)
    setSelectedId(row.id)
    setDialogMode('edit')
    setSectionForm({
      section: row.section ?? '',
      unitId: row.unitId ?? '',
      active: row.active,
    })
    setDialogOpen(true)
  }

  function requestDelete(id: string | number) {
    setSelectedId(id)
    setConfirmDeleteOpen(true)
  }

  async function handleSave() {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      let res: Response

      if (tab === 'groups') {
        if (!groupForm.id.trim() || !groupForm.groupName.trim()) {
          throw new Error('Group ID and name are required.')
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'string'
            ? await client.organization.groups[':id'].$put({
                param: { id: selectedId },
                json: {
                  id: groupForm.id.trim(),
                  groupName: groupForm.groupName.trim(),
                  active: groupForm.active,
                },
              })
            : await client.organization.groups.$post({
                json: {
                  id: groupForm.id.trim(),
                  groupName: groupForm.groupName.trim(),
                  active: groupForm.active,
                },
              })
      } else if (tab === 'zones') {
        if (
          !zoneForm.id.trim() ||
          !zoneForm.zoneName.trim() ||
          !zoneForm.groupId
        ) {
          throw new Error('Zone ID, name, and group are required.')
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'string'
            ? await client.organization.zones[':id'].$put({
                param: { id: selectedId },
                json: {
                  id: zoneForm.id.trim(),
                  zoneName: zoneForm.zoneName.trim(),
                  groupId: zoneForm.groupId,
                  active: zoneForm.active,
                },
              })
            : await client.organization.zones.$post({
                json: {
                  id: zoneForm.id.trim(),
                  zoneName: zoneForm.zoneName.trim(),
                  groupId: zoneForm.groupId,
                  active: zoneForm.active,
                },
              })
      } else if (tab === 'units') {
        if (
          !unitForm.id.trim() ||
          !unitForm.unitName.trim() ||
          !unitForm.groupId ||
          !unitForm.zoneId
        ) {
          throw new Error('Unit ID, name, group, and zone are required.')
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'string'
            ? await client.organization.units[':id'].$put({
                param: { id: selectedId },
                json: {
                  id: unitForm.id.trim(),
                  unitName: unitForm.unitName.trim(),
                  groupId: unitForm.groupId,
                  zoneId: unitForm.zoneId,
                  active: unitForm.active,
                },
              })
            : await client.organization.units.$post({
                json: {
                  id: unitForm.id.trim(),
                  unitName: unitForm.unitName.trim(),
                  groupId: unitForm.groupId,
                  zoneId: unitForm.zoneId,
                  active: unitForm.active,
                },
              })
      } else {
        if (!sectionForm.section.trim()) {
          throw new Error('Section name is required.')
        }
        const payload = {
          section: sectionForm.section.trim(),
          unitId:
            sectionForm.unitId && sectionForm.unitId !== NONE_UNIT
              ? sectionForm.unitId
              : null,
          active: sectionForm.active,
        }
        res =
          dialogMode === 'edit' && typeof selectedId === 'number'
            ? await client.organization.sections[':id'].$put({
                param: { id: String(selectedId) },
                json: payload,
              })
            : await client.organization.sections.$post({ json: payload })
      }

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

  async function deleteOne(id: string | number) {
    const client = await createApiClient()
    let res: Response
    if (tab === 'groups' && typeof id === 'string') {
      res = await client.organization.groups[':id'].$delete({
        param: { id },
      })
    } else if (tab === 'zones' && typeof id === 'string') {
      res = await client.organization.zones[':id'].$delete({
        param: { id },
      })
    } else if (tab === 'units' && typeof id === 'string') {
      res = await client.organization.units[':id'].$delete({
        param: { id },
      })
    } else {
      res = await client.organization.sections[':id'].$delete({
        param: { id: String(id) },
      })
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error ?? `Delete failed (${res.status})`)
    }
  }

  async function handleDelete() {
    if (selectedId == null) return
    setLoading(true)
    setStatus(null)
    try {
      await deleteOne(selectedId)
      activeTable.clearSelection()
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setConfirmDeleteOpen(false)
    }
  }

  async function handleBulkDelete() {
    const ids = [...activeTable.selectedIds]
    if (ids.length === 0) return
    if (tab === 'groups' && scoped) {
      setStatus('Scoped users cannot delete groups.')
      setBulkDeleteOpen(false)
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      for (const id of ids) {
        await deleteOne(id)
      }
      activeTable.clearSelection()
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setBulkDeleteOpen(false)
    }
  }

  const canBulkDelete = !(tab === 'groups' && scoped)

  const viewRows: Array<[string, string]> = viewState
    ? viewState.kind === 'group'
      ? [
          ['ID', viewState.row.id],
          ['Name', viewState.row.groupName],
          ['Status', statusLabel(viewState.row.active)],
        ]
      : viewState.kind === 'zone'
        ? [
            ['ID', viewState.row.id],
            ['Name', viewState.row.zoneName],
            [
              'Group',
              groupNameById.get(viewState.row.groupId) ?? viewState.row.groupId,
            ],
            ['Status', statusLabel(viewState.row.active)],
          ]
        : viewState.kind === 'unit'
          ? [
              ['ID', viewState.row.id],
              ['Name', viewState.row.unitName],
              [
                'Zone',
                zoneNameById.get(viewState.row.zoneId) ?? viewState.row.zoneId,
              ],
              [
                'Group',
                groupNameById.get(viewState.row.groupId) ??
                  viewState.row.groupId,
              ],
              ['Status', statusLabel(viewState.row.active)],
            ]
          : [
              ['ID', String(viewState.row.id)],
              ['Section', viewState.row.section ?? '—'],
              [
                'Unit',
                viewState.row.unitId
                  ? (unitNameById.get(viewState.row.unitId) ??
                    viewState.row.unitId)
                  : '—',
              ],
              ['Status', statusLabel(viewState.row.active)],
            ]
    : []

  return (
    <>
      <CatalogScreen
        brandIcon={Building2}
        title="Organization"
        subtitle="Groups, zones, units, and sections"
        headerActions={
          <>
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              disabled={loading || (scoped && tab === 'groups')}
            >
              <Plus className="size-4" />
              Add {tab === 'groups' ? 'Group' : tab.slice(0, -1)}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        entityTabs={
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as TabKey)}
          >
            <TabsList>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="zones">Zones</TabsTrigger>
              <TabsTrigger value="units">Units</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        cardTitle={CARD_TITLE[tab]}
        cardSubtitle={
          loading ? 'Loading…' : `${activeTable.filteredCount} records`
        }
        filterTabs={
          tab === 'units' ? (
            <CatalogFilterTabs
              tabs={zoneFilterTabs}
              value={unitsTable.activeTab}
              onChange={unitsTable.setActiveTab}
            />
          ) : null
        }
        search={activeTable.search}
        onSearchChange={activeTable.setSearch}
        searchPlaceholder={SEARCH_PLACEHOLDER[tab]}
        selectionBar={
          <CatalogSelectionBar
            count={activeTable.selectedIds.size}
            onClear={activeTable.clearSelection}
          >
            {canBulkDelete ? (
              <button
                type="button"
                className="text-destructive underline-offset-2 hover:underline"
                disabled={loading}
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete selected
              </button>
            ) : null}
          </CatalogSelectionBar>
        }
        table={
          tab === 'groups' ? (
            <OrgTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No groups match the search.'
                  : 'No groups defined yet.'
              }
              colSpan={5}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={groupsTable.allPageSelected}
                    onChange={groupsTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={groupsTable.sortKey}
                    sortDir={groupsTable.sortDir}
                    onSort={groupsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Group Name"
                    column="groupName"
                    sortKey={groupsTable.sortKey}
                    sortDir={groupsTable.sortDir}
                    onSort={groupsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="active"
                    sortKey={groupsTable.sortKey}
                    sortDir={groupsTable.sortDir}
                    onSort={groupsTable.toggleSort}
                  />
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {groupsTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    groupsTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'group', row })}
                >
                  <SelectCell
                    checked={groupsTable.selectedIds.has(row.id)}
                    onChange={() => groupsTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.groupName}</TableCell>
                  <TableCell>
                    <CatalogStatusBadge active={row.active} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    deleteDisabled={scoped}
                    onView={() => setViewState({ kind: 'group', row })}
                    onEdit={() => openEditGroup(row)}
                    onDelete={() => requestDelete(row.id)}
                  />
                </TableRow>
              ))}
            </OrgTable>
          ) : tab === 'zones' ? (
            <OrgTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No zones match the search.'
                  : 'No zones defined yet.'
              }
              colSpan={6}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={zonesTable.allPageSelected}
                    onChange={zonesTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={zonesTable.sortKey}
                    sortDir={zonesTable.sortDir}
                    onSort={zonesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Zone Name"
                    column="zoneName"
                    sortKey={zonesTable.sortKey}
                    sortDir={zonesTable.sortDir}
                    onSort={zonesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Group"
                    column="group"
                    sortKey={zonesTable.sortKey}
                    sortDir={zonesTable.sortDir}
                    onSort={zonesTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="active"
                    sortKey={zonesTable.sortKey}
                    sortDir={zonesTable.sortDir}
                    onSort={zonesTable.toggleSort}
                  />
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {zonesTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    zonesTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'zone', row })}
                >
                  <SelectCell
                    checked={zonesTable.selectedIds.has(row.id)}
                    onChange={() => zonesTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.zoneName}</TableCell>
                  <TableCell>
                    {groupNameById.get(row.groupId) ?? row.groupId}
                  </TableCell>
                  <TableCell>
                    <CatalogStatusBadge active={row.active} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    onView={() => setViewState({ kind: 'zone', row })}
                    onEdit={() => openEditZone(row)}
                    onDelete={() => requestDelete(row.id)}
                  />
                </TableRow>
              ))}
            </OrgTable>
          ) : tab === 'units' ? (
            <OrgTable
              loading={loading}
              emptyLabel={
                activeTable.search || unitsTable.activeTab !== 'all'
                  ? 'No units match the filters.'
                  : 'No units defined yet.'
              }
              colSpan={7}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={unitsTable.allPageSelected}
                    onChange={unitsTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={unitsTable.sortKey}
                    sortDir={unitsTable.sortDir}
                    onSort={unitsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Unit Name"
                    column="unitName"
                    sortKey={unitsTable.sortKey}
                    sortDir={unitsTable.sortDir}
                    onSort={unitsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Zone"
                    column="zone"
                    sortKey={unitsTable.sortKey}
                    sortDir={unitsTable.sortDir}
                    onSort={unitsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Group"
                    column="group"
                    sortKey={unitsTable.sortKey}
                    sortDir={unitsTable.sortDir}
                    onSort={unitsTable.toggleSort}
                    className="hidden md:table-cell"
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="active"
                    sortKey={unitsTable.sortKey}
                    sortDir={unitsTable.sortDir}
                    onSort={unitsTable.toggleSort}
                  />
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {unitsTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    unitsTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'unit', row })}
                >
                  <SelectCell
                    checked={unitsTable.selectedIds.has(row.id)}
                    onChange={() => unitsTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.unitName}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-md bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      {zoneNameById.get(row.zoneId) ?? row.zoneId}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {groupNameById.get(row.groupId) ?? row.groupId}
                  </TableCell>
                  <TableCell>
                    <CatalogStatusBadge active={row.active} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    onView={() => setViewState({ kind: 'unit', row })}
                    onEdit={() => openEditUnit(row)}
                    onDelete={() => requestDelete(row.id)}
                  />
                </TableRow>
              ))}
            </OrgTable>
          ) : (
            <OrgTable
              loading={loading}
              emptyLabel={
                activeTable.search
                  ? 'No sections match the search.'
                  : 'No sections defined yet.'
              }
              colSpan={6}
              header={
                <TableRow>
                  <SelectAllHead
                    checked={sectionsTable.allPageSelected}
                    onChange={sectionsTable.toggleSelectAllPage}
                  />
                  <CatalogSortableTh
                    label="ID"
                    column="id"
                    sortKey={sectionsTable.sortKey}
                    sortDir={sectionsTable.sortDir}
                    onSort={sectionsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Section"
                    column="section"
                    sortKey={sectionsTable.sortKey}
                    sortDir={sectionsTable.sortDir}
                    onSort={sectionsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Unit"
                    column="unit"
                    sortKey={sectionsTable.sortKey}
                    sortDir={sectionsTable.sortDir}
                    onSort={sectionsTable.toggleSort}
                  />
                  <CatalogSortableTh
                    label="Status"
                    column="active"
                    sortKey={sectionsTable.sortKey}
                    sortDir={sectionsTable.sortDir}
                    onSort={sectionsTable.toggleSort}
                  />
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              }
            >
              {sectionsTable.paginated.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    sectionsTable.selectedIds.has(row.id) && 'bg-muted/40',
                  )}
                  onDoubleClick={() => setViewState({ kind: 'section', row })}
                >
                  <SelectCell
                    checked={sectionsTable.selectedIds.has(row.id)}
                    onChange={() => sectionsTable.toggleSelect(row.id)}
                  />
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.section}</TableCell>
                  <TableCell>
                    {row.unitId
                      ? (unitNameById.get(row.unitId) ?? row.unitId)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <CatalogStatusBadge active={row.active} />
                  </TableCell>
                  <RowActions
                    disabled={loading}
                    onView={() => setViewState({ kind: 'section', row })}
                    onEdit={() => openEditSection(row)}
                    onDelete={() => requestDelete(row.id)}
                  />
                </TableRow>
              ))}
            </OrgTable>
          )
        }
        pagination={
          <CatalogPagination
            pageStart={activeTable.pageStart}
            pageEnd={activeTable.pageEnd}
            total={activeTable.sorted.length}
            page={activeTable.page}
            totalPages={activeTable.totalPages}
            onPageChange={activeTable.setPage}
          />
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`${dialogMode === 'create' ? 'Add' : 'Edit'} ${
          tab === 'groups'
            ? 'Group'
            : tab === 'zones'
              ? 'Zone'
              : tab === 'units'
                ? 'Unit'
                : 'Section'
        }`}
        subtitle="Manage organizational structure details"
      >
        {tab === 'groups' ? (
          <>
            <FormDialogRow label="ID" htmlFor="group-id">
              <Input
                id="group-id"
                value={groupForm.id}
                disabled={dialogMode === 'edit'}
                placeholder="e.g. HQ"
                onChange={(e) =>
                  setGroupForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Group name" htmlFor="group-name">
              <Input
                id="group-name"
                value={groupForm.groupName}
                placeholder="e.g. Head Office"
                onChange={(e) =>
                  setGroupForm((prev) => ({
                    ...prev,
                    groupName: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Status">
              <StatusSelect
                value={groupForm.active}
                onChange={(active) =>
                  setGroupForm((prev) => ({ ...prev, active }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {tab === 'zones' ? (
          <>
            <FormDialogRow label="ID" htmlFor="zone-id">
              <Input
                id="zone-id"
                value={zoneForm.id}
                disabled={dialogMode === 'edit'}
                placeholder="e.g. HQ-Z01"
                onChange={(e) =>
                  setZoneForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Zone name" htmlFor="zone-name">
              <Input
                id="zone-name"
                value={zoneForm.zoneName}
                placeholder="e.g. Default"
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    zoneName: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Group">
              <Select
                value={zoneForm.groupId || undefined}
                onValueChange={(value) =>
                  setZoneForm((prev) => ({ ...prev, groupId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {selectableGroups(groups, zoneForm.groupId).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.groupName}
                      {group.active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Status">
              <StatusSelect
                value={zoneForm.active}
                onChange={(active) =>
                  setZoneForm((prev) => ({ ...prev, active }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {tab === 'units' ? (
          <>
            <FormDialogRow label="ID" htmlFor="unit-id">
              <Input
                id="unit-id"
                maxLength={3}
                value={unitForm.id}
                disabled={dialogMode === 'edit'}
                placeholder="e.g. HR"
                onChange={(e) =>
                  setUnitForm((prev) => ({ ...prev, id: e.target.value }))
                }
              />
              <FormDialogHint>Max 3 characters.</FormDialogHint>
            </FormDialogRow>
            <FormDialogRow label="Unit name" htmlFor="unit-name">
              <Input
                id="unit-name"
                value={unitForm.unitName}
                placeholder="e.g. Human Resources"
                onChange={(e) =>
                  setUnitForm((prev) => ({
                    ...prev,
                    unitName: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Group">
              <Select
                value={unitForm.groupId || undefined}
                onValueChange={(value) => {
                  const nextZone =
                    selectableZones(zones, value).find(
                      (z) => z.id === unitForm.zoneId,
                    )?.id ??
                    selectableZones(zones, value)[0]?.id ??
                    ''
                  setUnitForm((prev) => ({
                    ...prev,
                    groupId: value,
                    zoneId: nextZone,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {selectableGroups(groups, unitForm.groupId).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.groupName}
                      {group.active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Zone">
              <Select
                value={unitForm.zoneId || undefined}
                onValueChange={(value) =>
                  setUnitForm((prev) => ({ ...prev, zoneId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {selectableZones(
                    zones,
                    unitForm.groupId,
                    unitForm.zoneId,
                  ).map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.zoneName}
                      {zone.active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Status">
              <StatusSelect
                value={unitForm.active}
                onChange={(active) =>
                  setUnitForm((prev) => ({ ...prev, active }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        {tab === 'sections' ? (
          <>
            <FormDialogRow label="Section" htmlFor="section-name">
              <Input
                id="section-name"
                value={sectionForm.section}
                placeholder="e.g. Payroll"
                onChange={(e) =>
                  setSectionForm((prev) => ({
                    ...prev,
                    section: e.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Unit">
              <Select
                value={sectionForm.unitId || NONE_UNIT}
                onValueChange={(value) =>
                  setSectionForm((prev) => ({
                    ...prev,
                    unitId: value === NONE_UNIT ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_UNIT}>—</SelectItem>
                  {selectableUnits(units, sectionForm.unitId).map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unitName}
                      {unit.active ? '' : ' (inactive)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Status">
              <StatusSelect
                value={sectionForm.active}
                onChange={(active) =>
                  setSectionForm((prev) => ({ ...prev, active }))
                }
              />
            </FormDialogRow>
          </>
        ) : null}

        <FormDialogError>{dialogOpen ? status : null}</FormDialogError>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Saving…'
              : dialogMode === 'create'
                ? `Add ${tab === 'groups' ? 'group' : tab.slice(0, -1)}`
                : 'Save changes'
          }
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={loading}
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewState != null}
        onOpenChange={(open) => {
          if (!open) setViewState(null)
        }}
        title={
          viewState?.kind === 'group'
            ? viewState.row.groupName
            : viewState?.kind === 'zone'
              ? viewState.row.zoneName
              : viewState?.kind === 'unit'
                ? viewState.row.unitName
                : (viewState?.row.section ?? 'Section')
        }
        subtitle="Record details"
      >
        <CatalogViewGrid rows={viewRows} />
        <FormDialogActions
          primaryLabel="Edit"
          onPrimary={() => {
            if (!viewState) return
            if (viewState.kind === 'group') openEditGroup(viewState.row)
            else if (viewState.kind === 'zone') openEditZone(viewState.row)
            else if (viewState.kind === 'unit') openEditUnit(viewState.row)
            else openEditSection(viewState.row)
          }}
          onCancel={() => setViewState(null)}
          cancelLabel="Close"
        />
      </FormDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tab.slice(0, -1)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected record. Items that are still
              referenced cannot be deleted.
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {activeTable.selectedIds.size} selected?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected records. Items that are
              still referenced cannot be deleted; the operation stops on the
              first failure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkDelete()}>
              Delete selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function OrgTable({
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

function SelectAllHead({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableHead className="w-10">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
        aria-label="Select all on page"
      />
    </TableHead>
  )
}

function SelectCell({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <TableCell>
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={onChange}
        aria-label="Select row"
      />
    </TableCell>
  )
}

function StatusSelect({
  value,
  onChange,
}: {
  value: boolean
  onChange: (active: boolean) => void
}) {
  return (
    <Select
      value={value ? 'active' : 'inactive'}
      onValueChange={(v) => onChange(v === 'active')}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  )
}

function RowActions({
  onView,
  onEdit,
  onDelete,
  disabled,
  deleteDisabled,
}: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
  deleteDisabled?: boolean
}) {
  return (
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="View"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
        >
          <Eye />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete"
          disabled={disabled || deleteDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </TableCell>
  )
}
