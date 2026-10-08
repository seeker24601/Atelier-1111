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
jobs.delete('/jobs', (_req, res) => {
  res.json({ cleared: jobsRepo.clearFinished() })
})
