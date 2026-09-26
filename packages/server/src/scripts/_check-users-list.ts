import 'dotenv/config'
import { prisma } from '../db.js'
import { mapDbUser } from '../services/user-mapper.js'
import { listUsers } from '../services/users.service.js'
import { isUserRecordInScope } from '../services/authz.service.js'

const rows = await prisma.tbl_users.findMany({ orderBy: { id: 'asc' } })
console.log(
  'db users',
  rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    group: r.tbl_group_id,
    unit: r.tbl_unit_id,
    section: r.tbl_section_id,
  })),
)

const mapped = []
for (const row of rows) {
  try {
    mapped.push(await mapDbUser(row))
  } catch (e) {
    console.log('map fail', row.id, (e as Error).message)
  }
}

for (const actor of mapped) {
  console.log('\n--- as', actor.username, actor.role, actor.jurisdiction)
  const listed = await listUsers(actor)
  console.log(
    'listUsers',
    listed.map((u) => ({ id: u.id, username: u.username, role: u.role })),
  )
  for (const target of mapped) {
    if (target.id === actor.id) continue
    const inScope = await isUserRecordInScope(actor, target)
    console.log('  inScope?', target.username, target.role, inScope)
  }
}

await prisma.$disconnect()
