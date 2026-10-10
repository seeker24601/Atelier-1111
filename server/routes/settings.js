import { Router } from 'express'
import { setTheme, getHiddenModels, setHiddenModels, getCustomModels, setCustomModels } from '../settings.js'
import { adapter } from '../providers/index.js'
import { describe, saveKey, deleteKey, chooseActive } from '../keys.js'

const openrouter = adapter('openrouter')

export const settings = Router()

/* Responses carry a masked hint and a source — never the key itself. */

settings.get('/settings', (_req, res) => {
  res.json(describe())
})

/**
 * Body: { key, provider? }. Without a provider the key's prefix decides; a key
 * no provider recognises gets 422 with the choices, and is not stored.
 */
settings.put('/settings/key', async (req, res) => {
  const key = req.body?.key
  if (!key || !String(key).trim()) {
    return res.status(400).json({ error: 'Key is empty.' })
  }
  try {
    const result = await saveKey(key, req.body?.provider ?? null)
    res.json({ ...describe(), ...result })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, ...(err.choices ? { choices: err.choices } : {}) })
  }
})

settings.put('/settings/theme', (req, res) => {
  try {
    setTheme(req.body?.theme)
    res.json(describe())
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

settings.get('/settings/hidden-models', (_req, res) => {
  res.json({ ids: getHiddenModels() })
})

settings.put('/settings/hidden-models', (req, res) => {
  try {
    res.json({ ids: setHiddenModels(req.body?.ids) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

settings.get('/settings/custom-models', (_req, res) => {
  res.json({ ids: getCustomModels() })
})

/** Body: { ids }, qualified. The whole list, as for hidden models. */
settings.put('/settings/custom-models', (req, res) => {
  try {
    res.json({ ids: setCustomModels(req.body?.ids) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

/** The key's own spend and limit, from OpenRouter. Null when no key is set. */
settings.get('/settings/account', async (req, res) => {
  try {
    res.json({ account: await openrouter.account({ fresh: req.query.fresh === '1' }) })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

/** Clears a stored key. Without a provider, OpenRouter's, as in v0.1.0. */
settings.delete(['/settings/key', '/settings/key/:provider'], (req, res) => {
  try {
    deleteKey(req.params.provider ?? 'openrouter')
    res.json(describe())
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

/** Body: { provider }. The picker, tabs and generation follow the active provider. */
settings.put('/settings/active', (req, res) => {
  try {
    chooseActive(req.body?.provider)
    res.json(describe())
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})
