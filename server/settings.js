import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR } from './paths.js'
import { isQualified, parseModelId } from './modelid.js'

/**
 * What the app remembers between runs, in data/settings.json: one API key per
 * provider, the active provider, the appearance choice, hidden models and
 * image models the user added by id.
 * Which providers exist, and what their keys can do, is server/keys.js.
 *
 * Keys live server-side only. The file is written at mode 0600 and keys are
 * NEVER returned over HTTP — callers get a masked hint and a source, nothing
 * more. An env var acts as a fallback so a .env setup keeps working; the
 * stored key wins when both are present.
 *
 * Keys are stored as `keys: { openrouter, openai, google }`. The OpenRouter key
 * is also written to the v0.1.0 field `openrouterApiKey` for one release, so
 * v0.1.0 still finds it after a downgrade; it is read as a fallback.
 */

const FILE = join(DATA_DIR, 'settings.json')
const LEGACY = { openrouter: 'openrouterApiKey' }
export const OPENROUTER_ENV = ['OPENROUTER_API_KEY']

function read() {
  if (!existsSync(FILE)) return {}
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

function write(next) {
  if (Object.keys(next).length === 0) {
    if (existsSync(FILE)) unlinkSync(FILE)
    return
  }
  writeFileSync(FILE, JSON.stringify(next, null, 2), { mode: 0o600 })
  chmodSync(FILE, 0o600) // an existing file keeps its old mode without this
}

/** The effective key for a provider and where it came from. Stored wins over env. */
export function readKey(provider, envNames = []) {
  const settings = read()
  const stored = settings.keys?.[provider] || (LEGACY[provider] && settings[LEGACY[provider]])
  if (typeof stored === 'string' && stored) return { key: stored, source: 'stored' }
  for (const name of envNames) {
    const value = process.env[name]?.trim()
    if (value) return { key: value, source: 'env' }
  }
  return { key: null, source: null }
}

export function storeKey(provider, key) {
  const trimmed = String(key || '').trim()
  if (!trimmed) throw Object.assign(new Error('Key is empty.'), { status: 400 })
  if (trimmed.length > 4096 || /\s/.test(trimmed)) {
    throw Object.assign(new Error('That does not look like an API key.'), { status: 400 })
  }
  const next = read()
  next.keys = { ...(next.keys || {}), [provider]: trimmed }
  if (LEGACY[provider]) next[LEGACY[provider]] = trimmed
  write(next)
}

/** Clears only the stored key — an env-provided key is not ours to remove. */
export function removeKey(provider) {
  const next = read()
  if (next.keys) {
    delete next.keys[provider]
    if (Object.keys(next.keys).length === 0) delete next.keys
  }
  if (LEGACY[provider]) delete next[LEGACY[provider]]
  if (next.activeProvider === provider) delete next.activeProvider
  write(next)
}

/** OpenRouter's effective key, as its adapter has always read it. */
export const getKey = () => readKey('openrouter', OPENROUTER_ENV).key

/** The provider the user last chose, or null. keys.js falls back when it has no key. */
export const getActive = () => read().activeProvider ?? null

export function setActive(provider) {
  write({ ...read(), activeProvider: provider })
}

/** Last four characters only — enough to tell two keys apart, useless if leaked. */
export function hint(key) {
  return key && key.length > 4 ? `••••${key.slice(-4)}` : null
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

/**
 * Image models the user added by id, qualified (`fal:fal-ai/flux-pro/v1.1`).
 * For providers whose models AI Connections cannot list, and any model a
 * provider's list leaves out.
 */
export function getCustomModels() {
  const ids = read().customModels
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && isQualified(id)) : []
}

export function setCustomModels(ids) {
  const valid = (id) =>
    typeof id === 'string' && id.length <= 200 && isQualified(id) && /^\S+$/.test(parseModelId(id).model)
  if (!Array.isArray(ids) || !ids.every(valid)) {
    throw Object.assign(new Error('Expected a list of model ids, each with a provider and no spaces.'), { status: 400 })
  }
  const next = read()
  const unique = [...new Set(ids)].sort()
  if (unique.length) next.customModels = unique
  else delete next.customModels
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
