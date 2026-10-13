/**
 * Seed leave types, the statutory calculation policy, and the diagram's rules.
 *
 *   npm run seed:leave
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const FROM = new Date('2026-01-01T00:00:00.000Z')

const retiredCodes = [
  'ANNUAL',
  'COL',
  'NURSING',
  'SICK',
  'STUDY',
  'UNPAID',
  'ADMINISTRATIVE',
  'OTHER',
  'PERSONAL',
  'RELIGIOUS',
  'MARRIAGE_EMPLOYEE',
  'MATERNITY',
  'MATERNITY_EXT',
  'PAL',
]
const retiredNames = [
  'maternity leave',
  'maternity leave extension',
  'paternity leave',
]
const candidates = await prisma.tbl_leave_type.findMany({
  select: { id: true, code: true, name: true },
})
const retired = candidates.filter(
  (row) =>
    retiredCodes.includes(row.code) ||
    retiredNames.includes(row.name.trim().toLowerCase()),
)
for (const type of retired) {
  const leaveCount = await prisma.tbl_leave_request.count({
    where: { leaveTypeId: type.id },
  })
  if (leaveCount > 0) {
    console.log(`Left ${type.code} in place because leave requests still use it`)
    continue
  }
  await prisma.tbl_leave_type.delete({ where: { id: type.id } })
}

const catalogue = [
  ...[
    ['BIRTH_CHILD', 'Birth of child'],
    ['DEATH_SPOUSE', 'Death of spouse'],
    ['DEATH_PARENT', 'Death of parent'],
    ['DEATH_CHILD', 'Death of child'],
    ['MARRIAGE_CHILD', 'Marriage Leave'],
    ['DEATH_PARENT_IN_LAW', 'Death of parent-in-law'],
  ].map(([code, name]) => ({
    code,
    name,
    category: 'PERMISSION' as const,
    isPaid: true,
    deductBalance: false,
    maxDays: null,
    durationUnit: 'WORKING_DAYS' as const,
    requireAttachment: true,
    description: 'Paid permission. Duration follows the collective agreement',
    proofName: 'Supporting document',
  })),
]

for (const row of catalogue) {
  const type = await prisma.tbl_leave_type.upsert({
    where: { code: row.code },
    create: {
      code: row.code,
      name: row.name,
      category: row.category,
      isPaid: row.isPaid,
      deductBalance: row.deductBalance,
      maxDays: row.maxDays,
      durationUnit: row.durationUnit,
      requireAttachment: row.requireAttachment,
      description: row.description,
      carryForwardAllowed: false,
      active: true,
    },
    update: {
      name: row.name,
      category: row.category,
      isPaid: row.isPaid,
      deductBalance: row.deductBalance,
      maxDays: row.maxDays,
      durationUnit: row.durationUnit,
      requireAttachment: row.requireAttachment,
      description: row.description,
      active: true,
    },
  })
  if (row.proofName) {
    const existing = await prisma.tbl_leave_document_requirement.findFirst({
      where: { leaveTypeId: type.id, name: row.proofName },
    })
    if (!existing) {
      await prisma.tbl_leave_document_requirement.create({
        data: { leaveTypeId: type.id, name: row.proofName, sortOrder: 0 },
      })
    }
  }
}

await prisma.tbl_leave_calculation_policy.upsert({
  where: { code: 'STATUTORY' },
  create: {
    code: 'STATUTORY',
    name: 'Statutory leave',
    method: 'METHOD_1',
    effectiveFrom: FROM,
    active: true,
    description: 'Basic days plus seniority, accrued monthly',
  },
  update: {
    name: 'Statutory leave',
    method: 'METHOD_1',
    active: true,
  },
})

const entitlement = await prisma.tbl_leave_entitlement_rule.findFirst({
  where: { annualDays: 18, active: true },
})
if (!entitlement) {
  await prisma.tbl_leave_entitlement_rule.create({
    data: {
      annualDays: 18,
      effectiveFrom: FROM,
      active: true,
      notes: 'Statutory basic leave days',
    },
  })
}

const monthly = await prisma.tbl_leave_monthly_rate_rule.findFirst({
  where: { monthlyDays: 1.5, active: true },
})
if (!monthly) {
  await prisma.tbl_leave_monthly_rate_rule.create({
    data: {
      monthlyDays: 1.5,
      effectiveFrom: FROM,
      active: true,
      notes: 'Method 2 monthly rate',
    },
  })
}

const bands = [
  { minYears: 0, maxYears: 5, bonusDays: 0 },
  { minYears: 6, maxYears: 10, bonusDays: 3 },
  { minYears: 11, maxYears: 15, bonusDays: 6 },
  { minYears: 16, maxYears: null, bonusDays: 6 },
] as const

for (const band of bands) {
  const existing = await prisma.tbl_leave_seniority_rule.findFirst({
    where: { minYears: band.minYears, maxYears: band.maxYears },
  })
  if (!existing) {
    await prisma.tbl_leave_seniority_rule.create({
      data: {
        minYears: band.minYears,
        maxYears: band.maxYears,
        bonusDays: band.bonusDays,
        effectiveFrom: FROM,
        active: true,
      },
    })
  }
}

console.log('Seeded leave types, policy, entitlement, monthly rate, and seniority bands')
await prisma.$disconnect()
