import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  LetterCcCreateSchema,
  LetterCcHideSchema,
  LetterCcMoveSchema,
  LetterCcUpdateSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  orgScopeForUser,
  requirePermission,
} from '../services/authz.service.js'
import {
  createLetterCc,
  createUnitLetterCcExtra,
  getUnitLetterCcOverlay,
  LetterCcConflictError,
  LetterCcNotFoundError,
  LetterCcValidationError,
  listLetterCc,
  moveLetterCc,
  moveUnitLetterCcExtra,
  setUnitLetterCcHidden,
  updateLetterCc,
  updateUnitLetterCcExtra,
} from '../services/letter-cc.service.js'

function mapLetterCcError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof LetterCcNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof LetterCcConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof LetterCcValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const idParam = z.object({ id: z.coerce.number().int() })
const unitParam = z.object({ unitId: z.string().trim().min(1).max(3) })
const unitExtraParam = unitParam.extend({ id: z.coerce.number().int() })

async function assertUnitInScope(
  user: AppVariables['currentUser'],
  unitId: string,
) {
  const scope = await orgScopeForUser(user)
  if (!scope.unrestricted && !scope.unitIds.includes(unitId)) {
    throw new ForbiddenError('Unit is outside your organizational scope')
  }
}

const letterCc = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canLetterCc')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', async (c) => c.json(await listLetterCc()))
  .post('/', zValidator('json', LetterCcCreateSchema), async (c) => {
    try {
      return c.json(await createLetterCc(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapLetterCcError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .get(
    '/units/:unitId',
    zValidator('param', unitParam),
    async (c) => {
      try {
        const { unitId } = c.req.valid('param')
        await assertUnitInScope(c.get('currentUser'), unitId)
        return c.json(await getUnitLetterCcOverlay(unitId))
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .patch(
    '/units/:unitId/hides',
    zValidator('param', unitParam),
    zValidator('json', LetterCcHideSchema),
    async (c) => {
      try {
        const { unitId } = c.req.valid('param')
        await assertUnitInScope(c.get('currentUser'), unitId)
        return c.json(
          await setUnitLetterCcHidden(unitId, c.req.valid('json')),
        )
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .post(
    '/units/:unitId/extras',
    zValidator('param', unitParam),
    zValidator('json', LetterCcCreateSchema),
    async (c) => {
      try {
        const { unitId } = c.req.valid('param')
        await assertUnitInScope(c.get('currentUser'), unitId)
        return c.json(
          await createUnitLetterCcExtra(unitId, c.req.valid('json')),
          201,
        )
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .patch(
    '/units/:unitId/extras/:id/move',
    zValidator('param', unitExtraParam),
    zValidator('json', LetterCcMoveSchema),
    async (c) => {
      try {
        const { unitId, id } = c.req.valid('param')
        await assertUnitInScope(c.get('currentUser'), unitId)
        return c.json(
          await moveUnitLetterCcExtra(unitId, id, c.req.valid('json')),
        )
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .patch(
    '/units/:unitId/extras/:id',
    zValidator('param', unitExtraParam),
    zValidator('json', LetterCcUpdateSchema),
    async (c) => {
      try {
        const { unitId, id } = c.req.valid('param')
        await assertUnitInScope(c.get('currentUser'), unitId)
        return c.json(
          await updateUnitLetterCcExtra(unitId, id, c.req.valid('json')),
        )
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .patch(
    '/:id/move',
    zValidator('param', idParam),
    zValidator('json', LetterCcMoveSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        return c.json(await moveLetterCc(id, c.req.valid('json')))
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .patch(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', LetterCcUpdateSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        return c.json(await updateLetterCc(id, c.req.valid('json')))
      } catch (err) {
        const mapped = mapLetterCcError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { letterCc }
