import { Prisma, type tbl_personnel_workflow_status } from '@prisma/client'
import type {
  EmployeeCreateInput,
  EmployeeListQuery,
  EmployeeListResponse,
  EmployeeOption,
  EmployeeUpdateInput,
  WorkflowStatus,
} from '@personel-management-app/shared'
import { formatProposedCat } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { canonicalUnitId, unitMatchIds } from './live-employee.service.js'
import { resolveCatAndEchIds } from './category-proposal.service.js'
import { getPermissionsForRole } from './roles.service.js'
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

export type PersonnelListQuery = {
  matricule?: string
  employmentId?: number
  workflowStatus?: tbl_personnel_workflow_status
  current?: boolean
  page?: number
  limit?: number
  search?: string
  includeDeleted?: boolean
  sortBy?: 'matricule' | 'name'
}

export type ReviewInput = {
  reviewNote?: string | null
}

function pagination(query: PersonnelListQuery) {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(100, Math.max(1, query.limit ?? 20))
  return { page, limit, skip: (page - 1) * limit }
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function mapEmployee(row: {
  matricule: string
  name: string
  firstname: string | null
  dateBirth: Date
  placeBirth: string
  sex: string | null
  nationality: string | null
  maritalStatus: string | null
  wives: number
  noChildren: number
  active: boolean
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
}): EmployeeOption {
  return {
    matricule: row.matricule,
    name: row.name,
    firstname: row.firstname,
    dateBirth: toDateOnly(row.dateBirth),
    placeBirth: row.placeBirth,
    sex: row.sex,
    nationality: row.nationality,
    maritalStatus: row.maritalStatus,
    wives: row.wives,
    noChildren: row.noChildren,
    active: row.active,
    workflowStatus: row.workflowStatus as WorkflowStatus,
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

async function requireEmployee(matricule: string) {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: { matricule: true },
  })
  if (!employee) {
    throw new PersonnelNotFoundError(`No employee found for matricule ${matricule}`)
  }
}

async function requireEmployment(employmentId: number) {
  const employment = await prisma.tbl_emp_employment.findUnique({
    where: { id: employmentId },
    select: { id: true, matricule: true, workflowStatus: true },
  })
  if (!employment) {
    throw new PersonnelNotFoundError(
      `No employment found for id ${employmentId}`,
    )
  }
  return employment
}

function assertSpecifiedHasEndDate(
  contractType: 'SPECIFIED' | 'UNSPECIFIED',
  endDate: string | null | undefined,
) {
  if (contractType === 'SPECIFIED' && !endDate?.trim()) {
    throw new PersonnelWorkflowError(
      'endDate is required for a specified contract',
      400,
    )
  }
}

async function assertEmploymentAcceptsContractRevision(employmentId: number) {
  const employment = await requireEmployment(employmentId)
  if (employment.workflowStatus !== 'VALIDATED') {
    throw new PersonnelWorkflowError(
      'A contract revision can be added only after the employment is validated',
      400,
    )
  }
  const open = await prisma.tbl_emp_contract.findFirst({
    where: {
      employmentId,
      workflowStatus: { in: ['PENDING', 'REJECTED'] },
    },
    select: { id: true },
  })
  if (open) {
    throw new PersonnelWorkflowError(
      'This employment already has a contract awaiting review',
      409,
    )
  }
  return employment
}

async function assertContractTypeProgression(
  employmentId: number,
  incomingType: 'SPECIFIED' | 'UNSPECIFIED',
  excludeId?: number,
) {
  const current = await prisma.tbl_emp_contract.findFirst({
    where: {
      employmentId,
      current: true,
      workflowStatus: 'VALIDATED',
      ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
    },
    select: { contractType: true },
  })
  if (!current) return
  if (
    current.contractType === 'UNSPECIFIED' &&
    incomingType === 'SPECIFIED'
  ) {
    throw new PersonnelWorkflowError(
      'Cannot change contract from unspecified to specified duration',
      400,
    )
  }
}

function workflowFilter(query: PersonnelListQuery) {
  return {
    ...(query.matricule ? { matricule: query.matricule } : {}),
    ...(query.workflowStatus ? { workflowStatus: query.workflowStatus } : {}),
  }
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new PersonnelNotFoundError()
    }
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

export const employeeService = {
  async list(
    query: EmployeeListQuery,
    unitIds: string[] | null = null,
  ): Promise<EmployeeListResponse> {
    const { page, limit, skip } = pagination(query)
    if (unitIds && unitIds.length === 0) {
      return { items: [], total: 0, page, limit }
    }
    if (
      unitIds &&
      query.workflowStatus &&
      query.workflowStatus !== 'VALIDATED'
    ) {
      return { items: [], total: 0, page, limit }
    }
    const search = query.search?.trim()
    const sortBy = query.sortBy ?? 'name'
    const where: Prisma.tbl_employeeWhereInput = {
      ...(unitIds
        ? {
            active: true,
            workflowStatus: 'VALIDATED' as const,
            currentUnitId: { in: unitMatchIds(unitIds) },
          }
        : query.workflowStatus
          ? { workflowStatus: query.workflowStatus }
          : {}),
      ...(search
        ? {
            OR: [
              { matricule: { contains: search } },
              { name: { contains: search } },
              { firstname: { contains: search } },
            ],
          }
        : {}),
    }

    const orderBy: Prisma.tbl_employeeOrderByWithRelationInput[] =
      sortBy === 'matricule'
        ? [{ matricule: 'asc' }, { name: 'asc' }]
        : [{ name: 'asc' }, { matricule: 'asc' }]

    const [rows, total] = await Promise.all([
      prisma.tbl_employee.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          matricule: true,
          name: true,
          firstname: true,
          dateBirth: true,
          placeBirth: true,
          sex: true,
          nationality: true,
          maritalStatus: true,
          wives: true,
          noChildren: true,
          active: true,
          currentUnitId: true,
          workflowStatus: true,
          createdAt: true,
          createdById: true,
          updatedAt: true,
          updatedById: true,
          validatedAt: true,
          validatedById: true,
          rejectedAt: true,
          rejectedById: true,
          reviewNote: true,
        },
      }),
      prisma.tbl_employee.count({ where }),
    ])

    const matricules = rows.map((row) => row.matricule)
    const pageUnitIds = [
      ...new Set(
        rows
          .map((row) => row.currentUnitId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const [units, employments, pictured] = await Promise.all([
      pageUnitIds.length === 0
        ? Promise.resolve([])
        : prisma.tbl_unit.findMany({
            where: { id: { in: pageUnitIds } },
            select: { id: true, unit_name: true },
          }),
      matricules.length === 0
        ? Promise.resolve([])
        : prisma.$queryRaw<{ matricule: string; dateEng: string | null }[]>(
            Prisma.sql`
              SELECT matricule, CAST(dateEng AS CHAR) AS dateEng
              FROM tbl_emp_employment
              WHERE \`current\` = 1
                AND workflowStatus = 'VALIDATED'
                AND matricule IN (${Prisma.join(matricules)})
            `,
          ),
      matricules.length === 0
        ? Promise.resolve([])
        : prisma.$queryRaw<{ matricule: string }[]>(
            Prisma.sql`
              SELECT matricule
              FROM tbl_employee
              WHERE image IS NOT NULL
                AND image <> ''
                AND matricule IN (${Prisma.join(matricules)})
            `,
          ),
    ])
    const unitNames = new Map(units.map((unit) => [unit.id, unit.unit_name]))
    const engagedOn = new Map<string, string>()
    for (const employment of employments) {
      const day = employment.dateEng?.slice(0, 10) ?? ''
      if (!day || day.startsWith('0000')) continue
      const previous = engagedOn.get(employment.matricule)
      if (!previous || day > previous) engagedOn.set(employment.matricule, day)
    }

    const withImages = new Set(pictured.map((row) => row.matricule))

    return {
      items: rows.map((row) => ({
        ...mapEmployee(row),
        unitName: row.currentUnitId
          ? (unitNames.get(row.currentUnitId) ?? null)
          : null,
        dateEng: engagedOn.get(row.matricule) ?? null,
        hasImage: withImages.has(row.matricule),
      })),
      total,
      page,
      limit,
    }
  },

  async options(unitIds: string[] | null = null) {
    if (unitIds && unitIds.length === 0) return []
    return prisma.tbl_employee.findMany({
      where: {
        workflowStatus: 'VALIDATED',
        ...(unitIds
          ? { active: true, currentUnitId: { in: unitMatchIds(unitIds) } }
          : {}),
      },
      select: { matricule: true, name: true, firstname: true },
      orderBy: [{ name: 'asc' }, { matricule: 'asc' }],
    })
  },

  async get(matricule: string): Promise<EmployeeOption> {
    const row = await prisma.tbl_employee.findUnique({
      where: { matricule },
    })
    if (!row) throw new PersonnelNotFoundError('Employee not found')
    return {
      ...mapEmployee(row),
      image: row.image,
      hasImage: Boolean(row.image),
    }
  },

  async getImage(
    matricule: string,
  ): Promise<{ mime: string; bytes: Buffer } | null> {
    const row = await prisma.tbl_employee.findUnique({
      where: { matricule },
      select: { image: true },
    })
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(
      row?.image ?? '',
    )
    if (!match) return null
    return { mime: match[1], bytes: Buffer.from(match[2], 'base64') }
  },

  async create(
    userId: number,
    input: EmployeeCreateInput,
  ): Promise<EmployeeOption> {
    return withPrisma(async () => {
      const row = await prisma.tbl_employee.create({
        data: {
          matricule: input.matricule.trim(),
          name: input.name.trim(),
          firstname: input.firstname?.trim() || null,
          dateBirth: parseDate(input.dateBirth, 'dateBirth'),
          placeBirth: input.placeBirth.trim(),
          sex: input.sex,
          nationality: input.nationality?.trim() || null,
          image: input.image ?? null,
          active: input.active ?? true,
          ...pendingCreateStamps(userId),
        },
      })
      return {
        ...mapEmployee(row),
        hasImage: Boolean(row.image),
      }
    })
  },

  async update(
    userId: number,
    matricule: string,
    input: EmployeeUpdateInput,
  ): Promise<EmployeeOption> {
    const existing = await prisma.tbl_employee.findUnique({
      where: { matricule },
    })
    if (!existing) throw new PersonnelNotFoundError('Employee not found')
    const changesIdentity =
      input.name !== undefined ||
      input.firstname !== undefined ||
      input.dateBirth !== undefined ||
      input.placeBirth !== undefined ||
      input.sex !== undefined ||
      input.nationality !== undefined ||
      input.image !== undefined
    if (changesIdentity) await assertCanEdit(userId, existing.workflowStatus)
    return withPrisma(async () => {
      const row = await prisma.tbl_employee.update({
        where: { matricule },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.firstname !== undefined
            ? { firstname: input.firstname?.trim() || null }
            : {}),
          ...(input.dateBirth !== undefined
            ? { dateBirth: parseDate(input.dateBirth, 'dateBirth') }
            : {}),
          ...(input.placeBirth !== undefined
            ? { placeBirth: input.placeBirth.trim() }
            : {}),
          ...(input.sex !== undefined ? { sex: input.sex } : {}),
          ...(input.nationality !== undefined
            ? { nationality: input.nationality?.trim() || null }
            : {}),
          ...(input.image !== undefined ? { image: input.image } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...editStamps(userId, existing.workflowStatus),
        },
      })
      return {
        ...mapEmployee(row),
        hasImage: Boolean(row.image),
      }
    })
  },

  async validate(
    userId: number,
    matricule: string,
    review?: ReviewInput,
  ): Promise<EmployeeOption> {
    const row = await prisma.tbl_employee.findUnique({ where: { matricule } })
    if (!row) throw new PersonnelNotFoundError('Employee not found')
    assertCanValidate(row, userId)
    const updated = await prisma.tbl_employee.update({
      where: { matricule },
      data: validateStamps(userId, review?.reviewNote),
    })
    return mapEmployee(updated)
  },

  async reject(
    userId: number,
    matricule: string,
    review?: ReviewInput,
  ): Promise<EmployeeOption> {
    const row = await prisma.tbl_employee.findUnique({ where: { matricule } })
    if (!row) throw new PersonnelNotFoundError('Employee not found')
    assertCanReject(row.workflowStatus)
    const updated = await prisma.tbl_employee.update({
      where: { matricule },
      data: rejectStamps(userId, review?.reviewNote),
    })
    return mapEmployee(updated)
  },
}

type WorkflowChild = {
  id: number
  matricule?: string
  workflowStatus: tbl_personnel_workflow_status
  createdById: number
}

async function loadChild<T>(
  loader: () => Promise<T | null>,
  label: string,
): Promise<T> {
  const row = await loader()
  if (!row) throw new PersonnelNotFoundError(`${label} not found`)
  return row
}

async function supersedeAndValidate<T>(args: {
  userId: number
  review?: ReviewInput
  row: WorkflowChild
  extraAssert?: () => void | Promise<void>
  supersede: (tx: Prisma.TransactionClient) => Promise<unknown>
  validate: (
    tx: Prisma.TransactionClient,
    data: ReturnType<typeof validateStamps> & Record<string, unknown>,
  ) => Promise<T>
  extraData?: Record<string, unknown>
}) {
  assertCanValidate(args.row, args.userId)
  await args.extraAssert?.()
  return prisma.$transaction(async (tx) => {
    await args.supersede(tx)
    return args.validate(tx, {
      ...validateStamps(args.userId, args.review?.reviewNote),
      ...args.extraData,
    })
  })
}

export const identificationService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_nat_iden.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () => prisma.tbl_emp_nat_iden.findUnique({ where: { id } }),
      'Identification',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      idNumber: string
      date_issue: string
      place_issue: string
      date_expiry: string
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_nat_iden.create({
        data: {
          matricule: input.matricule,
          idNumber: input.idNumber.trim(),
          date_issue: parseDate(input.date_issue, 'date_issue'),
          place_issue: input.place_issue.trim(),
          date_expiry: parseDate(input.date_expiry, 'date_expiry'),
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      idNumber?: string
      date_issue?: string
      place_issue?: string
      date_expiry?: string
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_nat_iden.update({
        where: { id },
        data: {
          ...(input.idNumber !== undefined
            ? { idNumber: input.idNumber.trim() }
            : {}),
          ...(input.date_issue !== undefined
            ? { date_issue: parseDate(input.date_issue, 'date_issue') }
            : {}),
          ...(input.place_issue !== undefined
            ? { place_issue: input.place_issue.trim() }
            : {}),
          ...(input.date_expiry !== undefined
            ? { date_expiry: parseDate(input.date_expiry, 'date_expiry') }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_nat_iden.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_nat_iden.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_nat_iden.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const insuranceService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_insurance.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: { ins_centre: true },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_insurance.findUnique({
          where: { id },
          include: { ins_centre: true },
        }),
      'Insurance',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      ins_number?: string | null
      centre_id: string
      reg_date?: string | null
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_insurance.create({
        data: {
          matricule: input.matricule,
          ins_number: input.ins_number ?? null,
          centre_id: input.centre_id,
          reg_date: parseOptionalDate(input.reg_date, 'reg_date') ?? null,
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      ins_number?: string | null
      centre_id?: string
      reg_date?: string | null
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_insurance.update({
        where: { id },
        data: {
          ...(input.ins_number !== undefined
            ? { ins_number: input.ins_number }
            : {}),
          ...(input.centre_id !== undefined ? { centre_id: input.centre_id } : {}),
          ...(input.reg_date !== undefined
            ? {
                reg_date: parseOptionalDate(input.reg_date, 'reg_date') ?? null,
              }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_insurance.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_insurance.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_insurance.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const maritalStatusService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_marital_status.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: { maritalStatus: true },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_marital_status.findUnique({
          where: { id },
          include: { maritalStatus: true },
        }),
      'Marital status',
    )
  },
  async create(
    userId: number,
    input: { matricule: string; maritalStatusId: string },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_marital_status.create({
        data: {
          matricule: input.matricule,
          maritalStatusId: input.maritalStatusId,
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: { maritalStatusId?: string },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_marital_status.update({
        where: { id },
        data: {
          ...(input.maritalStatusId !== undefined
            ? { maritalStatusId: input.maritalStatusId }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_marital_status.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_marital_status.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_marital_status.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const employmentService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_employment.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: {
        contracts: { orderBy: [{ id: 'desc' }] },
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_employment.findUnique({
          where: { id },
          include: {
            contracts: { orderBy: [{ id: 'desc' }] },
          },
        }),
      'Employment',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      dateEng: string
      jobEng: string
      placeEng: string
      profession?: string | null
      workStat?: string | null
      contract: {
        contractType: 'SPECIFIED' | 'UNSPECIFIED'
        startDate: string
        endDate?: string | null
      }
    },
  ) {
    await requireEmployee(input.matricule)
    const existing = await prisma.tbl_emp_employment.findFirst({
      where: { matricule: input.matricule },
      select: { id: true },
    })
    if (existing) {
      throw new PersonnelWorkflowError(
        'Employee already has an employment record',
        400,
      )
    }
    if (
      input.contract.contractType === 'SPECIFIED' &&
      !input.contract.endDate?.trim()
    ) {
      throw new PersonnelWorkflowError(
        'endDate is required for a specified contract',
        400,
      )
    }
    return withPrisma(() =>
      prisma.$transaction(async (tx) => {
        const employment = await tx.tbl_emp_employment.create({
          data: {
            matricule: input.matricule,
            dateEng: parseDate(input.dateEng, 'dateEng'),
            jobEng: input.jobEng,
            placeEng: input.placeEng,
            profession: input.profession ?? null,
            workStat: input.workStat ?? null,
            current: false,
            ...pendingCreateStamps(userId),
          },
        })
        await tx.tbl_emp_contract.create({
          data: {
            employmentId: employment.id,
            contractType: input.contract.contractType,
            startDate: parseDate(input.contract.startDate, 'startDate'),
            endDate:
              parseOptionalDate(input.contract.endDate, 'endDate') ?? null,
            current: false,
            ...pendingCreateStamps(userId),
          },
        })
        return tx.tbl_emp_employment.findUniqueOrThrow({
          where: { id: employment.id },
          include: {
            contracts: { orderBy: [{ id: 'desc' }] },
          },
        })
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      dateEng?: string
      jobEng?: string
      placeEng?: string
      profession?: string | null
      workStat?: string | null
      contract?: {
        contractType: 'SPECIFIED' | 'UNSPECIFIED'
        startDate: string
        endDate?: string | null
      }
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    if (
      input.contract?.contractType === 'SPECIFIED' &&
      !input.contract.endDate?.trim()
    ) {
      throw new PersonnelWorkflowError(
        'endDate is required for a specified contract',
        400,
      )
    }
    return withPrisma(() =>
      prisma.$transaction(async (tx) => {
        await tx.tbl_emp_employment.update({
          where: { id },
          data: {
            ...(input.dateEng !== undefined
              ? { dateEng: parseDate(input.dateEng, 'dateEng') }
              : {}),
            ...(input.jobEng !== undefined ? { jobEng: input.jobEng } : {}),
            ...(input.placeEng !== undefined
              ? { placeEng: input.placeEng }
              : {}),
            ...(input.profession !== undefined
              ? { profession: input.profession }
              : {}),
            ...(input.workStat !== undefined
              ? { workStat: input.workStat }
              : {}),
            ...editStamps(userId, row.workflowStatus),
          },
        })

        if (input.contract) {
          const editable = await tx.tbl_emp_contract.findFirst({
            where: {
              employmentId: id,
              workflowStatus: { in: ['PENDING', 'REJECTED'] },
            },
            orderBy: [{ id: 'desc' }],
          })
          await assertContractTypeProgression(
            id,
            input.contract.contractType,
            editable?.id,
          )
          if (editable) {
            await assertCanEdit(userId, editable.workflowStatus)
            await tx.tbl_emp_contract.update({
              where: { id: editable.id },
              data: {
                contractType: input.contract.contractType,
                startDate: parseDate(input.contract.startDate, 'startDate'),
                endDate:
                  parseOptionalDate(input.contract.endDate, 'endDate') ?? null,
                ...editStamps(userId, editable.workflowStatus),
              },
            })
          } else {
            await tx.tbl_emp_contract.create({
              data: {
                employmentId: id,
                contractType: input.contract.contractType,
                startDate: parseDate(input.contract.startDate, 'startDate'),
                endDate:
                  parseOptionalDate(input.contract.endDate, 'endDate') ?? null,
                current: false,
                ...pendingCreateStamps(userId),
              },
            })
          }
        }

        return tx.tbl_emp_employment.findUniqueOrThrow({
          where: { id },
          include: {
            contracts: { orderBy: [{ id: 'desc' }] },
          },
        })
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanValidate(row, userId)

    const pendingContracts = await prisma.tbl_emp_contract.findMany({
      where: { employmentId: id, workflowStatus: 'PENDING' },
      orderBy: [{ id: 'desc' }],
    })
    for (const contract of pendingContracts) {
      if (contract.contractType === 'SPECIFIED' && !contract.endDate) {
        throw new PersonnelWorkflowError(
          'endDate is required to validate a specified contract',
          400,
        )
      }
      await assertContractTypeProgression(
        id,
        contract.contractType,
        contract.id,
      )
    }

    return prisma.$transaction(async (tx) => {
      await tx.tbl_emp_employment.updateMany({
        where: { matricule: row.matricule, current: true, NOT: { id } },
        data: { current: false, workflowStatus: 'SUPERSEDED' },
      })
      const employment = await tx.tbl_emp_employment.update({
        where: { id },
        data: {
          ...validateStamps(userId, review?.reviewNote),
          current: true,
        },
      })

      for (const contract of pendingContracts) {
        await tx.tbl_emp_contract.updateMany({
          where: {
            employmentId: id,
            current: true,
            NOT: { id: contract.id },
          },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        })
        await tx.tbl_emp_contract.update({
          where: { id: contract.id },
          data: {
            ...validateStamps(userId, review?.reviewNote),
            current: true,
          },
        })
      }

      return tx.tbl_emp_employment.findUniqueOrThrow({
        where: { id: employment.id },
        include: {
          contracts: { orderBy: [{ id: 'desc' }] },
        },
      })
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.$transaction(async (tx) => {
      await tx.tbl_emp_employment.update({
        where: { id },
        data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      })
      await tx.tbl_emp_contract.updateMany({
        where: {
          employmentId: id,
          workflowStatus: 'PENDING',
        },
        data: { ...rejectStamps(userId, review?.reviewNote), current: false },
      })
      return tx.tbl_emp_employment.findUniqueOrThrow({
        where: { id },
        include: {
          contracts: { orderBy: [{ id: 'desc' }] },
        },
      })
    })
  },
}

export const contractService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_contract.findMany({
      where: {
        ...(query.matricule
          ? { employment: { matricule: query.matricule } }
          : {}),
        ...(query.employmentId != null
          ? { employmentId: query.employmentId }
          : {}),
        ...(query.workflowStatus
          ? { workflowStatus: query.workflowStatus }
          : {}),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: {
        employment: {
          select: {
            id: true,
            matricule: true,
            dateEng: true,
            jobEng: true,
            placeEng: true,
            current: true,
            workflowStatus: true,
          },
        },
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_contract.findUnique({
          where: { id },
          include: {
            employment: {
              select: {
                id: true,
                matricule: true,
                dateEng: true,
                jobEng: true,
                placeEng: true,
                current: true,
                workflowStatus: true,
              },
            },
          },
        }),
      'Contract',
    )
  },
  async create(
    userId: number,
    input: {
      employmentId: number
      contractType: 'SPECIFIED' | 'UNSPECIFIED'
      startDate: string
      endDate?: string | null
    },
  ) {
    const employment = await assertEmploymentAcceptsContractRevision(
      input.employmentId,
    )
    assertSpecifiedHasEndDate(input.contractType, input.endDate)
    await assertContractTypeProgression(employment.id, input.contractType)
    return withPrisma(() =>
      prisma.tbl_emp_contract.create({
        data: {
          employmentId: employment.id,
          contractType: input.contractType,
          startDate: parseDate(input.startDate, 'startDate'),
          endDate: parseOptionalDate(input.endDate, 'endDate') ?? null,
          current: false,
          ...pendingCreateStamps(userId),
        },
        include: {
          employment: {
            select: {
              id: true,
              matricule: true,
              dateEng: true,
              jobEng: true,
              placeEng: true,
              current: true,
              workflowStatus: true,
            },
          },
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      contractType?: 'SPECIFIED' | 'UNSPECIFIED'
      startDate?: string
      endDate?: string | null
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    const nextType = input.contractType ?? row.contractType
    const nextEnd =
      input.endDate !== undefined
        ? input.endDate
        : row.endDate
          ? row.endDate.toISOString()
          : null
    assertSpecifiedHasEndDate(nextType, nextEnd)
    if (input.contractType !== undefined) {
      await assertContractTypeProgression(
        row.employmentId,
        input.contractType,
        id,
      )
    }
    return withPrisma(() =>
      prisma.tbl_emp_contract.update({
        where: { id },
        data: {
          ...(input.contractType !== undefined
            ? { contractType: input.contractType }
            : {}),
          ...(input.startDate !== undefined
            ? { startDate: parseDate(input.startDate, 'startDate') }
            : {}),
          ...(input.endDate !== undefined
            ? { endDate: parseOptionalDate(input.endDate, 'endDate') ?? null }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
        include: {
          employment: {
            select: {
              id: true,
              matricule: true,
              dateEng: true,
              jobEng: true,
              placeEng: true,
              current: true,
              workflowStatus: true,
            },
          },
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraAssert: async () => {
        if (row.contractType === 'SPECIFIED' && !row.endDate) {
          throw new PersonnelWorkflowError(
            'endDate is required to validate a specified contract',
            400,
          )
        }
        await assertContractTypeProgression(
          row.employmentId,
          row.contractType,
          id,
        )
      },
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_contract.updateMany({
          where: {
            employmentId: row.employmentId,
            current: true,
            NOT: { id },
          },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_contract.update({
          where: { id },
          data,
          include: {
            employment: {
              select: {
                id: true,
                matricule: true,
                dateEng: true,
                jobEng: true,
                placeEng: true,
                current: true,
                workflowStatus: true,
              },
            },
          },
        }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_contract.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

async function syncEmployeeFamilySummary(
  tx: Prisma.TransactionClient,
  matricule: string,
) {
  const members = await tx.tbl_emp_family_member.findMany({
    where: {
      matricule,
      workflowStatus: 'VALIDATED',
      current: true,
    },
    select: { relationship: true },
  })
  const wives = members.filter((member) => member.relationship === 'SPOUSE').length
  const noChildren = members.filter(
    (member) => member.relationship === 'CHILD',
  ).length
  await tx.tbl_employee.update({
    where: { matricule },
    data: {
      wives,
      noChildren,
      ...(wives >= 1 ? { maritalStatus: 'Married' } : {}),
    },
  })
}

export const familyInfoService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_family_member.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () => prisma.tbl_emp_family_member.findUnique({ where: { id } }),
      'Family member',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      fullName: string
      relationship: 'SPOUSE' | 'CHILD'
      sex: 'Male' | 'Female'
      dateOfBirth: string
      applicationDate: string
      certificateNo?: string | null
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_family_member.create({
        data: {
          matricule: input.matricule,
          fullName: input.fullName.trim(),
          relationship: input.relationship,
          sex: input.sex,
          dateOfBirth: parseDate(input.dateOfBirth, 'dateOfBirth'),
          applicationDate: parseDate(input.applicationDate, 'applicationDate'),
          certificateNo: input.certificateNo?.trim() || null,
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      fullName?: string
      relationship?: 'SPOUSE' | 'CHILD'
      sex?: 'Male' | 'Female'
      dateOfBirth?: string
      applicationDate?: string
      certificateNo?: string | null
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.tbl_emp_family_member.update({
          where: { id },
          data: {
            ...(input.fullName !== undefined
              ? { fullName: input.fullName.trim() }
              : {}),
            ...(input.relationship !== undefined
              ? { relationship: input.relationship }
              : {}),
            ...(input.sex !== undefined ? { sex: input.sex } : {}),
            ...(input.dateOfBirth !== undefined
              ? { dateOfBirth: parseDate(input.dateOfBirth, 'dateOfBirth') }
              : {}),
            ...(input.applicationDate !== undefined
              ? {
                  applicationDate: parseDate(
                    input.applicationDate,
                    'applicationDate',
                  ),
                }
              : {}),
            ...(input.certificateNo !== undefined
              ? { certificateNo: input.certificateNo?.trim() || null }
              : {}),
            ...editStamps(userId, row.workflowStatus),
          },
        })
        if (row.workflowStatus === 'VALIDATED') {
          await syncEmployeeFamilySummary(tx, row.matricule)
        }
        return updated
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: async () => {},
      validate: async (tx, data) => {
        const updated = await tx.tbl_emp_family_member.update({
          where: { id },
          data,
        })
        await syncEmployeeFamilySummary(tx, row.matricule)
        return updated
      },
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_family_member.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

export const diplomaService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_diploma.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: { diploma: true },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_diploma.findUnique({
          where: { id },
          include: { diploma: true },
        }),
      'Diploma',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      diplomaId: string
      dateObtained: string
      subject?: string | null
      institution?: string | null
      remarks?: string | null
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_diploma.create({
        data: {
          matricule: input.matricule,
          diplomaId: input.diplomaId,
          dateObtained: parseDate(input.dateObtained, 'dateObtained'),
          subject: blankToNull(input.subject),
          institution: blankToNull(input.institution),
          remarks: blankToNull(input.remarks),
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      diplomaId?: string
      dateObtained?: string
      subject?: string | null
      institution?: string | null
      remarks?: string | null
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_diploma.update({
        where: { id },
        data: {
          ...(input.diplomaId !== undefined ? { diplomaId: input.diplomaId } : {}),
          ...(input.dateObtained !== undefined
            ? { dateObtained: parseDate(input.dateObtained, 'dateObtained') }
            : {}),
          ...(input.subject !== undefined
            ? { subject: blankToNull(input.subject) }
            : {}),
          ...(input.institution !== undefined
            ? { institution: blankToNull(input.institution) }
            : {}),
          ...(input.remarks !== undefined
            ? { remarks: blankToNull(input.remarks) }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: async () => {},
      validate: (tx, data) =>
        tx.tbl_emp_diploma.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_diploma.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const kinInfoService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_nextkin.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () => prisma.tbl_emp_nextkin.findUnique({ where: { id } }),
      'Next of kin',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      nextKinName?: string | null
      nextKinRelation?: string | null
      nextKinAddress?: string | null
      effectiveDate: string
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_nextkin.create({
        data: {
          matricule: input.matricule,
          nextKinName: input.nextKinName ?? null,
          nextKinRelation: input.nextKinRelation ?? null,
          nextKinAddress: input.nextKinAddress ?? null,
          effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      nextKinName?: string | null
      nextKinRelation?: string | null
      nextKinAddress?: string | null
      effectiveDate?: string
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_nextkin.update({
        where: { id },
        data: {
          ...(input.nextKinName !== undefined
            ? { nextKinName: input.nextKinName }
            : {}),
          ...(input.nextKinRelation !== undefined
            ? { nextKinRelation: input.nextKinRelation }
            : {}),
          ...(input.nextKinAddress !== undefined
            ? { nextKinAddress: input.nextKinAddress }
            : {}),
          ...(input.effectiveDate !== undefined
            ? { effectiveDate: parseDate(input.effectiveDate, 'effectiveDate') }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_nextkin.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_nextkin.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_nextkin.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const departureService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_departure.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      include: { departure: true },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_departure.findUnique({
          where: { id },
          include: { departure: true },
        }),
      'Departure',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      departureId: number
      effectiveDate: string
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_departure.create({
        data: {
          matricule: input.matricule,
          departureId: input.departureId,
          effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      departureId?: number
      effectiveDate?: string
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    return withPrisma(() =>
      prisma.tbl_emp_departure.update({
        where: { id },
        data: {
          ...(input.departureId !== undefined
            ? { departureId: input.departureId }
            : {}),
          ...(input.effectiveDate !== undefined
            ? { effectiveDate: parseDate(input.effectiveDate, 'effectiveDate') }
            : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    const typeName = row.departure.type_departure
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_departure.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: async (tx, data) => {
        const updated = await tx.tbl_emp_departure.update({
          where: { id },
          data,
        })
        const employment = await tx.tbl_emp_employment.findFirst({
          where: { matricule: row.matricule },
          select: { id: true },
        })
        if (!employment) {
          throw new PersonnelWorkflowError(
            'Employee has no employment record',
            400,
          )
        }
        await tx.tbl_emp_employment.update({
          where: { id: employment.id },
          data: { workStat: typeName, updatedById: userId },
        })
        return updated
      },
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_departure.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

export const movementService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_movement.findMany({
      where: {
        ...workflowFilter(query),
      },
      include: {
        From_unit: true,
        To_unit: true,
        TransferType: true,
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () =>
        prisma.tbl_emp_movement.findUnique({
          where: { id },
          include: {
            From_unit: true,
            To_unit: true,
            TransferType: true,
          },
        }),
      'Movement',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      Eff_date?: string | null
      From_unit_id?: string | null
      To_unit_id?: string | null
      Position?: string | null
      trans_type_id: number
    },
  ) {
    await requireEmployee(input.matricule)
    return withPrisma(() =>
      prisma.tbl_emp_movement.create({
        data: {
          matricule: input.matricule,
          Eff_date: parseOptionalDate(input.Eff_date, 'Eff_date') ?? null,
          From_unit_id: input.From_unit_id ?? null,
          To_unit_id: input.To_unit_id ?? null,
          Position: input.Position ?? null,
          trans_type_id: input.trans_type_id,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      Eff_date?: string | null
      From_unit_id?: string | null
      To_unit_id?: string | null
      Position?: string | null
      trans_type_id?: number
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    const syncCurrentUnit =
      row.workflowStatus === 'VALIDATED' && input.To_unit_id !== undefined
    const currentUnitId = syncCurrentUnit
      ? await canonicalUnitId(input.To_unit_id)
      : null
    return withPrisma(() =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.tbl_emp_movement.update({
          where: { id },
          data: {
            ...(input.Eff_date !== undefined
              ? { Eff_date: parseOptionalDate(input.Eff_date, 'Eff_date') ?? null }
              : {}),
            ...(input.From_unit_id !== undefined
              ? { From_unit_id: input.From_unit_id }
              : {}),
            ...(input.To_unit_id !== undefined
              ? { To_unit_id: input.To_unit_id }
              : {}),
            ...(input.Position !== undefined ? { Position: input.Position } : {}),
            ...(input.trans_type_id !== undefined
              ? { trans_type_id: input.trans_type_id }
              : {}),
            ...editStamps(userId, row.workflowStatus),
          },
        })
        if (syncCurrentUnit) {
          await tx.tbl_employee.update({
            where: { matricule: row.matricule },
            data: { currentUnitId },
          })
        }
        return updated
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    const currentUnitId = await canonicalUnitId(row.To_unit_id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      supersede: (tx) =>
        tx.tbl_emp_movement.updateMany({
          where: {
            matricule: row.matricule,
            workflowStatus: 'VALIDATED',
            NOT: { id },
          },
          data: { workflowStatus: 'SUPERSEDED' },
        }),
      validate: async (tx, data) => {
        const updated = await tx.tbl_emp_movement.update({ where: { id }, data })
        await tx.tbl_employee.update({
          where: { matricule: row.matricule },
          data: { currentUnitId },
        })
        return updated
      },
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_movement.update({
      where: { id },
      data: rejectStamps(userId, review?.reviewNote),
    })
  },
}

export const classificationService = {
  list(query: PersonnelListQuery) {
    return prisma.tbl_emp_class.findMany({
      where: {
        ...workflowFilter(query),
        ...(query.current !== undefined ? { current: query.current } : {}),
      },
      orderBy: [{ id: 'desc' }],
    })
  },
  async get(id: number) {
    return loadChild(
      () => prisma.tbl_emp_class.findUnique({ where: { id } }),
      'Classification',
    )
  },
  async create(
    userId: number,
    input: {
      matricule: string
      category: string
      echelon: string
      zone?: number | null
      class_type?: string | null
      caption?: string | null
      letter_ref?: string | null
      letter_date?: string | null
      effective_date: string
      comment?: string | null
    },
  ) {
    await requireEmployee(input.matricule)
    await assertClassificationNotDemotion(
      userId,
      input.matricule,
      input.category,
      input.echelon,
    )
    return withPrisma(() =>
      prisma.tbl_emp_class.create({
        data: {
          matricule: input.matricule,
          category: input.category,
          echelon: input.echelon,
          zone: input.zone ?? null,
          class_type: input.class_type ?? null,
          caption: input.caption ?? null,
          letter_ref: input.letter_ref ?? null,
          letter_date:
            parseOptionalDate(input.letter_date, 'letter_date') ?? null,
          effective_date: parseDate(input.effective_date, 'effective_date'),
          comment: input.comment ?? null,
          current: false,
          ...pendingCreateStamps(userId),
        },
      }),
    )
  },
  async update(
    userId: number,
    id: number,
    input: {
      category?: string
      echelon?: string
      zone?: number | null
      class_type?: string | null
      caption?: string | null
      letter_ref?: string | null
      letter_date?: string | null
      effective_date?: string
      comment?: string | null
    },
  ) {
    const row = await this.get(id)
    await assertCanEdit(userId, row.workflowStatus)
    await assertClassificationNotDemotion(
      userId,
      row.matricule,
      input.category ?? row.category,
      input.echelon ?? row.echelon,
    )
    return withPrisma(() =>
      prisma.tbl_emp_class.update({
        where: { id },
        data: {
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.echelon !== undefined ? { echelon: input.echelon } : {}),
          ...(input.zone !== undefined ? { zone: input.zone } : {}),
          ...(input.class_type !== undefined
            ? { class_type: input.class_type }
            : {}),
          ...(input.caption !== undefined ? { caption: input.caption } : {}),
          ...(input.letter_ref !== undefined
            ? { letter_ref: input.letter_ref }
            : {}),
          ...(input.letter_date !== undefined
            ? {
                letter_date:
                  parseOptionalDate(input.letter_date, 'letter_date') ?? null,
              }
            : {}),
          ...(input.effective_date !== undefined
            ? {
                effective_date: parseDate(
                  input.effective_date,
                  'effective_date',
                ),
              }
            : {}),
          ...(input.comment !== undefined ? { comment: input.comment } : {}),
          ...editStamps(userId, row.workflowStatus),
        },
      }),
    )
  },
  async validate(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    return supersedeAndValidate({
      userId,
      review,
      row,
      extraAssert: async () => {
        if (!row.letter_ref?.trim() || !row.letter_date) {
          throw new PersonnelWorkflowError(
            'letter_ref and letter_date are required to validate a classification',
            400,
          )
        }
        await assertClassificationNotDemotion(
          userId,
          row.matricule,
          row.category,
          row.echelon,
        )
      },
      extraData: { current: true },
      supersede: (tx) =>
        tx.tbl_emp_class.updateMany({
          where: { matricule: row.matricule, current: true, NOT: { id } },
          data: { current: false, workflowStatus: 'SUPERSEDED' },
        }),
      validate: (tx, data) =>
        tx.tbl_emp_class.update({ where: { id }, data }),
    })
  },
  async reject(userId: number, id: number, review?: ReviewInput) {
    const row = await this.get(id)
    assertCanReject(row.workflowStatus)
    return prisma.tbl_emp_class.update({
      where: { id },
      data: { ...rejectStamps(userId, review?.reviewNote), current: false },
    })
  },
}

async function assertClassificationNotDemotion(
  userId: number,
  matricule: string,
  category: string,
  echelon: string,
) {
  const present = await prisma.tbl_emp_class.findFirst({
    where: {
      matricule,
      current: true,
      workflowStatus: 'VALIDATED',
    },
    select: { category: true, echelon: true },
  })
  if (!present) return

  const presentResolved = await resolveCatAndEchIds(
    formatProposedCat(present.category, present.echelon),
  )
  if (!presentResolved) return

  const incomingResolved = await resolveCatAndEchIds(
    formatProposedCat(category, echelon),
  )
  if (!incomingResolved) {
    throw new PersonnelWorkflowError('Unknown category/echelon', 400)
  }

  const isDemotion =
    incomingResolved.catId < presentResolved.catId ||
    (incomingResolved.catId === presentResolved.catId &&
      incomingResolved.echId < presentResolved.echId)

  if (!isDemotion) return

  const user = await prisma.tbl_users.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  const canDemote = user
    ? (await getPermissionsForRole(user.role)).canDemoteClassification
    : false
  if (canDemote) return

  throw new PersonnelWorkflowError(
    'Classification cannot be lower than the present category/echelon (requires Demote classification permission)',
    400,
  )
}
