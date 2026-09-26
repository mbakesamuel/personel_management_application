/**
 * Add tbl_roles.can_personnel. Administrator gets true; others stay false.
 *
 *   npx tsx src/scripts/add-personnel-permission.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const existing = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_roles'
      AND COLUMN_NAME = 'can_personnel'`,
)

if (existing.length === 0) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN can_personnel TINYINT(1) NOT NULL DEFAULT 0
       AFTER can_organization`,
  )
  console.log('Added tbl_roles.can_personnel')
} else {
  console.log('tbl_roles.can_personnel already exists')
}

const admin = await prisma.$executeRawUnsafe(
  `UPDATE tbl_roles SET can_personnel = 1 WHERE code = 'ADMINISTRATOR'`,
)
console.log(`Set can_personnel=1 for Administrator (${admin} row(s))`)

await prisma.$disconnect()
