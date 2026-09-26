/**
 * One-time fix: imported/snapshot personnel were stored as PENDING, but
 * appraisal live lookup only resolves VALIDATED records.
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const now = new Date()

const employees = await prisma.$executeRawUnsafe(`
  UPDATE tbl_employee
  SET workflowStatus = 'VALIDATED',
      validatedAt = COALESCE(validatedAt, NOW()),
      validatedById = COALESCE(validatedById, createdById)
  WHERE workflowStatus = 'PENDING'
`)

const identifications = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_nat_iden
  SET workflowStatus = 'VALIDATED',
      \`current\` = 1,
      validatedAt = COALESCE(validatedAt, NOW()),
      validatedById = COALESCE(validatedById, createdById)
  WHERE workflowStatus = 'PENDING'
`)

const movements = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_movement
  SET workflowStatus = 'VALIDATED',
      validatedAt = COALESCE(validatedAt, NOW()),
      validatedById = COALESCE(validatedById, createdById)
  WHERE workflowStatus = 'PENDING'
`)

const employmentsCleared = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_employment
  SET workflowStatus = 'VALIDATED',
      \`current\` = 0,
      validatedAt = COALESCE(validatedAt, NOW()),
      validatedById = COALESCE(validatedById, createdById)
  WHERE workflowStatus = 'PENDING'
`)

const employmentsCurrent = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_employment e
  INNER JOIN (
    SELECT matricule, MAX(id) AS maxId
    FROM tbl_emp_employment
    WHERE workflowStatus = 'VALIDATED'
    GROUP BY matricule
  ) latest ON latest.maxId = e.id
  SET e.\`current\` = 1
`)

const classificationsCleared = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_class
  SET workflowStatus = 'VALIDATED',
      \`current\` = 0,
      validatedAt = COALESCE(validatedAt, NOW()),
      validatedById = COALESCE(validatedById, createdById)
  WHERE workflowStatus = 'PENDING'
`)

const classificationsCurrent = await prisma.$executeRawUnsafe(`
  UPDATE tbl_emp_class c
  INNER JOIN (
    SELECT matricule, MAX(id) AS maxId
    FROM tbl_emp_class
    WHERE workflowStatus = 'VALIDATED'
    GROUP BY matricule
  ) latest ON latest.maxId = c.id
  SET c.\`current\` = 1
`)

console.log(
  JSON.stringify(
    {
      employees,
      identifications,
      movements,
      employmentsCleared,
      employmentsCurrent,
      classificationsCleared,
      classificationsCurrent,
      checkedAt: now.toISOString(),
    },
    null,
    2,
  ),
)

const check = await prisma.$queryRawUnsafe<
  { matricule: string; name: string; workflowStatus: string }[]
>(`SELECT matricule, name, workflowStatus FROM tbl_employee WHERE matricule = '080189'`)
console.log('080189', check)

await prisma.$disconnect()
