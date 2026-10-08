import test from 'node:test'
import assert from 'node:assert/strict'
import { setPreview, preview, dropPreview, pending } from './outbox.js'
import { extFor, slimRefs } from './media.js'

const png = Buffer.from('89504e470d0a1a0a', 'hex')

test('a preview is replaced by each newer frame, then dropped', () => {
  setPreview('job-1', { buf: Buffer.alloc(1), mediaType: 'image/png' })
  setPreview('job-1', { buf: png, mediaType: 'image/png' })
  assert.equal(preview('job-1').buf, png, 'only the newest frame is held')
  dropPreview('job-1')
  assert.equal(preview('job-1'), null)
})

test('a job with no frames is simply absent', () => {
  assert.equal(preview('never-existed'), null)
})

test('nothing is left holding memory once previews are dropped', () => {
  assert.equal(pending(), 0)
})

test('files are named by what they contain, not by guesswork', () => {
  assert.equal(extFor('image/png'), 'png')
  assert.equal(extFor('image/jpeg'), 'jpg')
  assert.equal(extFor('image/svg+xml'), 'svg')
  assert.equal(extFor('video/mp4; codecs=avc1'), 'mp4')
  assert.equal(extFor('application/x-unknown'), 'bin', 'an unknown type is never served as something it is not')
})

test('the gallery keeps a reference description, never its bytes', () => {
  const refs = [
    { kind: 'data', url: 'data:image/png;base64,AAAA', name: 'a.png' },
    { kind: 'image', id: 'abc' },
  ]
  assert.deepEqual(slimRefs(refs), [{ kind: 'data', name: 'a.png' }, { kind: 'image', id: 'abc' }])
  assert.deepEqual(slimRefs(undefined), [])
})
