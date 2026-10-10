import { Router } from 'express'
import { describe, setKey, clearKey, getKey, setTheme, getHiddenModels, setHiddenModels } from '../settings.js'
import { verifyKey, account } from '../account.js'
import { setProviderKey, clearProviderKey } from '../settings.js'
import { describeImageProviders, isImageProvider } from '../imageproviders.js'

export const settings = Router()

/* Responses carry a masked hint and a source — never the key itself. */

settings.get('/settings', (_req, res) => {
  res.json(describe())
})

settings.put('/settings/key', async (req, res) => {
  const key = req.body?.key
  if (!key || !String(key).trim()) {
    return res.status(400).json({ error: 'Key is empty.' })
  }
  try {
    setKey(key)
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message })
  }
  // Saved first, then checked — a verification outage must not lock the user out.
  const check = await verifyKey(getKey())
  res.json({ ...describe(), ...check })
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

/** The key's own spend and limit, from OpenRouter. Null when no key is set. */
settings.get('/settings/account', async (req, res) => {
  try {
    res.json({ account: await account({ fresh: req.query.fresh === '1' }) })
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message })
  }
})

settings.delete('/settings/key', (_req, res) => {
  clearKey()
  res.json(describe())
})

/*
 * Image providers other than OpenRouter. Saving does not verify the key: none
 * of them has a free check, and a generation would bill. The panel says so.
 */
settings.get('/settings/providers', (_req, res) => {
  res.json({ providers: describeImageProviders() })
})

settings.put('/settings/providers/:id', (req, res) => {
  if (!isImageProvider(req.params.id)) return res.status(404).json({ error: 'Unknown provider.' })
  try {
    setProviderKey(req.params.id, req.body?.key)
    res.json({ providers: describeImageProviders() })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

settings.delete('/settings/providers/:id', (req, res) => {
  if (!isImageProvider(req.params.id)) return res.status(404).json({ error: 'Unknown provider.' })
  clearProviderKey(req.params.id)
  res.json({ providers: describeImageProviders() })
})
