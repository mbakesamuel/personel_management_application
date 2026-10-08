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
  canLeave: z.boolean(),
  canLeaveValidate: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canCommunicationAllowance: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canImportFleet: z.boolean(),
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
  canLeave: z.boolean(),
  canLeaveValidate: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canCommunicationAllowance: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canImportFleet: z.boolean(),
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
  canLeave: z.boolean(),
  canLeaveValidate: z.boolean(),
  canAllowances: z.boolean(),
  canAllowanceTypes: z.boolean(),
  canAllowanceCatalog: z.boolean(),
  canAllowanceRates: z.boolean(),
  canAllowanceAllocations: z.boolean(),
  canPositionKeywords: z.boolean(),
  canAllowanceMatrix: z.boolean(),
  canCommunicationAllowance: z.boolean(),
  canValidate: z.boolean(),
  canDemoteClassification: z.boolean(),
  canEditValidated: z.boolean(),
  canLetterCc: z.boolean(),
  canDecisionMatrix: z.boolean(),
  canThroughOfficers: z.boolean(),
  canImportHistory: z.boolean(),
  canExportHistory: z.boolean(),
  canImportFleet: z.boolean(),
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

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

export const FleetImportRegistrationSchema = z.object({
  row: z.number().int().positive(),
  id: z.number().int().positive(),
  matricule: z.string().trim().min(1).max(191),
  operatorId: z.number().int().positive().nullable().optional(),
  allowanceId: z.string().trim().min(1).max(191),
  accountNo: z.string().trim().max(191).nullable().optional(),
  phoneNumber: z.string().trim().max(191).optional().default(''),
  appointmentDate: DateOnlySchema,
  endDate: DateOnlySchema.nullable().optional(),
  replacedById: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  includedInBatch: z.boolean().optional(),
  createdAt: DateOnlySchema.nullable().optional(),
  updatedAt: DateOnlySchema.nullable().optional(),
})

export const FleetImportDetailSchema = z.object({
  row: z.number().int().positive(),
  id: z.number().int().positive().nullable().optional(),
  fleetRegistrationId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  amount: z.number().finite().nonnegative(),
  operatorId: z.number().int().positive().nullable().optional(),
  accountNo: z.string().trim().max(191).nullable().optional(),
  phoneNumber: z.string().trim().max(191).optional().default(''),
})

export const FleetImportBatchSchema = z
  .object({
    registrations: z.array(FleetImportRegistrationSchema).max(5000),
    details: z.array(FleetImportDetailSchema).max(20000),
  })
  .refine(
    (value) => value.registrations.length + value.details.length > 0,
    'Workbook has no rows to import',
  )

export const FleetImportResultSchema = z.object({
  registrationsInserted: z.number().int(),
  detailsInserted: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(
    z.object({
      sheet: z.enum(['fleet_registration', 'fleet_reg_details']),
      row: z.number().int(),
      message: z.string(),
    }),
  ),
})

const PrefixRangeSchema = z
  .object({
    start: z.string().trim().regex(/^\d{2,6}$/, 'Use 2 to 6 digits'),
    end: z.string().trim().regex(/^\d{2,6}$/, 'Use 2 to 6 digits'),
  })
  .superRefine((range, ctx) => {
    if (range.start.length !== range.end.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Range start and end must be the same length',
        path: ['end'],
      })
      return
    }
    if (range.start > range.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Range start must be less than or equal to the end',
        path: ['end'],
      })
    }
  })

export const CommunicationOperatorUpsertSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    address: z.string().trim().max(200),
    isActive: z.boolean(),
    usesAccounts: z.boolean(),
    prefixes: z.array(PrefixRangeSchema).max(20),
  })
  .superRefine((value, ctx) => {
    if (!value.usesAccounts && value.prefixes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'This operator does not use number prefixes',
        path: ['prefixes'],
      })
    }
  })

export const OperatorAccountUpsertSchema = z.object({
  operatorId: z.number().int().positive(),
  accountNo: z.string().trim().min(1).max(191),
})

export const CommunicationRegistrationCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  allowanceId: z.string().trim().min(1).max(30),
  appointmentDate: DateOnlySchema,
})

export const CommunicationRegistrationRemoveSchema = z.object({
  endDate: DateOnlySchema,
})

export const CommunicationRegistrationTransferSchema = z.object({
  detailIds: z.array(z.number().int().positive()).min(1).max(50),
  operatorId: z.number().int().positive(),
  operatorAccountId: z.number().int().positive().nullable().optional(),
  phoneNumber: z.string().trim().max(20),
})

export const CommunicationDetailsUpdateSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.number().int().positive(),
        amount: z.number().finite().nonnegative(),
      }),
    )
    .min(1)
    .max(50),
})

export const CommunicationDetailsDeleteSchema = z.object({
  detailIds: z.array(z.number().int().positive()).min(1).max(50),
})

export const CommunicationAmountCreateSchema = z.object({
  fleetRegistrationId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  amount: z.number().finite().nonnegative(),
  operatorId: z.number().int().positive(),
  operatorAccountId: z.number().int().positive().nullable().optional(),
  phoneNumber: z.string().trim().max(20),
  adjustments: z
    .array(
      z.object({
        detailId: z.number().int().positive(),
        amount: z.number().finite().nonnegative(),
      }),
    )
    .optional()
    .default([]),
})

export const CommunicationBatchCreateSchema = z
  .object({
    operatorId: z.number().int().positive(),
    effectiveDate: DateOnlySchema,
    endDate: DateOnlySchema,
    fleetRegistrationIds: z.array(z.number().int().positive()).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<number>()
    value.fleetRegistrationIds.forEach((id, index) => {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A line can only be included once',
          path: ['fleetRegistrationIds', index],
        })
      }
      seen.add(id)
    })
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

const OptionalDateSchema = z
  .union([DateOnlySchema, z.literal(''), z.null()])
  .optional()

export const EmployeeMemoCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  memoTypeId: z.number().int().positive(),
  memoNumber: z.string().trim().max(80).nullable().optional(),
  memoDate: DateOnlySchema,
  subject: z.string().trim().min(1).max(191),
  details: z.string().max(8000).nullable().optional(),
  incidentDate: OptionalDateSchema,
  effectiveDate: OptionalDateSchema,
})

export const EmployeeMemoUpdateSchema = EmployeeMemoCreateSchema.omit({
  matricule: true,
}).partial()

export const EmployeeSanctionCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  memoId: z.number().int().positive(),
  sanctionId: z.number().int().positive(),
  reason: z.string().max(8000).nullable().optional(),
  startDate: OptionalDateSchema,
  endDate: OptionalDateSchema,
})

export const EmployeeSanctionUpdateSchema = EmployeeSanctionCreateSchema.omit({
  matricule: true,
  memoId: true,
}).partial()

export const LeaveTypeCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  requireAttachment: z.boolean().optional(),
  carryForwardAllowed: z.boolean().optional(),
  active: z.boolean().optional(),
})
export const LeaveTypeUpdateSchema = LeaveTypeCreateSchema.partial()

export const LeavePolicyCreateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  method: z.enum(['METHOD_1', 'METHOD_2']),
  effectiveFrom: DateOnlySchema,
  effectiveTo: OptionalDateSchema,
  active: z.boolean().optional(),
  description: z.string().trim().max(191).nullable().optional(),
})
export const LeavePolicyUpdateSchema = LeavePolicyCreateSchema.partial()

export const LeaveEntitlementCreateSchema = z.object({
  annualDays: z.number().positive(),
  effectiveFrom: DateOnlySchema,
  effectiveTo: OptionalDateSchema,
  active: z.boolean().optional(),
  notes: z.string().trim().max(191).nullable().optional(),
})
export const LeaveEntitlementUpdateSchema = LeaveEntitlementCreateSchema.partial()

export const LeaveMonthlyRateCreateSchema = z.object({
  monthlyDays: z.number().positive(),
  effectiveFrom: DateOnlySchema,
  effectiveTo: OptionalDateSchema,
  active: z.boolean().optional(),
  notes: z.string().trim().max(191).nullable().optional(),
})
export const LeaveMonthlyRateUpdateSchema = LeaveMonthlyRateCreateSchema.partial()

export const LeaveSeniorityCreateSchema = z.object({
  minYears: z.number().int().min(0),
  maxYears: z.number().int().min(0).nullable().optional(),
  bonusDays: z.number().min(0),
  effectiveFrom: DateOnlySchema,
  effectiveTo: OptionalDateSchema,
  active: z.boolean().optional(),
})
export const LeaveSeniorityUpdateSchema = LeaveSeniorityCreateSchema.partial()

export const LeaveTravelAllowanceCreateSchema = z.object({
  minCategory: z.number().int().min(1),
  maxCategory: z.number().int().min(1),
  amount: z.number().int().min(0),
  effectiveFrom: DateOnlySchema,
  effectiveTo: OptionalDateSchema,
  active: z.boolean().optional(),
})
export const LeaveTravelAllowanceUpdateSchema =
  LeaveTravelAllowanceCreateSchema.partial()

export const LeaveRequestCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  leaveTypeId: z.number().int().positive(),
  applicationDate: DateOnlySchema,
  startDate: DateOnlySchema,
  reason: z.string().max(8000).nullable().optional(),
})
export const LeaveRequestUpdateSchema = LeaveRequestCreateSchema.omit({
  matricule: true,
}).partial()

export const LeaveProcessSchema = z.object({
  reviewNote: z.string().max(2000).optional().nullable(),
  memoRef: z.string().trim().min(1).max(40),
})

export const PermissionRequestCreateSchema = z.object({
  matricule: z.string().trim().min(1).max(30),
  days: z.number().int().positive(),
  applicationDate: DateOnlySchema,
  reason: z.string().max(8000).nullable().optional(),
})
export const PermissionRequestUpdateSchema = PermissionRequestCreateSchema.omit({
  matricule: true,
}).partial()

const HOLIDAY_DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const PublicHolidayFieldsSchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  name: z.string().trim().min(1).max(120),
  active: z.boolean().optional(),
})

export const PublicHolidayCreateSchema = PublicHolidayFieldsSchema.refine(
  (value) => value.day <= (HOLIDAY_DAYS_IN_MONTH[value.month] ?? 0),
  {
    message: 'That day does not exist in the selected month',
    path: ['day'],
  },
)
export const PublicHolidayUpdateSchema = PublicHolidayFieldsSchema.partial()

export const LeaveMotherSettingSchema = z.object({
  daysPerChild: z.number().int().min(0),
  maxAgeYears: z.number().int().min(0),
})

export const LeaveLetterSettingSchema = z.object({
  saturdayWorking: z.boolean(),
  delegationPreface: z.string().trim().min(1).max(255),
  delegationName: z.string().trim().min(1).max(120),
  delegationTitle: z.string().trim().min(1).max(160),
  signCategory9: z.string().trim().min(1).max(160),
  ccBelow: z.string().trim().min(1).max(500),
  ccCategory9: z.string().trim().min(1).max(500),
})

export const LeaveResumptionCreateSchema = z.object({
  actualReturnDate: DateOnlySchema,
  remarks: z.string().trim().max(191).nullable().optional(),
})

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
export type CommunicationOperatorUpsertInput = z.infer<
  typeof CommunicationOperatorUpsertSchema
>
export type OperatorAccountUpsertInput = z.infer<
  typeof OperatorAccountUpsertSchema
>
export type CommunicationRegistrationCreateInput = z.infer<
  typeof CommunicationRegistrationCreateSchema
>
export type CommunicationRegistrationRemoveInput = z.infer<
  typeof CommunicationRegistrationRemoveSchema
>
export type CommunicationRegistrationTransferInput = z.infer<
  typeof CommunicationRegistrationTransferSchema
>
export type CommunicationDetailsUpdateInput = z.infer<
  typeof CommunicationDetailsUpdateSchema
>
export type CommunicationDetailsDeleteInput = z.infer<
  typeof CommunicationDetailsDeleteSchema
>
export type CommunicationAmountCreateInput = z.infer<
  typeof CommunicationAmountCreateSchema
>
export type CommunicationBatchCreateInput = z.infer<
  typeof CommunicationBatchCreateSchema
>
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>
export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>
export type EmployeeMemoCreateInput = z.infer<typeof EmployeeMemoCreateSchema>
export type EmployeeMemoUpdateInput = z.infer<typeof EmployeeMemoUpdateSchema>
export type EmployeeSanctionCreateInput = z.infer<
  typeof EmployeeSanctionCreateSchema
>
export type EmployeeSanctionUpdateInput = z.infer<
  typeof EmployeeSanctionUpdateSchema
>
export type LeaveTypeCreateInput = z.infer<typeof LeaveTypeCreateSchema>
export type LeaveTypeUpdateInput = z.infer<typeof LeaveTypeUpdateSchema>
export type LeavePolicyCreateInput = z.infer<typeof LeavePolicyCreateSchema>
export type LeavePolicyUpdateInput = z.infer<typeof LeavePolicyUpdateSchema>
export type LeaveEntitlementCreateInput = z.infer<
  typeof LeaveEntitlementCreateSchema
>
export type LeaveEntitlementUpdateInput = z.infer<
  typeof LeaveEntitlementUpdateSchema
>
export type LeaveMonthlyRateCreateInput = z.infer<
  typeof LeaveMonthlyRateCreateSchema
>
export type LeaveMonthlyRateUpdateInput = z.infer<
  typeof LeaveMonthlyRateUpdateSchema
>
export type LeaveSeniorityCreateInput = z.infer<typeof LeaveSeniorityCreateSchema>
export type LeaveSeniorityUpdateInput = z.infer<typeof LeaveSeniorityUpdateSchema>
export type LeaveTravelAllowanceCreateInput = z.infer<
  typeof LeaveTravelAllowanceCreateSchema
>
export type LeaveTravelAllowanceUpdateInput = z.infer<
  typeof LeaveTravelAllowanceUpdateSchema
>
export type LeaveRequestCreateInput = z.infer<typeof LeaveRequestCreateSchema>
export type LeaveRequestUpdateInput = z.infer<typeof LeaveRequestUpdateSchema>
export type LeaveProcessInput = z.infer<typeof LeaveProcessSchema>
export type PermissionRequestCreateInput = z.infer<
  typeof PermissionRequestCreateSchema
>
export type PermissionRequestUpdateInput = z.infer<
  typeof PermissionRequestUpdateSchema
>
export type PublicHolidayCreateInput = z.infer<typeof PublicHolidayCreateSchema>
export type PublicHolidayUpdateInput = z.infer<typeof PublicHolidayUpdateSchema>
export type LeaveMotherSettingInput = z.infer<typeof LeaveMotherSettingSchema>
export type LeaveLetterSettingInput = z.infer<typeof LeaveLetterSettingSchema>
export type LeaveResumptionCreateInput = z.infer<
  typeof LeaveResumptionCreateSchema
>

export const DashboardGroupKindSchema = z.enum([
  'HR',
  'WELCOME',
  'COMMUNICATION',
  'ALLOWANCE',
])

export const DashboardGroupCreateSchema = z.object({
  label: z.string().trim().min(1).max(120),
})

export const DashboardGroupAssignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        roleCode: z.string().trim().min(1).max(30),
        groupCode: z.string().trim().min(1).max(40),
      }),
    )
    .superRefine((rows, ctx) => {
      const seen = new Set<string>()
      rows.forEach((row, index) => {
        if (seen.has(row.roleCode)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each role can belong to only one dashboard group',
            path: [index, 'roleCode'],
          })
        }
        seen.add(row.roleCode)
      })
    }),
})

export type DashboardGroupCreateInput = z.infer<
  typeof DashboardGroupCreateSchema
>
export type DashboardGroupAssignmentsInput = z.infer<
  typeof DashboardGroupAssignmentsSchema
>
export type FleetImportRegistration = z.infer<
  typeof FleetImportRegistrationSchema
>
export type FleetImportDetail = z.infer<typeof FleetImportDetailSchema>
export type FleetImportBatchInput = z.infer<typeof FleetImportBatchSchema>
export type FleetImportResult = z.infer<typeof FleetImportResultSchema>
