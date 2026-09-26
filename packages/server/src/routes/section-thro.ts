import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  SectionThroBatchSchema,
  SectionThroListQuerySchema,
  SectionThroUpsertSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  batchUpsertSectionThroAssignments,
  createSectionThroAssignment,
  deleteSectionThroAssignment,
  listSectionThroAssignments,
  SectionThroNotFoundError,
  SectionThroValidationError,
  updateSectionThroAssignment,
} from '../services/section-thro.service.js'

function mapSectionThroError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof SectionThroNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof SectionThroValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const sectionThro = new Hono<{ Variables: AppVariables }>()
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
  .get(
    '/',
    zValidator('query', SectionThroListQuerySchema),
    async (c) => {
      try {
        return c.json(await listSectionThroAssignments(c.req.valid('query')))
      } catch (err) {
        const mapped = mapSectionThroError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .post('/', zValidator('json', SectionThroUpsertSchema), async (c) => {
    try {
      return c.json(await createSectionThroAssignment(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapSectionThroError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .post('/batch', zValidator('json', SectionThroBatchSchema), async (c) => {
    try {
      return c.json(await batchUpsertSectionThroAssignments(c.req.valid('json')))
    } catch (err) {
      const mapped = mapSectionThroError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', SectionThroUpsertSchema),
    async (c) => {
      try {
        return c.json(
          await updateSectionThroAssignment(
            c.req.valid('param').id,
            c.req.valid('json'),
          ),
        )
      } catch (err) {
        const mapped = mapSectionThroError(err)
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
        await deleteSectionThroAssignment(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapSectionThroError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { sectionThro }
