import { db } from './index.js'

/**
 * Keyed by value, not just parameter — a model may honour 1:1 and 16:9 while
 * silently dropping 21:9, and that difference is the whole point.
 */

export function record({ model, param, value, verdict, evidence }) {
  db.prepare(
    `INSERT INTO capabilities (model, param, value, verdict, evidence, observed_at, samples)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(model, param, value) DO UPDATE SET
       verdict     = excluded.verdict,
       evidence    = excluded.evidence,
       observed_at = excluded.observed_at,
       samples     = capabilities.samples + 1`
  ).run(model, param, String(value), verdict, evidence || null, Date.now())
}

export function forModel(model) {
  return db
    .prepare(`SELECT * FROM capabilities WHERE model = ? ORDER BY param, value`)
    .all(model)
}

export function all() {
  return db.prepare(`SELECT * FROM capabilities ORDER BY model, param, value`).all()
}

/** Parameter values this model is known to reject outright. */
export function rejectedFor(model) {
  return db
    .prepare(`SELECT param, value FROM capabilities WHERE model = ? AND verdict = 'rejected'`)
    .all(model)
}
