import type { User } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { getRoleDefinition } from './roles.service.js'

export async function mapDbUser(row: {
  id: number
  username: string | null
  role: string
  tbl_group_id: string | null
  tbl_zone_id: string | null
  tbl_unit_id: string | null
  tbl_section_id: number | null
  tbl_financialyear_id: number | null
  mustChangePassword: boolean
}): Promise<User> {
  const def = await getRoleDefinition(row.role)
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    groupId: row.tbl_group_id,
    zoneId: row.tbl_zone_id,
    unitId: row.tbl_unit_id,
    sectionId: row.tbl_section_id,
    financialYearId: row.tbl_financialyear_id,
    mustChangePassword: row.mustChangePassword,
    permissions: {
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
    },
    jurisdiction: def.jurisdiction,
  }
}

export async function findUserById(id: number): Promise<User | null> {
  const row = await prisma.tbl_users.findUnique({ where: { id } })
  return row ? mapDbUser(row) : null
}
