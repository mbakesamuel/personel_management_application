import type {
  FleetImportBatchInput,
  FleetImportDetail,
  FleetImportRegistration,
  FleetImportResult,
} from '@personel-management-app/shared'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

type ImportError = FleetImportResult['errors'][number]

const LOOKUP_CHUNK = 1000
const INSERT_CHUNK = 400

type SnapshotDb = Pick<
  Prisma.TransactionClient,
  'fleetRegDetails' | 'communicatedFleetLine'
>

export type FleetBaselineResult = {
  linesInserted: number
  pairsBaselined: number
}

function pairKey(fleetRegistrationId: number, operatorId: number) {
  return `${fleetRegistrationId}\0${operatorId}`
}

/** Copy fleet lines into the memo snapshot where that registration and operator have none. */
export async function baselineUncommunicatedFleet(
  db: SnapshotDb = prisma,
  onlyPairs?: Set<string>,
): Promise<FleetBaselineResult> {
  if (onlyPairs && onlyPairs.size === 0) {
    return { linesInserted: 0, pairsBaselined: 0 }
  }
  const registrationIds = onlyPairs
    ? [
        ...new Set(
          [...onlyPairs].map((key) => Number(key.slice(0, key.indexOf('\0')))),
        ),
      ]
    : null
  const details: {
    fleetRegistrationId: number
    operator_id: number
    operator_AccountId: number | null
    phoneNumber: string | null
    serviceId: number
    amount: number
  }[] = []
  const snapshots: { fleetRegistrationId: number; operatorId: number }[] = []
  const chunks: (number[] | undefined)[] =
    registrationIds == null
      ? [undefined]
      : Array.from(
          { length: Math.ceil(registrationIds.length / LOOKUP_CHUNK) },
          (_, index) =>
            registrationIds.slice(
              index * LOOKUP_CHUNK,
              (index + 1) * LOOKUP_CHUNK,
            ),
        )
  for (const chunk of chunks) {
    if (chunk && chunk.length === 0) continue
    const where = chunk ? { fleetRegistrationId: { in: chunk } } : undefined
    details.push(
      ...(await db.fleetRegDetails.findMany({
        where,
        select: {
          fleetRegistrationId: true,
          operator_id: true,
          operator_AccountId: true,
          phoneNumber: true,
          serviceId: true,
          amount: true,
        },
      })),
    )
    snapshots.push(
      ...(await db.communicatedFleetLine.findMany({
        where,
        select: { fleetRegistrationId: true, operatorId: true },
      })),
    )
  }
  const snapshotted = new Set(
    snapshots.map((row) => pairKey(row.fleetRegistrationId, row.operatorId)),
  )
  const pending = details.filter((row) => {
    const key = pairKey(row.fleetRegistrationId, row.operator_id)
    if (snapshotted.has(key)) return false
    if (onlyPairs && !onlyPairs.has(key)) return false
    return true
  })
  const pairsBaselined = new Set(
    pending.map((row) => pairKey(row.fleetRegistrationId, row.operator_id)),
  ).size
  let linesInserted = 0
  for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
    const chunk = pending.slice(i, i + INSERT_CHUNK)
    if (chunk.length === 0) continue
    const result = await db.communicatedFleetLine.createMany({
      data: chunk.map((row) => ({
        fleetRegistrationId: row.fleetRegistrationId,
        operatorId: row.operator_id,
        operatorAccountId: row.operator_AccountId,
        phoneNumber: row.phoneNumber,
        serviceId: row.serviceId,
        amount: row.amount,
      })),
      skipDuplicates: true,
    })
    linesInserted += result.count
  }
  return { linesInserted, pairsBaselined }
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function detailPhoneKey(row: {
  fleetRegistrationId: number
  operatorId: number
  phoneNumber: string | null
  serviceId: number
}) {
  return [
    row.fleetRegistrationId,
    row.operatorId,
    row.phoneNumber ?? '',
    row.serviceId,
  ].join('\0')
}

const DUPLICATE_PHONE_ON_SERVICE =
  'This operator already has this phone on that service'

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
  const operatorIds = [
    ...new Set(
      [
        ...registrations.map((row) => row.operatorId),
        ...input.details.map((row) => row.operatorId),
      ].filter((id): id is number => id != null),
    ),
  ]
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
    if (row.operatorId != null && !existingOperators.has(row.operatorId)) {
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

  const registrationById = new Map(registrations.map((row) => [row.id, row]))
  type ImportedDetail = Omit<
    FleetImportDetail,
    'operatorId' | 'accountNo' | 'phoneNumber'
  > & {
    id: number | null
    operatorId: number
    accountNo: string | null
    phoneNumber: string | null
  }
  const validDetails: ImportedDetail[] = []
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
    const parent = registrationById.get(row.fleetRegistrationId)
    const operatorId = row.operatorId ?? parent?.operatorId ?? null
    if (operatorId == null || !existingOperators.has(operatorId)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message:
          operatorId == null
            ? 'Missing operator_id'
            : `Operator ${operatorId} was not found`,
      })
      return
    }
    validDetails.push({
      ...row,
      id: row.id ?? null,
      operatorId,
      accountNo: emptyToNull(row.accountNo) ?? emptyToNull(parent?.accountNo),
      phoneNumber: emptyToNull(row.phoneNumber) ?? emptyToNull(parent?.phoneNumber),
    })
  }
  for (const row of uniqueDetails) considerDetail(row)
  for (const row of detailsWithoutId) considerDetail(row)

  const seenPhones = new Set<string>()
  const uniquePhones: typeof validDetails = []
  for (const row of validDetails) {
    const key = detailPhoneKey(row)
    if (seenPhones.has(key)) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message: DUPLICATE_PHONE_ON_SERVICE,
      })
      continue
    }
    seenPhones.add(key)
    uniquePhones.push(row)
  }
  validDetails.length = 0
  validDetails.push(...uniquePhones)

  const phoneParentIds = [
    ...new Set(validDetails.map((row) => row.fleetRegistrationId)),
  ]
  const storedPhones = new Set<string>()
  for (let i = 0; i < phoneParentIds.length; i += LOOKUP_CHUNK) {
    const chunk = phoneParentIds.slice(i, i + LOOKUP_CHUNK)
    if (chunk.length === 0) continue
    const rows = await prisma.fleetRegDetails.findMany({
      where: { fleetRegistrationId: { in: chunk } },
      select: {
        fleetRegistrationId: true,
        operator_id: true,
        phoneNumber: true,
        serviceId: true,
      },
    })
    for (const row of rows) {
      storedPhones.add(
        detailPhoneKey({
          fleetRegistrationId: row.fleetRegistrationId,
          operatorId: row.operator_id,
          phoneNumber: row.phoneNumber,
          serviceId: row.serviceId,
        }),
      )
    }
  }
  const acceptedPhones: typeof validDetails = []
  for (const row of validDetails) {
    if (storedPhones.has(detailPhoneKey(row))) {
      errors.push({
        sheet: 'fleet_reg_details',
        row: row.row,
        message: DUPLICATE_PHONE_ON_SERVICE,
      })
      continue
    }
    acceptedPhones.push(row)
  }
  validDetails.length = 0
  validDetails.push(...acceptedPhones)

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
              allowanceId: row.allowanceId.trim(),
              appointmentDate: parseDateOnly(row.appointmentDate),
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
        const accountIds = new Map<string, number>()
        for (const row of validDetails) {
          if (!row.accountNo) continue
          const key = `${row.operatorId}\0${row.accountNo}`
          if (accountIds.has(key)) continue
          const existing = await tx.operator_Account.findUnique({
            where: {
              operator_id_accountNo: {
                operator_id: row.operatorId,
                accountNo: row.accountNo,
              },
            },
            select: { id: true },
          })
          const account =
            existing ??
            (await tx.operator_Account.create({
              data: { operator_id: row.operatorId, accountNo: row.accountNo },
              select: { id: true },
            }))
          accountIds.set(key, account.id)
        }
        const withId = validDetails.filter(
          (row): row is (typeof validDetails)[number] & { id: number } =>
            row.id != null,
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
                operator_id: row.operatorId,
                operator_AccountId: row.accountNo
                  ? (accountIds.get(`${row.operatorId}\0${row.accountNo}`) ?? null)
                  : null,
                phoneNumber: row.phoneNumber,
                serviceId: row.serviceId,
                amount: row.amount,
              })),
            })
          }
        }
        await baselineUncommunicatedFleet(
          tx,
          new Set(
            validDetails.map((row) => pairKey(row.fleetRegistrationId, row.operatorId)),
          ),
        )
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
