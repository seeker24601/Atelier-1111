import test from 'node:test'
import assert from 'node:assert/strict'
import { PARAM_FIELDS } from './params.js'
import { optionsFor, offersBackground, unpublishedFlag, unpublishedChoices, publishedReferenceLimit } from './specs.js'

const field = (key) => PARAM_FIELDS.find((f) => f.key === key)
const source = { provider: 'fal', endpoint: 'fal-ai/nano-banana-pro', url: 'https://fal.ai/models/fal-ai/nano-banana-pro/api' }
const nanoBananaPro = {
  aspect_ratios: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'],
  any_ratio: false,
  resolutions: ['1K', '2K', '4K'],
  output_formats: ['jpeg', 'png', 'webp'],
  backgrounds: null,
  references: { accepted: true, max: null },
  source,
}
const gptImage2 = {
  aspect_ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  any_ratio: true,
  resolutions: null,
  output_formats: ['jpeg', 'png', 'webp'],
  backgrounds: ['auto', 'transparent', 'opaque'],
  references: { accepted: true, max: 16 },
  source: { ...source, endpoint: 'openai/gpt-image-2' },
}

test('a published ratio list replaces the static row, tallest to widest, with ratios it never had', () => {
  assert.deepEqual(optionsFor(field('aspect_ratio'), nanoBananaPro), ['9:16', '2:3', '3:4', '4:5', '1:1', '5:4', '4:3', '3:2', '16:9', '21:9'])
})

test('a model taking any ratio keeps the static row', () => {
  assert.deepEqual(optionsFor(field('aspect_ratio'), gptImage2), field('aspect_ratio').options)
})

test('published resolutions and formats replace the static ones; no spec changes nothing', () => {
  assert.deepEqual(optionsFor(field('resolution'), nanoBananaPro), ['1K', '2K', '4K'])
  assert.deepEqual(optionsFor(field('resolution'), { ...nanoBananaPro, resolutions: ['512sq', '2K', '1K'] }), ['1K', '2K'], 'only the K scale')
  assert.deepEqual(optionsFor(field('output_format'), nanoBananaPro), ['png', 'jpeg', 'webp'], 'no svg for a raster model')
  for (const f of PARAM_FIELDS) assert.deepEqual(optionsFor(f, null), f.options)
})

test('background is offered only where a transparent one is published', () => {
  assert.equal(offersBackground(gptImage2), true)
  assert.deepEqual(optionsFor(field('background'), gptImage2), ['transparent', 'opaque'], 'auto is what the switch off means')
  assert.equal(offersBackground(nanoBananaPro), false)
  assert.equal(offersBackground(null), false)
})

test('a setting missing from the schema is flagged, not removed', () => {
  const flag = unpublishedFlag(field('resolution'), gptImage2)
  assert.match(flag.text, /not in schema/)
  assert.match(flag.title, /openai\/gpt-image-2/)
  assert.equal(unpublishedFlag(field('resolution'), nanoBananaPro), null)
  assert.equal(unpublishedFlag(field('resolution'), null), null)
  assert.deepEqual(optionsFor(field('resolution'), gptImage2), field('resolution').options, 'still offered')
})

test('current choices the model does not publish are withheld, as param::value', () => {
  const fields = PARAM_FIELDS
  const params = { aspect_ratio: '1:1', resolution: '4K', output_format: 'svg', background: 'transparent' }
  assert.deepEqual([...unpublishedChoices(params, nanoBananaPro, fields)].sort(), ['background::transparent', 'output_format::svg'])
  assert.deepEqual([...unpublishedChoices({ ...params, resolution: '8K' }, nanoBananaPro, fields)].sort(), ['background::transparent', 'output_format::svg', 'resolution::8K'])
  // No published resolution: the usual 1K/2K row applies, and 4K is not on it.
  assert.deepEqual([...unpublishedChoices(params, gptImage2, fields)].sort(), ['output_format::svg', 'resolution::4K'])
  assert.equal(unpublishedChoices(params, null, fields).size, 0)
})

test('the published reference limit: a number, or null when none is stated or support is unknown', () => {
  assert.equal(publishedReferenceLimit(gptImage2), 16)
  assert.equal(publishedReferenceLimit(nanoBananaPro), null)
  assert.equal(publishedReferenceLimit({ references: { accepted: null, max: null } }), null)
  assert.equal(publishedReferenceLimit(null), null)
})
