import type { ProposedCategoryResult } from '@perf-appraisal-app/shared'
import {
  computeProposedCategoryFromScale,
  parseCatEchCode,
  requiresProposedCategoryCalculation,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

export class CategoryParseError extends Error {
  constructor(preCat: string) {
    super(`Could not determine current Category/Echelon from ${preCat}`)
    this.name = 'CategoryParseError'
  }
}

export type ResolvedCatEchIds = {
  catId: number
  echId: number
  catNum: number
  echCode: string
}

export async function resolveCatAndEchIds(
  preCat: string,
): Promise<ResolvedCatEchIds | null> {
  const { catNum, echCode } = parseCatEchCode(preCat)
  if (catNum <= 0 || echCode === '') return null

  const scale1 = await prisma.tbl_scale1.findFirst({
    where: { cat: catNum },
    select: { catid: true },
  })
  if (!scale1) return null

  const scale2 = await prisma.tbl_scale2.findFirst({
    where: { catid: scale1.catid, ech: echCode },
    select: { echid: true },
  })
  if (!scale2) return null

  return {
    catId: scale1.catid,
    echId: scale2.echid,
    catNum,
    echCode,
  }
}

async function loadScaleTables() {
  const [scale1, scale2] = await Promise.all([
    prisma.tbl_scale1.findMany({
      select: { catid: true, cat: true },
    }),
    prisma.tbl_scale2.findMany({
      select: { echid: true, ech: true, bsal: true, catid: true },
    }),
  ])
  return { scale1, scale2 }
}

export async function getProposedCategoryByAward(
  catId: number,
  echId: number,
  awardName: string,
): Promise<ProposedCategoryResult> {
  const { scale1, scale2 } = await loadScaleTables()
  return computeProposedCategoryFromScale({
    catId,
    echId,
    awardName,
    scale1,
    scale2,
  })
}

export async function proposeCategory(
  preCat: string,
  awardId: number,
): Promise<ProposedCategoryResult> {
  const award = await prisma.tbl_award.findUnique({
    where: { id: awardId },
    select: { award: true },
  })
  const awardName = award?.award ?? null

  if (!requiresProposedCategoryCalculation(awardName)) {
    return { overflow: false, proCat: preCat }
  }

  const resolved = await resolveCatAndEchIds(preCat)
  if (!resolved) {
    throw new CategoryParseError(preCat)
  }

  return getProposedCategoryByAward(
    resolved.catId,
    resolved.echId,
    awardName ?? '',
  )
}
