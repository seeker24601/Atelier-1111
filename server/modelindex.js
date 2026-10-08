import { call, readError } from './http.js'
import { findSuperseded } from './supersede.js'

/**
 * The model catalogue, per output modality.
 *
 * `/models` unfiltered does not include video models at all — the modality
 * filter is the only way to see them — so each modality is fetched and cached
 * separately rather than derived from one list.
 */

const BASE = 'https://openrouter.ai/api/v1'
const TTL = 10 * 60 * 1000

const cache = new Map()

/** OpenRouter reports every rate as a string; keep numbers, drop the rest. */
const rate = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function fetchModels(modality, { force = false, decorate = (m) => m } = {}) {
  const hit = cache.get(modality)
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data

  // Public endpoint — no key needed, so the picker renders before setup.
  const res = await call(`${BASE}/models?output_modalities=${modality}`)
  if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status })

  const { data } = await res.json()
  const models = data
    .filter((m) => !m.id.startsWith('openrouter/auto'))
    .map((m) =>
      decorate(
        {
          id: m.id,
          name: m.name || m.id,
          inputs: m.architecture?.input_modalities || [],
          acceptsImages: (m.architecture?.input_modalities || []).includes('image'),
          modality: m.architecture?.modality || null,
          tokenizer: m.architecture?.tokenizer || null,
          moderated: m.top_provider?.is_moderated ?? null,
          created: m.created ?? null,
          contextLength: m.top_provider?.context_length ?? m.context_length ?? null,
          maxCompletionTokens: m.top_provider?.max_completion_tokens ?? null,
          pricing: {
            prompt: rate(m.pricing?.prompt),
            completion: rate(m.pricing?.completion),
            image: rate(m.pricing?.image),
            imageOutput: rate(m.pricing?.image_output),
            imageToken: rate(m.pricing?.image_token),
            webSearch: rate(m.pricing?.web_search),
            cacheRead: rate(m.pricing?.input_cache_read),
          },
        },
        m
      )
    )
    .sort((a, b) => a.id.localeCompare(b.id))

  // Marked, never dropped: Settings points these out so they are easy to hide,
  // but whether to see them is the user's call.
  const retired = findSuperseded(models)
  for (const m of models) m.supersededBy = retired.get(m.id) ?? null
  if (retired.size) {
    console.log(`[models:${modality}] ${retired.size} superseded, ${models.length - retired.size} current`)
  }

  cache.set(modality, { at: Date.now(), data: models })
  return models
}
