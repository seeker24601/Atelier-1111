import { listImageModels, attribution } from './images.js'
import { generateVideo, collectVideo, listVideoModels } from './videos.js'
import { verifyKey, account } from './account.js'
import { OPENROUTER_ENV } from '../../settings.js'
import { generateWith } from '../aiconnections.js'

/**
 * OpenRouter behind the provider contract (see ../index.js). Images go through
 * AI Connections, which streams previews and reports the cost; video, the
 * model index and the account stay on Atelier's own client in this folder.
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

  generateImage({ model, prompt, params = {}, refs = [], onPartial }) {
    // OpenRouter takes every Atelier param as is: nothing is translated or left out.
    const extra = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    return generateWith(openrouter, {
      model, prompt, extra, headers: attribution(), sent: params, omitted: [], refs, onPartial,
    })
  },

  generateVideo: (options) => generateVideo(options),
  collectVideo: (remoteId, onStatus) => collectVideo(remoteId, onStatus),
}
