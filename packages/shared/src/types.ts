import type { Role, RolePermissions, RoleScope } from './roles.js'

export type User = {
  id: number
  username: string | null
  role: Role
  groupId: string | null
  zoneId: string | null
  unitId: string | null
  sectionId: number | null
  financialYearId: number | null
  mustChangePassword: boolean
  permissions: RolePermissions
  jurisdiction: string
}

export type UserListItem = User

export type FinancialYear = {
  id: number
  appyear: number
  closed: boolean
}

export type LoginRequest = {
  username: string
  password: string
}

export type ChangePasswordRequest = {
  username: string
  currentPassword: string
  newPassword: string
}

export type LoginResponse = {
  user: User
  financialYear: FinancialYear | null
}

export type HealthResponse = {
  status: 'ok'
}

export type ServerConfig = {
  serverUrl: string
  authToken: string
}

export type AppraisalListItem = {
  id: number
  appyear: number | null
  matric: string | null
  names: string | null
  dateLmerit: string | null
  dateLstat: string | null
  dateLpro: string | null
  lengthservice: string | null
  preCat: string | null
  proCat: string | null
  award: string | null
  awardId: number | null
  sectionId: number | null
  sectionName: string | null
}

export type AppraisalEmployeeDetails = {
  section: string | null
  designation: string | null
  dateEngaged: string | null
  dateOfBirth: string | null
  presentAge: number | null
  lengthService: string | null
}

export type AppraisalDetail = {
  id: number | null
  appyear: number | null
  matric: string
  names: string | null
  preCat: string | null
  proCat: string | null
  dateLmerit: string | null
  dateLstat: string | null
  dateLpro: string | null
  awardId: number | null
  lengthservice: string | null
  employee: AppraisalEmployeeDetails
}

export type MatricLookupMode = 'create' | 'edit'

export type MatricLookupResult = AppraisalDetail & {
  eligibleAwardIds: number[]
  warnings?: string[]
}

export type ProposedCategoryResult =
  | { overflow: false; proCat: string; note?: string }
  | { overflow: true; note: string }

export type AwardOption = {
  id: number
  award: string | null
}

export type UnitOption = {
  id: string
  unitName: string
  groupId: string
  zoneId: string
  active: boolean
}

export type ZoneOption = {
  id: string
  zoneName: string
  groupId: string
  active: boolean
}

export type GroupOption = {
  id: string
  groupName: string
  active: boolean
}

export type SectionOption = {
  id: number
  section: string | null
  unitId: string | null
  active: boolean
}

export type LetterCcItem = {
  id: number
  label: string
  sortOrder: number
  active: boolean
}

export type LetterCcUnitDefault = LetterCcItem & {
  included: boolean
}

export type LetterCcUnitExtra = {
  id: number
  unitId: string
  label: string
  sortOrder: number
  active: boolean
}

export type LetterCcUnitOverlay = {
  unitId: string
  defaults: LetterCcUnitDefault[]
  extras: LetterCcUnitExtra[]
}

export type AppraisalLetter = {
  salaryReviewId: number
  appyear: number | null
  matric: string
  names: string | null
  award: string | null
  subject: string
  paragraphs: string[]
  fromTitle: string
  unitName: string | null
  designationLine: string
  signatoryName: string | null
  signatoryTitle: string | null
  throTitle: string | null
  memoDate: string
  cc: string[]
}

export type SkippedAppraisalLetter = {
  salaryReviewId: number
  matric: string | null
  names: string | null
  award: string | null
  reason: string
}

export type AppraisalLettersResponse = {
  letters: AppraisalLetter[]
  skipped: SkippedAppraisalLetter[]
}

export type AllocationLetterRow = {
  allowanceId: string
  allowanceName: string
  monthlyAmount: number
  areaToCover: string
}

export type AllocationLetter = {
  matricule: string
  names: string | null
  designationLine: string
  positionTitle: string
  unitId: string | null
  unitName: string | null
  fromTitle: string
  refs: string[]
  throTitle: string
  memoDate: string
  effectiveDateLabel: string
  subject: string
  openingParagraph: string
  rows: AllocationLetterRow[]
  conditions: string[]
  closingLine: string
  signatoryName: string | null
  signatoryTitle: string | null
  cc: string[]
}

export type AllocationLettersResponse = {
  letters: AllocationLetter[]
}

export type DashboardAppraisalCounts = {
  inProgress: number
  awarded: number
  posted: number
}

export type DashboardAllowanceCounts = {
  pending: number
  validated: number
  rejected: number
}

export type DashboardSlice = {
  label: string
  value: number
}

export type DashboardSexBar = {
  label: string
  male: number
  female: number
}

export type DashboardMonthBar = {
  label: string
  engagements: number
  departures: number
}

export type DashboardWorkforce = {
  sex: DashboardSlice[]
  category: DashboardSexBar[]
  group: DashboardSexBar[]
  workStatus: DashboardSlice[]
  place: DashboardSlice[]
  movement: DashboardMonthBar[]
}

export type DashboardResponse = {
  scopeLabel: string
  appyear: number | null
  appraisals: DashboardAppraisalCounts | null
  allowances: DashboardAllowanceCounts | null
  workforce: DashboardWorkforce
}

export type DashboardGroupKind = 'HR' | 'WELCOME' | 'COMMUNICATION' | 'ALLOWANCE'

export type DashboardGroupSummary = {
  code: string
  label: string
  kind: DashboardGroupKind
}

export type DashboardGroupListItem = DashboardGroupSummary & {
  system: boolean
  roleCodes: string[]
}

export type CommunicationOperatorBar = {
  name: string
  openLines: number
}

export type CommunicationDashboard = {
  openLines: number
  closedLines: number
  employeesOnOpenLines: number
  operators: CommunicationOperatorBar[]
  airtimeTotal: number
  dataTotal: number
  batchesThisMonth: number
  incompleteRegistrations: number
}

export type AllowanceAmountBar = {
  name: string
  amount: number
}

export type AllowanceDashboard = {
  currentAllocations: number
  employeesAllocated: number
  pending: number
  validated: number
  rejected: number
  totalAmount: number
  allowances: AllowanceAmountBar[]
}

export type HomeDashboardResponse = {
  group: DashboardGroupSummary
  hr: DashboardResponse | null
  communication: CommunicationDashboard | null
  allowance: AllowanceDashboard | null
}

export type AppraisalSummaryRow = {
  sn: number
  matric: string
  names: string | null
  designation: string | null
  dateEng: string | null
  lengthService: string | null
  dateLpro: string | null
  dateLmer: string | null
  dateLstat: string | null
  preCat: string | null
  proCat: string | null
  preSalary: number
  proSalary: number
  finIncMonth: number
  finIncYear: number
  award: string | null
}

export type AppraisalSummarySection = {
  sectionId: number | null
  sectionName: string
  unitId: string | null
  unitName: string | null
  groupName: string | null
  signatoryName: string | null
  signatoryTitle: string | null
  rows: AppraisalSummaryRow[]
  totals: {
    preSalary: number
    proSalary: number
    finIncMonth: number
    finIncYear: number
  }
}

export type DecisionScope = 'unit' | 'group' | 'all'

export type DecisionLevelCode =
  | 'UNIT_MANAGER'
  | 'GROUP_MANAGER'
  | 'DHR'
  | 'GM'

export type DecisionLevel = {
  code: DecisionLevelCode
  title: string
  catFrom: number
  catTo: number
  scope: DecisionScope
}

export type DecisionAssignment = {
  id: number
  levelCode: DecisionLevelCode
  name: string
  title: string
  unitId: string | null
  unitName: string | null
  groupId: string | null
  groupName: string | null
  effdate: string
}

export type SectionThroAssignment = {
  id: number
  sectionId: number
  sectionName: string | null
  name: string
  title: string
  effdate: string
}

export type SalaryReviewExportRow = {
  appyear: number | null
  matric: string | null
  names: string | null
  tbl_section_id: number | null
  designation: string | null
  dateeng: string | null
  lengthservice: string | null
  date_lpro: string | null
  date_lmer: string | null
  date_lstat: string | null
  precat: string | null
  procat: string | null
  presalary: number | null
  prosalary: number | null
  finincmonth: number | null
  finincyear: number | null
  award: string | null
}

export type SalaryReviewExportSection = {
  sectionId: number | null
  sectionName: string
  unitId: string | null
  unitName: string | null
  rows: SalaryReviewExportRow[]
}

export type SalaryReviewExportResponse = {
  appyear: number
  unitName: string | null
  sections: SalaryReviewExportSection[]
}

export type AppraisalSummaryResponse = {
  appyear: number | null
  sections: AppraisalSummarySection[]
}

export type WorkflowStatus = 'PENDING' | 'VALIDATED' | 'REJECTED' | 'SUPERSEDED'

export type AllowanceWorkflowFields = {
  workflowStatus: WorkflowStatus
  createdAt: string
  createdById: number
  updatedAt: string
  updatedById: number | null
  validatedAt: string | null
  validatedById: number | null
  rejectedAt: string | null
  rejectedById: number | null
  reviewNote: string | null
}

export type AllowanceTypeOption = {
  id: string
  allowanceTypeName: string
} & AllowanceWorkflowFields

export type AllowanceOption = {
  id: string
  allowanceName: string
  allowanceTypeId: string | null
  allowanceTypeName: string | null
} & AllowanceWorkflowFields

export type AllowanceRateOption = {
  id: number
  allowanceId: string
  allowanceName: string
  positionKeywordId: number | null
  positionKeyword: string | null
  allowanceAmtMin: number
  allowanceAmtMax: number
  effectiveDate: string
  current: boolean
} & AllowanceWorkflowFields

export type AllowanceAllocationOption = {
  id: number
  matricule: string
  employeeName: string
  allowanceId: string
  allowanceName: string
  allowanceAmt: number
  effectiveDate: string
  current: boolean
} & AllowanceWorkflowFields

export type CommunicationPrefixRange = {
  start: string
  end: string
}

export type OperatorAccount = {
  id: number
  operatorId: number
  operatorName: string
  accountNo: string
}

export type CommunicationOperator = {
  id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  usesAccounts: boolean
  prefixes: CommunicationPrefixRange[]
}

export type CommunicationServiceOption = {
  id: number
  name: string
}

export type CommunicationAllowanceOption = {
  id: string
  allowanceName: string
}

export type CommunicationRegistrationOperator = {
  id: number
  name: string
}

export interface CommunicationRegistration {
  id: number
  matricule: string
  employeeName: string
  operators: CommunicationRegistrationOperator[]
  allowanceId: string
  allowanceName: string
  allowanceAmt: number | null
  appointmentDate: string
  endDate: string | null
  isActive: boolean
  replacedById: number | null
  includedInBatch: boolean
  createdAt: string
}

export type CommunicationLine = {
  id: number
  matricule: string
  employeeName: string
  position: string | null
  phoneNumber: string
  operatorId: number
  operatorName: string
  airtime: number
  data: number
  groupName: string | null
  unitName: string | null
}

export type CommunicationAmount = {
  id: number
  fleetRegistrationId: number
  matricule: string
  employeeName: string
  operatorId: number
  operatorName: string
  accountNo: string | null
  phoneNumber: string
  serviceId: number
  serviceName: string
  amount: number
  current: boolean
}

export type CommunicationBatchAction = 'MODIFICATION' | 'REMOVAL' | 'CREATION'

export type CommunicationMemoDraftRow = {
  fleetRegistrationId: number
  employeeName: string
  matricule: string
  phoneNumber: string
  accountNo: string | null
  action: CommunicationBatchAction
  airtime: number
  previousAirtime: number | null
  data: number
  previousData: number | null
}

export type CommunicationBatchSummary = {
  id: number
  operatorId: number
  operatorName: string
  effectiveDate: string
  endDate: string
  createdAt: string
  modificationCount: number
  removalCount: number
  inclusionCount: number
  employeeNames: string[]
}

export type CommunicationBatchModification = {
  employeeName: string
  matricule: string
  designation: string | null
  phoneNumber: string
  accountNo: string | null
  serviceName: string
  previousAmount: number | null
  amount: number
}

export type CommunicationBatchRemoval = {
  employeeName: string
  matricule: string
  designation: string | null
  phoneNumber: string
  accountNo: string | null
  endDate: string
}

export type CommunicationBatchAdjustmentRow = {
  employeeName: string
  designation: string | null
  phoneNumber: string
  accountNo: string | null
  airtime: number
  data: number
  total: number
}

export type CommunicationBatchReport = {
  id: number
  operatorId: number
  operatorName: string
  operatorEmail: string | null
  operatorPhone: string | null
  operatorAddress: string | null
  effectiveDate: string
  endDate: string
  createdAt: string
  signatoryName: string | null
  signatoryTitle: string | null
  modifications: CommunicationBatchModification[]
  removals: CommunicationBatchRemoval[]
  adjustments: CommunicationBatchAdjustmentRow[]
  creations: CommunicationBatchAdjustmentRow[]
}

export type AllowanceEmployeeOption = {
  matricule: string
  name: string
  designation: string | null
}

export type AllowanceEligibilityKeyword = {
  id: number
  keyword: string
}

export type AllowanceEligibilityItem = {
  id: string
  allowanceName: string
  allowanceTypeName: string | null
  rateMin: number | null
  rateMax: number | null
}

export type AllowanceAllocationEligibility = {
  matricule: string
  name: string
  designation: string | null
  matchedKeywords: AllowanceEligibilityKeyword[]
  allowances: AllowanceEligibilityItem[]
}

export type PositionKeyword = {
  id: number
  keyword: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type AllowanceKeywordLink = {
  id: number
  allowanceId: string
  allowanceName: string
  keywordId: number
  keyword: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type EmployeeOption = {
  matricule: string
  name: string
  firstname: string | null
  dateBirth: string
  placeBirth: string
  sex: string | null
  nationality: string | null
  maritalStatus: string | null
  wives: number
  noChildren: number
  active: boolean
  unitName?: string | null
  dateEng?: string | null
  hasImage?: boolean
  image?: string | null
} & AllowanceWorkflowFields

export type EmployeeListResponse = {
  items: EmployeeOption[]
  total: number
  page: number
  limit: number
}
