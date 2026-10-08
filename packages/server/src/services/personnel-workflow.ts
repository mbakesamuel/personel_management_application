import { canEditWorkflowStatus, isAdmin } from '@personel-management-app/shared'
import type { tbl_personnel_workflow_status } from '@prisma/client'
import { prisma } from '../db.js'
import { getPermissionsForRole } from './roles.service.js'

export class PersonnelWorkflowError extends Error {
  status: 400 | 403 | 409

  constructor(message: string, status: 400 | 403 | 409 = 400) {
    super(message)
    this.name = 'PersonnelWorkflowError'
    this.status = status
  }
}

export class PersonnelNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'PersonnelNotFoundError'
  }
}

export class PersonnelConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PersonnelConflictError'
  }
}

export type WorkflowActor = {
  workflowStatus: tbl_personnel_workflow_status
  createdById: number
}

export function pendingCreateStamps(userId: number) {
  return {
    workflowStatus: 'PENDING' as const,
    createdById: userId,
    updatedById: userId,
    validatedAt: null,
    validatedById: null,
    rejectedAt: null,
    rejectedById: null,
    reviewNote: null,
  }
}

/** Create as PENDING, or as VALIDATED when the actor bypasses maker–checker (e.g. admin). */
export function createStampsForActor(userId: number, bypassValidation: boolean) {
  if (!bypassValidation) {
    return pendingCreateStamps(userId)
  }
  const now = new Date()
  return {
    workflowStatus: 'VALIDATED' as const,
    createdById: userId,
    updatedById: userId,
    validatedAt: now,
    validatedById: userId,
    rejectedAt: null,
    rejectedById: null,
    reviewNote: null,
  }
}

export function editStamps(
  userId: number,
  currentStatus: tbl_personnel_workflow_status,
) {
  if (currentStatus === 'REJECTED') {
    return {
      updatedById: userId,
      workflowStatus: 'PENDING' as const,
      rejectedAt: null,
      rejectedById: null,
    }
  }

  return { updatedById: userId }
}

export function validateStamps(userId: number, reviewNote?: string | null) {
  return {
    workflowStatus: 'VALIDATED' as const,
    validatedById: userId,
    validatedAt: new Date(),
    updatedById: userId,
    rejectedAt: null,
    rejectedById: null,
    ...(reviewNote !== undefined ? { reviewNote } : {}),
  }
}

export function rejectStamps(userId: number, reviewNote?: string | null) {
  return {
    workflowStatus: 'REJECTED' as const,
    rejectedById: userId,
    rejectedAt: new Date(),
    updatedById: userId,
    reviewNote: reviewNote ?? null,
  }
}

export async function assertCanEdit(
  userId: number,
  status: tbl_personnel_workflow_status,
): Promise<void> {
  let canEditValidated = false
  if (status === 'VALIDATED') {
    const user = await prisma.tbl_users.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    canEditValidated = user
      ? (await getPermissionsForRole(user.role)).canEditValidated
      : false
  }
  if (canEditWorkflowStatus(status, canEditValidated)) return
  throw new PersonnelWorkflowError(
    'Only pending or rejected records can be edited',
    409,
  )
}

export async function assertCanValidate(
  record: WorkflowActor,
  userId: number,
): Promise<void> {
  if (record.workflowStatus !== 'PENDING') {
    throw new PersonnelWorkflowError(
      'Only pending records can be validated',
      409,
    )
  }
  if (record.createdById !== userId) return
  const user = await prisma.tbl_users.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user && isAdmin(user.role)) return
  throw new PersonnelWorkflowError(
    'You cannot validate a record you created',
    403,
  )
}

export function assertCanReject(status: tbl_personnel_workflow_status): void {
  if (status !== 'PENDING') {
    throw new PersonnelWorkflowError('Only pending records can be rejected', 409)
  }
}

export function assertCanDelete(status: tbl_personnel_workflow_status): void {
  if (status !== 'PENDING' && status !== 'REJECTED') {
    throw new PersonnelWorkflowError(
      'Only pending or rejected records can be deleted',
      409,
    )
  }
}

export function parseDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new PersonnelWorkflowError(`Invalid date for ${field}`, 400)
  }
  return date
}

export function parseOptionalDate(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return parseDate(value, field)
}
