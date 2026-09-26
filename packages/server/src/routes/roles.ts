import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { RoleCreateSchema, RoleUpdateSchema } from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createRole,
  listRoles,
  RoleConflictError,
  RoleNotFoundError,
  RoleValidationError,
  updateRole,
} from '../services/roles.service.js'

const roles = new Hono<{ Variables: AppVariables }>()
  .get('/', async (c) => {
    const user = c.get('currentUser')
    if (!user.permissions.canRoles && !user.permissions.canUsers) {
      return c.json({ error: 'You do not have permission for this action' }, 403)
    }
    return c.json(await listRoles())
  })
  .post('/', zValidator('json', RoleCreateSchema), async (c) => {
    try {
      await requirePermission(c.get('currentUser'), 'canRoles')
      const role = await createRole(c.req.valid('json'))
      return c.json(role, 201)
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      if (err instanceof RoleConflictError) {
        return c.json({ error: err.message }, 409)
      }
      if (err instanceof RoleValidationError) {
        return c.json({ error: err.message }, 400)
      }
      throw err
    }
  })
  .put(
    '/:code',
    zValidator('param', z.object({ code: z.string().min(1) })),
    zValidator('json', RoleUpdateSchema),
    async (c) => {
      try {
        await requirePermission(c.get('currentUser'), 'canRoles')
        const role = await updateRole(
          c.req.valid('param').code,
          c.req.valid('json'),
        )
        return c.json(role)
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        if (err instanceof RoleNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        if (err instanceof RoleValidationError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    },
  )

export { roles }
