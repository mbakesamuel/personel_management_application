import type { Jurisdiction, RoleDefinition } from '@personel-management-app/shared'
import { Eye, Pencil, Plus, Shield, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  FormDialogHint,
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
import { cn } from '@/lib/utils'

type RolesConsoleProps = {
  onClose: () => void
}

type FormState = {
  code: string
  label: string
  jurisdiction: string
  canAppraisals: boolean
  canFinancialYears: boolean
  canOrganization: boolean
  canPersonnel: boolean
  canLeave: boolean
  canAllowances: boolean
  canAllowanceTypes: boolean
  canAllowanceCatalog: boolean
  canAllowanceRates: boolean
  canAllowanceAllocations: boolean
  canPositionKeywords: boolean
  canAllowanceMatrix: boolean
  canCommunicationAllowance: boolean
  canValidate: boolean
  canDemoteClassification: boolean
  canEditValidated: boolean
  canLetterCc: boolean
  canDecisionMatrix: boolean
  canThroughOfficers: boolean
  canImportHistory: boolean
  canExportHistory: boolean
  canImportFleet: boolean
  canUsers: boolean
  canRoles: boolean
}

const PAGE_SIZE = 10

const PERMISSION_FIELDS = [
  ['canAppraisals', 'Appraisals'],
  ['canFinancialYears', 'Financial years'],
  ['canOrganization', 'Organization'],
  ['canPersonnel', 'Personnel'],
  ['canLeave', 'Leave'],
  ['canAllowances', 'Allowances module'],
  ['canAllowanceTypes', 'Allowance types'],
  ['canAllowanceCatalog', 'Allowance catalog'],
  ['canAllowanceRates', 'Allowance rates'],
  ['canAllowanceAllocations', 'Allowance allocations'],
  ['canPositionKeywords', 'Position keywords'],
  ['canAllowanceMatrix', 'Allowance matrix'],
  ['canCommunicationAllowance', 'Communication allowance'],
  ['canValidate', 'Validate workflow'],
  ['canDemoteClassification', 'Demote classification'],
  ['canEditValidated', 'Edit validated records'],
  ['canLetterCc', 'Letter copies (CC)'],
  ['canDecisionMatrix', 'Decision Matrix'],
  ['canThroughOfficers', 'Through Officers'],
  ['canImportHistory', 'Import historic appraisals'],
  ['canExportHistory', 'Export historic appraisals'],
  ['canImportFleet', 'Import fleet'],
  ['canUsers', 'Users'],
  ['canRoles', 'Roles'],
] as const

function emptyForm(defaultJurisdiction = 'section'): FormState {
  return {
    code: '',
    label: '',
    jurisdiction: defaultJurisdiction,
    canAppraisals: true,
    canFinancialYears: false,
    canOrganization: false,
    canPersonnel: false,
    canLeave: false,
    canAllowances: false,
    canAllowanceTypes: false,
    canAllowanceCatalog: false,
    canAllowanceRates: false,
    canAllowanceAllocations: false,
    canPositionKeywords: false,
    canAllowanceMatrix: false,
    canCommunicationAllowance: false,
    canValidate: false,
    canDemoteClassification: false,
    canEditValidated: false,
    canLetterCc: false,
    canDecisionMatrix: false,
    canThroughOfficers: false,
    canImportHistory: false,
    canExportHistory: false,
    canImportFleet: false,
    canUsers: false,
    canRoles: false,
  }
}

function permissionsSummary(role: RoleDefinition): string {
  const flags: string[] = []
  if (role.canAppraisals) flags.push('Appraisals')
  if (role.canFinancialYears) flags.push('FY')
  if (role.canOrganization) flags.push('Org')
  if (role.canPersonnel) flags.push('Personnel')
  if (role.canLeave) flags.push('Leave')
  if (role.canAllowances) flags.push('Allowances')
  if (role.canAllowanceTypes) flags.push('Types')
  if (role.canAllowanceCatalog) flags.push('Catalog')
  if (role.canAllowanceRates) flags.push('Rates')
  if (role.canAllowanceAllocations) flags.push('Allocations')
  if (role.canPositionKeywords) flags.push('Keywords')
  if (role.canAllowanceMatrix) flags.push('Allow. matrix')
  if (role.canCommunicationAllowance) flags.push('Comm. allowance')
  if (role.canValidate) flags.push('Validate workflow')
  if (role.canDemoteClassification) flags.push('Demote class.')
  if (role.canEditValidated) flags.push('Edit validated')
  if (role.canLetterCc) flags.push('CC')
  if (role.canDecisionMatrix) flags.push('Matrix')
  if (role.canThroughOfficers) flags.push('Thro')
  if (role.canImportHistory) flags.push('Import')
  if (role.canExportHistory) flags.push('Export')
  if (role.canImportFleet) flags.push('Fleet import')
  if (role.canUsers) flags.push('Users')
  if (role.canRoles) flags.push('Roles')
  return flags.length > 0 ? flags.join(', ') : 'None'
}

function permissionCount(role: RoleDefinition): number {
  return PERMISSION_FIELDS.filter(([key]) => role[key]).length
}

function jurisdictionLabel(
  code: string,
  jurisdictions: Jurisdiction[],
): string {
  return jurisdictions.find((j) => j.code === code)?.label ?? code
}

export function RolesConsole({ onClose }: RolesConsoleProps) {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('edit')
  const [form, setForm] = useState<FormState | null>(null)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [viewRow, setViewRow] = useState<RoleDefinition | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [rolesRes, jurisdictionsRes] = await Promise.all([
        client.roles.$get(),
        client.jurisdictions.$get({ query: { activeOnly: '1' } }),
      ])
      if (!rolesRes.ok) {
        const body = (await rolesRes.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load roles (${rolesRes.status})`)
      }
      if (!jurisdictionsRes.ok) {
        const body = (await jurisdictionsRes.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(
          body?.error ??
            `Failed to load jurisdictions (${jurisdictionsRes.status})`,
        )
      }
      setRoles((await rolesRes.json()) as RoleDefinition[])
      setJurisdictions((await jurisdictionsRes.json()) as Jurisdiction[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  const table = useCatalogTable({
    rows: roles,
    getId: (row) => row.code,
    pageSize: PAGE_SIZE,
    matchesSearch: (row, q) =>
      [
        row.code,
        row.label,
        jurisdictionLabel(row.jurisdiction, jurisdictions),
        permissionsSummary(row),
      ].some((v) => String(v).toLowerCase().includes(q)),
    getSortValue: (row, key) => {
      if (key === 'label') return row.label
      if (key === 'jurisdiction') {
        return jurisdictionLabel(row.jurisdiction, jurisdictions)
      }
      if (key === 'permissions') return permissionCount(row)
      return row.code
    },
    defaultSortKey: 'code',
  })

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Roles',
        value: roles.length,
        icon: Shield,
        tone: 'blue',
      },
      {
        label: 'Can manage users',
        value: roles.filter((r) => r.canUsers).length,
        icon: Users,
        tone: 'teal',
      },
      {
        label: 'Can manage roles',
        value: roles.filter((r) => r.canRoles).length,
        icon: Shield,
        tone: 'amber',
      },
      {
        label: 'With allowances',
        value: roles.filter((r) => r.canAllowances).length,
        icon: Shield,
        tone: 'slate',
      },
    ],
    [roles],
  )

  function openCreate() {
    setDialogMode('create')
    setEditingCode(null)
    setFormError(null)
    setForm(
      emptyForm(
        jurisdictions.find((j) => j.code === 'section')?.code ??
          jurisdictions[0]?.code ??
          'section',
      ),
    )
    setDialogOpen(true)
  }

  function openEdit(row: RoleDefinition) {
    setDialogMode('edit')
    setEditingCode(row.code)
    setFormError(null)
    setForm({
      code: row.code,
      label: row.label,
      jurisdiction: row.jurisdiction,
      canAppraisals: row.canAppraisals,
      canFinancialYears: row.canFinancialYears,
      canOrganization: row.canOrganization,
      canPersonnel: row.canPersonnel,
      canLeave: row.canLeave,
      canAllowances: row.canAllowances,
      canAllowanceTypes: row.canAllowanceTypes,
      canAllowanceCatalog: row.canAllowanceCatalog,
      canAllowanceRates: row.canAllowanceRates,
      canAllowanceAllocations: row.canAllowanceAllocations,
      canPositionKeywords: row.canPositionKeywords,
      canAllowanceMatrix: row.canAllowanceMatrix,
      canCommunicationAllowance: row.canCommunicationAllowance,
      canValidate: row.canValidate,
      canDemoteClassification: row.canDemoteClassification,
      canEditValidated: row.canEditValidated,
      canLetterCc: row.canLetterCc,
      canDecisionMatrix: row.canDecisionMatrix,
      canThroughOfficers: row.canThroughOfficers,
      canImportHistory: row.canImportHistory,
      canExportHistory: row.canExportHistory,
      canImportFleet: row.canImportFleet,
      canUsers: row.canUsers,
      canRoles: row.canRoles,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form) return
    setLoading(true)
    setFormError(null)
    setStatus(null)
    try {
      const client = await createApiClient()
      const payload = {
        label: form.label.trim(),
        jurisdiction: form.jurisdiction,
        canAppraisals: form.canAppraisals,
        canFinancialYears: form.canFinancialYears,
        canOrganization: form.canOrganization,
        canPersonnel: form.canPersonnel,
        canLeave: form.canLeave,
        canAllowances: form.canAllowances,
        canAllowanceTypes: form.canAllowanceTypes,
        canAllowanceCatalog: form.canAllowanceCatalog,
        canAllowanceRates: form.canAllowanceRates,
        canAllowanceAllocations: form.canAllowanceAllocations,
        canPositionKeywords: form.canPositionKeywords,
        canAllowanceMatrix: form.canAllowanceMatrix,
        canCommunicationAllowance: form.canCommunicationAllowance,
        canValidate: form.canValidate,
        canDemoteClassification: form.canDemoteClassification,
        canEditValidated: form.canEditValidated,
        canLetterCc: form.canLetterCc,
        canDecisionMatrix: form.canDecisionMatrix,
        canThroughOfficers: form.canThroughOfficers,
        canImportHistory: form.canImportHistory,
        canExportHistory: form.canExportHistory,
        canImportFleet: form.canImportFleet,
        canUsers: form.canUsers,
        canRoles: form.canRoles,
      }

      const res =
        dialogMode === 'create'
          ? await client.roles.$post({
              json: {
                code: form.code.trim().toUpperCase(),
                ...payload,
              },
            })
          : await client.roles[':code'].$put({
              param: { code: editingCode! },
              json: payload,
            })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      setDialogOpen(false)
      await loadRoles()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const editingAdmin =
    dialogMode === 'edit' && editingCode === 'ADMINISTRATOR'

  const viewRows: Array<[string, string]> = viewRow
    ? [
        ['Code', viewRow.code],
        ['Label', viewRow.label],
        [
          'Jurisdiction',
          jurisdictionLabel(viewRow.jurisdiction, jurisdictions),
        ],
        ['Permissions', permissionsSummary(viewRow)],
        ...PERMISSION_FIELDS.map(
          ([key, label]) =>
            [label, viewRow[key] ? 'Yes' : 'No'] as [string, string],
        ),
      ]
    : []

  return (
    <>
      <CatalogScreen
        brandIcon={Shield}
        title="Roles & permissions"
        subtitle="Role codes, jurisdictions, and access flags"
        headerActions={
          <>
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              disabled={loading}
            >
              <Plus className="size-4" />
              Add Role
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </>
        }
        error={status}
        stats={stats}
        cardTitle="All Roles"
        cardSubtitle={
          loading ? 'Loading…' : `${table.filteredCount} records`
        }
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search roles…"
        table={
          <DataTable
            loading={loading}
            emptyLabel={
              table.search ? 'No roles match the search.' : 'No roles found.'
            }
            colSpan={5}
            header={
              <TableRow>
                <CatalogSortableTh
                  label="Code"
                  column="code"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <CatalogSortableTh
                  label="Label"
                  column="label"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <CatalogSortableTh
                  label="Jurisdiction"
                  column="jurisdiction"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <CatalogSortableTh
                  label="Permissions"
                  column="permissions"
                  sortKey={table.sortKey}
                  sortDir={table.sortDir}
                  onSort={table.toggleSort}
                />
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            }
          >
            {table.paginated.map((row) => (
              <TableRow
                key={row.code}
                className={cn(
                  table.selectedIds.has(row.code) && 'bg-muted/40',
                )}
                onDoubleClick={() => setViewRow(row)}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {row.code}
                </TableCell>
                <TableCell>{row.label}</TableCell>
                <TableCell>
                  {jurisdictionLabel(row.jurisdiction, jurisdictions)}
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {permissionsSummary(row)}
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
            ? 'Add role'
            : `Edit role — ${editingCode}`
        }
        subtitle="Set jurisdiction and permissions for this role"
        wide
      >
        {form ? (
          <>
            {dialogMode === 'create' ? (
              <FormDialogRow label="Code" htmlFor="role-code">
                <Input
                  id="role-code"
                  value={form.code}
                  placeholder="e.g. UNIT_CLERK"
                  className="font-mono uppercase"
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            code: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9_]/g, ''),
                          }
                        : prev,
                    )
                  }
                />
                <FormDialogHint>
                  Starts with a letter; use A–Z, 0–9, or underscore only.
                </FormDialogHint>
              </FormDialogRow>
            ) : null}
            <FormDialogRow label="Label" htmlFor="role-label">
              <Input
                id="role-label"
                value={form.label}
                placeholder="e.g. Unit Clerk"
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, label: e.target.value } : prev,
                  )
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Jurisdiction">
              <Select
                value={form.jurisdiction}
                onValueChange={(value) =>
                  setForm((prev) =>
                    prev ? { ...prev, jurisdiction: value } : prev,
                  )
                }
                disabled={editingAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.code} value={j.code}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Permissions">
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSION_FIELDS.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={form[key]}
                      disabled={editingAdmin && key === 'canRoles'}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, [key]: e.target.checked }
                            : prev,
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FormDialogRow>
          </>
        ) : null}
        <FormDialogError>{formError}</FormDialogError>
        <FormDialogActions
          primaryLabel={
            loading
              ? 'Saving…'
              : dialogMode === 'create'
                ? 'Add role'
                : 'Save changes'
          }
          onPrimary={() => void handleSave()}
          onCancel={() => setDialogOpen(false)}
          primaryDisabled={
            loading ||
            !form ||
            !form.label.trim() ||
            (dialogMode === 'create' && !form.code.trim())
          }
          cancelDisabled={loading}
        />
      </FormDialog>

      <FormDialog
        open={viewRow != null}
        onOpenChange={(open) => {
          if (!open) setViewRow(null)
        }}
        title="Role details"
        subtitle={viewRow ? viewRow.code : undefined}
        wide
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
