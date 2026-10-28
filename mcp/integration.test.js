import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = fileURLToPath(new URL('../', import.meta.url))

test('stdio agents share the real queue and gallery with the running backend', { timeout: 30000 }, async t => {
  const data = mkdtempSync(join(tmpdir(), 'atelier-mcp-'))
  const env = { ...process.env, ATELIER_DATA_DIR: data, ATELIER_DESKTOP: '1', APP_PORT: '0' }
  let backend = spawn(process.execPath, ['mcp/fixtures/backend.mjs'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
  let exited = once(backend, 'exit')
  backend.stderr.resume()
  const client = new Client({ name: 'atelier-integration-test', version: '1' })
  t.after(async () => {
    await client.close()
    backend.stdin.end()
    if (backend.exitCode === null) backend.kill()
    await exited
    rmSync(data, { recursive: true, force: true })
  })
  let port
  for await (const line of createInterface({ input: backend.stdout })) {
    if (line.startsWith('ATELIER_READY:')) { port = Number(line.split(':')[1]); break }
  }
  assert.ok(port > 0)
  const descriptorPath = join(data, 'mcp-connection.json')
  const descriptor = JSON.parse(readFileSync(descriptorPath))
  assert.equal(descriptor.url, `http://127.0.0.1:${port}`)
  assert.equal(JSON.stringify(descriptor).includes('sk-or-fixture'), false)
  const command = process.env.ATELIER_MCP_COMMAND || process.execPath
  const args = process.env.ATELIER_MCP_COMMAND ? ['--mcp'] : ['mcp/index.js']
  const connection = new StdioClientTransport({ command, args, cwd: root, env, stderr: 'pipe' })
  connection.stderr.resume()
  await client.connect(connection)
  const call = (name, args = {}) => client.callTool({ name, arguments: args })
  const value = async (name, args) => {
    const result = await call(name, args)
    assert.equal(result.isError, undefined, result.content?.[0]?.text)
    return result.structuredContent
  }
  const tools = (await client.listTools()).tools
  assert.equal(tools.length, 10)
  assert.equal(tools.find(t => t.name === 'atelier_generate').annotations.readOnlyHint, false)
  assert.equal(tools.find(t => t.name === 'atelier_generate').annotations.openWorldHint, true)
  assert.equal(tools.find(t => t.name === 'atelier_delete_media').annotations.destructiveHint, true)
  const status = await value('atelier_status')
  assert.equal(status.active, 'openrouter')
  assert.equal(JSON.stringify(status).includes('sk-or-fixture-secret'), false)
  assert.equal(JSON.stringify(status).includes('hint'), false)
  assert.equal((await value('atelier_list_models')).models[0].id, 'openrouter:fixture-image')
  assert.equal((await value('atelier_list_models', { kind: 'video' })).models[0].id, 'openrouter:fixture-video')
  assert.deepEqual((await value('atelier_capabilities', { model: 'openrouter:fixture-image' })).capabilities, [])

  const completed = async id => {
    for (let i = 0; i < 100; i++) {
      const result = await value('atelier_get_job', { id })
      if (['done', 'error'].includes(result.job.status)) return result
      await delay(20)
    }
    throw new Error('Fixture job did not settle.')
  }
  const { jobIds } = await value('atelier_generate', { model: 'openrouter:fixture-image', prompt: 'Fixture image' })
  const result = await completed(jobIds[0])
  assert.equal(result.job.status, 'done')
  assert.equal(result.images.length, 1)
  assert.equal(result.job.cost, 0)
  assert.equal(result.job.prompt, 'Fixture image')
  const mediaId = result.images[0].id
  assert.equal((await value('atelier_list_gallery', { query: 'Fixture image' })).images[0].id, mediaId)
  const media = await call('atelier_get_media', { id: mediaId, include_image: true })
  assert.equal(media.content.find(c => c.type === 'image').mimeType, 'image/png')
  assert.equal(readFileSync(media.structuredContent.path).toString('base64'), media.content.find(c => c.type === 'image').data)
  const edited = await value('atelier_generate', { model: 'openrouter:fixture-image', prompt: 'Edit fixture', reference_image_ids: [mediaId] })
  assert.equal((await completed(edited.jobIds[0])).job.status, 'done')
  const uploaded = await value('atelier_generate', { model: 'openrouter:fixture-image', prompt: 'Local ref', reference_paths: [media.structuredContent.path] })
  assert.equal((await completed(uploaded.jobIds[0])).job.status, 'done')
  const video = await value('atelier_generate', { model: 'openrouter:fixture-video', prompt: 'Fixture video', kind: 'video', params: { duration: 4 } })
  const clip = await completed(video.jobIds[0])
  assert.equal(clip.job.status, 'done')
  assert.equal(clip.images[0].kind, 'video')
  const failed = await value('atelier_generate', { model: 'openrouter:fixture-image', prompt: 'fixture failure' })
  assert.equal((await completed(failed.jobIds[0])).job.error, 'Fixture provider refused the prompt.')
  assert.equal((await value('atelier_list_jobs')).jobs.length, 5)
  assert.equal((await call('atelier_generate', { model: 'openrouter:fixture-image', prompt: ' ' })).isError, true)
  assert.equal((await call('atelier_select_provider', { provider: 'nonexistent' })).isError, true)
  assert.equal((await value('atelier_select_provider', { provider: 'google' })).active, 'google')
  assert.equal((await value('atelier_list_models')).models[0].id, 'google:fixture-image')
  assert.equal((await value('atelier_select_provider', { provider: 'openrouter' })).active, 'openrouter')
  const headers = { 'x-atelier-mcp-token': descriptor.token }
  const url = descriptor.url
  assert.equal((await fetch(`${url}/mcp-api/health`)).status, 401)
  assert.equal((await fetch(`${url}/mcp-api/health`, { headers: { ...headers, Origin: 'https://example.com' } })).status, 403)
  assert.equal((await fetch(`${url}/mcp-api/settings/key`, { method: 'PUT', headers })).status, 403)
  assert.equal((await fetch(`${url}/mcp-api/images`, { method: 'DELETE', headers })).status, 403)
  assert.equal((await value('atelier_delete_media', { id: mediaId })).ok, true)
  assert.equal((await call('atelier_get_media', { id: mediaId })).isError, true)

  writeFileSync(descriptorPath, JSON.stringify({ ...descriptor, token: '0'.repeat(64) }))
  assert.equal((await call('atelier_status')).isError, true, 'Old instance tokens must be rejected')
  writeFileSync(descriptorPath, JSON.stringify({ ...descriptor, url: 'https://example.com' }))
  assert.equal((await call('atelier_status')).isError, true, 'Discovery must reject remote hosts')
  writeFileSync(descriptorPath, JSON.stringify(descriptor))
  backend.stdin.end()
  await exited
  assert.equal(existsSync(descriptorPath), false)
  assert.equal((await call('atelier_status')).isError, true, 'Closed apps must produce an actionable tool error')
  backend = spawn(process.execPath, ['mcp/fixtures/backend.mjs'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
  exited = once(backend, 'exit')
  backend.stderr.resume()
  for await (const line of createInterface({ input: backend.stdout })) {
    if (line.startsWith('ATELIER_READY:')) break
  }
  assert.notEqual(JSON.parse(readFileSync(descriptorPath)).token, descriptor.token)
  assert.equal((await value('atelier_status')).storage.count, 3, 'Existing MCP sessions must discover the restarted app and its gallery')
})
