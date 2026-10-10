import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adapters, resolve as resolveModel } from './providers/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules') return []
    return statSync(path).isDirectory() ? files(path) : /\.(m?js|jsx)$/.test(name) ? [path] : []
  })
}

test('only the registry and the adapter itself import an adapter folder', () => {
  const offenders = []
  for (const file of [...files(join(ROOT, 'server')), ...files(join(ROOT, 'src')), ...files(join(ROOT, 'scripts'))]) {
    const source = readFileSync(file, 'utf8')
    for (const [, spec] of source.matchAll(/(?:import|from)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      // Compared as forward-slash paths so the check holds on Windows too.
      const target = resolve(dirname(file), spec).split(sep).join('/')
      const from = file.split(sep).join('/')
      const marker = '/server/providers/'
      const after = target.includes(marker) ? target.slice(target.indexOf(marker) + marker.length) : ''
      if (!after.includes('/')) continue // not inside an adapter folder
      const adapterDir = target.slice(0, target.lastIndexOf('/') + 1)
      const allowed = from.startsWith(adapterDir) || from.endsWith('/server/providers/index.js')
      if (!allowed) offenders.push(`${relative(ROOT, file)} → ${spec}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('every adapter meets the contract', () => {
  for (const a of adapters()) {
    for (const key of ['id', 'label']) assert.equal(typeof a[key], 'string', `${a.id}.${key}`)
    for (const fn of ['detect', 'verify', 'listModels', 'generateImage']) assert.equal(typeof a[fn], 'function', `${a.id}.${fn}`)
  }
})

test('qualified ids resolve to their adapter and the id it expects', () => {
  const { adapter, model } = resolveModel('openrouter:google/gemini-2.0-flash-exp:free')
  assert.equal(adapter.id, 'openrouter')
  assert.equal(model, 'google/gemini-2.0-flash-exp:free')
  assert.equal(resolveModel('google/x').adapter.id, 'openrouter', 'bare ids are OpenRouter ids')
})
