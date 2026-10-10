import { createImage, listModels } from '@ai-connections/core/direct'
import { readKey } from '../settings.js'

/**
 * What the OpenAI and Google adapters share: both reach their provider through
 * AI Connections' direct mode with the user's key. Each adapter keeps only
 * what is its own: which models make images, and how Atelier's params map.
 */

const NO_PRICE = {
  prompt: null, completion: null, image: null, imageOutput: null,
  imageToken: null, webSearch: null, cacheRead: null,
}

const keyOf = (adapter) => readKey(adapter.id, adapter.env).key

/**
 * Image models the key can see, discovered from the provider's own list (no
 * hardcoded ids) and shaped like OpenRouter entries so the picker, readout and
 * hide list treat them alike. Unknown facts are null. No key, no models.
 */
export async function discoverImageModels(adapter, { isImageModel, acceptsImages }) {
  const key = keyOf(adapter)
  if (!key) return []
  const listed = await listModels(adapter.id, { apiKey: key })
  return listed
    .filter((m) => isImageModel(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      inputs: acceptsImages(m.id) ? ['text', 'image'] : ['text'],
      acceptsImages: acceptsImages(m.id),
      modality: acceptsImages(m.id) ? 'text+image->image' : 'text->image',
      tokenizer: null,
      moderated: null,
      created: null,
      contextLength: null,
      maxCompletionTokens: null,
      pricing: NO_PRICE,
      nativeResolution: null,
      supersededBy: null,
    }))
}

/**
 * One image through AI Connections. `input` is the already-translated
 * request; `sent` and `omitted` are the adapter's account of it. References
 * make the request an edit. Neither provider reports a cost, so cost is null.
 */
export async function generateWith(adapter, { model, prompt, input, sent, omitted, refs = [] }) {
  const key = keyOf(adapter)
  if (!key) {
    throw Object.assign(new Error(`No ${adapter.label} key. Add one in Settings.`), { status: 401 })
  }
  const request = { model, prompt, ...input, ...(refs.length ? { references: refs.length } : {}) }
  try {
    const result = await createImage(`${adapter.id}:${model}`, { prompt, ...input, ...(refs.length ? { images: refs } : {}) }, { apiKey: key })
    return {
      request,
      sent,
      omitted,
      images: [{ b64: result.base64, mediaType: result.mediaType }],
      cost: null,
    }
  } catch (err) {
    // Direct mode passes the provider's own message through, so rejection
    // parsing and the ledger work as they do for OpenRouter. Name and status lead.
    const error = err instanceof Error ? err : new Error(String(err))
    if (typeof err?.statusCode === 'number') {
      error.message = `${adapter.label} returned HTTP ${err.statusCode}: ${error.message}`
    }
    throw Object.assign(error, { status: err?.statusCode ?? err?.status ?? 502, request })
  }
}

/** Splits Atelier's params into those an adapter sends and those it does not offer. */
export function splitParams(params, offered) {
  const kept = {}
  const omitted = []
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue
    if (offered.includes(k)) kept[k] = v
    else omitted.push(k)
  }
  return { kept, omitted }
}
