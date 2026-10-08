import { describeRatio } from './imagemeta.js'
import { VERDICT } from './capabilities.js'

/**
 * What the returned clip says about the parameters that were sent.
 *
 * The video endpoint validates its own input and names the legal values, which
 * the images endpoint never has — but validation only proves a value was
 * *accepted*. Every silent-override case from the image side applies here too,
 * and video costs roughly a hundred times more per attempt, so the file is
 * measured rather than trusted.
 */

/** "720p" names the short side; "2K" names the square-equivalent, as for images. */
const SHORT_SIDE = { '480p': 480, '720p': 720, '768p': 768, '1080p': 1080 }
const SQUARE = { '1K': 1024, '2K': 2048, '4K': 4096 }

function resolutionFinding(value, meta) {
  const asked = String(value)
  const short = Math.min(meta.width, meta.height)
  const square = Math.round(Math.sqrt(meta.width * meta.height))

  const target = SHORT_SIDE[asked] ?? SQUARE[asked.toUpperCase()]
  if (!target) return null

  const got = SHORT_SIDE[asked] ? short : square
  const close = Math.abs(got - target) / target <= 0.15
  return {
    param: 'resolution',
    value: asked,
    verdict: close ? VERDICT.OK : VERDICT.IGNORED,
    evidence: `Asked ${asked} (~${target}px), received ${meta.width}×${meta.height}.`,
  }
}

function durationFinding(value, meta) {
  const asked = Number(value)
  if (!Number.isFinite(asked) || meta.seconds == null) return null
  // Providers round to the lengths they support — Veo returns 8s whatever is
  // asked — so a second either way is not a substitution.
  const close = Math.abs(meta.seconds - asked) <= Math.max(1, asked * 0.2)
  return {
    param: 'duration',
    value: String(value),
    verdict: close ? VERDICT.OK : VERDICT.IGNORED,
    evidence: `Asked ${asked}s, received ${meta.seconds}s.`,
  }
}

/**
 * @returns {Array<{param, value, verdict, evidence}>}
 */
export function assessVideo(params, meta) {
  if (!meta) return []
  const out = []

  for (const [param, value] of Object.entries(params)) {
    if (param === 'aspect_ratio') {
      const got = describeRatio(meta.width, meta.height)
      out.push({
        param,
        value: String(value),
        verdict: got === String(value) ? VERDICT.OK : VERDICT.IGNORED,
        evidence: `Asked ${value}, received ${meta.width}×${meta.height}${got ? ` (${got})` : ''}.`,
      })
    }

    if (param === 'resolution') {
      const finding = resolutionFinding(value, meta)
      if (finding) out.push(finding)
    }

    if (param === 'duration') {
      const finding = durationFinding(value, meta)
      if (finding) out.push(finding)
    }

    if (param === 'generate_audio') {
      // Checkable, unlike most flags: a silent file carries no sound track.
      //
      // Parsed, not coerced: the control sends strings, and `Boolean('false')`
      // is true — which recorded every "no audio" request as having asked for
      // audio and inverted the verdict on all of them.
      const asked = value === true || value === 'true'
      out.push({
        param,
        value: String(asked),
        verdict: meta.audio === asked ? VERDICT.OK : VERDICT.IGNORED,
        evidence: `Asked ${asked ? 'audio' : 'no audio'}, received ${
          meta.audio ? 'a sound track' : 'a silent file'
        }.`,
      })
    }
  }

  return out
}
