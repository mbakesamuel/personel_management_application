import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  SetUserFinancialYearSchema,
  UserUpsertSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  FinancialYearClosedError,
  FinancialYearNotFoundError,
  setUserFinancialYear,
} from '../services/financialyear.service.js'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  UserConflictError,
  UserNotFoundError,
  UserValidationError,
} from '../services/users.service.js'

function mapUserError(err: unknown) {
  if (err instanceof UserNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof UserConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof UserValidationError) {
    return { status: 400 as const, message: err.message }
  }
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  return null
}

const users = new Hono<{ Variables: AppVariables }>()
  .get('/', async (c) => {
    try {
      const current = c.get('currentUser')
      await requirePermission(current, 'canUsers')
      return c.json(await listUsers(current))
    } catch (err) {
      const mapped = mapUserError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .post('/', zValidator('json', UserUpsertSchema), async (c) => {
    try {
      const current = c.get('currentUser')
      await requirePermission(current, 'canUsers')
      const user = await createUser(current, c.req.valid('json'))
      return c.json(user, 201)
    } catch (err) {
      const mapped = mapUserError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', UserUpsertSchema),
    async (c) => {
      try {
        const current = c.get('currentUser')
        await requirePermission(current, 'canUsers')
        const user = await updateUser(
          current,
          c.req.valid('param').id,
          c.req.valid('json'),
        )
        return c.json(user)
      } catch (err) {
        const mapped = mapUserError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      const current = c.get('currentUser')
      const { id } = c.req.valid('param')
      try {
        await requirePermission(current, 'canUsers')
        if (id === current.id) {
          throw new ForbiddenError('You cannot delete your own account')
        }
        await deleteUser(current, id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapUserError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .put(
    '/:id/financial-year',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', SetUserFinancialYearSchema),
    async (c) => {
      const current = c.get('currentUser')
      const { id } = c.req.valid('param')
      const { financialYearId } = c.req.valid('json')

      if (id !== current.id) {
        return c.json(
          { error: 'You can only update your own financial year' },
          403,
        )
      }

      try {
        const result = await setUserFinancialYear(id, financialYearId)
        return c.json(result)
      } catch (err) {
        if (err instanceof FinancialYearNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        if (err instanceof FinancialYearClosedError) {
          return c.json({ error: err.message }, 409)
        }
        throw err
      }
    },
  )

export { users }
