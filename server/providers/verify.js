import { listModels } from '@ai-connections/core/direct'

/**
 * Key checks for providers reached through AI Connections. Listing models is
 * free and proves the key; it cannot prove image access, so the result names
 * the image models the key can see and any access step the provider is known
 * to require before the first image.
 */
export async function verifyByListing({ provider, label, key, requirement }) {
  try {
    const images = (await listModels(provider, { apiKey: key, kind: 'image' })).map((m) => m.id)
    if (!images.length) {
      return { verified: false, detail: `${label} accepted the key, but it lists no image model.` }
    }
    return {
      verified: true,
      detail: [`Key accepted. Image models: ${images.join(', ')}.`, requirement].filter(Boolean).join(' '),
    }
  } catch (err) {
    const status = /HTTP (\d{3})/.exec(String(err?.message))?.[1]
    if (status === '400' || status === '401' || status === '403') {
      return { verified: false, detail: `${label} rejected this key (HTTP ${status}).` }
    }
    return { verified: false, detail: `Could not verify with ${label}: ${err?.message ?? err}` }
  }
}
