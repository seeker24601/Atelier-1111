import { PARAM_FIELDS } from './params.js'
import { OBSERVED_VALUE } from './observed.js'

/**
 * A parameter the model ignores may still be decided by a *different* one.
 *
 * Grok is the case this exists for: `output_format` does nothing, and the
 * format looked arbitrary until the outputs were grouped by size — every 1K
 * render came back jpeg and every 2K render came back png. That is not "no
 * control", it is control through the wrong knob, and it is worth saying so.
 */

/**
 * @returns {{driver: string, map: Array<[string, string]>}|null} the parameter
 *   this one tracks, and the mapping observed — or null if nothing explains it.
 */
export function couplingFor(key, runs = []) {
  const got = (k, img) => OBSERVED_VALUE[k]?.(img) ?? null

  // Nothing to explain unless this parameter actually varied.
  if (new Set(runs.map((i) => got(key, i)).filter(Boolean)).size < 2) return null

  for (const field of PARAM_FIELDS) {
    if (field.key === key) continue

    const map = new Map()
    const seen = new Map()
    let consistent = true

    for (const img of runs) {
      const driver = got(field.key, img)
      const value = got(key, img)
      if (!driver || !value) continue
      if (map.has(driver) && map.get(driver) !== value) {
        consistent = false
        break
      }
      map.set(driver, value)
      seen.set(driver, (seen.get(driver) || 0) + 1)
    }

    // Needs at least two groups that disagree with each other — one group, or
    // several that all produce the same value, explains nothing.
    if (!consistent || map.size < 2) continue
    if (new Set(map.values()).size !== map.size) continue
    // And each group needs corroboration: with one image per group, any two
    // parameters that happened to vary together look like a rule.
    if ([...seen.values()].some((n) => n < 2)) continue

    return { driver: field.key, map: [...map.entries()] }
  }

  return null
}
