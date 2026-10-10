import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'atelier-keys-'))
process.env.ATELIER_DATA_DIR = dir
for (const name of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY']) delete process.env[name]
const keys = await import('./keys.js')
const { db } = await import('./db/index.js')
const express = (await import('express')).default
const { api } = await import('./routes/index.js')
const FILE = join(dir, 'settings.json')
const settingsFile = () => JSON.parse(readFileSync(FILE, 'utf8'))
test.after(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

// Provider calls are faked: OpenAI and Google list one image model each,
// OpenRouter's key endpoint answers like a real key.
const realFetch = globalThis.fetch
globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (url.includes('api.openai.com')) return json({ data: [{ id: 'gpt-4o' }, { id: 'gpt-image-1' }] })
  if (url.includes('generativelanguage.googleapis.com')) return json({ models: [{ name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] }] })
  if (url.includes('openrouter.ai/api/v1/key')) return json({ data: { label: 'test', limit: null, usage: 0 } })
  return json({ error: 'unexpected' }, 404)
}
test.after(() => { globalThis.fetch = realFetch })

const OR_KEY = 'sk-or-v1-1111aaaa2222bbbb3333cccc4444dddd'
const OA_KEY = 'sk-proj-5555eeee6666ffff7777gggg8888hhhh'
const GG_KEY = 'AIzaSy9999iiii0000jjjj1111kkkk2222llll'

test('keys are detected by prefix; anything else asks for a provider', () => {
  assert.equal(keys.detectProvider(OR_KEY), 'openrouter')
  assert.equal(keys.detectProvider(OA_KEY), 'openai')
  assert.equal(keys.detectProvider('sk-admin-abc'), 'openai')
  assert.equal(keys.detectProvider(GG_KEY), 'google')
  assert.equal(keys.detectProvider('r8_replicate_token'), null)
})

test('an OpenAI admin key is detected as OpenAI but fails verification without a request', async () => {
  const result = await keys.saveKey('sk-admin-0000zzzz1111yyyy')
  assert.equal(result.provider, 'openai')
  assert.equal(result.verified, false)
  assert.match(result.detail, /admin key/)
  assert.equal(keys.describe().active, 'openai', 'stored, and the only key, so it is the fallback active provider')
  keys.deleteKey('openai')
  assert.equal(keys.describe().configured, false)
})

test('a v0.1.0 settings file keeps its OpenRouter key, and saving writes both fields', async () => {
  writeFileSync(FILE, JSON.stringify({ openrouterApiKey: OR_KEY, hiddenModels: ['x/y'] }))
  const status = keys.describe()
  assert.equal(status.active, 'openrouter')
  assert.deepEqual(status.providers.find((p) => p.id === 'openrouter'), { id: 'openrouter', label: 'OpenRouter', configured: true, source: 'stored', hint: '••••dddd' })
  await keys.saveKey(OR_KEY)
  assert.equal(settingsFile().openrouterApiKey, OR_KEY, 'v0.1.0 still finds its key')
  assert.equal(settingsFile().keys.openrouter, OR_KEY)
})

test('a verified key becomes active; removing the active key falls back to one that remains', async () => {
  const saved = await keys.saveKey(OA_KEY)
  assert.deepEqual([saved.provider, saved.verified], ['openai', true])
  assert.match(saved.detail, /gpt-image-1/)
  assert.equal(keys.describe().active, 'openai')
  keys.deleteKey('openai')
  assert.equal(keys.describe().active, 'openrouter')
})

test('the Gemini env var counts as a Google key', () => {
  process.env.GEMINI_API_KEY = GG_KEY
  try {
    assert.equal(keys.describe().providers.find((p) => p.id === 'google').source, 'env')
  } finally {
    delete process.env.GEMINI_API_KEY
  }
})

test('no response carries a key or more than its last four characters', async (t) => {
  await keys.saveKey(OR_KEY)
  await keys.saveKey(OA_KEY)
  await keys.saveKey(GG_KEY)
  const app = express()
  app.use(express.json())
  app.use('/api', api)
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const call = (path, init) => realFetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...init }).then((r) => r.text())

  const bodies = [
    await call('/health'),
    await call('/settings'),
    await call('/settings/account'),
    await call('/settings/key', { method: 'PUT', body: JSON.stringify({ key: OA_KEY }) }),
    await call('/settings/key', { method: 'PUT', body: JSON.stringify({ key: 'unknown-key-format-1234' }) }),
    await call('/settings/key/google', { method: 'DELETE' }),
  ]
  const windows = (key) => Array.from({ length: key.length - 4 }, (_, i) => key.slice(i, i + 5))
  for (const key of [OR_KEY, OA_KEY, GG_KEY, 'unknown-key-format-1234']) {
    for (const body of bodies) {
      const leaked = windows(key).find((w) => body.includes(w))
      assert.equal(leaked, undefined, `a response carried "${leaked}"`)
    }
  }
  assert.match(bodies[4], /Choose one/)
  assert.ok(!JSON.stringify(settingsFile()).includes('unknown-key-format'), 'an unrecognised key is not stored')
})
