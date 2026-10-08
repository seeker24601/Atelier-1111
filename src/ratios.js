/**
 * Which aspect ratios a model will actually draw.
 *
 * An unusable ratio is dropped from the picker rather than shown struck
 * through: a shape the model cannot make is not a choice, and seven options
 * where two are dead is harder to read than five that all work.
 *
 * Only the provider's own evidence removes an option:
 *
 *   measured   it was asked for and refused, or accepted and overridden
 *   enumerated the provider published its legal set in a rejection —
 *              "Accepted: 1:1, 4:3, 3:4, 16:9, 9:16, auto"
 *
 * Our own reasoning does not. The transpose rule is a good guess and stays
 * visible with its mark, because hiding a guess makes it unfalsifiable: the
 * run that would disprove it is the one being removed.
 */

/** "1:1, 4:3, 3:4, 16:9, 9:16, auto" → the set, minus non-ratio words. */
export function parseAccepted(list) {
  if (!list) return null
  const values = String(list)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^\d+:\d+$/.test(s))
  return values.length ? new Set(values) : null
}

/**
 * @param {{key: string, options: string[]}} field
 * @param {(param: string, value: string) => {verdict: string}|null} verdictFor
 * @param {(param: string) => string|null} acceptedFor
 * @returns {string[]} the options worth offering
 */
export function offerableOptions(field, verdictFor, acceptedFor) {
  if (field.key !== 'aspect_ratio') return field.options

  const accepted = parseAccepted(acceptedFor?.(field.key))

  const offerable = field.options.filter((opt) => {
    const seen = verdictFor?.(field.key, opt)
    if (seen?.verdict === 'rejected' || seen?.verdict === 'ignored') return false
    if (accepted && !accepted.has(opt.toLowerCase())) return false
    return true
  })

  // If the evidence rules out everything, the parameter is dead and is handled
  // upstream; an empty control here would just be a broken row.
  return offerable.length ? offerable : field.options
}
