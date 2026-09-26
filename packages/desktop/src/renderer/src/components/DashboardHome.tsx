import type { DashboardResponse, User } from '@perf-appraisal-app/shared'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import type { AppView } from './AppSidebar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DashboardHomeProps = {
  user: User
  onNavigate: (view: AppView) => void
}

function CountCard({
  label,
  value,
  onOpen,
}: {
  label: string
  value: number
  onOpen?: () => void
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3 px-4">
        <p className="m-0 text-3xl font-semibold tabular-nums">{value}</p>
        {onOpen ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpen}>
            Open
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DashboardHome({ user, onNavigate }: DashboardHomeProps) {
  const [data, setData] = useState<DashboardResponse | null>(null)
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
      setData((await res.json()) as DashboardResponse)
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

  const name = user.username?.trim() || 'there'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="m-0 text-2xl font-semibold">Hello, {name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.scopeLabel ?? 'Your jurisdiction'}
            {data?.appyear != null ? ` · Financial year ${data.appyear}` : ''}
          </p>
        </div>

        {error ? (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading status…</p>
        ) : null}

        {data?.appraisals ? (
          <section className="grid gap-3">
            <h2 className="m-0 text-lg font-semibold">Appraisals</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <CountCard
                label="In progress"
                value={data.appraisals.inProgress}
                onOpen={() => onNavigate('appraisal-console')}
              />
              <CountCard
                label="Awarded"
                value={data.appraisals.awarded}
                onOpen={() => onNavigate('appraisal-console')}
              />
              <CountCard
                label="Posted"
                value={data.appraisals.posted}
                onOpen={() => onNavigate('appraisal-summary')}
              />
            </div>
          </section>
        ) : null}

        {data?.allowances ? (
          <section className="grid gap-3">
            <h2 className="m-0 text-lg font-semibold">Allowances</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <CountCard
                label="Pending"
                value={data.allowances.pending}
                onOpen={() => onNavigate('allowances')}
              />
              <CountCard
                label="Validated"
                value={data.allowances.validated}
                onOpen={() => onNavigate('allowances')}
              />
              <CountCard
                label="Rejected"
                value={data.allowances.rejected}
                onOpen={() => onNavigate('allowances')}
              />
            </div>
          </section>
        ) : null}

        {!loading && data && !data.appraisals && !data.allowances ? (
          <p className="text-sm text-muted-foreground">
            No status cards for your permissions.
          </p>
        ) : null}
      </div>
    </div>
  )
}
