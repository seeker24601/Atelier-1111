import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Settings and the database read ATELIER_DATA_DIR when first imported.
const dir = mkdtempSync(join(tmpdir(), 'atelier-providers-'))
process.env.ATELIER_DATA_DIR = dir
const settings = await import('./settings.js')
const providers = await import('./imageproviders.js')
const jobsRepo = await import('./db/jobs.js')
const { db } = await import('./db/index.js')
const { runJob } = await import('./runjob.js')
test.after(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2sAAAAASUVORK5CYII='
const geminiImage = () =>
  new Response(
    JSON.stringify({
      candidates: [
        { content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png } }] }, finishReason: 'STOP' },
      ],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )

test('direct ids are told apart from OpenRouter ids, including :free suffixes', () => {
  assert.ok(providers.isDirectModel('fal:fal-ai/flux/dev'))
  assert.ok(providers.isDirectModel('openai:gpt-image-1'))
  assert.ok(!providers.isDirectModel('google/gemini-2.0-flash-exp:free'))
  assert.ok(!providers.isDirectModel('black-forest-labs/flux:dev'))
  assert.ok(!providers.isDirectModel('nope:model'))
  assert.ok(!providers.isDirectModel('openai/gpt-image-1'))
})

test('provider keys are stored per provider, never described back, with env fallback', () => {
  const status = (id) => providers.describeImageProviders().find((p) => p.id === id)
  assert.deepEqual(status('fal'), { id: 'fal', name: 'fal.ai', env: ['FAL_KEY', 'FAL_API_KEY'], configured: false, source: null, hint: null })
  settings.setProviderKey('fal', 'fal-secret-1234')
  assert.equal(status('fal').hint, '••••1234')
  assert.ok(!JSON.stringify(providers.describeImageProviders()).includes('fal-secret'))
  assert.throws(() => settings.setProviderKey('fal', 'has space'), /does not look like an API key/)
  process.env.REPLICATE_API_TOKEN = 'r8_env_token'
  try {
    assert.equal(status('replicate').source, 'env')
  } finally {
    delete process.env.REPLICATE_API_TOKEN
  }
  settings.clearProviderKey('fal')
  assert.equal(status('fal').configured, false)
  assert.ok(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).providerKeys === undefined)
})

test('only providers with a key add models, shaped like OpenRouter entries', () => {
  assert.deepEqual(providers.listDirectImageModels(), [])
  settings.setProviderKey('bfl', 'bfl-key')
  try {
    const models = providers.listDirectImageModels()
    assert.deepEqual(models.map((m) => m.id), ['bfl:flux-pro-1.1'])
    assert.equal(models[0].acceptsImages, false)
    assert.equal(models[0].pricing.imageOutput, null)
  } finally {
    settings.clearProviderKey('bfl')
  }
})

test('generation sends what AI Connections carries and names what it drops', async () => {
  settings.setProviderKey('google', 'g-key')
  try {
    let body
    const result = await providers.generateDirectImage({
      model: 'google:gemini-2.5-flash-image',
      prompt: 'a lantern',
      params: { aspect_ratio: '2:3', resolution: '2K', output_format: 'webp' },
      fetch: async (_url, init) => {
        body = JSON.parse(init.body)
        return geminiImage()
      },
    })
    assert.equal(body.generationConfig.imageConfig.aspectRatio, '2:3')
    assert.deepEqual(result.sent, { aspect_ratio: '2:3' })
    assert.deepEqual(result.unsent, ['resolution', 'output_format'])
    assert.equal(result.cost, null)
    assert.deepEqual(result.images, [{ b64: png, mediaType: 'image/png' }])
  } finally {
    settings.clearProviderKey('google')
  }
})

test('provider rejections keep their message and status; references and missing keys are refused', async () => {
  settings.setProviderKey('google', 'g-key')
  try {
    const refused = async () =>
      new Response(JSON.stringify({ error: { code: 400, message: 'Prompt was blocked by safety filters.', status: 'INVALID_ARGUMENT' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    await assert.rejects(
      providers.generateDirectImage({ model: 'google:gemini-2.5-flash-image', prompt: 'x', fetch: refused }),
      (err) => err.status === 400 && /^Google Gemini returned HTTP 400: .*blocked by safety filters/.test(err.message)
    )
    await assert.rejects(
      providers.generateDirectImage({ model: 'google:gemini-2.5-flash-image', prompt: 'x', inputReferences: ['data:image/png;base64,AA'] }),
      /does not take reference images/
    )
  } finally {
    settings.clearProviderKey('google')
  }
  await assert.rejects(
    providers.generateDirectImage({ model: 'fal:fal-ai/flux/dev', prompt: 'x' }),
    (err) => err.status === 401 && /No fal\.ai key\. Add one in Settings or set FAL_KEY/.test(err.message)
  )
})

test('a queued job for a direct model runs, saves its image, and notes unsent params', async () => {
  settings.setProviderKey('google', 'g-key')
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => geminiImage()
  try {
    const job = {
      id: 'job-direct-1',
      created_at: Date.now(),
      status: 'queued',
      model: 'google:gemini-2.5-flash-image',
      prompt: 'a lantern',
      params: { aspect_ratio: '3:4', resolution: '1K' },
      refs: [],
      n: 1,
      kind: 'image',
    }
    jobsRepo.insert(job)
    await runJob(job.id)
    const done = jobsRepo.get(job.id)
    assert.equal(done.status, 'done', done.error ?? '')
    assert.equal(done.cost, null)
    assert.match(done.note ?? '', /Not sent to this provider: resolution/)
    const image = db.prepare('SELECT * FROM images WHERE job_id = ?').get(job.id)
    assert.ok(image, 'the image was saved to the library')
    assert.deepEqual(JSON.parse(image.params), { aspect_ratio: '3:4' })
  } finally {
    globalThis.fetch = realFetch
    settings.clearProviderKey('google')
  }
})
