import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The real desktop data, when this machine has it. Only ever read, and only
// through a consistent copy; the copied settings drop the API key.
const REAL = process.env.APPDATA && join(process.env.APPDATA, 'com.seeker24601.atelier1111')
const haveReal = Boolean(REAL && existsSync(join(REAL, 'atelier.db')))

const dir = mkdtempSync(join(tmpdir(), 'atelier-migrate-'))
if (haveReal) {
  const source = new DatabaseSync(join(REAL, 'atelier.db'), { readOnly: true })
  source.prepare('VACUUM INTO ?').run(join(dir, 'atelier.db'))
  source.close()
  if (existsSync(join(REAL, 'settings.json'))) {
    const settings = JSON.parse(readFileSync(join(REAL, 'settings.json'), 'utf8'))
    delete settings.openrouterApiKey
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings))
  }
}
process.env.ATELIER_DATA_DIR = dir
const { db } = await import('./db/index.js')
const { getHiddenModels, setHiddenModels } = await import('./settings.js')
const { qualifyModelIds, downgradeModelIds } = await import('./migrations.js')
const hiddenModels = { get: getHiddenModels, set: setHiddenModels }
test.after(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

// Edge cases on top of whatever the real data holds.
const now = Date.now()
db.prepare(
  `INSERT INTO jobs (id, created_at, status, model, prompt, params, refs, n) VALUES (?, ?, 'done', ?, 'p', '{}', '[]', 1)`
).run('edge-free', now, 'google/gemini-2.0-flash-exp:free')
db.prepare(
  `INSERT INTO capabilities (model, param, value, verdict, evidence, observed_at, samples) VALUES (?, 'aspect_ratio', '2:3', ?, ?, ?, ?)`
).run('edge/model', 'ignored', 'old', now - 1000, 2)
db.prepare(
  `INSERT INTO capabilities (model, param, value, verdict, evidence, observed_at, samples) VALUES (?, 'aspect_ratio', '2:3', ?, ?, ?, ?)`
).run('openrouter:edge/model', 'honoured', 'new', now, 3)
setHiddenModels([...getHiddenModels(), 'edge/hidden'])

const snapshot = () => ({
  jobs: db.prepare('SELECT id, model FROM jobs ORDER BY id').all().map((r) => ({ ...r })),
  images: db.prepare('SELECT id, model FROM images ORDER BY id').all().map((r) => ({ ...r })),
  capabilities: db.prepare('SELECT model, param, value FROM capabilities ORDER BY model, param, value').all().map((r) => ({ ...r })),
  hidden: getHiddenModels(),
})
const before = snapshot()

test('every stored id is qualified, counts hold, :free survives, and a backup is written first', () => {
  const { changed, backup } = qualifyModelIds({ db, dataDir: dir, hiddenModels })
  assert.ok(changed > 0)
  assert.ok(existsSync(backup.dbCopy), 'database backed up')
  const backedUp = new DatabaseSync(backup.dbCopy, { readOnly: true })
  assert.equal(backedUp.prepare('SELECT COUNT(*) n FROM jobs').get().n, before.jobs.length, 'backup holds the pre-migration rows')
  backedUp.close()

  const after = snapshot()
  assert.equal(after.jobs.length, before.jobs.length)
  assert.equal(after.images.length, before.images.length)
  // The conflicting pair merged into one row; everything else is a rename.
  assert.equal(after.capabilities.length, before.capabilities.length - 1)
  for (const { model } of [...after.jobs, ...after.images, ...after.capabilities]) {
    assert.match(model, /^(openrouter|openai|google):/, model)
  }
  assert.ok(after.hidden.every((id) => id.startsWith('openrouter:')))
  assert.equal(after.jobs.find((j) => j.id === 'edge-free').model, 'openrouter:google/gemini-2.0-flash-exp:free')

  const merged = db.prepare("SELECT * FROM capabilities WHERE model = 'openrouter:edge/model'").get()
  assert.deepEqual([merged.verdict, merged.evidence, merged.samples], ['honoured', 'new', 5], 'newer verdict wins, samples add')
})

test('a second run changes nothing and writes no backup', () => {
  const backups = readdirSync(join(dir, 'backups')).length
  assert.deepEqual(qualifyModelIds({ db, dataDir: dir, hiddenModels }), { changed: 0, backup: null })
  assert.equal(readdirSync(join(dir, 'backups')).length, backups)
})

test('the down-migration restores bare ids for v0.1.0, and qualifying again is clean', () => {
  downgradeModelIds({ db, dataDir: dir, hiddenModels })
  const down = snapshot()
  assert.deepEqual(down.jobs, before.jobs)
  assert.deepEqual(down.images, before.images)
  assert.deepEqual(down.hidden, before.hidden)
  // The merged ledger row comes back once, bare.
  assert.deepEqual(
    down.capabilities,
    before.capabilities.filter((c) => c.model !== 'openrouter:edge/model')
  )
  qualifyModelIds({ db, dataDir: dir, hiddenModels })
  assert.ok(snapshot().jobs.every((j) => j.model.startsWith('openrouter:')))
})

test('the copy of the real desktop data was used when present', { skip: !haveReal && 'no desktop data on this machine' }, () => {
  assert.ok(before.jobs.length > 1 && before.images.length > 0)
})
