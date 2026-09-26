import { Hono } from 'hono'
import type { HealthResponse } from '@perf-appraisal-app/shared'

const health = new Hono().get('/', (c) => {
  const body: HealthResponse = { status: 'ok' }
  return c.json(body)
})

export { health }
