import { PARAM_FIELDS } from './params.js'

/**
 * What a model has actually been observed to *produce*, read back from the
 * stored images rather than from what was requested.
 *
 * The capability ledger answers "was this value honoured?" one value at a time.
 * This answers the question above it: does the parameter do anything on this
 * model at all? A model that returns jpeg whatever you ask, or 1024px whatever
 * you ask, is not offering a choice — and a control with no choice in it is
 * worse than no control, because it implies one.
 */

const RATIOS = PARAM_FIELDS.find((f) => f.key === 'aspect_ratio').options
const RESOLUTIONS = { '1K': 1024, '2K': 2048 }

/** Nearest named ratio, or null if the image is not close to one we offer. */
export function ratioOf(w, h) {
  if (!w || !h) return null
  const actual = w / h
  return (
    RATIOS.find((name) => {
      const [rw, rh] = name.split(':').map(Number)
      return Math.abs(actual - rw / rh) / (rw / rh) <= 0.02
    }) || null
  )
}

/**
 * Which resolution bucket the image landed in — same band the server judges by,
 * measured on the equivalent square side (√area) rather than the longest one.
 * Providers hold pixel count roughly constant across ratios, so "2K" at 9:16
 * arrives as 1440×2560: judged on its longest side that reads as overshooting,
 * and 1024×1536 — plainly a 1K image — reads as 2K.
 */
export function resolutionOf(w, h) {
  if (!w || !h) return null
  const side = Math.sqrt(w * h)
  return (
    Object.keys(RESOLUTIONS).find(
      (name) => Math.abs(side - RESOLUTIONS[name]) / RESOLUTIONS[name] <= 0.25
    ) || null
  )
}

const norm = (v) => String(v).toLowerCase().replace('jpg', 'jpeg')

/** What a stored image shows for each parameter, read from the bytes. */
export const OBSERVED_VALUE = {
  output_format: (i) => i.format || null,
  aspect_ratio: (i) => ratioOf(i.width, i.height),
  resolution: (i) => resolutionOf(i.width, i.height),
}

const READS = OBSERVED_VALUE

/**
 * @param {Array} runs images this model has produced
 * @returns {Object} per parameter: what came back, what was asked, and whether
 *   the output is fixed regardless of the request.
 */
export function observe(runs = []) {
  const facts = {}

  for (const field of PARAM_FIELDS) {
    const produced = new Map()
    const asked = new Set()

    for (const img of runs) {
      const got = READS[field.key]?.(img)
      if (got) produced.set(got, (produced.get(got) || 0) + 1)
      // Kept verbatim — "2K" is how the value is written everywhere it is shown.
      const want = img.params?.[field.key]
      if (want) asked.add(String(want))
    }

    const values = [...produced.keys()]
    const only = values.length === 1 ? values[0] : null
    const samples = [...produced.values()].reduce((a, b) => a + b, 0)

    // Fixed only on proof: every image came back the same, across at least two
    // of them, *and* at least one run asked for something else and did not get
    // it. Without the last part this is only the model's default, which a
    // request might still move; without the sample floor one image would be
    // enough to remove a working control.
    const contradicted = [...asked].filter((a) => norm(a) !== norm(only ?? ''))
    const fixed = only && samples >= 2 && contradicted.length ? only : null

    // Ratios (or formats) that were asked for and have never come back.
    const refused = [...asked].filter((a) => !values.some((v) => norm(v) === norm(a)))

    facts[field.key] = { produced, asked, refused, contradicted, fixed, samples }
  }

  return facts
}

/**
 * Parameters worth hiding on this model, with the reason. A control the user
 * cannot change the outcome with is not a control:
 *
 *   fixed — the output is the same value whatever is requested
 *   sole  — every value but one has been measured dead, so nothing is left to pick
 *   dead  — every value has been measured dead
 */
export function silenced(facts, unusable = new Set()) {
  const out = new Map()

  for (const field of PARAM_FIELDS) {
    const fact = facts[field.key]
    if (fact?.fixed) {
      out.set(field.key, { kind: 'fixed', value: fact.fixed, fact })
      continue
    }

    const dead = field.options.filter((opt) => unusable.has(`${field.key}::${opt}`))
    const live = field.options.filter((opt) => !dead.includes(opt))

    if (live.length === 0) {
      out.set(field.key, { kind: 'dead', dead, fact })
      continue
    }

    // One value left is only "always X" if the model has actually produced X.
    // Recraft is the counter-case: with a reference attached it ignores 1K and
    // returns 349×512, which is neither bucket — so 2K survives by never having
    // been tried, and claiming it would state a size the model has never made.
    const corroborated = fact?.produced.has(live[0])
    if (live.length === 1 && corroborated)
      out.set(field.key, { kind: 'sole', value: live[0], dead, fact })
  }

  return out
}
