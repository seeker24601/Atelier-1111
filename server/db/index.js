import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { DATA_DIR } from '../paths.js'

export const db = new DatabaseSync(join(DATA_DIR, 'atelier.db'))

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    created_at  INTEGER NOT NULL,
    finished_at INTEGER,
    status      TEXT NOT NULL,
    model       TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    params      TEXT NOT NULL,
    refs        TEXT NOT NULL,
    n           INTEGER NOT NULL,
    cost        REAL,
    error       TEXT
  );

  CREATE TABLE IF NOT EXISTS images (
    id         TEXT PRIMARY KEY,
    job_id     TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    model      TEXT NOT NULL,
    prompt     TEXT NOT NULL,
    params     TEXT NOT NULL,
    refs       TEXT NOT NULL,
    seq        INTEGER NOT NULL,
    file       TEXT NOT NULL,
    media_type TEXT NOT NULL,
    bytes      INTEGER NOT NULL,
    cost       REAL
  );

  CREATE TABLE IF NOT EXISTS capabilities (
    model       TEXT NOT NULL,
    param       TEXT NOT NULL,
    value       TEXT NOT NULL,
    verdict     TEXT NOT NULL,
    evidence    TEXT,
    observed_at INTEGER NOT NULL,
    samples     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (model, param, value)
  );

  CREATE INDEX IF NOT EXISTS images_created ON images(created_at DESC);
  CREATE INDEX IF NOT EXISTS jobs_created   ON jobs(created_at DESC);
`)

/** Additive migration for databases created before a column existed. */
function addColumn(table, name, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
  }
}

// Measured from the returned bytes — the evidence for a silently dropped param.
addColumn('images', 'width', 'INTEGER')
addColumn('images', 'height', 'INTEGER')
addColumn('images', 'format', 'TEXT')

// e.g. "Retried without aspect_ratio" when a parameter was stripped and resent.
addColumn('jobs', 'note', 'TEXT')

// 'image' or 'video'. Video came later, so everything already stored is an
// image and the default keeps old rows correct.
addColumn('jobs', 'kind', "TEXT NOT NULL DEFAULT 'image'")
addColumn('images', 'kind', "TEXT NOT NULL DEFAULT 'image'")

// The provider's own video job id. Video is the only asynchronous path here,
// and without this a clip finishing after a restart bills with nowhere to land.
addColumn('jobs', 'remote_id', 'TEXT')

// Clip length, measured from the container. Images leave it null.
addColumn('images', 'seconds', 'REAL')

// "Retried without quality" and the like, kept with the plate it explains.
addColumn('images', 'note', 'TEXT')

/** Rows store JSON in TEXT columns; hydrate the named fields in place. */
export function hydrate(row, ...fields) {
  if (!row) return row
  for (const f of fields) {
    try {
      row[f] = JSON.parse(row[f])
    } catch {
      row[f] = null
    }
  }
  return row
}
