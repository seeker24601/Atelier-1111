/**
 * Panel 04 options from a model's published spec (server/specs.js): what the
 * same model's schema on fal says it takes.
 *
 * A published list is the provider's own word, so it narrows the choices the
 * way an enumerated rejection does, and adds values the static list never had
 * (21:9, 4K). A setting the schema does not have at all is flagged, not
 * removed: OpenRouter may still map it, and the ledger will show whether it
 * did. With no spec, nothing changes.
 */

const ratioValue = (r) => {
  const [w, h] = r.split(':').map(Number)
  return w / h
}
const kValue = (r) => Number.parseFloat(r)
const FORMAT_ORDER = ['png', 'jpeg', 'webp', 'svg']

// Which spec list answers which parameter.
const LIST = {
  aspect_ratio: 'aspect_ratios',
  resolution: 'resolutions',
  output_format: 'output_formats',
  background: 'backgrounds',
}

/** The values a model publishes for a parameter, cleaned for the control; null when it publishes none. */
export function published(spec, key) {
  const list = spec?.[LIST[key]]
  if (!Array.isArray(list)) return null
  switch (key) {
    case 'aspect_ratio':
      // Tallest to widest, like the static row, so it still reads as a shape gradient.
      return list.length ? [...list].sort((a, b) => ratioValue(a) - ratioValue(b)) : null
    case 'resolution': {
      // Only the K scale this control speaks; fal's own presets such as 512sq are left out.
      const ks = list.filter((r) => /^\d+(\.\d+)?K$/.test(r)).sort((a, b) => kValue(a) - kValue(b))
      return ks.length ? ks : null
    }
    case 'output_format':
      return list.length ? [...list].sort((a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b)) : null
    case 'background': {
      // "auto" is what leaving the switch off already means.
      const bg = list.filter((b) => b !== 'auto')
      return bg.length ? bg : null
    }
    default:
      return null
  }
}

/** The options panel 04 offers for a field on this model. */
export function optionsFor(field, spec) {
  const list = published(spec, field.key)
  if (!list) return field.options
  // A model that takes any ratio keeps the usual row, plus any ratio it names beyond it.
  if (field.key === 'aspect_ratio' && spec.any_ratio) {
    const extra = list.filter((r) => !field.options.includes(r))
    return [...field.options, ...extra].sort((a, b) => ratioValue(a) - ratioValue(b))
  }
  return list
}

/** Background is offered only to models that publish a transparent one. */
export const offersBackground = (spec) => Boolean(published(spec, 'background')?.includes('transparent'))

/** A note for a setting the model's schema does not have, or null. */
export function unpublishedFlag(field, spec) {
  if (!spec?.source || field.key === 'background') return null
  const list = spec[LIST[field.key]]
  const missing = list === null || (field.key === 'aspect_ratio' && !list?.length && !spec.any_ratio)
  if (!missing) return null
  return {
    text: 'not in schema',
    title: `${spec.source.endpoint} on fal has no ${field.text.toLowerCase()} setting, so OpenRouter may ignore it.`,
  }
}

/**
 * The current choices this model does not publish, as `param::value`: the
 * same shape as the ledger's unusable values, so the composer withholds them.
 */
export function unpublishedChoices(params, spec, fields) {
  const out = new Set()
  if (!spec) return out
  for (const field of fields) {
    const value = params[field.key]
    if (value === undefined) continue
    const offered = field.key === 'background' && !offersBackground(spec) ? [] : optionsFor(field, spec)
    if (!offered.includes(value)) out.add(`${field.key}::${value}`)
  }
  return out
}

/** How many reference images a model publishes it takes: a number, or null when it states no limit. */
export function publishedReferenceLimit(spec) {
  const refs = spec?.references
  if (!refs || refs.accepted !== true) return null
  return typeof refs.max === 'number' ? refs.max : null
}
