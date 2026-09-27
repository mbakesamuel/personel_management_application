import {
  canEditWorkflowStatus,
  type WorkflowStatus,
} from '@personel-management-app/shared'

export type ChildResourceKey =
  | 'identifications'
  | 'insurances'
  | 'marital-statuses'
  | 'employments'
  | 'family-infos'
  | 'kin-infos'
  | 'departures'
  | 'employee-movements'
  | 'employee-classifications'

export type LookupKind =
  | 'marital'
  | 'insuranceCentre'
  | 'transferType'
  | 'unit'
  | 'unitAll'
  | 'contractType'

export type ChildFieldType = 'text' | 'date' | 'number' | 'select'

export type ChildColumn = {
  key: string
  label: string
  getValue: (row: Record<string, unknown>) => string
}

export type ChildField = {
  name: string
  label: string
  type: ChildFieldType
  required?: boolean
  lookup?: LookupKind
}

export type PersonnelChildTableConfig = {
  id: ChildResourceKey
  label: string
  columns: ChildColumn[]
  fields: ChildField[]
}

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
}

function str(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '—'
}

export function formatDateCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '—'
    return trimmed.slice(0, 10)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return '—'
}

function nestedStr(row: Record<string, unknown>, path: string[]): string {
  let cur: unknown = row
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return '—'
    cur = (cur as Record<string, unknown>)[key]
  }
  return str(cur)
}

export function toDateInputValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return ''
}

export function canMutateChild(
  status: WorkflowStatus,
  canEditValidated: boolean,
) {
  return canEditWorkflowStatus(status, canEditValidated)
}

export function canChangeEmployment(status: WorkflowStatus) {
  return status === 'PENDING' || status === 'REJECTED' || status === 'VALIDATED'
}

const EMPLOYMENT_DETAIL_FIELDS = new Set([
  'dateEng',
  'jobEng',
  'placeEng',
  'profession',
  'workStat',
])

export function isEmploymentDetailField(name: string) {
  return EMPLOYMENT_DETAIL_FIELDS.has(name)
}

/** Pending or rejected contract on an employment, if one is open. */
export function openEmploymentContract(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = row.contracts
  if (!Array.isArray(raw) || raw.length === 0) return null
  return (
    raw
      .map(asRecord)
      .find(
        (contract) =>
          contract.workflowStatus === 'PENDING' ||
          contract.workflowStatus === 'REJECTED',
      ) ?? null
  )
}

/**
 * Employment status, unless a validated employment has an open contract
 * revision. That revision is what still needs review.
 */
export function employmentDisplayStatus(
  row: Record<string, unknown>,
): WorkflowStatus {
  const employmentStatus = rowWorkflowStatus(row)
  if (employmentStatus !== 'VALIDATED') return employmentStatus
  const open = openEmploymentContract(row)
  if (!open) return employmentStatus
  return rowWorkflowStatus(open)
}

/** Prefer editable contract, else current, else latest. */
export function pickEmploymentContract(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const raw = row.contracts
  if (!Array.isArray(raw) || raw.length === 0) return null
  const list = raw.map(asRecord)
  const editable = list.find(
    (c) => c.workflowStatus === 'PENDING' || c.workflowStatus === 'REJECTED',
  )
  if (editable) return editable
  const current = list.find((c) => c.current === true)
  if (current) return current
  return list[0] ?? null
}

function normalizeUnitCode(value: unknown): string | null {
  if (value == null || value === '') return null
  const code = String(value).trim()
  if (!code || code === '0') return null
  return code
}

function toSortTime(value: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime()
  }
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value)
    return Number.isNaN(t) ? 0 : t
  }
  return 0
}

function rowSortId(row: Record<string, unknown>): number {
  const n = typeof row.id === 'number' ? row.id : Number(row.id)
  return Number.isFinite(n) ? n : 0
}

export function unitCodesMatch(a: string, b: string): boolean {
  if (a === b) return true
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

function toUnitFromMovement(
  row: Record<string, unknown>,
): { id: string; name: string } | null {
  const nested = asRecord(row.To_unit)
  const id = normalizeUnitCode(row.To_unit_id) ?? normalizeUnitCode(nested.id)
  if (!id) return null
  const nameRaw = nested.unit_name
  const name =
    typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : id
  return { id, name }
}

/** Newest validated movement that has a To unit. */
export function pickLatestValidatedToUnit(
  rows: Record<string, unknown>[],
): { id: string; name: string } | null {
  const validated = rows
    .filter((r) => r.workflowStatus === 'VALIDATED')
    .slice()
    .sort((a, b) => {
      const byDate = toSortTime(b.Eff_date) - toSortTime(a.Eff_date)
      if (byDate !== 0) return byDate
      return rowSortId(b) - rowSortId(a)
    })
  for (const row of validated) {
    const unit = toUnitFromMovement(row)
    if (unit) return unit
  }
  return null
}

/**
 * From unit for a new movement: the current To unit, using the dropdown's id
 * when `1` and `001` are the same unit.
 */
export function resolveMovementFromUnit(
  rows: Record<string, unknown>[],
  unitOptions: { value: string; label: string }[],
): { value: string; label: string } | null {
  const unit = pickLatestValidatedToUnit(rows)
  if (!unit) return null
  const matched = unitOptions.find((option) =>
    unitCodesMatch(option.value, unit.id),
  )
  if (matched) return { value: matched.value, label: matched.label }
  return { value: unit.id, label: unit.name }
}

export const PERSONNEL_CHILD_TABLES: PersonnelChildTableConfig[] = [
  {
    id: 'employments',
    label: 'Employments',
    columns: [
      {
        key: 'dateEng',
        label: 'Date engaged',
        getValue: (r) => formatDateCell(r.dateEng),
      },
      { key: 'jobEng', label: 'Job', getValue: (r) => str(r.jobEng) },
      { key: 'placeEng', label: 'Place', getValue: (r) => str(r.placeEng) },
      {
        key: 'contractType',
        label: 'Contract',
        getValue: (r) => str(pickEmploymentContract(r)?.contractType),
      },
      {
        key: 'contractStart',
        label: 'Start',
        getValue: (r) => formatDateCell(pickEmploymentContract(r)?.startDate),
      },
      {
        key: 'contractEnd',
        label: 'End',
        getValue: (r) => formatDateCell(pickEmploymentContract(r)?.endDate),
      },
    ],
    fields: [
      { name: 'dateEng', label: 'Date engaged', type: 'date', required: true },
      { name: 'jobEng', label: 'Job', type: 'text', required: true },
      { name: 'placeEng', label: 'Place', type: 'text', required: true },
      { name: 'profession', label: 'Profession', type: 'text' },
      { name: 'workStat', label: 'Work status', type: 'text' },
      {
        name: 'contractType',
        label: 'Contract type',
        type: 'select',
        required: true,
        lookup: 'contractType',
      },
      { name: 'startDate', label: 'Contract start', type: 'date', required: true },
      { name: 'endDate', label: 'Contract end', type: 'date' },
    ],
  },
  {
    id: 'employee-movements',
    label: 'Movements',
    columns: [
      {
        key: 'From_unit',
        label: 'From',
        getValue: (r) => nestedStr(r, ['From_unit', 'unit_name']),
      },
      {
        key: 'Eff_date',
        label: 'Effective',
        getValue: (r) => formatDateCell(r.Eff_date),
      }
      ,
      {
        key: 'To_unit',
        label: 'To',
        getValue: (r) => nestedStr(r, ['To_unit', 'unit_name']),
      },
      { key: 'Position', label: 'Position', getValue: (r) => str(r.Position) },
      {
        key: 'transfer',
        label: 'Transfer',
        getValue: (r) => nestedStr(r, ['TransferType', 'Type_transfer']),
      },
    ],
    fields: [
      { name: 'Eff_date', label: 'Effective date', type: 'date' },
      {
        name: 'From_unit_id',
        label: 'From unit',
        type: 'select',
        lookup: 'unit',
      },
      {
        name: 'To_unit_id',
        label: 'To unit',
        type: 'select',
        lookup: 'unitAll',
      },
      { name: 'Position', label: 'Position', type: 'text' },
      {
        name: 'trans_type_id',
        label: 'Transfer type',
        type: 'select',
        required: true,
        lookup: 'transferType',
      },
    ],
  },
  {
    id: 'employee-classifications',
    label: 'Classifications',
    columns: [
      { key: 'category', label: 'Category', getValue: (r) => str(r.category) },
      { key: 'echelon', label: 'Echelon', getValue: (r) => str(r.echelon) },
      {
        key: 'effective_date',
        label: 'Effective',
        getValue: (r) => formatDateCell(r.effective_date),
      },
      { key: 'letter_ref', label: 'Letter', getValue: (r) => str(r.letter_ref) },
    ],
    fields: [
      { name: 'category', label: 'Category', type: 'text', required: true },
      { name: 'echelon', label: 'Echelon', type: 'text', required: true },
      { name: 'zone', label: 'Zone', type: 'number' },
      { name: 'class_type', label: 'Class type', type: 'text' },
      { name: 'caption', label: 'Caption', type: 'text' },
      { name: 'letter_ref', label: 'Letter ref', type: 'text' },
      { name: 'letter_date', label: 'Letter date', type: 'date' },
      {
        name: 'effective_date',
        label: 'Effective date',
        type: 'date',
        required: true,
      },
      { name: 'comment', label: 'Comment', type: 'text' },
    ],
  },
  {
    id: 'departures',
    label: 'Departures',
    columns: [
      {
        key: 'dateDeparture',
        label: 'Date',
        getValue: (r) => formatDateCell(r.dateDeparture),
      },
      {
        key: 'reasonDeparture',
        label: 'Reason',
        getValue: (r) => str(r.reasonDeparture),
      },
      {
        key: 'effectiveDate',
        label: 'Effective',
        getValue: (r) => formatDateCell(r.effectiveDate),
      },
    ],
    fields: [
      { name: 'dateDeparture', label: 'Departure date', type: 'date' },
      { name: 'reasonDeparture', label: 'Reason', type: 'text' },
      {
        name: 'effectiveDate',
        label: 'Effective date',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'family-infos',
    label: 'Family infos',
    columns: [
      { key: 'noSpouses', label: 'Spouses', getValue: (r) => str(r.noSpouses) },
      {
        key: 'noChildren',
        label: 'Children',
        getValue: (r) => str(r.noChildren),
      },
      { key: 'relCode', label: 'Rel. code', getValue: (r) => str(r.relCode) },
      {
        key: 'effectiveDate',
        label: 'Effective',
        getValue: (r) => formatDateCell(r.effectiveDate),
      },
    ],
    fields: [
      { name: 'noSpouses', label: 'No. spouses', type: 'number' },
      { name: 'noChildren', label: 'No. children', type: 'number' },
      { name: 'relCode', label: 'Relation code', type: 'text' },
      { name: 'effectiveDate', label: 'Effective date', type: 'date' },
    ],
  },
  {
    id: 'marital-statuses',
    label: 'Marital statuses',
    columns: [
      {
        key: 'status',
        label: 'Status',
        getValue: (r) => nestedStr(r, ['maritalStatus', 'marital_status']),
      },
    ],
    fields: [
      {
        name: 'maritalStatusId',
        label: 'Marital status',
        type: 'select',
        required: true,
        lookup: 'marital',
      },
    ],
  },
  {
    id: 'insurances',
    label: 'Insurances',
    columns: [
      { key: 'ins_number', label: 'Number', getValue: (r) => str(r.ins_number) },
      {
        key: 'centre',
        label: 'Centre',
        getValue: (r) => nestedStr(r, ['ins_centre', 'centreName']),
      },
      {
        key: 'reg_date',
        label: 'Registered',
        getValue: (r) => formatDateCell(r.reg_date),
      },
    ],
    fields: [
      { name: 'ins_number', label: 'Insurance number', type: 'text' },
      {
        name: 'centre_id',
        label: 'Insurance centre',
        type: 'select',
        required: true,
        lookup: 'insuranceCentre',
      },
      { name: 'reg_date', label: 'Registration date', type: 'date' },
    ],
  },
  {
    id: 'kin-infos',
    label: 'Next of kin',
    columns: [
      { key: 'nextKinName', label: 'Name', getValue: (r) => str(r.nextKinName) },
      {
        key: 'nextKinRelation',
        label: 'Relation',
        getValue: (r) => str(r.nextKinRelation),
      },
      {
        key: 'effectiveDate',
        label: 'Effective',
        getValue: (r) => formatDateCell(r.effectiveDate),
      },
    ],
    fields: [
      { name: 'nextKinName', label: 'Name', type: 'text' },
      { name: 'nextKinRelation', label: 'Relation', type: 'text' },
      { name: 'nextKinAddress', label: 'Address', type: 'text' },
      {
        name: 'effectiveDate',
        label: 'Effective date',
        type: 'date',
        required: true,
      },
    ],
  },
  {
    id: 'identifications',
    label: 'Identifications',
    columns: [
      { key: 'idNumber', label: 'ID number', getValue: (r) => str(r.idNumber) },
      {
        key: 'date_issue',
        label: 'Issued',
        getValue: (r) => formatDateCell(r.date_issue),
      },
      { key: 'place_issue', label: 'Place', getValue: (r) => str(r.place_issue) },
      {
        key: 'date_expiry',
        label: 'Expiry',
        getValue: (r) => formatDateCell(r.date_expiry),
      },
    ],
    fields: [
      { name: 'idNumber', label: 'ID number', type: 'text', required: true },
      { name: 'date_issue', label: 'Date issued', type: 'date', required: true },
      { name: 'place_issue', label: 'Place issued', type: 'text', required: true },
      { name: 'date_expiry', label: 'Date expiry', type: 'date', required: true },
    ],
  },
]

export function rowId(row: Record<string, unknown>): number | null {
  const id = row.id
  return typeof id === 'number' && Number.isFinite(id) ? id : null
}

export function rowWorkflowStatus(row: Record<string, unknown>): WorkflowStatus {
  const status = row.workflowStatus
  if (
    status === 'PENDING' ||
    status === 'VALIDATED' ||
    status === 'REJECTED' ||
    status === 'SUPERSEDED'
  ) {
    return status
  }
  return 'PENDING'
}

export function emptyFormValues(
  fields: ChildField[],
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of fields) values[field.name] = ''
  return values
}

export function formValuesFromRow(
  fields: ChildField[],
  row: Record<string, unknown>,
  tableId?: ChildResourceKey,
): Record<string, string> {
  const values = emptyFormValues(fields)
  const contract =
    tableId === 'employments' ? pickEmploymentContract(row) : null
  for (const field of fields) {
    const fromContract =
      contract &&
      (field.name === 'contractType' ||
        field.name === 'startDate' ||
        field.name === 'endDate')
    const raw = fromContract ? contract[field.name] : row[field.name]
    if (field.type === 'date') {
      values[field.name] = toDateInputValue(raw)
    } else if (raw == null) {
      values[field.name] = ''
    } else {
      values[field.name] = String(raw)
    }
  }
  return values
}

const EMPLOYMENT_CONTRACT_FIELDS = new Set([
  'contractType',
  'startDate',
  'endDate',
])

export function buildPayload(
  fields: ChildField[],
  values: Record<string, string>,
  matricule?: string,
  tableId?: ChildResourceKey,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (matricule) payload.matricule = matricule

  for (const field of fields) {
    if (tableId === 'employments' && EMPLOYMENT_CONTRACT_FIELDS.has(field.name)) {
      continue
    }
    const raw = values[field.name]?.trim() ?? ''
    if (!raw) {
      if (field.required) continue
      payload[field.name] = null
      continue
    }
    if (field.type === 'number' || field.lookup === 'transferType') {
      const n = Number(raw)
      payload[field.name] = Number.isFinite(n) ? n : raw
    } else {
      payload[field.name] = raw
    }
  }

  if (tableId === 'employments') {
    const endRaw = values.endDate?.trim() ?? ''
    payload.contract = {
      contractType: values.contractType?.trim() ?? '',
      startDate: values.startDate?.trim() ?? '',
      endDate: endRaw || null,
    }
  }

  return payload
}

export function validateRequired(
  fields: ChildField[],
  values: Record<string, string>,
  tableId?: ChildResourceKey,
): string | null {
  for (const field of fields) {
    if (!field.required) continue
    if (!(values[field.name]?.trim())) {
      return `${field.label} is required`
    }
  }
  if (
    tableId === 'employments' &&
    values.contractType?.trim() === 'SPECIFIED' &&
    !(values.endDate?.trim())
  ) {
    return 'Contract end is required for a specified contract'
  }
  return null
}

export { asRecord }
