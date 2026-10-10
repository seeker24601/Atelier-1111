import { apiKeyNames } from '@ai-connections/core/direct'
import { verifyByListing } from '../verify.js'
import { discoverImageModels, generateWith, splitParams } from '../aiconnections.js'

/**
 * Gemini API image models, reached through AI Connections. Models arrive
 * without the `google:` prefix. Imagen models use a different endpoint and are
 * not listed; Gemini image models take references inline.
 */
export const isImageModel = (id) => id.startsWith('gemini') && id.includes('image')

export const google = {
  id: 'google',
  label: 'Google',
  env: apiKeyNames('google'),

  detect: (key) => key.startsWith('AIza'),

  verify: (key) => verifyByListing({ provider: 'google', label: 'Google', key, isImageModel }),

  listModels: (kind) => (kind === 'video' ? [] : discoverImageModels(google, { isImageModel, acceptsImages: () => true })),

  generateImage({ model, prompt, params = {}, refs = [] }) {
    // Gemini takes every ratio Atelier offers, so the ratio goes as asked.
    const { kept, omitted } = splitParams(params, ['aspect_ratio'])
    const input = kept.aspect_ratio ? { aspectRatio: kept.aspect_ratio } : {}
    return generateWith(google, { model, prompt, input, sent: kept, omitted, refs })
  },
}
