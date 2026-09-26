import type { MiddlewareHandler } from 'hono'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.path === '/health') {
    await next()
    return
  }

  const expected = process.env.AUTH_TOKEN
  if (!expected) {
    return c.json({ error: 'AUTH_TOKEN is not configured on the server' }, 500)
  }

  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = header.slice('Bearer '.length).trim()
  if (token !== expected) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  await next()
}
