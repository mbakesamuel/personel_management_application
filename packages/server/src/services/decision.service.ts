import type {
  DecisionLevel,
  DecisionLevelCode,
  DecisionScope,
} from '@personel-management-app/shared'
import { DECISION_LEVEL_CODES, DECISION_SCOPES } from '@personel-management-app/shared'
import { prisma } from '../db.js'

export class DecisionNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'DecisionNotFoundError'
  }
}

export class DecisionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecisionValidationError'
  }
}

function isLevelCode(value: string): value is DecisionLevelCode {
  return (DECISION_LEVEL_CODES as readonly string[]).includes(value)
}

function isScope(value: string): value is DecisionScope {
  return (DECISION_SCOPES as readonly string[]).includes(value)
}

function mapLevel(row: { code: string; title: string; scope: string }): DecisionLevel {
  if (!isLevelCode(row.code) || !isScope(row.scope)) {
    throw new DecisionValidationError(`Invalid decision level row: ${row.code}/${row.scope}`)
  }
  return {
    code: row.code,
    title: row.title,
    scope: row.scope,
  }
}

export async function listDecisionLevels(): Promise<DecisionLevel[]> {
  const rows = await prisma.tbl_decision_level.findMany()
  const order = new Map(DECISION_LEVEL_CODES.map((code, index) => [code, index]))
  return rows
    .map(mapLevel)
    .sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99))
}

export async function getDecisionLevel(code: DecisionLevelCode): Promise<DecisionLevel> {
  const row = await prisma.tbl_decision_level.findUnique({ where: { code } })
  if (!row) {
    throw new DecisionNotFoundError(`Decision level ${code} is not defined`)
  }
  return mapLevel(row)
}
