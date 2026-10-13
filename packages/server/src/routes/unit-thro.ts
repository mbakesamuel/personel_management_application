import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  UnitThroListQuerySchema,
  UnitThroUpsertSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createUnitThroAssignment,
  deleteUnitThroAssignment,
  listUnitThroAssignments,
  UnitThroNotFoundError,
  UnitThroValidationError,
  updateUnitThroAssignment,
} from '../services/unit-thro.service.js'

function mapUnitThroError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof UnitThroNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof UnitThroValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const unitThro = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canThroughOfficers')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', zValidator('query', UnitThroListQuerySchema), async (c) => {
    try {
      return c.json(await listUnitThroAssignments(c.req.valid('query')))
    } catch (err) {
      const mapped = mapUnitThroError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .post('/', zValidator('json', UnitThroUpsertSchema), async (c) => {
    try {
      return c.json(await createUnitThroAssignment(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapUnitThroError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', UnitThroUpsertSchema),
    async (c) => {
      try {
        return c.json(
          await updateUnitThroAssignment(
            c.req.valid('param').id,
            c.req.valid('json'),
          ),
        )
      } catch (err) {
        const mapped = mapUnitThroError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      try {
        await deleteUnitThroAssignment(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapUnitThroError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { unitThro }
