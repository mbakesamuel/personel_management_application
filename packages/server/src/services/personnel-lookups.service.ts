import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from './personnel-workflow.js'

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new PersonnelNotFoundError()
    }
    if (error.code === 'P2002') {
      throw new PersonnelConflictError('Record already exists')
    }
    if (error.code === 'P2003' || error.code === 'P2014') {
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

type LookupDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>
  findUnique: (args: Record<string, unknown>) => Promise<unknown | null>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  update: (args: {
    where: { id: string }
    data: Record<string, unknown>
  }) => Promise<unknown>
  delete: (args: { where: { id: string } }) => Promise<unknown>
}

function asLookup(delegate: object): LookupDelegate {
  return delegate as LookupDelegate
}

export type LookupListQuery = {
  regionId?: string
}

function createLookupService(
  label: string,
  delegate: LookupDelegate,
  opts?: {
    include?: Record<string, unknown>
    listWhere?: (query: LookupListQuery) => Record<string, unknown> | undefined
  },
) {
  return {
    list(query: LookupListQuery = {}) {
      return delegate.findMany({
        where: opts?.listWhere?.(query),
        include: opts?.include,
        orderBy: { id: 'asc' },
      })
    },
    async get(id: string) {
      const row = await delegate.findUnique({
        where: { id },
        include: opts?.include,
      })
      if (!row) throw new PersonnelNotFoundError(`${label} not found`)
      return row
    },
    create(input: Record<string, unknown> & { id: string }) {
      return withPrisma(() =>
        delegate.create({
          data: { ...input, id: input.id.trim() },
        }),
      )
    },
    async update(id: string, input: Record<string, unknown>) {
      await this.get(id)
      return withPrisma(() =>
        delegate.update({
          where: { id },
          data: input,
        }),
      )
    },
    async remove(id: string) {
      await this.get(id)
      return withPrisma(() => delegate.delete({ where: { id } }))
    },
  }
}

export const diplomaLookup = createLookupService('Diploma', asLookup(prisma.tbl_diploma))
export const regionLookup = createLookupService('Region', asLookup(prisma.tbl_region), {
  include: { divisions: true },
})
export const divisionLookup = createLookupService(
  'Division',
  asLookup(prisma.tbl_division),
  {
    include: { region: true },
    listWhere: (query) =>
      query.regionId ? { regionId: query.regionId } : undefined,
  },
)
export const languageLookup = createLookupService(
  'Language',
  asLookup(prisma.tbl_Language),
)
export const maritalStatusLookup = createLookupService(
  'Marital status',
  asLookup(prisma.tbl_marital_status),
)
export const nationalityLookup = createLookupService(
  'Nationality',
  asLookup(prisma.tbl_nationality),
)
export const religionLookup = createLookupService(
  'Religion',
  asLookup(prisma.tbl_religion),
)
export const sanctionLookup = createLookupService(
  'Sanction',
  asLookup(prisma.tbl_sanction),
)
export const sexLookup = createLookupService('Sex', asLookup(prisma.tbl_Sex))
export const classificationLookup = createLookupService(
  'Classification',
  asLookup(prisma.tbl_classification),
)
export const workerUnionLookup = createLookupService(
  'Worker union',
  asLookup(prisma.tbl_worker_union),
)
export const workStatusLookup = createLookupService(
  'Work status',
  asLookup(prisma.tbl_work_status),
)
export const transferTypeLookup = {
  list() {
    return prisma.tbl_transfer.findMany({ orderBy: { id: 'asc' } })
  },
  async get(id: string) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      throw new PersonnelNotFoundError('Transfer type not found')
    }
    const row = await prisma.tbl_transfer.findUnique({
      where: { id: numericId },
    })
    if (!row) throw new PersonnelNotFoundError('Transfer type not found')
    return row
  },
  create(input: { Type_transfer: string }) {
    return withPrisma(() =>
      prisma.tbl_transfer.create({
        data: { Type_transfer: input.Type_transfer.trim() },
      }),
    )
  },
  async update(id: string, input: { Type_transfer?: string }) {
    await this.get(id)
    const numericId = Number(id)
    return withPrisma(() =>
      prisma.tbl_transfer.update({
        where: { id: numericId },
        data: {
          ...(input.Type_transfer !== undefined
            ? { Type_transfer: input.Type_transfer.trim() }
            : {}),
        },
      }),
    )
  },
  async remove(id: string) {
    await this.get(id)
    const numericId = Number(id)
    return withPrisma(() =>
      prisma.tbl_transfer.delete({ where: { id: numericId } }),
    )
  },
}
export const departureLookup = {
  list() {
    return prisma.tbl_departure.findMany({ orderBy: { id: 'asc' } })
  },
  async get(id: string) {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      throw new PersonnelNotFoundError('Departure type not found')
    }
    const row = await prisma.tbl_departure.findUnique({
      where: { id: numericId },
    })
    if (!row) throw new PersonnelNotFoundError('Departure type not found')
    return row
  },
  create(input: { type_departure: string }) {
    return withPrisma(() =>
      prisma.tbl_departure.create({
        data: { type_departure: input.type_departure.trim() },
      }),
    )
  },
  async update(id: string, input: { type_departure?: string }) {
    await this.get(id)
    const numericId = Number(id)
    return withPrisma(() =>
      prisma.tbl_departure.update({
        where: { id: numericId },
        data: {
          ...(input.type_departure !== undefined
            ? { type_departure: input.type_departure.trim() }
            : {}),
        },
      }),
    )
  },
  async remove(id: string) {
    await this.get(id)
    const numericId = Number(id)
    return withPrisma(() =>
      prisma.tbl_departure.delete({ where: { id: numericId } }),
    )
  },
}
export const absenceLookup = createLookupService(
  'Absence',
  asLookup(prisma.tbl_absence),
)
export const insuranceCentreLookup = createLookupService(
  'Insurance centre',
  asLookup(prisma.tbl_insuranceCentre),
)
export const bankLookup = createLookupService('Bank', asLookup(prisma.tbl_bank))
