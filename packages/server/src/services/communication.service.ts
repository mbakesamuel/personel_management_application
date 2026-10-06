import {
  PHONE_OUTSIDE_PREFIX_RANGES,
  phoneMatchesPrefixRanges,
  type CommunicationAmount,
  type CommunicationAmountCreateInput,
  type CommunicationAllowanceOption,
  type CommunicationBatchAction,
  type CommunicationBatchCreateInput,
  type CommunicationDetailsDeleteInput,
  type CommunicationDetailsUpdateInput,
  type CommunicationMemoDraftRow,
  type CommunicationPendingMemo,
  type CommunicationBatchReport,
  type CommunicationBatchSummary,
  type CommunicationOperator,
  type CommunicationOperatorUpsertInput,
  type CommunicationLine,
  type CommunicationRegistration,
  type CommunicationRegistrationCreateInput,
  type CommunicationRegistrationRemoveInput,
  type CommunicationRegistrationTransferInput,
  type CommunicationServiceOption,
  type OperatorAccount,
  type OperatorAccountUpsertInput,
} from '@personel-management-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  formatEmployeeName,
  resolveLiveEmployees,
  unitMatchIds,
} from './live-employee.service.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  parseDate,
} from './personnel-workflow.js'

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

const MEMO_SIGNATORY_UNIT = '160'

async function signatoryAsOf(asOf: Date): Promise<{
  signatoryName: string | null
  signatoryTitle: string | null
}> {
  const row = await prisma.tbl_decision_assignment.findFirst({
    where: {
      level_code: 'UNIT_MANAGER',
      tbl_unit_id: { in: unitMatchIds([MEMO_SIGNATORY_UNIT]) },
      effdate: { lte: asOf },
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return {
    signatoryName: row?.signatory.trim() || null,
    signatoryTitle: row?.title.trim() || null,
  }
}

function employeeName(name: string, firstname: string | null): string {
  return formatEmployeeName(name, firstname)
}

type InForceDetail = {
  id: number
  operatorId: number
  phoneNumber: string | null
  serviceId: number
  amount: number
}

function phoneKey(phoneNumber: string | null): string {
  return phoneNumber ?? ''
}

function inForceKey(detail: {
  operatorId: number
  phoneNumber: string | null
  serviceId: number
}): string {
  return `${detail.operatorId}\0${phoneKey(detail.phoneNumber)}\0${detail.serviceId}`
}

function detailsInForce(details: InForceDetail[]): InForceDetail[] {
  const best = new Map<string, InForceDetail>()
  for (const detail of details) {
    const key = inForceKey(detail)
    const previous = best.get(key)
    if (!previous || detail.id > previous.id) best.set(key, detail)
  }
  return [...best.values()]
}

function inForceTotal(details: InForceDetail[]): number {
  return detailsInForce(details).reduce((sum, detail) => sum + detail.amount, 0)
}

function moneyCents(value: number): number {
  return Math.round(value * 100)
}

function formatPlainMoney(value: number): string {
  const cents = moneyCents(value)
  if (cents % 100 === 0) return String(cents / 100)
  return (cents / 100).toFixed(2)
}

function allocationMismatchMessage(total: number, allocation: number): string {
  return `Amounts in force total ${formatPlainMoney(total)}, but the allowance allocation is ${formatPlainMoney(allocation)}`
}

function toInForceDetail(detail: {
  id: number
  operator_id: number
  phoneNumber: string | null
  serviceId: number
  amount: number
}): InForceDetail {
  return {
    id: detail.id,
    operatorId: detail.operator_id,
    phoneNumber: detail.phoneNumber,
    serviceId: detail.serviceId,
    amount: detail.amount,
  }
}

async function assertOpenRegistrationTotal(
  matricule: string,
  allowanceId: string,
  details: InForceDetail[],
) {
  const allocation = await prisma.tbl_allowance_allocation.findFirst({
    where: {
      matricule,
      allowanceId,
      current: true,
      workflowStatus: 'VALIDATED',
    },
    select: { allowanceAmt: true },
    orderBy: { id: 'desc' },
  })
  if (!allocation) {
    throw new PersonnelConflictError(
      'No current allowance allocation for this employee',
    )
  }
  const total = inForceTotal(details)
  if (moneyCents(total) > moneyCents(allocation.allowanceAmt)) {
    throw new PersonnelConflictError(
      allocationMismatchMessage(total, allocation.allowanceAmt),
    )
  }
}

function amountInForce(
  details: {
    id: number
    serviceId: number
    amount: number
  }[],
  serviceId: number,
): number {
  let best: { id: number; amount: number } | null = null
  for (const detail of details) {
    if (detail.serviceId !== serviceId) continue
    if (!best || detail.id > best.id) best = detail
  }
  return best?.amount ?? 0
}

function serviceAmount(
  line: {
    amounts: { serviceId: number; amount: number }[]
    fleetRegistration: {
      fleetRegDetails: {
        id: number
        serviceId: number
        amount: number
      }[]
    }
  },
  serviceId: number | undefined,
): number {
  if (serviceId == null) return 0
  const changed = line.amounts.find((amount) => amount.serviceId === serviceId)
  if (changed) return changed.amount
  return amountInForce(line.fleetRegistration.fleetRegDetails, serviceId)
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function assertPhoneInRanges(
  phoneNumber: string | null,
  ranges: { rangeStart: string; rangeEnd: string }[],
) {
  if (!phoneNumber) return
  const matches = phoneMatchesPrefixRanges(
    phoneNumber,
    ranges.map((range) => ({ start: range.rangeStart, end: range.rangeEnd })),
  )
  if (!matches) throw new PersonnelConflictError(PHONE_OUTSIDE_PREFIX_RANGES)
}

function latestOperatorDetail<T extends { id: number; operator_id: number }>(
  details: T[],
  operatorId: number,
): T | undefined {
  return details
    .filter((detail) => detail.operator_id === operatorId)
    .sort((left, right) => right.id - left.id)[0]
}

function phoneOrNull(phoneNumber: string): string | null {
  const trimmed = phoneNumber.trim()
  return trimmed.length === 0 ? null : trimmed
}

async function resolveOperatorAccountId(
  operatorId: number,
  usesAccounts: boolean,
  operatorAccountId: number | null | undefined,
): Promise<number | null> {
  if (!usesAccounts) return null
  if (operatorAccountId == null) {
    throw new PersonnelConflictError('Account is required for this operator')
  }
  const account = await prisma.operator_Account.findFirst({
    where: { id: operatorAccountId, operator_id: operatorId },
    select: { id: true },
  })
  if (!account) {
    throw new PersonnelConflictError('Choose an account for this operator')
  }
  return account.id
}

const DUPLICATE_PHONE_ON_SERVICE =
  'This operator already has this phone on that service'

async function assertDetailPhoneAvailable(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    fleetRegistrationId: number
    operatorId: number
    serviceId: number
    phoneNumber: string | null
  },
) {
  const existing = await db.fleetRegDetails.findFirst({
    where: {
      fleetRegistrationId: input.fleetRegistrationId,
      operator_id: input.operatorId,
      serviceId: input.serviceId,
      phoneNumber: input.phoneNumber,
    },
    select: { id: true },
  })
  if (existing) throw new PersonnelConflictError(DUPLICATE_PHONE_ON_SERVICE)
}

function duplicateAccountError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new PersonnelConflictError(
      'This operator already has that account number',
    )
  }
  throw err
}

type ComparedLine = {
  id: number
  operatorAccountId: number | null
  phoneNumber: string | null
  accountNo: string | null
  serviceId: number
  amount: number
}

type MemoDiff = {
  fleetRegistrationId: number
  matricule: string
  employeeName: string
  appointmentDate: Date
  endDate: Date | null
  action: CommunicationBatchAction
  phoneNumber: string
  accountNo: string | null
  airtime: number
  previousAirtime: number | null
  data: number
  previousData: number | null
  amounts: { serviceId: number; previousAmount: number | null; amount: number }[]
  current: {
    operatorAccountId: number | null
    phoneNumber: string | null
    serviceId: number
    amount: number
  }[]
}

function memoAction(
  endDate: Date | null,
  fleetLines: ComparedLine[],
  snapshot: ComparedLine[],
  closure: boolean,
): CommunicationBatchAction | null {
  const closedWithoutSnapshot = endDate != null && snapshot.length === 0
  const current = closure || closedWithoutSnapshot ? [] : fleetLines
  if (current.length === 0 && snapshot.length === 0 && fleetLines.length === 0) return null
  if (!closedWithoutSnapshot && lineSignature(current) === lineSignature(snapshot)) return null
  return current.length === 0 ? 'REMOVAL' : snapshot.length === 0 ? 'CREATION' : 'MODIFICATION'
}

function lineSignature(lines: ComparedLine[]): string {
  return [...lines]
    .map((line) =>
      [phoneKey(line.phoneNumber), line.operatorAccountId ?? '', line.serviceId, line.amount].join(
        '\0',
      ),
    )
    .sort()
    .join('\n')
}

function latestContact(lines: ComparedLine[]): { phoneNumber: string; accountNo: string | null } {
  const latest = [...lines].sort((left, right) => right.id - left.id)[0]
  return {
    phoneNumber: latest?.phoneNumber ?? '',
    accountNo: latest?.accountNo ?? null,
  }
}

function sumService(lines: ComparedLine[], serviceId: number | undefined): number {
  if (serviceId == null) return 0
  return lines
    .filter((line) => line.serviceId === serviceId)
    .reduce((total, line) => total + line.amount, 0)
}

async function prepareBatch(input: CommunicationBatchCreateInput) {
  const operator = await prisma.tbl_operator.findUnique({
    where: { id: input.operatorId },
    select: { id: true, name: true, email: true, phone: true, address: true },
  })
  if (!operator) throw new PersonnelNotFoundError('Operator not found')
  const effectiveDate = parseDate(input.effectiveDate, 'effectiveDate')
  const endDate = parseDate(input.endDate, 'endDate')
  const diffs = await loadMemoDiffs(input.operatorId, input.fleetRegistrationIds)
  const byId = new Map(diffs.map((row) => [row.fleetRegistrationId, row]))
  const lines: MemoDiff[] = []
  for (const id of input.fleetRegistrationIds) {
    const line = byId.get(id)
    if (!line) {
      throw new PersonnelConflictError('A selected line has no change to send')
    }
    if (line.action === 'REMOVAL' && endDate < line.appointmentDate) {
      throw new PersonnelConflictError(
        `End date cannot be before the appointment date for ${line.employeeName}`,
      )
    }
    if (line.action !== 'REMOVAL' && effectiveDate < line.appointmentDate) {
      throw new PersonnelConflictError(
        `Effective date cannot be before the appointment date for ${line.employeeName}`,
      )
    }
    lines.push(line)
  }
  return { operator, effectiveDate, endDate, lines }
}

async function loadMemoDiffs(operatorId: number, onlyIds?: number[]): Promise<MemoDiff[]> {
  const registrationFilter = onlyIds == null ? undefined : { in: onlyIds }
  const [details, snapshots, services] = await Promise.all([
    prisma.fleetRegDetails.findMany({
      where: {
        operator_id: operatorId,
        ...(registrationFilter ? { fleetRegistrationId: registrationFilter } : {}),
      },
      include: { operatorAccount: { select: { accountNo: true } } },
    }),
    prisma.communicatedFleetLine.findMany({
      where: {
        operatorId,
        ...(registrationFilter ? { fleetRegistrationId: registrationFilter } : {}),
      },
      include: { operatorAccount: { select: { accountNo: true } } },
    }),
    prisma.service.findMany({ select: { id: true, name: true } }),
  ])
  const airtimeId = services.find(
    (service) => service.name.trim().toLowerCase() === 'airtime',
  )?.id
  const dataId = services.find((service) => service.name.trim().toLowerCase() === 'data')?.id
  const ids =
    onlyIds ??
    [
      ...new Set([
        ...details.map((row) => row.fleetRegistrationId),
        ...snapshots.map((row) => row.fleetRegistrationId),
      ]),
    ]
  if (ids.length === 0) return []
  const registrations = await prisma.fleetRegistration.findMany({
    where: { id: { in: ids } },
    include: { employee: { select: { name: true, firstname: true } } },
  })
  const byId = new Map(registrations.map((row) => [row.id, row]))
  const currentByRegistration = new Map<number, ComparedLine[]>()
  const snapshotByRegistration = new Map<number, ComparedLine[]>()
  const closureRegistrations = new Set<number>()
  for (const row of details) {
    const bucket = currentByRegistration.get(row.fleetRegistrationId) ?? []
    bucket.push({
      id: row.id,
      operatorAccountId: row.operator_AccountId,
      phoneNumber: row.phoneNumber,
      accountNo: row.operatorAccount?.accountNo ?? null,
      serviceId: row.serviceId,
      amount: row.amount,
    })
    currentByRegistration.set(row.fleetRegistrationId, bucket)
  }
  for (const row of snapshots) {
    if (row.closure) closureRegistrations.add(row.fleetRegistrationId)
    const bucket = snapshotByRegistration.get(row.fleetRegistrationId) ?? []
    bucket.push({
      id: row.id,
      operatorAccountId: row.operatorAccountId,
      phoneNumber: row.phoneNumber,
      accountNo: row.operatorAccount?.accountNo ?? null,
      serviceId: row.serviceId,
      amount: row.amount,
    })
    snapshotByRegistration.set(row.fleetRegistrationId, bucket)
  }
  const diffs: MemoDiff[] = []
  for (const id of ids) {
    const registration = byId.get(id)
    if (!registration) continue
    const snapshot = snapshotByRegistration.get(id) ?? []
    const fleetLines = currentByRegistration.get(id) ?? []
    const action = memoAction(
      registration.endDate,
      fleetLines,
      snapshot,
      closureRegistrations.has(id),
    )
    if (!action) continue
    const closedWithoutSnapshot = registration.endDate != null && snapshot.length === 0
    const current =
      closureRegistrations.has(id) || closedWithoutSnapshot ? [] : fleetLines
    const recorded = snapshot.length > 0 ? snapshot : fleetLines
    const contact = latestContact(recorded)
    const serviceIds = new Set([
      ...current.map((line) => line.serviceId),
      ...snapshot.map((line) => line.serviceId),
    ])
    const amounts =
      action === 'REMOVAL'
        ? []
        : [...serviceIds].flatMap((serviceId) => {
            const amount = sumService(current, serviceId)
            const previous = sumService(snapshot, serviceId)
            if (action === 'CREATION' && amount === 0) return []
            if (action === 'MODIFICATION' && amount === 0 && previous === 0) return []
            return [
              {
                serviceId,
                previousAmount: action === 'CREATION' ? null : previous,
                amount,
              },
            ]
          })
    diffs.push({
      fleetRegistrationId: id,
      matricule: registration.matricule,
      employeeName: registration.employee
        ? employeeName(registration.employee.name, registration.employee.firstname)
        : registration.matricule,
      appointmentDate: registration.appointmentDate,
      endDate: registration.endDate,
      action,
      phoneNumber: contact.phoneNumber,
      accountNo: contact.accountNo,
      airtime: sumService(current, airtimeId),
      previousAirtime: action === 'CREATION' ? null : sumService(recorded, airtimeId),
      data: sumService(current, dataId),
      previousData: action === 'CREATION' ? null : sumService(recorded, dataId),
      amounts,
      current: current.map((line) => ({
        operatorAccountId: line.operatorAccountId,
        phoneNumber: line.phoneNumber,
        serviceId: line.serviceId,
        amount: line.amount,
      })),
    })
  }
  diffs.sort((left, right) => left.employeeName.localeCompare(right.employeeName))
  return diffs
}

function toComparedLine(row: {
  id: number
  operatorAccountId: number | null
  phoneNumber: string | null
  serviceId: number
  amount: number
}): ComparedLine {
  return {
    id: row.id,
    operatorAccountId: row.operatorAccountId,
    phoneNumber: row.phoneNumber,
    accountNo: null,
    serviceId: row.serviceId,
    amount: row.amount,
  }
}

async function countPendingMemos(): Promise<CommunicationPendingMemo[]> {
  const [operators, details, snapshots, registrations] = await Promise.all([
    prisma.tbl_operator.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.fleetRegDetails.findMany({
      select: {
        id: true,
        fleetRegistrationId: true,
        operator_id: true,
        operator_AccountId: true,
        phoneNumber: true,
        serviceId: true,
        amount: true,
      },
    }),
    prisma.communicatedFleetLine.findMany({
      select: {
        id: true,
        fleetRegistrationId: true,
        operatorId: true,
        operatorAccountId: true,
        phoneNumber: true,
        serviceId: true,
        amount: true,
        closure: true,
      },
    }),
    prisma.fleetRegistration.findMany({
      select: { id: true, endDate: true },
    }),
  ])

  const endDateById = new Map(registrations.map((row) => [row.id, row.endDate]))
  const currentByOperator = new Map<number, Map<number, ComparedLine[]>>()
  const snapshotByOperator = new Map<number, Map<number, ComparedLine[]>>()
  const closures = new Set<string>()

  for (const row of details) {
    const byRegistration = currentByOperator.get(row.operator_id) ?? new Map()
    const lines = byRegistration.get(row.fleetRegistrationId) ?? []
    lines.push(
      toComparedLine({
        id: row.id,
        operatorAccountId: row.operator_AccountId,
        phoneNumber: row.phoneNumber,
        serviceId: row.serviceId,
        amount: row.amount,
      }),
    )
    byRegistration.set(row.fleetRegistrationId, lines)
    currentByOperator.set(row.operator_id, byRegistration)
  }

  for (const row of snapshots) {
    if (row.closure) closures.add(`${row.operatorId}:${row.fleetRegistrationId}`)
    const byRegistration = snapshotByOperator.get(row.operatorId) ?? new Map()
    const lines = byRegistration.get(row.fleetRegistrationId) ?? []
    lines.push(
      toComparedLine({
        id: row.id,
        operatorAccountId: row.operatorAccountId,
        phoneNumber: row.phoneNumber,
        serviceId: row.serviceId,
        amount: row.amount,
      }),
    )
    byRegistration.set(row.fleetRegistrationId, lines)
    snapshotByOperator.set(row.operatorId, byRegistration)
  }

  const counts = operators.map((operator) => {
    const current = currentByOperator.get(operator.id) ?? new Map()
    const snapshot = snapshotByOperator.get(operator.id) ?? new Map()
    const ids = new Set([...current.keys(), ...snapshot.keys()])
    let creations = 0
    let modifications = 0
    let removals = 0
    for (const id of ids) {
      if (!endDateById.has(id)) continue
      const action = memoAction(
        endDateById.get(id) ?? null,
        current.get(id) ?? [],
        snapshot.get(id) ?? [],
        closures.has(`${operator.id}:${id}`),
      )
      if (action === 'CREATION') creations += 1
      else if (action === 'MODIFICATION') modifications += 1
      else if (action === 'REMOVAL') removals += 1
    }
    return { operatorId: operator.id, name: operator.name, creations, modifications, removals }
  })

  return counts
    .filter((row) => row.creations + row.modifications + row.removals > 0)
    .sort(
      (left, right) =>
        right.creations +
          right.modifications +
          right.removals -
          (left.creations + left.modifications + left.removals) ||
        left.name.localeCompare(right.name),
    )
}

async function replacePrefixes(
  operatorId: number,
  prefixes: CommunicationOperatorUpsertInput['prefixes'],
) {
  await prisma.number_prefix.deleteMany({ where: { operator_id: operatorId } })
  if (prefixes.length === 0) return
  await prisma.number_prefix.createMany({
    data: prefixes.map((range) => ({
      rangeStart: range.start.trim(),
      rangeEnd: range.end.trim(),
      operator_id: operatorId,
      isActive: true,
    })),
  })
}

export const communicationService = {
  async listOperators(): Promise<CommunicationOperator[]> {
    const rows = await prisma.tbl_operator.findMany({
      include: { numberPrefixes: { orderBy: { rangeStart: 'asc' } } },
      orderBy: { name: 'asc' },
    })
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      isActive: row.isActive,
      usesAccounts: row.usesAccounts,
      prefixes: row.numberPrefixes.map((prefix) => ({
        start: prefix.rangeStart,
        end: prefix.rangeEnd,
      })),
    }))
  },

  async createOperator(
    input: CommunicationOperatorUpsertInput,
  ): Promise<CommunicationOperator> {
    const row = await prisma.tbl_operator.create({
      data: {
        name: input.name.trim(),
        email: blankToNull(input.email),
        phone: blankToNull(input.phone),
        address: blankToNull(input.address),
        isActive: input.isActive,
        usesAccounts: input.usesAccounts,
      },
    })
    await replacePrefixes(row.id, input.usesAccounts ? input.prefixes : [])
    const [created] = await this.listOperators().then((rows) =>
      rows.filter((item) => item.id === row.id),
    )
    return created!
  },

  async updateOperator(
    id: number,
    input: CommunicationOperatorUpsertInput,
  ): Promise<CommunicationOperator> {
    const existing = await prisma.tbl_operator.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Operator not found')
    await prisma.tbl_operator.update({
      where: { id },
      data: {
        name: input.name.trim(),
        email: blankToNull(input.email),
        phone: blankToNull(input.phone),
        address: blankToNull(input.address),
        isActive: input.isActive,
        usesAccounts: input.usesAccounts,
      },
    })
    await replacePrefixes(id, input.usesAccounts ? input.prefixes : [])
    const [updated] = await this.listOperators().then((rows) =>
      rows.filter((item) => item.id === id),
    )
    return updated!
  },

  async listOperatorAccounts(): Promise<OperatorAccount[]> {
    const rows = await prisma.operator_Account.findMany({
      include: { operator: { select: { name: true } } },
      orderBy: [{ operator: { name: 'asc' } }, { accountNo: 'asc' }],
    })
    return rows.map((row) => ({
      id: row.id,
      operatorId: row.operator_id,
      operatorName: row.operator?.name ?? '',
      accountNo: row.accountNo,
    }))
  },

  async createOperatorAccount(
    input: OperatorAccountUpsertInput,
  ): Promise<OperatorAccount> {
    const operator = await prisma.tbl_operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true },
    })
    if (!operator) throw new PersonnelNotFoundError('Operator not found')
    try {
      const row = await prisma.operator_Account.create({
        data: {
          operator_id: input.operatorId,
          accountNo: input.accountNo.trim(),
        },
      })
      const [created] = await this.listOperatorAccounts().then((rows) =>
        rows.filter((item) => item.id === row.id),
      )
      return created!
    } catch (err) {
      duplicateAccountError(err)
    }
  },

  async updateOperatorAccount(
    id: number,
    input: OperatorAccountUpsertInput,
  ): Promise<OperatorAccount> {
    const existing = await prisma.operator_Account.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Account not found')
    const operator = await prisma.tbl_operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true },
    })
    if (!operator) throw new PersonnelNotFoundError('Operator not found')
    if (existing.operator_id !== input.operatorId) {
      const used = await prisma.fleetRegDetails.count({
        where: { operator_AccountId: id },
      })
      if (used > 0) {
        throw new PersonnelConflictError(
          'This account is used by a registration',
        )
      }
    }
    try {
      await prisma.operator_Account.update({
        where: { id },
        data: {
          operator_id: input.operatorId,
          accountNo: input.accountNo.trim(),
        },
      })
    } catch (err) {
      duplicateAccountError(err)
    }
    const [updated] = await this.listOperatorAccounts().then((rows) =>
      rows.filter((item) => item.id === id),
    )
    return updated!
  },

  async deleteOperatorAccount(id: number): Promise<void> {
    const existing = await prisma.operator_Account.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Account not found')
    const used = await prisma.fleetRegDetails.count({
      where: { operator_AccountId: id },
    })
    if (used > 0) {
      throw new PersonnelConflictError(
        'This account is used by a registration',
      )
    }
    await prisma.operator_Account.delete({ where: { id } })
  },

  async listServices(): Promise<CommunicationServiceOption[]> {
    const rows = await prisma.service.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => ({ id: row.id, name: row.name }))
  },

  async listAllowances(): Promise<CommunicationAllowanceOption[]> {
    const rows = await prisma.tbl_allowance.findMany({
      where: {
        workflowStatus: 'VALIDATED',
        allowanceName: { contains: 'communication' },
      },
      orderBy: { allowanceName: 'asc' },
      select: { id: true, allowanceName: true },
    })
    return rows
  },

  async listRegistrations(): Promise<CommunicationRegistration[]> {
    const rows = await prisma.fleetRegistration.findMany({
      include: {
        employee: { select: { name: true, firstname: true } },
        allowance: { select: { allowanceName: true } },
        fleetRegDetails: {
          select: {
            operator_id: true,
            operator: { select: { name: true } },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { appointmentDate: 'desc' }],
    })
    const matricules = [...new Set(rows.map((row) => row.matricule))]
    const allocations =
      matricules.length === 0
        ? []
        : await prisma.tbl_allowance_allocation.findMany({
            where: {
              matricule: { in: matricules },
              current: true,
              workflowStatus: 'VALIDATED',
            },
            select: { matricule: true, allowanceId: true, allowanceAmt: true },
            orderBy: { id: 'desc' },
          })
    const allowanceAmounts = new Map<string, number>()
    for (const allocation of allocations) {
      const key = `${allocation.matricule}\0${allocation.allowanceId}`
      if (!allowanceAmounts.has(key)) {
        allowanceAmounts.set(key, allocation.allowanceAmt)
      }
    }
    return rows.map((row) => {
      const operators = new Map<number, string>()
      for (const detail of row.fleetRegDetails) {
        if (!operators.has(detail.operator_id)) {
          operators.set(detail.operator_id, detail.operator?.name ?? '')
        }
      }
      return {
        id: row.id,
        matricule: row.matricule,
        employeeName: row.employee
          ? employeeName(row.employee.name, row.employee.firstname)
          : row.matricule,
        operators: [...operators.entries()].map(([id, name]) => ({ id, name })),
        allowanceId: row.allowanceId,
        allowanceName: row.allowance?.allowanceName ?? '',
        allowanceAmt:
          allowanceAmounts.get(`${row.matricule}\0${row.allowanceId}`) ?? null,
        appointmentDate: toDateOnly(row.appointmentDate),
        endDate: row.endDate ? toDateOnly(row.endDate) : null,
        isActive: row.isActive,
        replacedById: row.replacedById,
        includedInBatch: row.includedInBatch,
        createdAt: toDateOnly(row.createdAt),
      }
    })
  },

  async createRegistration(
    input: CommunicationRegistrationCreateInput,
  ): Promise<CommunicationRegistration> {
    const matricule = input.matricule.trim()
    const employee = await prisma.tbl_employee.findUnique({
      where: { matricule },
      select: { matricule: true, active: true },
    })
    if (!employee) throw new PersonnelNotFoundError('Employee not found')
    if (!employee.active) {
      throw new PersonnelConflictError('Employee is not active')
    }
    const allowance = await prisma.tbl_allowance.findUnique({
      where: { id: input.allowanceId },
      select: { workflowStatus: true, allowanceName: true },
    })
    if (!allowance || allowance.workflowStatus !== 'VALIDATED') {
      throw new PersonnelConflictError('Choose a validated allowance')
    }
    if (!allowance.allowanceName.toLowerCase().includes('communication')) {
      throw new PersonnelConflictError('Choose a communication allowance')
    }
    const open = await prisma.fleetRegistration.findFirst({
      where: { matricule, endDate: null },
      select: { id: true },
    })
    if (open) {
      throw new PersonnelConflictError(
        'This employee already has an open registration',
      )
    }
    const created = await prisma.fleetRegistration.create({
      data: {
        matricule,
        allowanceId: input.allowanceId,
        appointmentDate: parseDate(input.appointmentDate, 'appointmentDate'),
        isActive: true,
      },
    })
    const [row] = await this.listRegistrations().then((rows) =>
      rows.filter((item) => item.id === created.id),
    )
    return row!
  },

  async removeRegistration(
    id: number,
    input: CommunicationRegistrationRemoveInput,
  ): Promise<CommunicationRegistration> {
    const existing = await prisma.fleetRegistration.findUnique({ where: { id } })
    if (!existing) throw new PersonnelNotFoundError('Registration not found')
    if (existing.endDate) {
      throw new PersonnelConflictError('Registration is already closed')
    }
    const endDate = parseDate(input.endDate, 'endDate')
    if (endDate < existing.appointmentDate) {
      throw new PersonnelConflictError(
        'End date cannot be before the appointment date',
      )
    }
    const details = await prisma.fleetRegDetails.findMany({
      where: { fleetRegistrationId: id },
    })
    await prisma.$transaction(async (tx) => {
      await tx.fleetRegistration.update({
        where: { id },
        data: { endDate, isActive: false },
      })
      await tx.communicatedFleetLine.deleteMany({
        where: { fleetRegistrationId: id },
      })
      if (details.length > 0) {
        await tx.communicatedFleetLine.createMany({
          data: details.map((row) => ({
            fleetRegistrationId: id,
            operatorId: row.operator_id,
            operatorAccountId: row.operator_AccountId,
            phoneNumber: row.phoneNumber,
            serviceId: row.serviceId,
            amount: row.amount,
            closure: true,
          })),
        })
      }
    })
    const [row] = await this.listRegistrations().then((rows) =>
      rows.filter((item) => item.id === id),
    )
    return row!
  },

  async transferDetails(
    input: CommunicationRegistrationTransferInput,
  ): Promise<CommunicationAmount[]> {
    const detailIds = [...new Set(input.detailIds)]
    const details = await prisma.fleetRegDetails.findMany({
      where: { id: { in: detailIds } },
      select: {
        id: true,
        amount: true,
        fleetRegistrationId: true,
        operator_id: true,
        serviceId: true,
        fleetRegistration: { select: { endDate: true } },
      },
    })
    if (details.length !== detailIds.length) {
      throw new PersonnelNotFoundError('Amount line not found')
    }
    const registrationIds = new Set(details.map((detail) => detail.fleetRegistrationId))
    if (registrationIds.size !== 1) {
      throw new PersonnelConflictError('Select lines from the same registration')
    }
    const registrationId = details[0]!.fleetRegistrationId
    if (details[0]!.fleetRegistration.endDate) {
      throw new PersonnelConflictError('Registration is already closed')
    }
    if (details.some((detail) => detail.operator_id === input.operatorId)) {
      throw new PersonnelConflictError(
        'Choose an operator that is not already on the selected lines',
      )
    }
    const operator = await prisma.tbl_operator.findUnique({
      where: { id: input.operatorId },
      select: {
        isActive: true,
        usesAccounts: true,
        numberPrefixes: { select: { rangeStart: true, rangeEnd: true } },
      },
    })
    if (!operator || !operator.isActive) {
      throw new PersonnelNotFoundError('Operator not found')
    }
    const phoneNumber = phoneOrNull(input.phoneNumber)
    assertPhoneInRanges(phoneNumber, operator.numberPrefixes)
    const operatorAccountId = await resolveOperatorAccountId(
      input.operatorId,
      operator.usesAccounts,
      input.operatorAccountId,
    )
    const serviceIds = [...new Set(details.map((detail) => detail.serviceId))]
    const existing = await prisma.fleetRegDetails.findMany({
      where: {
        fleetRegistrationId: registrationId,
        id: { notIn: detailIds },
        operator_id: input.operatorId,
        serviceId: { in: serviceIds },
        phoneNumber,
      },
      select: { id: true, serviceId: true, amount: true },
      orderBy: { id: 'desc' },
    })
    const existingByService = new Map<number, { id: number; amount: number }>()
    for (const row of existing) {
      if (!existingByService.has(row.serviceId)) {
        existingByService.set(row.serviceId, row)
      }
    }
    const byService = new Map<number, typeof details>()
    for (const detail of details) {
      const group = byService.get(detail.serviceId) ?? []
      group.push(detail)
      byService.set(detail.serviceId, group)
    }

    const survivorIds: number[] = []
    const deleteIds: number[] = []
    const updates: { id: number; amount: number }[] = []
    for (const [serviceId, group] of byService) {
      const sum = group.reduce((total, row) => total + row.amount, 0)
      const occupied = existingByService.get(serviceId)
      if (occupied) {
        updates.push({ id: occupied.id, amount: occupied.amount + sum })
        survivorIds.push(occupied.id)
        deleteIds.push(...group.map((row) => row.id))
        continue
      }
      const keeper = [...group].sort((left, right) => left.id - right.id)[0]!
      updates.push({ id: keeper.id, amount: sum })
      survivorIds.push(keeper.id)
      deleteIds.push(...group.filter((row) => row.id !== keeper.id).map((row) => row.id))
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (deleteIds.length > 0) {
          await tx.fleetRegDetails.deleteMany({ where: { id: { in: deleteIds } } })
        }
        for (const update of updates) {
          await tx.fleetRegDetails.update({
            where: { id: update.id },
            data: {
              operator_id: input.operatorId,
              operator_AccountId: operatorAccountId,
              phoneNumber,
              amount: update.amount,
            },
          })
        }
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new PersonnelConflictError(DUPLICATE_PHONE_ON_SERVICE)
      }
      throw err
    }

    const updated = new Set(survivorIds)
    return this.listAmounts().then((rows) => rows.filter((row) => updated.has(row.id)))
  },

  async updateDetails(input: CommunicationDetailsUpdateInput): Promise<CommunicationAmount[]> {
    const ids = input.lines.map((line) => line.id)
    if (new Set(ids).size !== ids.length) {
      throw new PersonnelConflictError('A line can only be included once')
    }
    const details = await prisma.fleetRegDetails.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        fleetRegistrationId: true,
        fleetRegistration: {
          select: { endDate: true, matricule: true, allowanceId: true },
        },
      },
    })
    if (details.length !== ids.length) {
      throw new PersonnelNotFoundError('Amount line not found')
    }
    const registrationIds = new Set(details.map((detail) => detail.fleetRegistrationId))
    if (registrationIds.size !== 1) {
      throw new PersonnelConflictError('Select lines from the same registration')
    }
    const registration = details[0]!.fleetRegistration
    if (registration.endDate) {
      throw new PersonnelConflictError('Cannot change amounts on a closed registration')
    }
    const registrationId = details[0]!.fleetRegistrationId
    const existing = await prisma.fleetRegDetails.findMany({
      where: { fleetRegistrationId: registrationId },
    })
    const amounts = new Map(input.lines.map((line) => [line.id, line.amount]))
    const projected = existing.map((row) => {
      const next = amounts.get(row.id)
      const detail = toInForceDetail(row)
      return next == null ? detail : { ...detail, amount: next }
    })
    await assertOpenRegistrationTotal(
      registration.matricule,
      registration.allowanceId,
      projected,
    )
    try {
      await prisma.$transaction(async (tx) => {
        for (const line of input.lines) {
          await tx.fleetRegDetails.update({
            where: { id: line.id },
            data: { amount: line.amount },
          })
        }
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new PersonnelConflictError(DUPLICATE_PHONE_ON_SERVICE)
      }
      throw err
    }
    const updated = new Set(ids)
    return this.listAmounts().then((rows) => rows.filter((row) => updated.has(row.id)))
  },

  async deleteDetails(input: CommunicationDetailsDeleteInput): Promise<{ deleted: number }> {
    const ids = [...new Set(input.detailIds)]
    const details = await prisma.fleetRegDetails.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        fleetRegistrationId: true,
        fleetRegistration: { select: { endDate: true } },
      },
    })
    if (details.length !== ids.length) {
      throw new PersonnelNotFoundError('Amount line not found')
    }
    const registrationIds = new Set(details.map((detail) => detail.fleetRegistrationId))
    if (registrationIds.size !== 1) {
      throw new PersonnelConflictError('Select lines from the same registration')
    }
    if (details[0]!.fleetRegistration.endDate) {
      throw new PersonnelConflictError('Cannot change amounts on a closed registration')
    }
    const result = await prisma.fleetRegDetails.deleteMany({ where: { id: { in: ids } } })
    return { deleted: result.count }
  },

  async listAmounts(): Promise<CommunicationAmount[]> {
    const rows = await prisma.fleetRegDetails.findMany({
      include: {
        service: { select: { name: true } },
        operator: { select: { name: true } },
        operatorAccount: { select: { accountNo: true } },
        fleetRegistration: {
          include: {
            employee: { select: { name: true, firstname: true } },
          },
        },
      },
      orderBy: [{ id: 'desc' }],
    })
    return rows.map((row) => ({
      id: row.id,
      fleetRegistrationId: row.fleetRegistrationId,
      matricule: row.fleetRegistration.matricule,
      employeeName: row.fleetRegistration.employee
        ? employeeName(
            row.fleetRegistration.employee.name,
            row.fleetRegistration.employee.firstname,
          )
        : row.fleetRegistration.matricule,
      operatorId: row.operator_id,
      operatorName: row.operator?.name ?? '',
      accountNo: row.operatorAccount?.accountNo ?? null,
      phoneNumber: row.phoneNumber ?? '',
      serviceId: row.serviceId,
      serviceName: row.service.name,
      amount: row.amount,
      current: true,
    }))
  },

  async listLines(): Promise<CommunicationLine[]> {
    const registrations = await prisma.fleetRegistration.findMany({
      where: { endDate: null },
      include: {
        employee: { select: { name: true, firstname: true } },
        fleetRegDetails: {
          include: {
            service: { select: { name: true } },
            operator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ matricule: 'asc' }, { id: 'asc' }],
    })
    const live = await resolveLiveEmployees(
      registrations.map((row) => row.matricule),
    )
    return registrations.flatMap((row) => {
      const person = live.get(row.matricule)
      const byOperator = new Map<number, typeof row.fleetRegDetails>()
      for (const detail of row.fleetRegDetails) {
        const bucket = byOperator.get(detail.operator_id) ?? []
        bucket.push(detail)
        byOperator.set(detail.operator_id, bucket)
      }
      return [...byOperator.entries()].map(([operatorId, details]) => {
        const latest = [...details].sort((left, right) => right.id - left.id)[0]
        const airtimeDetails = details.filter(
          (detail) => detail.service.name.trim().toLowerCase() === 'airtime',
        )
        const dataDetails = details.filter(
          (detail) => detail.service.name.trim().toLowerCase() === 'data',
        )
        return {
          id: row.id,
          matricule: row.matricule,
          employeeName:
            person?.names ??
            (row.employee
              ? employeeName(row.employee.name, row.employee.firstname)
              : row.matricule),
          position: person?.designation ?? null,
          phoneNumber: latest?.phoneNumber ?? '',
          operatorId,
          operatorName: latest?.operator?.name ?? '',
          airtime: airtimeDetails[0]
            ? amountInForce(airtimeDetails, airtimeDetails[0].serviceId)
            : 0,
          data: dataDetails[0]
            ? amountInForce(dataDetails, dataDetails[0].serviceId)
            : 0,
          groupName: person?.groupName ?? null,
          unitName: person?.unitName ?? null,
        }
      })
    })
  },

  async createAmount(
    input: CommunicationAmountCreateInput,
  ): Promise<CommunicationAmount> {
    const registration = await prisma.fleetRegistration.findUnique({
      where: { id: input.fleetRegistrationId },
      include: { fleetRegDetails: true },
    })
    if (!registration) throw new PersonnelNotFoundError('Registration not found')
    if (registration.endDate) {
      throw new PersonnelConflictError(
        'Cannot change amounts on a closed registration',
      )
    }
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true },
    })
    if (!service) throw new PersonnelNotFoundError('Service not found')
    const operator = await prisma.tbl_operator.findUnique({
      where: { id: input.operatorId },
      select: {
        id: true,
        isActive: true,
        usesAccounts: true,
        numberPrefixes: { select: { rangeStart: true, rangeEnd: true } },
      },
    })
    if (!operator || !operator.isActive) {
      throw new PersonnelNotFoundError('Operator not found')
    }
    assertPhoneInRanges(phoneOrNull(input.phoneNumber), operator.numberPrefixes)
    const operatorAccountId = await resolveOperatorAccountId(
      input.operatorId,
      operator.usesAccounts,
      input.operatorAccountId,
    )
    const phoneNumber = phoneOrNull(input.phoneNumber)
    const existingRow = registration.fleetRegDetails.find(
      (detail) =>
        detail.operator_id === input.operatorId &&
        phoneKey(detail.phoneNumber) === phoneKey(phoneNumber) &&
        detail.serviceId === service.id,
    )
    const existing = registration.fleetRegDetails.map(toInForceDetail)
    const nextId = existing.reduce((max, row) => Math.max(max, row.id), 0) + 1
    const newDetail: InForceDetail = {
      id: existingRow?.id ?? nextId,
      operatorId: input.operatorId,
      phoneNumber,
      serviceId: service.id,
      amount: input.amount,
    }
    const projected = existing.filter((row) => inForceKey(row) !== inForceKey(newDetail))
    projected.push(newDetail)
    const adjustmentWrites: Array<{ id: number; amount: number }> = []
    for (const adjustment of input.adjustments ?? []) {
      const source = registration.fleetRegDetails.find((row) => row.id === adjustment.detailId)
      if (!source) throw new PersonnelNotFoundError('Amount not found')
      const slice = toInForceDetail(source)
      if (inForceKey(slice) === inForceKey(newDetail)) {
        throw new PersonnelConflictError('Adjust that amount on the new line')
      }
      const index = projected.findIndex((row) => row.id === source.id)
      if (index < 0) throw new PersonnelConflictError('That amount is not in force')
      if (moneyCents(adjustment.amount) === moneyCents(projected[index].amount)) continue
      projected[index] = { ...projected[index], amount: adjustment.amount }
      adjustmentWrites.push({ id: source.id, amount: adjustment.amount })
    }
    await assertOpenRegistrationTotal(
      registration.matricule,
      registration.allowanceId,
      projected,
    )
    const created = await prisma.$transaction(async (tx) => {
      const row = existingRow
        ? await tx.fleetRegDetails.update({
            where: { id: existingRow.id },
            data: {
              operator_AccountId: operatorAccountId,
              amount: input.amount,
            },
          })
        : await tx.fleetRegDetails.create({
            data: {
              fleetRegistrationId: registration.id,
              operator_id: input.operatorId,
              operator_AccountId: operatorAccountId,
              phoneNumber,
              serviceId: service.id,
              amount: input.amount,
            },
          })
      for (const adjustment of adjustmentWrites) {
        await tx.fleetRegDetails.update({
          where: { id: adjustment.id },
          data: { amount: adjustment.amount },
        })
      }
      return row
    })
    const [row] = await this.listAmounts().then((rows) =>
      rows.filter((item) => item.id === created.id),
    )
    return row!
  },

  async listBatches(operatorId?: number): Promise<CommunicationBatchSummary[]> {
    const rows = await prisma.communicationBatch.findMany({
      where: operatorId == null ? undefined : { operatorId },
      include: {
        operator: { select: { name: true } },
        lines: {
          orderBy: { id: 'asc' },
          select: {
            action: true,
            fleetRegistration: {
              select: {
                matricule: true,
                employee: { select: { name: true, firstname: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((row) => {
      const employeeNames: string[] = []
      const seen = new Set<string>()
      for (const line of row.lines) {
        const registration = line.fleetRegistration
        const name = registration.employee
          ? employeeName(registration.employee.name, registration.employee.firstname)
          : registration.matricule
        if (seen.has(name)) continue
        seen.add(name)
        employeeNames.push(name)
      }
      return {
        id: row.id,
        operatorId: row.operatorId,
        operatorName: row.operator.name,
        effectiveDate: toDateOnly(row.effectiveDate),
        endDate: toDateOnly(row.endDate),
        createdAt: toDateOnly(row.createdAt),
        modificationCount: row.lines.filter((line) => line.action === 'MODIFICATION').length,
        removalCount: row.lines.filter((line) => line.action === 'REMOVAL').length,
        inclusionCount: row.lines.filter((line) => line.action === 'CREATION').length,
        employeeNames,
      }
    })
  },

  async getBatch(id: number): Promise<CommunicationBatchReport> {
    const [row, services] = await Promise.all([
      prisma.communicationBatch.findUnique({
        where: { id },
        include: {
          operator: { select: { name: true, email: true, phone: true, address: true } },
          lines: {
            include: {
              fleetRegistration: {
                include: {
                  employee: { select: { name: true, firstname: true } },
                  fleetRegDetails: {
                    include: {
                      operatorAccount: { select: { accountNo: true } },
                    },
                  },
                },
              },
              amounts: { include: { service: { select: { name: true } } } },
            },
            orderBy: { id: 'asc' },
          },
        },
      }),
      prisma.service.findMany({ select: { id: true, name: true } }),
    ])
    if (!row) throw new PersonnelNotFoundError('Batch not found')
    const live = await resolveLiveEmployees(
      row.lines.map((line) => line.fleetRegistration.matricule),
    )
    const designationOf = (matricule: string) =>
      live.get(matricule)?.designation ?? null
    const airtimeId = services.find(
      (service) => service.name.trim().toLowerCase() === 'airtime',
    )?.id
    const dataId = services.find(
      (service) => service.name.trim().toLowerCase() === 'data',
    )?.id
    const modifications = row.lines
      .filter((line) => line.action === 'MODIFICATION')
      .flatMap((line) => {
        const registration = line.fleetRegistration
        const person = registration.employee
          ? employeeName(registration.employee.name, registration.employee.firstname)
          : registration.matricule
        const contact = latestOperatorDetail(
          registration.fleetRegDetails,
          row.operatorId,
        )
        return line.amounts.map((amount) => ({
          employeeName: person,
          matricule: registration.matricule,
          designation: designationOf(registration.matricule),
          phoneNumber: line.phoneNumber || contact?.phoneNumber || '',
          accountNo: line.accountNo ?? contact?.operatorAccount?.accountNo ?? null,
          serviceName: amount.service.name,
          previousAmount: amount.previousAmount,
          amount: amount.amount,
        }))
      })
    const removals = row.lines
      .filter((line) => line.action === 'REMOVAL')
      .map((line) => {
        const registration = line.fleetRegistration
        const person = registration.employee
          ? employeeName(registration.employee.name, registration.employee.firstname)
          : registration.matricule
        const contact = latestOperatorDetail(
          registration.fleetRegDetails,
          row.operatorId,
        )
        return {
          employeeName: person,
          matricule: registration.matricule,
          designation: designationOf(registration.matricule),
          phoneNumber: line.phoneNumber || contact?.phoneNumber || '',
          accountNo: line.accountNo ?? contact?.operatorAccount?.accountNo ?? null,
          endDate: toDateOnly(row.endDate),
        }
      })
    const packageRows = (action: 'MODIFICATION' | 'CREATION') =>
      row.lines
        .filter((line) => line.action === action)
        .map((line) => {
          const registration = line.fleetRegistration
          const person = registration.employee
            ? employeeName(registration.employee.name, registration.employee.firstname)
            : registration.matricule
          const contact = latestOperatorDetail(
            registration.fleetRegDetails,
            row.operatorId,
          )
          const operatorLine = {
            amounts: line.amounts,
            fleetRegistration: {
              fleetRegDetails: registration.fleetRegDetails.filter(
                (detail) => detail.operator_id === row.operatorId,
              ),
            },
          }
          const airtime = serviceAmount(operatorLine, airtimeId)
          const data = serviceAmount(operatorLine, dataId)
          return {
            employeeName: person,
            matricule: registration.matricule,
            designation: designationOf(registration.matricule),
            phoneNumber: line.phoneNumber || contact?.phoneNumber || '',
            accountNo: line.accountNo ?? contact?.operatorAccount?.accountNo ?? null,
            airtime,
            data,
            total: airtime + data,
          }
        })
    const adjustments = packageRows('MODIFICATION')
    const creations = packageRows('CREATION')
    const signatory = await signatoryAsOf(row.createdAt)
    return {
      id: row.id,
      operatorId: row.operatorId,
      operatorName: row.operator.name,
      operatorEmail: row.operator.email,
      operatorPhone: row.operator.phone,
      operatorAddress: row.operator.address,
      effectiveDate: toDateOnly(row.effectiveDate),
      endDate: toDateOnly(row.endDate),
      createdAt: toDateOnly(row.createdAt),
      signatoryName: signatory.signatoryName,
      signatoryTitle: signatory.signatoryTitle,
      modifications,
      removals,
      adjustments,
      creations,
    }
  },

  async pendingMemoCounts(): Promise<CommunicationPendingMemo[]> {
    return countPendingMemos()
  },

  async listMemoDraft(operatorId: number): Promise<CommunicationMemoDraftRow[]> {
    const diffs = await loadMemoDiffs(operatorId)
    return diffs.map((row) => ({
      fleetRegistrationId: row.fleetRegistrationId,
      employeeName: row.employeeName,
      matricule: row.matricule,
      phoneNumber: row.phoneNumber,
      accountNo: row.accountNo,
      action: row.action,
      airtime: row.airtime,
      previousAirtime: row.previousAirtime,
      data: row.data,
      previousData: row.previousData,
      endDate: row.endDate ? toDateOnly(row.endDate) : null,
    }))
  },

  async previewBatch(
    input: CommunicationBatchCreateInput,
  ): Promise<CommunicationBatchReport> {
    const prepared = await prepareBatch(input)
    const live = await resolveLiveEmployees(prepared.lines.map((line) => line.matricule))
    const designationOf = (matricule: string) => live.get(matricule)?.designation ?? null
    const services = await prisma.service.findMany({ select: { id: true, name: true } })
    const serviceNames = new Map(services.map((service) => [service.id, service.name]))
    const createdAt = new Date()
    const signatory = await signatoryAsOf(createdAt)
    const packageRows = (action: 'MODIFICATION' | 'CREATION') =>
      prepared.lines
        .filter((line) => line.action === action)
        .map((line) => ({
          employeeName: line.employeeName,
          matricule: line.matricule,
          designation: designationOf(line.matricule),
          phoneNumber: line.phoneNumber,
          accountNo: line.accountNo,
          airtime: line.airtime,
          data: line.data,
          total: line.airtime + line.data,
        }))
    return {
      id: 0,
      operatorId: prepared.operator.id,
      operatorName: prepared.operator.name,
      operatorEmail: prepared.operator.email,
      operatorPhone: prepared.operator.phone,
      operatorAddress: prepared.operator.address,
      effectiveDate: toDateOnly(prepared.effectiveDate),
      endDate: toDateOnly(prepared.endDate),
      createdAt: toDateOnly(createdAt),
      signatoryName: signatory.signatoryName,
      signatoryTitle: signatory.signatoryTitle,
      modifications: prepared.lines
        .filter((line) => line.action === 'MODIFICATION')
        .flatMap((line) =>
          line.amounts.map((amount) => ({
            employeeName: line.employeeName,
            matricule: line.matricule,
            designation: designationOf(line.matricule),
            phoneNumber: line.phoneNumber,
            accountNo: line.accountNo,
            serviceName: serviceNames.get(amount.serviceId) ?? '',
            previousAmount: amount.previousAmount,
            amount: amount.amount,
          })),
        ),
      removals: prepared.lines
        .filter((line) => line.action === 'REMOVAL')
        .map((line) => ({
          employeeName: line.employeeName,
          matricule: line.matricule,
          designation: designationOf(line.matricule),
          phoneNumber: line.phoneNumber,
          accountNo: line.accountNo,
          endDate: toDateOnly(prepared.endDate),
        })),
      adjustments: packageRows('MODIFICATION'),
      creations: packageRows('CREATION'),
    }
  },

  async applyBatch(
    input: CommunicationBatchCreateInput,
    createdById: number,
  ): Promise<CommunicationBatchReport> {
    const prepared = await prepareBatch(input)
    const { effectiveDate, endDate, lines } = prepared
    const byId = new Map(lines.map((row) => [row.fleetRegistrationId, row]))
    const batchId = await prisma.$transaction(async (tx) => {
      const batch = await tx.communicationBatch.create({
        data: {
          operatorId: input.operatorId,
          effectiveDate,
          endDate,
          createdById,
        },
      })
      for (const id of input.fleetRegistrationIds) {
        const line = byId.get(id)!
        const createdLine = await tx.communicationBatchLine.create({
          data: {
            batchId: batch.id,
            fleetRegistrationId: line.fleetRegistrationId,
            action: line.action,
            phoneNumber: line.phoneNumber || null,
            accountNo: line.accountNo,
          },
        })
        if (line.amounts.length > 0) {
          await tx.communicationBatchAmount.createMany({
            data: line.amounts.map((amount) => ({
              lineId: createdLine.id,
              serviceId: amount.serviceId,
              previousAmount: amount.previousAmount,
              amount: amount.amount,
            })),
          })
        }
      }
      await tx.communicatedFleetLine.deleteMany({
        where: {
          operatorId: input.operatorId,
          fleetRegistrationId: { in: input.fleetRegistrationIds },
        },
      })
      const currentRows = lines.flatMap((line) =>
        line.current.map((row) => ({
          fleetRegistrationId: line.fleetRegistrationId,
          operatorId: input.operatorId,
          operatorAccountId: row.operatorAccountId,
          phoneNumber: row.phoneNumber,
          serviceId: row.serviceId,
          amount: row.amount,
        })),
      )
      if (currentRows.length > 0) {
        await tx.communicatedFleetLine.createMany({ data: currentRows })
      }
      const removalIds = lines
        .filter((line) => line.action === 'REMOVAL')
        .map((line) => line.fleetRegistrationId)
      if (removalIds.length > 0) {
        const closedDetails = await tx.fleetRegDetails.findMany({
          where: {
            operator_id: input.operatorId,
            fleetRegistrationId: { in: removalIds },
            fleetRegistration: { endDate: { not: null } },
          },
        })
        if (closedDetails.length > 0) {
          await tx.communicatedFleetLine.createMany({
            data: closedDetails.map((row) => ({
              fleetRegistrationId: row.fleetRegistrationId,
              operatorId: input.operatorId,
              operatorAccountId: row.operator_AccountId,
              phoneNumber: row.phoneNumber,
              serviceId: row.serviceId,
              amount: row.amount,
            })),
          })
        }
      }
      return batch.id
    })
    return this.getBatch(batchId)
  },
}
