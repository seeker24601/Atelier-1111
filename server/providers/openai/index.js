import { apiKeyNames } from '@ai-connections/core/direct'
import { verifyByListing, notYet } from '../verify.js'

/** OpenAI image models, reached through AI Connections. Models arrive without the `openai:` prefix. */
export const isImageModel = (id) => /^(gpt-image|dall-e)/.test(id)

export const openai = {
  id: 'openai',
  label: 'OpenAI',
  env: apiKeyNames('openai'),

  // `sk-or-` is OpenRouter's; every other `sk-` key is OpenAI's, admin keys included.
  detect: (key) => key.startsWith('sk-') && !key.startsWith('sk-or-'),

  async verify(key) {
    if (key.startsWith('sk-admin-')) {
      return { verified: false, detail: 'This is an OpenAI admin key, which cannot generate images. Use a project key.' }
    }
    return verifyByListing({
      provider: 'openai',
      label: 'OpenAI',
      key,
      isImageModel,
      requirement: 'OpenAI may require organization verification before the first image; the first generation will say so.',
    })
  },

  listModels: async () => [],
  generateImage: async () => {
    throw notYet('OpenAI')
  },
}
