import type { AwardOption } from './types.js'
import { normalizeAwardKey } from './letters.js'

/** Minimum years of service before full appraisal rules apply (confirm with HR). */
export const MIN_SERVICE_YEARS_FOR_APPRAISAL = 6

export const NOT_DUE_AWARD_NAME = 'Not Due'

export const INCREMENT_AWARD_NAMES = [
  'Single Increment',
  'Double Increment',
  'Triple Increment',
] as const

export const UPGRADING_AWARD_NAME = 'Upgrading'

export const PROPOSED_CATEGORY_AWARD_NAMES = [
  ...INCREMENT_AWARD_NAMES,
  UPGRADING_AWARD_NAME,
] as const

export type AwardEligibilityScenario =
  | 'short_service'
  | 'prior_increment'
  | 'prior_other'
  | 'current_increment'
  | 'current_other'
  | 'no_history'

export type AppraisalDateSnapshot = {
  dateLmerit: string | null
  dateLstat: string | null
  dateLpro: string | null
  awardName: string | null
}

export function isIncrementAward(awardName: string | null | undefined): boolean {
  const key = normalizeAwardKey(awardName)
  return INCREMENT_AWARD_NAMES.some(
    (name) => normalizeAwardKey(name) === key,
  )
}

export function isUpgradingAward(awardName: string | null | undefined): boolean {
  return normalizeAwardKey(awardName) === normalizeAwardKey(UPGRADING_AWARD_NAME)
}

export function requiresProposedCategoryCalculation(
  awardName: string | null | undefined,
): boolean {
  return isIncrementAward(awardName) || isUpgradingAward(awardName)
}

export function incrementStepsForAward(
  awardName: string | null | undefined,
): 1 | 2 | 3 | null {
  const key = normalizeAwardKey(awardName)
  if (key === normalizeAwardKey('Single Increment')) return 1
  if (key === normalizeAwardKey('Double Increment')) return 2
  if (key === normalizeAwardKey('Triple Increment')) return 3
  return null
}

export function isNotDueAward(awardName: string | null | undefined): boolean {
  return normalizeAwardKey(awardName) === normalizeAwardKey(NOT_DUE_AWARD_NAME)
}

export function findAwardIdByName(
  awards: AwardOption[],
  name: string,
): number | undefined {
  const key = normalizeAwardKey(name)
  return awards.find((a) => normalizeAwardKey(a.award) === key)?.id
}

export function findAwardIdsByNames(
  awards: AwardOption[],
  names: readonly string[],
): number[] {
  const keys = new Set(names.map((n) => normalizeAwardKey(n)))
  return awards
    .filter((a) => keys.has(normalizeAwardKey(a.award)))
    .map((a) => a.id)
}

/**
 * Whole years of service as of 1 January of the appraisal year.
 */
export function computeServiceYears(
  dateEng: Date | null | undefined,
  appyear: number,
): number | null {
  if (!dateEng || Number.isNaN(dateEng.getTime())) return null

  const ref = new Date(appyear, 0, 1)
  let years = ref.getFullYear() - dateEng.getFullYear()
  const monthDiff = ref.getMonth() - dateEng.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && ref.getDate() < dateEng.getDate())
  ) {
    years -= 1
  }
  return Math.max(0, years)
}

export function formatLengthOfService(years: number | null): string | null {
  if (years == null) return null
  return String(years)
}

export function meritDateForAppYear(appyear: number): string {
  return `${appyear}-01-01`
}

export function resolveAwardEligibilityScenario(input: {
  serviceYears: number | null
  priorYearAppraisal: AppraisalDateSnapshot | null
  currentYearAppraisal: AppraisalDateSnapshot | null
}): AwardEligibilityScenario {
  const serviceYears = input.serviceYears ?? 0
  if (serviceYears < MIN_SERVICE_YEARS_FOR_APPRAISAL) {
    return 'short_service'
  }

  if (input.priorYearAppraisal) {
    return isIncrementAward(input.priorYearAppraisal.awardName)
      ? 'prior_increment'
      : 'prior_other'
  }

  if (input.currentYearAppraisal) {
    return isIncrementAward(input.currentYearAppraisal.awardName)
      ? 'current_increment'
      : 'current_other'
  }

  return 'no_history'
}

export function resolveEligibleAwardIds(
  awards: AwardOption[],
  scenario: AwardEligibilityScenario,
): number[] {
  const allIds = awards.map((a) => a.id)
  const notDueId = findAwardIdByName(awards, NOT_DUE_AWARD_NAME)
  const incrementIds = findAwardIdsByNames(awards, INCREMENT_AWARD_NAMES)

  const exclude = new Set<number>()

  switch (scenario) {
    case 'short_service':
      return notDueId != null ? [notDueId] : allIds
    case 'prior_increment':
      if (notDueId != null) exclude.add(notDueId)
      for (const id of incrementIds) exclude.add(id)
      break
    case 'prior_other':
    case 'current_other':
    case 'no_history':
      if (notDueId != null) exclude.add(notDueId)
      break
    case 'current_increment':
      for (const id of incrementIds) exclude.add(id)
      break
  }

  return allIds.filter((id) => !exclude.has(id))
}

export function resolveDatePrefill(input: {
  scenario: AwardEligibilityScenario
  appyear: number
  source: AppraisalDateSnapshot | null
}): Pick<AppraisalDateSnapshot, 'dateLmerit' | 'dateLstat' | 'dateLpro'> {
  const { scenario, appyear, source } = input

  if (scenario === 'short_service' || scenario === 'no_history') {
    return { dateLmerit: null, dateLstat: null, dateLpro: null }
  }

  if (!source) {
    return { dateLmerit: null, dateLstat: null, dateLpro: null }
  }

  if (scenario === 'prior_increment') {
    return {
      dateLmerit: meritDateForAppYear(appyear),
      dateLstat: source.dateLstat,
      dateLpro: source.dateLpro,
    }
  }

  return {
    dateLmerit: source.dateLmerit,
    dateLstat: source.dateLstat,
    dateLpro: source.dateLpro,
  }
}
