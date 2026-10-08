/**
 * Facts a vendor states in prose but not in any structured field.
 *
 * Output resolution is the one that matters: it is a property of the model, not
 * something the `resolution` parameter can ask for. Recraft's `-pro` tiers *are*
 * the 2K tiers; Grok offers a choice. Knowing this before committing is worth
 * more than a control that gets silently ignored.
 */

/**
 * "image output at ~2K resolution across…"  → "~2K"
 * "outputs at 1K or 2K across a…"           → "1K or 2K"
 *
 * @returns {string|null} as the vendor phrases it, or null when unstated
 */
export function nativeResolution(description) {
  const text = String(description || '')

  const pair = /\b(?:at|to)\s+(~?\d+ ?K)\s+or\s+(~?\d+ ?K)\b/i.exec(text)
  if (pair) return `${tidy(pair[1])} or ${tidy(pair[2])}`

  const single = /\b(~?\d+ ?K)\s+resolution\b/i.exec(text) || /\bat\s+(~?\d+ ?K)\b/i.exec(text)
  if (single) return tidy(single[1])

  return null
}

const tidy = (s) => s.replace(/\s+/g, '').toUpperCase().replace('~', '~')
