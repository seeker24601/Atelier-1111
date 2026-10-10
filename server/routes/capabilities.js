import { Router } from 'express'
import * as capsRepo from '../db/capabilities.js'
import { qualify } from '../modelid.js'

export const capabilities = Router()

/**
 * Observed capability, not declared capability. An absent entry means
 * "never tried", which is different from "unsupported" and is shown as such.
 */
capabilities.get('/capabilities', (req, res) => {
  const model = req.query.model ? qualify(req.query.model) : null
  res.json({ capabilities: model ? capsRepo.forModel(model) : capsRepo.all() })
})

/**
 * Whether a model actually used the reference it was given.
 *
 * Every image model on OpenRouter declares `image` input — all 42 of them — so
 * the modality field cannot answer this, and a model that ignores a reference
 * returns 200 and bills in full. Nothing in the bytes reveals it either: only
 * someone looking at the result can say whether the reference was used. So this
 * verdict is reported, not measured, and is labelled that way.
 */
capabilities.put('/capabilities/reference', (req, res) => {
  const { model: raw, verdict } = req.body || {}
  const model = raw ? qualify(raw) : raw
  if (!model) return res.status(400).json({ error: 'model is required' })
  if (!['ok', 'ignored'].includes(verdict))
    return res.status(400).json({ error: 'verdict must be ok or ignored' })

  capsRepo.record({
    model,
    param: 'reference',
    value: 'image',
    verdict,
    evidence:
      verdict === 'ok'
        ? 'Reported from the output: the reference was used.'
        : 'Reported from the output: the reference had no visible effect.',
  })
  res.json({ ok: true })
})
