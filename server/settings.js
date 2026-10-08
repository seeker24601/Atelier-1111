import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './paths.js'

/**
 * What the app remembers between runs: the API key and the appearance choice,
 * both in data/settings.json. What OpenRouter says about the key lives in
 * account.js.
 *
 * The key lives server-side only. It is written at mode 0600 and is NEVER
 * returned over HTTP — callers get a masked hint and a source, nothing more.
 * An env var acts as a fallback so a .env setup keeps working; the stored key
 * wins when both are present.
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
    theme: getTheme(),
  }
}

/**
 * Appearance is kept here rather than in browser storage: the desktop app
 * serves the page from a new port on every launch, and browser storage is per
 * origin, so it would forget the choice each time.
 */
export const THEMES = ['system', 'light', 'dark']

export function getTheme() {
  const theme = read().theme
  return THEMES.includes(theme) ? theme : 'system'
}

/** Model ids the user has chosen not to see in the picker. */
export function getHiddenModels() {
  const ids = read().hiddenModels
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
}

export function setHiddenModels(ids) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id.length > 200)) {
    throw Object.assign(new Error('Expected a list of model ids.'), { status: 400 })
  }
  const next = read()
  const unique = [...new Set(ids)].sort()
  if (unique.length) next.hiddenModels = unique
  else delete next.hiddenModels
  write(next)
  return unique
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    throw Object.assign(new Error(`Theme must be one of ${THEMES.join(', ')}.`), { status: 400 })
  }
  const next = read()
  if (theme === 'system') delete next.theme
  else next.theme = theme
  write(next)
}

export function setKey(key) {
  const trimmed = String(key || '').trim()
  if (!trimmed) throw Object.assign(new Error('Key is empty.'), { status: 400 })
  write({ ...read(), openrouterApiKey: trimmed })
}

/** Clears only the stored key — an env-provided key is not ours to remove. */
export function clearKey() {
  const next = read()
  delete next.openrouterApiKey
  if (Object.keys(next).length === 0) {
    if (existsSync(FILE)) unlinkSync(FILE)
  } else {
    write(next)
  }
}
