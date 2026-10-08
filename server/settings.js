import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './paths.js'

/**
 * The API key lives server-side only. It is written to data/settings.json at
 * mode 0600 and is NEVER returned over HTTP — callers get a masked hint and a
 * source, nothing more. An env var acts as a fallback so a .env setup keeps
 * working; the stored key wins when both are present.
 */

const FILE = join(DATA_DIR, 'settings.json')

function read() {
  if (!existsSync(FILE)) return {}
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function write(next) {
  writeFileSync(FILE, JSON.stringify(next, null, 2), { mode: 0o600 })
  chmodSync(FILE, 0o600) // an existing file keeps its old mode without this
}

/** Effective key, or null. Stored key takes precedence over the environment. */
export function getKey() {
  return read().openrouterApiKey || process.env.OPENROUTER_API_KEY || null
}

export function getSource() {
  if (read().openrouterApiKey) return 'stored'
  if (process.env.OPENROUTER_API_KEY) return 'env'
  return null
}

/** Last four characters only — enough to tell two keys apart, useless if leaked. */
function hint(key) {
  return key && key.length > 4 ? `••••${key.slice(-4)}` : null
}

/** Safe to serialise to the client. Contains no secret. */
export function describe() {
  const key = getKey()
  return {
    configured: Boolean(key),
    source: getSource(),
    hint: hint(key),
  }
}

export function setKey(key) {
  const trimmed = String(key || '').trim()
  if (!trimmed) throw Object.assign(new Error('Key is empty.'), { status: 400 })
  write({ ...read(), openrouterApiKey: trimmed })
  forgetAccount()
}

/** Clears only the stored key — an env-provided key is not ours to remove. */
export function clearKey() {
  forgetAccount()
  const next = read()
  delete next.openrouterApiKey
  if (Object.keys(next).length === 0) {
    if (existsSync(FILE)) unlinkSync(FILE)
  } else {
    write(next)
  }
}

/**
 * Ask OpenRouter whether the key is real. Used after a save so a typo surfaces
 * immediately rather than on the first generation.
 */
export async function verifyKey(key) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 401 || res.status === 403) {
      return { verified: false, detail: 'OpenRouter rejected this key.' }
    }
    if (!res.ok) {
      return { verified: false, detail: `Could not verify (HTTP ${res.status}).` }
    }
    const body = await res.json().catch(() => ({}))
    const label = body?.data?.label
    const limit = body?.data?.limit
    return {
      verified: true,
      detail: [label && `Key "${label}"`, limit != null && `limit $${limit}`]
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
 * matters when it is your money. Cached briefly — the topbar polls it, and
 * the figure moves only when a job settles.
 */
let cached = { at: 0, key: null, value: null }
const ACCOUNT_TTL_MS = 30_000

export async function account({ fresh = false } = {}) {
  const key = getKey()
  if (!key) return null
  if (!fresh && cached.key === key && Date.now() - cached.at < ACCOUNT_TTL_MS) return cached.value

  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  })
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
    freeTier: Boolean(d.is_free_tier),
  }
  cached = { at: Date.now(), key, value }
  return value
}

export const forgetAccount = () => {
  cached = { at: 0, key: null, value: null }
}
