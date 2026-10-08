/**
 * Seed memo types and sanction outcomes used by the employee file.
 *
 *   npm run seed:sanctions
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const MEMO_TYPES = [
  { code: 'QUERY', name: 'Query' },
  { code: 'WARNING', name: 'Warning' },
  { code: 'SUSPENSION_NOTICE', name: 'Suspension notice' },
] as const

const SANCTIONS = [
  'Verbal warning',
  'Written warning',
  'Final warning',
  'Suspension',
  'Termination',
] as const

for (const type of MEMO_TYPES) {
  await prisma.tbl_memo_type.upsert({
    where: { code: type.code },
    create: type,
    update: { name: type.name },
  })
}

for (const sanctionName of SANCTIONS) {
  const existing = await prisma.tbl_sanction.findFirst({
    where: { sanctionName },
    select: { id: true },
  })
  if (!existing) {
    await prisma.tbl_sanction.create({ data: { sanctionName } })
  }
}

console.log(
  `Upserted ${MEMO_TYPES.length} memo type(s) and ${SANCTIONS.length} sanction name(s)`,
)
await prisma.$disconnect()
