/**
 * Add tbl_roles permission columns for allowance tabs/tools.
 * Backfill from can_allowances so existing access is preserved.
 *
 *   npx tsx src/scripts/add-allowance-tab-permissions.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const NEW_COLUMNS = [
  'can_allowance_types',
  'can_allowance_catalog',
  'can_allowance_rates',
  'can_allowance_allocations',
  'can_position_keywords',
  'can_allowance_matrix',
] as const

const existing = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_roles'
      AND COLUMN_NAME IN (${NEW_COLUMNS.map((c) => `'${c}'`).join(', ')})`,
)

const present = new Set(existing.map((row) => row.COLUMN_NAME))

const additions: Array<{ name: (typeof NEW_COLUMNS)[number]; after: string }> =
  [
    { name: 'can_allowance_types', after: 'can_allowances' },
    { name: 'can_allowance_catalog', after: 'can_allowance_types' },
    { name: 'can_allowance_rates', after: 'can_allowance_catalog' },
    { name: 'can_allowance_allocations', after: 'can_allowance_rates' },
    { name: 'can_position_keywords', after: 'can_allowance_allocations' },
    { name: 'can_allowance_matrix', after: 'can_position_keywords' },
  ]

for (const col of additions) {
  if (present.has(col.name)) {
    console.log(`tbl_roles.${col.name} already exists`)
    continue
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_roles
       ADD COLUMN ${col.name} TINYINT(1) NOT NULL DEFAULT 0
       AFTER ${col.after}`,
  )
  console.log(`Added tbl_roles.${col.name}`)
}

const backfill = await prisma.$executeRawUnsafe(
  `UPDATE tbl_roles SET
     can_allowance_types = can_allowances,
     can_allowance_catalog = can_allowances,
     can_allowance_rates = can_allowances,
     can_allowance_allocations = can_allowances,
     can_position_keywords = can_allowances,
     can_allowance_matrix = can_allowances`,
)
console.log(`Backfilled ${backfill} role row(s) from can_allowances`)

await prisma.$disconnect()
