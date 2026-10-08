import { Router } from 'express'
import { listImageModels } from '../openrouter.js'
import { listVideoModels } from '../videos.js'

export const models = Router()

models.get('/models', async (req, res) => {
  try {
    const list = req.query.kind === 'video' ? listVideoModels : listImageModels
    const all = await list({ force: req.query.refresh === '1' })
    // Superseded models are hidden by default; ?all=1 brings them back for
    // inspection without needing a second endpoint.
    res.json({ models: req.query.all === '1' ? all : all.filter((m) => !m.supersededBy) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})
