import { apiKeyNames } from '@ai-connections/core/direct'
import { verifyByListing } from '../verify.js'
import { discoverImageModels, generateWith, splitParams } from '../aiconnections.js'

/** OpenAI image models, reached through AI Connections. Models arrive without the `openai:` prefix. */
export const isImageModel = (id) => /^(gpt-image|dall-e)/.test(id)
// GPT Image models take reference images (edits); DALL·E models do not here.
const acceptsImages = (id) => id.startsWith('gpt-image')

/**
 * OpenAI offers three sizes, not ratios. A requested ratio becomes the size of
 * the same orientation, and `sent` records the ratio that size really is, so
 * the ledger judges what OpenAI was asked for: 16:9 is sent as 1536x1024, 3:2.
 */
export function sizeFor(aspectRatio) {
  const [w, h] = String(aspectRatio).split(':').map(Number)
  if (!(w > 0 && h > 0) || w === h) return { size: '1024x1024', ratio: '1:1' }
  return w > h ? { size: '1536x1024', ratio: '3:2' } : { size: '1024x1536', ratio: '2:3' }
}

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

  listModels: (kind) => (kind === 'video' ? [] : discoverImageModels(openai, { isImageModel, acceptsImages })),

  generateImage({ model, prompt, params = {}, refs = [] }) {
    const { kept, omitted } = splitParams(params, ['aspect_ratio'])
    const input = {}
    const sent = {}
    if (kept.aspect_ratio) {
      const { size, ratio } = sizeFor(kept.aspect_ratio)
      input.size = size
      sent.aspect_ratio = ratio
    }
    return generateWith(openai, { model, prompt, input, sent, omitted, refs })
  },
}
