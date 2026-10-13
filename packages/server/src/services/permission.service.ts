import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma } from '@prisma/client'
import type {
  PermissionRequestCreateInput,
  PermissionRequestUpdateInput,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { buildPermissionMemo, resolvePermissionSpan } from './permission-memo.js'
import { resolvePermissionDuration } from './leave.service.js'
import type { ReviewInput } from './personnel.service.js'
import {
  assertCanEdit,
  assertCanReject,
  assertCanValidate,
  editStamps,
  parseDate,
  pendingCreateStamps,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
  rejectStamps,
  validateStamps,
} from './personnel-workflow.js'

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

const attachmentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/permission-attachments',
)
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const requestInclude = {
  ledger: true,
  leaveType: {
    include: {
      documentRequirements: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
  attachments: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.tbl_permission_requestInclude

type RequestRow = Prisma.tbl_permission_requestGetPayload<{
  include: typeof requestInclude
}>

function mapAttachment(row: RequestRow['attachments'][number]) {
  return {
    id: row.id,
    permissionRequestId: row.permissionRequestId,
    originalName: row.originalName,
    uploadedAt: row.uploadedAt,
    uploadedById: row.uploadedById,
    requirementId: row.requirementId,
  }
}

function mapRequest(row: RequestRow) {
  return {
    id: row.id,
    matricule: row.matricule,
    days: row.days,
    applicationDate: row.applicationDate,
    startDate: row.startDate,
    endDate: row.endDate,
    resumeDate: row.resumeDate,
    reason: row.reason,
    workflowStatus: row.workflowStatus,
    current: row.current,
    createdAt: row.createdAt,
    createdById: row.createdById,
    reviewNote: row.reviewNote,
    leaveTypeId: row.leaveTypeId,
    leaveType: row.leaveType,
    posted: row.ledger != null,
    attachments: row.attachments.map(mapAttachment),
  }
}

function storedPath(fileName: string) {
  const resolved = path.resolve(attachmentDir, fileName)
  if (!resolved.startsWith(path.resolve(attachmentDir) + path.sep)) {
    throw new PersonnelWorkflowError('Invalid attachment path', 400)
  }
  return resolved
}

function safeExt(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return ext.length > 1 && ext.length <= 10 ? ext : ''
}

async function requireEmployee(matricule: string) {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: { matricule: true },
  })
  if (!employee) throw new PersonnelNotFoundError('Employee not found')
}

async function requirePermissionType(
  leaveTypeId: number | null,
  days: number,
  startDate: Date | null,
) {
  if (leaveTypeId == null) return null
  const type = await prisma.tbl_leave_type.findUnique({
    where: { id: leaveTypeId },
  })
  if (!type || !type.active || type.category !== 'PERMISSION' || !type.isPaid) {
    throw new PersonnelWorkflowError('Choose an active paid permission type', 400)
  }
  if (!startDate) {
    throw new PersonnelWorkflowError('This permission has no start date', 400)
  }
  const rule = await resolvePermissionDuration(leaveTypeId, startDate)
  if (!rule) {
    throw new PersonnelWorkflowError(
      'No eligible days are defined for this permission on the start date',
      400,
    )
  }
  if (days > rule.days) {
    throw new PersonnelWorkflowError(
      `This permission allows at most ${rule.days} days from that date`,
      400,
    )
  }
  return type
}

export const permissionService = {
  async balance(matricule: string) {
    const account = await prisma.tbl_permission_account.findUnique({
      where: { matricule },
      select: { balanceDays: true },
    })
    return { matricule, balanceDays: account?.balanceDays ?? 0 }
  },
  async ledger(matricule: string) {
    const rows = await prisma.tbl_permission_ledger.findMany({
      where: { matricule },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows
  },
  async list(query: { matricule?: string; matricules?: string[] | null }) {
    const rows = await prisma.tbl_permission_request.findMany({
      where: {
        ...(query.matricule ? { matricule: query.matricule } : {}),
        ...(query.matricules ? { matricule: { in: query.matricules } } : {}),
      },
      include: requestInclude,
      orderBy: [{ applicationDate: 'desc' }, { id: 'desc' }],
    })
    return rows.map(mapRequest)
  },
  async get(id: number) {
    const row = await prisma.tbl_permission_request.findUnique({
      where: { id },
      include: requestInclude,
    })
    if (!row) throw new PersonnelNotFoundError('Permission request not found')
    return row
  },
  async memo(id: number) {
    const row = await this.get(id)
    return buildPermissionMemo({
      matricule: row.matricule,
      days: row.days,
      applicationDate: row.applicationDate,
      startDate: row.startDate,
      endDate: row.endDate,
      resumeDate: row.resumeDate,
      reason: row.reason,
      leaveTypeCode: row.leaveType?.code ?? null,
      leaveTypeName: row.leaveType?.name ?? null,
    })
  },
  async create(userId: number, input: PermissionRequestCreateInput) {
    await requireEmployee(input.matricule)
    const startDate = parseDate(input.startDate, 'startDate')
    await requirePermissionType(input.leaveTypeId ?? null, input.days, startDate)
    const span = await resolvePermissionSpan({
      matricule: input.matricule,
      days: input.days,
      startDate,
    })
    const row = await prisma.tbl_permission_request.create({
      data: {
        matricule: input.matricule,
        days: input.days,
        applicationDate: parseDate(input.applicationDate, 'applicationDate'),
        startDate,
        endDate: span.endDate,
        resumeDate: span.resumeDate,
        reason: blankToNull(input.reason),
        leaveTypeId: input.leaveTypeId ?? null,
        current: false,
        ...pendingCreateStamps(userId),
      },
      include: requestInclude,
    })
    return mapRequest(row)
  },
  async update(userId: number, id: number, input: PermissionRequestUpdateInput) {
    const existing = await this.get(id)
    await assertCanEdit(userId, existing.workflowStatus)
    const days = input.days ?? existing.days
    const leaveTypeId =
      input.leaveTypeId !== undefined ? input.leaveTypeId : existing.leaveTypeId
    const startDate =
      input.startDate !== undefined
        ? parseDate(input.startDate, 'startDate')
        : existing.startDate
    await requirePermissionType(leaveTypeId, days, startDate)
    const span = await resolvePermissionSpan({
      matricule: existing.matricule,
      days,
      startDate,
    })
    const row = await prisma.tbl_permission_request.update({
      where: { id },
      data: {
        ...(input.days !== undefined ? { days: input.days } : {}),
        ...(input.applicationDate !== undefined
          ? {
              applicationDate: parseDate(
                input.applicationDate,
                'applicationDate',
              ),
            }
          : {}),
        startDate,
        endDate: span.endDate,
        resumeDate: span.resumeDate,
        ...(input.reason !== undefined
          ? { reason: blankToNull(input.reason) }
          : {}),
        ...(input.leaveTypeId !== undefined
          ? { leaveTypeId: input.leaveTypeId }
          : {}),
        ...editStamps(userId, existing.workflowStatus),
      },
      include: requestInclude,
    })
    return mapRequest(row)
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const existing = await this.get(id)
    await assertCanValidate(existing, userId)
    const type = await requirePermissionType(
      existing.leaveTypeId,
      existing.days,
      existing.startDate,
    )
    if (type) {
      const requirements = existing.leaveType?.documentRequirements ?? []
      const missing = requirements.filter(
        (requirement) =>
          !existing.attachments.some(
            (file) => file.requirementId === requirement.id,
          ),
      )
      if (missing.length > 0) {
        throw new PersonnelWorkflowError(
          `Attach the required documents: ${missing.map((requirement) => requirement.name).join(', ')}`,
          409,
        )
      }
      if (
        type.requireAttachment &&
        requirements.length === 0 &&
        existing.attachments.length === 0
      ) {
        throw new PersonnelWorkflowError('Attach a supporting document', 409)
      }
    }
    const deduct = !type || type.deductBalance
    await prisma.$transaction(async (tx) => {
      await tx.tbl_permission_request.update({
        where: { id },
        data: { ...validateStamps(userId, review?.reviewNote), current: true },
      })
      if (!deduct) return
      await tx.tbl_permission_account.upsert({
        where: { matricule: existing.matricule },
        create: {
          matricule: existing.matricule,
          balanceDays: existing.days,
        },
        update: { balanceDays: { increment: existing.days } },
      })
      await tx.tbl_permission_ledger.create({
        data: {
          matricule: existing.matricule,
          days: existing.days,
          kind: 'CREDIT',
          permissionRequestId: id,
          note: 'Permission validated',
          createdById: userId,
        },
      })
    })
    return this.get(id).then(mapRequest)
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const existing = await this.get(id)
    assertCanReject(existing.workflowStatus)
    const row = await prisma.tbl_permission_request.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      include: requestInclude,
    })
    return mapRequest(row)
  },
  async addAttachment(
    userId: number,
    requestId: number,
    file: File,
    requirementId: number | null,
  ) {
    const request = await prisma.tbl_permission_request.findUnique({
      where: { id: requestId },
      select: { workflowStatus: true, leaveTypeId: true },
    })
    if (!request) throw new PersonnelNotFoundError('Permission request not found')
    if (requirementId != null) {
      if (request.leaveTypeId == null) {
        throw new PersonnelWorkflowError(
          'That document is not required for this permission',
          400,
        )
      }
      const requirement = await prisma.tbl_leave_document_requirement.findFirst({
        where: { id: requirementId, leaveTypeId: request.leaveTypeId },
        select: { id: true },
      })
      if (!requirement) {
        throw new PersonnelWorkflowError(
          'That document is not required for this permission',
          400,
        )
      }
    }
    if (
      request.workflowStatus !== 'PENDING' &&
      request.workflowStatus !== 'REJECTED'
    ) {
      throw new PersonnelWorkflowError(
        'Documents can be changed only while the request is pending or rejected',
        409,
      )
    }
    if (!file || file.size <= 0) {
      throw new PersonnelWorkflowError('Choose a file to attach', 400)
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new PersonnelWorkflowError('File must be 8 MB or smaller', 400)
    }
    const originalName = path.basename(file.name || 'document').slice(0, 180)
    const fileName = `${randomBytes(16).toString('hex')}${safeExt(originalName)}`
    await mkdir(attachmentDir, { recursive: true })
    await writeFile(storedPath(fileName), Buffer.from(await file.arrayBuffer()))
    try {
      const row = await prisma.tbl_permission_attachment.create({
        data: {
          permissionRequestId: requestId,
          fileName,
          originalName: originalName || 'document',
          filePath: fileName,
          uploadedById: userId,
          requirementId,
        },
      })
      return mapAttachment(row)
    } catch (error) {
      await unlink(storedPath(fileName)).catch(() => undefined)
      throw error
    }
  },
  async readAttachment(requestId: number, attachmentId: number) {
    const row = await prisma.tbl_permission_attachment.findFirst({
      where: { id: attachmentId, permissionRequestId: requestId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    const bytes = await readFile(storedPath(row.filePath)).catch(() => null)
    if (!bytes) throw new PersonnelNotFoundError('Document file is missing')
    return { originalName: row.originalName, bytes }
  },
  async removeAttachment(requestId: number, attachmentId: number) {
    const request = await prisma.tbl_permission_request.findUnique({
      where: { id: requestId },
      select: { workflowStatus: true },
    })
    if (!request) throw new PersonnelNotFoundError('Permission request not found')
    if (
      request.workflowStatus !== 'PENDING' &&
      request.workflowStatus !== 'REJECTED'
    ) {
      throw new PersonnelWorkflowError(
        'Documents can be changed only while the request is pending or rejected',
        409,
      )
    }
    const row = await prisma.tbl_permission_attachment.findFirst({
      where: { id: attachmentId, permissionRequestId: requestId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    await prisma.tbl_permission_attachment.delete({ where: { id: attachmentId } })
    await unlink(storedPath(row.filePath)).catch(() => undefined)
    return { id: attachmentId }
  },
}
