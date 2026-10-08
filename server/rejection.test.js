import test from 'node:test'
import assert from 'node:assert/strict'
import { paramsBlamedBy, acceptedValuesFor, looksLikeParamRejection } from './rejection.js'

/**
 * Both real failures of this parser are pinned here. A wrong blame silently
 * disables a working control; a missed one leaves a dead control on offer.
 */

const KREA =
  'Provider returned error: requested parameter(s): resolution "2K", aspect_ratio "1:1", ' +
  'output_format "png". Provider rejections: Krea: resolution: not supported. Accepted: 1K'

const SEEDREAM =
  'bytedance-seed/seedream-4.5 requires at least 3,686,400 output pixels; size "1024x576" is ' +
  '589,824. Use a larger resolution such as "2K", or omit resolution to use the default.'

const SENT = { resolution: '1K', aspect_ratio: '1:1', output_format: 'png' }

test('blames only the parameter named after "Provider rejections:"', () => {
  // The first half lists everything sent; reading it marked working values dead.
  assert.deepEqual(paramsBlamedBy(KREA, SENT), ['resolution'])
})

test('reads the accepted values a provider offers', () => {
  assert.equal(acceptedValuesFor(KREA, 'resolution'), '1K')
  assert.equal(acceptedValuesFor(SEEDREAM, 'resolution'), '2K')
})

test('recognises a requirement as a rejection, not just refusal wording', () => {
  // Seedream never says "unsupported" — it states a minimum. This was missed,
  // so five identical 1K failures produced no verdict at all.
  assert.ok(looksLikeParamRejection(SEEDREAM))
  assert.deepEqual(paramsBlamedBy(SEEDREAM, SENT), ['resolution'])
})

test('leaves unrelated failures alone', () => {
  const content = 'The input content is suspected to include real human faces.'
  assert.equal(looksLikeParamRejection(content), false)
  assert.deepEqual(paramsBlamedBy(content, SENT), [])
})

test('an unnamed parameter is never blamed', () => {
  assert.deepEqual(paramsBlamedBy(KREA, { aspect_ratio: '1:1' }), [])
})
