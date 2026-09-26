import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { FinancialYearUpsertSchema } from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createFinancialYear,
  deleteFinancialYear,
  FinancialYearConflictError,
  FinancialYearNotFoundError,
  listFinancialYears,
  resolveUserFinancialYear,
  updateFinancialYear,
} from '../services/financialyear.service.js'

async function requireFyManageOr403(c: {
  get: (key: 'currentUser') => AppVariables['currentUser']
}) {
  try {
    await requirePermission(c.get('currentUser'), 'canFinancialYears')
    return null
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { error: err.message }
    }
    throw err
  }
}

const financialYears = new Hono<{ Variables: AppVariables }>()
  .get('/', async (c) => c.json(await listFinancialYears()))
  .get('/current', async (c) => {
    const user = c.get('currentUser')
    const financialYear = await resolveUserFinancialYear(user.id)
    return c.json({ financialYear })
  })
  .post('/', zValidator('json', FinancialYearUpsertSchema), async (c) => {
    const denied = await requireFyManageOr403(c)
    if (denied) return c.json(denied, 403)

    const body = c.req.valid('json')
    try {
      const year = await createFinancialYear({
        appyear: body.appyear,
        closed: body.closed,
      })
      return c.json(year, 201)
    } catch (err) {
      if (err instanceof FinancialYearConflictError) {
        return c.json({ error: err.message }, 409)
      }
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', FinancialYearUpsertSchema),
    async (c) => {
      const denied = await requireFyManageOr403(c)
      if (denied) return c.json(denied, 403)

      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      try {
        const year = await updateFinancialYear(id, {
          appyear: body.appyear,
          closed: body.closed,
        })
        return c.json(year)
      } catch (err) {
        if (err instanceof FinancialYearNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        if (err instanceof FinancialYearConflictError) {
          return c.json({ error: err.message }, 409)
        }
        throw err
      }
    },
  )
  .delete(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      const denied = await requireFyManageOr403(c)
      if (denied) return c.json(denied, 403)

      const { id } = c.req.valid('param')
      try {
        await deleteFinancialYear(id)
        return c.json({ ok: true })
      } catch (err) {
        if (err instanceof FinancialYearNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        if (err instanceof FinancialYearConflictError) {
          return c.json({ error: err.message }, 409)
        }
        throw err
      }
    },
  )

export { financialYears }
