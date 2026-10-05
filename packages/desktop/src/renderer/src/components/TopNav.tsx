import type { FinancialYear, User } from '@personel-management-app/shared'
import { fallbackLabelForRole } from '@personel-management-app/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LOGO_SRC } from '../lib/logo'
import { REPORT_COMPANY_NAME } from './ReportHeader'
import { ThemeToggle } from './ThemeToggle'

type TopNavProps = {
  user: User
  financialYear: FinancialYear | null
  onLogout: () => void
}

export function TopNav({ user, financialYear, onLogout }: TopNavProps) {
  const name = user.username ?? `user #${user.id}`
  const initials = name.slice(0, 2).toUpperCase()
  const roleLabel = fallbackLabelForRole(user.role)

  return (
    <header className="flex shrink-0 items-center gap-6 border-b bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={LOGO_SRC}
          alt={REPORT_COMPANY_NAME}
          className="h-8 object-contain"
        />
        <span className="truncate text-sm font-semibold">{REPORT_COMPANY_NAME}</span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2" title={roleLabel}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">
              {roleLabel} · FY {financialYear?.appyear ?? '—'}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
