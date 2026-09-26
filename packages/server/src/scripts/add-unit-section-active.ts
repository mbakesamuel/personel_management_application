/**
 * Add tbl_unit.active and tbl_section.active if missing.
 *   npx tsx src/scripts/add-unit-section-active.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

async function addActiveColumn(table: 'tbl_unit' | 'tbl_section', after: string) {
  const columns = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${table}'
       AND COLUMN_NAME = 'active'`,
  )
  if (columns.length === 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${table}
         ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER ${after}`,
    )
    console.log(`Added ${table}.active`)
  } else {
    console.log(`${table}.active already exists`)
  }
}

await addActiveColumn('tbl_unit', 'groupid')
await addActiveColumn('tbl_section', 'tbl_unit_id')
await prisma.$disconnect()
