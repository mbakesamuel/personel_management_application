import type {
  AllowanceDashboard as AllowanceDashboardData,
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

type AllowanceDashboardProps = {
  user: User
  groupLabel: string
  data: AllowanceDashboardData
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
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
}

export function AllowanceDashboard({
  user,
  groupLabel,
  data,
  onNavigate,
}: AllowanceDashboardProps) {
  const name = user.username?.trim() || 'there'
  const hasAllowances = data.allowances.length > 0

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
        {user.permissions.canAllowances ? (
          <Button
            type="button"
            className="shrink-0"
            onClick={() => onNavigate('allowances')}
          >
            Allowances
          </Button>
        ) : null}
      </div>

      <section className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Current allocations"
          value={String(data.currentAllocations)}
        />
        <Stat
          label="Employees allocated"
          value={String(data.employeesAllocated)}
        />
        <Stat label="Pending" value={String(data.pending)} />
        <Stat label="Validated" value={String(data.validated)} />
        <Stat label="Rejected" value={String(data.rejected)} />
        <Stat label="Total current amount" value={formatAmount(data.totalAmount)} />
      </section>

      <Card className="min-h-0 min-w-0 flex-1 gap-1 overflow-hidden py-3">
        <CardHeader className="shrink-0 px-3 pb-0">
          <CardTitle className="text-sm font-medium">
            Current amount per allowance
          </CardTitle>
        </CardHeader>
        <CardContent className="relative min-h-0 flex-1 px-3 pb-3">
          <div className="absolute inset-0">
          {hasAllowances ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.allowances}
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
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value) => formatAmount(Number(value))} />
                <Bar dataKey="amount" name="Current amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No current allocations yet.
            </p>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
