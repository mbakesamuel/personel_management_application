import {
  PHONE_OUTSIDE_PREFIX_RANGES,
  phoneMatchesPrefixRanges,
  type CommunicationAmount,
  type CommunicationAmountCreateInput,
  type CommunicationAllowanceOption,
  type CommunicationBatchCreateInput,
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
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  formatEmployeeName,
  resolveLiveEmployees,
} from './live-employee.service.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  parseDate,
} from './personnel-workflow.js'

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function employeeName(name: string, firstname: string | null): string {
  return formatEmployeeName(name, firstname)
}

function amountInForce(
  details: {
    id: number
    serviceId: number
    amount: number
    effectiveDate: Date
  }[],
  serviceId: number,
  effectiveDate: Date,
): number {
  let best: { id: number; amount: number; effectiveDate: Date } | null = null
  for (const detail of details) {
    if (detail.serviceId !== serviceId || detail.effectiveDate > effectiveDate) continue
    if (
      !best ||
      detail.effectiveDate > best.effectiveDate ||
      (detail.effectiveDate.getTime() === best.effectiveDate.getTime() &&
        detail.id > best.id)
    ) {
      best = detail
    }
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
        effectiveDate: Date
      }[]
    }
  },
  serviceId: number | undefined,
  effectiveDate: Date,
): number {
  if (serviceId == null) return 0
  const changed = line.amounts.find((amount) => amount.serviceId === serviceId)
  if (changed) return changed.amount
  return amountInForce(line.fleetRegistration.fleetRegDetails, serviceId, effectiveDate)
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function assertPhoneInRanges(
  phoneNumber: string,
  ranges: { rangeStart: string; rangeEnd: string }[],
) {
  const matches = phoneMatchesPrefixRanges(
    phoneNumber,
    ranges.map((range) => ({ start: range.rangeStart, end: range.rangeEnd })),
  )
  if (!matches) throw new PersonnelConflictError(PHONE_OUTSIDE_PREFIX_RANGES)
}

function accountForOperator(usesAccounts: boolean, accountNo: string): string | null {
  const trimmed = accountNo.trim()
  if (!usesAccounts) return null
  if (!trimmed) {
    throw new PersonnelConflictError('Account is required for this operator')
  }
  return trimmed
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
        operator: { select: { name: true } },
        employee: { select: { name: true, firstname: true } },
        allowance: { select: { allowanceName: true } },
      },
      orderBy: [{ isActive: 'desc' }, { effectiveDate: 'desc' }],
    })
    return rows.map((row) => ({
      id: row.id,
      matricule: row.matricule,
      employeeName: row.employee
        ? employeeName(row.employee.name, row.employee.firstname)
        : row.matricule,
      operatorId: row.operator_id,
      operatorName: row.operator?.name ?? '',
      allowanceId: row.allowanceId,
      allowanceName: row.allowance?.allowanceName ?? '',
      accountNo: row.accountNo,
      phoneNumber: row.phoneNumber,
      effectiveDate: toDateOnly(row.effectiveDate),
      endDate: row.endDate ? toDateOnly(row.endDate) : null,
      isActive: row.isActive,
      replacedById: row.replacedById,
      includedInBatch: row.includedInBatch,
      createdAt: toDateOnly(row.createdAt),
    }))
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
      where: { matricule, operator_id: input.operatorId, endDate: null },
      select: { id: true },
    })
    if (open) {
      throw new PersonnelConflictError(
        'This employee already has an open registration with this operator',
      )
    }
    assertPhoneInRanges(input.phoneNumber, operator.numberPrefixes)
    const created = await prisma.fleetRegistration.create({
      data: {
        matricule,
        operator_id: input.operatorId,
        allowanceId: input.allowanceId,
        accountNo: accountForOperator(operator.usesAccounts, input.accountNo),
        phoneNumber: input.phoneNumber.trim(),
        effectiveDate: parseDate(input.effectiveDate, 'effectiveDate'),
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
    if (endDate < existing.effectiveDate) {
      throw new PersonnelConflictError(
        'End date cannot be before the join date',
      )
    }
    await prisma.fleetRegistration.update({
      where: { id },
      data: { endDate, isActive: false },
    })
    const [row] = await this.listRegistrations().then((rows) =>
      rows.filter((item) => item.id === id),
    )
    return row!
  },

  async transferRegistration(
    id: number,
    input: CommunicationRegistrationTransferInput,
  ): Promise<CommunicationRegistration> {
    const existing = await prisma.fleetRegistration.findUnique({
      where: { id },
      include: { fleetRegDetails: true },
    })
    if (!existing) throw new PersonnelNotFoundError('Registration not found')
    if (existing.endDate) {
      throw new PersonnelConflictError('Registration is already closed')
    }
    if (existing.operator_id === input.operatorId) {
      throw new PersonnelConflictError('Choose a different operator')
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
    const effectiveDate = parseDate(input.effectiveDate, 'effectiveDate')
    if (effectiveDate < existing.effectiveDate) {
      throw new PersonnelConflictError(
        'Transfer date cannot be before the join date',
      )
    }
    assertPhoneInRanges(input.phoneNumber, operator.numberPrefixes)
    const open = await prisma.fleetRegistration.findFirst({
      where: {
        matricule: existing.matricule,
        operator_id: input.operatorId,
        endDate: null,
      },
      select: { id: true },
    })
    if (open) {
      throw new PersonnelConflictError(
        'This employee already has an open registration with this operator',
      )
    }

    const inForce = new Map<number, { amount: number; effectiveDate: Date; id: number }>()
    for (const detail of existing.fleetRegDetails) {
      if (detail.effectiveDate > effectiveDate) continue
      const previous = inForce.get(detail.serviceId)
      if (
        !previous ||
        detail.effectiveDate > previous.effectiveDate ||
        (detail.effectiveDate.getTime() === previous.effectiveDate.getTime() &&
          detail.id > previous.id)
      ) {
        inForce.set(detail.serviceId, {
          amount: detail.amount,
          effectiveDate: detail.effectiveDate,
          id: detail.id,
        })
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.fleetRegistration.create({
        data: {
          matricule: existing.matricule,
          operator_id: input.operatorId,
          allowanceId: existing.allowanceId,
          accountNo: accountForOperator(operator.usesAccounts, input.accountNo),
          phoneNumber: input.phoneNumber.trim(),
          effectiveDate,
          isActive: true,
        },
      })
      await tx.fleetRegistration.update({
        where: { id: existing.id },
        data: { endDate: effectiveDate, isActive: false, replacedById: next.id },
      })
      if (inForce.size > 0) {
        await tx.fleetRegDetails.createMany({
          data: [...inForce.entries()].map(([serviceId, detail]) => ({
            fleetRegistrationId: next.id,
            serviceId,
            amount: detail.amount,
            effectiveDate,
          })),
        })
      }
      return next
    })

    const [row] = await this.listRegistrations().then((rows) =>
      rows.filter((item) => item.id === created.id),
    )
    return row!
  },

  async listAmounts(): Promise<CommunicationAmount[]> {
    const rows = await prisma.fleetRegDetails.findMany({
      include: {
        service: { select: { name: true } },
        fleetRegistration: {
          include: {
            operator: { select: { name: true } },
            employee: { select: { name: true, firstname: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
    })
    const today = todayUtc()
    const best = new Map<string, { id: number; effectiveDate: Date }>()
    for (const row of rows) {
      if (row.effectiveDate > today) continue
      const key = `${row.fleetRegistrationId}:${row.serviceId}`
      const previous = best.get(key)
      if (
        !previous ||
        row.effectiveDate > previous.effectiveDate ||
        (row.effectiveDate.getTime() === previous.effectiveDate.getTime() &&
          row.id > previous.id)
      ) {
        best.set(key, { id: row.id, effectiveDate: row.effectiveDate })
      }
    }
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
      operatorName: row.fleetRegistration.operator?.name ?? '',
      accountNo: row.fleetRegistration.accountNo,
      phoneNumber: row.fleetRegistration.phoneNumber,
      serviceId: row.serviceId,
      serviceName: row.service.name,
      amount: row.amount,
      effectiveDate: toDateOnly(row.effectiveDate),
      current: best.get(`${row.fleetRegistrationId}:${row.serviceId}`)?.id === row.id,
    }))
  },

  async listLines(): Promise<CommunicationLine[]> {
    const registrations = await prisma.fleetRegistration.findMany({
      where: { endDate: null },
      include: {
        operator: { select: { id: true, name: true } },
        employee: { select: { name: true, firstname: true } },
        fleetRegDetails: {
          include: { service: { select: { name: true } } },
        },
      },
      orderBy: [{ matricule: 'asc' }, { id: 'asc' }],
    })
    const live = await resolveLiveEmployees(
      registrations.map((row) => row.matricule),
    )
    const today = todayUtc()

    return registrations.map((row) => {
      const person = live.get(row.matricule)
      const airtimeDetails = row.fleetRegDetails.filter(
        (detail) => detail.service.name.trim().toLowerCase() === 'airtime',
      )
      const dataDetails = row.fleetRegDetails.filter(
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
        phoneNumber: row.phoneNumber,
        operatorId: row.operator_id,
        operatorName: row.operator?.name ?? '',
        airtime: airtimeDetails[0]
          ? amountInForce(airtimeDetails, airtimeDetails[0].serviceId, today)
          : 0,
        data: dataDetails[0]
          ? amountInForce(dataDetails, dataDetails[0].serviceId, today)
          : 0,
        groupName: person?.groupName ?? null,
        unitName: person?.unitName ?? null,
      }
    })
  },

  async createAmount(
    input: CommunicationAmountCreateInput,
  ): Promise<CommunicationAmount> {
    const registration = await prisma.fleetRegistration.findUnique({
      where: { id: input.fleetRegistrationId },
      select: { id: true, endDate: true, effectiveDate: true },
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
    const effectiveDate = parseDate(input.effectiveDate, 'effectiveDate')
    if (effectiveDate < registration.effectiveDate) {
      throw new PersonnelConflictError(
        'Effective date cannot be before the join date',
      )
    }
    const created = await prisma.fleetRegDetails.create({
      data: {
        fleetRegistrationId: registration.id,
        serviceId: service.id,
        amount: input.amount,
        effectiveDate,
      },
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
        lines: { select: { action: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((row) => ({
      id: row.id,
      operatorId: row.operatorId,
      operatorName: row.operator.name,
      effectiveDate: toDateOnly(row.effectiveDate),
      endDate: toDateOnly(row.endDate),
      createdAt: toDateOnly(row.createdAt),
      modificationCount: row.lines.filter((line) => line.action === 'MODIFICATION').length,
      removalCount: row.lines.filter((line) => line.action === 'REMOVAL').length,
      inclusionCount: row.lines.filter((line) => line.action === 'CREATION').length,
    }))
  },

  async getBatch(id: number): Promise<CommunicationBatchReport> {
    const [row, services] = await Promise.all([
      prisma.communicationBatch.findUnique({
        where: { id },
        include: {
          operator: { select: { name: true, email: true } },
          lines: {
            include: {
              fleetRegistration: {
                include: {
                  employee: { select: { name: true, firstname: true } },
                  fleetRegDetails: {
                    select: {
                      id: true,
                      serviceId: true,
                      amount: true,
                      effectiveDate: true,
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
        return line.amounts.map((amount) => ({
          employeeName: person,
          matricule: registration.matricule,
          phoneNumber: registration.phoneNumber,
          accountNo: registration.accountNo,
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
        return {
          employeeName: person,
          matricule: registration.matricule,
          phoneNumber: registration.phoneNumber,
          accountNo: registration.accountNo,
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
          const airtime = serviceAmount(line, airtimeId, row.effectiveDate)
          const data = serviceAmount(line, dataId, row.effectiveDate)
          return {
            employeeName: person,
            phoneNumber: registration.phoneNumber,
            airtime,
            data,
            total: airtime + data,
          }
        })
    const adjustments = packageRows('MODIFICATION')
    const creations = packageRows('CREATION')
    return {
      id: row.id,
      operatorId: row.operatorId,
      operatorName: row.operator.name,
      operatorEmail: row.operator.email,
      effectiveDate: toDateOnly(row.effectiveDate),
      endDate: toDateOnly(row.endDate),
      createdAt: toDateOnly(row.createdAt),
      modifications,
      removals,
      adjustments,
      creations,
    }
  },

  async applyBatch(
    input: CommunicationBatchCreateInput,
    createdById: number,
  ): Promise<CommunicationBatchReport> {
    const seen = new Set<number>()
    for (const line of input.lines) {
      if (seen.has(line.fleetRegistrationId)) {
        throw new PersonnelConflictError('A line can only be included once')
      }
      seen.add(line.fleetRegistrationId)
    }
    const operator = await prisma.tbl_operator.findUnique({
      where: { id: input.operatorId },
      select: { id: true, name: true },
    })
    if (!operator) throw new PersonnelNotFoundError('Operator not found')
    const effectiveDate = parseDate(input.effectiveDate, 'effectiveDate')
    const endDate = parseDate(input.endDate, 'endDate')
    const registrations = await prisma.fleetRegistration.findMany({
      where: { id: { in: [...seen] } },
      include: {
        employee: { select: { name: true, firstname: true } },
        fleetRegDetails: true,
      },
    })
    const byId = new Map(registrations.map((row) => [row.id, row]))
    const services = await prisma.service.findMany({ select: { id: true, name: true } })
    const serviceById = new Map(services.map((row) => [row.id, row]))

    const prepared = input.lines.map((line) => {
      const registration = byId.get(line.fleetRegistrationId)
      if (!registration) throw new PersonnelNotFoundError('Registration not found')
      const person = registration.employee
        ? employeeName(registration.employee.name, registration.employee.firstname)
        : registration.matricule
      if (registration.operator_id !== input.operatorId) {
        throw new PersonnelConflictError(
          `${person} is not registered with this operator`,
        )
      }
      if (registration.endDate) {
        throw new PersonnelConflictError(`${person} is already closed`)
      }
      if (line.action === 'REMOVAL') {
        if (endDate < registration.effectiveDate) {
          throw new PersonnelConflictError(
            `End date cannot be before the join date for ${person}`,
          )
        }
        return { registration, action: line.action, amounts: [] }
      }
      if (line.action === 'CREATION') {
        if (registration.includedInBatch) {
          throw new PersonnelConflictError(
            `${person} is already included in a letter`,
          )
        }
        if (!operator.name.toLowerCase().includes('orange')) {
          throw new PersonnelConflictError('The creation letter is for Orange only')
        }
        if (effectiveDate < registration.effectiveDate) {
          throw new PersonnelConflictError(
            `Effective date cannot be before the join date for ${person}`,
          )
        }
        const snapshotIds = services
          .filter((service) => {
            const name = service.name.trim().toLowerCase()
            return name === 'airtime' || name === 'data'
          })
          .map((service) => service.id)
        return {
          registration,
          action: line.action,
          amounts: snapshotIds.map((serviceId) => ({
            serviceId,
            previousAmount: null,
            amount: amountInForce(
              registration.fleetRegDetails,
              serviceId,
              effectiveDate,
            ),
          })),
        }
      }
      if (line.amounts.length === 0) {
        throw new PersonnelConflictError(`Enter at least one amount for ${person}`)
      }
      if (effectiveDate < registration.effectiveDate) {
        throw new PersonnelConflictError(
          `Effective date cannot be before the join date for ${person}`,
        )
      }
      const used = new Set<number>()
      const amounts = line.amounts.map((amount) => {
        if (used.has(amount.serviceId)) {
          throw new PersonnelConflictError(`Duplicate service for ${person}`)
        }
        used.add(amount.serviceId)
        const service = serviceById.get(amount.serviceId)
        if (!service) throw new PersonnelNotFoundError('Service not found')
        const previous = registration.fleetRegDetails
          .filter(
            (detail) =>
              detail.serviceId === amount.serviceId &&
              detail.effectiveDate <= effectiveDate,
          )
          .sort((a, b) => {
            const byDate = b.effectiveDate.getTime() - a.effectiveDate.getTime()
            return byDate === 0 ? b.id - a.id : byDate
          })[0]
        return {
          serviceId: service.id,
          previousAmount: previous?.amount ?? null,
          amount: amount.amount,
        }
      })
      return { registration, action: line.action, amounts }
    })

    const batchId = await prisma.$transaction(async (tx) => {
      const batch = await tx.communicationBatch.create({
        data: {
          operatorId: input.operatorId,
          effectiveDate,
          endDate,
          createdById,
        },
      })
      for (const line of prepared) {
        const createdLine = await tx.communicationBatchLine.create({
          data: {
            batchId: batch.id,
            fleetRegistrationId: line.registration.id,
            action: line.action,
          },
        })
        if (line.action === 'REMOVAL') {
          await tx.fleetRegistration.update({
            where: { id: line.registration.id },
            data: { endDate, isActive: false },
          })
          continue
        }
        if (line.action === 'CREATION') {
          await tx.fleetRegistration.update({
            where: { id: line.registration.id },
            data: { includedInBatch: true },
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
          continue
        }
        if (line.amounts.length > 0) {
          await tx.fleetRegDetails.createMany({
            data: line.amounts.map((amount) => ({
              fleetRegistrationId: line.registration.id,
              serviceId: amount.serviceId,
              amount: amount.amount,
              effectiveDate,
            })),
          })
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
      return batch.id
    })
    return this.getBatch(batchId)
  },
}
