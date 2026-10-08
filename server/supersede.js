/**
 * Retire models that a newer version of the *same thing* has replaced.
 *
 * Derived from the ids, never hardcoded — a hardcoded retire list goes stale
 * exactly the way a hardcoded model list would.
 *
 * The rule is deliberately narrow: a model is superseded only by a higher
 * version at the **same vendor, family and tier**. Tiers are different products,
 * not different generations — flash, pro, max, mini, turbo, lite, vector and
 * utility all coexist on purpose, so none of them ever displaces another.
 *
 *   recraft-v4-vector      → superseded by recraft-v4.1-vector   (same tier)
 *   recraft-v4-pro         → NOT superseded by recraft-v4.1      (tier differs)
 *   gemini-3.1-flash-image → NOT superseded by gemini-3-pro-image (tier differs)
 */

/** Split `vendor/family-<version>-<tier>` into its parts. */
export function parseModelId(id) {
  const [vendor, ...rest] = id.split('/')
  const slug = rest.join('/')

  // A trailing -preview is a stability marker, not a tier.
  const preview = slug.endsWith('-preview')
  const core = preview ? slug.slice(0, -'-preview'.length) : slug

  const tokens = core.split('-')
  for (let i = 0; i < tokens.length; i++) {
    // Matches a bare version (`v4.1`, `3`) or one fused to the family (`flux.2`).
    const m = /^(.*?)\.?v?(\d+(?:\.\d+)*)$/.exec(tokens[i])
    if (!m || !/^\d/.test(m[2])) continue

    // A bare number ending the tier is the version of the *component* the model
    // wraps, not a separate product: `gpt-5.4-image-2` is GPT-5.4 carrying the
    // GPT Image 2 engine, so it shares a tier with `gpt-5-image` (engine 1).
    // A trailing token with letters (`klein-4b`) is a spec, not a version.
    const rawTier = tokens.slice(i + 1).join('-')
    const comp = /^(.*)-(\d+)$/.exec(rawTier)

    return {
      vendor,
      family: [...tokens.slice(0, i), m[1]].filter(Boolean).join('-'),
      version: m[2],
      tier: comp ? comp[1] : rawTier,
      component: comp ? Number(comp[2]) : 1,
      preview,
      core,
    }
  }
  return { vendor, family: core, version: null, tier: '', component: 1, preview, core }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

/**
 * @returns {Map<string, string>} retired id → the id that replaces it
 */
export function findSuperseded(models) {
  const parsed = models.map((m) => ({ id: m.id, ...parseModelId(m.id) }))
  const byId = new Set(models.map((m) => m.id))
  const retired = new Map()

  for (const p of parsed) {
    // A preview is retired the moment its stable twin exists.
    if (p.preview) {
      const stable = `${p.vendor}/${p.core}`
      if (byId.has(stable)) {
        retired.set(p.id, stable)
        continue
      }
    }
    if (!p.version) continue

    // Same vendor, same family, same tier, higher version.
    const newer = parsed
      .filter(
        (q) =>
          q.id !== p.id &&
          !q.preview &&
          q.vendor === p.vendor &&
          q.family === p.family &&
          q.tier === p.tier &&
          q.version &&
          // Newer overall: the model version first, then the wrapped engine.
          (compareVersions(q.version, p.version) > 0 ||
            (compareVersions(q.version, p.version) === 0 && q.component > p.component))
      )
      .sort(
        (a, b) => compareVersions(b.version, a.version) || b.component - a.component
      )[0]

    if (newer) retired.set(p.id, newer.id)
  }

  return retired
}
