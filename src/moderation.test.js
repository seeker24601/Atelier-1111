import test from 'node:test'
import assert from 'node:assert/strict'
import { isModeration, blamesInput, moderationSubject } from './moderation.js'

// Every one of these is a real refusal from the ledger, one per provider.
const REFUSALS = [
  'Sourceful V2.5 submit returned 422: Inappropriate content detected',
  'Black Forest Labs generation failed: Request Moderated: Moderation Reasons: Sexual Content',
  'Gemini returned no image data (finish_reason: IMAGE_OTHER)',
  "Response content blocked by label 'MultiSeverity_SexualScore'.",
  'Input content violated imagegen safety policies.',
  'The input content is suspected to include real human faces.',
  'HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image \'content[1]\' may contain real person."}}',
]

// Real failures that must keep reading as failures.
const FAILURES = [
  'bytedance-seed/seedream-4.5 requires at least 3,686,400 output pixels; size "1024x576" is 589,824.',
  'Your requests to MAI-Image-2.5-Pro for maiimage25pro in westcentralus have exceeded rate limit.',
  'Connection failed after 60.0s — fetch failed ← UND_ERR_SOCKET: other side closed',
  'No provider for microsoft/mai-image-2.5 supports the requested parameter(s): aspect_ratio "4:3"',
]

test('every provider’s refusal wording is recognised', () => {
  for (const message of REFUSALS) assert.ok(isModeration(message), message)
})

test('a real failure is never mistaken for a refusal', () => {
  for (const message of FAILURES) assert.equal(isModeration(message), false, message)
})

test('a refusal about the reference is named apart from one about the prompt', () => {
  assert.ok(blamesInput('The input content is suspected to include real human faces.'))
  assert.ok(blamesInput("the input image 'content[1]' may contain real person"))
  assert.equal(moderationSubject('Request Moderated: Sexual Content'), 'prompt refused')
  assert.equal(
    moderationSubject('Input content violated imagegen safety policies.'),
    'reference refused'
  )
})

test('an empty error is not a refusal', () => {
  assert.equal(isModeration(''), false)
  assert.equal(isModeration(null), false)
})
