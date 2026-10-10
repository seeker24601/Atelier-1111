import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDERS, qualify } from './modelid.js'

/**
 * Model ids in storage become `<provider>:<model>` (see modelid.js). This runs
 * on every start and touches only rows that are still bare, so data written by
 * v0.1.0 after a downgrade is qualified again on the next v0.2 start.
 *
 * Before changing anything it copies the database and settings.json into
 * data/backups. `downgradeModelIds` reverses it for v0.1.0.
 */

const BARE = PROVIDERS.map((p) => `model NOT LIKE '${p}:%'`).join(' AND ')
const OPENROUTER = "model LIKE 'openrouter:%'"
const TABLES = ['jobs', 'images']

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')

/** Copies the database (consistent, WAL included) and settings.json. Returns the paths. */
export function backupData(db, dataDir, label) {
  const dir = join(dataDir, 'backups')
  mkdirSync(dir, { recursive: true })
  // Seconds can repeat (a downgrade and a restart in the same second), and
  // VACUUM INTO refuses to overwrite, so a counter keeps names unique.
  let base = `${label}-${stamp()}`
  for (let n = 2; existsSync(join(dir, `${base}.db`)); n++) base = `${label}-${stamp()}-${n}`
  const dbCopy = join(dir, `${base}.db`)
  db.prepare('VACUUM INTO ?').run(dbCopy)
  const settings = join(dataDir, 'settings.json')
  const settingsCopy = existsSync(settings) ? join(dir, `${base}.settings.json`) : null
  if (settingsCopy) copyFileSync(settings, settingsCopy)
  return { dbCopy, settingsCopy }
}

/**
 * Renames capability rows, merging into an existing row with the same
 * (model, param, value): the more recent verdict wins and samples add up.
 */
function renameCapabilities(db, where, rename) {
  const rows = db.prepare(`SELECT * FROM capabilities WHERE ${where}`).all()
  const find = db.prepare('SELECT * FROM capabilities WHERE model = ? AND param = ? AND value = ?')
  const drop = db.prepare('DELETE FROM capabilities WHERE model = ? AND param = ? AND value = ?')
  const move = db.prepare('UPDATE capabilities SET model = ? WHERE model = ? AND param = ? AND value = ?')
  const merge = db.prepare(
    'UPDATE capabilities SET verdict = ?, evidence = ?, observed_at = ?, samples = ? WHERE model = ? AND param = ? AND value = ?'
  )
  for (const row of rows) {
    const target = rename(row.model)
    const existing = find.get(target, row.param, row.value)
    if (!existing) {
      move.run(target, row.model, row.param, row.value)
      continue
    }
    const newer = row.observed_at > existing.observed_at ? row : existing
    merge.run(newer.verdict, newer.evidence, newer.observed_at, existing.samples + row.samples, target, row.param, row.value)
    drop.run(row.model, row.param, row.value)
  }
  return rows.length
}

function transaction(db, work) {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function countBare(db) {
  return (
    TABLES.reduce((n, t) => n + db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${BARE}`).get().n, 0) +
    db.prepare(`SELECT COUNT(*) AS n FROM capabilities WHERE ${BARE}`).get().n
  )
}

/**
 * @param {{ db, dataDir: string, hiddenModels: { get(): string[], set(ids: string[]): void } }} deps
 * @returns {{ changed: number, backup: object | null }}
 */
export function qualifyModelIds({ db, dataDir, hiddenModels }) {
  const hidden = hiddenModels.get()
  const bareHidden = hidden.filter((id) => qualify(id) !== id)
  if (countBare(db) === 0 && bareHidden.length === 0) return { changed: 0, backup: null }

  const backup = backupData(db, dataDir, 'before-model-ids')
  const changed = transaction(db, () => {
    let n = 0
    for (const table of TABLES) {
      n += db.prepare(`UPDATE ${table} SET model = 'openrouter:' || model WHERE ${BARE}`).run().changes
    }
    return n + renameCapabilities(db, BARE, (id) => qualify(id))
  })
  if (bareHidden.length) hiddenModels.set(hidden.map((id) => qualify(id)))
  return { changed: changed + bareHidden.length, backup }
}

/**
 * The reverse, for running v0.1.0 against this data: strips `openrouter:`.
 * Rows from other providers keep their prefix; v0.1.0 shows them in the
 * gallery but cannot generate with them.
 */
export function downgradeModelIds({ db, dataDir, hiddenModels }) {
  const backup = backupData(db, dataDir, 'before-downgrade')
  const strip = (id) => (id.startsWith('openrouter:') ? id.slice('openrouter:'.length) : id)
  const changed = transaction(db, () => {
    let n = 0
    for (const table of TABLES) {
      n += db.prepare(`UPDATE ${table} SET model = substr(model, 12) WHERE ${OPENROUTER}`).run().changes
    }
    return n + renameCapabilities(db, OPENROUTER, strip)
  })
  const hidden = hiddenModels.get()
  if (hidden.some((id) => id.startsWith('openrouter:'))) hiddenModels.set(hidden.map(strip))
  return { changed, backup }
}
