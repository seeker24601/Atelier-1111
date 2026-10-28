import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createInterface } from 'node:readline'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { connectionFiles } from './connection.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = fileURLToPath(new URL('../', import.meta.url))

test('auto-discovery skips stale desktops, pins the chosen app, and honours explicit data directories', { timeout: 30000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'atelier-discovery-'))
  const source = join(directory, 'data')
  const desktop = join(directory, 'desktop-data')
  const fakeHome = join(directory, 'home')
  const env = { ...process.env, HOME: fakeHome, APPDATA: fakeHome, USERPROFILE: fakeHome, XDG_DATA_HOME: fakeHome }
  delete env.ATELIER_DATA_DIR
  mkdirSync(join(directory, 'mcp'), { recursive: true })
  for (const file of ['index.js', 'server.js', 'connection.js', 'references.js']) {
    copyFileSync(join(root, 'mcp', file), join(directory, 'mcp', file))
  }
  copyFileSync(join(root, 'package.json'), join(directory, 'package.json'))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const descriptor = connectionFiles(env, process.platform, fakeHome)[0]
  mkdirSync(join(descriptor, '..'), { recursive: true })
  const unused = createServer()
  await new Promise(resolve => unused.listen(0, '127.0.0.1', resolve))
  const deadPort = unused.address().port
  await new Promise(resolve => unused.close(resolve))
  const stale = { url: `http://127.0.0.1:${deadPort}`, token: '1'.repeat(64), pid: 999999 }
  writeFileSync(descriptor, JSON.stringify(stale))
  const processes = []
  const clients = []
  const start = async data => {
    const child = spawn(process.execPath, ['mcp/fixtures/backend.mjs'], {
      cwd: root, env: { ...env, ATELIER_DATA_DIR: data, ATELIER_DESKTOP: '1', APP_PORT: '0' }, stdio: ['pipe', 'pipe', 'pipe'],
    })
    const exited = once(child, 'exit')
    processes.push({ child, exited })
    child.stderr.resume()
    for await (const line of createInterface({ input: child.stdout })) {
      if (line.startsWith('ATELIER_READY:')) return { child, exited, connection: JSON.parse(readFileSync(join(data, 'mcp-connection.json'))) }
    }
    throw new Error('Fixture backend did not start')
  }
  const connect = async overrides => {
    const client = new Client({ name: 'discovery-review', version: '1' })
    clients.push(client)
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp/index.js'], cwd: directory, env: { ...env, ...overrides } }))
    return client
  }
  t.after(async () => {
    for (const client of clients) await client.close()
    for (const { child, exited } of processes) {
      if (child.exitCode === null) child.kill()
      await exited
    }
    rmSync(directory, { recursive: true, force: true })
  })
  const sourceBackend = await start(source)
  const client = await connect()
  const status = () => client.callTool({ name: 'atelier_status', arguments: {} })
  const first = await status()
  assert.equal(first.isError, undefined, first.content[0].text)
  assert.equal(first.structuredContent.storage.dir, join(source, 'images'))
  const desktopBackend = await start(desktop)
  writeFileSync(descriptor, JSON.stringify(desktopBackend.connection))
  assert.equal((await status()).structuredContent.storage.dir, join(source, 'images'), 'A session must not switch to a newly opened desktop')
  sourceBackend.child.kill()
  await sourceBackend.exited
  assert.equal((await status()).isError, true, 'Losing the selected source must not redirect tools to another app')
  await start(source)
  assert.equal((await status()).structuredContent.storage.dir, join(source, 'images'), 'Restarting the selected app must reconnect to the same data')

  const explicit = await connect({ ATELIER_DATA_DIR: join(directory, 'missing') })
  assert.equal((await explicit.callTool({ name: 'atelier_status', arguments: {} })).isError, true, 'Explicit directories must not fall back')
  const desktopClient = await connect()
  assert.equal((await desktopClient.callTool({ name: 'atelier_status', arguments: {} })).structuredContent.storage.dir, join(desktop, 'images'))
  desktopBackend.child.kill()
  await desktopBackend.exited
  const afterCrash = await connect()
  assert.equal((await afterCrash.callTool({ name: 'atelier_status', arguments: {} })).structuredContent.storage.dir, join(source, 'images'), 'A force-stopped desktop must not mask a live source')
})
