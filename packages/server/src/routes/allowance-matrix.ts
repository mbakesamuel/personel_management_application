import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  AllowanceKeywordBulkSchema,
  AllowanceKeywordCreateSchema,
  AllowanceKeywordUpdateSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import { ForbiddenError, requirePermission } from '../services/authz.service.js'
import {
  AllowanceMatrixConflictError,
  AllowanceMatrixNotFoundError,
  AllowanceMatrixValidationError,
  bulkReplaceKeywordLinks,
  createAllowanceKeywordLink,
  deleteAllowanceKeywordLink,
  listAllowanceKeywordLinks,
  updateAllowanceKeywordLink,
} from '../services/allowance-matrix.service.js'

function mapError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof AllowanceMatrixNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof AllowanceMatrixConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof AllowanceMatrixValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const IdParam = z.object({
  id: z.coerce.number().int().positive(),
})

const ListQuery = z.object({
  allowanceId: z.string().optional(),
  keywordId: z.coerce.number().int().positive().optional(),
  activeOnly: z.enum(['0', '1']).optional(),
})

const allowanceMatrix = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canAllowances')
      await requirePermission(c.get('currentUser'), 'canAllowanceMatrix')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', zValidator('query', ListQuery), async (c) => {
    const query = c.req.valid('query')
    return c.json(
      await listAllowanceKeywordLinks({
        allowanceId: query.allowanceId,
        keywordId: query.keywordId,
        activeOnly: query.activeOnly === '1',
      }),
    )
  })
  .put('/bulk', zValidator('json', AllowanceKeywordBulkSchema), async (c) => {
    try {
      return c.json(await bulkReplaceKeywordLinks(c.req.valid('json')))
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .post('/', zValidator('json', AllowanceKeywordCreateSchema), async (c) => {
    try {
      return c.json(await createAllowanceKeywordLink(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', IdParam),
    zValidator('json', AllowanceKeywordUpdateSchema),
    async (c) => {
      try {
        return c.json(
          await updateAllowanceKeywordLink(
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
      await deleteAllowanceKeywordLink(c.req.valid('param').id)
      return c.json({ ok: true })
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })

export { allowanceMatrix }
