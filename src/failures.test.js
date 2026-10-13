import test from 'node:test'
import assert from 'node:assert/strict'
import { describeFailure } from './failures.js'

// Both messages are real failures from the local history.
test('a model that refuses to run without a reference asks for one', () => {
  const f = describeFailure(
    'No provider for recraft/recraft-v4-styles supports the requested parameter(s): aspect_ratio "1:1". Provider rejections: Recraft: input_references: must have between 1 and 10 items'
  )
  assert.equal(f.title, 'Needs a reference image')
  assert.equal(f.fix, 'ref')
})

test('a quota error says so and carries the provider link', () => {
  const f = describeFailure(
    'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.'
  )
  assert.equal(f.title, 'Quota used up')
  assert.equal(f.fix, 'retry')
  assert.equal(f.link, 'https://ai.google.dev/gemini-api/docs/rate-limits')
})

test('a refused key sends you to Settings', () => {
  assert.equal(describeFailure('401 Unauthorized').fix, 'settings')
})

test('anything else is a plain failure you can retry', () => {
  const f = describeFailure('something odd happened')
  assert.equal(f.title, 'Failed')
  assert.equal(f.fix, 'retry')
  assert.equal(f.link, null)
})
