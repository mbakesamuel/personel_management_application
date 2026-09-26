export type ParsedCatEchCode = {
  catNum: number
  echCode: string
}

export type EchelonRow = {
  echid: number
}

/**
 * Port of Access GetCatAndEchIDs string parsing (steps 1–2).
 * Numeric prefix until first non-digit; remainder is echelon code.
 */
export function parseCatEchCode(catEchCode: string): ParsedCatEchCode {
  const trimmed = catEchCode.trim()
  let i = 0
  while (i < trimmed.length) {
    const ch = trimmed[i]
    if (ch < '0' || ch > '9') break
    i += 1
  }

  const catNum =
    i > 0 ? Number.parseInt(trimmed.slice(0, i), 10) : Number.parseInt(trimmed, 10) || 0
  const echCode = i < trimmed.length ? trimmed.slice(i) : ''

  return {
    catNum: Number.isNaN(catNum) ? 0 : catNum,
    echCode,
  }
}

/**
 * Port of Access NextEchelonId — echelons ordered by echid ASC.
 */
export function nextEchelonId(
  echelons: EchelonRow[],
  currentEchId: number,
  steps: number,
): { echid: number; overflow: boolean } {
  const higher = echelons
    .filter((row) => row.echid > currentEchId)
    .sort((a, b) => a.echid - b.echid)

  if (higher.length === 0 || steps < 1) {
    return { echid: 0, overflow: true }
  }

  const targetIndex = steps - 1
  if (targetIndex >= higher.length) {
    return { echid: 0, overflow: true }
  }

  return { echid: higher[targetIndex].echid, overflow: false }
}

/** Access formats proCat as NewCat & NewEch, e.g. "3" + "G40" → "3G40". */
export function formatProposedCat(
  cat: number | string | null | undefined,
  ech: string | null | undefined,
): string {
  const catPart = cat == null ? '' : String(cat)
  const echPart = ech ?? ''
  return `${catPart}${echPart}`
}
