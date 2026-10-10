import { Router } from 'express'
import { activeProvider } from '../providers/index.js'
import { getHiddenModels } from '../settings.js'
import { qualify } from '../modelid.js'

export const models = Router()

/**
 * Every model OpenRouter lists for the modality, minus the ones the user hid
 * in Settings. ?all=1 returns the whole list with a `hidden` flag, which is
 * what Settings shows.
 */
models.get('/models', async (req, res) => {
  try {
    const provider = activeProvider()
    const kind = req.query.kind === 'video' ? 'video' : 'image'
    const all = (await provider.listModels(kind, { force: req.query.refresh === '1' })).map((m) => ({
      ...m,
      id: qualify(m.id, provider.id),
      supersededBy: m.supersededBy ? qualify(m.supersededBy, provider.id) : null,
    }))
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
