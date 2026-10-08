import { db, hydrate } from './index.js'

export function insert(job) {
  db.prepare(
    `INSERT INTO jobs (id, created_at, status, model, prompt, params, refs, n, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    job.id,
    job.created_at,
    job.status,
    job.model,
    job.prompt,
    JSON.stringify(job.params),
    JSON.stringify(job.refs),
    job.n,
    job.kind || 'image'
  )
}

/** The upstream video job, so a restart can find work it started. */
export function setRemoteId(id, remoteId) {
  db.prepare(`UPDATE jobs SET remote_id = ? WHERE id = ?`).run(remoteId, id)
}

export function setStatus(id, status) {
  db.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).run(status, id)
}

export function finish(id, { status, cost = null, error = null, note = null }) {
  db.prepare(
    `UPDATE jobs SET status = ?, finished_at = ?, cost = ?, error = ?, note = ? WHERE id = ?`
  ).run(status, Date.now(), cost, error, note, id)
}

/**
 * Once a job settles its uploaded references have done their work; the log
 * keeps their description, not a multi-megabyte data URL per row.
 */
export function setRefs(id, refs) {
  db.prepare(`UPDATE jobs SET refs = ? WHERE id = ?`).run(JSON.stringify(refs), id)
}

/**
 * Everything settled. Queued and running rows stay — they are the queue, not
 * history, and dropping them would strand work in flight.
 */
export function clearFinished() {
  return db.prepare(`DELETE FROM jobs WHERE status IN ('done', 'error')`).run().changes
}

/** Anything the queue was in the middle of when the process stopped. */
export function unfinished() {
  return db
    .prepare(`SELECT * FROM jobs WHERE status IN ('queued', 'running')`)
    .all()
    .map((r) => hydrate(r, 'params', 'refs'))
}

export function recent(limit = 40) {
  return db
    .prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?`)
    .all(limit)
    .map((r) => hydrate(r, 'params', 'refs'))
}

export function get(id) {
  return hydrate(db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id), 'params', 'refs')
}

