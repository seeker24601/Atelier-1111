import { Router } from 'express'
import * as imagesRepo from '../db/images.js'
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
