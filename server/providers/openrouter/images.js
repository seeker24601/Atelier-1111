import { getKey } from '../../settings.js'
import { fetchModels } from './modelindex.js'
import { nativeResolution } from './modelfacts.js'

export const BASE = 'https://openrouter.ai/api/v1'

/** OpenRouter's app attribution, sent with every request. */
export const attribution = () => ({
  'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5180',
  'X-Title': process.env.OPENROUTER_APP_TITLE || 'Atelier-1111',
})

export function authHeaders() {
  const key = getKey()
  if (!key) {
    const err = new Error('No API key. Open Settings and add your OpenRouter key.')
    err.status = 401
    throw err
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...attribution(),
  }
}

/** Image models, with the one field only they have: a stated native size. */
export const listImageModels = (opts) =>
  fetchModels('image', {
    ...opts,
    // Stated in prose only; output size is a model property, not a parameter.
    decorate: (model, raw) => ({ ...model, nativeResolution: nativeResolution(raw.description) }),
  })
