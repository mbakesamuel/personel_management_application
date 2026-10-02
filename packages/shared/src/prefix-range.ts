import type { CommunicationPrefixRange } from './types.js'

export const PHONE_OUTSIDE_PREFIX_RANGES =
  "Phone number is outside this operator's prefix ranges"

export function phoneMatchesPrefixRanges(
  phoneNumber: string,
  ranges: CommunicationPrefixRange[],
): boolean {
  if (ranges.length === 0) return true
  const digits = phoneNumber.replace(/\D/g, '')
  return ranges.some((range) => {
    const prefix = digits.slice(0, range.start.length)
    if (prefix.length !== range.start.length) return false
    return prefix >= range.start && prefix <= range.end
  })
}
