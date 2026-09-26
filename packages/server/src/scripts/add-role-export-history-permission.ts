/**
 * Add tbl_roles.can_export_history and backfill from can_import_history.
 *
 *   npx tsx src/scripts/add-role-export-history-permission.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const COLUMN = 'can_export_history'

const existing = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_roles'
      AND COLUMN_NAME = '${COLUMN}'`,
)

if (existing.length === 0) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_export_history TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_import_history`,
  )
  console.log('Added tbl_roles.can_export_history')
} else {
  console.log('tbl_roles.can_export_history already exists')
}

const backfill = await prisma.$executeRawUnsafe(
  `UPDATE tbl_roles SET can_export_history = can_import_history`,
)
console.log(`Backfilled ${backfill} role row(s) from can_import_history`)

await prisma.$disconnect()
