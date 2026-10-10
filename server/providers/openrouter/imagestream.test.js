import test from 'node:test'
import assert from 'node:assert/strict'
import { readImageStream } from './imagestream.js'

/** A Response-alike carrying SSE frames, split wherever the test wants. */
const streamOf = (chunks) => ({
  body: {
    getReader() {
      let i = 0
      return {
        read: async () =>
          i < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
            : { done: true },
        releaseLock() {},
      }
    },
  },
})

const frame = (obj) => `data: ${JSON.stringify(obj)}\n\n`

test('partial frames are handed over as they arrive', async () => {
  const seen = []
  const { images, partials } = await readImageStream(
    streamOf([
      frame({ type: 'image_generation.partial_image', b64_json: 'AAA', partial_image_index: 0 }),
      frame({ type: 'image_generation.partial_image', b64_json: 'BBB', partial_image_index: 1 }),
      frame({ type: 'image_generation.completed', b64_json: 'FINAL', media_type: 'image/png' }),
      'data: [DONE]\n\n',
    ]),
    (p) => seen.push(p)
  )

  assert.equal(partials, 2)
  assert.deepEqual(seen.map((p) => p.b64), ['AAA', 'BBB'])
  assert.deepEqual(seen.map((p) => p.index), [0, 1])
  assert.equal(seen[0].mediaType, 'image/png', 'defaults rather than arriving undefined')
  assert.deepEqual(images, [{ b64: 'FINAL', mediaType: 'image/png' }])
})

test('a partial without bytes is counted but never announced', async () => {
  const seen = []
  const { partials } = await readImageStream(
    streamOf([
      frame({ type: 'image_generation.partial_image', partial_image_index: 0 }),
      frame({ type: 'image_generation.completed', b64_json: 'FINAL' }),
    ]),
    (p) => seen.push(p)
  )
  assert.equal(partials, 1)
  assert.equal(seen.length, 0, 'nothing to preview means no callback')
})

test('no callback at all is not a crash', async () => {
  const { images } = await readImageStream(
    streamOf([
      frame({ type: 'image_generation.partial_image', b64_json: 'AAA' }),
      frame({ type: 'image_generation.completed', b64_json: 'FINAL' }),
    ])
  )
  assert.equal(images.length, 1)
})

test('frames split across chunk boundaries still parse', async () => {
  const seen = []
  const whole = frame({ type: 'image_generation.partial_image', b64_json: 'SPLIT' })
  await readImageStream(
    streamOf([whole.slice(0, 20), whole.slice(20), frame({ type: 'image_generation.completed', b64_json: 'F' })]),
    (p) => seen.push(p)
  )
  assert.deepEqual(seen.map((p) => p.b64), ['SPLIT'])
})

test('a mid-stream error still throws, previews notwithstanding', async () => {
  await assert.rejects(
    readImageStream(
      streamOf([
        frame({ type: 'image_generation.partial_image', b64_json: 'AAA' }),
        frame({ type: 'error', error: { message: 'Content policy' } }),
      ]),
      () => {}
    ),
    /Content policy/
  )
})
