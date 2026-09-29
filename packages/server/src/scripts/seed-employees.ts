/**
 * Seed tbl_employee, tbl_emp_nat_iden, and tbl_emp_class from a
 * snapshot of the current tables.
 *
 *   npm run seed:employees:snapshot   # rewrite prisma/seeds from the live DB
 *   npm run seed:employees            # upsert those records
 */
import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { tbl_personnel_workflow_status, Prisma } from '@prisma/client'
import { prisma } from '../db.js'

type EmployeeRow = {
  matricule: string
  name: string
  firstname: string | null
  dateBirth: string | null
  placeBirth: string
  sex: string
  nationality: string | null
  workflowStatus: tbl_personnel_workflow_status
  createdAt: string | null
  createdById: number
  updatedAt: string | null
  updatedById: number | null
  validatedAt: string | null
  validatedById: number | null
  rejectedAt: string | null
  rejectedById: number | null
  reviewNote: string | null
}

type IdentificationRow = {
  id: number
  matricule: string
  idNumber: string
  date_issue: string | null
  place_issue: string
  date_expiry: string | null
  workflowStatus: tbl_personnel_workflow_status
  current: boolean
  createdAt: string | null
  createdById: number
  updatedAt: string | null
  updatedById: number | null
  validatedAt: string | null
  validatedById: number | null
  rejectedAt: string | null
  rejectedById: number | null
  reviewNote: string | null
}

type ClassificationRow = {
  id: number
  matricule: string
  category: string
  echelon: string
  zone: number | null
  class_type: string | null
  caption: string | null
  letter_ref: string | null
  letter_date: string | null
  effective_date: string | null
  comment: string | null
  workflowStatus: tbl_personnel_workflow_status
  current: boolean
  createdAt: string | null
  createdById: number
  updatedAt: string | null
  updatedById: number | null
  validatedAt: string | null
  validatedById: number | null
  rejectedAt: string | null
  rejectedById: number | null
  reviewNote: string | null
}

const BATCH_SIZE = 500
const SENTINEL_DATE = '1000-01-01'
const seedsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../prisma/seeds',
)
const employeesPath = join(seedsDir, 'employees.json')
const identificationsPath = join(seedsDir, 'identifications.json')
const classificationsPath = join(seedsDir, 'classifications.json')

function formatSqlDate(column: string): string {
  return `CASE
    WHEN ${column} IS NULL OR ${column} = 0 THEN NULL
    ELSE DATE_FORMAT(${column}, '%Y-%m-%d %H:%i:%s')
  END AS ${column}`
}

function parseDate(value: string | null | undefined): Date {
  if (!value || value.startsWith('0000')) {
    return new Date(`${SENTINEL_DATE}T00:00:00.000Z`)
  }
  const date = new Date(value.replace(' ', 'T') + (value.includes('T') ? '' : 'Z'))
  if (Number.isNaN(date.getTime())) {
    return new Date(`${SENTINEL_DATE}T00:00:00.000Z`)
  }
  return date
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value || value.startsWith('0000')) return null
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isInteger(n) ? n : fallback
}

function toNullableInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const rows = await readJson<T[]>(path)
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(seedsDir, { recursive: true })
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8')
}

async function writeSnapshot<T>(
  path: string,
  rows: T[],
  label: string,
): Promise<void> {
  if (rows.length === 0) {
    const existing = await readJsonArray<unknown>(path)
    if (existing.length > 0) {
      console.warn(
        `Skipped empty ${label} snapshot; kept ${existing.length} existing row(s) in ${path}`,
      )
      return
    }
  }

  await writeJson(path, rows)
  console.log(`Wrote ${rows.length} ${label} to ${path}`)
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

async function snapshotFromDatabase() {
  const employees = await prisma.$queryRawUnsafe<EmployeeRow[]>(
    `SELECT
      matricule,
      name,
      firstname,
      ${formatSqlDate('dateBirth')},
      placeBirth,
      sex,
      nationality,
      workflowStatus,
      ${formatSqlDate('createdAt')},
      createdById,
      ${formatSqlDate('updatedAt')},
      updatedById,
      ${formatSqlDate('validatedAt')},
      validatedById,
      ${formatSqlDate('rejectedAt')},
      rejectedById,
      reviewNote
    FROM tbl_employee
    WHERE matricule NOT LIKE 'SEED%'
    ORDER BY matricule`,
  )

  const identifications = await prisma.$queryRawUnsafe<
    (Omit<IdentificationRow, 'current'> & { current: number | boolean })[]
  >(
    `SELECT
      id,
      matricule,
      idNumber,
      ${formatSqlDate('date_issue')},
      place_issue,
      ${formatSqlDate('date_expiry')},
      workflowStatus,
      \`current\`,
      ${formatSqlDate('createdAt')},
      createdById,
      ${formatSqlDate('updatedAt')},
      updatedById,
      ${formatSqlDate('validatedAt')},
      validatedById,
      ${formatSqlDate('rejectedAt')},
      rejectedById,
      reviewNote
    FROM tbl_emp_nat_iden
    WHERE matricule NOT LIKE 'SEED%'
    ORDER BY id`,
  )

  const identificationRows: IdentificationRow[] = identifications.map(
    (row) => ({
      ...row,
      id: toInt(row.id),
      createdById: toInt(row.createdById),
      updatedById: toNullableInt(row.updatedById),
      validatedById: toNullableInt(row.validatedById),
      rejectedById: toNullableInt(row.rejectedById),
      current: row.current === true || row.current === 1,
    }),
  )

  const employeeRows: EmployeeRow[] = employees.map((row) => ({
    ...row,
    createdById: toInt(row.createdById),
    updatedById: toNullableInt(row.updatedById),
    validatedById: toNullableInt(row.validatedById),
    rejectedById: toNullableInt(row.rejectedById),
  }))

  const classifications = await prisma.$queryRawUnsafe<
    (Omit<ClassificationRow, 'current'> & { current: number | boolean })[]
  >(
    `SELECT
      id,
      matricule,
      category,
      echelon,
      zone,
      class_type,
      caption,
      letter_ref,
      ${formatSqlDate('letter_date')},
      ${formatSqlDate('effective_date')},
      comment,
      workflowStatus,
      \`current\`,
      ${formatSqlDate('createdAt')},
      createdById,
      ${formatSqlDate('updatedAt')},
      updatedById,
      ${formatSqlDate('validatedAt')},
      validatedById,
      ${formatSqlDate('rejectedAt')},
      rejectedById,
      reviewNote
    FROM tbl_emp_class
    WHERE matricule NOT LIKE 'SEED%'
    ORDER BY id`,
  )

  const classificationRows: ClassificationRow[] = classifications.map(
    (row) => ({
      ...row,
      id: toInt(row.id),
      zone: toNullableInt(row.zone),
      createdById: toInt(row.createdById),
      updatedById: toNullableInt(row.updatedById),
      validatedById: toNullableInt(row.validatedById),
      rejectedById: toNullableInt(row.rejectedById),
      current: row.current === true || row.current === 1,
    }),
  )

  await writeSnapshot(employeesPath, employeeRows, 'employee(s)')
  await writeSnapshot(
    identificationsPath,
    identificationRows,
    'identification(s)',
  )
  await writeSnapshot(
    classificationsPath,
    classificationRows,
    'classification(s)',
  )
}

function mapSex(value: string | null): 'Male' | 'Female' | null {
  const raw = value?.trim() ?? ''
  if (raw === 'M' || raw === 'Male') return 'Male'
  if (raw === 'F' || raw === 'Female') return 'Female'
  if (!raw) return null
  throw new Error(`Unknown sex value: ${raw}`)
}

function mapEmployee(
  row: EmployeeRow,
): Prisma.tbl_employeeCreateManyInput {
  return {
    matricule: row.matricule,
    name: row.name,
    firstname: row.firstname,
    dateBirth: parseDate(row.dateBirth),
    placeBirth: row.placeBirth,
    sex: mapSex(row.sex),
    nationality: row.nationality,
    // Snapshot imports are live historical records, not pending submissions.
    workflowStatus: 'VALIDATED',
    createdAt: parseDate(row.createdAt),
    createdById: toInt(row.createdById),
    updatedAt:
      parseOptionalDate(row.updatedAt) ?? parseDate(row.createdAt),
    updatedById: toNullableInt(row.updatedById),
    validatedAt:
      parseOptionalDate(row.validatedAt) ?? parseDate(row.createdAt),
    validatedById: toNullableInt(row.validatedById) ?? toInt(row.createdById),
    rejectedAt: null,
    rejectedById: null,
    reviewNote: row.reviewNote,
  }
}

function mapIdentification(
  row: IdentificationRow,
): Prisma.tbl_emp_nat_idenCreateManyInput {
  return {
    id: row.id,
    matricule: row.matricule,
    idNumber: row.idNumber,
    date_issue: parseDate(row.date_issue),
    place_issue: row.place_issue,
    date_expiry: parseDate(row.date_expiry),
    workflowStatus: 'VALIDATED',
    current: true,
    createdAt: parseDate(row.createdAt),
    createdById: toInt(row.createdById),
    updatedAt:
      parseOptionalDate(row.updatedAt) ?? parseDate(row.createdAt),
    updatedById: toNullableInt(row.updatedById),
    validatedAt:
      parseOptionalDate(row.validatedAt) ?? parseDate(row.createdAt),
    validatedById: toNullableInt(row.validatedById) ?? toInt(row.createdById),
    rejectedAt: null,
    rejectedById: null,
    reviewNote: row.reviewNote,
  }
}

function mapClassification(
  row: ClassificationRow,
): Prisma.tbl_emp_classCreateManyInput {
  return {
    id: row.id,
    matricule: row.matricule,
    category: row.category,
    echelon: row.echelon,
    zone: toNullableInt(row.zone),
    class_type: row.class_type,
    caption: row.caption,
    letter_ref: row.letter_ref,
    letter_date: parseOptionalDate(row.letter_date),
    effective_date: parseDate(row.effective_date),
    comment: row.comment,
    workflowStatus: 'VALIDATED',
    current: true,
    createdAt: parseDate(row.createdAt),
    createdById: toInt(row.createdById),
    updatedAt:
      parseOptionalDate(row.updatedAt) ?? parseDate(row.createdAt),
    updatedById: toNullableInt(row.updatedById),
    validatedAt:
      parseOptionalDate(row.validatedAt) ?? parseDate(row.createdAt),
    validatedById: toNullableInt(row.validatedById) ?? toInt(row.createdById),
    rejectedAt: null,
    rejectedById: null,
    reviewNote: row.reviewNote,
  }
}

async function removeDummySeedRows() {
  const classifications = await prisma.tbl_emp_class.deleteMany({
    where: { matricule: { startsWith: 'SEED' } },
  })
  const contracts = await prisma.tbl_emp_contract.deleteMany({
    where: { employment: { matricule: { startsWith: 'SEED' } } },
  })
  const identifications = await prisma.tbl_emp_nat_iden.deleteMany({
    where: { matricule: { startsWith: 'SEED' } },
  })
  const employees = await prisma.tbl_employee.deleteMany({
    where: { matricule: { startsWith: 'SEED' } },
  })
  return {
    employees: employees.count,
    identifications: identifications.count,
    classifications: classifications.count,
    contracts: contracts.count,
  }
}

async function seedFromSnapshot() {
  const employees = await readJsonArray<EmployeeRow>(employeesPath)
  const identifications = await readJsonArray<IdentificationRow>(
    identificationsPath,
  )
  const classifications = await readJsonArray<ClassificationRow>(
    classificationsPath,
  )
  const removed = await removeDummySeedRows()

  let employeesWritten = 0
  for (const batch of chunk(employees, BATCH_SIZE)) {
    const result = await prisma.tbl_employee.createMany({
      data: batch.map(mapEmployee),
      skipDuplicates: true,
    })
    employeesWritten += result.count
  }

  let identificationsWritten = 0
  for (const batch of chunk(identifications, BATCH_SIZE)) {
    const result = await prisma.tbl_emp_nat_iden.createMany({
      data: batch.map(mapIdentification),
      skipDuplicates: true,
    })
    identificationsWritten += result.count
  }

  let classificationsWritten = 0
  for (const batch of chunk(classifications, BATCH_SIZE)) {
    const result = await prisma.tbl_emp_class.createMany({
      data: batch.map(mapClassification),
      skipDuplicates: true,
    })
    classificationsWritten += result.count
  }

  console.log(
    `Seeded employees: inserted=${employeesWritten} snapshot=${employees.length}`,
  )
  console.log(
    `Seeded identifications: inserted=${identificationsWritten} snapshot=${identifications.length}`,
  )
  console.log(
    `Seeded classifications: inserted=${classificationsWritten} snapshot=${classifications.length}`,
  )
  if (
    removed.employees > 0 ||
    removed.identifications > 0 ||
    removed.classifications > 0
  ) {
    console.log(
      `Removed dummy seed rows: employees=${removed.employees} identifications=${removed.identifications} classifications=${removed.classifications}`,
    )
  }

  // createMany skipDuplicates leaves existing PENDING rows unchanged; force live status.
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_employee
    SET workflowStatus = 'VALIDATED',
        validatedAt = COALESCE(validatedAt, NOW()),
        validatedById = COALESCE(validatedById, createdById)
    WHERE workflowStatus = 'PENDING'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_nat_iden
    SET workflowStatus = 'VALIDATED',
        \`current\` = 1,
        validatedAt = COALESCE(validatedAt, NOW()),
        validatedById = COALESCE(validatedById, createdById)
    WHERE workflowStatus = 'PENDING'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_class
    SET workflowStatus = 'VALIDATED',
        \`current\` = 0,
        validatedAt = COALESCE(validatedAt, NOW()),
        validatedById = COALESCE(validatedById, createdById)
    WHERE workflowStatus = 'PENDING'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_class c
    INNER JOIN (
      SELECT matricule, MAX(id) AS maxId
      FROM tbl_emp_class
      WHERE workflowStatus = 'VALIDATED'
      GROUP BY matricule
    ) latest ON latest.maxId = c.id
    SET c.\`current\` = 1
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_employment
    SET workflowStatus = 'VALIDATED',
        \`current\` = 0,
        validatedAt = COALESCE(validatedAt, NOW()),
        validatedById = COALESCE(validatedById, createdById)
    WHERE workflowStatus = 'PENDING'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_employment e
    INNER JOIN (
      SELECT matricule, MAX(id) AS maxId
      FROM tbl_emp_employment
      WHERE workflowStatus = 'VALIDATED'
      GROUP BY matricule
    ) latest ON latest.maxId = e.id
    SET e.\`current\` = 1
  `)
  console.log('Marked imported personnel records as VALIDATED')

  await prisma.$executeRawUnsafe(`
    UPDATE tbl_employee
    SET updatedAt = COALESCE(NULLIF(createdAt, '0000-00-00 00:00:00'), NOW())
    WHERE CAST(updatedAt AS CHAR) LIKE '0000%'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_nat_iden
    SET updatedAt = COALESCE(NULLIF(createdAt, '0000-00-00 00:00:00'), NOW())
    WHERE CAST(updatedAt AS CHAR) LIKE '0000%'
  `)
  await prisma.$executeRawUnsafe(`
    UPDATE tbl_emp_class
    SET updatedAt = COALESCE(NULLIF(createdAt, '0000-00-00 00:00:00'), NOW())
    WHERE CAST(updatedAt AS CHAR) LIKE '0000%'
  `)
  console.log('Repaired zero updatedAt values on imported personnel')
}

const mode = process.argv.includes('--snapshot') ? 'snapshot' : 'seed'

if (mode === 'snapshot') {
  await snapshotFromDatabase()
} else {
  await seedFromSnapshot()
}

await prisma.$disconnect()
