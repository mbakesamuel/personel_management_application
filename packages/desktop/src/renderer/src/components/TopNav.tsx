import type { FinancialYear, User } from '@perf-appraisal-app/shared'
import { fallbackLabelForRole } from '@perf-appraisal-app/shared'
import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './ThemeToggle'

type TopNavProps = {
  user: User
  financialYear: FinancialYear | null
  collapsed: boolean
  onToggleSidebar: () => void
  onLogout: () => void
}

export function TopNav({
  user,
  financialYear,
  collapsed,
  onToggleSidebar,
  onLogout,
}: TopNavProps) {
  const name = user.username ?? `user #${user.id}`
  const initials = name.slice(0, 2).toUpperCase()
  const roleLabel = fallbackLabelForRole(user.role)

  return (
    <header className="flex shrink-0 items-center gap-6 border-b bg-background px-4 py-3">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleSidebar}
      >
        {collapsed ? <PanelLeft /> : <PanelLeftClose />}
      </Button>

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
