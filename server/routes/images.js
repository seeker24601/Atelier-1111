import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import * as imagesRepo from '../db/images.js'
import { downloadName } from '../filenames.js'
import { writeZip, ZIP_LIMIT_BYTES, ZIP_LIMIT_FILES } from '../zip.js'
import * as jobsRepo from '../db/jobs.js'
import * as library from '../library.js'
import { qualify } from '../modelid.js'

export const images = Router()

/** The gallery, newest first. Each row's bytes are at /files/<file>. */
images.get('/images', (req, res) => {
  res.json({
    images: imagesRepo.list({
      limit: Math.min(Number(req.query.limit) || 400, 5000),
      model: req.query.model ? qualify(req.query.model) : null,
      q: req.query.q || null,
      kind: req.query.kind || null,
    }),
  })
})

/** A list of ids from a JSON body, or null when it is not one. */
function idsFrom(body) {
  const ids = body?.ids
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string')) return null
  return [...new Set(ids)]
}

/**
 * Several plates at once. A POST with the ids, not DELETE /images with a body:
 * that path without one clears everything.
 */
images.post('/images/remove', async (req, res) => {
  const ids = idsFrom(req.body)
  if (!ids) return res.status(400).json({ error: 'Expected { ids: [...] }.' })
  res.json({ removed: await library.removeMany(ids) })
})

/**
 * Several plates as one download. The ids arrive in a POST, which has no
 * length limit, and come back as a short-lived link the browser downloads
 * like any single file. A link lasts a few minutes and can be fetched again.
 */
const archives = new Map()
const ARCHIVE_TTL_MS = 5 * 60 * 1000

images.post('/images/archive', async (req, res) => {
  const ids = idsFrom(req.body)
  if (!ids) return res.status(400).json({ error: 'Expected { ids: [...] }.' })
  const rows = await library.filesFor(ids)
  if (!rows.length) return res.status(404).json({ error: 'None of those files are on disk any more.' })
  const bytes = rows.reduce((sum, r) => sum + r.size, 0)
  if (rows.length > ZIP_LIMIT_FILES || bytes > ZIP_LIMIT_BYTES) {
    return res.status(413).json({ error: 'Too much for one download. Select fewer and try again.' })
  }
  const now = Date.now()
  for (const [token, a] of archives) if (now - a.at > ARCHIVE_TTL_MS) archives.delete(token)
  const token = randomUUID()
  archives.set(token, { ids: rows.map((r) => r.id), at: now })
  res.json({ url: `/api/images/archive/${token}`, count: rows.length })
})

images.get('/images/archive/:token', async (req, res) => {
  const archive = archives.get(req.params.token)
  if (!archive || Date.now() - archive.at > ARCHIVE_TTL_MS) {
    archives.delete(req.params.token)
    return res.status(404).json({ error: 'That download has expired. Download again.' })
  }
  const rows = await library.filesFor(archive.ids)
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const name = `atelier-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.setHeader('Cache-Control', 'no-store')

  const taken = new Set()
  async function* entries() {
    for (const row of rows) {
      const data = await library.bytesOf(row)
      if (!data) continue
      let file = downloadName(row)
      for (let n = 2; taken.has(file); n++) file = downloadName(row).replace(/(\.[^.]+)?$/, `-${n}$1`)
      taken.add(file)
      yield { name: file, data, mtime: row.created_at }
    }
  }
  await writeZip(res, entries())
  res.end()
})

images.delete('/images/:id', async (req, res) => {
  if (!(await library.remove(req.params.id))) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

/**
 * Everything made, and the log of prompts that made it. The capability ledger
 * stays — it records what models do, not what you made.
 */
images.delete('/images', async (_req, res) => {
  const removed = await library.clear()
  jobsRepo.clearFinished()
  res.json({ removed })
})

/**
 * One plate from a browser that held the gallery in IndexedDB. The bytes come
 * as a data URL inside the JSON body, which the 64 MB parser limit allows for.
 */
images.post('/images/import', async (req, res) => {
  const { record, data } = req.body || {}
  const m = /^data:[^;,]*;base64,(.*)$/s.exec(String(data || ''))
  if (!record || !m) return res.status(400).json({ error: 'Expected { record, data }.' })
  const adopted = await library.adopt(record, Buffer.from(m[1], 'base64'))
  res.json({ adopted })
})

/** Where the gallery lives on disk, how big it is, and what the disk has left. */
images.get('/storage', async (_req, res) => {
  res.json(await library.storage())
})
