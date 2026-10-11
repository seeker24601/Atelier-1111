import { describeRatio } from './imagemeta.js'

/**
 * OpenRouter publishes nothing about aspect_ratio / resolution / output_format /
 * background; its supported_parameters covers chat sampling only. The same
 * models' schemas on fal say what each model takes (server/specs.js), but not
 * what OpenRouter forwards. So capability through OpenRouter is *observed*,
 * and there are two ways a parameter can fail:
 *
 *   rejected — the API returned an error naming it. Loud, and billed nothing.
 *   ignored  — the API returned 200 and quietly did something else. Silent,
 *              billed in full, and only visible by measuring the pixels.
 *
 * A parameter that leaves no observable trace can only ever be caught in the
 * loud case, and is reported as unverifiable rather than assumed to have
 * worked. `quality` was such a parameter and has been dropped from the UI for
 * exactly that reason — an unverifiable control is one you can only trust.
 */

export const VERDICT = {
  OK: 'ok',
  IGNORED: 'ignored',
  REJECTED: 'rejected',
  UNVERIFIABLE: 'unverifiable',
}

const RESOLUTION_PIXELS = { '0.5K': 512, '1K': 1024, '2K': 2048, '4K': 4096 }

/** Which parameters leave evidence in the returned bytes. */
const OBSERVABLE = new Set(['aspect_ratio', 'output_format', 'resolution', 'background'])

/**
 * Compare what was asked for against what came back.
 * @returns {Array<{param, value, verdict, evidence}>}
 */
export function assessOutput(params, meta, reference = null) {
  const out = []

  /**
   * Some models take their geometry from the reference and ignore the request.
   * "Asked 9:16, received 864×1152" reads as an arbitrary substitution; adding
   * "which is the reference's own shape" turns it into a rule you can use.
   */
  const matchesReference = (got) =>
    reference?.width &&
    reference?.height &&
    got &&
    got === describeRatio(reference.width, reference.height)

  for (const [param, value] of Object.entries(params)) {
    if (!OBSERVABLE.has(param)) {
      out.push({
        param,
        value: String(value),
        verdict: VERDICT.UNVERIFIABLE,
        evidence: 'Accepted without error; leaves no trace in the output.',
      })
      continue
    }

    // Without decodable bytes there is no evidence either way — say nothing.
    if (!meta) continue

    if (param === 'output_format') {
      const want = String(value).toLowerCase().replace('jpg', 'jpeg')
      const got = meta.format
      out.push({
        param,
        value: String(value),
        verdict: want === got ? VERDICT.OK : VERDICT.IGNORED,
        evidence: `Asked ${want}, received ${got}.`,
      })
    }

    if (param === 'aspect_ratio') {
      const got = describeRatio(meta.width, meta.height)
      const honoured = got === String(value)
      out.push({
        param,
        value: String(value),
        verdict: honoured ? VERDICT.OK : VERDICT.IGNORED,
        evidence:
          `Asked ${value}, received ${meta.width}×${meta.height}${got ? ` (${got})` : ''}.` +
          (!honoured && matchesReference(got) ? ' That is the reference’s own shape.' : ''),
      })
    }

    if (param === 'resolution') {
      const target = RESOLUTION_PIXELS[String(value).toUpperCase()]
      // Judged on the equivalent square side (√area), not the longest one:
      // providers hold pixel count roughly constant across aspect ratios, so 2K
      // at 9:16 comes back 1440×2560 and 1K at 2:3 comes back 1024×1536. The
      // longest side of either lands in the wrong bucket; the area does not.
      const side = Math.round(Math.sqrt(meta.width * meta.height))
      // Generous band: providers round to their own supported buckets.
      const close = target ? Math.abs(side - target) / target <= 0.25 : false
      out.push({
        param,
        value: String(value),
        verdict: close ? VERDICT.OK : VERDICT.IGNORED,
        evidence: `Asked ${value} (~${target}px), received ${meta.width}×${meta.height} (${side}px square-equivalent).`,
      })
    }

    if (param === 'background') {
      // The header says whether there is an alpha channel, not whether any pixel
      // uses it, so only "transparent and none came back" is a clear miss.
      const want = String(value)
      const unknown = { param, value: want, verdict: VERDICT.UNVERIFIABLE }
      if (meta.alpha == null) {
        out.push({ ...unknown, evidence: `A ${meta.format} header does not say whether it has transparency.` })
      } else if (want === 'transparent') {
        out.push({
          param,
          value: want,
          verdict: meta.alpha ? VERDICT.OK : VERDICT.IGNORED,
          evidence: meta.alpha
            ? `Received ${meta.format} with an alpha channel.`
            : `Received ${meta.format} with no alpha channel: the background is opaque.`,
        })
      } else if (want === 'opaque') {
        out.push(
          meta.alpha
            ? { ...unknown, evidence: 'Received an alpha channel; whether any pixel is transparent is not checked.' }
            : { param, value: want, verdict: VERDICT.OK, evidence: `Received ${meta.format} with no alpha channel.` }
        )
      }
    }
  }

  return out
}
