import test from 'node:test'
import assert from 'node:assert/strict'
import { offerableOptions, parseAccepted } from './ratios.js'

const ASPECT = { key: 'aspect_ratio', options: ['9:16', '2:3', '3:4', '1:1', '4:3', '3:2', '16:9'] }
const none = () => null
const verdicts = (map) => (param, value) => (map[value] ? { verdict: map[value] } : null)

test('a refused or overridden ratio is not offered', () => {
  const shown = offerableOptions(ASPECT, verdicts({ '2:3': 'rejected', '3:4': 'ignored' }), none)
  assert.deepEqual(shown, ['9:16', '1:1', '4:3', '3:2', '16:9'])
})

test("the provider's own list removes everything outside it", () => {
  const accepted = () => '1:1, 4:3, 3:4, 16:9, 9:16, auto'
  assert.deepEqual(offerableOptions(ASPECT, none, accepted), ['9:16', '3:4', '1:1', '4:3', '16:9'])
})

test('a working ratio survives both tests', () => {
  const shown = offerableOptions(ASPECT, verdicts({ '1:1': 'ok' }), none)
  assert.ok(shown.includes('1:1'))
})

test('an untested ratio is still offered — unknown is not unsupported', () => {
  assert.deepEqual(offerableOptions(ASPECT, none, none), ASPECT.options)
})

test('nothing left means the evidence is wrong, so show everything', () => {
  const all = Object.fromEntries(ASPECT.options.map((o) => [o, 'rejected']))
  assert.deepEqual(offerableOptions(ASPECT, verdicts(all), none), ASPECT.options)
})

test('only aspect is filtered; formats and resolutions keep their options', () => {
  const fmt = { key: 'output_format', options: ['png', 'jpeg'] }
  assert.deepEqual(offerableOptions(fmt, verdicts({ png: 'rejected' }), none), ['png', 'jpeg'])
})

test('non-ratio words in a provider list are ignored', () => {
  assert.deepEqual([...parseAccepted('1:1, 4:3, auto')], ['1:1', '4:3'])
  assert.equal(parseAccepted('jpeg'), null, 'a format list must not filter ratios')
  assert.equal(parseAccepted(null), null)
})
