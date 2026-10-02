import { Hono } from 'hono'
import type { AppVariables } from '../middleware/current-user.js'
import { buildHomeDashboard } from '../services/dashboard.service.js'

const dashboard = new Hono<{ Variables: AppVariables }>().get('/', async (c) => {
  const user = c.get('currentUser')
  return c.json(await buildHomeDashboard(user))
})

export { dashboard }
