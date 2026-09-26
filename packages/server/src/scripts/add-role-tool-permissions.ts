/**
 * Add tbl_roles permission columns for Decision Matrix, Through Officers,
 * and Import Historic Appraisals. Backfill from existing org / FY flags.
 *
 *   npx tsx src/scripts/add-role-tool-permissions.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const NEW_COLUMNS = [
  'can_decision_matrix',
  'can_through_officers',
  'can_import_history',
] as const

const existing = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_roles'
      AND COLUMN_NAME IN (${NEW_COLUMNS.map((c) => `'${c}'`).join(', ')})`,
)

const present = new Set(existing.map((row) => row.COLUMN_NAME))

if (!present.has('can_decision_matrix')) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_decision_matrix TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_organization`,
  )
  console.log('Added tbl_roles.can_decision_matrix')
} else {
  console.log('tbl_roles.can_decision_matrix already exists')
}

if (!present.has('can_through_officers')) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_through_officers TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_decision_matrix`,
  )
  console.log('Added tbl_roles.can_through_officers')
} else {
  console.log('tbl_roles.can_through_officers already exists')
}

if (!present.has('can_import_history')) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_import_history TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_through_officers`,
  )
  console.log('Added tbl_roles.can_import_history')
} else {
  console.log('tbl_roles.can_import_history already exists')
}

const backfill = await prisma.$executeRawUnsafe(
  `UPDATE tbl_roles SET
     can_decision_matrix = can_organization,
     can_through_officers = can_organization,
     can_import_history = can_financial_years`,
)
console.log(`Backfilled ${backfill} role row(s) from org / FY flags`)

await prisma.$disconnect()
