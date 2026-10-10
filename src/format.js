import { parseModelId } from '../server/modelid.js'
/** Presentation helpers. Data prints as readouts: fixed width, tabular. */

/** 0.0243 → "0.0243" · null → "——" */
export const money = (v) => (v == null ? '——' : v < 0.01 ? v.toFixed(4) : v.toFixed(3))

export const dollars = (v) => (v == null ? '——' : `$${money(v)}`)

/** 2026—08—05T11:38 */
export const stamp = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}—${p(d.getMonth() + 1)}—${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Ids are `<provider>:<model>`. Display and filenames use the model part, so a
 * filename never carries the colon; an OpenRouter model's vendor is its own
 * prefix (`google/…`), another provider's vendor is the provider.
 */
export const shortModel = (id) => (id ? parseModelId(id).model.split('/').pop().toUpperCase() : '——')

export const vendorOf = (id) => {
  if (!id) return '——'
  const { provider, model } = parseModelId(id)
  return (provider === 'openrouter' ? model.split('/')[0] : provider).toUpperCase()
}

export const pad = (n, width = 2) => String(n).padStart(width, '0')

/**
 * Image models ingest raster only. Grok states its set outright — "a valid JPG,
 * PNG, WebP, or ICO image" — and rejects an SVG reference with exactly that
 * message. Vector output from the recraft `-vector` models is therefore usable
 * as a picture but never as a reference.
 */
export const RASTER_REFERENCE = new Set(['png', 'jpeg', 'jpg', 'webp', 'gif', 'ico'])

export function canBeReference(formatOrType) {
  if (!formatOrType) return true // unknown — let the server be the judge
  const sub = String(formatOrType).split('/').pop().split(';')[0].toLowerCase()
  return RASTER_REFERENCE.has(sub)
}

/**
 * OpenRouter quotes per-token rates like 0.00000958. Per million tokens is the
 * readable convention — and the unit these actually are, so it stays honest.
 */
export const perMillion = (rate) => {
  if (rate == null) return '——'
  if (rate === 0) return 'FREE'
  const m = rate * 1e6
  return `$${m < 1 ? m.toFixed(3) : m.toFixed(2)}`
}

export const tokens = (n) =>
  n == null ? '——' : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)

/** OpenRouter's `created` is unix seconds. → "Jul 21, 2026" */
export const releaseDate = (seconds) =>
  seconds == null
    ? '——'
    : new Date(seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })

/**
 * One headline price. A measured per-image average is shown once real runs
 * exist, because that is the number you actually pay; until then the published
 * rate stands on its own rather than being multiplied into a guess.
 */
export function priceLabel({ pricing = {}, measuredAvg = null, kind = 'image' } = {}) {
  if (measuredAvg != null) return `~${dollars(measuredAvg)}/${kind === 'video' ? 'clip' : 'image'}`

  // Every video model reports 0/0, which is not a price of zero — it is the
  // absence of one. Rendering that as FREE next to a clip that cost $0.96 would
  // be the worst kind of wrong, so an unpriced model says so.
  if (kind === 'video') return 'NOT PUBLISHED'

  const rate = pricing.imageOutput ?? pricing.imageToken ?? pricing.completion
  return rate == null ? '——' : `${perMillion(rate)}/M tokens`
}

/**
 * A usable file extension. `media_type` gives "svg+xml", which is not one, and
 * the measured format is truer than the request in any case.
 */
const EXT_ALIAS = { jpeg: 'jpg', 'svg+xml': 'svg' }
export function extensionOf(image) {
  const sub =
    image.format || String(image.media_type || '').split('/')[1]?.split(';')[0]?.toLowerCase()
  return EXT_ALIAS[sub] || String(sub || 'bin').replace(/[^a-z0-9]/g, '') || 'bin'
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'}`
