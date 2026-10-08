import test from 'node:test'
import assert from 'node:assert/strict'
import { assessVideo } from './videoassess.js'

// The clip that came back from Veo 3.1 Fast: 1280×720, 8s, with audio.
const VEO = { width: 1280, height: 720, format: 'mp4', seconds: 8, audio: true }
const only = (params, meta = VEO) => assessVideo(params, meta)[0]

test('720p is judged on the short side, not the long one', () => {
  assert.equal(only({ resolution: '720p' }).verdict, 'ok')
  // 1280 is the long side; reading it as the target would call this 1080p.
  assert.equal(only({ resolution: '1080p' }).verdict, 'ignored')
})

test('a portrait clip at the same resolution still passes', () => {
  const portrait = { ...VEO, width: 720, height: 1280 }
  assert.equal(only({ resolution: '720p' }, portrait).verdict, 'ok')
})

test('duration allows the rounding providers actually do', () => {
  assert.equal(only({ duration: 8 }).verdict, 'ok')
  assert.equal(only({ duration: 7 }).verdict, 'ok', 'a second either way is rounding')
  assert.equal(only({ duration: 4 }).verdict, 'ignored', 'double the length is a substitution')
})

test('audio is checkable because a silent file has no sound track', () => {
  assert.equal(only({ generate_audio: true }).verdict, 'ok')
  assert.equal(only({ generate_audio: false }).verdict, 'ignored')
  assert.equal(only({ generate_audio: false }, { ...VEO, audio: false }).verdict, 'ok')
})

test('aspect ratio is measured from the pixels', () => {
  assert.equal(only({ aspect_ratio: '16:9' }).verdict, 'ok')
  assert.equal(only({ aspect_ratio: '9:16' }).verdict, 'ignored')
})

test('nothing is claimed without a measurable file', () => {
  assert.deepEqual(assessVideo({ duration: 8, resolution: '720p' }, null), [])
})

test('a string "false" is not a request for audio', () => {
  // Boolean('false') is true; that inverted every no-audio verdict recorded
  // before this was parsed properly.
  const silent = { ...VEO, audio: false }
  assert.equal(only({ generate_audio: 'false' }, silent).verdict, 'ok')
  assert.equal(only({ generate_audio: 'false' }, VEO).verdict, 'ignored')
  assert.match(only({ generate_audio: 'false' }, VEO).evidence, /Asked no audio/)
  assert.equal(only({ generate_audio: 'true' }, VEO).verdict, 'ok')
})
