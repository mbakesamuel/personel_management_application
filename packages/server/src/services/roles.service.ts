import type {
  Role,
  RoleCreateInput,
  RoleDefinition,
  RolePermissions,
  RoleUpdateInput,
  ScopeKind,
} from '@personel-management-app/shared'
import {
  defaultPermissionsForRole,
  fallbackLabelForRole,
  fallbackScopeForRole,
  isBuiltinRole,
  isValidRoleCode,
  ROLES,
} from '@personel-management-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  getJurisdiction,
  getScopeKindForJurisdictionCode,
  JurisdictionNotFoundError,
} from './jurisdictions.service.js'

export class RoleNotFoundError extends Error {
  constructor(message = 'Role not found') {
    super(message)
    this.name = 'RoleNotFoundError'
  }
}

export class RoleValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoleValidationError'
  }
}

export class RoleConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoleConflictError'
  }
}

async function mapRoleRow(row: {
  code: string
  label: string
  jurisdiction: string
  can_appraisals: boolean
  can_financial_years: boolean
  can_organization: boolean
  can_personnel: boolean
  can_allowances: boolean
  can_allowance_types: boolean
  can_allowance_catalog: boolean
  can_allowance_rates: boolean
  can_allowance_allocations: boolean
  can_position_keywords: boolean
  can_allowance_matrix: boolean
  can_communication_allowance: boolean
  can_validate: boolean
  can_demote_classification: boolean
  can_edit_validated: boolean
  can_letter_cc: boolean
  can_decision_matrix: boolean
  can_through_officers: boolean
  can_import_history: boolean
  can_export_history: boolean
  can_import_fleet: boolean
  can_users: boolean
  can_roles: boolean
}): Promise<RoleDefinition> {
  const jurisdiction = row.jurisdiction || fallbackScopeForRole(row.code)
  return {
    code: row.code,
    label: row.label || fallbackLabelForRole(row.code),
    jurisdiction,
    scopeKind: await getScopeKindForJurisdictionCode(jurisdiction),
    canAppraisals: row.can_appraisals,
    canFinancialYears: row.can_financial_years,
    canOrganization: row.can_organization,
    canPersonnel: row.can_personnel,
    canAllowances: row.can_allowances,
    canAllowanceTypes: row.can_allowance_types,
    canAllowanceCatalog: row.can_allowance_catalog,
    canAllowanceRates: row.can_allowance_rates,
    canAllowanceAllocations: row.can_allowance_allocations,
    canPositionKeywords: row.can_position_keywords,
    canAllowanceMatrix: row.can_allowance_matrix,
    canCommunicationAllowance: row.can_communication_allowance,
    canValidate: row.can_validate,
    canDemoteClassification: row.can_demote_classification,
    canEditValidated: row.can_edit_validated,
    canLetterCc: row.can_letter_cc,
    canDecisionMatrix: row.can_decision_matrix,
    canThroughOfficers: row.can_through_officers,
    canImportHistory: row.can_import_history,
    canExportHistory: row.can_export_history,
    canImportFleet: row.can_import_fleet,
    canUsers: row.can_users,
    canRoles: row.can_roles,
  }
}

function fallbackDefinition(code: Role): RoleDefinition {
  const jurisdiction = fallbackScopeForRole(code)
  return {
    code,
    label: fallbackLabelForRole(code),
    jurisdiction,
    scopeKind: jurisdiction,
    ...defaultPermissionsForRole(code),
  }
}

export async function getRoleDefinition(code: string): Promise<RoleDefinition> {
  const row = await prisma.tbl_roles.findUnique({ where: { code } })
  if (row) return mapRoleRow(row)
  if (isBuiltinRole(code)) return fallbackDefinition(code)
  throw new RoleNotFoundError(`Unknown role: ${code}`)
}

export async function getPermissionsForRole(
  code: string,
): Promise<RolePermissions> {
  const def = await getRoleDefinition(code)
  return {
    canAppraisals: def.canAppraisals,
    canFinancialYears: def.canFinancialYears,
    canOrganization: def.canOrganization,
    canPersonnel: def.canPersonnel,
    canAllowances: def.canAllowances,
    canAllowanceTypes: def.canAllowanceTypes,
    canAllowanceCatalog: def.canAllowanceCatalog,
    canAllowanceRates: def.canAllowanceRates,
    canAllowanceAllocations: def.canAllowanceAllocations,
    canPositionKeywords: def.canPositionKeywords,
    canAllowanceMatrix: def.canAllowanceMatrix,
    canCommunicationAllowance: def.canCommunicationAllowance,
    canValidate: def.canValidate,
    canDemoteClassification: def.canDemoteClassification,
    canEditValidated: def.canEditValidated,
    canLetterCc: def.canLetterCc,
    canDecisionMatrix: def.canDecisionMatrix,
    canThroughOfficers: def.canThroughOfficers,
    canImportHistory: def.canImportHistory,
    canExportHistory: def.canExportHistory,
    canImportFleet: def.canImportFleet,
    canUsers: def.canUsers,
    canRoles: def.canRoles,
  }
}

export async function getJurisdictionForRole(code: string): Promise<string> {
  return (await getRoleDefinition(code)).jurisdiction
}

export async function getScopeKindForRole(code: string): Promise<ScopeKind> {
  const jurisdictionCode = await getJurisdictionForRole(code)
  return getScopeKindForJurisdictionCode(jurisdictionCode)
}

async function assertJurisdictionAssignable(code: string): Promise<void> {
  try {
    const jurisdiction = await getJurisdiction(code)
    if (!jurisdiction.active) {
      throw new RoleValidationError(`Jurisdiction ${code} is inactive`)
    }
  } catch (err) {
    if (err instanceof JurisdictionNotFoundError) {
      throw new RoleValidationError(`Unknown jurisdiction: ${code}`)
    }
    throw err
  }
}

export async function listRoles(): Promise<RoleDefinition[]> {
  const rows = await prisma.tbl_roles.findMany({ orderBy: { code: 'asc' } })
  const mapped = await Promise.all(rows.map((row) => mapRoleRow(row)))
  const byCode = new Map(mapped.map((row) => [row.code, row]))

  // Ensure built-in roles always appear even if not yet seeded.
  for (const code of ROLES) {
    if (!byCode.has(code)) {
      byCode.set(code, fallbackDefinition(code))
    }
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function assertAdminInvariants(code: string, input: RoleUpdateInput) {
  if (code !== 'ADMINISTRATOR') return
  if (input.jurisdiction !== 'all') {
    throw new RoleValidationError(
      'Administrator jurisdiction must remain "all"',
    )
  }
  if (!input.canRoles) {
    throw new RoleValidationError(
      'Administrator must retain the can_roles permission',
    )
  }
}

export async function createRole(
  input: RoleCreateInput,
): Promise<RoleDefinition> {
  const code = input.code.trim().toUpperCase()
  if (!isValidRoleCode(code)) {
    throw new RoleValidationError(
      'Role code must start with A–Z and contain only A–Z, 0–9, or underscore',
    )
  }
  if (code === 'ADMINISTRATOR') {
    throw new RoleValidationError('Cannot create a duplicate Administrator role')
  }

  assertAdminInvariants(code, input)
  await assertJurisdictionAssignable(input.jurisdiction)

  try {
    const row = await prisma.tbl_roles.create({
      data: {
        code,
        label: input.label.trim(),
        jurisdiction: input.jurisdiction,
        can_appraisals: input.canAppraisals,
        can_financial_years: input.canFinancialYears,
        can_organization: input.canOrganization,
        can_personnel: input.canPersonnel,
        can_allowances: input.canAllowances,
        can_allowance_types: input.canAllowanceTypes,
        can_allowance_catalog: input.canAllowanceCatalog,
        can_allowance_rates: input.canAllowanceRates,
        can_allowance_allocations: input.canAllowanceAllocations,
        can_position_keywords: input.canPositionKeywords,
        can_allowance_matrix: input.canAllowanceMatrix,
        can_communication_allowance: input.canCommunicationAllowance,
        can_validate: input.canValidate,
        can_demote_classification: input.canDemoteClassification,
        can_edit_validated: input.canEditValidated,
        can_letter_cc: input.canLetterCc,
        can_decision_matrix: input.canDecisionMatrix,
        can_through_officers: input.canThroughOfficers,
        can_import_history: input.canImportHistory,
        can_export_history: input.canExportHistory,
        can_import_fleet: input.canImportFleet,
        can_users: input.canUsers,
        can_roles: input.canRoles,
      },
    })
    return mapRoleRow(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new RoleConflictError(`Role ${code} already exists`)
    }
    throw err
  }
}

export async function updateRole(
  code: string,
  input: RoleUpdateInput,
): Promise<RoleDefinition> {
  assertAdminInvariants(code, input)
  await assertJurisdictionAssignable(input.jurisdiction)

  const existing = await prisma.tbl_roles.findUnique({ where: { code } })
  if (!existing && !isBuiltinRole(code)) {
    throw new RoleNotFoundError(`Unknown role: ${code}`)
  }

  const row = await prisma.tbl_roles.upsert({
    where: { code },
    create: {
      code,
      label: input.label.trim(),
      jurisdiction: input.jurisdiction,
      can_appraisals: input.canAppraisals,
      can_financial_years: input.canFinancialYears,
      can_organization: input.canOrganization,
      can_personnel: input.canPersonnel,
      can_allowances: input.canAllowances,
      can_allowance_types: input.canAllowanceTypes,
      can_allowance_catalog: input.canAllowanceCatalog,
      can_allowance_rates: input.canAllowanceRates,
      can_allowance_allocations: input.canAllowanceAllocations,
      can_position_keywords: input.canPositionKeywords,
      can_allowance_matrix: input.canAllowanceMatrix,
      can_communication_allowance: input.canCommunicationAllowance,
      can_validate: input.canValidate,
      can_demote_classification: input.canDemoteClassification,
      can_edit_validated: input.canEditValidated,
      can_letter_cc: input.canLetterCc,
      can_decision_matrix: input.canDecisionMatrix,
      can_through_officers: input.canThroughOfficers,
      can_import_history: input.canImportHistory,
      can_export_history: input.canExportHistory,
      can_import_fleet: input.canImportFleet,
      can_users: input.canUsers,
      can_roles: input.canRoles,
    },
    update: {
      label: input.label.trim(),
      jurisdiction: input.jurisdiction,
      can_appraisals: input.canAppraisals,
      can_financial_years: input.canFinancialYears,
      can_organization: input.canOrganization,
      can_personnel: input.canPersonnel,
      can_allowances: input.canAllowances,
      can_allowance_types: input.canAllowanceTypes,
      can_allowance_catalog: input.canAllowanceCatalog,
      can_allowance_rates: input.canAllowanceRates,
      can_allowance_allocations: input.canAllowanceAllocations,
      can_position_keywords: input.canPositionKeywords,
      can_allowance_matrix: input.canAllowanceMatrix,
      can_communication_allowance: input.canCommunicationAllowance,
      can_validate: input.canValidate,
      can_demote_classification: input.canDemoteClassification,
      can_edit_validated: input.canEditValidated,
      can_letter_cc: input.canLetterCc,
      can_decision_matrix: input.canDecisionMatrix,
      can_through_officers: input.canThroughOfficers,
      can_import_history: input.canImportHistory,
      can_export_history: input.canExportHistory,
      can_import_fleet: input.canImportFleet,
      can_users: input.canUsers,
      can_roles: input.canRoles,
    },
  })

  return mapRoleRow(row)
}
