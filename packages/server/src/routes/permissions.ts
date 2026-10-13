import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  PermissionRequestCreateSchema,
  PermissionRequestUpdateSchema,
  PermissionSpanQuerySchema,
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
import { unitMatchIds } from '../services/live-employee.service.js'
import { formatSpanDate, resolvePermissionSpan } from '../services/permission-memo.js'
import { resolvePermissionDuration } from '../services/leave.service.js'
import { permissionService } from '../services/permission.service.js'
import {
  parseDate,
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

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
}

function imageContentType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

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

export const permissions = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      const user = c.get('currentUser')
      const path = new URL(c.req.url).pathname.replace(/\/+$/, '')
      const accountRead =
        c.req.method === 'GET' && (path === '/permissions/account' || path.endsWith('/account'))
      if (accountRead) {
        if (
          !user.permissions.canPermissionRequests &&
          !user.permissions.canLeaveRequests
        ) {
          throw new ForbiddenError('You do not have permission for this action')
        }
      } else {
        await requirePermission(user, 'canPermissionRequests')
      }
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/account', zValidator('query', MatriculeQuery), async (c) =>
    handle(c, async () => {
      const { matricule } = c.req.valid('query')
      if (!matricule) return { matricule: '', balanceDays: 0 }
      await assertEmployeeInScope(c.get('currentUser'), matricule)
      return permissionService.balance(matricule)
    }),
  )
  .get('/ledger', zValidator('query', MatriculeQuery), async (c) =>
    handle(c, async () => {
      const { matricule } = c.req.valid('query')
      if (!matricule) return []
      await assertEmployeeInScope(c.get('currentUser'), matricule)
      return permissionService.ledger(matricule)
    }),
  )
  .get('/span', zValidator('query', PermissionSpanQuerySchema), async (c) =>
    handle(c, async () => {
      const query = c.req.valid('query')
      await assertEmployeeInScope(c.get('currentUser'), query.matricule)
      const startDate = parseDate(query.startDate, 'startDate')
      const span =
        query.days == null
          ? null
          : await resolvePermissionSpan({
              matricule: query.matricule,
              days: query.days,
              startDate,
            })
      const rule =
        query.leaveTypeId == null
          ? null
          : await resolvePermissionDuration(query.leaveTypeId, startDate)
      return {
        endDate: span ? formatSpanDate(span.endDate) : null,
        resumeDate: span ? formatSpanDate(span.resumeDate) : null,
        eligibleDays: rule?.days ?? null,
      }
    }),
  )
  .get('/requests', zValidator('query', MatriculeQuery), async (c) =>
    handle(c, async () => {
      const { matricule } = c.req.valid('query')
      const user = c.get('currentUser')
      if (matricule) {
        await assertEmployeeInScope(user, matricule)
        return permissionService.list({ matricule })
      }
      return permissionService.list({
        matricules: await matriculesInScope(user),
      })
    }),
  )
  .get('/requests/:id/memo', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      const id = c.req.valid('param').id
      const existing = await permissionService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      return permissionService.memo(id)
    }),
  )
  .post('/requests', zValidator('json', PermissionRequestCreateSchema), async (c) =>
    handle(c, async () => {
      const data = c.req.valid('json')
      await assertEmployeeInScope(c.get('currentUser'), data.matricule)
      return permissionService.create(actorId(c), data)
    }, 201),
  )
  .patch(
    '/requests/:id',
    zValidator('param', IdParam),
    zValidator('json', PermissionRequestUpdateSchema),
    async (c) =>
      handle(c, async () => {
        const id = c.req.valid('param').id
        const existing = await permissionService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        return permissionService.update(actorId(c), id, c.req.valid('json'))
      }),
  )
  .post('/requests/:id/validate', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canLeaveValidate')
      const id = c.req.valid('param').id
      const existing = await permissionService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.json().catch(() => ({}))
      return permissionService.validate(
        actorId(c),
        id,
        WorkflowReviewSchema.parse(body),
      )
    }),
  )
  .post('/requests/:id/reject', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      await requirePermission(c.get('currentUser'), 'canLeaveValidate')
      const id = c.req.valid('param').id
      const existing = await permissionService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.json().catch(() => ({}))
      return permissionService.reject(
        actorId(c),
        id,
        WorkflowReviewSchema.parse(body),
      )
    }),
  )
  .post('/requests/:id/attachments', zValidator('param', IdParam), async (c) =>
    handle(c, async () => {
      const id = c.req.valid('param').id
      const existing = await permissionService.get(id)
      await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
      const body = await c.req.parseBody()
      const file = body.file
      if (!(file instanceof File)) {
        throw new PersonnelWorkflowError('Choose a file to attach', 400)
      }
      const rawRequirement = body.requirementId
      const requirementId =
        typeof rawRequirement === 'string' && rawRequirement.trim()
          ? Number(rawRequirement)
          : null
      if (requirementId != null && !Number.isInteger(requirementId)) {
        throw new PersonnelWorkflowError('Choose a required document', 400)
      }
      return permissionService.addAttachment(actorId(c), id, file, requirementId)
    }, 201),
  )
  .get(
    '/requests/:id/attachments/:attachmentId',
    zValidator('param', AttachmentParam),
    async (c) => {
      try {
        const { id, attachmentId } = c.req.valid('param')
        const existing = await permissionService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        const file = await permissionService.readAttachment(id, attachmentId)
        const type = imageContentType(file.originalName)
        return new Response(Uint8Array.from(file.bytes), {
          status: 200,
          headers: {
            'Content-Type': type,
            'Content-Disposition': `${type.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
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
        const existing = await permissionService.get(id)
        await assertEmployeeInScope(c.get('currentUser'), existing.matricule)
        return permissionService.removeAttachment(id, attachmentId)
      }),
  )

export type PermissionsType = typeof permissions
