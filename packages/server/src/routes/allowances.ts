import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  AllowanceAllocationUpdateSchema,
  AllowanceAllocationUpsertSchema,
  AllowanceAllocationBatchSchema,
  AllowanceAllocationEligibilityQuerySchema,
  AllowanceRateUpsertSchema,
  AllowanceTypeUpsertSchema,
  AllowanceUpsertSchema,
  WorkflowReviewSchema,
  isAdmin,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requireAnyPermission,
  requirePermission,
} from '../services/authz.service.js'
import {
  allowanceAllocationService,
  allowanceRateService,
  allowanceService,
  allowanceTypeService,
  searchAllowanceEmployees,
} from '../services/allowances.service.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from '../services/personnel-workflow.js'

function mapError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
  if (err instanceof PersonnelNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof PersonnelConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof PersonnelWorkflowError) {
    return { status: err.status, message: err.message }
  }
  return null
}

async function handle<T>(
  c: { json: (body: unknown, status?: number) => Response },
  fn: () => Promise<T>,
  successStatus: number = 200,
) {
  try {
    const result = await fn()
    return c.json(result as never, successStatus as never)
  } catch (err) {
    const mapped = mapError(err)
    if (mapped) return c.json({ error: mapped.message }, mapped.status)
    throw err
  }
}

function actorId(c: { get: (key: 'currentUser') => { id: number } }) {
  return c.get('currentUser').id
}

function actorBypassValidation(c: {
  get: (key: 'currentUser') => { role: string }
}) {
  return isAdmin(c.get('currentUser').role)
}

const StringIdParam = z.object({ id: z.string().min(1) })
const NumberIdParam = z.object({
  id: z.coerce.number().int().positive(),
})
const EmployeesQuery = z.object({
  q: z.string().optional(),
})
const RatesQuery = z.object({
  allowanceId: z.string().optional(),
})
const AllocationsQuery = z.object({
  allowanceId: z.string().optional(),
})

const allowances = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canAllowances')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/employees', zValidator('query', EmployeesQuery), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
      return searchAllowanceEmployees(c.req.valid('query').q)
    }),
  )
  .get('/types', async (c) =>
    handle(c, async () => {
      await requireAnyPermission(c.get('currentUser'), [
        'canAllowanceTypes',
        'canAllowanceCatalog',
      ])
      return allowanceTypeService.list()
    }),
  )
  .post('/types', zValidator('json', AllowanceTypeUpsertSchema), async (c) =>
    handle(
      c,
      async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceTypes')
        return allowanceTypeService.create(
          actorId(c),
          c.req.valid('json'),
          actorBypassValidation(c),
        )
      },
      201,
    ),
  )
  .put(
    '/types/:id',
    zValidator('param', StringIdParam),
    zValidator('json', AllowanceTypeUpsertSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceTypes')
        return allowanceTypeService.update(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .delete('/types/:id', zValidator('param', StringIdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceTypes')
      await allowanceTypeService.remove(c.req.valid('param').id)
      return { ok: true }
    }),
  )
  .post(
    '/types/:id/validate',
    zValidator('param', StringIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceTypes')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceTypeService.validate(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .post(
    '/types/:id/reject',
    zValidator('param', StringIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceTypes')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceTypeService.reject(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .get('/rates', zValidator('query', RatesQuery), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceRates')
      return allowanceRateService.list(c.req.valid('query').allowanceId)
    }),
  )
  .post('/rates', zValidator('json', AllowanceRateUpsertSchema), async (c) =>
    handle(
      c,
      async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceRates')
        return allowanceRateService.create(
          actorId(c),
          c.req.valid('json'),
          actorBypassValidation(c),
        )
      },
      201,
    ),
  )
  .put(
    '/rates/:id',
    zValidator('param', NumberIdParam),
    zValidator('json', AllowanceRateUpsertSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceRates')
        return allowanceRateService.update(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .delete('/rates/:id', zValidator('param', NumberIdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceRates')
      await allowanceRateService.remove(c.req.valid('param').id)
      return { ok: true }
    }),
  )
  .post(
    '/rates/:id/validate',
    zValidator('param', NumberIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceRates')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceRateService.validate(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .post(
    '/rates/:id/reject',
    zValidator('param', NumberIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceRates')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceRateService.reject(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .get('/allocations', zValidator('query', AllocationsQuery), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
      return allowanceAllocationService.list(c.req.valid('query').allowanceId)
    }),
  )
  .get(
    '/allocations/eligibility',
    zValidator('query', AllowanceAllocationEligibilityQuerySchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
        return allowanceAllocationService.eligibility(
          c.req.valid('query').matricule,
        )
      }),
  )
  .post(
    '/allocations',
    zValidator('json', AllowanceAllocationUpsertSchema),
    async (c) =>
      handle(
        c,
        async () => {
          await requirePermission(
            c.get('currentUser'),
            'canAllowanceAllocations',
          )
          return allowanceAllocationService.create(
            actorId(c),
            c.req.valid('json'),
            actorBypassValidation(c),
          )
        },
        201,
      ),
  )
  .post(
    '/allocations/batch',
    zValidator('json', AllowanceAllocationBatchSchema),
    async (c) =>
      handle(
        c,
        async () => {
          await requirePermission(
            c.get('currentUser'),
            'canAllowanceAllocations',
          )
          return allowanceAllocationService.createBatch(
            actorId(c),
            c.req.valid('json'),
            actorBypassValidation(c),
          )
        },
        201,
      ),
  )
  .put(
    '/allocations/:id',
    zValidator('param', NumberIdParam),
    zValidator('json', AllowanceAllocationUpdateSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
        return allowanceAllocationService.update(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .delete('/allocations/:id', zValidator('param', NumberIdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
      await allowanceAllocationService.remove(c.req.valid('param').id)
      return { ok: true }
    }),
  )
  .post(
    '/allocations/:id/validate',
    zValidator('param', NumberIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceAllocationService.validate(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .post(
    '/allocations/:id/reject',
    zValidator('param', NumberIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceAllocations')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceAllocationService.reject(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .get('/', async (c) =>
    handle(c, async () => {
      await requireAnyPermission(c.get('currentUser'), [
        'canAllowanceCatalog',
        'canAllowanceRates',
        'canAllowanceAllocations',
        'canAllowanceMatrix',
      ])
      return allowanceService.list()
    }),
  )
  .post('/', zValidator('json', AllowanceUpsertSchema), async (c) =>
    handle(
      c,
      async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceCatalog')
        return allowanceService.create(
          actorId(c),
          c.req.valid('json'),
          actorBypassValidation(c),
        )
      },
      201,
    ),
  )
  .put(
    '/:id',
    zValidator('param', StringIdParam),
    zValidator('json', AllowanceUpsertSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceCatalog')
        return allowanceService.update(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .delete('/:id', zValidator('param', StringIdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canAllowanceCatalog')
      await allowanceService.remove(c.req.valid('param').id)
      return { ok: true }
    }),
  )
  .post(
    '/:id/validate',
    zValidator('param', StringIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceCatalog')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceService.validate(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )
  .post(
    '/:id/reject',
    zValidator('param', StringIdParam),
    zValidator('json', WorkflowReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canAllowanceCatalog')
        await requirePermission(c.get('currentUser'), 'canValidate')
        return allowanceService.reject(
          actorId(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        )
      }),
  )

export { allowances }
