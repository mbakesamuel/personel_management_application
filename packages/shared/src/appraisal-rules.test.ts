import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AwardOption } from './types.js'
import {
  computeServiceYears,
  resolveAwardEligibilityScenario,
  resolveDatePrefill,
  resolveEligibleAwardIds,
} from './appraisal-rules.js'

const awards: AwardOption[] = [
  { id: 1, award: 'Not Due' },
  { id: 2, award: 'Warning' },
  { id: 3, award: 'Good Report' },
  { id: 5, award: 'Single Increment' },
  { id: 6, award: 'Double Increment' },
  { id: 7, award: 'Triple Increment' },
  { id: 8, award: 'Upgrading' },
]

describe('computeServiceYears', () => {
  it('counts whole years to 1 January of appraisal year', () => {
    assert.equal(computeServiceYears(new Date(2020, 5, 15), 2026), 5)
    assert.equal(computeServiceYears(new Date(2020, 0, 1), 2026), 6)
    assert.equal(computeServiceYears(new Date(2020, 0, 2), 2026), 5)
  })

  it('returns null when date engaged is missing', () => {
    assert.equal(computeServiceYears(null, 2026), null)
  })
})

describe('resolveAwardEligibilityScenario', () => {
  it('uses short_service when under minimum years', () => {
    assert.equal(
      resolveAwardEligibilityScenario({
        serviceYears: 5,
        priorYearAppraisal: null,
        currentYearAppraisal: null,
      }),
      'short_service',
    )
  })

  it('prefers prior year over current year', () => {
    assert.equal(
      resolveAwardEligibilityScenario({
        serviceYears: 10,
        priorYearAppraisal: {
          dateLmerit: '2024-01-01',
          dateLstat: null,
          dateLpro: null,
          awardName: 'Single Increment',
        },
        currentYearAppraisal: {
          dateLmerit: null,
          dateLstat: null,
          dateLpro: null,
          awardName: 'Warning',
        },
      }),
      'prior_increment',
    )
  })

  it('falls back to current year when prior is missing', () => {
    assert.equal(
      resolveAwardEligibilityScenario({
        serviceYears: 10,
        priorYearAppraisal: null,
        currentYearAppraisal: {
          dateLmerit: null,
          dateLstat: null,
          dateLpro: null,
          awardName: 'Warning',
        },
      }),
      'current_other',
    )
  })
})

describe('resolveEligibleAwardIds', () => {
  it('allows only Not Due for short service', () => {
    assert.deepEqual(resolveEligibleAwardIds(awards, 'short_service'), [1])
  })

  it('excludes Not Due and increments after prior increment', () => {
    assert.deepEqual(resolveEligibleAwardIds(awards, 'prior_increment'), [
      2, 3, 8,
    ])
  })

  it('excludes only Not Due after prior non-increment award', () => {
    assert.deepEqual(resolveEligibleAwardIds(awards, 'prior_other'), [
      2, 3, 5, 6, 7, 8,
    ])
  })

  it('excludes only increments when current year had increment and no prior', () => {
    assert.deepEqual(resolveEligibleAwardIds(awards, 'current_increment'), [
      1, 2, 3, 8,
    ])
  })

  it('excludes Not Due when no appraisal history', () => {
    assert.deepEqual(resolveEligibleAwardIds(awards, 'no_history'), [
      2, 3, 5, 6, 7, 8,
    ])
  })
})

describe('resolveDatePrefill', () => {
  it('clears dates for short service', () => {
    assert.deepEqual(
      resolveDatePrefill({
        scenario: 'short_service',
        appyear: 2026,
        source: {
          dateLmerit: '2024-01-01',
          dateLstat: '2023-01-01',
          dateLpro: '2022-01-01',
          awardName: 'Good Report',
        },
      }),
      { dateLmerit: null, dateLstat: null, dateLpro: null },
    )
  })

  it('sets merit to 1 January after prior increment', () => {
    assert.deepEqual(
      resolveDatePrefill({
        scenario: 'prior_increment',
        appyear: 2026,
        source: {
          dateLmerit: '2024-06-01',
          dateLstat: '2023-01-01',
          dateLpro: '2022-01-01',
          awardName: 'Single Increment',
        },
      }),
      {
        dateLmerit: '2026-01-01',
        dateLstat: '2023-01-01',
        dateLpro: '2022-01-01',
      },
    )
  })

  it('copies prior dates for prior non-increment award', () => {
    assert.deepEqual(
      resolveDatePrefill({
        scenario: 'prior_other',
        appyear: 2026,
        source: {
          dateLmerit: '2024-06-01',
          dateLstat: '2023-01-01',
          dateLpro: '2022-01-01',
          awardName: 'Good Report',
        },
      }),
      {
        dateLmerit: '2024-06-01',
        dateLstat: '2023-01-01',
        dateLpro: '2022-01-01',
      },
    )
  })
})
