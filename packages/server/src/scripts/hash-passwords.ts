/**
 * One-time helper: hash any plaintext passwords still stored in tbl_users.
 * Safe to re-run — already-bcrypt values are skipped.
 *
 *   npx tsx src/scripts/hash-passwords.ts
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'

const BCRYPT_ROUNDS = 12
const BCRYPT_PREFIX = /^\$2[aby]\$/

const users = await prisma.tbl_users.findMany({
  select: { id: true, username: true, password: true },
})

let upgraded = 0
let skipped = 0

for (const user of users) {
  if (!user.password) {
    skipped += 1
    continue
  }
  if (BCRYPT_PREFIX.test(user.password)) {
    skipped += 1
    continue
  }

  const hashed = await bcrypt.hash(user.password, BCRYPT_ROUNDS)
  await prisma.tbl_users.update({
    where: { id: user.id },
    data: { password: hashed },
  })
  upgraded += 1
  console.log(`Hashed password for user ${user.id} (${user.username ?? 'unnamed'})`)
}

console.log(`Done. upgraded=${upgraded} skipped=${skipped}`)
await prisma.$disconnect()
