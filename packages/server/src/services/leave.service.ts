import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma } from '@prisma/client'
import {
  isAnnualLeaveType,
  leaveMemoFileRef,
  parseCatEchCode,
} from '@personel-management-app/shared'
import type {
  LeaveEntitlementCreateInput,
  LeaveEntitlementUpdateInput,
  LeaveLetterSettingInput,
  LeaveMotherSettingInput,
  LeaveMonthlyRateCreateInput,
  LeaveMonthlyRateUpdateInput,
  LeavePolicyCreateInput,
  LeavePolicyUpdateInput,
  LeaveAccrualAdjustInput,
  LeaveProcessInput,
  LeaveRequestCreateInput,
  LeaveRequestUpdateInput,
  LeaveResumptionCreateInput,
  LeaveSeniorityCreateInput,
  LeaveSeniorityUpdateInput,
  LeaveTravelAllowanceCreateInput,
  LeaveTravelAllowanceUpdateInput,
  PermissionDurationCreateInput,
  PermissionDurationUpdateInput,
  LeaveDocumentRequirementReplaceInput,
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
import { buildLeaveCalculationReportHtml } from './leave-calculation-report.js'
import {
  addUtcDays,
  buildLeaveMemoHtml,
  lastWorkingDayBefore,
  resumptionDate,
  roundUp,
  workingEndDate,
  type LeaveMemoModel,
} from './leave-memo.js'
import { resolveOfficialMemoSignatory } from './official-memo.service.js'
import { resolveLiveEmployee } from './live-employee.service.js'
import { resolveMemoThroTitle } from './section-thro.service.js'

const attachmentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/leave-attachments',
)
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const requestInclude = {
  leaveType: {
    include: {
      documentRequirements: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
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

export function effectiveOn(on: Date) {
  return {
    active: true,
    effectiveFrom: { lte: on },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
  }
}

const OPEN_ENDED = new Date('9999-12-31T00:00:00.000Z')

function rangesOverlap(
  leftFrom: Date,
  leftTo: Date | null,
  rightFrom: Date,
  rightTo: Date | null,
) {
  const leftEnd = leftTo ?? OPEN_ENDED
  const rightEnd = rightTo ?? OPEN_ENDED
  return leftFrom.getTime() <= rightEnd.getTime() && rightFrom.getTime() <= leftEnd.getTime()
}

export async function resolvePermissionDuration(leaveTypeId: number, asOf: Date) {
  return prisma.tbl_permission_duration_rule.findFirst({
    where: { leaveTypeId, ...effectiveOn(asOf) },
    orderBy: { effectiveFrom: 'desc' },
  })
}

async function requirePaidPermissionType(leaveTypeId: number) {
  const type = await prisma.tbl_leave_type.findUnique({ where: { id: leaveTypeId } })
  if (!type || type.category !== 'PERMISSION' || !type.isPaid) {
    throw new PersonnelWorkflowError(
      'Eligible days apply only to a paid permission',
      400,
    )
  }
  return type
}

function assertDurationRange(effectiveFrom: Date, effectiveTo: Date | null) {
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new PersonnelWorkflowError(
      'The end date cannot be before the effective date',
      400,
    )
  }
}

async function assertDurationClear(
  leaveTypeId: number,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  exceptId?: number,
) {
  const rows = await prisma.tbl_permission_duration_rule.findMany({
    where: {
      leaveTypeId,
      ...(exceptId == null ? {} : { id: { not: exceptId } }),
    },
  })
  const clash = rows.find((row) =>
    rangesOverlap(effectiveFrom, effectiveTo, row.effectiveFrom, row.effectiveTo),
  )
  if (clash) {
    throw new PersonnelWorkflowError(
      'This period overlaps another eligible-days rule for the same permission',
      400,
    )
  }
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001
}

function figure(value: number): string {
  const rounded = Math.round(value * 10000) / 10000
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function completedYears(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear()
  const month = end.getUTCMonth() - start.getUTCMonth()
  if (month < 0 || (month === 0 && end.getUTCDate() < start.getUTCDate())) {
    years -= 1
  }
  return Math.max(0, years)
}

async function mothersLeaveFor(matricule: string, applicationDate: Date) {
  const [employee, settings] = await Promise.all([
    prisma.tbl_employee.findUnique({
      where: { matricule },
      select: { sex: true },
    }),
    prisma.tbl_leave_mother_setting.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
  ])
  if (
    employee?.sex !== 'Female' ||
    settings.daysPerChild <= 0 ||
    settings.maxAgeYears <= 0
  ) {
    return { qualifyingChildCount: 0, mothersLeaveDays: 0 }
  }
  const children = await prisma.tbl_emp_family_member.findMany({
    where: {
      matricule,
      relationship: 'CHILD',
      workflowStatus: 'VALIDATED',
      current: true,
    },
    select: { dateOfBirth: true },
  })
  const qualifyingChildCount = children.filter(
    (child) => completedYears(child.dateOfBirth, applicationDate) < settings.maxAgeYears,
  ).length
  return {
    qualifyingChildCount,
    mothersLeaveDays: settings.daysPerChild * qualifyingChildCount,
  }
}

export function completedMonths(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(0, months)
}

export function leaveAccrualStart(input: {
  resumedDate: Date | null
  dateEng: Date
}): Date {
  return input.resumedDate ?? input.dateEng
}

export function annualLeaveAccrual(input: {
  method: 'METHOD_1' | 'METHOD_2'
  annualDays: Prisma.Decimal | number | null
  monthlyDays: Prisma.Decimal | number | null
  seniorityBonusDays: Prisma.Decimal | number
  eligibleMonths: number
}): {
  basicDays: Prisma.Decimal
  seniorityDays: Prisma.Decimal
  monthlyAccrual: Prisma.Decimal
  earnedDays: Prisma.Decimal
} {
  const seniorityDays = new Prisma.Decimal(input.seniorityBonusDays)
  let basicDays: Prisma.Decimal
  let monthlyAccrual: Prisma.Decimal
  if (input.method === 'METHOD_1') {
    basicDays = new Prisma.Decimal(input.annualDays ?? 0)
    monthlyAccrual = basicDays.plus(seniorityDays).div(12)
  } else {
    const monthlyRate = new Prisma.Decimal(input.monthlyDays ?? 0)
    basicDays = monthlyRate.mul(12)
    monthlyAccrual = monthlyRate.plus(seniorityDays.div(12))
  }
  return {
    basicDays,
    seniorityDays,
    monthlyAccrual,
    earnedDays: monthlyAccrual.mul(input.eligibleMonths).ceil(),
  }
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
    requirementId: row.requirementId,
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
    qualifyingChildCount: row.qualifyingChildCount,
    mothersLeaveDays: row.mothersLeaveDays,
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
    suppliedResumedDate: row.suppliedResumedDate,
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

async function requireLeaveType(leaveTypeId: number) {
  const leaveType = await prisma.tbl_leave_type.findUnique({
    where: { id: leaveTypeId },
  })
  if (!leaveType || !leaveType.active) {
    throw new PersonnelWorkflowError('Unknown leave type', 400)
  }
  if (leaveType.category === 'PERMISSION') {
    throw new PersonnelWorkflowError(
      'Permission types are requested under Permission requests',
      400,
    )
  }
  return leaveType
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
    list: () =>
      prisma.tbl_leave_type.findMany({
        orderBy: { code: 'asc' },
        include: {
          documentRequirements: { orderBy: { sortOrder: 'asc' } },
          durationRules: { orderBy: { effectiveFrom: 'desc' } },
        },
      }),
    async create(input: LeaveTypeCreateInput) {
      return withPrisma(() =>
        prisma.tbl_leave_type.create({
          data: {
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            requireAttachment: input.requireAttachment ?? false,
            carryForwardAllowed: input.carryForwardAllowed ?? false,
            active: input.active ?? true,
            category: input.category ?? 'LEAVE',
            isPaid: input.isPaid ?? true,
            deductBalance: input.deductBalance ?? false,
            maxDays: input.maxDays ?? null,
            durationUnit: input.durationUnit ?? 'WORKING_DAYS',
            description: blankToNull(input.description),
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
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
            ...(input.deductBalance !== undefined
              ? { deductBalance: input.deductBalance }
              : {}),
            ...(input.maxDays !== undefined ? { maxDays: input.maxDays } : {}),
            ...(input.durationUnit !== undefined
              ? { durationUnit: input.durationUnit }
              : {}),
            ...(input.description !== undefined
              ? { description: blankToNull(input.description) }
              : {}),
          },
        }),
      )
    },
  },
  documentRequirements: {
    async replace(leaveTypeId: number, input: LeaveDocumentRequirementReplaceInput) {
      const type = await prisma.tbl_leave_type.findUnique({
        where: { id: leaveTypeId },
        select: { id: true },
      })
      if (!type) throw new PersonnelNotFoundError('Leave type not found')
      const names = input.names.map((name) => name.trim()).filter(Boolean)
      await prisma.$transaction(async (tx) => {
        const existing = await tx.tbl_leave_document_requirement.findMany({
          where: { leaveTypeId },
          orderBy: { sortOrder: 'asc' },
        })
        for (let index = 0; index < names.length; index += 1) {
          const row = existing[index]
          const name = names[index]!
          if (row) {
            await tx.tbl_leave_document_requirement.update({
              where: { id: row.id },
              data: { name, sortOrder: index },
            })
          } else {
            await tx.tbl_leave_document_requirement.create({
              data: { leaveTypeId, name, sortOrder: index },
            })
          }
        }
        const removed = existing.slice(names.length)
        if (removed.length > 0) {
          await tx.tbl_leave_document_requirement.deleteMany({
            where: { id: { in: removed.map((row) => row.id) } },
          })
        }
      })
      return prisma.tbl_leave_document_requirement.findMany({
        where: { leaveTypeId },
        orderBy: { sortOrder: 'asc' },
      })
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
  permissionDurations: {
    async list(leaveTypeId?: number) {
      return prisma.tbl_permission_duration_rule.findMany({
        where: leaveTypeId == null ? {} : { leaveTypeId },
        orderBy: [{ leaveTypeId: 'asc' }, { effectiveFrom: 'desc' }],
      })
    },
    async create(input: PermissionDurationCreateInput) {
      await requirePaidPermissionType(input.leaveTypeId)
      const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom')
      const effectiveTo = parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null
      assertDurationRange(effectiveFrom, effectiveTo)
      await assertDurationClear(input.leaveTypeId, effectiveFrom, effectiveTo)
      return withPrisma(() =>
        prisma.tbl_permission_duration_rule.create({
          data: {
            leaveTypeId: input.leaveTypeId,
            days: input.days,
            effectiveFrom,
            effectiveTo,
            active: input.active ?? true,
          },
        }),
      )
    },
    async update(id: number, input: PermissionDurationUpdateInput) {
      const existing = await prisma.tbl_permission_duration_rule.findUnique({
        where: { id },
      })
      if (!existing) {
        throw new PersonnelNotFoundError('Permission duration rule not found')
      }
      const effectiveFrom =
        input.effectiveFrom !== undefined
          ? parseDate(input.effectiveFrom, 'effectiveFrom')
          : existing.effectiveFrom
      const effectiveTo =
        input.effectiveTo !== undefined
          ? (parseOptionalDate(input.effectiveTo, 'effectiveTo') ?? null)
          : existing.effectiveTo
      assertDurationRange(effectiveFrom, effectiveTo)
      await assertDurationClear(existing.leaveTypeId, effectiveFrom, effectiveTo, id)
      return withPrisma(() =>
        prisma.tbl_permission_duration_rule.update({
          where: { id },
          data: {
            ...(input.days !== undefined ? { days: input.days } : {}),
            ...(input.effectiveFrom !== undefined ? { effectiveFrom } : {}),
            ...(input.effectiveTo !== undefined ? { effectiveTo } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        }),
      )
    },
    async remove(id: number) {
      const existing = await prisma.tbl_permission_duration_rule.findUnique({
        where: { id },
      })
      if (!existing) {
        throw new PersonnelNotFoundError('Permission duration rule not found')
      }
      await prisma.tbl_permission_duration_rule.delete({ where: { id } })
      return { id }
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
  motherSettings: {
    async get() {
      return prisma.tbl_leave_mother_setting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      })
    },
    async update(input: LeaveMotherSettingInput) {
      return prisma.tbl_leave_mother_setting.upsert({
        where: { id: 1 },
        create: { id: 1, ...input },
        update: input,
      })
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
  async absenceReport(query: { matricule?: string; matricules?: string[] | null }) {
    if (query.matricules && query.matricules.length === 0) return []
    const where = {
      ...(query.matricule ? { matricule: query.matricule } : {}),
      ...(query.matricules ? { matricule: { in: query.matricules } } : {}),
    }
    const [leaves, permissions] = await Promise.all([
      prisma.tbl_leave_request.findMany({
        where,
        include: { leaveType: true, grants: true },
        orderBy: [{ applicationDate: 'desc' }, { id: 'desc' }],
      }),
      prisma.tbl_permission_request.findMany({
        where,
        include: { leaveType: true },
        orderBy: [{ applicationDate: 'desc' }, { id: 'desc' }],
      }),
    ])
    const rows = [
      ...leaves.map((row) => {
        const granted = row.grants[0]?.grantedDays
        const days =
          granted != null
            ? Number(granted)
            : row.leaveType.deductBalance || row.leaveType.maxDays == null
              ? null
              : row.leaveType.durationUnit === 'CALENDAR_WEEKS'
                ? row.leaveType.maxDays * 7
                : row.leaveType.maxDays
        return {
          source: 'LEAVE' as const,
          id: row.id,
          matricule: row.matricule,
          typeName: row.leaveType.name,
          paid: row.leaveType.isPaid,
          applicationDate: row.applicationDate,
          startDate: row.startDate,
          endDate: row.endDate,
          days,
          status: row.workflowStatus,
        }
      }),
      ...permissions.map((row) => ({
        source: 'PERMISSION' as const,
        id: row.id,
        matricule: row.matricule,
        typeName: row.leaveType?.name ?? 'Permission',
        paid: row.leaveType?.isPaid ?? null,
        applicationDate: row.applicationDate,
        startDate: row.applicationDate,
        endDate: null,
        days: row.days,
        status: row.workflowStatus,
      })),
    ]
    rows.sort((left, right) => {
      const byDate = right.applicationDate.getTime() - left.applicationDate.getTime()
      if (byDate !== 0) return byDate
      return right.id - left.id
    })
    return rows
  },
  async create(userId: number, input: LeaveRequestCreateInput) {
    await requireEmployee(input.matricule)
    await requireLeaveType(input.leaveTypeId)
    const suppliedResumedDate = parseOptionalDate(
      input.suppliedResumedDate,
      'suppliedResumedDate',
    )
    return withPrisma(async () => {
      const row = await prisma.tbl_leave_request.create({
        data: {
          matricule: input.matricule,
          leaveTypeId: input.leaveTypeId,
          applicationDate: parseDate(input.applicationDate, 'applicationDate'),
          startDate: parseDate(input.startDate, 'startDate'),
          reason: blankToNull(input.reason),
          ...(suppliedResumedDate !== undefined ? { suppliedResumedDate } : {}),
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
    if (input.leaveTypeId !== undefined) {
      await requireLeaveType(input.leaveTypeId)
    }
    const suppliedResumedDate = parseOptionalDate(
      input.suppliedResumedDate,
      'suppliedResumedDate',
    )
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
          ...(suppliedResumedDate !== undefined ? { suppliedResumedDate } : {}),
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
    const leaveType = await prisma.tbl_leave_type.findUnique({
      where: { id: request.leaveTypeId },
      select: { deductBalance: true, name: true },
    })
    if (!isAnnualLeaveType(leaveType)) {
      throw new PersonnelWorkflowError(
        'This leave type has a fixed duration. Validate it without calculating annual leave.',
        409,
      )
    }
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
    const [historyResume, holidays, letterSettings] = await Promise.all([
      prisma.tbl_employee_leave_history.findFirst({
        where: { matricule: request.matricule, resumedDate: { not: null } },
        orderBy: { resumedDate: 'desc' },
        select: { resumedDate: true },
      }),
      prisma.tbl_public_holiday.findMany({
        where: { active: true },
        select: { month: true, day: true },
      }),
      prisma.tbl_leave_letter_setting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
        select: { saturdayWorking: true },
      }),
    ])
    let accrualEnd: Date
    try {
      accrualEnd = lastWorkingDayBefore(
        request.startDate,
        holidays,
        letterSettings.saturdayWorking,
      )
    } catch {
      throw new PersonnelWorkflowError(
        'Could not find a working day before the leave start date',
        400,
      )
    }
    const resumedForStart =
      historyResume?.resumedDate ?? request.suppliedResumedDate ?? null
    const accrualStart = leaveAccrualStart({
      resumedDate: resumedForStart,
      dateEng: employment.dateEng,
    })
    if (accrualEnd < accrualStart) {
      throw new PersonnelWorkflowError(
        'Accrual end is before the accrual start',
        400,
      )
    }
    const policy = await prisma.tbl_leave_calculation_policy.findFirst({
      where: effectiveOn(accrualEnd),
      orderBy: { effectiveFrom: 'desc' },
    })
    if (!policy) {
      throw new PersonnelWorkflowError(
        'No active leave calculation policy covers the accrual end date',
        400,
      )
    }
    const serviceYears = completedYears(employment.dateEng, accrualEnd)
    const eligibleMonths = completedMonths(accrualStart, accrualEnd)
    const seniority = await prisma.tbl_leave_seniority_rule.findFirst({
      where: {
        ...effectiveOn(accrualEnd),
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
    let annualDays: Prisma.Decimal | null = null
    let monthlyDays: Prisma.Decimal | null = null
    if (policy.method === 'METHOD_1') {
      const entitlement = await prisma.tbl_leave_entitlement_rule.findFirst({
        where: effectiveOn(accrualEnd),
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!entitlement) {
        throw new PersonnelWorkflowError(
          'No entitlement rule covers the accrual end date',
          400,
        )
      }
      annualDays = entitlement.annualDays
    } else {
      const rate = await prisma.tbl_leave_monthly_rate_rule.findFirst({
        where: effectiveOn(accrualEnd),
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!rate) {
        throw new PersonnelWorkflowError(
          'No monthly rate covers the accrual end date',
          400,
        )
      }
      monthlyDays = rate.monthlyDays
    }
    const accrual = annualLeaveAccrual({
      method: policy.method,
      annualDays,
      monthlyDays,
      seniorityBonusDays: seniority.bonusDays,
      eligibleMonths,
    })
    const mothersLeave = await mothersLeaveFor(request.matricule, accrualEnd)
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
        accrualEndDate: accrualEnd,
        serviceYears,
        eligibleMonths,
        basicDays: money(accrual.basicDays, 2),
        seniorityDays: money(accrual.seniorityDays, 2),
        monthlyAccrual: money(accrual.monthlyAccrual, 4),
        entitledDays: accrual.earnedDays,
        qualifyingChildCount: mothersLeave.qualifyingChildCount,
        mothersLeaveDays: mothersLeave.mothersLeaveDays,
      },
    })
    return this.get(id)
  },
  async validate(userId: number, id: number, input: LeaveProcessInput) {
    const row = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: {
        leaveType: {
          include: {
            documentRequirements: { orderBy: { sortOrder: 'asc' as const } },
          },
        },
        attachments: true,
        calculations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    })
    if (!row) throw new PersonnelNotFoundError('Leave request not found')
    await assertCanValidate(row, userId)
    const missingDocuments = row.leaveType.documentRequirements.filter(
      (requirement) =>
        !row.attachments.some((file) => file.requirementId === requirement.id),
    )
    if (missingDocuments.length > 0) {
      throw new PersonnelWorkflowError(
        `Attach the required documents: ${missingDocuments.map((requirement) => requirement.name).join(', ')}`,
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
    const earnedDays = roundUp(Number(snapshot.entitledDays))
    const mothersLeaveDays = snapshot.mothersLeaveDays
    const dueDays = earnedDays + mothersLeaveDays
    if (dueDays < 1) {
      throw new PersonnelWorkflowError(
        'Leave due rounds to no working days',
        400,
      )
    }
    await prisma.$transaction(async (tx) => {
      const prepared = await prepareLeaveMemo(tx, {
        matricule: row.matricule,
        earnedDays,
        mothersLeaveDays,
        qualifyingChildCount: snapshot.qualifyingChildCount,
        startDate: row.startDate,
        accrualStartDate: snapshot.accrualStartDate,
        accrualEndDate: snapshot.accrualEndDate,
        daysToGrant: input.daysToGrant,
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
          grantedDays: prepared.daysTakenNow,
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
          leaveTypeId: row.leaveTypeId,
          leaveStartDate: row.startDate,
          leaveEndDate: prepared.endDate,
          daysGranted: prepared.daysTakenNow,
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
          accruedLastTour: prepared.accruedLastTour,
          daysTakenNow: prepared.daysTakenNow,
          accruedThisTour: prepared.accruedThisTour,
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
          signerCategory: prepared.signerCategory,
          signerUnitId: prepared.signerUnitId,
          signerGroupId: prepared.signerGroupId,
          ccText: prepared.ccText,
          ccLayout: prepared.ccLayout,
          html: prepared.html,
        },
      })
      if (prepared.template === 'CATEGORY_9') {
        const delta = prepared.accruedThisTour - prepared.accruedLastTour
        await tx.tbl_leave_accrual_account.upsert({
          where: { matricule: row.matricule },
          create: {
            matricule: row.matricule,
            balanceDays: prepared.accruedThisTour,
          },
          update: { balanceDays: prepared.accruedThisTour },
        })
        await tx.tbl_leave_accrual_ledger.create({
          data: {
            matricule: row.matricule,
            days: Math.abs(delta),
            kind: delta >= 0 ? 'CREDIT' : 'DEBIT',
            leaveRequestId: id,
            note: `Last tour ${prepared.accruedLastTour}, accrued this tour ${prepared.accruedThisTour}`,
            createdById: userId,
          },
        })
      }
    })
    return this.get(id)
  },
  async memo(id: number) {
    const memo = await prisma.tbl_leave_memo.findUnique({
      where: { leaveRequestId: id },
      include: {
        leaveRequest: {
          include: {
            grants: { include: { calculation: true } },
          },
        },
      },
    })
    if (!memo) throw new PersonnelNotFoundError('Leave memo has not been generated')
    const grant = memo.leaveRequest.grants[0]
    const calculation = grant?.calculation
    const mothersLeaveDays = calculation?.mothersLeaveDays ?? 0
    const office =
      memo.signerCategory != null
        ? {
            category: memo.signerCategory,
            unitId: memo.signerUnitId,
            groupId: memo.signerGroupId,
          }
        : await leaveSignerOffice(prisma, memo.leaveRequest.matricule)
    const signer = await leaveMemoSigner({
      category: office.category,
      groupId: office.groupId,
      unitId: office.unitId,
      asOf: todayUtc(),
    })
    const template = leaveMemoTemplate(memo.template)
    const startDate = grant?.leaveStartDate ?? memo.leaveRequest.startDate
    const endDate = grant?.leaveEndDate ?? memo.leaveRequest.endDate ?? startDate
    const model: LeaveMemoModel = {
      template,
      memoRef: memo.memoRef,
      memoDate: memo.memoDate,
      earnedDays: Math.max(0, memo.entitledDays - mothersLeaveDays),
      mothersLeaveDays,
      qualifyingChildCount: calculation?.qualifyingChildCount ?? 0,
      entitledDays: memo.entitledDays,
      permissionDays: memo.permissionDays,
      netDays: memo.netDays,
      accruedLastTour: memo.accruedLastTour,
      daysTakenNow: memo.daysTakenNow,
      accruedThisTour: memo.accruedThisTour,
      travelAllowance: memo.travelAllowance,
      accrualStartDate: memo.accrualStartDate,
      accrualEndDate: memo.accrualEndDate,
      employeeName: memo.employeeName,
      unitName: null,
      designation: memo.designation,
      matricule: memo.leaveRequest.matricule,
      startDate,
      endDate,
      resumeDate: grant?.expectedReturnDate ?? endDate,
      fromTitle: signer.fromTitle,
      throTitle: await leaveThroTitle({
        matricule: memo.leaveRequest.matricule,
        asOf: todayUtc(),
      }),
      signatoryPreface: memo.signatoryPreface,
      signatoryName: signer.signatoryName,
      signatoryTitle: signer.signatoryTitle,
      ccText: memo.ccText,
      ccLayout: memo.ccLayout === 'ROW' ? 'ROW' : 'COLUMN',
    }
    return {
      html: buildLeaveMemoHtml(model),
      title: template === 'CATEGORY_9' ? 'Annual leave' : 'Approval of leave',
    }
  },
  async calculationReport(id: number) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: {
        leaveType: true,
        calculations: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          include: { policy: true },
        },
        memo: true,
      },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
    const snapshot = request.calculations[0]
    if (!snapshot) {
      throw new PersonnelNotFoundError('Leave has not been calculated')
    }
    const accrualEndDate = snapshot.accrualEndDate
    const [
      live,
      historyResume,
      employment,
      motherSetting,
      seniorityRules,
      entitlement,
      monthlyRate,
      permissionAccount,
      accrualAccount,
    ] = await Promise.all([
      resolveLiveEmployee(request.matricule),
      prisma.tbl_employee_leave_history.findFirst({
        where: { matricule: request.matricule, resumedDate: { not: null } },
        orderBy: { resumedDate: 'desc' },
        select: { resumedDate: true },
      }),
      prisma.tbl_emp_employment.findFirst({
        where: {
          matricule: request.matricule,
          current: true,
          workflowStatus: 'VALIDATED',
        },
        select: { dateEng: true },
      }),
      prisma.tbl_leave_mother_setting.findUnique({ where: { id: 1 } }),
      prisma.tbl_leave_seniority_rule.findMany({
        where: effectiveOn(accrualEndDate),
        orderBy: { minYears: 'desc' },
      }),
      prisma.tbl_leave_entitlement_rule.findFirst({
        where: effectiveOn(accrualEndDate),
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.tbl_leave_monthly_rate_rule.findFirst({
        where: effectiveOn(accrualEndDate),
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.tbl_permission_account.findUnique({
        where: { matricule: request.matricule },
        select: { balanceDays: true },
      }),
      prisma.tbl_leave_accrual_account.findUnique({
        where: { matricule: request.matricule },
        select: { balanceDays: true },
      }),
    ])
    const startKey = utcDay(snapshot.accrualStartDate)
    const accrualStartReason =
      historyResume?.resumedDate &&
      utcDay(historyResume.resumedDate) === startKey
        ? 'the last resumption date'
        : request.suppliedResumedDate &&
            utcDay(request.suppliedResumedDate) === startKey
          ? 'the resumption date entered on the request'
          : employment?.dateEng && utcDay(employment.dateEng) === startKey
            ? 'the engagement date'
            : 'the accrual start stored with this calculation'
    const serviceYears = Number(snapshot.serviceYears)
    const seniorityDays = Number(snapshot.seniorityDays)
    const basicDays = Number(snapshot.basicDays)
    const band = seniorityRules.find(
      (rule) =>
        rule.minYears <= serviceYears &&
        (rule.maxYears == null || rule.maxYears >= serviceYears) &&
        close(Number(rule.bonusDays), seniorityDays),
    )
    const seniorityBand = band
      ? band.maxYears == null
        ? `${band.minYears} years and above, ${figure(Number(band.bonusDays))} bonus days`
        : `${band.minYears} to ${band.maxYears} years, ${figure(Number(band.bonusDays))} bonus days`
      : null
    const entitledDays = Number(snapshot.entitledDays)
    const mothersLeaveDays = snapshot.mothersLeaveDays
    const leaveDaysDue = entitledDays + mothersLeaveDays
    const categoryNum = live?.category
      ? parseCatEchCode(live.category).catNum
      : 0
    const category9 = categoryNum >= 9
    const posted = request.memo
    const lastTourDays = posted
      ? posted.accruedLastTour
      : category9
        ? (accrualAccount?.balanceDays ?? 0)
        : 0
    const permissionBalance = permissionAccount?.balanceDays ?? 0
    const grossDays = leaveDaysDue + lastTourDays
    const permissionDays = posted
      ? posted.permissionDays
      : Math.min(permissionBalance, grossDays)
    const netDays = posted ? posted.netDays : grossDays - permissionDays
    const monthlyRateDays =
      snapshot.policy.method === 'METHOD_2' &&
      monthlyRate &&
      close(Number(monthlyRate.monthlyDays) * 12, basicDays)
        ? Number(monthlyRate.monthlyDays)
        : null
    const entitlementAnnualDays =
      snapshot.policy.method === 'METHOD_1' &&
      entitlement &&
      close(Number(entitlement.annualDays), basicDays)
        ? Number(entitlement.annualDays)
        : null
    return {
      title: 'Leave calculation',
      html: buildLeaveCalculationReportHtml({
        employeeName: live?.names ?? request.matricule,
        matricule: request.matricule,
        leaveTypeName: request.leaveType.name,
        applicationDate: request.applicationDate,
        calculatedAt: snapshot.calculatedAt,
        accrualStartDate: snapshot.accrualStartDate,
        accrualEndDate,
        accrualStartReason,
        engagementDate: employment?.dateEng ?? live?.dateEng ?? null,
        eligibleMonths: Number(snapshot.eligibleMonths),
        serviceYears,
        policyName: snapshot.policy.name,
        policyCode: snapshot.policy.code,
        method: snapshot.policy.method,
        basicDays,
        seniorityDays,
        seniorityBand,
        monthlyAccrual: Number(snapshot.monthlyAccrual),
        entitledDays,
        qualifyingChildCount: snapshot.qualifyingChildCount,
        mothersLeaveDays,
        daysPerChild: motherSetting?.daysPerChild ?? 0,
        maxAgeYears: motherSetting?.maxAgeYears ?? 0,
        entitlementAnnualDays,
        monthlyRateDays,
        categoryLabel: live?.category ?? null,
        category9,
        lastTourDays,
        permissionBalance,
        permissionDays,
        leaveDaysDue,
        grossDays,
        netDays,
        balancesPosted: posted != null,
      }),
    }
  },
  async validateFixed(userId: number, id: number, review?: ReviewInput) {
    const row = await prisma.tbl_leave_request.findUnique({
      where: { id },
      include: {
        leaveType: {
          include: {
            documentRequirements: { orderBy: { sortOrder: 'asc' } },
          },
        },
        attachments: true,
      },
    })
    if (!row) throw new PersonnelNotFoundError('Leave request not found')
    if (row.leaveType.category === 'PERMISSION') {
      throw new PersonnelWorkflowError(
        'Permission types are requested under Permission requests',
        400,
      )
    }
    if (isAnnualLeaveType(row.leaveType)) {
      throw new PersonnelWorkflowError(
        'Calculate this leave before validating it',
        409,
      )
    }
    await assertCanValidate(row, userId)
    const missingDocuments = row.leaveType.documentRequirements.filter(
      (requirement) =>
        !row.attachments.some((file) => file.requirementId === requirement.id),
    )
    if (missingDocuments.length > 0) {
      throw new PersonnelWorkflowError(
        `Attach the required documents: ${missingDocuments.map((requirement) => requirement.name).join(', ')}`,
        409,
      )
    }
    const maxDays = row.leaveType.maxDays
    if (maxDays == null || maxDays < 1) {
      throw new PersonnelWorkflowError(
        'Set a duration on this leave type before validating',
        409,
      )
    }
    const [holidays, settings] = await Promise.all([
      prisma.tbl_public_holiday.findMany({
        where: { active: true },
        select: { month: true, day: true },
      }),
      prisma.tbl_leave_letter_setting.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      }),
    ])
    const endDate =
      row.leaveType.durationUnit === 'CALENDAR_WEEKS'
        ? addUtcDays(row.startDate, maxDays * 7 - 1)
        : workingEndDate(
            row.startDate,
            maxDays,
            holidays,
            settings.saturdayWorking,
          )
    await prisma.$transaction(async (tx) => {
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
          ...validateStamps(userId, review?.reviewNote),
          current: true,
          endDate,
        },
      })
    })
    return this.get(id)
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
  async addAttachment(
    userId: number,
    requestId: number,
    file: File,
    requirementId: number | null,
  ) {
    const request = await prisma.tbl_leave_request.findUnique({
      where: { id: requestId },
      select: { workflowStatus: true, leaveTypeId: true },
    })
    if (!request) throw new PersonnelNotFoundError('Leave request not found')
    if (requirementId != null) {
      const requirement = await prisma.tbl_leave_document_requirement.findFirst({
        where: { id: requirementId, leaveTypeId: request.leaveTypeId },
        select: { id: true },
      })
      if (!requirement) {
        throw new PersonnelWorkflowError(
          'That document is not required for this leave type',
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
      const row = await prisma.tbl_leave_attachment.create({
        data: {
          leaveRequestId: requestId,
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
  async employee(matricule: string) {
    const live = await resolveLiveEmployee(matricule)
    if (!live) {
      throw new PersonnelNotFoundError(
        `No employee found for matricule ${matricule}`,
      )
    }
    const [latestLeave, latestResume, accrual] = await Promise.all([
      prisma.tbl_employee_leave_history.findFirst({
        where: { matricule },
        orderBy: { leaveEndDate: 'desc' },
        select: { leaveEndDate: true },
      }),
      prisma.tbl_employee_leave_history.findFirst({
        where: { matricule, resumedDate: { not: null } },
        orderBy: { resumedDate: 'desc' },
        select: { resumedDate: true },
      }),
      prisma.tbl_leave_accrual_account.findUnique({
        where: { matricule },
        select: { balanceDays: true },
      }),
    ])
    return {
      matricule: live.matricule,
      name: live.names,
      designation: live.designation,
      category: live.category,
      unitName: live.unitName,
      groupName: live.groupName,
      dateEng: live.dateEng,
      lastLeaveDate: latestLeave?.leaveEndDate ?? null,
      lastResumedDate: latestResume?.resumedDate ?? null,
      accrualBalance: accrual?.balanceDays ?? 0,
    }
  },
  async adjustAccrual(userId: number, input: LeaveAccrualAdjustInput) {
    const employee = await prisma.tbl_employee.findUnique({
      where: { matricule: input.matricule },
      select: { matricule: true },
    })
    if (!employee) throw new PersonnelNotFoundError('Employee not found')
    const existing = await prisma.tbl_leave_accrual_account.findUnique({
      where: { matricule: input.matricule },
      select: { balanceDays: true },
    })
    const current = existing?.balanceDays ?? 0
    if (current === input.balanceDays) return { balanceDays: current }
    const delta = input.balanceDays - current
    await prisma.$transaction(async (tx) => {
      await tx.tbl_leave_accrual_account.upsert({
        where: { matricule: input.matricule },
        create: { matricule: input.matricule, balanceDays: input.balanceDays },
        update: { balanceDays: input.balanceDays },
      })
      await tx.tbl_leave_accrual_ledger.create({
        data: {
          matricule: input.matricule,
          days: Math.abs(delta),
          kind: delta > 0 ? 'CREDIT' : 'DEBIT',
          note: `Balance set from ${current} to ${input.balanceDays}`,
          createdById: userId,
        },
      })
    })
    return { balanceDays: input.balanceDays }
  },
  async history(matricule: string) {
    const rows = await prisma.tbl_employee_leave_history.findMany({
      where: { matricule },
      orderBy: { leaveEndDate: 'desc' },
      include: {
        leaveType: true,
        leaveGrant: {
          include: { leaveRequest: { include: { leaveType: true } } },
        },
      },
    })
    return rows.map((row) => {
      const grant = row.leaveGrant
      return {
        id: row.id,
        matricule: row.matricule,
        leaveGrantId: row.leaveGrantId,
        leaveTypeId: row.leaveTypeId,
        leaveStartDate: row.leaveStartDate,
        leaveEndDate: row.leaveEndDate,
        resumedDate: row.resumedDate,
        daysGranted: num(row.daysGranted),
        leaveType:
          grant?.leaveRequest.leaveType.name ??
          row.leaveType?.name ??
          '—',
        leaveRequestId: grant?.leaveRequestId ?? null,
        expectedReturnDate: grant?.expectedReturnDate ?? null,
      }
    })
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

async function leaveThroTitle(input: {
  matricule: string
  asOf: Date
}): Promise<string> {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule: input.matricule },
    select: { currentUnitId: true },
  })
  const section = employee?.currentUnitId
    ? await prisma.tbl_section.findFirst({
        where: { tbl_unit_id: employee.currentUnitId },
        orderBy: { id: 'asc' },
        select: { id: true },
      })
    : null
  return resolveMemoThroTitle({
    memoCode: 'LEAVE_APPROVAL',
    unitId: employee?.currentUnitId ?? null,
    sectionId: section?.id ?? null,
    asOf: input.asOf,
  })
}

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function leaveMemoTemplate(value: string): LeaveMemoModel['template'] {
  if (value === 'CATEGORY_9' || value === 'BELOW_PERMISSION' || value === 'BELOW_NONE') {
    return value
  }
  return 'BELOW_NONE'
}

async function leaveSignerOffice(
  db: Prisma.TransactionClient | typeof prisma,
  matricule: string,
): Promise<{ category: number; unitId: string | null; groupId: string | null }> {
  const [classification, employee] = await Promise.all([
    db.tbl_emp_class.findFirst({
      where: { matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ letter_date: 'desc' }, { effective_date: 'desc' }, { id: 'desc' }],
      select: { category: true },
    }),
    db.tbl_employee.findUnique({
      where: { matricule },
      select: { currentUnitId: true },
    }),
  ])
  const category = classification ? parseCatEchCode(classification.category).catNum : 0
  if (!employee?.currentUnitId) return { category, unitId: null, groupId: null }
  const unit = await db.tbl_unit.findUnique({
    where: { id: employee.currentUnitId },
    select: { groupid: true },
  })
  return {
    category,
    unitId: employee.currentUnitId,
    groupId: unit?.groupid ?? null,
  }
}

async function leaveMemoSigner(input: {
  category: number
  groupId: string | null
  unitId: string | null
  asOf: Date
}): Promise<{ fromTitle: string; signatoryName: string | null; signatoryTitle: string }> {
  const signatory = await resolveOfficialMemoSignatory({
    code: 'LEAVE_APPROVAL',
    category: input.category,
    unitId: input.unitId,
    groupId: input.groupId,
    asOf: input.asOf,
  })
  const title = signatory?.title ?? 'ESTATE MANAGER'
  const category9 = input.category >= 9
  return {
    fromTitle: title,
    signatoryName: category9 ? null : (signatory?.name ?? null),
    signatoryTitle: title,
  }
}

async function prepareLeaveMemo(
  tx: Prisma.TransactionClient,
  input: {
    matricule: string
    earnedDays: number
    mothersLeaveDays: number
    qualifyingChildCount: number
    startDate: Date
    accrualStartDate: Date
    accrualEndDate: Date
    daysToGrant?: number
  },
): Promise<
  LeaveMemoModel & {
    html: string
    signerCategory: number
    signerUnitId: string | null
    signerGroupId: string | null
  }
> {
  const [employee, classification, movement, employment, holidays, settings, placement, permissionAccount, accrualAccount] =
    await Promise.all([
      tx.tbl_employee.findUnique({
        where: { matricule: input.matricule },
        select: { name: true, firstname: true, sex: true, currentUnitId: true },
      }),
      tx.tbl_emp_class.findFirst({
        where: {
          matricule: input.matricule,
          workflowStatus: 'VALIDATED',
        },
        orderBy: [
          { letter_date: 'desc' },
          { effective_date: 'desc' },
          { id: 'desc' },
        ],
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
              unitName: null as string | null,
              groupId: null as string | null,
              sectionId: null as number | null,
            }
          }
          const [unit, section] = await Promise.all([
            tx.tbl_unit.findUnique({
              where: { id: row.currentUnitId },
              select: { groupid: true, unit_name: true },
            }),
            tx.tbl_section.findFirst({
              where: { tbl_unit_id: row.currentUnitId },
              orderBy: { id: 'asc' },
              select: { id: true },
            }),
          ])
          return {
            unitId: row.currentUnitId,
            unitName: unit?.unit_name ?? null,
            groupId: unit?.groupid ?? null,
            sectionId: section?.id ?? null,
          }
        }),
      tx.tbl_permission_account.findUnique({
        where: { matricule: input.matricule },
        select: { balanceDays: true },
      }),
      tx.tbl_leave_accrual_account.findUnique({
        where: { matricule: input.matricule },
        select: { balanceDays: true },
      }),
    ])
  if (!employee) throw new PersonnelNotFoundError('Employee not found')
  const category = classification
    ? parseCatEchCode(classification.category).catNum
    : 0
  const memoRef = leaveMemoFileRef('ANNUAL_LEAVE', category)
  if (!memoRef) {
    throw new PersonnelWorkflowError(
      'No file reference is defined for this employee category',
      400,
    )
  }
  const category9 = category >= 9
  const accruedLastTour = category9 ? (accrualAccount?.balanceDays ?? 0) : 0
  const dueDays = input.earnedDays + input.mothersLeaveDays + accruedLastTour
  const permissionBalance = permissionAccount?.balanceDays ?? 0
  const permissionDays = Math.min(permissionBalance, dueDays)
  const netDays = dueDays - permissionDays
  if (netDays < 1) {
    throw new PersonnelWorkflowError(
      'Permission days cover the whole leave due. Nothing is left to grant',
      400,
    )
  }
  const daysTakenNow =
    category9 && input.daysToGrant != null ? input.daysToGrant : netDays
  if (
    category9 &&
    (!Number.isInteger(daysTakenNow) || daysTakenNow < 1 || daysTakenNow > netDays)
  ) {
    throw new PersonnelWorkflowError(
      'Days to grant must be a whole number from 1 through the leave due',
      400,
    )
  }
  const accruedThisTour = category9 ? netDays - daysTakenNow : 0
  const endDate = workingEndDate(
    input.startDate,
    daysTakenNow,
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
  const signer = await leaveMemoSigner({
    category,
    groupId: placement.groupId,
    unitId: placement.unitId,
    asOf: memoDate,
  })
  const throTitle = await resolveMemoThroTitle({
    memoCode: 'LEAVE_APPROVAL',
    unitId: placement.unitId,
    sectionId: placement.sectionId,
    asOf: memoDate,
  })
  const model: LeaveMemoModel = {
    template,
    memoRef,
    memoDate,
    earnedDays: input.earnedDays,
    mothersLeaveDays: input.mothersLeaveDays,
    qualifyingChildCount: input.qualifyingChildCount,
    entitledDays: input.earnedDays + input.mothersLeaveDays,
    permissionDays,
    netDays,
    accruedLastTour,
    daysTakenNow,
    accruedThisTour,
    travelAllowance: travel.amount,
    accrualStartDate: input.accrualStartDate,
    accrualEndDate: input.accrualEndDate,
    employeeName: titled,
    unitName: placement.unitName,
    designation,
    matricule: input.matricule,
    startDate: input.startDate,
    endDate,
    resumeDate,
    fromTitle: signer.fromTitle,
    throTitle,
    signatoryPreface: null,
    signatoryName: signer.signatoryName,
    signatoryTitle: signer.signatoryTitle,
    ccText: category9 ? settings.ccCategory9 : settings.ccBelow,
    ccLayout: settings.ccLayout === 'ROW' ? 'ROW' : 'COLUMN',
  }
  return {
    ...model,
    html: buildLeaveMemoHtml(model),
    signerCategory: category,
    signerUnitId: placement.unitId,
    signerGroupId: placement.groupId,
  }
}
