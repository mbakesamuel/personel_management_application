/**
 * Upsert a local administrator account.
 *
 *   npm run seed:admin
 */
import 'dotenv/config'
import { prisma } from '../db.js'
import { hashPassword } from '../services/auth.service.js'

const USERNAME = 'puru'
const PASSWORD = 'sammym1986'
const ROLE = 'ADMINISTRATOR'

const password = await hashPassword(PASSWORD)
const existing = await prisma.tbl_users.findFirst({
  where: { username: USERNAME },
})

if (existing) {
  await prisma.tbl_users.update({
    where: { id: existing.id },
    data: { password, role: ROLE, mustChangePassword: false },
  })
  console.log(`Updated admin user ${USERNAME} (id=${existing.id})`)
} else {
  const created = await prisma.tbl_users.create({
    data: {
      username: USERNAME,
      password,
      role: ROLE,
      mustChangePassword: false,
    },
  })
  console.log(`Created admin user ${USERNAME} (id=${created.id})`)
}

await prisma.$disconnect()
