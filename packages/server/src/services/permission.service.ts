import type {
  PermissionRequestCreateInput,
  PermissionRequestUpdateInput,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
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

const requestInclude = {
  ledger: true,
} as const

function mapRequest(row: {
  id: number
  matricule: string
  days: number
  applicationDate: Date
  reason: string | null
  workflowStatus: string
  current: boolean
  createdAt: Date
  createdById: number
  reviewNote: string | null
  ledger: { id: number } | null
}) {
  return {
    id: row.id,
    matricule: row.matricule,
    days: row.days,
    applicationDate: row.applicationDate,
    reason: row.reason,
    workflowStatus: row.workflowStatus,
    current: row.current,
    createdAt: row.createdAt,
    createdById: row.createdById,
    reviewNote: row.reviewNote,
    posted: row.ledger != null,
  }
}

async function requireEmployee(matricule: string) {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: { matricule: true },
  })
  if (!employee) throw new PersonnelNotFoundError('Employee not found')
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
  async create(userId: number, input: PermissionRequestCreateInput) {
    await requireEmployee(input.matricule)
    const row = await prisma.tbl_permission_request.create({
      data: {
        matricule: input.matricule,
        days: input.days,
        applicationDate: parseDate(input.applicationDate, 'applicationDate'),
        reason: blankToNull(input.reason),
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
        ...(input.reason !== undefined
          ? { reason: blankToNull(input.reason) }
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
    await prisma.$transaction(async (tx) => {
      await tx.tbl_permission_request.update({
        where: { id },
        data: { ...validateStamps(userId, review?.reviewNote), current: true },
      })
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
}
