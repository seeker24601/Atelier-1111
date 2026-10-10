import { Router } from 'express'
import { listImageModels } from '../openrouter.js'
import { listVideoModels } from '../videos.js'
import { getHiddenModels } from '../settings.js'
import { listDirectImageModels } from '../imageproviders.js'

export const models = Router()

/**
 * Every model OpenRouter lists for the modality, minus the ones the user hid
 * in Settings. ?all=1 returns the whole list with a `hidden` flag, which is
 * what Settings shows.
 */
models.get('/models', async (req, res) => {
  try {
    const video = req.query.kind === 'video'
    const list = video ? listVideoModels : listImageModels
    // Providers with their own key add their models to the image list. If
    // OpenRouter cannot be reached, those still show rather than nothing.
    const direct = video ? [] : listDirectImageModels()
    const openrouter = await list({ force: req.query.refresh === '1' }).catch((err) => {
      if (!direct.length) throw err
      return []
    })
    const all = [...openrouter, ...direct]
    const hidden = new Set(getHiddenModels())
    res.json({
      models:
        req.query.all === '1'
          ? all.map((m) => ({ ...m, hidden: hidden.has(m.id) }))
          : all.filter((m) => !hidden.has(m.id)),
    })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})
