import { Prisma } from '@prisma/client'
import type {
  PositionKeyword,
  PositionKeywordUpdateInput,
  PositionKeywordUpsertInput,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

export class PositionKeywordNotFoundError extends Error {
  constructor(message = 'Position keyword not found') {
    super(message)
    this.name = 'PositionKeywordNotFoundError'
  }
}

export class PositionKeywordConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PositionKeywordConflictError'
  }
}

function mapRow(row: {
  id: number
  keyword: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}): PositionKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listPositionKeywords(opts?: {
  activeOnly?: boolean
}): Promise<PositionKeyword[]> {
  const rows = await prisma.tbl_position_keyword.findMany({
    where: opts?.activeOnly ? { active: true } : undefined,
    orderBy: [{ keyword: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function createPositionKeyword(
  input: PositionKeywordUpsertInput,
): Promise<PositionKeyword> {
  try {
    const row = await prisma.tbl_position_keyword.create({
      data: {
        keyword: input.keyword.trim(),
        active: input.active,
      },
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PositionKeywordConflictError(
        'A position keyword with this keyword already exists',
      )
    }
    throw err
  }
}

export async function updatePositionKeyword(
  id: number,
  input: PositionKeywordUpdateInput,
): Promise<PositionKeyword> {
  try {
    const row = await prisma.tbl_position_keyword.update({
      where: { id },
      data: {
        keyword: input.keyword.trim(),
        active: input.active,
      },
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        throw new PositionKeywordNotFoundError()
      }
      if (err.code === 'P2002') {
        throw new PositionKeywordConflictError(
          'A position keyword with this keyword already exists',
        )
      }
    }
    throw err
  }
}

export async function deletePositionKeyword(id: number): Promise<void> {
  try {
    await prisma.tbl_position_keyword.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new PositionKeywordNotFoundError()
    }
    throw err
  }
}
