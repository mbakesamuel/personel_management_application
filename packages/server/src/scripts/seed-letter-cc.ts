/**
 * Create tbl_letter_cc if missing, then seed default copies when empty.
 *
 *   npm run seed:letter-cc
 */
import 'dotenv/config'
import { LETTER_CC } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

const tables = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
  `SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tbl_letter_cc'`,
)

if (tables.length === 0) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE tbl_letter_cc (
      id INT NOT NULL AUTO_INCREMENT,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY tbl_letter_cc_label_key (label),
      INDEX tbl_letter_cc_sort_order_idx (sort_order)
    )
  `)
  console.log('Created tbl_letter_cc')
} else {
  console.log('tbl_letter_cc already exists')
}

const count = await prisma.tbl_letter_cc.count()
if (count > 0) {
  console.log(`tbl_letter_cc already has ${count} row(s); skipping seed`)
} else {
  await prisma.tbl_letter_cc.createMany({
    data: LETTER_CC.map((label, index) => ({
      label,
      sort_order: index + 1,
      active: true,
    })),
  })
  console.log(`Inserted ${LETTER_CC.length} letter CC copies`)
}

async function ensureTable(name: string, ddl: string) {
  const existing = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = '${name}'`,
  )
  if (existing.length === 0) {
    await prisma.$executeRawUnsafe(ddl)
    console.log(`Created ${name}`)
  } else {
    console.log(`${name} already exists`)
  }
}

await ensureTable(
  'tbl_unit_letter_cc_hide',
  `CREATE TABLE tbl_unit_letter_cc_hide (
      id INT NOT NULL AUTO_INCREMENT,
      tbl_unit_id VARCHAR(3) NOT NULL,
      letter_cc_id INT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_unit_letter_cc_hide (tbl_unit_id, letter_cc_id),
      INDEX tbl_unit_letter_cc_hide_tbl_unit_id_idx (tbl_unit_id),
      CONSTRAINT tbl_unit_letter_cc_hide_letter_cc_id_fkey
        FOREIGN KEY (letter_cc_id) REFERENCES tbl_letter_cc(id) ON DELETE CASCADE
    )`,
)

await ensureTable(
  'tbl_unit_letter_cc',
  `CREATE TABLE tbl_unit_letter_cc (
      id INT NOT NULL AUTO_INCREMENT,
      tbl_unit_id VARCHAR(3) NOT NULL,
      label VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_unit_letter_cc_label (tbl_unit_id, label),
      INDEX tbl_unit_letter_cc_unit_sort_idx (tbl_unit_id, sort_order)
    )`,
)

await prisma.$disconnect()
