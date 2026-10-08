import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  LeaveEntitlementCreateSchema,
  LeaveEntitlementUpdateSchema,
  LeaveLetterSettingSchema,
  LeaveProcessSchema,
  LeaveMonthlyRateCreateSchema,
  LeaveMonthlyRateUpdateSchema,
  LeavePolicyCreateSchema,
  LeavePolicyUpdateSchema,
  LeaveRequestCreateSchema,
  LeaveRequestUpdateSchema,
  LeaveResumptionCreateSchema,
  LeaveSeniorityCreateSchema,
  LeaveSeniorityUpdateSchema,
  LeaveTravelAllowanceCreateSchema,
  LeaveTravelAllowanceUpdateSchema,
  PublicHolidayCreateSchema,
  PublicHolidayUpdateSchema,
  LeaveTypeCreateSchema,
  LeaveTypeUpdateSchema,
  WorkflowReviewSchema,
} from '@personel-management-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import { prisma } from '../db.js'
import {
  assertEmployeeInScope,
  ForbiddenError,
  requirePermission,
  unitIdsForUser,
} from '../services/authz.service.js'
import { leaveRequestService, leaveSetupService } from '../services/leave.service.js'
import { unitMatchIds } from '../services/live-employee.service.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from '../services/personnel-workflow.js'

const IdParam = z.object({ id: z.coerce.number().int().positive() })
const AttachmentParam = z.object({
  id: z.coerce.number().int().positive(),
  attachmentId: z.coerce.number().int().positive(),
})
const MatriculeQuery = z.object({
  matricule: z.string().min(1).optional(),
})

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
  if (err instanceof z.ZodError) {
    return {
      status: 400 as const,
      message: err.issues[0]?.message ?? 'Invalid request',
    }
  }
  return null
}

async function handle<T>(
  c: { json: (body: unknown, status?: number) => Response },
  fn: () => Promise<T>,
  successStatus = 200,
) {
  try {
    return c.json((await fn()) as never, successStatus as never)
  } catch (err) {
    const mapped = mapError(err)
    if (mapped) return c.json({ error: mapped.message }, mapped.status)
    throw err
  }
}

function actorId(c: { get: (key: 'currentUser') => { id: number } }) {
  return c.get('currentUser').id
}

async function matriculesInScope(user: AppVariables['currentUser']) {
  const allowed = await unitIdsForUser(user)
  if (allowed === null) return null
  if (allowed.length === 0) return []
  const rows = await prisma.tbl_employee.findMany({
    where: {
      active: true,
      workflowStatus: 'VALIDATED',
      currentUnitId: { in: unitMatchIds(allowed) },
    },
    select: { matricule: true },
  })
  return rows.map((row) => row.matricule)
}

function setupRoutes<TCreate, TUpdate>(opts: {
  list: () => Promise<unknown>
  create: (data: TCreate) => Promise<unknown>
  update: (id: number, data: TUpdate) => Promise<unknown>
  createSchema: z.ZodType<TCreate>
  updateSchema: z.ZodType<TUpdate>
}) {
  return new Hono<{ Variables: AppVariables }>()
    .get('/', async (c) => handle(c, () => opts.list()))
    .post('/', zValidator('json', opts.createSchema), async (c) =>
      handle(c, () => opts.create(c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      zValidator('param', IdParam),
      zValidator('json', opts.updateSchema),
      async (c) =>
        handle(c, () =>
          opts.update(c.req.valid('param').id, c.req.valid('json')),
        ),
    )
}

export const leave = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canLeave')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .route(
    '/types',
    setupRoutes({
      list: () => leaveSetupService.types.list(),
      create: (data) => leaveSetupService.types.create(data),
      update: (id, data) => leaveSetupService.types.update(id, data),
      createSchema: LeaveTypeCreateSchema,
      updateSchema: LeaveTypeUpdateSchema,
    }),
  )
  .route(
    '/policies',
    setupRoutes({
      list: () => leaveSetupService.policies.list(),
      create: (data) => leaveSetupService.policies.create(data),
      update: (id, data) => leaveSetupService.policies.update(id, data),
      createSchema: LeavePolicyCreateSchema,
      updateSchema: LeavePolicyUpdateSchema,
    }),
  )
  .route(
    '/entitlement-rules',
    setupRoutes({
      list: () => leaveSetupService.entitlements.list(),
      create: (data) => leaveSetupService.entitlements.create(data),
      update: (id, data) => leaveSetupService.entitlements.update(id, data),
      createSchema: LeaveEntitlementCreateSchema,
      updateSchema: LeaveEntitlementUpdateSchema,
    }),
  )
  .route(
    '/monthly-rate-rules',
    setupRoutes({
      list: () => leaveSetupService.monthlyRates.list(),
      create: (data) => leaveSetupService.monthlyRates.create(data),
      update: (id, data) => leaveSetupService.monthlyRates.update(id, data),
      createSchema: LeaveMonthlyRateCreateSchema,
      updateSchema: LeaveMonthlyRateUpdateSchema,
    }),
  )
  .route(
    '/seniority-rules',
    setupRoutes({
      list: () => leaveSetupService.seniority.list(),
      create: (data) => leaveSetupService.seniority.create(data),
      update: (id, data) => leaveSetupService.seniority.update(id, data),
      createSchema: LeaveSeniorityCreateSchema,
      updateSchema: LeaveSeniorityUpdateSchema,
    }),
  )
  .route(
    '/travel-allowances',
    setupRoutes({
      list: () => leaveSetupService.travelAllowances.list(),
      create: (data) => leaveSetupService.travelAllowances.create(data),
      update: (id, data) => leaveSetupService.travelAllowances.update(id, data),
      createSchema: LeaveTravelAllowanceCreateSchema,
      updateSchema: LeaveTravelAllowanceUpdateSchema,
    }),
  )
  .route(
    '/holidays',
    new Hono<{ Variables: AppVariables }>()
      .get('/', async (c) => handle(c, () => leaveSetupService.holidays.list()))
      .post('/', zValidator('json', PublicHolidayCreateSchema), async (c) =>
        handle(c, () => leaveSetupService.holidays.create(c.req.valid('json')), 201),
      )
      .patch(
        '/:id',
        zValidator('param', IdParam),
        zValidator('json', PublicHolidayUpdateSchema),
        async (c) =>
          handle(c, () =>
            leaveSetupService.holidays.update(
              c.req.valid('param').id,
              c.req.valid('json'),
            ),
          ),
      )
      .delete('/:id', zValidator('param', IdParam), async (c) =>
        handle(c, () =>
          leaveSetupService.holidays.remove(c.req.valid('param').id),
        ),
      ),
  )
  .get('/letter-settings', async (c) =>
    handle(c, () => leaveSetupService.letterSettings.get()),
  )
  .put(
    '/letter-settings',
    zValidator('json', LeaveLetterSettingSchema),
    async (c) =>
      handle(c, () =>
        leaveSetupService.letterSettings.update(c.req.valid('json')),
      ),
  )
  .get('/history', zValidator('query', MatriculeQuery), async (c) =>
    handle(c, async () => {
      const { matricule } = c.req.valid('query')
      if (!matricule) return []
      await assertEmployeeInScope(c.get('currentUser'), matricule)
      return leaveRequestService.history(matricule)
    }),
  )
  .get('/requests', zValidator('query', MatriculeQuery), async (c) =>
    handle(c, async () => {
      const { matricule } = c.req.valid('query')
      const user = c.get('currentUser')
      if (matricule) {
        await assertEmployeeInScope(user, matricule)
        return leaveRequestService.list({ matricule })
      }
      return leaveRequestService.list({
        matricules: await matriculesInScope(user),
      })
    }),
  )
  .post('/requests', zValidator('json', LeaveRequestCreateSchema), async (c) =>
    handle(c, async () => {
      const data = c.req.valid('json')
      await assertEmployeeInScope(c.get('currentUser'), data.matricule)
      return leaveRequestService.create(actorId(c), data)
    }, 201),
  )
  .patch(
    '/requests/:id',
    zValidator('param', IdParam),
    zValidator('json', LeaveRequestUpdateSchema),
    async (c) =>
      handle(c, async () => {
        const id = c.req.valid('param').id
        const existing = await leaveRequestService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        return leaveRequestService.update(actorId(c), id, c.req.valid('json'))
      }),
  )
  .post('/requests/:id/calculate', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      const id = c.req.valid('param').id
      const existing = await leaveRequestService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      return leaveRequestService.calculate(id)
    }),
  )
  .post('/requests/:id/validate', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canValidate')
      const id = c.req.valid('param').id
      const existing = await leaveRequestService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.json().catch(() => ({}))
      return leaveRequestService.validate(
        actorId(c),
        id,
        LeaveProcessSchema.parse(body),
      )
    }),
  )
  .get('/requests/:id/memo', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      const id = c.req.valid('param').id
      const existing = await leaveRequestService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      return leaveRequestService.memo(id)
    }),
  )
  .post('/requests/:id/reject', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canValidate')
      const id = c.req.valid('param').id
      const existing = await leaveRequestService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.json().catch(() => ({}))
      return leaveRequestService.reject(
        actorId(c),
        id,
        WorkflowReviewSchema.parse(body),
      )
    }),
  )
  .post(
    '/requests/:id/resumption',
    zValidator('param', IdParam),
    zValidator('json', LeaveResumptionCreateSchema),
    async (c) =>
      handle(c, async () => {
        const id = c.req.valid('param').id
        const existing = await leaveRequestService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        return leaveRequestService.resume(
          actorId(c),
          id,
          c.req.valid('json'),
        )
      }, 201),
  )
  .post('/requests/:id/attachments', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      const id = c.req.valid('param').id
      const existing = await leaveRequestService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.parseBody()
      const file = body.file
      if (!(file instanceof File)) {
        throw new PersonnelWorkflowError('Choose a file to attach', 400)
      }
      return leaveRequestService.addAttachment(actorId(c), id, file)
    }, 201),
  )
  .get(
    '/requests/:id/attachments/:attachmentId',
    zValidator('param', AttachmentParam),
    async (c) => {
      try {
        const { id, attachmentId } = c.req.valid('param')
        const existing = await leaveRequestService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        const file = await leaveRequestService.readAttachment(id, attachmentId)
        return new Response(file.bytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
          },
        })
      } catch (err) {
        const mapped = mapError(err)
        if (mapped) return c.json({ error: mapped.message }, mapped.status)
        throw err
      }
    },
  )
  .delete(
    '/requests/:id/attachments/:attachmentId',
    zValidator('param', AttachmentParam),
    async (c) =>
      handle(c, async () => {
        const { id, attachmentId } = c.req.valid('param')
        const existing = await leaveRequestService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        return leaveRequestService.removeAttachment(id, attachmentId)
      }),
  )

export type LeaveType = typeof leave
