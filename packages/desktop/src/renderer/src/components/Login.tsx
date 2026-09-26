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

type LoginProps = {
  onLogin: (user: User, financialYear: FinancialYear | null) => void
  onMustChangePassword: (username: string) => void
}

export function Login({ onLogin, onMustChangePassword }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const client = await createApiClient()
      const trimmed = username.trim()
      const res = await client.auth.login.$post({
        json: { username: trimmed, password },
      })

      if (res.status === 401) {
        setError('Invalid username or password.')
        return
      }
      if (!res.ok) {
        setError(`Login failed (${res.status}): ${await res.text()}`)
        return
      }

      const { user, financialYear } = await res.json()
      if (user.mustChangePassword) {
        onMustChangePassword(trimmed)
        return
      }
      onLogin(user, financialYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use your application account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="login-username">Username</Label>
            <Input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
