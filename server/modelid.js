/**
 * Model identity is `<provider>:<model>` everywhere it is stored or sent over
 * the API: `openrouter:google/gemini-3-pro-image`, `openai:gpt-image-2`.
 *
 * Parsing matches only the known providers and splits on the first colon, so
 * OpenRouter ids that contain colons of their own (`vendor/model:free`) keep
 * them. An id with no known prefix is a pre-0.2 OpenRouter id.
 */

/** Image providers reached through AI Connections' catalog (server/providers/catalog.js). */
export const CATALOG_PROVIDERS = ['xai', 'fal', 'replicate', 'bfl', 'luma', 'bytedance', 'prodia']
export const PROVIDERS = ['openrouter', 'openai', 'google', ...CATALOG_PROVIDERS]
export const DEFAULT_PROVIDER = 'openrouter'

const PREFIX = new RegExp(`^(${PROVIDERS.join('|')}):`)

export function parseModelId(id) {
  const text = String(id ?? '')
  const match = PREFIX.exec(text)
  return match
    ? { provider: match[1], model: text.slice(match[0].length) }
    : { provider: DEFAULT_PROVIDER, model: text }
}

export const isQualified = (id) => PREFIX.test(String(id ?? ''))

/** Qualifies a bare id as OpenRouter's; an already qualified id is returned unchanged. */
export function qualify(id, provider = DEFAULT_PROVIDER) {
  return isQualified(id) ? String(id) : `${provider}:${id}`
}

/** The id OpenRouter's own API expects. Throws for another provider's model. */
export function openrouterModel(id) {
  const { provider, model } = parseModelId(id)
  if (provider !== 'openrouter') {
    throw Object.assign(new Error(`${id} is not an OpenRouter model.`), { status: 400 })
  }
  return model
}
