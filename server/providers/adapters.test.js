import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'atelier-adapters-'))
process.env.ATELIER_DATA_DIR = dir
const { adapter } = await import('./index.js')
const { storeKey } = await import('../settings.js')
const jobsRepo = await import('../db/jobs.js')
const { db } = await import('../db/index.js')
const { runJob } = await import('../runjob.js')
test.after(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC2sAAAAASUVORK5CYII='
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const calls = []
let reply = null // set per test; default answers below
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input)
  calls.push({ url, body: init?.body })
  if (reply) return reply(url, init)
  if (url.endsWith('api.openai.com/v1/models')) return json({ data: [{ id: 'gpt-4o' }, { id: 'gpt-image-1' }, { id: 'chatgpt-image-latest' }, { id: 'dall-e-3' }] })
  if (url.includes('generativelanguage.googleapis.com') && url.includes('/models?')) {
    return json({ models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/imagen-4.0-generate-001', supportedGenerationMethods: ['predict'] },
    ] })
  }
  if (url.includes(':generateContent')) {
    return json({ candidates: [{ content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png } }] }, finishReason: 'STOP' }] })
  }
  if (url.includes('api.openai.com/v1/images/')) return json({ created: 1, data: [{ b64_json: png }] })
  return json({ error: 'unexpected ' + url }, 404)
}
test.after(() => { globalThis.fetch = realFetch })
test.beforeEach(() => { calls.length = 0; reply = null })

storeKey('openai', 'sk-proj-test-openai-0000')
storeKey('google', 'AIza-test-google-0000')
const openai = adapter('openai')
const google = adapter('google')

test('OpenAI lists every image model it offers, unfiltered by Atelier; DALL·E takes no references', async () => {
  const models = await openai.listModels('image')
  assert.deepEqual(models.map((m) => [m.id, m.acceptsImages]), [['chatgpt-image-latest', true], ['dall-e-3', false], ['gpt-image-1', true]])
  assert.equal(models[0].pricing.imageOutput, null)
  assert.deepEqual(await openai.listModels('video'), [])
})

test('OpenAI turns a ratio into the size of the same shape and reports what was sent', async () => {
  const result = await openai.generateImage({
    model: 'gpt-image-1', prompt: 'a lantern',
    params: { aspect_ratio: '16:9', resolution: '2K', output_format: 'webp' },
  })
  assert.equal(JSON.parse(calls[0].body).size, '1536x1024')
  assert.deepEqual(result.sent, { aspect_ratio: '3:2' })
  assert.deepEqual(result.omitted, ['resolution', 'output_format'])
  assert.equal(result.cost, null)
  assert.deepEqual(result.images, [{ b64: png, mediaType: 'image/png' }])
  for (const [ratio, size] of [['9:16', '1024x1536'], ['1:1', '1024x1024'], ['4:3', '1536x1024']]) {
    calls.length = 0
    await openai.generateImage({ model: 'gpt-image-1', prompt: 'x', params: { aspect_ratio: ratio } })
    assert.equal(JSON.parse(calls[0].body).size, size, ratio)
  }
})

test('an OpenAI request with references is an edit', async () => {
  await openai.generateImage({ model: 'gpt-image-1', prompt: 'make it blue', refs: [`data:image/png;base64,${png}`] })
  assert.match(calls[0].url, /\/images\/edits$/)
  assert.ok(calls[0].body instanceof FormData)
})

test('a provider rejection keeps its message, led by the provider and status', async () => {
  reply = () => json({ error: { message: 'Your organization must be verified to use the model gpt-image-1.', type: 'invalid_request_error' } }, 403)
  await assert.rejects(openai.generateImage({ model: 'gpt-image-1', prompt: 'x' }), (err) => {
    assert.equal(err.status, 403)
    assert.match(err.message, /^OpenAI returned HTTP 403: .*organization must be verified/)
    return true
  })
})

test('Google lists Gemini image models and sends ratios and references as asked', async () => {
  const models = await google.listModels('image')
  assert.deepEqual(models.map((m) => [m.id, m.acceptsImages]), [['gemini-2.5-flash-image', true], ['imagen-4.0-generate-001', false]], 'Imagen is listed too; it takes no references')
  calls.length = 0
  const result = await google.generateImage({
    model: 'gemini-2.5-flash-image', prompt: 'a lantern',
    params: { aspect_ratio: '2:3', output_format: 'png' }, refs: [`data:image/png;base64,${png}`],
  })
  const body = JSON.parse(calls[0].body)
  assert.equal(body.generationConfig.imageConfig.aspectRatio, '2:3')
  assert.ok(JSON.stringify(body.contents).includes(png), 'the reference travels inline')
  assert.deepEqual(result.sent, { aspect_ratio: '2:3' })
  assert.deepEqual(result.omitted, ['output_format'])
})

test('the ledger judges what OpenAI was sent and never blames an omitted param', async () => {
  const job = {
    id: 'job-openai-1', created_at: Date.now(), status: 'queued', model: 'openai:gpt-image-1',
    prompt: 'a lantern', params: { aspect_ratio: '16:9', resolution: '2K' }, refs: [], n: 1, kind: 'image',
  }
  jobsRepo.insert(job)
  await runJob(job.id)
  const done = jobsRepo.get(job.id)
  assert.equal(done.status, 'done', done.error ?? '')
  assert.equal(done.cost, null)
  assert.match(done.note ?? '', /Not offered by this provider: resolution/)
  const image = db.prepare('SELECT * FROM images WHERE job_id = ?').get(job.id)
  assert.deepEqual(JSON.parse(image.params), { aspect_ratio: '3:2' })
  const ledger = db.prepare("SELECT param, value FROM capabilities WHERE model = 'openai:gpt-image-1'").all().map((r) => ({ ...r }))
  assert.ok(ledger.some((r) => r.param === 'aspect_ratio' && r.value === '3:2'), 'the measured ratio was recorded')
  assert.ok(ledger.every((r) => r.param !== 'resolution'), 'an omitted param is never recorded against the model')
  assert.ok(ledger.every((r) => r.param !== 'aspect_ratio' || r.value === '3:2'), 'the ratio is judged as sent, not as asked')
})

test('OpenRouter images stream previews, report cost, and a refused param is dropped and retried', async () => {
  const sse = (events) => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  })
  const headers = []
  reply = (url, init) => {
    headers.push(new Headers(init.headers))
    const body = JSON.parse(init.body)
    if (body.resolution) return json({ error: { message: 'resolution is not supported by this model' } }, 400)
    return sse([
      { type: 'image_generation.partial_image', b64_json: png, partial_image_index: 0 },
      { type: 'image_generation.completed', b64_json: png, media_type: 'image/png', usage: { cost: 0.039 } },
    ])
  }
  storeKey('openrouter', 'sk-or-v1-test-openrouter-0000')
  const job = {
    id: 'job-openrouter-1', created_at: Date.now(), status: 'queued', model: 'openrouter:google/gemini-2.5-flash-image',
    prompt: 'a lantern', params: { aspect_ratio: '1:1', resolution: '4K' }, refs: [], n: 1, kind: 'image',
  }
  jobsRepo.insert(job)
  await runJob(job.id)
  const done = jobsRepo.get(job.id)
  assert.equal(done.status, 'done', done.error ?? '')
  assert.equal(done.cost, 0.039)
  assert.match(done.note ?? '', /Retried without resolution/)
  const [first, second] = calls.map((c) => JSON.parse(c.body))
  assert.ok(calls.every((c) => c.url === 'https://openrouter.ai/api/v1/images'))
  assert.deepEqual([first.stream, first.aspect_ratio, first.resolution], [true, '1:1', '4K'], 'params go as asked, streamed')
  assert.equal(second.resolution, undefined)
  assert.equal(headers[0].get('x-title'), 'Atelier-1111')
  assert.equal(headers[0].get('authorization'), 'Bearer sk-or-v1-test-openrouter-0000')
  const refused = db.prepare("SELECT evidence FROM capabilities WHERE model = ? AND param = 'resolution'").get(job.model)
  assert.match(refused.evidence, /^OpenRouter returned HTTP 400: resolution is not supported/)
})

test('OpenRouter vector models still deliver SVG: Atelier opts in, and serves it sandboxed', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString('base64')
  reply = () => new Response(`data: ${JSON.stringify({ type: 'image_generation.completed', b64_json: svg, media_type: 'image/svg+xml' })}\n\ndata: [DONE]\n\n`, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
  storeKey('openrouter', 'sk-or-v1-test-openrouter-0000')
  const result = await adapter('openrouter').generateImage({ model: 'recraft/recraft-v4-vector', prompt: 'a lantern' })
  assert.equal(result.images[0].mediaType, 'image/svg+xml')
})

test('AI Connections image providers join the registry, detected by prefix only where it is unique', async () => {
  const { adapters } = await import('./index.js')
  const ids = adapters().map((a) => a.id)
  for (const id of ['xai', 'fal', 'replicate', 'bfl', 'luma', 'bytedance', 'prodia']) assert.ok(ids.includes(id), id)
  assert.equal(adapter('fal').label, 'fal.ai')
  assert.deepEqual(adapter('fal').env, ['FAL_KEY', 'FAL_API_KEY'])
  assert.equal(adapters().find((a) => a.detect('xai-abc'))?.id, 'xai')
  assert.equal(adapters().find((a) => a.detect('r8_abc'))?.id, 'replicate')
  assert.equal(adapters().find((a) => a.detect('0f1e2d3c-aaaa-bbbb-cccc-1234567890ab:5e6f')), undefined, 'a fal key names no provider')
})

test('a provider with no free key check is saved unchecked and lists AI Connections suggestions', async () => {
  const fal = adapter('fal')
  const check = await fal.verify('fal-test-key')
  assert.deepEqual([check.verified, check.unchecked], [false, true])
  assert.match(check.detail, /first image/)
  calls.length = 0
  storeKey('fal', 'fal-test-key')
  const models = await fal.listModels('image')
  assert.deepEqual(models.map((m) => m.id), ['fal-ai/flux/dev', 'fal-ai/recraft/v3/text-to-image'])
  assert.equal(calls.length, 0, 'listing suggestions costs no request')
  assert.deepEqual(await fal.listModels('video'), [], 'video stays with OpenRouter')
})

test('xAI keys are checked by listing, and its images go through AI Connections with the ratio as asked', async () => {
  reply = (url, init) => {
    if (url.endsWith('api.x.ai/v1/models')) return json({ data: [{ id: 'grok-4' }, { id: 'grok-imagine-image' }] })
    if (url.includes('api.x.ai/v1/images')) return json({ data: [{ b64_json: png }] })
    return json({ error: 'unexpected ' + url }, 404)
  }
  const xai = adapter('xai')
  const check = await xai.verify('xai-test-key')
  assert.equal(check.verified, true, check.detail)
  storeKey('xai', 'xai-test-key')
  calls.length = 0
  const result = await xai.generateImage({ model: 'grok-imagine-image', prompt: 'a lantern', params: { aspect_ratio: '16:9', resolution: '2K' } })
  assert.match(calls[0].url, /api\.x\.ai\/v1\/images/)
  assert.deepEqual(result.sent, { aspect_ratio: '16:9' })
  assert.deepEqual(result.omitted, ['resolution'])
  assert.equal(result.images[0].b64, png)
  assert.equal(result.cost, null)
})
