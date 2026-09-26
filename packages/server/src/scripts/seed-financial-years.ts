/**
 * Seed tbl_financialyear from distinct appyear values already used in
 * tbl_perfappraisal. Safe to re-run (upserts on appyear).
 *
 *   npm run seed:financial-years
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const rows = await prisma.tbl_perfappraisal.findMany({
  where: { appyear: { not: null } },
  select: { appyear: true },
  distinct: ['appyear'],
  orderBy: { appyear: 'asc' },
})

let created = 0
let skipped = 0

for (const row of rows) {
  if (row.appyear == null) continue

  const existing = await prisma.tbl_financialyear.findUnique({
    where: { appyear: row.appyear },
  })

  if (existing) {
    skipped += 1
    continue
  }

  await prisma.tbl_financialyear.create({
    data: { appyear: row.appyear, closed: false },
  })
  created += 1
  console.log(`Created financial year ${row.appyear}`)
}

console.log(`Done. created=${created} skipped=${skipped}`)
await prisma.$disconnect()
