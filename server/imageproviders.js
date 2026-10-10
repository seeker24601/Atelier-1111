import { apiKeyNames, createImage, providers } from '@ai-connections/core/direct'
import { describeProviderKey, getProviderKey } from './settings.js'

/**
 * Image providers other than OpenRouter, reached through AI Connections with
 * the user's own key for each. Their models are named `provider:model`
 * (`fal:fal-ai/flux/dev`); OpenRouter ids always have a `/` before any colon
 * (`vendor/model:free`), so the two never collide.
 *
 * AI Connections' image call takes a prompt, an aspect ratio, and a seed. It
 * has no streaming previews, cost, reference images, resolution, or format, so
 * those stay OpenRouter features and the models say so (acceptsImages: false).
 */

export const IMAGE_PROVIDERS = providers.filter((p) => p.media?.image)
const BY_ID = new Map(IMAGE_PROVIDERS.map((p) => [p.id, p]))

/** Atelier's request params that AI Connections can send, and the names it uses. */
const SENDABLE = { aspect_ratio: 'aspectRatio', seed: 'seed' }

export function isDirectModel(id) {
  const colon = String(id).indexOf(':')
  if (colon <= 0) return false
  const prefix = id.slice(0, colon)
  return !prefix.includes('/') && BY_ID.has(prefix)
}

const keyFor = (id) => getProviderKey(id, apiKeyNames(id))

/** Safe for the client: names, status and a masked hint, never a key. */
export function describeImageProviders() {
  return IMAGE_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    env: apiKeyNames(p.id),
    ...describeProviderKey(p.id, apiKeyNames(p.id)),
  }))
}

export const isImageProvider = (id) => BY_ID.has(id)

/**
 * Curated suggestions for every provider with a key, shaped like the
 * OpenRouter entries so the picker, readout and hide list treat them alike.
 * Unknown facts (price, context, release date) are null, as they are for any
 * OpenRouter model that does not state them.
 */
export function listDirectImageModels() {
  return IMAGE_PROVIDERS.filter((p) => keyFor(p.id).key).flatMap((p) =>
    p.media.image.models.map((model) => ({
      id: `${p.id}:${model}`,
      name: `${p.name}: ${model}`,
      provider: p.id,
      inputs: ['text'],
      acceptsImages: false,
      modality: 'text->image',
      tokenizer: null,
      moderated: null,
      created: null,
      contextLength: null,
      maxCompletionTokens: null,
      pricing: {
        prompt: null, completion: null, image: null, imageOutput: null,
        imageToken: null, webSearch: null, cacheRead: null,
      },
      nativeResolution: null,
      supersededBy: null,
    }))
  )
}

/**
 * One image through AI Connections. Returns the same shape as
 * openrouter.generateImages plus `sent`, the params actually sent: the rest are
 * dropped rather than failed, and named in `unsent` so the job can say so.
 */
export async function generateDirectImage({ model, prompt, params = {}, inputReferences = [], fetch }) {
  if (inputReferences.length) {
    throw Object.assign(new Error('This provider does not take reference images in Atelier yet.'), { status: 400 })
  }
  const provider = model.slice(0, model.indexOf(':'))
  const { key } = keyFor(provider)
  if (!key) {
    const names = apiKeyNames(provider)
    throw Object.assign(
      new Error(`No ${BY_ID.get(provider)?.name ?? provider} key. Add one in Settings${names.length ? ` or set ${names[0]}` : ''}.`),
      { status: 401 }
    )
  }

  const input = { prompt }
  const sent = {}
  const unsent = []
  for (const [param, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (SENDABLE[param]) {
      input[SENDABLE[param]] = value
      sent[param] = value
    } else unsent.push(param)
  }

  try {
    const result = await createImage(model, input, { apiKey: key, ...(fetch ? { fetch } : {}) })
    return {
      request: { model, ...input },
      sent,
      unsent,
      cost: null,
      images: [{ b64: result.base64, mediaType: result.mediaType }],
      warnings: result.warnings ?? [],
    }
  } catch (err) {
    // Provider messages arrive unchanged in direct mode, so rejection parsing
    // and the capability ledger work the same as for OpenRouter. The name and
    // status lead, since some providers say no more than "Unauthorized".
    const error = err instanceof Error ? err : new Error(String(err))
    if (typeof err?.statusCode === 'number') {
      error.message = `${BY_ID.get(provider)?.name ?? provider} returned HTTP ${err.statusCode}: ${error.message}`
    }
    throw Object.assign(error, {
      status: err?.statusCode ?? err?.status ?? 502,
      request: { model, ...input },
    })
  }
}
