import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('agents share the spending cap and queued jobs survive agent disconnection', { timeout: 15000 }, async t => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const data = mkdtempSync(join(tmpdir(), 'atelier-mcp-queue-'))
  const env = { ...process.env, ATELIER_DATA_DIR: data, ATELIER_DESKTOP: '1', APP_PORT: '0' }
  const backend = spawn(process.execPath, ['mcp/fixtures/backend.mjs'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] })
  const exited = once(backend, 'exit')
  backend.stderr.resume()
  const clients = []
  t.after(async () => {
    for (const client of clients) await client.close()
    if (backend.exitCode === null) backend.kill()
    await exited
    rmSync(data, { recursive: true, force: true })
  })
  for await (const line of createInterface({ input: backend.stdout })) {
    if (line.startsWith('ATELIER_READY:')) break
  }
  const connect = async () => {
    const client = new Client({ name: 'queue-review', version: '1' })
    clients.push(client)
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp/index.js'], cwd: root, env }))
    return client
  }
  const first = await connect()
  const wrongProvider = await first.callTool({ name: 'atelier_generate', arguments: { model: 'google:fixture-image', prompt: 'Wrong provider' } })
  assert.equal(wrongProvider.isError, true)
  assert.match(wrongProvider.content[0].text, /not the active provider/)
  const ids = []
  for (let i = 0; i < 4; i++) {
    const result = await first.callTool({ name: 'atelier_generate', arguments: { model: 'openrouter:fixture-image', prompt: `hold queue ${i}` } })
    assert.equal(result.isError, undefined)
    ids.push(...result.structuredContent.jobIds)
  }
  const overflow = await first.callTool({ name: 'atelier_generate', arguments: { model: 'openrouter:fixture-image', prompt: 'must not enter the queue' } })
  assert.equal(overflow.isError, true, 'The fifth in-flight generation must be refused')
  assert.match(overflow.content[0].text, /Queue is full/)
  await first.close()
  writeFileSync(join(data, 'release-queue'), 'release')
  const second = await connect()
  let jobs
  for (let attempt = 0; attempt < 100; attempt++) {
    jobs = (await second.callTool({ name: 'atelier_list_jobs', arguments: {} })).structuredContent.jobs
    if (jobs.every(job => job.status === 'done')) break
    await delay(20)
  }
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map(job => job.id).sort(), ids.sort())
  assert.deepEqual(jobs.map(job => job.status), ['done', 'done', 'done', 'done'])
  assert.deepEqual(readFileSync(join(data, 'provider-calls.log'), 'utf8').trim().split('\n').sort(),
    ['hold queue 0', 'hold queue 1', 'hold queue 2', 'hold queue 3'])
})
