import test from 'node:test'
import assert from 'node:assert/strict'
import { connectionFiles } from './connection.js'
import { references } from './references.js'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('discovery uses the desktop data directory on each OS and respects overrides', () => {
  assert.match(connectionFiles({ APPDATA: '/roaming' }, 'win32', '/home')[0], /roaming.*com\.seeker24601\.atelier1111/)
  assert.match(connectionFiles({}, 'darwin', '/home')[0], /Library.*Application Support.*com\.seeker24601\.atelier1111/)
  assert.deepEqual(connectionFiles({ ATELIER_DATA_DIR: '/chosen' }, 'darwin', '/home'), [join('/chosen', 'mcp-connection.json')])
})

test('references reject non-images and combined counts over the app limit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'atelier-mcp-refs-'))
  try {
    const file = join(directory, 'not-an-image.png')
    writeFileSync(file, 'fixture text, not image bytes')
    await assert.rejects(references([], [file]), /PNG, JPEG, or WebP/)
    await assert.rejects(references(Array(8).fill('fixture-id'), [file]), /at most 8/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
