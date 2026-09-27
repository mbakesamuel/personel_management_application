import type {
  Jurisdiction,
  JurisdictionCreateInput,
  JurisdictionUpdateInput,
  ScopeKind,
} from '@personel-management-app/shared'
import {
  isScopeKind,
  SCOPE_KIND_RANK,
} from '@personel-management-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class JurisdictionNotFoundError extends Error {
  constructor(message = 'Jurisdiction not found') {
    super(message)
    this.name = 'JurisdictionNotFoundError'
  }
}

export class JurisdictionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JurisdictionValidationError'
  }
}

export class JurisdictionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JurisdictionConflictError'
  }
}

function mapRow(row: {
  code: string
  label: string
  rank: number
  scopeKind: string
  system: boolean
  active: boolean
}): Jurisdiction {
  return {
    code: row.code,
    label: row.label,
    rank: row.rank,
    scopeKind: isScopeKind(row.scopeKind) ? row.scopeKind : 'section',
    system: row.system,
    active: row.active,
  }
}

export async function listJurisdictions(opts?: {
  activeOnly?: boolean
}): Promise<Jurisdiction[]> {
  const rows = await prisma.tbl_jurisdiction.findMany({
    where: opts?.activeOnly ? { active: true } : undefined,
    orderBy: [{ rank: 'asc' }, { code: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function getJurisdiction(code: string): Promise<Jurisdiction> {
  const row = await prisma.tbl_jurisdiction.findUnique({ where: { code } })
  if (!row) throw new JurisdictionNotFoundError(`Unknown jurisdiction: ${code}`)
  return mapRow(row)
}

export async function getScopeKindForJurisdictionCode(
  code: string,
): Promise<ScopeKind> {
  try {
    return (await getJurisdiction(code)).scopeKind
  } catch (err) {
    if (err instanceof JurisdictionNotFoundError) {
      return isScopeKind(code) ? code : 'section'
    }
    throw err
  }
}

export async function getRankForJurisdictionCode(code: string): Promise<number> {
  try {
    return (await getJurisdiction(code)).rank
  } catch (err) {
    if (err instanceof JurisdictionNotFoundError) {
      return isScopeKind(code) ? SCOPE_KIND_RANK[code] : SCOPE_KIND_RANK.section
    }
    throw err
  }
}

export async function createJurisdiction(
  input: JurisdictionCreateInput,
): Promise<Jurisdiction> {
  if (!isScopeKind(input.scopeKind)) {
    throw new JurisdictionValidationError('Invalid scope kind')
  }
  try {
    const row = await prisma.tbl_jurisdiction.create({
      data: {
        code: input.code,
        label: input.label.trim(),
        rank: input.rank,
        scopeKind: input.scopeKind,
        system: false,
        active: input.active ?? true,
      },
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new JurisdictionConflictError(
        `Jurisdiction ${input.code} already exists`,
      )
    }
    throw err
  }
}

export async function updateJurisdiction(
  code: string,
  input: JurisdictionUpdateInput,
): Promise<Jurisdiction> {
  const existing = await getJurisdiction(code)
  if (existing.system && input.scopeKind !== existing.scopeKind && code === 'all') {
    throw new JurisdictionValidationError(
      'Cannot change scope kind for the all jurisdiction',
    )
  }
  if (existing.system && input.scopeKind !== existing.scopeKind) {
    throw new JurisdictionValidationError(
      'Cannot change scope kind for system jurisdictions',
    )
  }
  try {
    const row = await prisma.tbl_jurisdiction.update({
      where: { code },
      data: {
        label: input.label.trim(),
        rank: input.rank,
        scopeKind: input.scopeKind,
        active: input.active,
      },
    })
    return mapRow(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new JurisdictionNotFoundError()
    }
    throw err
  }
}

export async function deleteJurisdiction(code: string): Promise<void> {
  const existing = await getJurisdiction(code)
  if (existing.system) {
    throw new JurisdictionValidationError('Cannot delete system jurisdictions')
  }
  const roleCount = await prisma.tbl_roles.count({
    where: { jurisdiction: code },
  })
  if (roleCount > 0) {
    throw new JurisdictionConflictError(
      `Cannot delete jurisdiction ${code}: it is used by ${roleCount} role(s)`,
    )
  }
  try {
    await prisma.tbl_jurisdiction.delete({ where: { code } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new JurisdictionNotFoundError()
    }
    throw err
  }
}
