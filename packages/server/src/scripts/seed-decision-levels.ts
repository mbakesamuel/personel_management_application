/**
 * Seed / upsert the four signing offices.
 *
 *   npm run seed:decision-levels
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const LEVELS = [
  { code: 'UNIT_MANAGER', title: 'Estate / Unit', scope: 'unit' },
  { code: 'GROUP_MANAGER', title: 'Group', scope: 'group' },
  { code: 'DHR', title: 'Director, Human Resources', scope: 'all' },
  { code: 'GM', title: 'General Manager', scope: 'all' },
] as const

for (const level of LEVELS) {
  await prisma.tbl_decision_level.upsert({
    where: { code: level.code },
    create: { ...level },
    update: {
      title: level.title,
      scope: level.scope,
    },
  })
}

console.log(`Upserted ${LEVELS.length} decision level(s)`)
await prisma.$disconnect()
