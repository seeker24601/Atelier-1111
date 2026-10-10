import { adapters, adapter } from './providers/index.js'
import { readKey, storeKey, removeKey, getActive, setActive, hint, getTheme } from './settings.js'

/**
 * Keys per provider: which are set, which provider is active, and saving a
 * pasted key under the provider it belongs to. Storage is settings.js; what a
 * key can do is each adapter's verify().
 */

export const keyFor = (provider) => readKey(provider, adapter(provider).env).key

/** Proposes the provider a key belongs to, or null. Detection proposes; verify decides. */
export const detectProvider = (key) => adapters().find((a) => a.detect(key))?.id ?? null

/**
 * The provider listing and generation follow: the user's last choice while it
 * has a key, otherwise the first provider that has one, otherwise none.
 */
export function activeProviderId() {
  const chosen = getActive()
  if (chosen && keyFor(chosen)) return chosen
  return adapters().find((a) => keyFor(a.id))?.id ?? null
}

/** Safe to serialise to the client. Contains no secret: a source and a masked hint per provider. */
export function describe() {
  const providers = adapters().map((a) => {
    const { key, source } = readKey(a.id, a.env)
    return { id: a.id, label: a.label, configured: Boolean(key), source, hint: hint(key) }
  })
  const active = activeProviderId()
  const current = providers.find((p) => p.id === active)
  return {
    configured: Boolean(current),
    active,
    // The active provider's, for the readouts that show one key.
    source: current?.source ?? null,
    hint: current?.hint ?? null,
    providers,
    theme: getTheme(),
  }
}

/**
 * Stores a key under its provider (given, or detected), then verifies it. A
 * verified key makes its provider active. Saved first, then checked: a
 * verification outage must not lock the user out.
 */
export async function saveKey(key, provider = null) {
  const trimmed = String(key || '').trim()
  const id = provider ?? detectProvider(trimmed)
  if (!id) {
    throw Object.assign(new Error('Could not tell which provider this key is for. Choose one.'), {
      status: 422,
      choices: adapters().map((a) => ({ id: a.id, label: a.label })),
    })
  }
  const target = adapter(id)
  storeKey(target.id, trimmed)
  const check = await target.verify(trimmed)
  if (check.verified) setActive(target.id)
  return { provider: target.id, verified: check.verified, detail: check.detail }
}

export function deleteKey(provider) {
  removeKey(adapter(provider).id)
}

export function chooseActive(provider) {
  const target = adapter(provider)
  if (!keyFor(target.id)) throw Object.assign(new Error(`Add a ${target.label} key first.`), { status: 400 })
  setActive(target.id)
}
