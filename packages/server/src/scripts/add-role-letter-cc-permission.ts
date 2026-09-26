/**
 * Add tbl_roles.can_letter_cc and backfill from can_organization.
 *
 *   npx tsx src/scripts/add-role-letter-cc-permission.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const COLUMN = 'can_letter_cc'

const existing = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_roles'
      AND COLUMN_NAME = '${COLUMN}'`,
)

if (existing.length === 0) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_letter_cc TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_organization`,
  )
  console.log('Added tbl_roles.can_letter_cc')
} else {
  console.log('tbl_roles.can_letter_cc already exists')
}

const backfill = await prisma.$executeRawUnsafe(
  `UPDATE tbl_roles SET can_letter_cc = can_organization`,
)
console.log(`Backfilled ${backfill} role row(s) from can_organization`)

await prisma.$disconnect()
