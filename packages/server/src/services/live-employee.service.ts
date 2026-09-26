import { formatProposedCat } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

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
  active: boolean
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

  const [employees, classifications, movements, employments, departures] =
    await Promise.all([
      prisma.tbl_employee.findMany({
        where: { matricule: { in: ids }, workflowStatus: 'VALIDATED' },
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
          unit: true,
        },
      }),
      prisma.tbl_emp_departure.findMany({
        where: {
          matricule: { in: ids },
          workflowStatus: 'VALIDATED',
          current: true,
        },
        select: { matricule: true },
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
  const departed = new Set(departures.map((row) => row.matricule))

  const codeUnits = employees.map((employee) => {
    const movement = movementByMatric.get(employee.matricule)
    const employment = employmentByMatric.get(employee.matricule)
    return (
      normalizeUnitCode(movement?.To_unit_id) ??
      normalizeUnitCode(employment?.unit) ??
      null
    )
  })
  const unitNames = await unitNameByCodes(
    codeUnits.filter((code): code is string => code != null),
  )

  for (const employee of employees) {
    const classification = classificationByMatric.get(employee.matricule)
    const movement = movementByMatric.get(employee.matricule)
    const employment = employmentByMatric.get(employee.matricule)
    const codeUnit =
      normalizeUnitCode(movement?.To_unit_id) ??
      normalizeUnitCode(employment?.unit)
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
      active: !departed.has(employee.matricule),
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

  const [movements, employments] = await Promise.all([
    prisma.tbl_emp_movement.findMany({
      where: {
        workflowStatus: 'VALIDATED',
        To_unit_id: { in: lookupIds },
      },
      select: { matricule: true },
    }),
    prisma.tbl_emp_employment.findMany({
      where: {
        workflowStatus: 'VALIDATED',
        current: true,
        unit: { in: lookupIds },
      },
      select: { matricule: true },
    }),
  ])

  const matricules = [
    ...new Set([
      ...movements.map((row) => row.matricule),
      ...employments.map((row) => row.matricule),
    ]),
  ]

  if (matricules.length === 0) return []

  const live = await prisma.tbl_employee.findMany({
    where: { matricule: { in: matricules }, workflowStatus: 'VALIDATED' },
    select: { matricule: true },
  })
  return live.map((row) => row.matricule)
}
