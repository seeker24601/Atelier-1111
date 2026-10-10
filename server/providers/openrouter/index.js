import { generateImages, listImageModels } from './images.js'
import { generateVideo, collectVideo, listVideoModels } from './videos.js'
import { verifyKey, account } from './account.js'
import { OPENROUTER_ENV } from '../../settings.js'

/**
 * OpenRouter behind the provider contract (see ../index.js). The client code
 * in this folder is unchanged from v0.1.0; this file only adapts its shape.
 * Models arrive here as OpenRouter's own ids, without the `openrouter:` prefix.
 */
export const openrouter = {
  id: 'openrouter',
  label: 'OpenRouter',
  env: OPENROUTER_ENV,

  detect: (key) => /^sk-or-/.test(key),
  verify: (key) => verifyKey(key),
  account: (opts) => account(opts),

  listModels: (kind, opts) => (kind === 'video' ? listVideoModels(opts) : listImageModels(opts)),

  async generateImage({ model, prompt, n, params = {}, refs = [], onPartial }) {
    const { request, cost, images } = await generateImages({ model, prompt, n, params, inputReferences: refs, onPartial })
    // OpenRouter takes every Atelier param as is: nothing is translated or left out.
    return { request, sent: params, omitted: [], images, cost }
  },

  generateVideo: (options) => generateVideo(options),
  collectVideo: (remoteId, onStatus) => collectVideo(remoteId, onStatus),
}
