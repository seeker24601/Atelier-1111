import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'src-tauri/backend')
const data = mkdtempSync(join(tmpdir(), 'atelier-desktop-check-'))
const env = { ...process.env, APP_PORT: '0', ATELIER_DESKTOP: '1', ATELIER_DATA_DIR: data }
delete env.OPENROUTER_API_KEY
const child = spawn(join(backend, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
  [join(backend, 'scripts/desktop-entry.mjs')], { cwd: backend, env, stdio: ['pipe', 'pipe', 'inherit'] })
const exited = once(child, 'exit')
const timeout = setTimeout(() => child.kill(), 20_000)
try {
  let port
  for await (const line of createInterface({ input: child.stdout })) {
    if (line.startsWith('ATELIER_READY:')) { port = Number(line.split(':')[1]); break }
  }
  assert.ok(port > 0 && port !== 5180, 'Backend must select its own free port')
  const url = `http://127.0.0.1:${port}`
  const health = await fetch(`${url}/api/health`).then(r => r.json())
  const { providers, ...key } = health.key
  assert.deepEqual({ ...health, key }, { ok: true, key: { configured: false, active: null, source: null, hint: null, theme: 'system' } })
  // The bundled backend must carry AI Connections: its catalog supplies all but the first three.
  assert.deepEqual(providers.map((p) => p.id),
    ['openrouter', 'openai', 'google', 'xai', 'fal', 'replicate', 'bfl', 'luma', 'bytedance', 'prodia'])
  assert.equal(providers.find((p) => p.id === 'fal').label, 'fal.ai')
  assert.ok(providers.every((p) => !p.configured && p.source === null && p.hint === null), 'no key in a fresh data directory')
  const html = await fetch(url).then(r => r.text())
  assert.match(html, /ATELIER-1111/)
  assert.equal(existsSync(join(data, 'atelier.db')), true, 'Database must use desktop data directory')
  assert.equal(existsSync(join(data, 'images')), true)
  assert.equal((await fetch(`${url}/api/health`, { headers: { Origin: 'https://example.com' } })).status, 403)
  child.stdin.end()
  assert.deepEqual(await exited, [0, null], 'Backend must exit when its desktop parent disconnects')
  console.log('Desktop backend verified: bundled Node, UI, API, storage, origin checks, parent-exit cleanup.')
} finally {
  clearTimeout(timeout)
  if (child.exitCode === null) { child.kill(); await exited }
  // This path was created here with mkdtemp; it contains only verification data.
  rmSync(data, { recursive: true, force: true })
}
