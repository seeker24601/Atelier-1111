import { apiKeyNames } from 'ai-connections/direct'
import { verifyByListing } from '../verify.js'
import { discoverImageModels, generateWith, splitParams } from '../aiconnections.js'

/**
 * Gemini API image models, reached through AI Connections, which lists both
 * Gemini image models and Imagen. Models arrive without the `google:` prefix.
 * Gemini image models take references inline; Imagen takes none here.
 */
const acceptsImages = (id) => id.startsWith('gemini')

export const google = {
  id: 'google',
  label: 'Google',
  env: apiKeyNames('google'),

  detect: (key) => key.startsWith('AIza'),

  verify: (key) => verifyByListing({ provider: 'google', label: 'Google', key }),

  listModels: (kind) => (kind === 'video' ? [] : discoverImageModels(google, { acceptsImages })),

  generateImage({ model, prompt, params = {}, refs = [] }) {
    // The ratio goes as asked; a model that refuses one says so, and the ledger records it.
    const { kept, omitted } = splitParams(params, ['aspect_ratio'])
    const input = kept.aspect_ratio ? { aspectRatio: kept.aspect_ratio } : {}
    return generateWith(google, { model, prompt, input, sent: kept, omitted, refs })
  },
}
