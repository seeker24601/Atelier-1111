import test from 'node:test'
import assert from 'node:assert/strict'
import { parseModelId, qualify, isQualified, openrouterModel } from './modelid.js'
import { findSuperseded } from './supersede.js'

test('ids split on the first colon after a known provider only', () => {
  assert.deepEqual(parseModelId('openrouter:google/gemini-2.0-flash-exp:free'), { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' })
  assert.deepEqual(parseModelId('openai:gpt-image-2'), { provider: 'openai', model: 'gpt-image-2' })
  assert.deepEqual(parseModelId('google/gemini-3-pro-image'), { provider: 'openrouter', model: 'google/gemini-3-pro-image' }, 'bare ids are pre-0.2 OpenRouter ids')
  assert.deepEqual(parseModelId('fal:fal-ai/flux'), { provider: 'openrouter', model: 'fal:fal-ai/flux' }, 'unknown prefixes are not providers')
  assert.equal(isQualified('openai/gpt-image-2'), false)
})

test('qualifying is idempotent and OpenRouter calls get the bare id', () => {
  assert.equal(qualify('google/x:free'), 'openrouter:google/x:free')
  assert.equal(qualify('openrouter:google/x'), 'openrouter:google/x')
  assert.equal(qualify('openai:gpt-image-2'), 'openai:gpt-image-2')
  assert.equal(openrouterModel('openrouter:google/x:free'), 'google/x:free')
  assert.equal(openrouterModel('google/x'), 'google/x')
  assert.throws(() => openrouterModel('openai:gpt-image-2'), /not an OpenRouter model/)
})

test('supersession works on qualified ids and never crosses providers', () => {
  const retired = findSuperseded(
    [
      'openrouter:recraft/recraft-v4-vector',
      'openrouter:recraft/recraft-v4.1-vector',
      'openrouter:google/gemini-3-pro-image-preview',
      'openrouter:google/gemini-3-pro-image',
      'openai:gpt-image-1',
      'openai:gpt-image-2',
      'openrouter:openai/gpt-image-3',
    ].map((id) => ({ id }))
  )
  assert.equal(retired.get('openrouter:recraft/recraft-v4-vector'), 'openrouter:recraft/recraft-v4.1-vector')
  assert.equal(retired.get('openrouter:google/gemini-3-pro-image-preview'), 'openrouter:google/gemini-3-pro-image')
  assert.equal(retired.get('openai:gpt-image-1'), 'openai:gpt-image-2', 'not openrouter:openai/gpt-image-3')
  assert.equal(retired.has('openai:gpt-image-2'), false)
})
