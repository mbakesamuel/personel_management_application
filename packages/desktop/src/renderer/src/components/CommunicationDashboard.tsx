import type {
  CommunicationDashboard as CommunicationDashboardData,
  User,
} from '@personel-management-app/shared'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function shortTick(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value
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
}: CommunicationDashboardProps) {
  const name = user.username?.trim() || 'there'
  const hasOperators = data.operators.length > 0

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

      <section className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Open lines" value={String(data.openLines)} />
        <Stat label="Closed lines" value={String(data.closedLines)} />
        <Stat
          label="Employees on an open line"
          value={String(data.employeesOnOpenLines)}
        />
        <Stat label="Current Airtime" value={formatAmount(data.airtimeTotal)} />
        <Stat label="Current Data" value={formatAmount(data.dataTotal)} />
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

      <Card className="min-h-0 min-w-0 flex-1 gap-1 overflow-hidden py-3">
        <CardHeader className="shrink-0 px-3 pb-0">
          <CardTitle className="text-sm font-medium">
            Open lines per operator
          </CardTitle>
        </CardHeader>
        <CardContent className="relative min-h-0 flex-1 px-3 pb-3">
          <div className="absolute inset-0">
          {hasOperators ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.operators}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
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
                <Bar dataKey="openLines" name="Open lines" fill="#f4b942" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No operators yet.
            </p>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
