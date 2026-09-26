import type { FinancialYear, User } from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { mapDbUser } from './user-mapper.js'

export class FinancialYearConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FinancialYearConflictError'
  }
}

export class FinancialYearNotFoundError extends Error {
  constructor(message = 'Financial year not found') {
    super(message)
    this.name = 'FinancialYearNotFoundError'
  }
}

export class FinancialYearClosedError extends Error {
  constructor(
    message = 'Cannot select a closed financial year',
  ) {
    super(message)
    this.name = 'FinancialYearClosedError'
  }
}

function mapYear(row: {
  id: number
  appyear: number
  closed: boolean
}): FinancialYear {
  return {
    id: row.id,
    appyear: row.appyear,
    closed: row.closed,
  }
}

export async function listFinancialYears(): Promise<FinancialYear[]> {
  const rows = await prisma.tbl_financialyear.findMany({
    orderBy: { appyear: 'desc' },
  })
  return rows.map(mapYear)
}

export async function createFinancialYear(input: {
  appyear: number
  closed: boolean
}): Promise<FinancialYear> {
  try {
    const row = await prisma.tbl_financialyear.create({
      data: {
        appyear: input.appyear,
        closed: input.closed,
      },
    })
    return mapYear(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new FinancialYearConflictError(
        `Financial year ${input.appyear} already exists`,
      )
    }
    throw err
  }
}

export async function updateFinancialYear(
  id: number,
  input: { appyear: number; closed: boolean },
): Promise<FinancialYear> {
  try {
    const row = await prisma.tbl_financialyear.update({
      where: { id },
      data: {
        appyear: input.appyear,
        closed: input.closed,
      },
    })

    if (input.closed) {
      await prisma.tbl_users.updateMany({
        where: { tbl_financialyear_id: id },
        data: { tbl_financialyear_id: null },
      })
    }

    return mapYear(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new FinancialYearNotFoundError()
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new FinancialYearConflictError(
        `Financial year ${input.appyear} already exists`,
      )
    }
    throw err
  }
}

export async function deleteFinancialYear(id: number): Promise<void> {
  const year = await prisma.tbl_financialyear.findUnique({ where: { id } })
  if (!year) {
    throw new FinancialYearNotFoundError()
  }

  const appraisalCount = await prisma.tbl_perfappraisal.count({
    where: { appyear: year.appyear },
  })
  if (appraisalCount > 0) {
    throw new FinancialYearConflictError(
      `Cannot delete year ${year.appyear}: it is used by ${appraisalCount} appraisal record(s)`,
    )
  }

  const userCount = await prisma.tbl_users.count({
    where: { tbl_financialyear_id: id },
  })
  if (userCount > 0) {
    throw new FinancialYearConflictError(
      `Cannot delete year ${year.appyear}: it is selected by ${userCount} user(s)`,
    )
  }

  await prisma.tbl_financialyear.delete({ where: { id } })
}

/**
 * Resolve the session financial year for a user.
 * - canFinancialYears: saved open year, else highest open year
 * - others: saved open year only; no auto-fallback
 */
export async function resolveUserFinancialYear(
  userId: number,
): Promise<FinancialYear | null> {
  const user = await prisma.tbl_users.findUnique({
    where: { id: userId },
    include: { tbl_financialyear: true },
  })
  if (!user) return null

  const mapped = await mapDbUser(user)
  const canManage = mapped.permissions.canFinancialYears

  if (user.tbl_financialyear && !user.tbl_financialyear.closed) {
    return mapYear(user.tbl_financialyear)
  }

  if (!canManage) {
    return null
  }

  const open = await prisma.tbl_financialyear.findFirst({
    where: { closed: false },
    orderBy: { appyear: 'desc' },
  })
  return open ? mapYear(open) : null
}

export async function setUserFinancialYear(
  userId: number,
  financialYearId: number | null,
): Promise<{ user: User; financialYear: FinancialYear | null }> {
  if (financialYearId == null) {
    try {
      const user = await prisma.tbl_users.update({
        where: { id: userId },
        data: { tbl_financialyear_id: null },
      })
      return {
        user: await mapDbUser(user),
        financialYear: null,
      }
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new FinancialYearNotFoundError('User not found')
      }
      throw err
    }
  }

  const year = await prisma.tbl_financialyear.findUnique({
    where: { id: financialYearId },
  })
  if (!year) {
    throw new FinancialYearNotFoundError()
  }
  if (year.closed) {
    throw new FinancialYearClosedError()
  }

  try {
    const user = await prisma.tbl_users.update({
      where: { id: userId },
      data: { tbl_financialyear_id: financialYearId },
    })
    return {
      user: await mapDbUser(user),
      financialYear: mapYear(year),
    }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new FinancialYearNotFoundError('User not found')
    }
    throw err
  }
}

/** Reject appraisal mutations when the year is missing or globally closed. */
export async function assertFinancialYearOpen(
  appyear: number,
): Promise<FinancialYear> {
  const year = await prisma.tbl_financialyear.findUnique({
    where: { appyear },
  })
  if (!year) {
    throw new FinancialYearNotFoundError(
      `Financial year ${appyear} is not defined`,
    )
  }
  if (year.closed) {
    throw new FinancialYearClosedError(
      `Financial year ${appyear} is closed. Only reports and printing are allowed.`,
    )
  }
  return mapYear(year)
}
