/**
 * One-off: replace assignment.matric with free-text signatory + title.
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const columns = await prisma.$queryRawUnsafe<
  { COLUMN_NAME: string }[]
>(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tbl_decision_assignment'`,
)

const names = new Set(columns.map((c) => c.COLUMN_NAME))

if (!names.has('signatory')) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_decision_assignment
       ADD COLUMN signatory VARCHAR(255) NULL AFTER level_code`,
  )
}
if (!names.has('title')) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_decision_assignment
       ADD COLUMN title VARCHAR(255) NULL AFTER signatory`,
  )
}

if (names.has('matric')) {
  await prisma.$executeRawUnsafe(
    `UPDATE tbl_decision_assignment
     SET signatory = COALESCE(NULLIF(signatory, ''), matric, '')
     WHERE signatory IS NULL OR signatory = ''`,
  )
  await prisma.$executeRawUnsafe(
    `UPDATE tbl_decision_assignment
     SET title = CASE level_code
       WHEN 'UNIT_MANAGER' THEN 'Estate / Unit Manager'
       WHEN 'GROUP_MANAGER' THEN 'Group Manager'
       WHEN 'DHR' THEN 'Director, Human Resources'
       WHEN 'GM' THEN 'General Manager'
       ELSE COALESCE(title, '')
     END
     WHERE title IS NULL OR title = ''`,
  )
}

await prisma.$executeRawUnsafe(
  `UPDATE tbl_decision_assignment SET signatory = '' WHERE signatory IS NULL`,
)
await prisma.$executeRawUnsafe(
  `UPDATE tbl_decision_assignment SET title = '' WHERE title IS NULL`,
)

if (names.has('matric')) {
  const indexes = await prisma.$queryRawUnsafe<{ INDEX_NAME: string }[]>(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_decision_assignment'
       AND COLUMN_NAME = 'matric'`,
  )
  for (const idx of indexes) {
    if (idx.INDEX_NAME === 'PRIMARY') continue
    await prisma.$executeRawUnsafe(
      `ALTER TABLE tbl_decision_assignment DROP INDEX \`${idx.INDEX_NAME}\``,
    )
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tbl_decision_assignment DROP COLUMN matric`,
  )
}

await prisma.$executeRawUnsafe(
  `ALTER TABLE tbl_decision_assignment
     MODIFY signatory VARCHAR(255) NOT NULL,
     MODIFY title VARCHAR(255) NOT NULL`,
)

console.log('Updated tbl_decision_assignment: signatory + title (matric removed)')
await prisma.$disconnect()
