import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  PositionKeywordUpdateSchema,
  PositionKeywordUpsertSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import { ForbiddenError, requireAnyPermission, requirePermission } from '../services/authz.service.js'
import {
  createPositionKeyword,
  deletePositionKeyword,
  listPositionKeywords,
  PositionKeywordConflictError,
  PositionKeywordNotFoundError,
  updatePositionKeyword,
} from '../services/position-keywords.service.js'

function mapError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof PositionKeywordNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof PositionKeywordConflictError) {
    return { status: 409 as const, message: err.message }
  }
  return null
}

const IdParam = z.object({
  id: z.coerce.number().int().positive(),
})

const positionKeywords = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canAllowances')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', async (c) => {
    try {
      await requireAnyPermission(c.get('currentUser'), [
        'canPositionKeywords',
        'canAllowanceRates',
        'canAllowanceMatrix',
      ])
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    const activeOnly = c.req.query('activeOnly') === '1'
    return c.json(await listPositionKeywords({ activeOnly }))
  })
  .post('/', zValidator('json', PositionKeywordUpsertSchema), async (c) => {
    try {
      await requirePermission(c.get('currentUser'), 'canPositionKeywords')
      return c.json(await createPositionKeyword(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', IdParam),
    zValidator('json', PositionKeywordUpdateSchema),
    async (c) => {
      try {
        await requirePermission(c.get('currentUser'), 'canPositionKeywords')
        return c.json(
          await updatePositionKeyword(
            c.req.valid('param').id,
            c.req.valid('json'),
          ),
        )
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete('/:id', zValidator('param', IdParam), async (c) => {
    try {
      await requirePermission(c.get('currentUser'), 'canPositionKeywords')
      await deletePositionKeyword(c.req.valid('param').id)
      return c.json({ ok: true })
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })

export { positionKeywords }
