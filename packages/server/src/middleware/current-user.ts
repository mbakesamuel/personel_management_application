import type { MiddlewareHandler } from 'hono'
import type { User } from '@perf-appraisal-app/shared'
import { findUserById } from '../services/user-mapper.js'

export type AppVariables = {
  currentUser: User
}

const PUBLIC_WITHOUT_USER = new Set(['/health', '/auth/login'])

export const currentUserMiddleware: MiddlewareHandler<{
  Variables: AppVariables
}> = async (c, next) => {
  const path = c.req.path
  if (PUBLIC_WITHOUT_USER.has(path) || path.startsWith('/auth/')) {
    await next()
    return
  }

  const raw = c.req.header('x-user-id')
  const userId = raw ? Number(raw) : NaN
  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: 'Missing or invalid x-user-id header' }, 401)
  }

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  c.set('currentUser', user)
  await next()
}
