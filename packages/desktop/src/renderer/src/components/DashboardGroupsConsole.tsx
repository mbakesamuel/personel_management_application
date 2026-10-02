import type {
  DashboardGroupListItem,
  RoleDefinition,
} from '@personel-management-app/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type DashboardGroupsConsoleProps = {
  onClose: () => void
}

const KIND_NOTE: Record<DashboardGroupListItem['kind'], string> = {
  HR: 'Human resources charts',
  COMMUNICATION: 'Communication allowance figures',
  ALLOWANCE: 'Allowance figures',
  WELCOME: 'Welcome until charts are added',
}

function assignmentsFrom(groups: DashboardGroupListItem[]) {
  const next = new Map<string, string>()
  for (const group of groups) {
    for (const roleCode of group.roleCodes) {
      next.set(roleCode, group.code)
    }
  }
  return next
}

export function DashboardGroupsConsole({ onClose }: DashboardGroupsConsoleProps) {
  const [groups, setGroups] = useState<DashboardGroupListItem[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [assigned, setAssigned] = useState<Map<string, string>>(new Map())
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = await createApiClient()
      const [groupsRes, rolesRes] = await Promise.all([
        client['dashboard-groups'].$get(),
        client.roles.$get(),
      ])
      if (!groupsRes.ok) {
        const body = (await groupsRes.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load dashboards (${groupsRes.status})`)
      }
      if (!rolesRes.ok) {
        const body = (await rolesRes.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load roles (${rolesRes.status})`)
      }
      const nextGroups = (await groupsRes.json()) as DashboardGroupListItem[]
      setGroups(nextGroups)
      setRoles((await rolesRes.json()) as RoleDefinition[])
      setAssigned(assignmentsFrom(nextGroups))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sortedRoles = useMemo(
    () => [...roles].sort((left, right) => left.label.localeCompare(right.label)),
    [roles],
  )

  function toggleRole(groupCode: string, roleCode: string, checked: boolean) {
    setAssigned((prev) => {
      const next = new Map(prev)
      if (checked) next.set(roleCode, groupCode)
      else if (next.get(roleCode) === groupCode) next.delete(roleCode)
      return next
    })
    setStatus(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const client = await createApiClient()
      const assignments = [...assigned.entries()].map(([roleCode, groupCode]) => ({
        roleCode,
        groupCode,
      }))
      const res = await client['dashboard-groups'].assignments.$put({
        json: { assignments },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Failed to save assignments (${res.status})`)
      }
      const nextGroups = (await res.json()) as DashboardGroupListItem[]
      setGroups(nextGroups)
      setAssigned(assignmentsFrom(nextGroups))
      setStatus('Dashboard assignments saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function addGroup() {
    const nextLabel = label.trim()
    if (!nextLabel) return
    setAdding(true)
    setError(null)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client['dashboard-groups'].$post({
        json: { label: nextLabel },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Failed to add group (${res.status})`)
      }
      setLabel('')
      setStatus('Dashboard group added.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-lg font-semibold md:text-2xl">Dashboards</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Assign each role to one dashboard. A role with no group sees
            Human-Resource.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <form
        className="flex max-w-xl shrink-0 items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void addGroup()
        }}
      >
        <label className="grid flex-1 gap-1 text-sm">
          New group
          <Input
            value={label}
            maxLength={120}
            placeholder="Group name"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={adding || label.trim().length === 0}>
          Add group
        </Button>
      </form>

      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground">{status}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dashboards…</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.code}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {KIND_NOTE[group.kind]}
              </p>
            </CardHeader>
            <CardContent className="grid gap-2">
              {sortedRoles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={assigned.get(role.code) === group.code}
                    onChange={(event) =>
                      toggleRole(group.code, role.code, event.target.checked)
                    }
                  />
                  {role.label}
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <Button type="button" onClick={() => void save()} disabled={saving || loading}>
          Save assignments
        </Button>
      </div>
    </div>
  )
}
