import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeProposedCategoryFromScale } from './category-proposal.js'

const scale1 = [
  { catid: 1, cat: 3 },
  { catid: 2, cat: 4 },
]

const scale2 = [
  { echid: 10, ech: 'G10', bsal: 100, catid: 1 },
  { echid: 20, ech: 'G20', bsal: 120, catid: 1 },
  { echid: 30, ech: 'G30', bsal: 140, catid: 1 },
  { echid: 40, ech: 'G15', bsal: 120, catid: 2 },
  { echid: 50, ech: 'G25', bsal: 150, catid: 2 },
]

describe('computeProposedCategoryFromScale', () => {
  it('advances one echelon for single increment', () => {
    const result = computeProposedCategoryFromScale({
      catId: 1,
      echId: 10,
      awardName: 'Single Increment',
      scale1,
      scale2,
    })
    assert.equal(result.overflow, false)
    if (!result.overflow) {
      assert.equal(result.proCat, '3G20')
    }
  })

  it('overflows when triple increment exceeds scale', () => {
    const result = computeProposedCategoryFromScale({
      catId: 1,
      echId: 20,
      awardName: 'Triple Increment',
      scale1,
      scale2,
    })
    assert.equal(result.overflow, true)
    if (result.overflow) {
      assert.equal(result.note, 'No higher echelon available in this category.')
    }
  })

  it('upgrades to next category by BSAL match', () => {
    const result = computeProposedCategoryFromScale({
      catId: 1,
      echId: 20,
      awardName: 'Upgrading',
      scale1,
      scale2,
    })
    assert.equal(result.overflow, false)
    if (!result.overflow) {
      assert.equal(result.proCat, '4G15')
    }
  })

  it('reports missing BSAL on upgrade', () => {
    const result = computeProposedCategoryFromScale({
      catId: 1,
      echId: 99,
      awardName: 'Upgrading',
      scale1,
      scale2,
    })
    assert.equal(result.overflow, true)
    if (result.overflow) {
      assert.equal(result.note, 'Could not retrieve current BSAL.')
    }
  })
})
