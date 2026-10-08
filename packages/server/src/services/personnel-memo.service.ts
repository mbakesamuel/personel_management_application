import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, type tbl_personnel_workflow_status } from '@prisma/client'
import type {
  EmployeeMemoCreateInput,
  EmployeeMemoUpdateInput,
  EmployeeSanctionCreateInput,
  EmployeeSanctionUpdateInput,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import type { PersonnelListQuery, ReviewInput } from './personnel.service.js'
import {
  assertCanEdit,
  assertCanReject,
  assertCanValidate,
  editStamps,
  parseDate,
  parseOptionalDate,
  pendingCreateStamps,
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
  rejectStamps,
  validateStamps,
} from './personnel-workflow.js'

const attachmentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/memo-attachments',
)

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const memoInclude = {
  memoType: true,
  attachments: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.tbl_employee_memoInclude

const sanctionInclude = {
  sanction: true,
} satisfies Prisma.tbl_employee_sanctionInclude

type MemoRow = Prisma.tbl_employee_memoGetPayload<{ include: typeof memoInclude }>
type SanctionRow = Prisma.tbl_employee_sanctionGetPayload<{
  include: typeof sanctionInclude
}>

function workflowWhere(query: PersonnelListQuery) {
  return {
    ...(query.matricule ? { matricule: query.matricule } : {}),
    ...(query.workflowStatus ? { workflowStatus: query.workflowStatus } : {}),
  }
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') throw new PersonnelNotFoundError()
    if (error.code === 'P2002') {
      throw new PersonnelConflictError('Record already exists')
    }
    if (error.code === 'P2003') {
      throw new PersonnelWorkflowError('Invalid reference', 400)
    }
  }
  throw error
}

async function withPrisma<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    mapPrismaError(error)
  }
}

async function requireEmployee(matricule: string) {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: { matricule: true },
  })
  if (!employee) {
    throw new PersonnelNotFoundError(
      `No employee found for matricule ${matricule}`,
    )
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

function assertMemoDocumentsEditable(status: tbl_personnel_workflow_status) {
  if (status !== 'PENDING' && status !== 'REJECTED') {
    throw new PersonnelWorkflowError(
      'Documents can be changed only while the memo is pending or rejected',
      409,
    )
  }
}

function assertDateOrder(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (start && end && end < start) {
    throw new PersonnelWorkflowError(
      'End date cannot be before the start date',
      400,
    )
  }
}

function mapAttachment(
  row: MemoRow['attachments'][number],
) {
  return {
    id: row.id,
    memoId: row.memoId,
    originalName: row.originalName,
    uploadedAt: row.uploadedAt,
    uploadedById: row.uploadedById,
    remarks: row.remarks,
  }
}

function mapMemo(row: MemoRow) {
  return {
    id: row.id,
    matricule: row.matricule,
    memoTypeId: row.memoTypeId,
    memoType: row.memoType,
    memoNumber: row.memoNumber,
    memoDate: row.memoDate,
    subject: row.subject,
    details: row.details,
    incidentDate: row.incidentDate,
    effectiveDate: row.effectiveDate,
    workflowStatus: row.workflowStatus,
    current: row.current,
    createdAt: row.createdAt,
    createdById: row.createdById,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
    validatedAt: row.validatedAt,
    validatedById: row.validatedById,
    rejectedAt: row.rejectedAt,
    rejectedById: row.rejectedById,
    reviewNote: row.reviewNote,
    attachments: row.attachments.map(mapAttachment),
  }
}

function mapSanction(row: SanctionRow) {
  return row
}

function safeExt(name: string) {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return ext.length > 1 && ext.length <= 10 ? ext : ''
}

function storedPath(fileName: string) {
  const resolved = path.resolve(attachmentDir, fileName)
  if (!resolved.startsWith(path.resolve(attachmentDir) + path.sep)) {
    throw new PersonnelWorkflowError('Invalid attachment path', 400)
  }
  return resolved
}

export const employeeMemoService = {
  async list(query: PersonnelListQuery) {
    const rows = await prisma.tbl_employee_memo.findMany({
      where: {
        ...workflowWhere(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: memoInclude,
      orderBy: [{ memoDate: 'desc' }, { id: 'desc' }],
    })
    return rows.map(mapMemo)
  },
  async get(id: number) {
    const row = await prisma.tbl_employee_memo.findUnique({
      where: { id },
      include: memoInclude,
    })
    if (!row) throw new PersonnelNotFoundError('Memo not found')
    return mapMemo(row)
  },
  async create(userId: number, input: EmployeeMemoCreateInput) {
    await requireEmployee(input.matricule)
    const memoType = await prisma.tbl_memo_type.findUnique({
      where: { id: input.memoTypeId },
      select: { id: true },
    })
    if (!memoType) throw new PersonnelWorkflowError('Unknown memo type', 400)
    return withPrisma(async () => {
      const row = await prisma.tbl_employee_memo.create({
        data: {
          matricule: input.matricule,
          memoTypeId: input.memoTypeId,
          memoNumber: blankToNull(input.memoNumber),
          memoDate: parseDate(input.memoDate, 'memoDate'),
          subject: input.subject.trim(),
          details: blankToNull(input.details),
          incidentDate: parseOptionalDate(input.incidentDate, 'incidentDate'),
          effectiveDate: parseOptionalDate(
            input.effectiveDate,
            'effectiveDate',
          ),
          current: false,
          ...pendingCreateStamps(userId),
        },
        include: memoInclude,
      })
      return mapMemo(row)
    })
  },
  async update(userId: number, id: number, input: EmployeeMemoUpdateInput) {
    const existing = await prisma.tbl_employee_memo.findUnique({
      where: { id },
    })
    if (!existing) throw new PersonnelNotFoundError('Memo not found')
    await assertCanEdit(userId, existing.workflowStatus)
    if (
      input.incidentDate &&
      input.effectiveDate &&
      input.effectiveDate < input.incidentDate
    ) {
      throw new PersonnelWorkflowError(
        'Effective date cannot be before the incident date',
        400,
      )
    }
    return withPrisma(async () => {
      const row = await prisma.tbl_employee_memo.update({
        where: { id },
        data: {
          ...(input.memoTypeId !== undefined
            ? { memoTypeId: input.memoTypeId }
            : {}),
          ...(input.memoNumber !== undefined
            ? { memoNumber: blankToNull(input.memoNumber) }
            : {}),
          ...(input.memoDate !== undefined
            ? { memoDate: parseDate(input.memoDate, 'memoDate') }
            : {}),
          ...(input.subject !== undefined
            ? { subject: input.subject.trim() }
            : {}),
          ...(input.details !== undefined
            ? { details: blankToNull(input.details) }
            : {}),
          ...(input.incidentDate !== undefined
            ? {
                incidentDate: parseOptionalDate(
                  input.incidentDate,
                  'incidentDate',
                ),
              }
            : {}),
          ...(input.effectiveDate !== undefined
            ? {
                effectiveDate: parseOptionalDate(
                  input.effectiveDate,
                  'effectiveDate',
                ),
              }
            : {}),
          ...editStamps(userId, existing.workflowStatus),
        },
        include: memoInclude,
      })
      return mapMemo(row)
    })
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_employee_memo.findUnique({ where: { id } })
    if (!row) throw new PersonnelNotFoundError('Memo not found')
    await assertCanValidate(row, userId)
    const updated = await prisma.$transaction(async (tx) => {
      await tx.tbl_employee_memo.updateMany({
        where: {
          matricule: row.matricule,
          memoTypeId: row.memoTypeId,
          current: true,
          NOT: { id },
        },
        data: { current: false, workflowStatus: 'SUPERSEDED' },
      })
      return tx.tbl_employee_memo.update({
        where: { id },
        data: {
          ...validateStamps(userId, review?.reviewNote),
          current: true,
        },
        include: memoInclude,
      })
    })
    return mapMemo(updated)
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_employee_memo.findUnique({ where: { id } })
    if (!row) throw new PersonnelNotFoundError('Memo not found')
    assertCanReject(row.workflowStatus)
    const updated = await prisma.tbl_employee_memo.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      include: memoInclude,
    })
    return mapMemo(updated)
  },
  async addAttachment(
    userId: number,
    memoId: number,
    file: File,
    remarks?: string | null,
  ) {
    const memo = await prisma.tbl_employee_memo.findUnique({
      where: { id: memoId },
      select: { id: true, workflowStatus: true, matricule: true },
    })
    if (!memo) throw new PersonnelNotFoundError('Memo not found')
    assertMemoDocumentsEditable(memo.workflowStatus)
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new PersonnelWorkflowError('Choose a file to attach', 400)
    }
    if (file.size <= 0) {
      throw new PersonnelWorkflowError('The file is empty', 400)
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new PersonnelWorkflowError('File must be 8 MB or smaller', 400)
    }
    const originalName = path.basename(file.name || 'document').slice(0, 180)
    const fileName = `${randomBytes(16).toString('hex')}${safeExt(originalName)}`
    await mkdir(attachmentDir, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(storedPath(fileName), bytes)
    try {
      const row = await prisma.tbl_employee_memo_attachment.create({
        data: {
          memoId,
          fileName,
          originalName: originalName || 'document',
          filePath: fileName,
          uploadedById: userId,
          remarks: blankToNull(remarks)?.slice(0, 191) ?? null,
        },
      })
      return mapAttachment(row)
    } catch (error) {
      await unlink(storedPath(fileName)).catch(() => undefined)
      mapPrismaError(error)
    }
  },
  async readAttachment(memoId: number, attachmentId: number) {
    const row = await prisma.tbl_employee_memo_attachment.findFirst({
      where: { id: attachmentId, memoId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    const bytes = await readFile(storedPath(row.filePath)).catch(() => null)
    if (!bytes) throw new PersonnelNotFoundError('Document file is missing')
    return { originalName: row.originalName, bytes }
  },
  async removeAttachment(memoId: number, attachmentId: number) {
    const memo = await prisma.tbl_employee_memo.findUnique({
      where: { id: memoId },
      select: { workflowStatus: true },
    })
    if (!memo) throw new PersonnelNotFoundError('Memo not found')
    assertMemoDocumentsEditable(memo.workflowStatus)
    const row = await prisma.tbl_employee_memo_attachment.findFirst({
      where: { id: attachmentId, memoId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    await prisma.tbl_employee_memo_attachment.delete({
      where: { id: attachmentId },
    })
    await unlink(storedPath(row.filePath)).catch(() => undefined)
    return { id: attachmentId }
  },
}

export const employeeSanctionService = {
  async list(query: PersonnelListQuery) {
    const rows = await prisma.tbl_employee_sanction.findMany({
      where: workflowWhere(query),
      include: sanctionInclude,
      orderBy: [{ id: 'desc' }],
    })
    return rows.map(mapSanction)
  },
  async get(id: number) {
    const row = await prisma.tbl_employee_sanction.findUnique({
      where: { id },
      include: sanctionInclude,
    })
    if (!row) throw new PersonnelNotFoundError('Sanction not found')
    return mapSanction(row)
  },
  async create(userId: number, input: EmployeeSanctionCreateInput) {
    await requireEmployee(input.matricule)
    assertDateOrder(input.startDate, input.endDate)
    const memo = await prisma.tbl_employee_memo.findUnique({
      where: { id: input.memoId },
      select: { id: true, matricule: true, workflowStatus: true },
    })
    if (!memo) throw new PersonnelNotFoundError('Memo not found')
    if (memo.matricule !== input.matricule) {
      throw new PersonnelWorkflowError(
        'The memo belongs to a different employee',
        400,
      )
    }
    if (memo.workflowStatus !== 'VALIDATED') {
      throw new PersonnelWorkflowError(
        'A sanction can be added only after the memo is validated',
        409,
      )
    }
    const sanction = await prisma.tbl_sanction.findUnique({
      where: { id: input.sanctionId },
      select: { id: true },
    })
    if (!sanction) throw new PersonnelWorkflowError('Unknown sanction', 400)
    return withPrisma(async () => {
      const row = await prisma.tbl_employee_sanction.create({
        data: {
          matricule: input.matricule,
          memoId: input.memoId,
          sanctionId: input.sanctionId,
          reason: blankToNull(input.reason),
          startDate: parseOptionalDate(input.startDate, 'startDate'),
          endDate: parseOptionalDate(input.endDate, 'endDate'),
          active: false,
          ...pendingCreateStamps(userId),
        },
        include: sanctionInclude,
      })
      return mapSanction(row)
    })
  },
  async update(
    userId: number,
    id: number,
    input: EmployeeSanctionUpdateInput,
  ) {
    const existing = await prisma.tbl_employee_sanction.findUnique({
      where: { id },
    })
    if (!existing) throw new PersonnelNotFoundError('Sanction not found')
    await assertCanEdit(userId, existing.workflowStatus)
    const start =
      input.startDate !== undefined
        ? input.startDate
        : existing.startDate
          ? existing.startDate.toISOString().slice(0, 10)
          : null
    const end =
      input.endDate !== undefined
        ? input.endDate
        : existing.endDate
          ? existing.endDate.toISOString().slice(0, 10)
          : null
    assertDateOrder(start, end)
    return withPrisma(async () => {
      const row = await prisma.tbl_employee_sanction.update({
        where: { id },
        data: {
          ...(input.sanctionId !== undefined
            ? { sanctionId: input.sanctionId }
            : {}),
          ...(input.reason !== undefined
            ? { reason: blankToNull(input.reason) }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: parseOptionalDate(input.startDate, 'startDate') }
            : {}),
          ...(input.endDate !== undefined
            ? { endDate: parseOptionalDate(input.endDate, 'endDate') }
            : {}),
          ...editStamps(userId, existing.workflowStatus),
        },
        include: sanctionInclude,
      })
      return mapSanction(row)
    })
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_employee_sanction.findUnique({
      where: { id },
    })
    if (!row) throw new PersonnelNotFoundError('Sanction not found')
    await assertCanValidate(row, userId)
    if (row.memoId == null) {
      throw new PersonnelWorkflowError(
        'A sanction must be linked to a validated memo',
        409,
      )
    }
    const memo = await prisma.tbl_employee_memo.findUnique({
      where: { id: row.memoId },
      select: { workflowStatus: true },
    })
    if (!memo || memo.workflowStatus !== 'VALIDATED') {
      throw new PersonnelWorkflowError(
        'A sanction can be validated only while its memo is validated',
        409,
      )
    }
    const updated = await prisma.tbl_employee_sanction.update({
      where: { id },
      data: {
        ...validateStamps(userId, review?.reviewNote),
        active: true,
      },
      include: sanctionInclude,
    })
    return mapSanction(updated)
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_employee_sanction.findUnique({
      where: { id },
    })
    if (!row) throw new PersonnelNotFoundError('Sanction not found')
    assertCanReject(row.workflowStatus)
    const updated = await prisma.tbl_employee_sanction.update({
      where: { id },
      data: {
        ...rejectStamps(userId, review?.reviewNote),
        active: false,
      },
      include: sanctionInclude,
    })
    return mapSanction(updated)
  },
}
