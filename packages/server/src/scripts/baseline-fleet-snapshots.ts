/**
 * Record fleet lines that have never been on a memo as already communicated.
 * A registration and operator that already have a snapshot are left unchanged.
 * Safe to re-run.
 *
 *   npm run db:baseline-fleet-snapshots
 */
import 'dotenv/config'
import { prisma } from '../db.js'
import { baselineUncommunicatedFleet } from '../services/fleet-import.service.js'

const result = await baselineUncommunicatedFleet()
console.log(
  `Recorded ${result.linesInserted} fleet line(s) across ${result.pairsBaselined} registration and operator pair(s) as already communicated`,
)
await prisma.$disconnect()
