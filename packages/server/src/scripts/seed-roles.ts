/**
 * Backfill: set role = ADMINISTRATOR for all existing users so current
 * accounts keep working after userlevel is removed.
 *
 *   npm run seed:roles
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const result = await prisma.tbl_users.updateMany({
  data: { role: 'ADMINISTRATOR' },
})

console.log(`Updated ${result.count} user(s) to ADMINISTRATOR`)
await prisma.$disconnect()
