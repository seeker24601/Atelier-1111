import { apiKeyNames } from '@ai-connections/core/direct'
import { verifyByListing, notYet } from '../verify.js'

/** Gemini API image models, reached through AI Connections. Models arrive without the `google:` prefix. */
export const isImageModel = (id) => /image/.test(id)

export const google = {
  id: 'google',
  label: 'Google',
  env: apiKeyNames('google'),

  detect: (key) => key.startsWith('AIza'),

  verify: (key) => verifyByListing({ provider: 'google', label: 'Google', key, isImageModel }),

  listModels: async () => [],
  generateImage: async () => {
    throw notYet('Google')
  },
}
