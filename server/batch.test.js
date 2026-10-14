import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32 } from 'node:zlib'

const dir = mkdtempSync(join(tmpdir(), 'atelier-batch-'))
process.env.ATELIER_DATA_DIR = dir
const library = await import('./library.js')
const { IMAGE_DIR } = await import('./paths.js')
const { db } = await import('./db/index.js')
const express = (await import('express')).default
const { api } = await import('./routes/index.js')

/** Every entry in a ZIP, read back through its central directory. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(end >= 0, 'end of central directory')
  const count = buf.readUInt16LE(end + 10)
  let at = buf.readUInt32LE(end + 16)
  const files = []
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50)
    const crc = buf.readUInt32LE(at + 16)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const local = buf.readUInt32LE(at + 42)
    assert.equal(buf.readUInt32LE(local), 0x04034b50)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + size)
    assert.equal(crc32(data), crc, `${name} checksum`)
    files.push({ name, data })
    at += 46 + nameLen
  }
  return files
}

const png = (n) => Buffer.from(`fake png ${n}`)
const seed = async (id, model, n) =>
  library.adopt({ id, model, media_type: 'image/png', format: 'png', created_at: Date.now() }, png(n))

test('several plates download as one zip and delete together', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/api', api)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  t.after(() => {
    server.close()
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}/api`
  const post = (path, body) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  await seed('aaaaaaaa-1111', 'openrouter:black-forest-labs/flux-3-image', 1)
  await seed('bbbbbbbb-2222', 'openrouter:openai/gpt-image-2', 2)
  await seed('cccccccc-3333', 'openrouter:openai/gpt-image-2', 3)

  const made = await post('/images/archive', { ids: ['aaaaaaaa-1111', 'bbbbbbbb-2222', 'gone'] })
  assert.equal(made.status, 200)
  const { url, count } = await made.json()
  assert.equal(count, 2, 'an id with no plate is left out')

  const got = await fetch(`http://127.0.0.1:${server.address().port}${url}`)
  assert.equal(got.headers.get('content-type'), 'application/zip')
  assert.match(got.headers.get('content-disposition'), /^attachment; filename="atelier-[\d-]+\.zip"$/)
  const files = unzip(Buffer.from(await got.arrayBuffer()))
  assert.deepEqual(
    files.map((f) => [f.name, f.data.toString()]),
    [
      ['flux-3-image-aaaaaaaa.png', 'fake png 1'],
      ['gpt-image-2-bbbbbbbb.png', 'fake png 2'],
    ]
  )

  assert.equal((await post('/images/archive', { ids: [] })).status, 400)
  assert.equal((await fetch(`${base}/images/archive/not-a-token`)).status, 404)

  const removed = await post('/images/remove', { ids: ['aaaaaaaa-1111', 'cccccccc-3333', 'gone'] })
  assert.deepEqual(await removed.json(), { removed: 2 })
  assert.equal(existsSync(join(IMAGE_DIR, 'aaaaaaaa-1111.png')), false, 'the file goes with the row')
  const left = (await (await fetch(`${base}/images`)).json()).images.map((i) => i.id)
  assert.deepEqual(left, ['bbbbbbbb-2222'])

  assert.equal((await post('/images/remove', {})).status, 400, 'no ids never means everything')
})
