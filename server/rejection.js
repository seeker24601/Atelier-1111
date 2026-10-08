/**
 * Reading a provider's complaint.
 *
 * A rejection is the only capability signal that costs nothing, so it is worth
 * parsing carefully — and it has been wrong in both directions already:
 * over-blaming (reading OpenRouter's "requested parameter(s)" list, which names
 * everything sent) and under-blaming (missing Seedream's requirement wording,
 * which never says "unsupported"). Both mistakes disable working controls or
 * hide broken ones, so this file is covered by rejection.test.js.
 */

/** Words a provider might use for each parameter when complaining about it. */
const ALIASES = {
  aspect_ratio: ['aspect_ratio', 'aspectratio', 'aspect ratio'],
  output_format: ['output_format', 'outputformat', 'output format', 'response_format'],
  resolution: ['resolution', 'size', 'image_size'],
  n: ['n', 'num_images', 'number of images'],
  // Video-only, and the ones providers complain about most.
  duration: ['duration', 'length'],
  generate_audio: ['generate_audio', 'audio'],
}

/**
 * Parameters the error message blames. Only ones actually sent are considered,
 * so a stray word in an unrelated message can't manufacture a verdict.
 */
export function paramsBlamedBy(message, sentParams) {
  const text = String(message || '').toLowerCase()

  // OpenRouter's provider rejection lists everything you sent, then names the
  // actual culprit separately:
  //
  //   "...requested parameter(s): resolution "2K", aspect_ratio "1:1", ...
  //    Provider rejections: Krea: resolution: not supported. Accepted: 1K"
  //
  // Only the second half identifies the fault. Reading the first half blames
  // every parameter in the request and records working ones as rejected.
  const scope = text.split('provider rejections:')[1] ?? text

  return Object.keys(sentParams).filter((param) =>
    (ALIASES[param] || [param]).some((alias) => scope.includes(alias))
  )
}

/**
 * Providers often state what they *would* have accepted — "resolution: not
 * supported. Accepted: 1K". That is the most useful half of the message, so it
 * is pulled out and kept with the verdict.
 */
export function acceptedValuesFor(message, param) {
  const text = String(message || '')
  const scope = text.split(/provider rejections:/i)[1] ?? text
  for (const alias of ALIASES[param] || [param]) {
    // "resolution: not supported. Accepted: 1K"
    const listed = new RegExp(`${alias}[^.]*?\\.\\s*accepted:\\s*([^.]+)`, 'i').exec(scope)
    if (listed) return listed[1].trim()
    // "Use a larger resolution such as "2K", or omit resolution to use the default."
    const suggested = new RegExp(`${alias}[^."]*?such as\\s*"([^"]+)"`, 'i').exec(scope)
    if (suggested) return suggested[1].trim()
    // Video providers publish the whole set instead, either as a list or a
    // bracketed array: "Supported durations: 5, 10s" / "are [8] for feature ...".
    const supported = new RegExp(
      `supported\\s+${alias}s?\\s*(?:are)?\\s*[:\\[]\\s*([^.\\]]+)`,
      'i'
    ).exec(scope)
    if (supported) return supported[1].trim()
  }
  return null
}

/**
 * Did the request look like a parameter complaint rather than a real failure?
 *
 * Not every provider says "unsupported". Seedream states a requirement instead —
 * "requires at least 3,686,400 output pixels; size "1024x576" is 589,824. Use a
 * larger resolution such as "2K"" — which is a rejection of the value sent, and
 * was missed while the list only covered refusal wording.
 */
export function looksLikeParamRejection(message) {
  const text = String(message || '').toLowerCase()
  return [
    'unsupported',
    'not supported',
    'invalid',
    'unknown parameter',
    'unexpected',
    'unrecognized',
    'does not support',
    'requires at least',
    'must be at least',
    'use a larger',
    'too small',
    'too large',
  ].some((phrase) => text.includes(phrase))
}
