import test from 'node:test'
import assert from 'node:assert/strict'
import { readVideoMeta } from './videometa.js'

const box = (type, payload) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + payload.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, payload])
}

/** tkhd v0: width and height are 16.16 fixed-point after the 36-byte matrix. */
function tkhd(width, height) {
  const p = Buffer.alloc(84)
  p.writeUInt32BE(width * 65536, 76)
  p.writeUInt32BE(height * 65536, 80)
  return box('tkhd', p)
}

/** mvhd v0: duration is in units of the timescale that precedes it. */
function mvhd(seconds, timescale = 1000) {
  const p = Buffer.alloc(100)
  p.writeUInt32BE(timescale, 12)
  p.writeUInt32BE(seconds * timescale, 16)
  return box('mvhd', p)
}

const mp4 = (...moovChildren) =>
  Buffer.concat([
    box('ftyp', Buffer.from('isom')),
    // Real files from Veo put a multi-megabyte mdat *before* moov, so the
    // walker has to cross it rather than stop at the first big box.
    box('mdat', Buffer.alloc(64)),
    box('moov', Buffer.concat(moovChildren)),
  ])

/** trak > mdia > hdlr, whose handler_type says what kind of track this is. */
function mdia(handler) {
  const p = Buffer.alloc(24)
  p.write(handler, 8, 'latin1')
  return box('mdia', box('hdlr', p))
}

test('reads dimensions and duration from a real box layout', () => {
  const meta = readVideoMeta(mp4(mvhd(8), box('trak', tkhd(1280, 720))))
  assert.deepEqual(meta, { width: 1280, height: 720, format: 'mp4', seconds: 8, audio: false })
})

test('a sound track is what makes generate_audio checkable', () => {
  const silent = mp4(mvhd(8), box('trak', Buffer.concat([tkhd(1280, 720), mdia('vide')])))
  assert.equal(readVideoMeta(silent).audio, false)

  const withSound = mp4(
    mvhd(8),
    box('trak', Buffer.concat([tkhd(1280, 720), mdia('vide')])),
    box('trak', Buffer.concat([tkhd(0, 0), mdia('soun')]))
  )
  assert.equal(readVideoMeta(withSound).audio, true)
})

test('skips the audio track, which reports no size', () => {
  const meta = readVideoMeta(
    mp4(mvhd(5), box('trak', tkhd(0, 0)), box('trak', tkhd(1920, 1080)))
  )
  assert.equal(meta.width, 1920)
  assert.equal(meta.height, 1080)
})

test('a fractional duration is kept', () => {
  assert.equal(readVideoMeta(mp4(mvhd(4.5), box('trak', tkhd(720, 1280)))).seconds, 4.5)
})

test('anything that is not an mp4 reads as nothing', () => {
  assert.equal(readVideoMeta(Buffer.from('not a video at all')), null)
  assert.equal(readVideoMeta(Buffer.alloc(0)), null)
  assert.equal(readVideoMeta('a string'), null)
  // An mp4 with no track has no measurable geometry, so it must not guess.
  assert.equal(readVideoMeta(mp4(mvhd(3))), null)
})
