/** Built-in roles seeded into the database. Custom roles may use any valid code. */
export const ROLES = [
  'SECRETARY',
  'FIELD_ASSISTANT',
  'ADMIN_ASSISTANT',
  'HR_OFFICER',
  'HR_MANAGER',
  'HR_DIRECTOR',
  'ADMINISTRATOR',
] as const

/** Role code stored on users / tbl_roles (built-in or custom). */
export type Role = string

export type BuiltinRole = (typeof ROLES)[number]

/** Known authz resolution strategies (scopeKind on tbl_jurisdiction). */
export type ScopeKind = 'section' | 'unit' | 'zone' | 'group' | 'all'

export const SCOPE_KINDS = [
  'section',
  'unit',
  'zone',
  'group',
  'all',
] as const

/** @deprecated Prefer ScopeKind; kept as alias for jurisdiction codes that match kinds. */
export type RoleScope = ScopeKind

/** @deprecated Prefer SCOPE_KINDS */
export const ROLE_SCOPES = SCOPE_KINDS

/** Fallback labels when DB role config is unavailable. */
export const ROLE_LABELS: Record<BuiltinRole, string> = {
  SECRETARY: 'Secretary',
  FIELD_ASSISTANT: 'Field Assistant',
  ADMIN_ASSISTANT: 'Administrative Assistant',
  HR_OFFICER: 'Human Resource Officer',
  HR_MANAGER: "Manager Human Resources Dev't Services",
  HR_DIRECTOR: 'Director Human Resources',
  ADMINISTRATOR: 'Administrator',
}

/** Fallback jurisdiction codes when DB role config is unavailable. */
export const ROLE_SCOPE: Record<BuiltinRole, RoleScope> = {
  SECRETARY: 'section',
  FIELD_ASSISTANT: 'section',
  ADMIN_ASSISTANT: 'section',
  HR_OFFICER: 'unit',
  HR_MANAGER: 'group',
  HR_DIRECTOR: 'group',
  ADMINISTRATOR: 'all',
}

/** Fallback ranks when jurisdiction table is unavailable. */
export const SCOPE_KIND_RANK: Record<ScopeKind, number> = {
  section: 1,
  unit: 2,
  zone: 3,
  group: 4,
  all: 5,
}

export type RolePermissions = {
  canAppraisals: boolean
  canFinancialYears: boolean
  canOrganization: boolean
  canPersonnel: boolean
  canAllowances: boolean
  canAllowanceTypes: boolean
  canAllowanceCatalog: boolean
  canAllowanceRates: boolean
  canAllowanceAllocations: boolean
  canPositionKeywords: boolean
  canAllowanceMatrix: boolean
  canCommunicationAllowance: boolean
  canValidate: boolean
  canDemoteClassification: boolean
  canEditValidated: boolean
  canLetterCc: boolean
  canDecisionMatrix: boolean
  canThroughOfficers: boolean
  canImportHistory: boolean
  canExportHistory: boolean
  canImportFleet: boolean
  canUsers: boolean
  canRoles: boolean
}

export type RoleDefinition = {
  code: Role
  label: string
  /** Jurisdiction catalog code (usually matches a ScopeKind). */
  jurisdiction: string
  /** Authz resolution strategy from the jurisdiction row. */
  scopeKind: ScopeKind
} & RolePermissions

export type Jurisdiction = {
  code: string
  label: string
  rank: number
  scopeKind: ScopeKind
  system: boolean
  active: boolean
}

/** Uppercase letter, then letters/digits/underscores; max 30 chars. */
const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/
const JURISDICTION_CODE_PATTERN = /^[a-z][a-z0-9_]{0,29}$/

export function isValidRoleCode(value: string): boolean {
  return ROLE_CODE_PATTERN.test(value)
}

export function isValidJurisdictionCode(value: string): boolean {
  return JURISDICTION_CODE_PATTERN.test(value)
}

export function isBuiltinRole(value: string): value is BuiltinRole {
  return (ROLES as readonly string[]).includes(value)
}

/** @deprecated Prefer isBuiltinRole or isValidRoleCode. Kept for callers that check built-ins. */
export function isRole(value: string): value is BuiltinRole {
  return isBuiltinRole(value)
}

export function isScopeKind(value: string): value is ScopeKind {
  return (SCOPE_KINDS as readonly string[]).includes(value)
}

/** @deprecated Prefer isScopeKind */
export function isRoleScope(value: string): value is RoleScope {
  return isScopeKind(value)
}

export function isAdmin(role: Role): boolean {
  return role === 'ADMINISTRATOR'
}

/** Pending and rejected rows are always editable. Validated rows require the permission. */
export function canEditWorkflowStatus(
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'SUPERSEDED',
  canEditValidated: boolean,
): boolean {
  if (status === 'PENDING' || status === 'REJECTED') return true
  return status === 'VALIDATED' && canEditValidated
}

export function defaultPermissionsForRole(role: Role): RolePermissions {
  if (isAdmin(role)) {
    return {
      canAppraisals: true,
      canFinancialYears: true,
      canOrganization: true,
      canPersonnel: true,
      canAllowances: true,
      canAllowanceTypes: true,
      canAllowanceCatalog: true,
      canAllowanceRates: true,
      canAllowanceAllocations: true,
      canPositionKeywords: true,
      canAllowanceMatrix: true,
      canCommunicationAllowance: true,
      canValidate: true,
      canDemoteClassification: true,
      canEditValidated: true,
      canLetterCc: true,
      canDecisionMatrix: true,
      canThroughOfficers: true,
      canImportHistory: true,
      canExportHistory: true,
      canImportFleet: true,
      canUsers: true,
      canRoles: true,
    }
  }
  return {
    canAppraisals: true,
    canFinancialYears: false,
    canOrganization: false,
    canPersonnel: false,
    canAllowances: false,
    canAllowanceTypes: false,
    canAllowanceCatalog: false,
    canAllowanceRates: false,
    canAllowanceAllocations: false,
    canPositionKeywords: false,
    canAllowanceMatrix: false,
    canCommunicationAllowance: false,
    canValidate: false,
    canDemoteClassification: false,
    canEditValidated: false,
    canLetterCc: false,
    canDecisionMatrix: false,
    canThroughOfficers: false,
    canImportHistory: false,
    canExportHistory: false,
    canImportFleet: false,
    canUsers: false,
    canRoles: false,
  }
}

export function fallbackLabelForRole(code: Role): string {
  return isBuiltinRole(code) ? ROLE_LABELS[code] : code
}

export function fallbackScopeForRole(code: Role): RoleScope {
  return isBuiltinRole(code) ? ROLE_SCOPE[code] : 'section'
}
