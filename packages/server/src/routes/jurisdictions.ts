import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  JurisdictionCreateSchema,
  JurisdictionUpdateSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import { ForbiddenError, requirePermission } from '../services/authz.service.js'
import {
  createJurisdiction,
  deleteJurisdiction,
  JurisdictionConflictError,
  JurisdictionNotFoundError,
  JurisdictionValidationError,
  listJurisdictions,
  updateJurisdiction,
} from '../services/jurisdictions.service.js'

function mapError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof JurisdictionNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof JurisdictionConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof JurisdictionValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const jurisdictions = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canRoles')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', async (c) => {
    const activeOnly = c.req.query('activeOnly') === '1'
    return c.json(await listJurisdictions({ activeOnly }))
  })
  .post('/', zValidator('json', JurisdictionCreateSchema), async (c) => {
    try {
      return c.json(await createJurisdiction(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:code',
    zValidator('param', z.object({ code: z.string().min(1) })),
    zValidator('json', JurisdictionUpdateSchema),
    async (c) => {
      try {
        return c.json(
          await updateJurisdiction(
            c.req.valid('param').code,
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
  .delete(
    '/:code',
    zValidator('param', z.object({ code: z.string().min(1) })),
    async (c) => {
      try {
        await deleteJurisdiction(c.req.valid('param').code)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { jurisdictions }
