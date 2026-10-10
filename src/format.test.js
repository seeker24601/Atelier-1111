import test from 'node:test'
import assert from 'node:assert/strict'
import { shortModel, vendorOf } from './format.js'

test('qualified OpenRouter ids display as before', () => {
  assert.equal(shortModel('openrouter:black-forest-labs/flux.2-pro'), 'FLUX.2-PRO')
  assert.equal(vendorOf('openrouter:black-forest-labs/flux.2-pro'), 'BLACK-FOREST-LABS')
  assert.equal(shortModel('openrouter:google/gemini-2.0-flash-exp:free'), 'GEMINI-2.0-FLASH-EXP:FREE')
  assert.equal(shortModel('google/gemini-3-pro-image'), 'GEMINI-3-PRO-IMAGE', 'bare ids still read')
})

test('other providers show the model, the provider as vendor, and no provider colon', () => {
  assert.equal(shortModel('openai:gpt-image-2'), 'GPT-IMAGE-2')
  assert.equal(vendorOf('openai:gpt-image-2'), 'OPENAI')
  assert.equal(vendorOf('google:gemini-3-pro-image'), 'GOOGLE')
  assert.equal(shortModel(''), '——')
})

test('download filenames never contain a colon from the provider prefix', () => {
  // The same expression TileActions uses for its download name.
  const filename = (model) => `${shortModel(model).toLowerCase()}-abcd1234.png`
  for (const model of ['openai:gpt-image-2', 'google:gemini-3-pro-image', 'openrouter:google/gemini-3-pro-image']) {
    assert.ok(!filename(model).includes(':'), filename(model))
  }
})
