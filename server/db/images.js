import { db, hydrate } from './index.js'

export function insert(img) {
  db.prepare(
    `INSERT OR IGNORE INTO images (id, job_id, created_at, model, prompt, params, refs, seq, file, media_type, bytes, cost, width, height, format, kind, seconds, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    img.id,
    img.job_id,
    img.created_at,
    img.model,
    img.prompt,
    JSON.stringify(img.params),
    JSON.stringify(img.refs),
    img.seq,
    img.file,
    img.media_type,
    img.bytes,
    img.cost,
    img.width ?? null,
    img.height ?? null,
    img.format ?? null,
    img.kind || 'image',
    img.seconds ?? null,
    img.note ?? null
  )
}

export function list({ limit = 120, model = null, q = null, kind = null } = {}) {
  const where = []
  const args = []
  if (kind) {
    where.push('kind = ?')
    args.push(kind)
  }
  if (model) {
    where.push('model = ?')
    args.push(model)
  }
  if (q) {
    where.push('prompt LIKE ?')
    args.push(`%${q}%`)
  }
  args.push(limit)

  return db
    .prepare(
      `SELECT * FROM images
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC, seq ASC LIMIT ?`
    )
    .all(...args)
    .map((r) => hydrate(r, 'params', 'refs'))
}

/** Count and spend across everything held, regardless of which tab produced it. */
export function totals() {
  const row = db
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(cost), 0) AS spend FROM images`)
    .get()
  return { count: row.count, spend: row.spend }
}

export function all() {
  return db.prepare(`SELECT id, file FROM images`).all()
}

export function clear() {
  return db.prepare(`DELETE FROM images`).run().changes
}

export function get(id) {
  return hydrate(db.prepare(`SELECT * FROM images WHERE id = ?`).get(id), 'params', 'refs')
}

export function remove(id) {
  db.prepare(`DELETE FROM images WHERE id = ?`).run(id)
}
