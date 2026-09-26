import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatProposedCat,
  nextEchelonId,
  parseCatEchCode,
} from './category-code.js'
import {
  incrementStepsForAward,
  requiresProposedCategoryCalculation,
} from './appraisal-rules.js'

describe('parseCatEchCode', () => {
  it('parses category and echelon from combined code', () => {
    assert.deepEqual(parseCatEchCode('3G10'), { catNum: 3, echCode: 'G10' })
    assert.deepEqual(parseCatEchCode('03G10'), { catNum: 3, echCode: 'G10' })
    assert.deepEqual(parseCatEchCode('12F'), { catNum: 12, echCode: 'F' })
  })

  it('returns empty echCode when only digits provided', () => {
    assert.deepEqual(parseCatEchCode('3'), { catNum: 3, echCode: '' })
  })
})

describe('nextEchelonId', () => {
  const echelons = [{ echid: 10 }, { echid: 20 }, { echid: 30 }, { echid: 40 }]

  it('advances one echelon step by echid order', () => {
    assert.deepEqual(nextEchelonId(echelons, 10, 1), { echid: 20, overflow: false })
  })

  it('advances multiple steps', () => {
    assert.deepEqual(nextEchelonId(echelons, 10, 3), { echid: 40, overflow: false })
  })

  it('overflows when not enough higher echelons', () => {
    assert.deepEqual(nextEchelonId(echelons, 30, 3), { echid: 0, overflow: true })
    assert.deepEqual(nextEchelonId(echelons, 40, 1), { echid: 0, overflow: true })
  })
})

describe('formatProposedCat', () => {
  it('concatenates category number and echelon code', () => {
    assert.equal(formatProposedCat(3, 'G40'), '3G40')
  })
})

describe('requiresProposedCategoryCalculation', () => {
  it('returns true for increments and upgrading', () => {
    assert.equal(requiresProposedCategoryCalculation('Single Increment'), true)
    assert.equal(requiresProposedCategoryCalculation('Upgrading'), true)
  })

  it('returns false for other awards', () => {
    assert.equal(requiresProposedCategoryCalculation('Good Report'), false)
    assert.equal(requiresProposedCategoryCalculation('Not Due'), false)
  })
})

describe('incrementStepsForAward', () => {
  it('maps increment award names to step counts', () => {
    assert.equal(incrementStepsForAward('Single Increment'), 1)
    assert.equal(incrementStepsForAward('Double Increment'), 2)
    assert.equal(incrementStepsForAward('Triple Increment'), 3)
    assert.equal(incrementStepsForAward('Upgrading'), null)
  })
})
