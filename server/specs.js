import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseModelId } from './modelid.js'

/**
 * What each OpenRouter image model declares it accepts, from
 * openrouter-image-specs (the same model's published schema on fal), bundled
 * in server/specs/ and refreshed with scripts/sync-specs.mjs.
 *
 * It is the model's own published set, not proof OpenRouter forwards every
 * option, so the ledger still records what each request actually did.
 */
const FILE = join(dirname(fileURLToPath(import.meta.url)), 'specs', 'openrouter-image-specs.json')
const { models } = JSON.parse(readFileSync(FILE, 'utf8'))

/** The published spec for a qualified model id, or null. Only OpenRouter models have one. */
export function specFor(id) {
  const { provider, model } = parseModelId(id)
  const spec = provider === 'openrouter' ? models[model] : null
  if (!spec) return null
  const source = spec.sources?.[0]
  return {
    aspect_ratios: spec.aspect_ratios,
    any_ratio: spec.any_ratio,
    resolutions: spec.resolutions,
    output_formats: spec.output_formats,
    backgrounds: spec.backgrounds,
    references: spec.references,
    source: source ? { provider: source.provider, endpoint: source.endpoint, url: source.url } : null,
  }
}
