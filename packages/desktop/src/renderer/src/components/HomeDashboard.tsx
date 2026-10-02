import type { HomeDashboardResponse, User } from '@personel-management-app/shared'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import type { AppView } from './AppSidebar'
import { AllowanceDashboard } from './AllowanceDashboard'
import { CommunicationDashboard } from './CommunicationDashboard'
import { DashboardHome } from './DashboardHome'
import { WelcomeDashboard } from './WelcomeDashboard'
import { Alert, AlertDescription } from '@/components/ui/alert'

type HomeDashboardProps = {
  user: User
  onNavigate: (view: AppView) => void
}

export function HomeDashboard({ user, onNavigate }: HomeDashboardProps) {
  const [data, setData] = useState<HomeDashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const client = await createApiClient()
      const res = await client.dashboard.$get()
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Failed to load dashboard (${res.status})`)
      }
      setData((await res.json()) as HomeDashboardResponse)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <p className="p-4 text-sm text-muted-foreground">Loading dashboard…</p>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <Alert>
          <AlertDescription>{error ?? 'Failed to load dashboard'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (data.group.kind === 'HR' && data.hr) {
    return (
      <DashboardHome user={user} data={data.hr} onNavigate={onNavigate} />
    )
  }

  if (data.group.kind === 'COMMUNICATION' && data.communication) {
    return (
      <CommunicationDashboard
        user={user}
        groupLabel={data.group.label}
        data={data.communication}
        onNavigate={onNavigate}
      />
    )
  }

  if (data.group.kind === 'ALLOWANCE' && data.allowance) {
    return (
      <AllowanceDashboard
        user={user}
        groupLabel={data.group.label}
        data={data.allowance}
        onNavigate={onNavigate}
      />
    )
  }

  return <WelcomeDashboard user={user} groupLabel={data.group.label} />
}
