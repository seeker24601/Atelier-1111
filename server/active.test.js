import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'atelier-active-'))
process.env.ATELIER_DATA_DIR = dir
for (const name of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY']) delete process.env[name]
const { storeKey } = await import('./settings.js')
const { db } = await import('./db/index.js')
const express = (await import('express')).default
const { api } = await import('./routes/index.js')

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const realFetch = globalThis.fetch
globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.includes('openrouter.ai/api/v1/models?output_modalities=image')) return json({ data: [{ id: 'google/gemini-3-pro-image', name: 'G' }] })
  if (url.includes('openrouter.ai/api/v1/models?output_modalities=video')) return json({ data: [{ id: 'google/veo-3', name: 'V' }] })
  if (url.endsWith('api.openai.com/v1/models')) return json({ data: [{ id: 'gpt-image-1' }] })
  return json({ error: 'unexpected ' + url }, 404)
}

const app = express()
app.use(express.json())
app.use('/api', api)
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
const base = `http://127.0.0.1:${server.address().port}/api`
test.after(async () => {
  globalThis.fetch = realFetch
  await new Promise((resolve) => server.close(resolve))
  db.close()
  rmSync(dir, { recursive: true, force: true })
})
const get = (path) => realFetch(base + path).then((r) => r.json())
const send = (method, path, body) =>
  realFetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }))
const ids = async (kind) => (await get(`/models?kind=${kind}`)).models.map((m) => m.id)

test('with no key there is no catalogue and nothing to generate with', async () => {
  assert.deepEqual(await ids('image'), [])
  assert.deepEqual(await ids('video'), [])
  const res = await send('POST', '/generate', { models: ['openrouter:google/gemini-3-pro-image'], prompt: 'x' })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /Add a key first/)
})

test('listing and generation follow the active provider, switched in turn', async () => {
  storeKey('openrouter', 'sk-or-v1-test-0000')
  storeKey('openai', 'sk-proj-test-1111')

  // OpenRouter comes first when no choice has been made.
  assert.equal((await get('/settings')).active, 'openrouter')
  assert.deepEqual(await ids('image'), ['openrouter:google/gemini-3-pro-image'])
  assert.deepEqual(await ids('video'), ['openrouter:google/veo-3'])

  const switched = await send('PUT', '/settings/active', { provider: 'openai' })
  assert.equal(switched.body.active, 'openai')
  assert.deepEqual(await ids('image'), ['openai:gpt-image-1'])
  assert.deepEqual(await ids('video'), [], 'no Video tab for OpenAI')
  const refused = await send('POST', '/generate', { models: ['openrouter:google/gemini-3-pro-image'], prompt: 'x' })
  assert.equal(refused.status, 400)
  assert.match(refused.body.error, /OpenRouter is not the active provider/)

  await send('PUT', '/settings/active', { provider: 'openrouter' })
  assert.deepEqual(await ids('image'), ['openrouter:google/gemini-3-pro-image'])
})

test('a provider without a key cannot be made active', async () => {
  const res = await send('PUT', '/settings/active', { provider: 'google' })
  assert.equal(res.status, 400)
  assert.match(res.body.error, /Add a Google key first/)
})

test('a preview frame is served locked down, so an SVG frame cannot run script', async () => {
  const { setPreview, dropPreview } = await import('./outbox.js')
  setPreview('job-svg-preview', { buf: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), mediaType: 'image/svg+xml' })
  try {
    const res = await realFetch(`${base}/output/job-svg-preview/preview`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.match(res.headers.get('content-security-policy') ?? '', /\bsandbox\b/)
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/)
  } finally {
    dropPreview('job-svg-preview')
  }
})
