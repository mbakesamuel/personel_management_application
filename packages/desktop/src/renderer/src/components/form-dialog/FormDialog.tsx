import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
  className?: string
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  wide = false,
  children,
  className,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 p-0 sm:max-w-md',
          wide && 'sm:max-w-xl',
          className,
        )}
      >
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription>{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div className="px-6 py-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

type FormDialogRowProps = {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function FormDialogRow({
  label,
  htmlFor,
  children,
  className,
}: FormDialogRowProps) {
  return (
    <div
      className={cn(
        'grid gap-2 py-1 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-2',
        className,
      )}
    >
      <Label
        htmlFor={htmlFor}
        className="pt-2 text-sm font-medium text-muted-foreground sm:text-right"
      >
        {label}
      </Label>
      <div className="min-w-0 space-y-1.5 **:data-[slot=select-trigger]:w-full">
        {children}
      </div>
    </div>
  )
}

export function FormDialogHint({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs text-muted-foreground">{children}</p>
}

export function FormDialogError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  )
}

type FormDialogActionsProps = {
  primaryLabel: string
  onPrimary: () => void
  onCancel?: () => void
  primaryDisabled?: boolean
  primaryVariant?: 'default' | 'destructive'
  cancelDisabled?: boolean
  cancelLabel?: string
}

export function FormDialogActions({
  primaryLabel,
  onPrimary,
  onCancel,
  primaryDisabled,
  primaryVariant = 'default',
  cancelDisabled,
  cancelLabel = 'Cancel',
}: FormDialogActionsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
      <Button
        type="button"
        variant={primaryVariant}
        disabled={primaryDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={cancelDisabled}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  )
}
