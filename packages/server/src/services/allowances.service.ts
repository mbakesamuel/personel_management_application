import { Prisma, type tbl_personnel_workflow_status } from '@prisma/client'
import type {
  AllowanceAllocationBatchInput,
  AllowanceAllocationEligibility,
  AllowanceAllocationOption,
  AllowanceAllocationUpdateInput,
  AllowanceAllocationUpsertInput,
  AllowanceOption,
  AllowanceRateOption,
  AllowanceRateUpsertInput,
  AllowanceTypeOption,
  AllowanceTypeUpsertInput,
  AllowanceUpsertInput,
  AllowanceEmployeeOption,
  AllowanceWorkflowFields,
  WorkflowReviewInput,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  assertOperationalEmployee,
  formatEmployeeName,
  resolveLiveEmployee,
  resolveLiveEmployees,
} from './live-employee.service.js'
import {
  assertCanDelete,
  assertCanEdit,
  assertCanReject,
  assertCanValidate,
  editStamps,
  parseDate,
  createStampsForActor,
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
  rejectStamps,
  validateStamps,
} from './personnel-workflow.js'

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function mapWorkflow(row: {
  workflowStatus: tbl_personnel_workflow_status
  createdAt: Date
  createdById: number
  updatedAt: Date
  updatedById: number | null
  validatedAt: Date | null
  validatedById: number | null
  rejectedAt: Date | null
  rejectedById: number | null
  reviewNote: string | null
}): AllowanceWorkflowFields {
  return {
    workflowStatus: row.workflowStatus,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    updatedAt: row.updatedAt.toISOString(),
    updatedById: row.updatedById,
    validatedAt: toIso(row.validatedAt),
    validatedById: row.validatedById,
    rejectedAt: toIso(row.rejectedAt),
    rejectedById: row.rejectedById,
    reviewNote: row.reviewNote,
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

async function requireValidatedAllowanceType(id: string) {
  const row = await prisma.tbl_allowance_type.findUnique({ where: { id } })
  if (!row) throw new PersonnelNotFoundError('Allowance type not found')
  if (row.workflowStatus !== 'VALIDATED') {
    throw new PersonnelWorkflowError(
      'Only validated allowance types can be selected',
      400,
    )
  }
  return row
}

async function requireValidatedAllowance(id: string) {
  const row = await prisma.tbl_allowance.findUnique({ where: { id } })
  if (!row) throw new PersonnelNotFoundError('Allowance not found')
  if (row.workflowStatus !== 'VALIDATED') {
    throw new PersonnelWorkflowError(
      'Only validated allowances can be selected',
      400,
    )
  }
  return row
}

async function requireEmployee(matricule: string) {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: { matricule: true, name: true, firstname: true, workflowStatus: true },
  })
  if (!employee) {
    throw new PersonnelNotFoundError(`No employee found for matricule ${matricule}`)
  }
  return employee
}

function mapType(row: {
  id: string
  allowanceTypeName: string
  workflowStatus: tbl_personnel_workflow_status
  createdAt: Date
  createdById: number
  updatedAt: Date
  updatedById: number | null
  validatedAt: Date | null
  validatedById: number | null
  rejectedAt: Date | null
  rejectedById: number | null
  reviewNote: string | null
}): AllowanceTypeOption {
  return {
    id: row.id,
    allowanceTypeName: row.allowanceTypeName,
    ...mapWorkflow(row),
  }
}

function mapAllowance(row: {
  id: string
  allowanceName: string
  allowanceTypeId: string | null
  allowanceType: { allowanceTypeName: string } | null
  workflowStatus: tbl_personnel_workflow_status
  createdAt: Date
  createdById: number
  updatedAt: Date
  updatedById: number | null
  validatedAt: Date | null
  validatedById: number | null
  rejectedAt: Date | null
  rejectedById: number | null
  reviewNote: string | null
}): AllowanceOption {
  return {
    id: row.id,
    allowanceName: row.allowanceName,
    allowanceTypeId: row.allowanceTypeId,
    allowanceTypeName: row.allowanceType?.allowanceTypeName ?? null,
    ...mapWorkflow(row),
  }
}

function mapRate(row: {
  id: number
  allowanceId: string
  positionKeywordId: number | null
  allowanceAmtMin: number
  allowanceAmtMax: number
  effectiveDate: Date
  current: boolean
  allowance: { allowanceName: string }
  positionKeyword: { keyword: string } | null
  workflowStatus: tbl_personnel_workflow_status
  createdAt: Date
  createdById: number
  updatedAt: Date
  updatedById: number | null
  validatedAt: Date | null
  validatedById: number | null
  rejectedAt: Date | null
  rejectedById: number | null
  reviewNote: string | null
}): AllowanceRateOption {
  return {
    id: row.id,
    allowanceId: row.allowanceId,
    allowanceName: row.allowance.allowanceName,
    positionKeywordId: row.positionKeywordId,
    positionKeyword: row.positionKeyword?.keyword ?? null,
    allowanceAmtMin: row.allowanceAmtMin,
    allowanceAmtMax: row.allowanceAmtMax,
    effectiveDate: toDateOnly(row.effectiveDate),
    current: row.current,
    ...mapWorkflow(row),
  }
}

const rateInclude = {
  allowance: true,
  positionKeyword: true,
} as const

async function resolvePositionKeywordId(
  positionKeywordId: number | null | undefined,
): Promise<number | null> {
  if (positionKeywordId == null) return null
  const keyword = await prisma.tbl_position_keyword.findUnique({
    where: { id: positionKeywordId },
    select: { id: true },
  })
  if (!keyword) throw new PersonnelNotFoundError('Position keyword not found')
  return keyword.id
}

function currentRateScope(
  allowanceId: string,
  positionKeywordId: number | null,
  excludeId?: number,
) {
  return {
    allowanceId,
    positionKeywordId,
    current: true,
    ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
  }
}

function mapAllocation(row: {
  id: number
  matricule: string
  allowanceId: string
  allowanceAmt: number
  effectiveDate: Date
  current: boolean
  allowance: { allowanceName: string }
  employee: { name: string; firstname: string | null }
  workflowStatus: tbl_personnel_workflow_status
  createdAt: Date
  createdById: number
  updatedAt: Date
  updatedById: number | null
  validatedAt: Date | null
  validatedById: number | null
  rejectedAt: Date | null
  rejectedById: number | null
  reviewNote: string | null
}): AllowanceAllocationOption {
  return {
    id: row.id,
    matricule: row.matricule,
    employeeName: formatEmployeeName(row.employee.name, row.employee.firstname),
    allowanceId: row.allowanceId,
    allowanceName: row.allowance.allowanceName,
    allowanceAmt: row.allowanceAmt,
    effectiveDate: toDateOnly(row.effectiveDate),
    current: row.current,
    ...mapWorkflow(row),
  }
}

async function resolveRateBand(
  allowanceId: string,
  keywordIds: number[],
): Promise<{ min: number; max: number } | null> {
  const rates = await prisma.tbl_allowance_rate.findMany({
    where: {
      allowanceId,
      current: true,
      workflowStatus: 'VALIDATED',
      OR: [
        { positionKeywordId: { in: keywordIds } },
        { positionKeywordId: null },
      ],
    },
    select: {
      positionKeywordId: true,
      allowanceAmtMin: true,
      allowanceAmtMax: true,
    },
  })
  const specific = rates.find(
    (row) =>
      row.positionKeywordId != null && keywordIds.includes(row.positionKeywordId),
  )
  const fallback = rates.find((row) => row.positionKeywordId == null)
  const rate = specific ?? fallback
  if (!rate) return null
  return { min: rate.allowanceAmtMin, max: rate.allowanceAmtMax }
}

function assertAmountInBand(
  allowanceId: string,
  amount: number,
  band: { min: number; max: number } | null,
) {
  if (!band) {
    throw new PersonnelConflictError(
      `No validated rate band for ${allowanceId}; cannot allocate`,
    )
  }
  if (amount < band.min || amount > band.max) {
    throw new PersonnelConflictError(
      `Amount for ${allowanceId} must be between ${band.min} and ${band.max}`,
    )
  }
}

export const allowanceTypeService = {
  async list(): Promise<AllowanceTypeOption[]> {
    const rows = await prisma.tbl_allowance_type.findMany({
      orderBy: [{ allowanceTypeName: 'asc' }],
    })
    return rows.map(mapType)
  },

  async get(id: string): Promise<AllowanceTypeOption> {
    const row = await prisma.tbl_allowance_type.findUnique({ where: { id } })
    if (!row) throw new PersonnelNotFoundError('Allowance type not found')
    return mapType(row)
  },

  async create(
    userId: number,
    input: AllowanceTypeUpsertInput,
    bypassValidation = false,
  ): Promise<AllowanceTypeOption> {
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance_type.create({
        data: {
          id: input.id.trim(),
          allowanceTypeName: input.allowanceTypeName.trim(),
          ...createStampsForActor(userId, bypassValidation),
        },
      })
      return mapType(row)
    })
  },

  async update(
    userId: number,
    id: string,
    input: AllowanceTypeUpsertInput,
  ): Promise<AllowanceTypeOption> {
    const existing = await prisma.tbl_allowance_type.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance type not found')
    await assertCanEdit(userId, existing.workflowStatus)
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance_type.update({
        where: { id },
        data: {
          allowanceTypeName: input.allowanceTypeName.trim(),
          ...editStamps(userId, existing.workflowStatus),
        },
      })
      return mapType(row)
    })
  },

  async remove(id: string): Promise<void> {
    const existing = await prisma.tbl_allowance_type.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance type not found')
    assertCanDelete(existing.workflowStatus)
    await withPrisma(() =>
      prisma.tbl_allowance_type.delete({ where: { id } }),
    )
  },

  async validate(
    userId: number,
    id: string,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceTypeOption> {
    const existing = await prisma.tbl_allowance_type.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance type not found')
    await assertCanValidate(existing, userId)
    const row = await prisma.tbl_allowance_type.update({
      where: { id },
      data: validateStamps(userId, review?.reviewNote),
    })
    return mapType(row)
  },

  async reject(
    userId: number,
    id: string,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceTypeOption> {
    const existing = await prisma.tbl_allowance_type.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance type not found')
    assertCanReject(existing.workflowStatus)
    const row = await prisma.tbl_allowance_type.update({
      where: { id },
      data: rejectStamps(userId, review?.reviewNote),
    })
    return mapType(row)
  },
}

export const allowanceService = {
  async list(): Promise<AllowanceOption[]> {
    const rows = await prisma.tbl_allowance.findMany({
      include: { allowanceType: true },
      orderBy: [{ allowanceName: 'asc' }],
    })
    return rows.map(mapAllowance)
  },

  async get(id: string): Promise<AllowanceOption> {
    const row = await prisma.tbl_allowance.findUnique({
      where: { id },
      include: { allowanceType: true },
    })
    if (!row) throw new PersonnelNotFoundError('Allowance not found')
    return mapAllowance(row)
  },

  async create(
    userId: number,
    input: AllowanceUpsertInput,
    bypassValidation = false,
  ): Promise<AllowanceOption> {
    const typeId = input.allowanceTypeId?.trim() || null
    if (typeId) await requireValidatedAllowanceType(typeId)
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance.create({
        data: {
          id: input.id.trim(),
          allowanceName: input.allowanceName.trim(),
          allowanceTypeId: typeId,
          ...createStampsForActor(userId, bypassValidation),
        },
        include: { allowanceType: true },
      })
      return mapAllowance(row)
    })
  },

  async update(
    userId: number,
    id: string,
    input: AllowanceUpsertInput,
  ): Promise<AllowanceOption> {
    const existing = await prisma.tbl_allowance.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance not found')
    await assertCanEdit(userId, existing.workflowStatus)
    const typeId =
      input.allowanceTypeId === undefined
        ? existing.allowanceTypeId
        : input.allowanceTypeId?.trim() || null
    if (typeId) await requireValidatedAllowanceType(typeId)
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance.update({
        where: { id },
        data: {
          allowanceName: input.allowanceName.trim(),
          allowanceTypeId: typeId,
          ...editStamps(userId, existing.workflowStatus),
        },
        include: { allowanceType: true },
      })
      return mapAllowance(row)
    })
  },

  async remove(id: string): Promise<void> {
    const existing = await prisma.tbl_allowance.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance not found')
    assertCanDelete(existing.workflowStatus)
    await withPrisma(() => prisma.tbl_allowance.delete({ where: { id } }))
  },

  async validate(
    userId: number,
    id: string,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceOption> {
    const existing = await prisma.tbl_allowance.findUnique({
      where: { id },
      include: { allowanceType: true },
    })
    if (!existing) throw new PersonnelNotFoundError('Allowance not found')
    await assertCanValidate(existing, userId)
    const row = await prisma.tbl_allowance.update({
      where: { id },
      data: validateStamps(userId, review?.reviewNote),
      include: { allowanceType: true },
    })
    return mapAllowance(row)
  },

  async reject(
    userId: number,
    id: string,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceOption> {
    const existing = await prisma.tbl_allowance.findUnique({
      where: { id },
      include: { allowanceType: true },
    })
    if (!existing) throw new PersonnelNotFoundError('Allowance not found')
    assertCanReject(existing.workflowStatus)
    const row = await prisma.tbl_allowance.update({
      where: { id },
      data: rejectStamps(userId, review?.reviewNote),
      include: { allowanceType: true },
    })
    return mapAllowance(row)
  },
}

export const allowanceRateService = {
  async list(allowanceId?: string): Promise<AllowanceRateOption[]> {
    const rows = await prisma.tbl_allowance_rate.findMany({
      where: allowanceId ? { allowanceId } : undefined,
      include: rateInclude,
      orderBy: [{ effectiveDate: 'desc' }, { id: 'asc' }],
    })
    return rows.map(mapRate)
  },

  async get(id: number): Promise<AllowanceRateOption> {
    const row = await prisma.tbl_allowance_rate.findUnique({
      where: { id },
      include: rateInclude,
    })
    if (!row) throw new PersonnelNotFoundError('Allowance rate not found')
    return mapRate(row)
  },

  async create(
    userId: number,
    input: AllowanceRateUpsertInput,
    bypassValidation = false,
  ): Promise<AllowanceRateOption> {
    await requireValidatedAllowance(input.allowanceId.trim())
    const allowanceId = input.allowanceId.trim()
    const positionKeywordId = await resolvePositionKeywordId(
      input.positionKeywordId,
    )
    if (input.allowanceAmtMin > input.allowanceAmtMax) {
      throw new PersonnelConflictError(
        'Minimum amount must be less than or equal to maximum amount',
      )
    }
    return withPrisma(async () => {
      if (!bypassValidation) {
        const row = await prisma.tbl_allowance_rate.create({
          data: {
            allowanceId,
            positionKeywordId,
            allowanceAmtMin: input.allowanceAmtMin,
            allowanceAmtMax: input.allowanceAmtMax,
            effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
            current: false,
            ...createStampsForActor(userId, false),
          },
          include: rateInclude,
        })
        return mapRate(row)
      }

      const row = await prisma.$transaction(async (tx) => {
        await tx.tbl_allowance_rate.updateMany({
          where: currentRateScope(allowanceId, positionKeywordId),
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        })
        return tx.tbl_allowance_rate.create({
          data: {
            allowanceId,
            positionKeywordId,
            allowanceAmtMin: input.allowanceAmtMin,
            allowanceAmtMax: input.allowanceAmtMax,
            effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
            current: true,
            ...createStampsForActor(userId, true),
          },
          include: rateInclude,
        })
      })
      return mapRate(row)
    })
  },

  async update(
    userId: number,
    id: number,
    input: AllowanceRateUpsertInput,
  ): Promise<AllowanceRateOption> {
    const existing = await prisma.tbl_allowance_rate.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance rate not found')
    await assertCanEdit(userId, existing.workflowStatus)
    await requireValidatedAllowance(input.allowanceId.trim())
    const positionKeywordId = await resolvePositionKeywordId(
      input.positionKeywordId,
    )
    if (input.allowanceAmtMin > input.allowanceAmtMax) {
      throw new PersonnelConflictError(
        'Minimum amount must be less than or equal to maximum amount',
      )
    }
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance_rate.update({
        where: { id },
        data: {
          allowanceId: input.allowanceId.trim(),
          positionKeywordId,
          allowanceAmtMin: input.allowanceAmtMin,
          allowanceAmtMax: input.allowanceAmtMax,
          effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
          ...editStamps(userId, existing.workflowStatus),
        },
        include: rateInclude,
      })
      return mapRate(row)
    })
  },

  async remove(id: number): Promise<void> {
    const existing = await prisma.tbl_allowance_rate.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Allowance rate not found')
    assertCanDelete(existing.workflowStatus)
    await withPrisma(() => prisma.tbl_allowance_rate.delete({ where: { id } }))
  },

  async validate(
    userId: number,
    id: number,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceRateOption> {
    const existing = await prisma.tbl_allowance_rate.findUnique({
      where: { id },
      include: rateInclude,
    })
    if (!existing) throw new PersonnelNotFoundError('Allowance rate not found')
    await assertCanValidate(existing, userId)
    const row = await prisma.$transaction(async (tx) => {
      await tx.tbl_allowance_rate.updateMany({
        where: currentRateScope(
          existing.allowanceId,
          existing.positionKeywordId,
          id,
        ),
        data: { current: false, workflowStatus: 'SUPERSEDED' },
      })
      return tx.tbl_allowance_rate.update({
        where: { id },
        data: {
          ...validateStamps(userId, review?.reviewNote),
          current: true,
        },
        include: rateInclude,
      })
    })
    return mapRate(row)
  },

  async reject(
    userId: number,
    id: number,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceRateOption> {
    const existing = await prisma.tbl_allowance_rate.findUnique({
      where: { id },
      include: rateInclude,
    })
    if (!existing) throw new PersonnelNotFoundError('Allowance rate not found')
    assertCanReject(existing.workflowStatus)
    const row = await prisma.tbl_allowance_rate.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      include: rateInclude,
    })
    return mapRate(row)
  },
}

export const allowanceAllocationService = {
  async list(allowanceId?: string): Promise<AllowanceAllocationOption[]> {
    const rows = await prisma.tbl_allowance_allocation.findMany({
      where: allowanceId ? { allowanceId } : undefined,
      include: {
        allowance: true,
        employee: { select: { name: true, firstname: true } },
      },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    })
    const live = await resolveLiveEmployees(rows.map((row) => row.matricule))
    return rows
      .filter((row) => live.has(row.matricule))
      .map(mapAllocation)
  },

  async get(id: number): Promise<AllowanceAllocationOption> {
    const row = await prisma.tbl_allowance_allocation.findUnique({
      where: { id },
      include: {
        allowance: true,
        employee: { select: { name: true, firstname: true } },
      },
    })
    if (!row) throw new PersonnelNotFoundError('Allowance allocation not found')
    return mapAllocation(row)
  },

  async eligibility(matricule: string): Promise<AllowanceAllocationEligibility> {
    const live = await assertOperationalEmployee(matricule)
    const employee = await requireEmployee(live.matricule)
    const designation = live?.designation?.trim() || null
    const name =
      live?.names?.trim() ||
      formatEmployeeName(employee.name, employee.firstname)
    const keywords = await prisma.tbl_position_keyword.findMany({
      where: { active: true },
      orderBy: [{ keyword: 'asc' }],
      select: { id: true, keyword: true },
    })
    const designationLower = (designation ?? '').toLowerCase()
    const matchedKeywords = designationLower
      ? keywords.filter((kw) =>
          designationLower.includes(kw.keyword.trim().toLowerCase()),
        )
      : []

    if (matchedKeywords.length === 0) {
      return {
        matricule: employee.matricule,
        name,
        designation,
        matchedKeywords: [],
        allowances: [],
      }
    }

    const links = await prisma.tbl_allowance_keyword.findMany({
      where: {
        active: true,
        keywordId: { in: matchedKeywords.map((kw) => kw.id) },
        allowance: { workflowStatus: 'VALIDATED' },
      },
      include: {
        allowance: { include: { allowanceType: true } },
      },
    })

    const byAllowance = new Map<
      string,
      {
        id: string
        allowanceName: string
        allowanceTypeName: string | null
      }
    >()
    for (const link of links) {
      if (byAllowance.has(link.allowanceId)) continue
      byAllowance.set(link.allowanceId, {
        id: link.allowance.id,
        allowanceName: link.allowance.allowanceName,
        allowanceTypeName:
          link.allowance.allowanceType?.allowanceTypeName ?? null,
      })
    }

    const keywordIds = matchedKeywords.map((kw) => kw.id)
    const allowances = await Promise.all(
      [...byAllowance.values()].map(async (item) => {
        const band = await resolveRateBand(item.id, keywordIds)
        return {
          ...item,
          rateMin: band?.min ?? null,
          rateMax: band?.max ?? null,
        }
      }),
    )
    allowances.sort((a, b) => a.allowanceName.localeCompare(b.allowanceName))

    return {
      matricule: employee.matricule,
      name,
      designation,
      matchedKeywords: matchedKeywords.map((kw) => ({
        id: kw.id,
        keyword: kw.keyword,
      })),
      allowances,
    }
  },

  async create(
    userId: number,
    input: AllowanceAllocationUpsertInput,
    bypassValidation = false,
  ): Promise<AllowanceAllocationOption> {
    const liveEmployee = await assertOperationalEmployee(input.matricule)
    await requireValidatedAllowance(input.allowanceId.trim())
    const matricule = liveEmployee.matricule
    const allowanceId = input.allowanceId.trim()
    const live = liveEmployee
    const designation = live?.designation?.trim() || null
    const keywords = await prisma.tbl_position_keyword.findMany({
      where: { active: true },
      select: { id: true, keyword: true },
    })
    const designationLower = (designation ?? '').toLowerCase()
    const matchedIds = designationLower
      ? keywords
          .filter((kw) =>
            designationLower.includes(kw.keyword.trim().toLowerCase()),
          )
          .map((kw) => kw.id)
      : []
    const band = await resolveRateBand(allowanceId, matchedIds)
    assertAmountInBand(allowanceId, input.allowanceAmt, band)
    return withPrisma(async () => {
      if (!bypassValidation) {
        const row = await prisma.tbl_allowance_allocation.create({
          data: {
            matricule,
            allowanceId,
            allowanceAmt: input.allowanceAmt,
            effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
            current: false,
            ...createStampsForActor(userId, false),
          },
          include: {
            allowance: true,
            employee: { select: { name: true, firstname: true } },
          },
        })
        return mapAllocation(row)
      }

      const row = await prisma.$transaction(async (tx) => {
        await tx.tbl_allowance_allocation.updateMany({
          where: { matricule, allowanceId, current: true },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        })
        return tx.tbl_allowance_allocation.create({
          data: {
            matricule,
            allowanceId,
            allowanceAmt: input.allowanceAmt,
            effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
            current: true,
            ...createStampsForActor(userId, true),
          },
          include: {
            allowance: true,
            employee: { select: { name: true, firstname: true } },
          },
        })
      })
      return mapAllocation(row)
    })
  },

  async createBatch(
    userId: number,
    input: AllowanceAllocationBatchInput,
    bypassValidation = false,
  ): Promise<AllowanceAllocationOption[]> {
    const liveEmployee = await assertOperationalEmployee(input.matricule)
    const matricule = liveEmployee.matricule
    const items = input.items.map((item) => ({
      allowanceId: item.allowanceId.trim(),
      allowanceAmt: item.allowanceAmt,
    }))
    if (items.length === 0) {
      throw new PersonnelConflictError('Select at least one allowance')
    }
    const allowanceIds = [...new Set(items.map((item) => item.allowanceId))]
    if (allowanceIds.length !== items.length) {
      throw new PersonnelConflictError('Duplicate allowances in batch')
    }
    for (const item of items) {
      await requireValidatedAllowance(item.allowanceId)
    }

    const designation = liveEmployee.designation?.trim() || null
    const keywords = await prisma.tbl_position_keyword.findMany({
      where: { active: true },
      select: { id: true, keyword: true },
    })
    const designationLower = (designation ?? '').toLowerCase()
    const matchedIds = designationLower
      ? keywords
          .filter((kw) =>
            designationLower.includes(kw.keyword.trim().toLowerCase()),
          )
          .map((kw) => kw.id)
      : []
    for (const item of items) {
      const band = await resolveRateBand(item.allowanceId, matchedIds)
      assertAmountInBand(item.allowanceId, item.allowanceAmt, band)
    }

    const existing = await prisma.tbl_allowance_allocation.findMany({
      where: {
        matricule,
        allowanceId: { in: allowanceIds },
        OR: [
          { workflowStatus: 'PENDING' },
          { workflowStatus: 'VALIDATED', current: true },
        ],
      },
      select: { allowanceId: true },
    })
    if (existing.length > 0) {
      const ids = [...new Set(existing.map((row) => row.allowanceId))]
      throw new PersonnelConflictError(
        `Already allocated: ${ids.join(', ')}`,
      )
    }

    const effectiveDate = parseDate(input.effectiveDate, 'effectiveDate')
    return withPrisma(async () => {
      if (!bypassValidation) {
        const rows = await prisma.$transaction(
          items.map((item) =>
            prisma.tbl_allowance_allocation.create({
              data: {
                matricule,
                allowanceId: item.allowanceId,
                allowanceAmt: item.allowanceAmt,
                effectiveDate,
                current: false,
                ...createStampsForActor(userId, false),
              },
              include: {
                allowance: true,
                employee: { select: { name: true, firstname: true } },
              },
            }),
          ),
        )
        return rows.map(mapAllocation)
      }

      return prisma.$transaction(async (tx) => {
        const created = []
        for (const item of items) {
          await tx.tbl_allowance_allocation.updateMany({
            where: {
              matricule,
              allowanceId: item.allowanceId,
              current: true,
            },
            data: { current: false, workflowStatus: 'SUPERSEDED' },
          })
          const row = await tx.tbl_allowance_allocation.create({
            data: {
              matricule,
              allowanceId: item.allowanceId,
              allowanceAmt: item.allowanceAmt,
              effectiveDate,
              current: true,
              ...createStampsForActor(userId, true),
            },
            include: {
              allowance: true,
              employee: { select: { name: true, firstname: true } },
            },
          })
          created.push(mapAllocation(row))
        }
        return created
      })
    })
  },
  async update(
    userId: number,
    id: number,
    input: AllowanceAllocationUpdateInput,
  ): Promise<AllowanceAllocationOption> {
    const existing = await prisma.tbl_allowance_allocation.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new PersonnelNotFoundError('Allowance allocation not found')
    }
    await assertOperationalEmployee(existing.matricule)
    await assertCanEdit(userId, existing.workflowStatus)
    const allowanceId =
      input.allowanceId !== undefined
        ? input.allowanceId.trim()
        : existing.allowanceId
    if (input.allowanceId !== undefined) {
      await requireValidatedAllowance(allowanceId)
    }
    if (input.allowanceAmt !== undefined) {
      const live = await resolveLiveEmployee(existing.matricule)
      const designation = live?.designation?.trim() || null
      const keywords = await prisma.tbl_position_keyword.findMany({
        where: { active: true },
        select: { id: true, keyword: true },
      })
      const designationLower = (designation ?? '').toLowerCase()
      const matchedIds = designationLower
        ? keywords
            .filter((kw) =>
              designationLower.includes(kw.keyword.trim().toLowerCase()),
            )
            .map((kw) => kw.id)
        : []
      const band = await resolveRateBand(allowanceId, matchedIds)
      assertAmountInBand(allowanceId, input.allowanceAmt, band)
    }
    return withPrisma(async () => {
      const row = await prisma.tbl_allowance_allocation.update({
        where: { id },
        data: {
          ...(input.allowanceId !== undefined ? { allowanceId } : {}),
          ...(input.allowanceAmt !== undefined
            ? { allowanceAmt: input.allowanceAmt }
            : {}),
          ...(input.effectiveDate !== undefined
            ? {
                effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
              }
            : {}),
          ...editStamps(userId, existing.workflowStatus),
        },
        include: {
          allowance: true,
          employee: { select: { name: true, firstname: true } },
        },
      })
      return mapAllocation(row)
    })
  },

  async remove(id: number): Promise<void> {
    const existing = await prisma.tbl_allowance_allocation.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new PersonnelNotFoundError('Allowance allocation not found')
    }
    assertCanDelete(existing.workflowStatus)
    await withPrisma(() =>
      prisma.tbl_allowance_allocation.delete({ where: { id } }),
    )
  },

  async validate(
    userId: number,
    id: number,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceAllocationOption> {
    const existing = await prisma.tbl_allowance_allocation.findUnique({
      where: { id },
      include: {
        allowance: true,
        employee: { select: { name: true, firstname: true } },
      },
    })
    if (!existing) {
      throw new PersonnelNotFoundError('Allowance allocation not found')
    }
    await assertCanValidate(existing, userId)
    const row = await prisma.$transaction(async (tx) => {
      await tx.tbl_allowance_allocation.updateMany({
        where: {
          matricule: existing.matricule,
          allowanceId: existing.allowanceId,
          current: true,
          NOT: { id },
        },
        data: { current: false, workflowStatus: 'SUPERSEDED' },
      })
      return tx.tbl_allowance_allocation.update({
        where: { id },
        data: {
          ...validateStamps(userId, review?.reviewNote),
          current: true,
        },
        include: {
          allowance: true,
          employee: { select: { name: true, firstname: true } },
        },
      })
    })
    return mapAllocation(row)
  },

  async reject(
    userId: number,
    id: number,
    review?: WorkflowReviewInput,
  ): Promise<AllowanceAllocationOption> {
    const existing = await prisma.tbl_allowance_allocation.findUnique({
      where: { id },
      include: {
        allowance: true,
        employee: { select: { name: true, firstname: true } },
      },
    })
    if (!existing) {
      throw new PersonnelNotFoundError('Allowance allocation not found')
    }
    assertCanReject(existing.workflowStatus)
    const row = await prisma.tbl_allowance_allocation.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      include: {
        allowance: true,
        employee: { select: { name: true, firstname: true } },
      },
    })
    return mapAllocation(row)
  },
}

export async function searchAllowanceEmployees(
  q?: string,
): Promise<AllowanceEmployeeOption[]> {
  const search = q?.trim()
  const rows = await prisma.tbl_employee.findMany({
    where: {
      active: true,
      workflowStatus: { in: ['VALIDATED', 'PENDING'] },
      ...(search
        ? {
            OR: [
              { matricule: { contains: search } },
              { name: { contains: search } },
              { firstname: { contains: search } },
            ],
          }
        : {}),
    },
    select: {
      matricule: true,
      name: true,
      firstname: true,
      workflowStatus: true,
    },
    orderBy: [{ name: 'asc' }, { matricule: 'asc' }],
    take: 40,
  })

  rows.sort((a, b) => {
    if (a.workflowStatus === b.workflowStatus) return 0
    return a.workflowStatus === 'VALIDATED' ? -1 : 1
  })

  const top = rows.slice(0, 25)
  const liveByMatric = await resolveLiveEmployees(
    top.map((row) => row.matricule),
  )

  return top.map((row) => {
    const live = liveByMatric.get(row.matricule)
    return {
      matricule: row.matricule,
      name: live?.names?.trim() || formatEmployeeName(row.name, row.firstname),
      designation: live?.designation?.trim() || null,
    }
  })
}
