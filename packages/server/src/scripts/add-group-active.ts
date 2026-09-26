/**
 * Add tbl_group.active if missing.
 *   npx tsx src/scripts/add-group-active.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const columns = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tbl_group'
     AND COLUMN_NAME = 'active'`,
)

if (columns.length === 0) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_group
       ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER group_name`,
  )
  console.log('Added tbl_group.active')
} else {
  console.log('tbl_group.active already exists')
}

await prisma.$disconnect()
