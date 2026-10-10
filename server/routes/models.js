import { Router } from 'express'
import { adapter } from '../providers/index.js'
import { activeProviderId } from '../keys.js'
import { getHiddenModels, getCustomModels } from '../settings.js'
import { qualify, parseModelId } from '../modelid.js'
import { NO_PRICE } from '../providers/aiconnections.js'

export const models = Router()

/**
 * Every model the active provider lists for the modality, plus image models
 * the user added by id, minus the ones the user hid in Settings. ?all=1 returns the whole list with a `hidden` flag, which is
 * what Settings shows.
 */
/** An added model, shaped like a listed one. Its facts are unknown, so they are null. */
const customEntry = (id) => ({
  id,
  name: parseModelId(id).model,
  inputs: ['text'],
  acceptsImages: false,
  modality: 'text->image',
  tokenizer: null,
  moderated: null,
  created: null,
  contextLength: null,
  maxCompletionTokens: null,
  pricing: NO_PRICE,
  nativeResolution: null,
  supersededBy: null,
  custom: true,
})

models.get('/models', async (req, res) => {
  try {
    // Only the active provider's catalogue; with no key there is none to show.
    const active = activeProviderId()
    if (!active) return res.json({ models: [] })
    const provider = adapter(active)
    const kind = req.query.kind === 'video' ? 'video' : 'image'
    const listed = (await provider.listModels(kind, { force: req.query.refresh === '1' })).map((m) => ({
      ...m,
      id: qualify(m.id, provider.id),
      supersededBy: m.supersededBy ? qualify(m.supersededBy, provider.id) : null,
    }))
    const known = new Set(listed.map((m) => m.id))
    const added = kind === 'image'
      ? getCustomModels()
          .filter((id) => parseModelId(id).provider === provider.id && !known.has(id))
          .map((id) => customEntry(id))
      : []
    const all = [...listed, ...added]
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
