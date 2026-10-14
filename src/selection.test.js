import test from 'node:test'
import assert from 'node:assert/strict'
import { rangeOf, clickSelect, boxSelect, prune, plateOrder, splitKeys } from './selection.js'

const order = ['a', 'b', 'c', 'd', 'e']
const ids = (set) => [...set].sort()

test('a click flips one plate', () => {
  assert.deepEqual(ids(clickSelect(new Set(), order, 'c')), ['c'])
  assert.deepEqual(ids(clickSelect(new Set(['c']), order, 'c')), [])
})

test('Shift extends from the last click, in either direction, keeping what was held', () => {
  assert.deepEqual(ids(clickSelect(new Set(['b']), order, 'd', { range: true, anchor: 'b' })), ['b', 'c', 'd'])
  assert.deepEqual(ids(clickSelect(new Set(['e']), order, 'b', { range: true, anchor: 'd' })), ['b', 'c', 'd', 'e'])
})

test('Shift with no usable anchor selects just the plate', () => {
  assert.deepEqual(ids(clickSelect(new Set(), order, 'c', { range: true })), ['c'])
  assert.deepEqual(ids(clickSelect(new Set(), order, 'c', { range: true, anchor: 'deleted' })), ['c'])
  assert.deepEqual(rangeOf(order, 'deleted', 'c'), ['c'])
})

test('a drag box replaces the selection, or adds to it', () => {
  assert.deepEqual(ids(boxSelect(new Set(['a']), ['c', 'd'], false)), ['c', 'd'])
  assert.deepEqual(ids(boxSelect(new Set(['a']), ['c', 'd'], true)), ['a', 'c', 'd'])
})

test('plates and failed jobs share one order, newest first, under distinct keys', () => {
  const order = plateOrder(
    [{ id: 'x', created_at: 3 }, { id: 'y', created_at: 1 }],
    [{ id: 'x', created_at: 2 }]
  )
  assert.deepEqual(order.map((p) => p.key), ['img:x', 'job:x', 'img:y'])
  assert.deepEqual(splitKeys(['img:x', 'job:x', 'img:y']), { images: ['x', 'y'], jobs: ['x'] })
})

test('deleted plates leave the selection', () => {
  const held = new Set(['a', 'c'])
  assert.equal(prune(held, order), held, 'unchanged when all still exist')
  assert.deepEqual(ids(prune(held, ['a', 'b'])), ['a'])
})
