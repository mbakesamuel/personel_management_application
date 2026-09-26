import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SortDir } from './useCatalogTable'

export type CatalogStat = {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: 'blue' | 'slate' | 'emerald' | 'amber' | 'teal'
}

const STAT_TONE: Record<NonNullable<CatalogStat['tone']>, string> = {
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
}

type CatalogScreenProps = {
  brandIcon: LucideIcon
  title: string
  subtitle: string
  headerActions?: ReactNode
  error?: string | null
  stats?: CatalogStat[]
  /** Top-level entity switcher (e.g. Groups / Zones / Units). */
  entityTabs?: ReactNode
  cardTitle: string
  cardSubtitle?: string
  filterTabs?: ReactNode
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** When false, hides the search field (and keeps filterTabs / toolbarExtra). */
  showSearch?: boolean
  toolbarExtra?: ReactNode
  selectionBar?: ReactNode
  table: ReactNode
  pagination?: ReactNode
  className?: string
}

export function CatalogScreen({
  brandIcon: BrandIcon,
  title,
  subtitle,
  headerActions,
  error,
  stats,
  entityTabs,
  cardTitle,
  cardSubtitle,
  filterTabs,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  showSearch = true,
  toolbarExtra,
  selectionBar,
  table,
  pagination,
  className,
}: CatalogScreenProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4',
        className,
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrandIcon className="size-5" />
          </div>
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight">{title}</h2>
            <p className="m-0 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {headerActions ? (
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        ) : null}
      </header>

      {error ? (
        <p className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {stats && stats.length > 0 ? (
        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-xs"
            >
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  STAT_TONE[stat.tone ?? 'blue'],
                )}
              >
                <stat.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-lg font-semibold tabular-nums leading-none">
                  {stat.value}
                </p>
                <p className="m-0 mt-1 truncate text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {entityTabs ? <div className="shrink-0">{entityTabs}</div> : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="m-0 text-base font-semibold">{cardTitle}</h3>
              {cardSubtitle ? (
                <p className="m-0 text-sm text-muted-foreground">{cardSubtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filterTabs}
              {showSearch ? (
                <div className="relative w-full min-w-48 sm:w-56">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                  />
                </div>
              ) : null}
              {toolbarExtra}
            </div>
          </div>
          {selectionBar}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">{table}</div>
        {pagination ? (
          <div className="shrink-0 border-t px-4 py-2">{pagination}</div>
        ) : null}
      </div>
    </section>
  )
}

type CatalogFilterTabsProps = {
  tabs: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}

export function CatalogFilterTabs({
  tabs,
  value,
  onChange,
}: CatalogFilterTabsProps) {
  if (tabs.length <= 1) return null
  return (
    <div className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === tab.value
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

type CatalogSelectionBarProps = {
  count: number
  onClear: () => void
  children?: ReactNode
}

export function CatalogSelectionBar({
  count,
  onClear,
  children,
}: CatalogSelectionBarProps) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <strong>{count} selected</strong>
      {children}
      <button
        type="button"
        className="text-muted-foreground underline-offset-2 hover:underline"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  )
}

type CatalogPaginationProps = {
  pageStart: number
  pageEnd: number
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function CatalogPagination({
  pageStart,
  pageEnd,
  total,
  page,
  totalPages,
  onPageChange,
}: CatalogPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Showing {pageStart}–{pageEnd} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-16 px-2 text-center tabular-nums text-foreground">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

type CatalogSortableThProps = {
  label: string
  column: string
  sortKey: string
  sortDir: SortDir
  onSort: (column: string) => void
  className?: string
}

export function CatalogSortableTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: CatalogSortableThProps) {
  const active = sortKey === column
  return (
    <th
      className={cn(
        'h-10 cursor-pointer px-2 text-left align-middle text-sm font-medium whitespace-nowrap text-foreground select-none hover:bg-muted/50',
        className,
      )}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="size-3.5 text-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-foreground" />
          )
        ) : (
          <ChevronUp className="size-3.5 text-muted-foreground/40" />
        )}
      </span>
    </th>
  )
}

export function CatalogStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

type CatalogViewGridProps = {
  rows: Array<[string, string]>
}

export function CatalogViewGrid({ rows }: CatalogViewGridProps) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[8rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium wrap-break-word">{value}</span>
        </div>
      ))}
    </div>
  )
}
