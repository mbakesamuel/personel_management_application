import type { ProposedCategoryResult } from './types.js'
import {
  formatProposedCat,
  nextEchelonId,
} from './category-code.js'
import {
  incrementStepsForAward,
  isUpgradingAward,
} from './appraisal-rules.js'

export type Scale1Row = {
  catid: number
  cat: number | null
}

export type Scale2Row = {
  echid: number
  ech: string | null
  bsal: number
  catid: number | null
}

export function computeProposedCategoryFromScale(input: {
  catId: number
  echId: number
  awardName: string
  scale1: Scale1Row[]
  scale2: Scale2Row[]
}): ProposedCategoryResult {
  const { catId, echId, awardName, scale1, scale2 } = input
  const steps = incrementStepsForAward(awardName)

  const categoryName = (id: number) => {
    const row = scale1.find((r) => r.catid === id)
    return row?.cat != null ? String(row.cat) : null
  }

  const echelonName = (id: number) =>
    scale2.find((r) => r.echid === id)?.ech ?? null

  const echelonsForCategory = (id: number) =>
    scale2
      .filter((row) => row.catid === id)
      .map((row) => ({ echid: row.echid }))

  if (steps != null) {
    const { echid: newEchId, overflow } = nextEchelonId(
      echelonsForCategory(catId),
      echId,
      steps,
    )

    if (overflow || newEchId === 0) {
      return {
        overflow: true,
        note: 'No higher echelon available in this category.',
      }
    }

    const newCat = categoryName(catId)
    const newEch = echelonName(newEchId)
    if (!newCat || !newEch) {
      return {
        overflow: true,
        note: 'No higher echelon available in this category.',
      }
    }

    return {
      overflow: false,
      proCat: formatProposedCat(newCat, newEch),
      note: `Echelon advanced by ${steps} step(s).`,
    }
  }

  if (isUpgradingAward(awardName)) {
    const current = scale2.find(
      (row) => row.catid === catId && row.echid === echId,
    )
    const currentBSAL = current?.bsal ?? 0
    if (currentBSAL === 0) {
      return {
        overflow: true,
        note: 'Could not retrieve current BSAL.',
      }
    }

    const newCatId = catId + 1
    const match = scale2
      .filter((row) => row.catid === newCatId && row.bsal >= currentBSAL)
      .sort((a, b) => a.bsal - b.bsal)[0]

    if (!match) {
      return {
        overflow: true,
        note: 'No matching BSAL found in upgraded category.',
      }
    }

    const newCat = categoryName(newCatId)
    const newEch = echelonName(match.echid)
    if (!newCat || !newEch) {
      return {
        overflow: true,
        note: 'No matching BSAL found in upgraded category.',
      }
    }

    return {
      overflow: false,
      proCat: formatProposedCat(newCat, newEch),
      note: `Upgraded to category ${newCat} with BSAL = ${currentBSAL}`,
    }
  }

  return {
    overflow: false,
    proCat: '',
    note: 'Award does not change echelon.',
  }
}
