import { Router } from 'express'
import { describe } from '../keys.js'
import { models } from './models.js'
import { generate } from './generate.js'
import { jobs } from './jobs.js'
import { images } from './images.js'
import { output } from './output.js'
import { settings } from './settings.js'
import { capabilities } from './capabilities.js'

export const api = Router()

api.get('/health', (_req, res) => {
  res.json({ ok: true, key: describe() })
})

api.use(models)
api.use(generate)
api.use(jobs)
api.use(output)
api.use(images)
api.use(settings)
api.use(capabilities)
