import type {
  CommunicationDashboard as CommunicationDashboardData,
  User,
} from '@personel-management-app/shared'
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
import type { AppView } from './AppSidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type CommunicationDashboardProps = {
  user: User
  groupLabel: string
  data: CommunicationDashboardData
  onNavigate: (view: AppView) => void
  onOpenMemo: (operatorId: number) => void
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

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

const ADDITION = '#2a9d8f'
const MODIFICATION = '#f4b942'
const REMOVAL = '#e06b6b'

function shortTick(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value
}

function shareLabel(props: { percent?: number; name?: string }) {
  const percent = props.percent ?? 0
  if (percent < 0.08) return ''
  const share = `${Math.round(percent * 100)}%`
  const name = props.name ?? ''
  return name.length > 0 && name.length <= 10 ? `${share} ${name}` : share
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick?: () => void
}) {
  const card = (
    <Card className="min-w-0 gap-1 py-3">
      <CardHeader className="px-3 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 px-3">
        <p className="wrap-break-word text-xl font-semibold md:text-2xl">{value}</p>
      </CardContent>
    </Card>
  )
  if (!onClick) return card
  return (
    <button
      type="button"
      className="min-w-0 rounded-xl text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {card}
    </button>
  )
}

export function CommunicationDashboard({
  user,
  groupLabel,
  data,
  onNavigate,
  onOpenMemo,
}: CommunicationDashboardProps) {
  const name = user.username?.trim() || 'there'
  const slices = data.operators.filter((row) => row.openLines > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-lg font-semibold md:text-2xl">
            Hello, {name}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {groupLabel}
          </p>
        </div>
        {user.permissions.canCommunicationAllowance ? (
          <Button
            type="button"
            className="shrink-0"
            onClick={() => onNavigate('registrations')}
          >
            Registration
          </Button>
        ) : null}
      </div>

      <section className="grid shrink-0 gap-2 sm:grid-cols-3 xl:grid-cols-3">
        <Stat label="Total Employees on Fleet" value={String(data.openLines)} />
        <Stat label="Total No. Inactive" value={String(data.closedLines)} />
        <Stat
          label="Total No. Active"
          value={String(data.employeesOnOpenLines)}
        />
        <Stat label="Total Airtime Amount" value={formatAmount(data.airtimeTotal)} />
        <Stat
          label="Batches this month"
          value={String(data.batchesThisMonth)}
        />
        <Stat
          label="Incomplete registrations"
          value={String(data.incompleteRegistrations)}
          onClick={
            user.permissions.canCommunicationAllowance
              ? () => onNavigate('registrations')
              : undefined
          }
        />
      </section>

      <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-3">
        <Card className="min-h-0 min-w-0 flex-1 gap-1 overflow-hidden py-3">
          <CardHeader className="shrink-0 px-3 pb-0">
            <CardTitle className="text-sm font-medium">
              Open lines per operator
            </CardTitle>
          </CardHeader>
          <CardContent className="relative min-h-0 flex-1 px-3 pb-3">
            <div className="absolute inset-0">
            {slices.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="openLines"
                    nameKey="name"
                    outerRadius="68%"
                    label={shareLabel}
                    labelLine={false}
                  >
                    {slices.map((row, index) => (
                      <Cell
                        key={row.name}
                        fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No operators yet.
              </p>
            )}
            </div>
          </CardContent>
        </Card>
        <Card className="min-h-0 min-w-0 flex-1 gap-1 overflow-hidden py-3">
          <CardHeader className="shrink-0 px-3 pb-0">
            <CardTitle className="text-sm font-medium">Memos waiting</CardTitle>
          </CardHeader>
          <CardContent className="relative min-h-0 flex-1 px-3 pb-3">
            <div className="absolute inset-0">
              {data.pendingMemos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.pendingMemos}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    cursor={
                      user.permissions.canCommunicationAllowance ? 'pointer' : undefined
                    }
                    onClick={(state) => {
                      if (!user.permissions.canCommunicationAllowance) return
                      const index = Number(state.activeTooltipIndex)
                      const row = data.pendingMemos[index]
                      if (row) onOpenMemo(row.operatorId)
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-28}
                      height={42}
                      textAnchor="end"
                      tickFormatter={shortTick}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      width={32}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="creations" name="Addition" stackId="memo" fill={ADDITION} />
                    <Bar
                      dataKey="modifications"
                      name="Modification"
                      stackId="memo"
                      fill={MODIFICATION}
                    />
                    <Bar dataKey="removals" name="Removal" stackId="memo" fill={REMOVAL} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No memos waiting.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
