import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  DecisionAssignmentListQuerySchema,
  DecisionAssignmentUpsertSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createDecisionAssignment,
  DecisionNotFoundError,
  DecisionValidationError,
  deleteDecisionAssignment,
  listDecisionAssignments,
  listDecisionLevels,
  updateDecisionAssignment,
} from '../services/decision.service.js'

function mapDecisionError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof DecisionNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof DecisionValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

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
  .get(
    '/assignments',
    zValidator('query', DecisionAssignmentListQuerySchema),
    async (c) => c.json(await listDecisionAssignments(c.req.valid('query'))),
  )
  .post(
    '/assignments',
    zValidator('json', DecisionAssignmentUpsertSchema),
    async (c) => {
      try {
        return c.json(await createDecisionAssignment(c.req.valid('json')), 201)
      } catch (err) {
        const mapped = mapDecisionError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .put(
    '/assignments/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', DecisionAssignmentUpsertSchema),
    async (c) => {
      try {
        return c.json(
          await updateDecisionAssignment(
            c.req.valid('param').id,
            c.req.valid('json'),
          ),
        )
      } catch (err) {
        const mapped = mapDecisionError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/assignments/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      try {
        await deleteDecisionAssignment(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapDecisionError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { decisionLevels }
