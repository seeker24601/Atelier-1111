/**
 * `npm start` — the everyday way to run Atelier.
 *
 * Builds the UI only when something it is built from is newer than the last
 * build, then runs one process on 127.0.0.1:5180 serving both the page and the
 * API. No dev server, no file watcher, no second port: a cold start is the
 * time it takes Node to boot, plus a few seconds after an update.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILT = join(ROOT, 'dist', 'index.html')
const SOURCES = ['src', 'public', 'index.html', 'vite.config.js', 'package.json']

function newest(path) {
  if (!existsSync(path)) return 0
  const s = statSync(path)
  if (!s.isDirectory()) return s.mtimeMs
  return readdirSync(path).reduce((m, name) => Math.max(m, newest(join(path, name))), s.mtimeMs)
}

const builtAt = existsSync(BUILT) ? statSync(BUILT).mtimeMs : 0
const changedAt = Math.max(...SOURCES.map((p) => newest(join(ROOT, p))))

if (changedAt > builtAt || process.argv.includes('--rebuild')) {
  console.log('[atelier-1111] building the UI…')
  const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  const { status } = spawnSync(process.execPath, [vite, 'build', '--logLevel', 'warn'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (status !== 0) process.exit(status ?? 1)
}

process.argv.push('--app')
await import('../server/index.js')
