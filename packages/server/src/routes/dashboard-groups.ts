import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  DashboardGroupAssignmentsSchema,
  DashboardGroupCreateSchema,
} from '@personel-management-app/shared'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createDashboardGroup,
  DashboardGroupConflictError,
  DashboardGroupValidationError,
  listDashboardGroups,
  saveDashboardGroupAssignments,
} from '../services/dashboard-groups.service.js'

const dashboardGroups = new Hono<{ Variables: AppVariables }>()
  .get('/', async (c) => {
    try {
      await requirePermission(c.get('currentUser'), 'canRoles')
      return c.json(await listDashboardGroups())
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
  })
  .post('/', zValidator('json', DashboardGroupCreateSchema), async (c) => {
    try {
      await requirePermission(c.get('currentUser'), 'canRoles')
      const group = await createDashboardGroup(c.req.valid('json').label)
      return c.json(group, 201)
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      if (err instanceof DashboardGroupConflictError) {
        return c.json({ error: err.message }, 409)
      }
      if (err instanceof DashboardGroupValidationError) {
        return c.json({ error: err.message }, 400)
      }
      throw err
    }
  })
  .put(
    '/assignments',
    zValidator('json', DashboardGroupAssignmentsSchema),
    async (c) => {
      try {
        await requirePermission(c.get('currentUser'), 'canRoles')
        const groups = await saveDashboardGroupAssignments(
          c.req.valid('json').assignments,
        )
        return c.json(groups)
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        if (err instanceof DashboardGroupValidationError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    },
  )

export { dashboardGroups }
