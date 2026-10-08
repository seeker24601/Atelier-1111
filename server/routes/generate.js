import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import * as jobsRepo from '../db/jobs.js'
import { enqueue, MAX_IN_FLIGHT } from '../queue.js'

export const generate = Router()


generate.post('/generate', (req, res) => {
  const { models = [], prompt = '', params = {}, refs = [], kind = 'image' } = req.body || {}

  if (!Array.isArray(models) || models.length === 0) {
    return res.status(400).json({ error: 'Select at least one model.' })
  }
  if (!prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is empty.' })
  }

  // Checked here, not only in the button: every queued job is a charge, and a
  // client that lost count should not be able to spend past the cap.
  const inFlight = jobsRepo.unfinished().length
  if (inFlight + models.length > MAX_IN_FLIGHT) {
    return res.status(429).json({
      error: `Queue is full — ${MAX_IN_FLIGHT} generations at a time. ${inFlight} still running.`,
    })
  }

  // One job per model. The picker sends one; the comparison grid will send many.
  const jobIds = models.map((model) => {
    const job = {
      id: randomUUID(),
      created_at: Date.now(),
      status: 'queued',
      model,
      prompt: prompt.trim(),
      params,
      refs,
      // The video endpoint has no batch parameter: one job is one clip.
      // One commit is one image. Batching is gone from the UI, so it is gone
      // here too rather than left as an unreachable parameter.
      n: 1,
      kind: kind === 'video' ? 'video' : 'image',
    }
    jobsRepo.insert(job)
    enqueue(job.id)
    return job.id
  })

  res.json({ jobIds })
})
