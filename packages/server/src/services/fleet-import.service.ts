import type {
  FleetImportBatchInput,
  FleetImportDetail,
  FleetImportRegistration,
  FleetImportResult,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'

type ImportError = FleetImportResult['errors'][number]

const LOOKUP_CHUNK = 1000
const INSERT_CHUNK = 400

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function parseDateOnly(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) throw new Error(`Invalid date: ${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1) throw new Error(`Invalid date: ${value}`)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

async function findExistingIds(
  ids: number[],
  load: (chunk: number[]) => Promise<number[]>,
): Promise<Set<number>> {
  const found = new Set<number>()
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const chunk = ids.slice(i, i + LOOKUP_CHUNK)
    if (chunk.length === 0) continue
    for (const id of await load(chunk)) found.add(id)
  }
  return found
}

function firstById<T extends { id: number; row: number }>(
  rows: T[],
  sheet: ImportError['sheet'],
  errors: ImportError[],
): T[] {
  const seen = new Set<number>()
  const unique: T[] = []
  for (const row of rows) {
    if (seen.has(row.id)) {
      errors.push({
        sheet,
        row: row.row,
        message: `Duplicate id ${row.id} in the sheet`,
      })
      continue
    }
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

export async function importFleetBatch(
  input: FleetImportBatchInput,
): Promise<FleetImportResult> {
  const errors: ImportError[] = []
  const registrations = firstById(
    input.registrations,
    'fleet_registration',
    errors,
  )
  const detailsWithId = input.details.filter(
    (row): row is FleetImportDetail & { id: number } => row.id != null,
  )
  const detailsWithoutId = input.details.filter((row) => row.id == null)
  const uniqueDetails = firstById(detailsWithId, 'fleet_reg_details', errors)

  const registrationIds = registrations.map((row) => row.id)
  const detailIds = uniqueDetails.map((row) => row.id)
  const matricules = [...new Set(registrations.map((row) => row.matricule))]
  const operatorIds = [...new Set(registrations.map((row) => row.operatorId))]
  const allowanceIds = [...new Set(registrations.map((row) => row.allowanceId))]
  const serviceIds = [
    ...new Set(input.details.map((row) => row.serviceId)),
  ]
  const parentIds = [
    ...new Set(input.details.map((row) => row.fleetRegistrationId)),
  ]
  const replacedByTargets = registrations
    .map((row) => row.replacedById)
    .filter((id): id is number => id != null)

  const [
    existingRegistrationIds,
    existingDetailIds,
    existingEmployees,
    existingOperators,
    existingAllowances,
    existingServices,
    existingParents,
    existingTargets,
    takenReplacedBy,
  ] = await Promise.all([
    findExistingIds(registrationIds, async (chunk) => {
      const rows = await prisma.fleetRegistration.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingIds(detailIds, async (chunk) => {
      const rows = await prisma.fleetRegDetails.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingStrings(matricules, async (chunk) => {
      const rows = await prisma.tbl_employee.findMany({
        where: { matricule: { in: chunk } },
        select: { matricule: true },
      })
      return rows.map((row) => row.matricule)
    }),
    findExistingIds(operatorIds, async (chunk) => {
      const rows = await prisma.tbl_operator.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingStrings(allowanceIds, async (chunk) => {
      const rows = await prisma.tbl_allowance.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingIds(serviceIds, async (chunk) => {
      const rows = await prisma.service.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingIds(parentIds, async (chunk) => {
      const rows = await prisma.fleetRegistration.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingIds(replacedByTargets, async (chunk) => {
      const rows = await prisma.fleetRegistration.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      })
      return rows.map((row) => row.id)
    }),
    findExistingIds(
      registrations
        .map((row) => row.replacedById)
        .filter((id): id is number => id != null),
      async (chunk) => {
        const rows = await prisma.fleetRegistration.findMany({
          where: { replacedById: { in: chunk } },
          select: { replacedById: true },
        })
        return rows
          .map((row) => row.replacedById)
          .filter((id): id is number => id != null)
      },
    ),
  ])

  const validRegistrations: FleetImportRegistration[] = []
  for (const row of registrations) {
    if (existingRegistrationIds.has(row.id)) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `Registration ${row.id} already exists`,
      })
      continue
    }
    if (!existingEmployees.has(row.matricule)) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `Employee ${row.matricule} was not found`,
      })
      continue
    }
    if (!existingOperators.has(row.operatorId)) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `Operator ${row.operatorId} was not found`,
      })
      continue
    }
    if (!existingAllowances.has(row.allowanceId)) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `Allowance ${row.allowanceId} was not found`,
      })
      continue
    }
    validRegistrations.push(row)
  }

  const insertedIds = new Set(validRegistrations.map((row) => row.id))
  const availableParents = new Set<number>([
    ...existingParents,
    ...insertedIds,
  ])

  const validDetails: Array<FleetImportDetail & { id: number | null }> = []
  const considerDetail = (row: FleetImportDetail) => {
    if (row.id != null && existingDetailIds.has(row.id)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message: `Amount ${row.id} already exists`,
      })
      return
    }
    if (!availableParents.has(row.fleetRegistrationId)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message: `Registration ${row.fleetRegistrationId} was not imported`,
      })
      return
    }
    if (!existingServices.has(row.serviceId)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message: `Service ${row.serviceId} was not found`,
      })
      return
    }
    validDetails.push({ ...row, id: row.id ?? null })
  }
  for (const row of uniqueDetails) considerDetail(row)
  for (const row of detailsWithoutId) considerDetail(row)

  const links: Array<{
    id: number
    replacedById: number
    row: number
    updatedAt: string | null
  }> = []
  const claimed = new Set(takenReplacedBy)
  for (const row of validRegistrations) {
    const target = row.replacedById
    if (target == null) continue
    if (target === row.id) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `replacedById ${target} was not applied: a line cannot replace itself`,
      })
      continue
    }
    const targetExists = insertedIds.has(target) || existingTargets.has(target)
    if (!targetExists) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `replacedById ${target} was not applied: target does not exist`,
      })
      continue
    }
    if (claimed.has(target)) {
      errors.push({
        sheet: 'fleet_registration',
        row: row.row,
        message: `replacedById ${target} was not applied: that link is already used`,
      })
      continue
    }
    claimed.add(target)
    links.push({
      id: row.id,
      replacedById: target,
      row: row.row,
      updatedAt: row.updatedAt ?? null,
    })
  }

  if (validRegistrations.length > 0 || validDetails.length > 0) {
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < validRegistrations.length; i += INSERT_CHUNK) {
          const chunk = validRegistrations.slice(i, i + INSERT_CHUNK)
          await tx.fleetRegistration.createMany({
            data: chunk.map((row) => ({
              id: row.id,
              matricule: row.matricule.trim(),
              operator_id: row.operatorId,
              allowanceId: row.allowanceId.trim(),
              accountNo: emptyToNull(row.accountNo),
              phoneNumber: row.phoneNumber.trim(),
              effectiveDate: parseDateOnly(row.effectiveDate),
              endDate: row.endDate ? parseDateOnly(row.endDate) : null,
              replacedById: null,
              isActive: row.isActive ?? !row.endDate,
              includedInBatch: row.includedInBatch ?? false,
              ...(row.createdAt
                ? { createdAt: parseDateOnly(row.createdAt) }
                : {}),
              ...(row.updatedAt
                ? { updatedAt: parseDateOnly(row.updatedAt) }
                : {}),
            })),
          })
        }
        for (const link of links) {
          await tx.fleetRegistration.update({
            where: { id: link.id },
            data: {
              replacedById: link.replacedById,
              ...(link.updatedAt
                ? { updatedAt: parseDateOnly(link.updatedAt) }
                : {}),
            },
          })
        }
        const withId = validDetails.filter(
          (row): row is FleetImportDetail & { id: number } => row.id != null,
        )
        const withoutId = validDetails.filter((row) => row.id == null)
        for (const rows of [withId, withoutId]) {
          for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            const chunk = rows.slice(i, i + INSERT_CHUNK)
            if (chunk.length === 0) continue
            await tx.fleetRegDetails.createMany({
              data: chunk.map((row) => ({
                ...(row.id != null ? { id: row.id } : {}),
                fleetRegistrationId: row.fleetRegistrationId,
                serviceId: row.serviceId,
                amount: row.amount,
                effectiveDate: parseDateOnly(row.effectiveDate),
              })),
            })
          }
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    )
  }

  const skippedRegistrations =
    input.registrations.length - validRegistrations.length
  const skippedDetails = input.details.length - validDetails.length

  return {
    registrationsInserted: validRegistrations.length,
    detailsInserted: validDetails.length,
    skipped: skippedRegistrations + skippedDetails,
    errors,
  }
}

async function findExistingStrings(
  values: string[],
  load: (chunk: string[]) => Promise<string[]>,
): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < values.length; i += LOOKUP_CHUNK) {
    const chunk = values.slice(i, i + LOOKUP_CHUNK)
    if (chunk.length === 0) continue
    for (const value of await load(chunk)) found.add(value)
  }
  return found
}
