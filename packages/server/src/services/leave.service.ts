import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma } from '@prisma/client'
import { parseCatEchCode } from '@personel-management-app/shared'
import type {
  LeaveEntitlementCreateInput,
  LeaveEntitlementUpdateInput,
  LeaveLetterSettingInput,
  LeaveMonthlyRateCreateInput,
  LeaveMonthlyRateUpdateInput,
  LeavePolicyCreateInput,
  LeavePolicyUpdateInput,
  LeaveProcessInput,
  LeaveRequestCreateInput,
  LeaveRequestUpdateInput,
  LeaveResumptionCreateInput,
  LeaveSeniorityCreateInput,
  LeaveSeniorityUpdateInput,
  LeaveTravelAllowanceCreateInput,
  LeaveTravelAllowanceUpdateInput,
  LeaveTypeCreateInput,
  LeaveTypeUpdateInput,
  PublicHolidayCreateInput,
  PublicHolidayUpdateInput,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import type { ReviewInput } from './personnel.service.js'
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
import {
  buildLeaveMemoHtml,
  resumptionDate,
  roundUp,
  workingEndDate,
  type LeaveMemoModel,
} from './leave-memo.js'
import { resolveDecisionSignatory } from './decision.service.js'
import { resolveSectionThroTitle } from './section-thro.service.js'

const attachmentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/leave-attachments',
)
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const requestInclude = {
  leaveType: true,
  attachments: { orderBy: { id: 'asc' as const } },
  calculations: { orderBy: { calculatedAt: 'desc' as const } },
  grants: true,
  resumptions: { orderBy: { id: 'desc' as const } },
  memo: true,
} satisfies Prisma.tbl_leave_requestInclude

type RequestRow = Prisma.tbl_leave_requestGetPayload<{
  include: typeof requestInclude
}>

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

function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null
  return Number(value)
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

function effectiveOn(on: Date) {
  return {
    active: true,
    effectiveFrom: { lte: on },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
  }
}

function completedYears(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear()
  const month = end.getUTCMonth() - start.getUTCMonth()
  if (month < 0 || (month === 0 && end.getUTCDate() < start.getUTCDate())) {
    years -= 1
  }
  return Math.max(0, years)
}

function completedMonths(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(0, months)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const HOLIDAY_DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function assertHolidayDay(month: number, day: number) {
  if (day < 1 || day > (HOLIDAY_DAYS_IN_MONTH[month] ?? 0)) {
    throw new PersonnelWorkflowError(
      'That day does not exist in the selected month',
      400,
    )
  }
}

function money(value: Prisma.Decimal, places: number): Prisma.Decimal {
  return value.toDecimalPlaces(places)
}

function mapAttachment(row: RequestRow['attachments'][number]) {
  return {
    id: row.id,
    leaveRequestId: row.leaveRequestId,
    originalName: row.originalName,
    uploadedAt: row.uploadedAt,
    uploadedById: row.uploadedById,
  }
}

function mapCalculation(row: RequestRow['calculations'][number]) {
  return {
    id: row.id,
    matricule: row.matricule,
    leaveRequestId: row.leaveRequestId,
    policyId: row.policyId,
    accrualStartDate: row.accrualStartDate,
    accrualEndDate: row.accrualEndDate,
    serviceYears: num(row.serviceYears),
    eligibleMonths: num(row.eligibleMonths),
    basicDays: num(row.basicDays),
    seniorityDays: num(row.seniorityDays),
    monthlyAccrual: num(row.monthlyAccrual),
    entitledDays: num(row.entitledDays),
    calculatedAt: row.calculatedAt,
  }
}

function mapRequest(row: RequestRow) {
  return {
    id: row.id,
    leaveRef: row.leaveRef,
    matricule: row.matricule,
    leaveTypeId: row.leaveTypeId,
    leaveType: row.leaveType,
    applicationDate: row.applicationDate,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
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
    calculations: row.calculations.map(mapCalculation),
    grant: row.grants[0]
      ? {
          ...row.grants[0],
          grantedDays: num(row.grants[0].grantedDays),
        }
      : null,
    resumptions: row.resumptions,
    memo: row.memo
      ? { id: row.memo.id, template: row.memo.template, memoRef: row.memo.memoRef }
      : null,
  }
}

function mapRuleDates<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  row: T,
) {
  return row
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
  if (!employee) {
    throw new PersonnelNotFoundError(
      `No employee found for matricule ${matricule}`,
    )
  }
}

export const leaveSetupService = {
  types: {
    list: () => prisma.tbl_leave_type.findMany({ orderBy: { code: 'asc' } }),
    async create(input: LeaveTypeCreateInput) {
      return withPrisma(() =>
        prisma.tbl_leave_type.create({
          data: {
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            requireAttachment: input.requireAttachment ?? false,
            carryForwardAllowed: input.carryForwardAllowed ?? false,
            active: input.active ?? true,
          },
        }),
      )
    },
    async update(id: number, input: LeaveTypeUpdateInput) {
      return withPrisma(() =>
        prisma.tbl_leave_type.update({
          where: { id },
          data: {
            ...(input.code !== undefined
              ? { code: input.code.trim().toUpperCase() }
              : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.requireAttachment !== undefined
              ? { requireAttachment: input.requireAttachment }
              : {}),
            ...(input.carryForwardAllowed !== undefined
              ? { carryForwardAllowed: input.carryForwardAllowed }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        }),
      )
    },
  },
  policies: {
    list: () =>
      prisma.tbl_leave_calculation_policy.findMany({
        orderBy: { effectiveFrom: 'desc' },
      }),
    async create(input: LeavePolicyCreateInput) {
      return withPrisma(() =>
        prisma.tbl_leave_calculation_policy.create({
          data: {
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            method: input.method,
            effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
            effectiveTo: parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
            active: input.active ?? false,
            description: blankToNull(input.description),
          },
        }),
      )
    },
    async update(id: number, input: LeavePolicyUpdateInput) {
      return withPrisma(() =>
        prisma.tbl_leave_calculation_policy.update({
          where: { id },
          data: {
            ...(input.code !== undefined
              ? { code: input.code.trim().toUpperCase() }
              : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.method !== undefined ? { method: input.method } : {}),
            ...(input.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
                }
              : {}),
            ...(input.effectiveTo !== undefined
              ? {
                  effectiveTo:
                    parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
                }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.description !== undefined
              ? { description: blankToNull(input.description) }
              : {}),
          },
        }),
      )
    },
  },
  entitlements: {
    async list() {
      const rows = await prisma.tbl_leave_entitlement_rule.findMany({
        orderBy: { effectiveFrom: 'desc' },
      })
      return rows.map((row) => ({ ...mapRuleDates(row), annualDays: num(row.annualDays) }))
    },
    async create(input: LeaveEntitlementCreateInput) {
      const row = await withPrisma(() =>
        prisma.tbl_leave_entitlement_rule.create({
          data: {
            annualDays: input.annualDays,
            effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
            effectiveTo: parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
            active: input.active ?? true,
            notes: blankToNull(input.notes),
          },
        }),
      )
      return { ...row, annualDays: num(row.annualDays) }
    },
    async update(id: number, input: LeaveEntitlementUpdateInput) {
      const row = await withPrisma(() =>
        prisma.tbl_leave_entitlement_rule.update({
          where: { id },
          data: {
            ...(input.annualDays !== undefined
              ? { annualDays: input.annualDays }
              : {}),
            ...(input.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
                }
              : {}),
            ...(input.effectiveTo !== undefined
              ? {
                  effectiveTo:
                    parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
                }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.notes !== undefined
              ? { notes: blankToNull(input.notes) }
              : {}),
          },
        }),
      )
      return { ...row, annualDays: num(row.annualDays) }
    },
  },
  monthlyRates: {
    async list() {
      const rows = await prisma.tbl_leave_monthly_rate_rule.findMany({
        orderBy: { effectiveFrom: 'desc' },
      })
      return rows.map((row) => ({
        ...row,
        monthlyDays: num(row.monthlyDays),
      }))
    },
    async create(input: LeaveMonthlyRateCreateInput) {
      const row = await withPrisma(() =>
        prisma.tbl_leave_monthly_rate_rule.create({
          data: {
            monthlyDays: input.monthlyDays,
            effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
            effectiveTo: parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
            active: input.active ?? true,
            notes: blankToNull(input.notes),
          },
        }),
      )
      return { ...row, monthlyDays: num(row.monthlyDays) }
    },
    async update(id: number, input: LeaveMonthlyRateUpdateInput) {
      const row = await withPrisma(() =>
        prisma.tbl_leave_monthly_rate_rule.update({
          where: { id },
          data: {
            ...(input.monthlyDays !== undefined
              ? { monthlyDays: input.monthlyDays }
              : {}),
            ...(input.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
                }
              : {}),
            ...(input.effectiveTo !== undefined
              ? {
                  effectiveTo:
                    parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
                }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.notes !== undefined
              ? { notes: blankToNull(input.notes) }
              : {}),
          },
        }),
      )
      return { ...row, monthlyDays: num(row.monthlyDays) }
    },
  },
  seniority: {
    async list() {
      const rows = await prisma.tbl_leave_seniority_rule.findMany({
        orderBy: [{ minYears: 'asc' }],
      })
      return rows.map((row) => ({ ...row, bonusDays: num(row.bonusDays) }))
    },
    async create(input: LeaveSeniorityCreateInput) {
      if (
        input.maxYears != null &&
        input.maxYears < input.minYears
      ) {
        throw new PersonnelWorkflowError(
          'Maximum years cannot be below minimum years',
          400,
        )
      }
      const row = await withPrisma(() =>
        prisma.tbl_leave_seniority_rule.create({
          data: {
            minYears: input.minYears,
            maxYears: input.maxYears ?? null,
            bonusDays: input.bonusDays,
            effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
            effectiveTo: parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
            active: input.active ?? true,
          },
        }),
      )
      return { ...row, bonusDays: num(row.bonusDays) }
    },
    async update(id: number, input: LeaveSeniorityUpdateInput) {
      const row = await withPrisma(() =>
        prisma.tbl_leave_seniority_rule.update({
          where: { id },
          data: {
            ...(input.minYears !== undefined ? { minYears: input.minYears } : {}),
            ...(input.maxYears !== undefined
              ? { maxYears: input.maxYears }
              : {}),
            ...(input.bonusDays !== undefined
              ? { bonusDays: input.bonusDays }
              : {}),
            ...(input.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
                }
              : {}),
            ...(input.effectiveTo !== undefined
              ? {
                  effectiveTo:
                    parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
                }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        }),
      )
      return { ...row, bonusDays: num(row.bonusDays) }
    },
  },
  travelAllowances: {
    async list() {
      return prisma.tbl_leave_travel_allowance.findMany({
        orderBy: [{ minCategory: 'asc' }, { effectiveFrom: 'desc' }],
      })
    },
    async create(input: LeaveTravelAllowanceCreateInput) {
      if (input.maxCategory < input.minCategory) {
        throw new PersonnelWorkflowError(
          'Maximum category cannot be below the minimum category',
          400,
        )
      }
      return withPrisma(() =>
        prisma.tbl_leave_travel_allowance.create({
          data: {
            minCategory: input.minCategory,
            maxCategory: input.maxCategory,
            amount: input.amount,
            effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
            effectiveTo: parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
            active: input.active ?? true,
          },
        }),
      )
    },
    async update(id: number, input: LeaveTravelAllowanceUpdateInput) {
      const existing = await prisma.tbl_leave_travel_allowance.findUnique({
        where: { id },
      })
      if (!existing) throw new PersonnelNotFoundError('Leave travel allowance not found')
      const minCategory = input.minCategory ?? existing.minCategory
      const maxCategory = input.maxCategory ?? existing.maxCategory
      if (maxCategory < minCategory) {
        throw new PersonnelWorkflowError(
          'Maximum category cannot be below the minimum category',
          400,
        )
      }
      return withPrisma(() =>
        prisma.tbl_leave_travel_allowance.update({
          where: { id },
          data: {
            ...(input.minCategory !== undefined
              ? { minCategory: input.minCategory }
              : {}),
            ...(input.maxCategory !== undefined
              ? { maxCategory: input.maxCategory }
              : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.effectiveFrom !== undefined
              ? {
                  effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom'),
                }
              : {}),
            ...(input.effectiveTo !== undefined
              ? {
                  effectiveTo:
                    parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null,
                }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        }),
      )
    },
  },
  holidays: {
    async list() {
      return prisma.tbl_public_holiday.findMany({
        orderBy: [{ month: 'asc' }, { day: 'asc' }],
      })
    },
    async create(input: PublicHolidayCreateInput) {
      assertHolidayDay(input.month, input.day)
      return withPrisma(() =>
        prisma.tbl_public_holiday.create({
          data: {
            month: input.month,
            day: input.day,
            name: input.name.trim(),
            active: input.active ?? true,
          },
        }),
      )
    },
    async update(id: number, input: PublicHolidayUpdateInput) {
      const existing = await prisma.tbl_public_holiday.findUnique({ where: { id } })
      if (!existing) throw new PersonnelNotFoundError('Public holiday not found')
      const month = input.month ?? existing.month
      const day = input.day ?? existing.day
      assertHolidayDay(month, day)
      return withPrisma(() =>
        prisma.tbl_public_holiday.update({
          where: { id },
          data: {
            ...(input.month !== undefined ? { month: input.month } : {}),
            ...(input.day !== undefined ? { day: input.day } : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        }),
      )
    },
    async remove(id: number) {
      await prisma.tbl_public_holiday.delete({ where: { id } })
      return { id }
    },
  },
  letterSettings: {
    async get() {
      return prisma.tbl_leave_letter_setting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      })
    },
    async update(input: LeaveLetterSettingInput) {
      return prisma.tbl_leave_letter_setting.upsert({
        where: { id: 1 },
        create: { id: 1, ...input },
        update: input,
      })
    },
  },
}

export const leaveRequestService = {
  async list(query: { matricule?: string; matricules?: string[] | null }) {
    const rows = await prisma.tbl_leave_request.findMany({
      where: {
        ...(query.matricule ? { matricule: query.matricule } : {}),
        ...(query.matricules
          ? { matricule: { in: query.matricules } }
          : {}),
      },
      include: requestInclude,
      orderBy: [{ applicationDate: 'desc' }, { id: 'desc' }],
    })
    return rows.map(mapRequest)
  },
  async get(id: number) {
    const row = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: requestInclude,
    })
    if (!row) throw new PersonnelNotFoundError('Leave request not found')
    return mapRequest(row)
  },
  async create(userId: number, input: LeaveRequestCreateInput) {
    await requireEmployee(input.matricule)
    const leaveType = await prisma.tbl_leave_type.findUnique({
      where: { id: input.leaveTypeId },
    })
    if (!leaveType || !leaveType.active) {
      throw new PersonnelWorkflowError('Unknown leave type', 400)
    }
    return withPrisma(async () => {
      const row = await prisma.tbl_leave_request.create({
        data: {
          matricule: input.matricule,
          leaveTypeId: input.leaveTypeId,
          applicationDate: parseDate(input.applicationDate, 'applicationDate'),
          startDate: parseDate(input.startDate, 'startDate'),
          reason: blankToNull(input.reason),
          current: false,
          ...pendingCreateStamps(userId),
        },
        include: requestInclude,
      })
      return mapRequest(row)
    })
  },
  async update(userId: number, id: number, input: LeaveRequestUpdateInput) {
    const existing = await prisma.tbl_leave_request.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Leave request not found')
    await assertCanEdit(userId, existing.workflowStatus)
    return withPrisma(async () => {
      const row = await prisma.tbl_leave_request.update({
        where: { id },
        data: {
          ...(input.leaveTypeId !== undefined
            ? { leaveTypeId: input.leaveTypeId }
            : {}),
          ...(input.applicationDate !== undefined
            ? {
                applicationDate: parseDate(
                  input.applicationDate,
                  'applicationDate',
                ),
              }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: parseDate(input.startDate, 'startDate') }
            : {}),
          ...(input.reason !== undefined
            ? { reason: blankToNull(input.reason) }
            : {}),
          ...editStamps(userId, existing.workflowStatus),
        },
        include: requestInclude,
      })
      return mapRequest(row)
    })
  },
  async calculate(id: number) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: { calculations: { where: { grant: null } } },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
    if (
      request.workflowStatus !== 'PENDING' &&
      request.workflowStatus !== 'REJECTED'
    ) {
      throw new PersonnelWorkflowError(
        'Leave can be calculated only while the request is pending or rejected',
        409,
      )
    }
    const employment = await prisma.tbl_emp_employment.findFirst({
      where: {
        matricule: request.matricule,
        current: true,
        workflowStatus: 'VALIDATED',
      },
      select: { dateEng: true },
    })
    if (!employment) {
      throw new PersonnelWorkflowError(
        'This employee has no validated engagement date',
        400,
      )
    }
    const applicationDate = request.applicationDate
    const history = await prisma.tbl_employee_leave_history.findFirst({
      where: { matricule: request.matricule },
      orderBy: { leaveEndDate: 'desc' },
      select: { leaveEndDate: true },
    })
    const accrualStart = history?.leaveEndDate ?? employment.dateEng
    if (applicationDate < accrualStart) {
      throw new PersonnelWorkflowError(
        'Application date is before the accrual start',
        400,
      )
    }
    const policy = await prisma.tbl_leave_calculation_policy.findFirst({
      where: effectiveOn(applicationDate),
      orderBy: { effectiveFrom: 'desc' },
    })
    if (!policy) {
      throw new PersonnelWorkflowError(
        'No active leave calculation policy covers the application date',
        400,
      )
    }
    const serviceYears = completedYears(employment.dateEng, applicationDate)
    const eligibleMonths = completedMonths(accrualStart, applicationDate)
    const seniority = await prisma.tbl_leave_seniority_rule.findFirst({
      where: {
        ...effectiveOn(applicationDate),
        minYears: { lte: serviceYears },
        OR: [{ maxYears: null }, { maxYears: { gte: serviceYears } }],
      },
      orderBy: { minYears: 'desc' },
    })
    if (!seniority) {
      throw new PersonnelWorkflowError(
        `No seniority rule covers ${serviceYears} years of service`,
        400,
      )
    }
    const seniorityDays = new Prisma.Decimal(seniority.bonusDays)
    let basicDays: Prisma.Decimal
    let monthlyAccrual: Prisma.Decimal
    if (policy.method === 'METHOD_1') {
      const entitlement = await prisma.tbl_leave_entitlement_rule.findFirst({
        where: effectiveOn(applicationDate),
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!entitlement) {
        throw new PersonnelWorkflowError(
          'No entitlement rule covers the application date',
          400,
        )
      }
      basicDays = new Prisma.Decimal(entitlement.annualDays)
      const annual = basicDays.plus(seniorityDays)
      monthlyAccrual = annual.div(12)
    } else {
      const rate = await prisma.tbl_leave_monthly_rate_rule.findFirst({
        where: effectiveOn(applicationDate),
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!rate) {
        throw new PersonnelWorkflowError(
          'No monthly rate covers the application date',
          400,
        )
      }
      const monthlyRate = new Prisma.Decimal(rate.monthlyDays)
      basicDays = monthlyRate.mul(12)
      monthlyAccrual = monthlyRate.plus(seniorityDays.div(12))
    }
    const entitledDays = monthlyAccrual.mul(eligibleMonths)
    if (request.calculations.length > 0) {
      await prisma.tbl_leave_calculation.deleteMany({
        where: { id: { in: request.calculations.map((row) => row.id) } },
      })
    }
    await prisma.tbl_leave_calculation.create({
      data: {
        matricule: request.matricule,
        leaveRequestId: request.id,
        policyId: policy.id,
        accrualStartDate: accrualStart,
        accrualEndDate: applicationDate,
        serviceYears,
        eligibleMonths,
        basicDays: money(basicDays, 2),
        seniorityDays: money(seniorityDays, 2),
        monthlyAccrual: money(monthlyAccrual, 4),
        entitledDays: entitledDays.ceil(),
      },
    })
    return this.get(id)
  },
  async validate(userId: number, id: number, input: LeaveProcessInput) {
    const row = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: {
        leaveType: true,
        attachments: true,
        calculations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    })
    if (!row) throw new PersonnelNotFoundError('Leave request not found')
    await assertCanValidate(row, userId)
    if (row.leaveType.requireAttachment && row.attachments.length === 0) {
      throw new PersonnelWorkflowError(
        'This leave type requires a document before it can be validated',
        409,
      )
    }
    const snapshot = row.calculations[0]
    if (!snapshot) {
      throw new PersonnelWorkflowError(
        'Calculate leave before validating the request',
        409,
      )
    }
    const entitledDays = roundUp(Number(snapshot.entitledDays))
    if (entitledDays < 1) {
      throw new PersonnelWorkflowError(
        'Leave due rounds to no working days',
        400,
      )
    }
    await prisma.$transaction(async (tx) => {
      const prepared = await prepareLeaveMemo(tx, {
        matricule: row.matricule,
        entitledDays,
        startDate: row.startDate,
        accrualStartDate: snapshot.accrualStartDate,
        accrualEndDate: snapshot.accrualEndDate,
        memoRef: input.memoRef.trim(),
      })
      if (prepared.permissionDays > 0) {
        await tx.tbl_permission_account.update({
          where: { matricule: row.matricule },
          data: { balanceDays: { decrement: prepared.permissionDays } },
        })
        await tx.tbl_permission_ledger.create({
          data: {
            matricule: row.matricule,
            days: prepared.permissionDays,
            kind: 'DEBIT',
            leaveRequestId: id,
            note: 'Deducted when leave was processed',
            createdById: userId,
          },
        })
      }
      await tx.tbl_leave_request.updateMany({
        where: {
          matricule: row.matricule,
          leaveTypeId: row.leaveTypeId,
          current: true,
          NOT: { id },
        },
        data: { current: false, workflowStatus: 'SUPERSEDED' },
      })
      await tx.tbl_leave_request.update({
        where: { id },
        data: {
          ...validateStamps(userId, input.reviewNote),
          current: true,
          endDate: prepared.endDate,
        },
      })
      const grant = await tx.tbl_leave_grant.create({
        data: {
          leaveRequestId: id,
          calculationId: snapshot.id,
          grantedDays: prepared.netDays,
          leaveStartDate: row.startDate,
          leaveEndDate: prepared.endDate,
          expectedReturnDate: prepared.resumeDate,
          grantedById: userId,
        },
      })
      await tx.tbl_employee_leave_history.create({
        data: {
          matricule: row.matricule,
          leaveGrantId: grant.id,
          leaveStartDate: row.startDate,
          leaveEndDate: prepared.endDate,
          daysGranted: prepared.netDays,
        },
      })
      await tx.tbl_leave_memo.create({
        data: {
          leaveRequestId: id,
          template: prepared.template,
          memoRef: prepared.memoRef,
          memoDate: prepared.memoDate,
          entitledDays: prepared.entitledDays,
          permissionDays: prepared.permissionDays,
          netDays: prepared.netDays,
          travelAllowance: prepared.travelAllowance,
          accrualStartDate: prepared.accrualStartDate,
          accrualEndDate: prepared.accrualEndDate,
          employeeName: prepared.employeeName,
          designation: prepared.designation,
          fromTitle: prepared.fromTitle,
          throTitle: prepared.throTitle,
          signatoryPreface: prepared.signatoryPreface,
          signatoryName: prepared.signatoryName,
          signatoryTitle: prepared.signatoryTitle,
          ccText: prepared.ccText,
          html: prepared.html,
        },
      })
    })
    return this.get(id)
  },
  async memo(id: number) {
    const memo = await prisma.tbl_leave_memo.findUnique({
      where: { leaveRequestId: id },
    })
    if (!memo) throw new PersonnelNotFoundError('Leave memo has not been generated')
    return { html: memo.html, title: memo.template === 'CATEGORY_9' ? 'Annual leave' : 'Approval of leave' }
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_leave_request.findUnique({ where: { id } })
    if (!row) throw new PersonnelNotFoundError('Leave request not found')
    assertCanReject(row.workflowStatus)
    await prisma.tbl_leave_request.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
    return this.get(id)
  },
  async addAttachment(userId: number, requestId: number, file: File) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id: requestId },
      select: { workflowStatus: true },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
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
      const row = await prisma.tbl_leave_attachment.create({
        data: {
          leaveRequestId: requestId,
          fileName,
          originalName: originalName || 'document',
          filePath: fileName,
          uploadedById: userId,
        },
      })
      return mapAttachment(row)
    } catch (error) {
      await unlink(storedPath(fileName)).catch(() => undefined)
      mapPrismaError(error)
    }
  },
  async readAttachment(requestId: number, attachmentId: number) {
    const row = await prisma.tbl_leave_attachment.findFirst({
      where: { id: attachmentId, leaveRequestId: requestId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    const bytes = await readFile(storedPath(row.filePath)).catch(() => null)
    if (!bytes) throw new PersonnelNotFoundError('Document file is missing')
    return { originalName: row.originalName, bytes }
  },
  async removeAttachment(requestId: number, attachmentId: number) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id: requestId },
      select: { workflowStatus: true },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
    if (
      request.workflowStatus !== 'PENDING' &&
      request.workflowStatus !== 'REJECTED'
    ) {
      throw new PersonnelWorkflowError(
        'Documents can be changed only while the request is pending or rejected',
        409,
      )
    }
    const row = await prisma.tbl_leave_attachment.findFirst({
      where: { id: attachmentId, leaveRequestId: requestId },
    })
    if (!row) throw new PersonnelNotFoundError('Document not found')
    await prisma.tbl_leave_attachment.delete({ where: { id: attachmentId } })
    await unlink(storedPath(row.filePath)).catch(() => undefined)
    return { id: attachmentId }
  },
  async history(matricule: string) {
    const rows = await prisma.tbl_employee_leave_history.findMany({
      where: { matricule },
      orderBy: { leaveEndDate: 'desc' },
      include: { leaveGrant: { include: { leaveRequest: { include: { leaveType: true } } } } },
    })
    return rows.map((row) => ({
      id: row.id,
      matricule: row.matricule,
      leaveGrantId: row.leaveGrantId,
      leaveStartDate: row.leaveStartDate,
      leaveEndDate: row.leaveEndDate,
      resumedDate: row.resumedDate,
      daysGranted: num(row.daysGranted),
      leaveType: row.leaveGrant.leaveRequest.leaveType.name,
      leaveRequestId: row.leaveGrant.leaveRequestId,
      expectedReturnDate: row.leaveGrant.expectedReturnDate,
    }))
  },
  async resume(
    userId: number,
    requestId: number,
    input: LeaveResumptionCreateInput,
  ) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id: requestId },
      include: { grants: { include: { history: true } } },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
    const grant = request.grants[0]
    if (!grant?.history) {
      throw new PersonnelWorkflowError(
        'A leave grant is required before resumption',
        409,
      )
    }
    if (grant.history.resumedDate) {
      throw new PersonnelWorkflowError('This leave has already been resumed', 409)
    }
    const actualReturnDate = parseDate(input.actualReturnDate, 'actualReturnDate')
    await prisma.$transaction(async (tx) => {
      await tx.tbl_employee_leave_history.update({
        where: { id: grant.history!.id },
        data: { resumedDate: actualReturnDate },
      })
      await tx.tbl_leave_resumption.create({
        data: {
          matricule: request.matricule,
          leaveRequestId: requestId,
          actualReturnDate,
          remarks: blankToNull(input.remarks),
          resumedById: userId,
        },
      })
    })
    return this.get(requestId)
  },
}

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

async function prepareLeaveMemo(
  tx: Prisma.TransactionClient,
  input: {
    matricule: string
    entitledDays: number
    startDate: Date
    accrualStartDate: Date
    accrualEndDate: Date
    memoRef: string
  },
): Promise<LeaveMemoModel & { html: string }> {
  const account = await tx.tbl_permission_account.findUnique({
    where: { matricule: input.matricule },
    select: { balanceDays: true },
  })
  const balance = account?.balanceDays ?? 0
  const permissionDays = Math.min(balance, input.entitledDays)
  const netDays = input.entitledDays - permissionDays
  if (netDays < 1) {
    throw new PersonnelWorkflowError(
      'Permission days cover the whole leave due. Nothing is left to grant',
      400,
    )
  }
  const [employee, classification, movement, employment, holidays, settings, placement] =
    await Promise.all([
      tx.tbl_employee.findUnique({
        where: { matricule: input.matricule },
        select: { name: true, firstname: true, sex: true, currentUnitId: true },
      }),
      tx.tbl_emp_class.findFirst({
        where: {
          matricule: input.matricule,
          current: true,
          workflowStatus: 'VALIDATED',
        },
        select: { category: true },
      }),
      tx.tbl_emp_movement.findFirst({
        where: {
          matricule: input.matricule,
          workflowStatus: 'VALIDATED',
        },
        orderBy: [{ Eff_date: 'desc' }, { id: 'desc' }],
        select: { Position: true },
      }),
      tx.tbl_emp_employment.findFirst({
        where: {
          matricule: input.matricule,
          current: true,
          workflowStatus: 'VALIDATED',
        },
        select: { jobEng: true },
      }),
      tx.tbl_public_holiday.findMany({
        where: { active: true },
        select: { month: true, day: true },
      }),
      tx.tbl_leave_letter_setting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      }),
      tx.tbl_employee
        .findUnique({
          where: { matricule: input.matricule },
          select: { currentUnitId: true },
        })
        .then(async (row) => {
          if (!row?.currentUnitId) {
            return {
              unitId: null as string | null,
              groupId: null as string | null,
              sectionId: null as number | null,
            }
          }
          const [unit, section] = await Promise.all([
            tx.tbl_unit.findUnique({
              where: { id: row.currentUnitId },
              select: { groupid: true },
            }),
            tx.tbl_section.findFirst({
              where: { tbl_unit_id: row.currentUnitId },
              orderBy: { id: 'asc' },
              select: { id: true },
            }),
          ])
          return {
            unitId: row.currentUnitId,
            groupId: unit?.groupid ?? null,
            sectionId: section?.id ?? null,
          }
        }),
    ])
  if (!employee) throw new PersonnelNotFoundError('Employee not found')
  const category = classification
    ? parseCatEchCode(classification.category).catNum
    : 0
  const category9 = category >= 9
  const endDate = workingEndDate(
    input.startDate,
    netDays,
    holidays,
    settings.saturdayWorking,
  )
  const resumeDate = resumptionDate(endDate, category9)
  const designation = movement?.Position?.trim() || employment?.jobEng?.trim() || null
  const fullName = [employee.firstname, employee.name].filter(Boolean).join(' ')
  const titled =
    employee.sex === 'Female'
      ? `Mme. ${fullName}`
      : employee.sex === 'Male'
        ? `Mr. ${fullName}`
        : fullName
  const template: LeaveMemoModel['template'] = category9
    ? 'CATEGORY_9'
    : permissionDays > 0
      ? 'BELOW_PERMISSION'
      : 'BELOW_NONE'
  const memoDate = todayUtc()
  const travel = await tx.tbl_leave_travel_allowance.findFirst({
    where: {
      ...effectiveOn(memoDate),
      minCategory: { lte: category },
      maxCategory: { gte: category },
    },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (!travel) {
    throw new PersonnelWorkflowError(
      `No leave travel allowance covers category ${category}`,
      400,
    )
  }
  const signatory = await resolveDecisionSignatory({
    category,
    unitId: placement.unitId,
    groupId: placement.groupId,
    asOf: memoDate,
  })
  const fromTitle = (signatory?.title ?? 'ESTATE MANAGER').toUpperCase()
  const throTitle = await resolveSectionThroTitle({
    sectionId: placement.sectionId,
    asOf: memoDate,
  })
  const model: LeaveMemoModel = {
    template,
    memoRef: input.memoRef,
    memoDate,
    entitledDays: input.entitledDays,
    permissionDays,
    netDays,
    travelAllowance: travel.amount,
    accrualStartDate: input.accrualStartDate,
    accrualEndDate: input.accrualEndDate,
    employeeName: titled,
    designation,
    matricule: input.matricule,
    startDate: input.startDate,
    endDate,
    resumeDate,
    fromTitle,
    throTitle,
    signatoryPreface: category9 ? null : settings.delegationPreface,
    signatoryName: category9 ? null : settings.delegationName,
    signatoryTitle: category9 ? settings.signCategory9 : settings.delegationTitle,
    ccText: category9 ? settings.ccCategory9 : settings.ccBelow,
  }
  return { ...model, html: buildLeaveMemoHtml(model) }
}
