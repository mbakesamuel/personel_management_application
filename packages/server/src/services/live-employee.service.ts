import { formatProposedCat } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from './personnel-workflow.js'

export type LiveEmployee = {
  matricule: string
  names: string
  sex: string
  dateBirth: Date
  dateEng: Date | null
  designation: string | null
  category: string | null
  echelon: string | null
  preCat: string | null
  codeUnit: string | null
  unitName: string | null
}

/** Employees that workflows may use: validated and still active. */
const operationalEmployeeWhere = {
  workflowStatus: 'VALIDATED' as const,
  active: true,
}

export function formatEmployeeName(
  name: string,
  firstname?: string | null,
): string {
  return [name, firstname].filter((part) => part && part.trim()).join(' ').trim()
}

export function normalizeUnitCode(
  value: string | number | null | undefined,
): string | null {
  if (value == null || value === '') return null
  const code = String(value).trim()
  if (!code || code === '0') return null
  return code
}

export function unitCodesMatch(a: string, b: string): boolean {
  if (a === b) return true
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

function unitIdCandidates(code: string): string[] {
  const ids = [code]
  const n = Number(code)
  if (Number.isInteger(n)) {
    ids.push(String(n), String(n).padStart(3, '0'))
  }
  return [...new Set(ids)]
}

/** Unit ids that count as the same posting, including padded codes. */
export function unitMatchIds(unitIds: string[]): string[] {
  const ids = new Set<string>()
  for (const unitId of unitIds) {
    const code = normalizeUnitCode(unitId)
    if (!code) continue
    for (const candidate of unitIdCandidates(code)) ids.add(candidate)
  }
  return [...ids]
}

/**
 * tbl_unit.id for a movement To unit. Padded codes such as 1 and 001 resolve
 * to the stored unit id. An unknown code is kept as entered. Null clears it.
 */
export async function canonicalUnitId(
  toUnitId: string | null | undefined,
): Promise<string | null> {
  const code = normalizeUnitCode(toUnitId)
  if (!code) return null
  const units = await prisma.tbl_unit.findMany({
    where: { id: { in: unitIdCandidates(code) } },
    select: { id: true },
  })
  return units.find((unit) => unit.id === code)?.id
    ?? units.find((unit) => unitCodesMatch(unit.id, code))?.id
    ?? code
}

function preCatFrom(category: string | null, echelon: string | null): string | null {
  if (!category && !echelon) return null
  const formatted = formatProposedCat(category, echelon)
  return formatted || null
}

async function unitNameByCodes(
  codes: string[],
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>()
  if (codes.length === 0) return names

  const lookupIds = [...new Set(codes.flatMap(unitIdCandidates))]
  const units = await prisma.tbl_unit.findMany({
    where: { id: { in: lookupIds } },
    select: { id: true, unit_name: true },
  })

  for (const code of codes) {
    const match = units.find((unit) => unitCodesMatch(unit.id, code))
    names.set(code, match?.unit_name ?? null)
  }
  return names
}

export async function resolveLiveEmployees(
  matricules: string[],
): Promise<Map<string, LiveEmployee>> {
  const ids = [
    ...new Set(matricules.map((value) => value.trim()).filter(Boolean)),
  ]
  const result = new Map<string, LiveEmployee>()
  if (ids.length === 0) return result

  const [employees, classifications, movements, employments] =
    await Promise.all([
      prisma.tbl_employee.findMany({
        where: { matricule: { in: ids }, ...operationalEmployeeWhere },
        select: {
          matricule: true,
          name: true,
          firstname: true,
          sex: true,
          dateBirth: true,
        },
      }),
      prisma.tbl_emp_class.findMany({
        where: {
          matricule: { in: ids },
          workflowStatus: 'VALIDATED',
        },
        orderBy: [
          { letter_date: 'desc' },
          { effective_date: 'desc' },
          { id: 'desc' },
        ],
        select: {
          matricule: true,
          category: true,
          echelon: true,
        },
      }),
      prisma.tbl_emp_movement.findMany({
        where: {
          matricule: { in: ids },
          workflowStatus: 'VALIDATED',
        },
        orderBy: [{ Eff_date: 'desc' }, { id: 'desc' }],
        select: {
          matricule: true,
          To_unit_id: true,
          Position: true,
          Eff_date: true,
          id: true,
        },
      }),
      prisma.tbl_emp_employment.findMany({
        where: {
          matricule: { in: ids },
          workflowStatus: 'VALIDATED',
          current: true,
        },
        select: {
          matricule: true,
          dateEng: true,
          jobEng: true,
        },
      }),
    ])

  const classificationByMatric = new Map<
    string,
    (typeof classifications)[number]
  >()
  for (const row of classifications) {
    if (!classificationByMatric.has(row.matricule)) {
      classificationByMatric.set(row.matricule, row)
    }
  }
  const movementByMatric = new Map<string, (typeof movements)[number]>()
  for (const row of movements) {
    if (!movementByMatric.has(row.matricule)) {
      movementByMatric.set(row.matricule, row)
    }
  }
  const employmentByMatric = new Map(
    employments.map((row) => [row.matricule, row]),
  )

  const codeUnits = employees.map((employee) => {
    const movement = movementByMatric.get(employee.matricule)
    return normalizeUnitCode(movement?.To_unit_id)
  })
  const unitNames = await unitNameByCodes(
    codeUnits.filter((code): code is string => code != null),
  )

  for (const employee of employees) {
    const classification = classificationByMatric.get(employee.matricule)
    const movement = movementByMatric.get(employee.matricule)
    const employment = employmentByMatric.get(employee.matricule)
    const codeUnit = normalizeUnitCode(movement?.To_unit_id)
    const category = classification?.category ?? null
    const echelon = classification?.echelon ?? null

    result.set(employee.matricule, {
      matricule: employee.matricule,
      names: formatEmployeeName(employee.name, employee.firstname),
      sex: employee.sex,
      dateBirth: employee.dateBirth,
      dateEng: employment?.dateEng ?? null,
      designation: movement?.Position ?? employment?.jobEng ?? null,
      category,
      echelon,
      preCat: preCatFrom(category, echelon),
      codeUnit,
      unitName: codeUnit ? (unitNames.get(codeUnit) ?? null) : null,
    })
  }

  return result
}

export async function resolveLiveEmployee(
  matricule: string,
): Promise<LiveEmployee | null> {
  const trimmed = matricule.trim()
  if (!trimmed) return null
  const map = await resolveLiveEmployees([trimmed])
  return map.get(trimmed) ?? null
}

/**
 * Live employee for a workflow write. Missing, inactive, and not-yet-validated
 * people are rejected so new screens can call this instead of querying employees.
 */
export async function assertOperationalEmployee(
  matricule: string,
): Promise<LiveEmployee> {
  const trimmed = matricule.trim()
  const live = trimmed ? await resolveLiveEmployee(trimmed) : null
  if (live) return live

  if (!trimmed) {
    throw new PersonnelNotFoundError('Employee not found')
  }

  const row = await prisma.tbl_employee.findUnique({
    where: { matricule: trimmed },
    select: { active: true, workflowStatus: true },
  })
  if (!row) {
    throw new PersonnelNotFoundError(
      `No employee found for matricule ${trimmed}`,
    )
  }
  if (!row.active) {
    throw new PersonnelWorkflowError('Employee is inactive')
  }
  throw new PersonnelWorkflowError('Employee is not validated')
}

export async function findMatriculesForUnits(
  unitIds: string[],
): Promise<string[]> {
  const codes = [
    ...new Set(
      unitIds
        .map((id) => normalizeUnitCode(id))
        .filter((id): id is string => id != null),
    ),
  ]
  if (codes.length === 0) return []

  const lookupIds = [...new Set(codes.flatMap(unitIdCandidates))]

  const movements = await prisma.tbl_emp_movement.findMany({
    where: {
      workflowStatus: 'VALIDATED',
      To_unit_id: { in: lookupIds },
    },
    select: { matricule: true },
  })

  const matricules = [...new Set(movements.map((row) => row.matricule))]

  if (matricules.length === 0) return []

  const live = await prisma.tbl_employee.findMany({
    where: { matricule: { in: matricules }, ...operationalEmployeeWhere },
    select: { matricule: true },
  })
  return live.map((row) => row.matricule)
}
