import { parseModelId } from '../modelid.js'
import { openrouter } from './openrouter/index.js'
import { openai } from './openai/index.js'
import { google } from './google/index.js'

/**
 * The provider registry. Everything outside server/providers/ reaches a
 * provider through here; nothing imports an adapter's files directly
 * (providers.test.js enforces that).
 *
 * The contract every adapter meets:
 *   id, label, env (key variables, in order)
 *   detect(key) → boolean        the key looks like this provider's
 *   verify(key) → { verified, detail }
 *   account?(opts)               spend and limit, where the provider reports them
 *   listModels(kind, opts) → models with the provider's own ids
 *   generateImage({ model, prompt, n, params, refs, onPartial })
 *     → { request, sent, omitted, images, cost }
 *       sent: the params actually sent, after translation
 *       omitted: params this provider does not offer
 *       cost: null when the provider reports none
 *   generateVideo?(options), collectVideo?(remoteId, onStatus)
 */

// Order is the detection order and the fallback order for the active provider.
const ADAPTERS = [openrouter, openai, google]
const BY_ID = new Map(ADAPTERS.map((a) => [a.id, a]))

export const adapters = () => ADAPTERS

export function adapter(id) {
  const found = BY_ID.get(id)
  if (!found) throw Object.assign(new Error(`No provider "${id}".`), { status: 400 })
  return found
}

/** The adapter for a qualified model id, and the id that adapter expects. */
export function resolve(modelId) {
  const { provider, model } = parseModelId(modelId)
  return { adapter: adapter(provider), model }
}

/** The provider listing and generation follow. One provider until per-provider keys arrive. */
export const activeProvider = () => openrouter
