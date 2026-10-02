import type { User } from '@personel-management-app/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type WelcomeDashboardProps = {
  user: User
  groupLabel: string
}

export function WelcomeDashboard({ user, groupLabel }: WelcomeDashboardProps) {
  const name = user.username?.trim() || 'there'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
      <div className="min-w-0">
        <h1 className="m-0 truncate text-lg font-semibold md:text-2xl">
          Hello, {name}
        </h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {groupLabel}
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{groupLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Charts for this group will be added later.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
