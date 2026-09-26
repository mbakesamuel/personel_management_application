/**
 * Fix zero-dates (0000-00-00) that break the Prisma MariaDB adapter.
 */
import 'dotenv/config'
import { prisma } from '../db.js'

async function fix(label: string, sql: string) {
  const affected = await prisma.$executeRawUnsafe(sql)
  console.log(label, affected)
}

const tablesWithUpdatedAt = [
  'tbl_employee',
  'tbl_emp_nat_iden',
  'tbl_emp_insurance',
  'tbl_emp_marital_status',
  'tbl_emp_employment',
  'tbl_emp_contract',
  'tbl_emp_family',
  'tbl_emp_nextkin',
  'tbl_emp_departure',
  'tbl_emp_movement',
  'tbl_emp_class',
]

for (const table of tablesWithUpdatedAt) {
  await fix(
    `${table}.updatedAt`,
    `UPDATE ${table}
     SET updatedAt = COALESCE(
       NULLIF(createdAt, '0000-00-00 00:00:00'),
       NOW()
     )
     WHERE CAST(updatedAt AS CHAR) LIKE '0000%'`,
  )
}

await fix(
  'tbl_employee.dateBirth',
  `UPDATE tbl_employee
   SET dateBirth = '1000-01-01 00:00:00'
   WHERE CAST(dateBirth AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_class.letter_date nullify',
  `UPDATE tbl_emp_class
   SET letter_date = NULL
   WHERE letter_date IS NOT NULL AND CAST(letter_date AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_class.effective_date',
  `UPDATE tbl_emp_class
   SET effective_date = COALESCE(
     NULLIF(createdAt, '0000-00-00 00:00:00'),
     NOW()
   )
   WHERE CAST(effective_date AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_movement.Eff_date nullify',
  `UPDATE tbl_emp_movement
   SET Eff_date = NULL
   WHERE Eff_date IS NOT NULL AND CAST(Eff_date AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_employment.dateEng',
  `UPDATE tbl_emp_employment
   SET dateEng = COALESCE(
     NULLIF(createdAt, '0000-00-00 00:00:00'),
     NOW()
   )
   WHERE CAST(dateEng AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_nat_iden.date_issue',
  `UPDATE tbl_emp_nat_iden
   SET date_issue = '1000-01-01 00:00:00'
   WHERE CAST(date_issue AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_emp_nat_iden.date_expiry',
  `UPDATE tbl_emp_nat_iden
   SET date_expiry = '1000-01-01 00:00:00'
   WHERE CAST(date_expiry AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_group.updatedat',
  `UPDATE tbl_group
   SET updatedat = COALESCE(
     NULLIF(createdat, '0000-00-00 00:00:00'),
     NOW()
   )
   WHERE CAST(updatedat AS CHAR) LIKE '0000%'`,
)

await fix(
  'tbl_unit.updatedat',
  `UPDATE tbl_unit
   SET updatedat = COALESCE(
     NULLIF(createdat, '0000-00-00 00:00:00'),
     NOW()
   )
   WHERE CAST(updatedat AS CHAR) LIKE '0000%'`,
)

const employee = await prisma.tbl_employee.findUnique({
  where: { matricule: '080189' },
  select: { matricule: true, name: true, updatedAt: true, dateBirth: true },
})
console.log('employee OK', employee)

await prisma.$disconnect()
