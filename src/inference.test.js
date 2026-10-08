import test from 'node:test'
import assert from 'node:assert/strict'
import { inferredDead, transposeOf } from './inference.js'

const rejected = (param, value, evidence = '') => ({ param, value, verdict: 'rejected', evidence })

const RECRAFT = [
  rejected(
    'aspect_ratio',
    '2:3',
    'Accepted: 1:1, 4:3, 3:4, 16:9, 9:16, auto. No provider for recraft/recraft-v4.1-pro'
  ),
]

test('a ratio and its transpose are the same capability', () => {
  assert.equal(transposeOf('4:3'), '3:4')
  assert.equal(transposeOf('1:1'), '1:1')
  assert.equal(transposeOf('png'), null)
})

test('the transpose of a rejected ratio is expected to fail', () => {
  assert.match(inferredDead('aspect_ratio', '3:2', [rejected('aspect_ratio', '2:3')]), /2:3/)
})

test('a value missing from the provider list is expected to fail', () => {
  assert.match(inferredDead('aspect_ratio', '3:2', RECRAFT), /listed what it accepts/)
  assert.equal(inferredDead('aspect_ratio', '4:3', RECRAFT), null)
  assert.equal(inferredDead('aspect_ratio', '3:4', RECRAFT), null)
})

test('1:1 is never inferred dead — it is every model’s default', () => {
  // Its own transpose, so the rotation rule must not fire on it.
  assert.equal(inferredDead('aspect_ratio', '1:1', [rejected('aspect_ratio', '1:1')]), null)
  assert.equal(inferredDead('aspect_ratio', '1:1', RECRAFT), null)
})

test('the rule is scoped to ratios, not to every parameter', () => {
  // No transposing "png"; only an explicit provider list can condemn a format.
  assert.equal(inferredDead('output_format', 'webp', [rejected('output_format', 'png')]), null)
  assert.match(
    inferredDead('output_format', 'webp', [rejected('output_format', 'png', 'Accepted: jpeg')]),
    /listed what it accepts/
  )
})
