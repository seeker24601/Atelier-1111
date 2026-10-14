import { Router } from 'express'
import * as jobsRepo from '../db/jobs.js'

export const jobs = Router()

jobs.get('/jobs', (_req, res) => {
  res.json({ jobs: jobsRepo.recent(40) })
})

/**
 * Clearing the log. A job row carries the prompt that made it; the gallery
 * keeps its own copy with each plate, so the log can go without losing work.
 */
/** Failed jobs picked out in the gallery. Queued and running ones are left alone. */
jobs.post('/jobs/remove', (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string')) {
    return res.status(400).json({ error: 'Expected { ids: [...] }.' })
  }
  res.json({ removed: jobsRepo.removeFinished([...new Set(ids)]) })
})

jobs.delete('/jobs', (_req, res) => {
  res.json({ cleared: jobsRepo.clearFinished() })
})
