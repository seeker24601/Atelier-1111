import { apiKeyNames, detectProviders, getProvider } from 'ai-connections/direct'
import { verifyByListing } from './verify.js'
import { discoverImageModels, generateWith, splitParams } from './aiconnections.js'

/**
 * Any image provider AI Connections knows, as an Atelier adapter: xAI, fal,
 * Replicate, Black Forest Labs, Luma, ByteDance and Prodia. OpenRouter, OpenAI
 * and Google keep adapters of their own, for what only they have (cost,
 * previews and video; OpenAI's sizes; Google's references).
 *
 * Images only. AI Connections waits for a video to finish, and Atelier's video
 * jobs must survive a restart, so video stays with OpenRouter for now.
 */
export function catalogAdapter(id) {
  const provider = getProvider(id)
  if (!provider?.media?.image) throw new Error(`AI Connections has no image provider "${id}".`)
  // Providers that cannot list models have only AI Connections' suggestions to show,
  // and no free call that proves a key.
  const listable = provider.discovery !== 'manual'

  const self = {
    id,
    label: provider.name,
    env: apiKeyNames(id),

    // Only a prefix no other provider shares names the provider (xai-, r8_). Any other
    // key is saved under the provider the user picks.
    detect: (key) => {
      const ids = detectProviders(key)
      return ids.length === 1 && ids[0] === id
    },

    verify: (key) =>
      listable
        ? verifyByListing({ provider: id, label: provider.name, key })
        : {
            verified: false,
            unchecked: true,
            detail: `Saved. ${provider.name} has no free way to check a key, so the first image will show whether it works.`,
          },

    // Whether a model takes reference images is unknown here, so none are offered.
    listModels: (kind) => (kind === 'video' ? [] : discoverImageModels(self, { acceptsImages: () => false })),

    generateImage({ model, prompt, params = {}, refs = [] }) {
      // The ratio goes as asked; a model that refuses one says so, and the ledger records it.
      const { kept, omitted } = splitParams(params, ['aspect_ratio'])
      const input = kept.aspect_ratio ? { aspectRatio: kept.aspect_ratio } : {}
      return generateWith(self, { model, prompt, input, sent: kept, omitted, refs })
    },
  }
  return self
}
