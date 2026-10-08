import { getKey } from './settings.js'

/**
 * The key as OpenRouter sees it: whether it is real, and what it has spent
 * and has left. Both come from the same endpoint.
 */

const KEY_URL = 'https://openrouter.ai/api/v1/key'

const fetchKey = (key) =>
  fetch(KEY_URL, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })

/**
 * Ask OpenRouter whether the key is real. Used after a save so a typo surfaces
 * immediately rather than on the first generation.
 */
export async function verifyKey(key) {
  try {
    const res = await fetchKey(key)
    if (res.status === 401 || res.status === 403) {
      return { verified: false, detail: 'OpenRouter rejected this key.' }
    }
    if (!res.ok) {
      return { verified: false, detail: `Could not verify (HTTP ${res.status}).` }
    }
    const data = (await res.json().catch(() => ({})))?.data || {}
    return {
      verified: true,
      detail:
        [data.label && `Key "${data.label}"`, data.limit != null && `limit $${data.limit}`]
          .filter(Boolean)
          .join(' · ') || 'Key accepted.',
    }
  } catch (err) {
    return { verified: false, detail: `Could not reach OpenRouter: ${err.message}` }
  }
}

/**
 * What the key itself has spent and has left, as OpenRouter counts it.
 *
 * The local spend figure only knows about this app's generations; the key's
 * own ledger knows about everything billed to it, which is the number that
 * matters when it is your money. Cached briefly per key — the top bar polls
 * it, and the figure moves only when a job settles. Keying the cache by the
 * key means a replaced or removed key can never be answered from it.
 */
let cached = { at: 0, key: null, value: null }
const TTL_MS = 30_000

export async function account({ fresh = false } = {}) {
  const key = getKey()
  if (!key) return null
  if (!fresh && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.value

  const res = await fetchKey(key)
  if (!res.ok) throw Object.assign(new Error(`OpenRouter answered HTTP ${res.status}.`), { status: 502 })
  const d = (await res.json().catch(() => ({})))?.data || {}
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const value = {
    label: d.label ?? null,
    limit: num(d.limit),
    remaining: num(d.limit_remaining),
    reset: d.limit_reset ?? null,
    usage: num(d.usage),
    daily: num(d.usage_daily),
    monthly: num(d.usage_monthly),
  }
  cached = { at: Date.now(), key, value }
  return value
}
