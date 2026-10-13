import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { applyDarkChrome } from '../theme.js'

/**
 * Key state as reported by the server, per provider. The keys themselves never
 * live here — only which are configured, where each came from, a masked hint,
 * and which provider is active.
 */
export function useSettings() {
  const [status, setStatus] = useState({ configured: true, active: null, source: null, hint: null, providers: [] })
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  // The key's own ledger at OpenRouter: spend and limit across everything it
  // paid for, not just this app. Null until read, or when there is no key.
  const [account, setAccount] = useState(null)

  const read = useCallback(async () => {
    try {
      setStatus(await api.settings.read())
    } catch {
      // A settings read failing shouldn't blank the app; leave the last status.
    }
  }, [])

  // Dark only: bring the desktop title bar in line once.
  useEffect(() => {
    applyDarkChrome()
  }, [])

  const readAccount = useCallback(async (fresh = false) => {
    try {
      setAccount((await api.settings.account(fresh)).account)
    } catch {
      // Offline or OpenRouter down: keep the last figure rather than blank it.
    }
  }, [])

  useEffect(() => {
    read()
  }, [read])

  // Spend and limit are OpenRouter's to report; other providers have no such endpoint.
  const openrouterHint = status.providers?.find((p) => p.id === 'openrouter' && p.configured)?.hint ?? null
  useEffect(() => {
    if (openrouterHint) readAccount()
    else setAccount(null)
  }, [openrouterHint, readAccount])

  /**
   * Saves a key under the provider its prefix names, or under `provider`.
   * A key no provider recognises comes back with `choices` to pick from.
   */
  const saveKey = useCallback(async (key, provider) => {
    setSaving(true)
    setResult(null)
    try {
      const res = await api.settings.saveKey(key, provider)
      setStatus(res)
      setResult({ provider: res.provider, verified: res.verified, unchecked: res.unchecked, detail: res.detail })
      return res
    } catch (e) {
      setResult({ verified: false, detail: e.message, choices: e.body?.choices ?? null })
      return null
    } finally {
      setSaving(false)
    }
  }, [])

  /** Makes a provider with a key the active one: the picker, tabs and generation follow it. */
  const setActive = useCallback(async (provider) => {
    setResult(null)
    try {
      setStatus(await api.settings.setActive(provider))
    } catch (e) {
      setResult({ verified: false, detail: e.message })
    }
  }, [])

  const clearKey = useCallback(async (provider = 'openrouter') => {
    setResult(null)
    try {
      setStatus(await api.settings.clearKey(provider))
    } catch (e) {
      setResult({ verified: false, detail: e.message })
    }
  }, [])

  return {
    status,
    result,
    saving,
    saveKey,
    clearKey,
    setActive,
    refresh: read,
    account,
    readAccount,
  }
}
