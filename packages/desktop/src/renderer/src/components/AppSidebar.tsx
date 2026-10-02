import type { LucideIcon } from "lucide-react"
import { House } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type AppView =
  | "home"
  | "appraisal-console"
  | "financial-years"
  | "import-salary-review"
  | "import-fleet"
  | "export-salary-review"
  | "organization"
  | "personnel"
  | "allowances"
  | "operators"
  | "registrations"
  | "allowance-changes"
  | "allowance-history"
  | "position-keywords"
  | "allowance-matrix"
  | "decision-matric"
  | "thro-officers"
  | "letter-copies"
  | "users"
  | "roles"
  | "dashboard-groups"
  | "jurisdictions"
  | "letters"
  | "appraisal-summary"
  | "allocation-letters"
  | "allowance-change-letters"
  | "communication-lines"

export type SidebarItem = {
  view: AppView
  label: string
}

export type SidebarGroup = {
  id: string
  label: string
  icon: LucideIcon
  items: SidebarItem[]
}

type AppSidebarProps = {
  groups: SidebarGroup[]
  currentView: AppView
  collapsed: boolean
  onNavigate: (view: AppView) => void
}

function navButtonClass(active: boolean) {
  return cn(
    "h-8 w-full justify-start px-2 font-normal",
    active && "bg-accent text-accent-foreground"
  )
}

export function AppSidebar({
  groups,
  currentView,
  collapsed,
  onNavigate,
}: AppSidebarProps) {
  const visibleGroups = groups.filter((group) => group.items.length > 0)

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-12" : "w-64"
      )}
    >
      <TooltipProvider delayDuration={400}>
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Main" className={cn("p-2", collapsed && "px-1")}>
            {collapsed ? (
              <CollapsedNav
                groups={visibleGroups}
                currentView={currentView}
                onNavigate={onNavigate}
              />
            ) : (
              <ExpandedNav
                groups={visibleGroups}
                currentView={currentView}
                onNavigate={onNavigate}
              />
            )}
          </nav>
        </ScrollArea>
      </TooltipProvider>
    </aside>
  )
}

function ExpandedNav({
  groups,
  currentView,
  onNavigate,
}: {
  groups: SidebarGroup[]
  currentView: AppView
  onNavigate: (view: AppView) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={navButtonClass(currentView === "home")}
        onClick={() => onNavigate("home")}
      >
        <House />
        Home
      </Button>

      {groups.length > 0 ? (
        <Accordion
          type="multiple"
          defaultValue={groups.map((group) => group.id)}
          className="w-full"
        >
          {groups.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border-b-0">
              <AccordionTrigger className="px-2 py-2 hover:no-underline">
                <span className="flex items-center gap-2">
                  <group.icon className="size-4 shrink-0" />
                  {group.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <div className="flex flex-col gap-0.5 pl-2">
                  {group.items.map((item) => (
                    <Button
                      key={item.view}
                      variant="ghost"
                      size="sm"
                      className={navButtonClass(currentView === item.view)}
                      onClick={() => onNavigate(item.view)}
                    >
                      <span className="truncate">{item.label}</span>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}
    </div>
  )
}

function CollapsedNav({
  groups,
  currentView,
  onNavigate,
}: {
  groups: SidebarGroup[]
  currentView: AppView
  onNavigate: (view: AppView) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(currentView === "home" && "bg-accent text-accent-foreground")}
            aria-label="Home"
            onClick={() => onNavigate("home")}
          >
            <House />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Home</TooltipContent>
      </Tooltip>

      {groups.map((group) => {
        const Icon = group.icon
        const groupActive = group.items.some((item) => item.view === currentView)

        return (
          <DropdownMenu key={group.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(groupActive && "bg-accent text-accent-foreground")}
                    aria-label={group.label}
                  >
                    <Icon />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{group.label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="min-w-44">
              {group.items.map((item) => (
                <DropdownMenuItem
                  key={item.view}
                  className={cn(
                    currentView === item.view && "bg-accent text-accent-foreground"
                  )}
                  onSelect={() => onNavigate(item.view)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
