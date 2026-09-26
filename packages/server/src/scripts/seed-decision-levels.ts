/**
 * Seed / upsert the four decision-matric signing levels.
 *
 *   npm run seed:decision-levels
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const LEVELS = [
  {
    code: 'UNIT_MANAGER',
    title: 'Estate / Unit Manager',
    cat_from: 1,
    cat_to: 3,
    scope: 'unit',
  },
  {
    code: 'GROUP_MANAGER',
    title: 'Group Manager',
    cat_from: 4,
    cat_to: 6,
    scope: 'group',
  },
  {
    code: 'DHR',
    title: 'Director, Human Resources',
    cat_from: 7,
    cat_to: 9,
    scope: 'all',
  },
  {
    code: 'GM',
    title: 'General Manager',
    cat_from: 10,
    cat_to: 12,
    scope: 'all',
  },
] as const

for (const level of LEVELS) {
  await prisma.tbl_decision_level.upsert({
    where: { code: level.code },
    create: { ...level },
    update: {
      title: level.title,
      cat_from: level.cat_from,
      cat_to: level.cat_to,
      scope: level.scope,
    },
  })
}

console.log(`Upserted ${LEVELS.length} decision level(s)`)
await prisma.$disconnect()
