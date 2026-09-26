/**
 * Create tbl_section_thro if it does not exist.
 *   npx tsx src/scripts/create-section-thro.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const tables = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
  `SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tbl_section_thro'`,
)

if (tables.length === 0) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE tbl_section_thro (
      id INT NOT NULL AUTO_INCREMENT,
      tbl_section_id INT NOT NULL,
      signatory VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      effdate DATETIME(0) NOT NULL,
      PRIMARY KEY (id),
      INDEX tbl_section_thro_tbl_section_id_idx (tbl_section_id),
      INDEX tbl_section_thro_effdate_idx (effdate),
      UNIQUE KEY uniq_section_thro_effdate (tbl_section_id, effdate),
      CONSTRAINT tbl_section_thro_tbl_section_id_fkey
        FOREIGN KEY (tbl_section_id) REFERENCES tbl_section(id)
    )
  `)
  console.log('Created tbl_section_thro')
} else {
  console.log('tbl_section_thro already exists')
}

await prisma.$disconnect()
