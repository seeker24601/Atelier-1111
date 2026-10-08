/**
 * Verdicts nothing has measured, reasoned from ones that were.
 *
 * Kept strictly apart from the observed ledger: an inference is a good guess,
 * and the whole point of this app is that guesses about these parameters have
 * been wrong repeatedly. So an inferred dead end is marked and explained but
 * never disabled, and never withholds the parameter.
 *
 * That asymmetry is deliberate. A rejection is a 400 — it generates nothing and
 * bills nothing — so trying an inferred-dead value costs only latency, while a
 * wrong inference that disabled the option could never be corrected, because
 * the run that would disprove it is the one being prevented.
 */

/** 4:3 ⇄ 3:4. Returns null for anything that is not a ratio. */
export function transposeOf(ratio) {
  const [w, h] = String(ratio).split(':')
  return w && h && !Number.isNaN(Number(w)) && !Number.isNaN(Number(h)) ? `${h}:${w}` : null
}

/** The provider's own list, parsed out of whichever rejection carried it. */
function acceptedList(rows, param) {
  for (const row of rows) {
    if (row.param !== param || row.verdict !== 'rejected') continue
    const found = /accepted:\s*([^.]+)/i.exec(row.evidence || '')
    if (found) return found[1].split(',').map((s) => s.trim().toLowerCase())
  }
  return null
}

/**
 * @returns {string|null} why this value is expected to fail, or null if there is
 *   no reason to think so. Only called for values with no measured verdict.
 */
export function inferredDead(param, value, rows = []) {
  const listed = acceptedList(rows, param)
  if (listed && !listed.includes(String(value).toLowerCase()))
    return `the provider listed what it accepts and this is not in it — ${listed.join(', ')}`

  if (param === 'aspect_ratio') {
    const twin = transposeOf(value)
    const refused = rows.find(
      (r) => r.param === param && r.value === twin && r.verdict === 'rejected'
    )
    // Support for a ratio and its transpose is the same capability turned on its
    // side; no provider has yet listed one without the other.
    if (refused && twin !== value) return `${twin} was rejected here, and it is the same shape rotated`
  }

  return null
}
