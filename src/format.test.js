import test from 'node:test'
import assert from 'node:assert/strict'
import { shortModel, vendorOf } from './format.js'

test('direct provider ids show the model and vendor, with no colon left for filenames', () => {
  assert.equal(shortModel('openai:gpt-image-1'), 'GPT-IMAGE-1')
  assert.equal(vendorOf('openai:gpt-image-1'), 'OPENAI')
  assert.equal(shortModel('fal:fal-ai/flux/dev'), 'DEV')
  assert.equal(vendorOf('fal:fal-ai/flux/dev'), 'FAL')
})

test('OpenRouter ids are unchanged, including :free suffixes', () => {
  assert.equal(shortModel('black-forest-labs/flux.2-pro'), 'FLUX.2-PRO')
  assert.equal(vendorOf('black-forest-labs/flux.2-pro'), 'BLACK-FOREST-LABS')
  assert.equal(shortModel('google/gemini-2.0-flash-exp:free'), 'GEMINI-2.0-FLASH-EXP:FREE')
  assert.equal(shortModel(''), '——')
})
