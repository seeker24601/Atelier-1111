import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { applyTheme, initialTheme } from '../theme.js'

/**
 * Key state as reported by the server. The key itself never lives here — only
 * whether one is configured, where it came from, and a masked hint.
 */
export function useSettings() {
  const [status, setStatus] = useState({ configured: true, source: null, hint: null })
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  // The key's own ledger at OpenRouter: spend and limit across everything it
  // paid for, not just this app. Null until read, or when there is no key.
  const [account, setAccount] = useState(null)
  // Starts from what the server wrote into the page, so nothing flips on load.
  const [theme, setThemeState] = useState(initialTheme)

  const read = useCallback(async () => {
    try {
      const res = await api.settings.read()
      setStatus(res)
      if (res.theme) setThemeState(res.theme)
    } catch {
      // A settings read failing shouldn't blank the app; leave the last status.
    }
  }, [])

  // Also runs once on mount, which brings the desktop title bar in line.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  /** Applied at once; put back if the server could not save it. */
  const setTheme = useCallback(
    async (next) => {
      const previous = theme
      setThemeState(next)
      try {
        await api.settings.setTheme(next)
      } catch {
        setThemeState(previous)
      }
    },
    [theme]
  )

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

  useEffect(() => {
    if (status.configured) readAccount()
    else setAccount(null)
  }, [status.configured, status.hint, readAccount])

  const saveKey = useCallback(async (key) => {
    setSaving(true)
    setResult(null)
    try {
      const res = await api.settings.saveKey(key)
      setStatus({ configured: res.configured, source: res.source, hint: res.hint })
      setResult({ verified: res.verified, detail: res.detail })
    } catch (e) {
      setResult({ verified: false, detail: e.message })
    } finally {
      setSaving(false)
    }
  }, [])

  const clearKey = useCallback(async () => {
    setResult(null)
    try {
      setStatus(await api.settings.clearKey())
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
    refresh: read,
    account,
    readAccount,
    theme,
    setTheme,
  }
}
