import assert from 'node:assert/strict'
import test from 'node:test'
import { phoneMatchesPrefixRanges } from './prefix-range.js'

const ranges = [
  { start: '650', end: '654' },
  { start: '670', end: '679' },
]

test('matches a prefix inside a range', () => {
  assert.equal(phoneMatchesPrefixRanges('650123456', ranges), true)
  assert.equal(phoneMatchesPrefixRanges('654000000', ranges), true)
  assert.equal(phoneMatchesPrefixRanges('651 00 0000', ranges), true)
  assert.equal(phoneMatchesPrefixRanges('6701', ranges), true)
})

test('rejects a prefix outside every range', () => {
  assert.equal(phoneMatchesPrefixRanges('655123456', ranges), false)
  assert.equal(phoneMatchesPrefixRanges('65', ranges), false)
  assert.equal(phoneMatchesPrefixRanges('', ranges), false)
})

test('skips operators with no ranges', () => {
  assert.equal(phoneMatchesPrefixRanges('anything', []), true)
})
