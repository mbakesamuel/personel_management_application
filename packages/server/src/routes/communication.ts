import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  CommunicationAmountCreateSchema,
  CommunicationBatchCreateSchema,
  CommunicationOperatorUpsertSchema,
  OperatorAccountUpsertSchema,
  CommunicationRegistrationCreateSchema,
  CommunicationRegistrationRemoveSchema,
  CommunicationRegistrationTransferSchema,
  FleetImportBatchSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'
import { searchAllowanceEmployees } from '../services/allowances.service.js'
import { communicationService } from '../services/communication.service.js'
import { importFleetBatch } from '../services/fleet-import.service.js'
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

const IdParam = z.object({ id: z.coerce.number().int().positive() })
const EmployeesQuery = z.object({ q: z.string().optional() })
const BatchListQuery = z.object({
  operatorId: z.coerce.number().int().positive().optional(),
})

const communication = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    if (
      c.req.method === 'POST' &&
      c.req.path.endsWith('/fleet/import')
    ) {
      await next()
      return
    }
    try {
      await requirePermission(c.get('currentUser'), 'canCommunicationAllowance')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .post(
    '/fleet/import',
    zValidator('json', FleetImportBatchSchema),
    async (c) => {
      try {
        await requirePermission(
          c.get('currentUser'),
          'canImportFleet',
          'You do not have permission to import fleet registrations',
        )
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }
      return c.json(await importFleetBatch(c.req.valid('json')))
    },
  )
  .get('/operators', async (c) =>
    handle(c, () => communicationService.listOperators()),
  )
  .post(
    '/operators',
    zValidator('json', CommunicationOperatorUpsertSchema),
    async (c) =>
      handle(
        c,
        () => communicationService.createOperator(c.req.valid('json')),
        201,
      ),
  )
  .patch(
    '/operators/:id',
    zValidator('param', IdParam),
    zValidator('json', CommunicationOperatorUpsertSchema),
    async (c) =>
      handle(c, () =>
        communicationService.updateOperator(
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .get('/operator-accounts', async (c) =>
    handle(c, () => communicationService.listOperatorAccounts()),
  )
  .post(
    '/operator-accounts',
    zValidator('json', OperatorAccountUpsertSchema),
    async (c) =>
      handle(
        c,
        () => communicationService.createOperatorAccount(c.req.valid('json')),
        201,
      ),
  )
  .patch(
    '/operator-accounts/:id',
    zValidator('param', IdParam),
    zValidator('json', OperatorAccountUpsertSchema),
    async (c) =>
      handle(c, () =>
        communicationService.updateOperatorAccount(
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .delete('/operator-accounts/:id', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      await communicationService.deleteOperatorAccount(c.req.valid('param').id)
      return { ok: true }
    }),
  )
  .get('/services', async (c) =>
    handle(c, () => communicationService.listServices()),
  )
  .get('/allowances', async (c) =>
    handle(c, () => communicationService.listAllowances()),
  )
  .get('/employees', zValidator('query', EmployeesQuery), async (c) =>
    handle(c, () => searchAllowanceEmployees(c.req.valid('query').q)),
  )
  .get('/registrations', async (c) =>
    handle(c, () => communicationService.listRegistrations()),
  )
  .post(
    '/registrations',
    zValidator('json', CommunicationRegistrationCreateSchema),
    async (c) =>
      handle(
        c,
        () => communicationService.createRegistration(c.req.valid('json')),
        201,
      ),
  )
  .post(
    '/registrations/:id/remove',
    zValidator('param', IdParam),
    zValidator('json', CommunicationRegistrationRemoveSchema),
    async (c) =>
      handle(c, () =>
        communicationService.removeRegistration(
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .post(
    '/registrations/:id/transfer',
    zValidator('param', IdParam),
    zValidator('json', CommunicationRegistrationTransferSchema),
    async (c) =>
      handle(c, () =>
        communicationService.transferRegistration(
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .get('/lines', async (c) => handle(c, () => communicationService.listLines()))
  .get('/amounts', async (c) => handle(c, () => communicationService.listAmounts()))
  .post(
    '/amounts',
    zValidator('json', CommunicationAmountCreateSchema),
    async (c) =>
      handle(
        c,
        () => communicationService.createAmount(c.req.valid('json')),
        201,
      ),
  )
  .get('/batches', zValidator('query', BatchListQuery), async (c) =>
    handle(c, () =>
      communicationService.listBatches(c.req.valid('query').operatorId),
    ),
  )
  .get('/batches/:id', zValidator('param', IdParam), async (c) =>
    handle(c, () => communicationService.getBatch(c.req.valid('param').id)),
  )
  .post(
    '/batches',
    zValidator('json', CommunicationBatchCreateSchema),
    async (c) =>
      handle(
        c,
        () =>
          communicationService.applyBatch(
            c.req.valid('json'),
            c.get('currentUser').id,
          ),
        201,
      ),
  )

export { communication }
