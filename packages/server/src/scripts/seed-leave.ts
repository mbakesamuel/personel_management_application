/**
 * Seed leave types, the statutory calculation policy, and the diagram's rules.
 *
 *   npm run seed:leave
 */
import 'dotenv/config'
import { prisma } from '../db.js'

const FROM = new Date('2000-01-01T00:00:00.000Z')

await prisma.tbl_leave_type.upsert({
  where: { code: 'ANNUAL' },
  create: {
    code: 'ANNUAL',
    name: 'Annual leave',
    requireAttachment: false,
    carryForwardAllowed: false,
    active: true,
  },
  update: { name: 'Annual leave', active: true },
})

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

console.log('Seeded leave type, policy, entitlement, monthly rate, and seniority bands')
await prisma.$disconnect()
