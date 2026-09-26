import { parseCatEchCode } from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'
import { resolveLiveEmployees } from './live-employee.service.js'

type ScaleLookup = Map<string, number>

async function loadSalaryByCatLookup(): Promise<ScaleLookup> {
  const [scale1, scale2] = await Promise.all([
    prisma.tbl_scale1.findMany({ select: { catid: true, cat: true } }),
    prisma.tbl_scale2.findMany({
      select: { catid: true, ech: true, bsal: true },
    }),
  ])

  const catById = new Map<number, number>()
  for (const row of scale1) {
    if (row.cat != null) catById.set(row.catid, row.cat)
  }

  const lookup: ScaleLookup = new Map()
  for (const row of scale2) {
    if (row.catid == null || row.ech == null) continue
    const catNum = catById.get(row.catid)
    if (catNum == null) continue
    const ce = `${catNum}${row.ech}`
    lookup.set(ce, row.bsal)
  }
  return lookup
}

/** Port of Access GetSalaryByCat — CE code → basic salary (bsal / NBS). */
export function getBasicSalaryByCat(
  cat: string | null | undefined,
  lookup: ScaleLookup,
): number {
  if (!cat || !cat.trim()) return 0
  const trimmed = cat.trim()
  const direct = lookup.get(trimmed)
  if (direct != null) return direct

  const { catNum, echCode } = parseCatEchCode(trimmed)
  if (catNum <= 0 || !echCode) return 0
  return lookup.get(`${catNum}${echCode}`) ?? 0
}

export async function startSalaryReviewPost(appyear: number): Promise<{
  appyear: number
  ids: number[]
  total: number
}> {
  await prisma.tbl_salaryreview.deleteMany({ where: { appyear } })

  const rows = await prisma.tbl_perfappraisal.findMany({
    where: { appyear },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const ids = rows.map((r) => r.id)
  return { appyear, ids, total: ids.length }
}

export async function postSalaryReviewBatch(
  appyear: number,
  ids: number[],
): Promise<{ processed: number; posted: number; skipped: number }> {
  if (ids.length === 0) {
    return { processed: 0, posted: 0, skipped: 0 }
  }

  const appraisals = await prisma.tbl_perfappraisal.findMany({
    where: { id: { in: ids }, appyear },
  })

  const salaryLookup = await loadSalaryByCatLookup()
  const matrics = [
    ...new Set(
      appraisals
        .map((a) => a.matric?.trim())
        .filter((m): m is string => !!m),
    ),
  ]
  const awardIds = [
    ...new Set(
      appraisals
        .map((a) => a.tbl_award_id)
        .filter((id): id is number => id != null),
    ),
  ]

  const [people, awards] = await Promise.all([
    resolveLiveEmployees(matrics),
    awardIds.length > 0
      ? prisma.tbl_award.findMany({
          where: { id: { in: awardIds } },
          select: { id: true, award: true },
        })
      : Promise.resolve([] as { id: number; award: string | null }[]),
  ])

  const awardById = new Map(awards.map((a) => [a.id, a.award]))

  let posted = 0
  let skipped = 0
  const inserts: {
    appyear: number
    matric: string
    names: string | null
    tbl_section_id: number | null
    designation: string | null
    dateeng: Date | null
    lengthservice: string | null
    date_lpro: Date | null
    date_lmer: Date | null
    date_lstat: Date | null
    precat: string | null
    procat: string | null
    presalary: number
    prosalary: number
    finincmonth: number
    finincyear: number
    award: string | null
  }[] = []

  for (const row of appraisals) {
    const matric = row.matric?.trim() ?? ''
    if (!matric) {
      skipped += 1
      continue
    }
    const person = people.get(matric)
    if (!person) {
      skipped += 1
      continue
    }

    const preSalary = getBasicSalaryByCat(row.pre_cat, salaryLookup)
    const proSalary = getBasicSalaryByCat(row.pro_cat, salaryLookup)
    const finincmonth = proSalary - preSalary
    const finincyear = finincmonth * 12

    inserts.push({
      appyear,
      matric,
      names: person.names,
      tbl_section_id: null,
      designation: person.designation,
      dateeng: person.dateEng,
      lengthservice: row.lengthservice,
      date_lpro: row.date_lpro,
      date_lmer: row.date_lmerit,
      date_lstat: row.date_lstat,
      precat: row.pre_cat,
      procat: row.pro_cat,
      presalary: preSalary,
      prosalary: proSalary,
      finincmonth,
      finincyear,
      award:
        row.tbl_award_id != null
          ? (awardById.get(row.tbl_award_id) ?? null)
          : null,
    })
    posted += 1
  }

  if (inserts.length > 0) {
    await prisma.tbl_salaryreview.createMany({ data: inserts })
  }

  return {
    processed: appraisals.length,
    posted,
    skipped,
  }
}
