/**
 * Set tbl_employee.currentUnitId from each employee's latest validated movement.
 * Latest is Eff_date descending, then id descending, matching the live lookup.
 * Safe to re-run.
 *
 *   npm run db:backfill-current-unit
 */
import 'dotenv/config'
import { prisma } from '../db.js'
import {
  normalizeUnitCode,
  unitCodesMatch,
} from '../services/live-employee.service.js'

type RankedMovement = {
  matricule: string
  To_unit_id: string | null
}

function resolveUnit(
  toUnitId: string | null,
  units: { id: string }[],
): string | null {
  const code = normalizeUnitCode(toUnitId)
  if (!code) return null
  return (
    units.find((unit) => unit.id === code)?.id ??
    units.find((unit) => unitCodesMatch(unit.id, code))?.id ??
    code
  )
}

const columns = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tbl_employee'
     AND COLUMN_NAME = 'currentUnitId'`,
)
if (columns.length === 0) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_employee
       ADD COLUMN currentUnitId VARCHAR(191) NULL,
       ADD INDEX tbl_employee_currentUnitId_idx (currentUnitId)`,
  )
  console.log('Added tbl_employee.currentUnitId')
}

const ranked = await prisma.$queryRaw<RankedMovement[]>`
  SELECT matricule, To_unit_id
  FROM (
    SELECT
      matricule,
      To_unit_id,
      ROW_NUMBER() OVER (
        PARTITION BY matricule
        ORDER BY Eff_date DESC, id DESC
      ) AS rn
    FROM tbl_emp_movement
    WHERE workflowStatus = 'VALIDATED'
  ) ranked
  WHERE rn = 1
`

const units = await prisma.tbl_unit.findMany({ select: { id: true } })
const employees = await prisma.tbl_employee.findMany({
  select: { matricule: true },
})
const knownMatricules = new Set(employees.map((row) => row.matricule))
const assignments = ranked
  .map((row) => ({
    matricule: row.matricule,
    currentUnitId: resolveUnit(row.To_unit_id, units),
  }))
  .filter(
    (row): row is { matricule: string; currentUnitId: string } =>
      row.currentUnitId != null && knownMatricules.has(row.matricule),
  )
const skipped = ranked.length - assignments.length

await prisma.tbl_employee.updateMany({
  where: { currentUnitId: { not: null } },
  data: { currentUnitId: null },
})

const chunkSize = 100
for (let index = 0; index < assignments.length; index += chunkSize) {
  const chunk = assignments.slice(index, index + chunkSize)
  await prisma.$transaction(
    chunk.map((row) =>
      prisma.tbl_employee.updateMany({
        where: { matricule: row.matricule },
        data: { currentUnitId: row.currentUnitId },
      }),
    ),
  )
}

console.log(
  `Set currentUnitId on ${assignments.length} employee(s) from ${ranked.length} validated posting(s); skipped ${skipped}`,
)
await prisma.$disconnect()
