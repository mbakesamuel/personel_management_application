import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  OfficialMemoCreateSchema,
  OfficialMemoSignatoryListQuerySchema,
  OfficialMemoSignatoryUpsertSchema,
  OfficialMemoUpdateSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import {
  createOfficialMemo,
  createOfficialMemoSignatory,
  deleteOfficialMemo,
  deleteOfficialMemoSignatory,
  listOfficialMemoSignatories,
  listOfficialMemos,
  OfficialMemoNotFoundError,
  OfficialMemoValidationError,
  updateOfficialMemo,
  updateOfficialMemoSignatory,
} from '../services/official-memo.service.js'

function mapError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof OfficialMemoNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof OfficialMemoValidationError) {
    return { status: 400 as const, message: err.message }
  }
  return null
}

const officialMemos = new Hono<{ Variables: AppVariables }>()
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
  .get('/', async (c) => c.json(await listOfficialMemos()))
  .post('/', zValidator('json', OfficialMemoCreateSchema), async (c) => {
    try {
      return c.json(await createOfficialMemo(c.req.valid('json')), 201)
    } catch (err) {
      const mapped = mapError(err)
      if (mapped) return c.json({ error: mapped.message }, mapped.status)
      throw err
    }
  })
  .get(
    '/signatories',
    zValidator('query', OfficialMemoSignatoryListQuerySchema),
    async (c) => c.json(await listOfficialMemoSignatories(c.req.valid('query'))),
  )
  .post(
    '/signatories',
    zValidator('json', OfficialMemoSignatoryUpsertSchema),
    async (c) => {
      try {
        return c.json(await createOfficialMemoSignatory(c.req.valid('json')), 201)
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .put(
    '/signatories/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', OfficialMemoSignatoryUpsertSchema),
    async (c) => {
      try {
        return c.json(
          await updateOfficialMemoSignatory(
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
  .delete(
    '/signatories/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      try {
        await deleteOfficialMemoSignatory(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', OfficialMemoUpdateSchema),
    async (c) => {
      try {
        return c.json(
          await updateOfficialMemo(c.req.valid('param').id, c.req.valid('json')),
        )
      } catch (err) {
        const mapped = mapError(err)
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
        await deleteOfficialMemo(c.req.valid('param').id)
        return c.json({ ok: true })
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )

export { officialMemos }
