import { Prisma } from '@prisma/client'
import type {
  AllowanceKeywordBulkInput,
  AllowanceKeywordCreateInput,
  AllowanceKeywordLink,
  AllowanceKeywordUpdateInput,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

export class AllowanceMatrixNotFoundError extends Error {
  constructor(message = 'Allowance matrix link not found') {
    super(message)
    this.name = 'AllowanceMatrixNotFoundError'
  }
}

export class AllowanceMatrixConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllowanceMatrixConflictError'
  }
}

export class AllowanceMatrixValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllowanceMatrixValidationError'
  }
}

function mapRow(row: {
  id: number
  allowanceId: string
  keywordId: number
  active: boolean
  createdAt: Date
  updatedAt: Date
  allowance: { allowanceName: string }
  keyword: { keyword: string }
}): AllowanceKeywordLink {
  return {
    id: row.id,
    allowanceId: row.allowanceId,
    allowanceName: row.allowance.allowanceName,
    keywordId: row.keywordId,
    keyword: row.keyword.keyword,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const includeNames = {
  allowance: { select: { allowanceName: true } },
  keyword: { select: { keyword: true } },
} as const

async function assertValidatedAllowance(allowanceId: string) {
  const row = await prisma.tbl_allowance.findUnique({
    where: { id: allowanceId },
    select: { id: true, workflowStatus: true },
  })
  if (!row) {
    throw new AllowanceMatrixValidationError('Allowance not found')
  }
  if (row.workflowStatus !== 'VALIDATED') {
    throw new AllowanceMatrixValidationError(
      'Only validated allowances can be linked',
    )
  }
}

async function assertActiveKeyword(keywordId: number) {
  const row = await prisma.tbl_position_keyword.findUnique({
    where: { id: keywordId },
    select: { id: true, active: true },
  })
  if (!row) {
    throw new AllowanceMatrixValidationError('Position keyword not found')
  }
  if (!row.active) {
    throw new AllowanceMatrixValidationError(
      'Only active position keywords can be linked',
    )
  }
}

export async function listAllowanceKeywordLinks(opts?: {
  allowanceId?: string
  keywordId?: number
  activeOnly?: boolean
}): Promise<AllowanceKeywordLink[]> {
  const rows = await prisma.tbl_allowance_keyword.findMany({
    where: {
      ...(opts?.allowanceId ? { allowanceId: opts.allowanceId } : {}),
      ...(opts?.keywordId != null ? { keywordId: opts.keywordId } : {}),
      ...(opts?.activeOnly ? { active: true } : {}),
    },
    include: includeNames,
    orderBy: [{ keywordId: 'asc' }, { allowanceId: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function createAllowanceKeywordLink(
  input: AllowanceKeywordCreateInput,
): Promise<AllowanceKeywordLink> {
  await assertValidatedAllowance(input.allowanceId.trim())
  await assertActiveKeyword(input.keywordId)
  try {
    const row = await prisma.tbl_allowance_keyword.create({
      data: {
        allowanceId: input.allowanceId.trim(),
        keywordId: input.keywordId,
        active: input.active ?? true,
      },
      include: includeNames,
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AllowanceMatrixConflictError(
        'This allowance is already linked to this keyword',
      )
    }
    throw err
  }
}

export async function updateAllowanceKeywordLink(
  id: number,
  input: AllowanceKeywordUpdateInput,
): Promise<AllowanceKeywordLink> {
  try {
    const row = await prisma.tbl_allowance_keyword.update({
      where: { id },
      data: { active: input.active },
      include: includeNames,
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AllowanceMatrixNotFoundError()
    }
    throw err
  }
}

export async function deleteAllowanceKeywordLink(id: number): Promise<void> {
  try {
    await prisma.tbl_allowance_keyword.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AllowanceMatrixNotFoundError()
    }
    throw err
  }
}

export async function bulkReplaceKeywordLinks(
  input: AllowanceKeywordBulkInput,
): Promise<AllowanceKeywordLink[]> {
  await assertActiveKeyword(input.keywordId)
  const allowanceIds = [
    ...new Set(input.allowanceIds.map((id) => id.trim()).filter(Boolean)),
  ]
  for (const allowanceId of allowanceIds) {
    await assertValidatedAllowance(allowanceId)
  }

  await prisma.$transaction(async (tx) => {
    await tx.tbl_allowance_keyword.deleteMany({
      where: { keywordId: input.keywordId },
    })
    if (allowanceIds.length === 0) return
    await tx.tbl_allowance_keyword.createMany({
      data: allowanceIds.map((allowanceId) => ({
        keywordId: input.keywordId,
        allowanceId,
        active: true,
      })),
    })
  })

  return listAllowanceKeywordLinks({ keywordId: input.keywordId })
}
