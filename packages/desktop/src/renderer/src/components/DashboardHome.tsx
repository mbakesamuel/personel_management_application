import type {
  DashboardResponse,
  DashboardSexBar,
  DashboardSlice,
  User,
} from '@personel-management-app/shared'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createApiClient } from '../api/client'
import type { AppView } from './AppSidebar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DashboardHomeProps = {
  user: User
  onNavigate: (view: AppView) => void
}

const MALE = '#2a9d8f'
const FEMALE = '#e06b6b'
const SLICE_COLORS = [
  '#3b82f6',
  '#f4b942',
  '#8b7ec8',
  '#2a9d8f',
  '#e07a3d',
  '#5aa9e6',
  '#7d9a5a',
  '#d4a017',
  '#94a3b8',
]

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="h-full min-h-0 gap-1 overflow-hidden py-3">
      <CardHeader className="shrink-0 px-3 pb-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative min-h-0 flex-1 px-1 pb-1">
        <div className="absolute inset-0">{children}</div>
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No records in this scope.
    </p>
  )
}

function shareLabel(props: { percent?: number; name?: string }) {
  const percent = props.percent ?? 0
  if (percent < 0.08) return ''
  const share = `${Math.round(percent * 100)}%`
  const name = props.name ?? ''
  return name.length > 0 && name.length <= 10 ? `${share} ${name}` : share
}

function shortTick(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value
}

function SliceChart({
  data,
  donut,
}: {
  data: DashboardSlice[]
  donut?: boolean
}) {
  const slices = data.filter((row) => row.value > 0)
  if (slices.length === 0) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          innerRadius={donut ? '42%' : 0}
          outerRadius="68%"
          label={shareLabel}
          labelLine={false}
        >
          {slices.map((row, index) => (
            <Cell
              key={row.label}
              fill={
                row.label === 'Male'
                  ? MALE
                  : row.label === 'Female'
                    ? FEMALE
                    : SLICE_COLORS[index % SLICE_COLORS.length]
              }
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function SexBarChart({ data }: { data: DashboardSexBar[] }) {
  if (data.length === 0) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={0}
          angle={-28}
          height={42}
          textAnchor="end"
          tickFormatter={shortTick}
        />
        <YAxis tick={{ fontSize: 10 }} width={32} />
        <Tooltip />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="male" name="Male" stackId="sex" fill={MALE} />
        <Bar dataKey="female" name="Female" stackId="sex" fill={FEMALE} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function MovementChart({
  data,
}: {
  data: DashboardResponse['workforce']['movement']
}) {
  const hasRows = data.some((row) => row.engagements > 0 || row.departures > 0)
  if (!hasRows) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 10 }} width={32} />
        <Tooltip />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="engagements" name="Engagements" fill="#3b82f6" />
        <Bar dataKey="departures" name="Departures" fill="#e07a3d" />
      </BarChart>
    </ResponsiveContainer>
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
  const workforce = data?.workforce

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-lg font-semibold md:text-2xl">
            Hello, {name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {data?.scopeLabel ?? 'Your jurisdiction'}
            {data?.appyear != null ? ` · Financial year ${data.appyear}` : ''}
          </p>
        </div>
        {user.permissions.canPersonnel ? (
          <Button type="button" onClick={() => onNavigate('personnel')}>
            Personnel
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert className="shrink-0">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="shrink-0 text-sm text-muted-foreground">Loading status…</p>
      ) : null}

      {workforce ? (
        <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-6 gap-2 overflow-hidden md:grid-cols-2 md:grid-rows-3 xl:grid-cols-3 xl:grid-rows-2">
          <ChartCard title="Sex">
            <SliceChart data={workforce.sex} donut />
          </ChartCard>
          <ChartCard title="Category">
            <SexBarChart data={workforce.category} />
          </ChartCard>
          <ChartCard title="Group">
            <SexBarChart data={workforce.group} />
          </ChartCard>
          <ChartCard title="Work status">
            <SliceChart data={workforce.workStatus} donut />
          </ChartCard>
          <ChartCard title="Place of engagement">
            <SliceChart data={workforce.place} />
          </ChartCard>
          <ChartCard title="Engagements and departures">
            <MovementChart data={workforce.movement} />
          </ChartCard>
        </section>
      ) : null}
    </div>
  )
}
