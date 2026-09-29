import { z } from 'zod'
import {
  isValidJurisdictionCode,
  isValidRoleCode,
  SCOPE_KINDS,
} from './roles.js'

export const RoleSchema = z
  .string()
  .min(1)
  .max(30)
  .refine(isValidRoleCode, {
    message:
      'Role code must start with A–Z and contain only A–Z, 0–9, or underscore',
  })

export const ScopeKindSchema = z.enum(SCOPE_KINDS)
/** @deprecated Prefer ScopeKindSchema */
export const RoleScopeSchema = ScopeKindSchema

export const JurisdictionCodeSchema = z
  .string()
  .min(1)
  .max(30)
  .refine(isValidJurisdictionCode, {
    message:
      'Jurisdiction code must start with a–z and contain only a–z, 0–9, or underscore',
  })

export const JurisdictionSchema = z.object({
  code: JurisdictionCodeSchema,
  label: z.string().min(1).max(120),
  rank: z.number().int().positive(),
  scopeKind: ScopeKindSchema,
  system: z.boolean(),
  active: z.boolean(),
})

export const JurisdictionCreateSchema = z.object({
  code: JurisdictionCodeSchema,
  label: z.string().min(1).max(120),
  rank: z.number().int().positive(),
  scopeKind: ScopeKindSchema,
  active: z.boolean().optional().default(true),
})

export const JurisdictionUpdateSchema = z.object({
  label: z.string().min(1).max(120),
  rank: z.number().int().positive(),
  scopeKind: ScopeKindSchema,
  active: z.boolean(),
})

export const RolePermissionsSchema = z.object({
  canAppraisals: z.boolean(),
  canFinancialYears: z.boolean(),
  canOrganization: z.boolean(),
  canPersonnel: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canUsers: z.boolean(),
  canRoles: z.boolean(),
})

export const RoleDefinitionSchema = z.object({
  code: RoleSchema,
  label: z.string().min(1).max(120),
  jurisdiction: JurisdictionCodeSchema,
  scopeKind: ScopeKindSchema,
  canAppraisals: z.boolean(),
  canFinancialYears: z.boolean(),
  canOrganization: z.boolean(),
  canPersonnel: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canUsers: z.boolean(),
  canRoles: z.boolean(),
})

export const RoleUpdateSchema = z.object({
  label: z.string().min(1).max(120),
  jurisdiction: JurisdictionCodeSchema,
  canAppraisals: z.boolean(),
  canFinancialYears: z.boolean(),
  canOrganization: z.boolean(),
  canPersonnel: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canUsers: z.boolean(),
  canRoles: z.boolean(),
})

export const RoleCreateSchema = RoleUpdateSchema.extend({
  code: RoleSchema,
})

export const UserSchema = z.object({
  id: z.number().int(),
  username: z.string().nullable(),
  role: RoleSchema,
  groupId: z.string().nullable(),
  zoneId: z.string().nullable(),
  unitId: z.string().nullable(),
  sectionId: z.number().int().nullable(),
  financialYearId: z.number().int().nullable(),
  mustChangePassword: z.boolean(),
  permissions: RolePermissionsSchema,
  jurisdiction: z.string(),
})

export const UserUpsertSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1).optional(),
  role: RoleSchema,
  groupId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  unitId: z.string().max(3).nullable().optional(),
  sectionId: z.number().int().nullable().optional(),
})

export const FinancialYearSchema = z.object({
  id: z.number().int(),
  appyear: z.number().int(),
  closed: z.boolean(),
})

export const FinancialYearUpsertSchema = z.object({
  id: z.number().int().optional(),
  appyear: z.number().int(),
  closed: z.boolean().default(false),
})

export const SetUserFinancialYearSchema = z.object({
  financialYearId: z.number().int().nullable(),
})

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const ChangePasswordRequestSchema = z.object({
  username: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const LoginResponseSchema = z.object({
  user: UserSchema,
  financialYear: FinancialYearSchema.nullable(),
})

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
})

export const ServerConfigSchema = z.object({
  serverUrl: z.string().url(),
  authToken: z.string().min(1),
})

export const AppraisalListQuerySchema = z.object({
  appyear: z.coerce.number().int().optional(),
  unitId: z.string().min(1).max(3).optional(),
  sectionId: z.coerce.number().int().optional(),
  matric: z.string().trim().min(1).max(6).optional(),
})

export const AllocationLetterListQuerySchema = z.object({
  unitId: z.string().min(1).max(3).optional(),
  sectionId: z.coerce.number().int().optional(),
  matric: z.string().trim().min(1).max(6).optional(),
})

export const SalaryReviewExportQuerySchema = z.object({
  appyear: z.coerce.number().int(),
  unitId: z.string().min(1).max(3).optional(),
  sectionId: z.coerce.number().int().optional(),
})

export const AppraisalUpsertSchema = z.object({
  id: z.number().int().optional(),
  appyear: z.number().int(),
  matric: z.string().min(1).max(6),
  dateLmerit: z.string().nullable().optional(),
  dateLstat: z.string().nullable().optional(),
  dateLpro: z.string().nullable().optional(),
  lengthservice: z.string().nullable().optional(),
  preCat: z.string().nullable().optional(),
  proCat: z.string().nullable().optional(),
  awardId: z.number().int().nullable().optional(),
})

export const MatricLookupQuerySchema = z.object({
  matric: z.string().min(1),
  appyear: z.coerce.number().int(),
  mode: z.enum(['create', 'edit']).default('create'),
})

export const AppraisalEmployeeDetailsSchema = z.object({
  section: z.string().nullable(),
  designation: z.string().nullable(),
  dateEngaged: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  presentAge: z.number().int().nullable(),
  lengthService: z.string().nullable(),
})

export const AppraisalDetailSchema = z.object({
  id: z.number().int().nullable(),
  appyear: z.number().int().nullable(),
  matric: z.string(),
  names: z.string().nullable(),
  preCat: z.string().nullable(),
  proCat: z.string().nullable(),
  dateLmerit: z.string().nullable(),
  dateLstat: z.string().nullable(),
  dateLpro: z.string().nullable(),
  awardId: z.number().int().nullable(),
  lengthservice: z.string().nullable(),
  employee: AppraisalEmployeeDetailsSchema,
})

export const MatricLookupResultSchema = AppraisalDetailSchema.extend({
  eligibleAwardIds: z.array(z.number().int()),
  warnings: z.array(z.string()).optional(),
})

export const ProposeCategorySchema = z.object({
  preCat: z.string().min(1),
  awardId: z.number().int(),
})

export const ProposedCategoryResultSchema = z.union([
  z.object({
    overflow: z.literal(false),
    proCat: z.string(),
    note: z.string().optional(),
  }),
  z.object({
    overflow: z.literal(true),
    note: z.string(),
  }),
])

export const GroupUpsertSchema = z.object({
  id: z.string().min(1).max(50),
  groupName: z.string().min(1),
  active: z.boolean().optional().default(true),
})

export const UnitUpsertSchema = z.object({
  id: z.string().min(1).max(3),
  unitName: z.string().min(1),
  groupId: z.string().min(1),
  zoneId: z.string().min(1),
  active: z.boolean().optional().default(true),
})

export const ZoneUpsertSchema = z.object({
  id: z.string().min(1).max(50),
  zoneName: z.string().min(1),
  groupId: z.string().min(1),
  active: z.boolean().optional().default(true),
})

export const SectionUpsertSchema = z.object({
  id: z.number().int().optional(),
  section: z.string().min(1).nullable(),
  unitId: z.string().min(1).max(3).nullable(),
  active: z.boolean().optional().default(true),
})

export const PostSalaryReviewStartSchema = z.object({
  appyear: z.number().int(),
})

export const PostSalaryReviewBatchSchema = z.object({
  appyear: z.number().int(),
  ids: z.array(z.number().int()).min(1).max(100),
})

export const PostSalaryReviewStartResultSchema = z.object({
  appyear: z.number().int(),
  ids: z.array(z.number().int()),
  total: z.number().int(),
})

export const PostSalaryReviewBatchResultSchema = z.object({
  processed: z.number().int(),
  posted: z.number().int(),
  skipped: z.number().int(),
})

const optionalNullableString = z.string().trim().max(255).nullable().optional()
const optionalNullableDate = z
  .string()
  .trim()
  .max(32)
  .nullable()
  .optional()
const optionalNullableInt = z.number().int().nullable().optional()

export const SalaryReviewImportRowSchema = z.object({
  appyear: z.number().int(),
  matric: z.string().trim().min(1).max(6),
  names: optionalNullableString,
  tbl_section_id: z.number().nullable().optional(),
  designation: optionalNullableString,
  dateeng: optionalNullableDate,
  lengthservice: optionalNullableString,
  date_lpro: optionalNullableDate,
  date_lmer: optionalNullableDate,
  date_lstat: optionalNullableDate,
  precat: optionalNullableString,
  procat: optionalNullableString,
  presalary: optionalNullableInt,
  prosalary: optionalNullableInt,
  finincmonth: optionalNullableInt,
  finincyear: optionalNullableInt,
  award: optionalNullableString,
})

export const SalaryReviewImportBatchSchema = z.object({
  rows: z.array(SalaryReviewImportRowSchema).min(1).max(100),
})

export const SalaryReviewImportResultSchema = z.object({
  inserted: z.number().int(),
  replaced: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(
    z.object({
      row: z.number().int(),
      message: z.string(),
    }),
  ),
})

export const DECISION_LEVEL_CODES = [
  'UNIT_MANAGER',
  'GROUP_MANAGER',
  'DHR',
  'GM',
] as const

export const DECISION_SCOPES = ['unit', 'group', 'all'] as const

export const DecisionLevelCodeSchema = z.enum(DECISION_LEVEL_CODES)
export const DecisionScopeSchema = z.enum(DECISION_SCOPES)

export const DecisionAssignmentListQuerySchema = z.object({
  levelCode: DecisionLevelCodeSchema.optional(),
  unitId: z.string().max(3).optional(),
  groupId: z.string().min(1).optional(),
})

export const DecisionAssignmentUpsertSchema = z.object({
  levelCode: DecisionLevelCodeSchema,
  name: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  effdate: z.string().min(1),
  unitId: z.string().max(3).nullable().optional(),
  groupId: z.string().nullable().optional(),
})

export const SectionThroListQuerySchema = z
  .object({
    sectionId: z.coerce.number().int().optional(),
    unitId: z.string().max(3).optional(),
  })
  .refine(
    (data) => data.sectionId != null || Boolean(data.unitId?.trim()),
    { message: 'sectionId or unitId is required' },
  )

export const SectionThroUpsertSchema = z.object({
  sectionId: z.number().int(),
  name: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  effdate: z.string().min(1),
})

export const SectionThroBatchSchema = z.object({
  rows: z.array(SectionThroUpsertSchema).min(1),
})

export const SectionThroBatchResultSchema = z.object({
  saved: z.number().int(),
})

export const LetterCcCreateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  active: z.boolean().optional().default(true),
})

export const LetterCcUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
})

export const LetterCcMoveSchema = z.object({
  direction: z.enum(['up', 'down']),
})

export const LetterCcHideSchema = z.object({
  letterCcId: z.number().int(),
  hidden: z.boolean(),
})

export const WorkflowStatusSchema = z.enum([
  'PENDING',
  'VALIDATED',
  'REJECTED',
  'SUPERSEDED',
])

export const WorkflowReviewSchema = z.object({
  reviewNote: z.string().max(2000).optional().nullable(),
})

export const AllowanceTypeUpsertSchema = z.object({
  id: z.string().trim().min(1).max(30),
  allowanceTypeName: z.string().trim().min(1).max(120),
})

export const AllowanceUpsertSchema = z.object({
  id: z.string().trim().min(1).max(30),
  allowanceName: z.string().trim().min(1).max(120),
  allowanceTypeId: z.string().trim().min(1).max(30).nullable().optional(),
})

export const AllowanceRateUpsertSchema = z
  .object({
    allowanceId: z.string().trim().min(1).max(30),
    positionKeywordId: z.number().int().positive().nullable().optional(),
    allowanceAmtMin: z.number().finite(),
    allowanceAmtMax: z.number().finite(),
    effectiveDate: z.string().min(1),
  })
  .refine((v) => v.allowanceAmtMin <= v.allowanceAmtMax, {
    message: 'Minimum amount must be less than or equal to maximum amount',
    path: ['allowanceAmtMin'],
  })

export const AllowanceAllocationUpsertSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  allowanceId: z.string().trim().min(1).max(30),
  allowanceAmt: z.number().finite(),
  effectiveDate: z.string().min(1),
})

export const AllowanceAllocationUpdateSchema = z.object({
  allowanceId: z.string().trim().min(1).max(30).optional(),
  allowanceAmt: z.number().finite().optional(),
  effectiveDate: z.string().min(1).optional(),
})

export const AllowanceAllocationEligibilityQuerySchema = z.object({
  matricule: z.string().trim().min(1).max(30),
})

export const AllowanceAllocationBatchItemSchema = z.object({
  allowanceId: z.string().trim().min(1).max(30),
  allowanceAmt: z.number().finite(),
})

export const AllowanceAllocationBatchSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  items: z.array(AllowanceAllocationBatchItemSchema).min(1),
  effectiveDate: z.string().min(1),
})

export const PositionKeywordUpsertSchema = z.object({
  keyword: z.string().trim().min(1).max(120),
  active: z.boolean(),
})

export const PositionKeywordUpdateSchema = z.object({
  keyword: z.string().trim().min(1).max(120),
  active: z.boolean(),
})

export const AllowanceKeywordCreateSchema = z.object({
  allowanceId: z.string().trim().min(1).max(30),
  keywordId: z.number().int().positive(),
  active: z.boolean().optional(),
})

export const AllowanceKeywordUpdateSchema = z.object({
  active: z.boolean(),
})

export const AllowanceKeywordBulkSchema = z.object({
  keywordId: z.number().int().positive(),
  allowanceIds: z.array(z.string().trim().min(1).max(30)),
})

export const EmployeeListQuerySchema = z.object({
  workflowStatus: WorkflowStatusSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['matricule', 'name']).optional(),
})

export const EmployeeCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  firstname: z.string().trim().max(120).nullable().optional(),
  dateBirth: z.string().min(1),
  placeBirth: z.string().trim().min(1).max(120),
  sex: z.enum(['Male', 'Female']),
  nationality: z.string().trim().max(120).nullable().optional(),
  active: z.boolean().optional(),
  image: z
    .string()
    .max(2_500_000)
    .refine(
      (value) => value.startsWith('data:image/'),
      'Image must be an image file',
    )
    .nullable()
    .optional(),
})

export const EmployeeUpdateSchema = EmployeeCreateSchema.omit({
  matricule: true,
}).partial()

export type UserInput = z.infer<typeof UserSchema>
export type UserUpsertInput = z.infer<typeof UserUpsertSchema>
export type ChangePasswordRequestInput = z.infer<
  typeof ChangePasswordRequestSchema
>
export type FinancialYearInput = z.infer<typeof FinancialYearSchema>
export type FinancialYearUpsertInput = z.infer<typeof FinancialYearUpsertSchema>
export type HealthResponseInput = z.infer<typeof HealthResponseSchema>
export type ServerConfigInput = z.infer<typeof ServerConfigSchema>
export type AppraisalListQuery = z.infer<typeof AppraisalListQuerySchema>
export type AllocationLetterListQuery = z.infer<
  typeof AllocationLetterListQuerySchema
>
export type SalaryReviewExportQuery = z.infer<
  typeof SalaryReviewExportQuerySchema
>
export type AppraisalUpsertInput = z.infer<typeof AppraisalUpsertSchema>
export type MatricLookupQuery = z.infer<typeof MatricLookupQuerySchema>
export type MatricLookupResultInput = z.infer<typeof MatricLookupResultSchema>
export type ProposeCategoryInput = z.infer<typeof ProposeCategorySchema>
export type ProposedCategoryResultInput = z.infer<typeof ProposedCategoryResultSchema>
export type GroupUpsertInput = z.infer<typeof GroupUpsertSchema>
export type UnitUpsertInput = z.infer<typeof UnitUpsertSchema>
export type ZoneUpsertInput = z.infer<typeof ZoneUpsertSchema>
export type JurisdictionInput = z.infer<typeof JurisdictionSchema>
export type JurisdictionCreateInput = z.infer<typeof JurisdictionCreateSchema>
export type JurisdictionUpdateInput = z.infer<typeof JurisdictionUpdateSchema>
export type SectionUpsertInput = z.infer<typeof SectionUpsertSchema>
export type PostSalaryReviewStartInput = z.infer<
  typeof PostSalaryReviewStartSchema
>
export type PostSalaryReviewBatchInput = z.infer<
  typeof PostSalaryReviewBatchSchema
>
export type PostSalaryReviewStartResult = z.infer<
  typeof PostSalaryReviewStartResultSchema
>
export type PostSalaryReviewBatchResult = z.infer<
  typeof PostSalaryReviewBatchResultSchema
>
export type SalaryReviewImportRow = z.infer<typeof SalaryReviewImportRowSchema>
export type SalaryReviewImportBatchInput = z.infer<
  typeof SalaryReviewImportBatchSchema
>
export type SalaryReviewImportResult = z.infer<
  typeof SalaryReviewImportResultSchema
>
export type RoleUpdateInput = z.infer<typeof RoleUpdateSchema>
export type RoleCreateInput = z.infer<typeof RoleCreateSchema>
export type RoleDefinitionInput = z.infer<typeof RoleDefinitionSchema>
export type DecisionAssignmentListQuery = z.infer<
  typeof DecisionAssignmentListQuerySchema
>
export type DecisionAssignmentUpsertInput = z.infer<
  typeof DecisionAssignmentUpsertSchema
>
export type SectionThroListQuery = z.infer<typeof SectionThroListQuerySchema>
export type SectionThroUpsertInput = z.infer<typeof SectionThroUpsertSchema>
export type SectionThroBatchInput = z.infer<typeof SectionThroBatchSchema>
export type SectionThroBatchResult = z.infer<typeof SectionThroBatchResultSchema>
export type LetterCcCreateInput = z.infer<typeof LetterCcCreateSchema>
export type LetterCcUpdateInput = z.infer<typeof LetterCcUpdateSchema>
export type LetterCcMoveInput = z.infer<typeof LetterCcMoveSchema>
export type LetterCcHideInput = z.infer<typeof LetterCcHideSchema>
export type WorkflowReviewInput = z.infer<typeof WorkflowReviewSchema>
export type AllowanceTypeUpsertInput = z.infer<typeof AllowanceTypeUpsertSchema>
export type AllowanceUpsertInput = z.infer<typeof AllowanceUpsertSchema>
export type AllowanceRateUpsertInput = z.infer<typeof AllowanceRateUpsertSchema>
export type AllowanceAllocationUpsertInput = z.infer<
  typeof AllowanceAllocationUpsertSchema
>
export type AllowanceAllocationUpdateInput = z.infer<
  typeof AllowanceAllocationUpdateSchema
>
export type AllowanceAllocationEligibilityQuery = z.infer<
  typeof AllowanceAllocationEligibilityQuerySchema
>
export type AllowanceAllocationBatchInput = z.infer<
  typeof AllowanceAllocationBatchSchema
>
export type PositionKeywordUpsertInput = z.infer<
  typeof PositionKeywordUpsertSchema
>
export type PositionKeywordUpdateInput = z.infer<
  typeof PositionKeywordUpdateSchema
>
export type AllowanceKeywordCreateInput = z.infer<
  typeof AllowanceKeywordCreateSchema
>
export type AllowanceKeywordUpdateInput = z.infer<
  typeof AllowanceKeywordUpdateSchema
>
export type AllowanceKeywordBulkInput = z.infer<
  typeof AllowanceKeywordBulkSchema
>
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>
export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>
