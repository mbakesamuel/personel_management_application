import { Hono } from 'hono'
import type { AppVariables } from '../middleware/current-user.js'
import { ForbiddenError, requirePermission } from '../services/authz.service.js'
import { listDecisionLevels } from '../services/decision.service.js'

const decisionLevels = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canDecisionMatrix')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', async (c) => c.json(await listDecisionLevels()))

export { decisionLevels }
