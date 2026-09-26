import { useState, type FormEvent } from 'react'
import type { FinancialYear, User } from '@perf-appraisal-app/shared'
import { createApiClient } from '../api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ChangePasswordProps = {
  username: string
  onChanged: (user: User, financialYear: FinancialYear | null) => void
  onCancel: () => void
}

export function ChangePassword({
  username,
  onChanged,
  onCancel,
}: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the temporary password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setBusy(true)
    try {
      const client = await createApiClient()
      const res = await client.auth['change-password'].$post({
        json: {
          username,
          currentPassword,
          newPassword,
        },
      })

      if (res.status === 401) {
        setError('Invalid temporary password.')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? `Password change failed (${res.status})`)
        return
      }

      const { user, financialYear } = await res.json()
      onChanged(user, financialYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Your account was issued a temporary password. Choose a new password
          to continue as <span className="font-medium">{username}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="change-current-password">Temporary password</Label>
            <Input
              id="change-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="change-new-password">New password</Label>
            <Input
              id="change-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="change-confirm-password">Confirm new password</Label>
            <Input
              id="change-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={busy}
            onClick={onCancel}
          >
            Back to sign in
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
