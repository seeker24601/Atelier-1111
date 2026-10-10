import { createImage, listModels } from 'ai-connections/direct'
import { readKey } from '../settings.js'
import { call, REQUEST_TIMEOUT_MS } from '../http.js'

/**
 * What the adapters share: each reaches its provider through AI Connections'
 * direct mode with the user's key. Each adapter keeps only what is its own:
 * which models make images, and how Atelier's params map.
 */

export const NO_PRICE = {
  prompt: null, completion: null, image: null, imageOutput: null,
  imageToken: null, webSearch: null, cacheRead: null,
}

const keyOf = (adapter) => readKey(adapter.id, adapter.env).key

/**
 * Every image model the provider lists for this key, as AI Connections reports
 * it, shaped like OpenRouter entries so the picker, readout and hide list treat
 * them alike. Atelier adds no filter of its own: the user hides what they do
 * not want. AI Connections says which models take references; the adapter's
 * own rule covers a model it does not know. Unknown facts are null. No key, no models.
 */
export async function discoverImageModels(adapter, { acceptsImages }) {
  const key = keyOf(adapter)
  if (!key) return []
  const listed = await listModels(adapter.id, { apiKey: key, kind: 'image' })
  return listed.map((m) => {
    const refs = m.acceptsImages ?? acceptsImages(m.id)
    return {
      id: m.id,
      name: m.name || m.id,
      inputs: refs ? ['text', 'image'] : ['text'],
      acceptsImages: refs,
      modality: refs ? 'text+image->image' : 'text->image',
      tokenizer: null,
      moderated: null,
      created: m.created ?? null,
      contextLength: m.contextLength ?? null,
      maxCompletionTokens: null,
      pricing: NO_PRICE,
      nativeResolution: null,
      supersededBy: null,
    }
  })
}

/**
 * One image through AI Connections. `input` is the already-translated
 * request and `extra` the provider's own fields, sent as they are; `sent` and
 * `omitted` are the adapter's account of it. References make the request an
 * edit. Cost is what the provider reports (OpenRouter), else null.
 * Requests go through Atelier's own transport, for its deadline and its
 * legible connection errors.
 */
export async function generateWith(adapter, { model, prompt, input = {}, extra, headers, sent, omitted, refs = [], onPartial }) {
  const key = keyOf(adapter)
  if (!key) {
    throw Object.assign(new Error(`No ${adapter.label} key. Add one in Settings.`), { status: 401 })
  }
  const request = { model, prompt, ...input, ...extra, ...(refs.length ? { references: refs.length } : {}) }
  try {
    const result = await createImage(
      `${adapter.id}:${model}`,
      { prompt, ...input, ...(refs.length ? { images: refs } : {}) },
      {
        apiKey: key,
        fetch: call,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // Vector models return SVG. Atelier serves files and previews sandboxed
        // and never content-sniffed (server/index.js, routes/output.js).
        allowSvg: true,
        ...(extra ? { providerOptions: { [adapter.id]: extra } } : {}),
        ...(headers ? { headers } : {}),
        ...(onPartial ? { onPartial: (p) => onPartial({ b64: p.base64, mediaType: p.mediaType, index: p.index }) } : {}),
      },
    )
    return {
      request,
      sent,
      omitted,
      images: [{ b64: result.base64, mediaType: result.mediaType }],
      cost: result.cost ?? null,
    }
  } catch (err) {
    // A ProviderError leads with the provider and status and keeps the
    // provider's own words, so rejection parsing and the ledger read it as is.
    // A transport failure keeps the status Atelier's own transport gave it.
    const error = err instanceof Error ? err : new Error(String(err))
    throw Object.assign(error, { status: err?.status ?? err?.cause?.status ?? 502, request })
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
