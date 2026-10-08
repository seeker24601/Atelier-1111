import { useEffect, useState } from 'react'
import StoragePanel from './StoragePanel.jsx'

/**
 * The key is typed here and posted straight to the local API, which stores it
 * at data/settings.json. It is never held in browser storage and never comes
 * back over the wire — the panel only ever sees a masked hint.
 */
export default function SettingsPanel({ open, onClose, settings, storage }) {
  const [draft, setDraft] = useState('')
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const { status, result, saving, saveKey, clearKey, account } = settings
  const usd = (n, places = 2) => (n == null ? '——' : `$${n.toFixed(places)}`)
  const editing = !status.configured || replacing

  async function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    await saveKey(draft.trim())
    setDraft('')
    setReplacing(false)
  }

  return (
    <div className="detail">
      <header className="detail__head">
        <span className="plate__id">Settings</span>
        <button className="btn btn--ghost btn--sm" onClick={onClose} title="Esc">
          ×
        </button>
      </header>

      <div className="settings">
        <section className="settings__col">
          <span className="plate-title">OpenRouter key</span>

          {status.configured && (
            <div className="proc proc--state" style={{ marginTop: 20 }}>
              {[
                ['Key', `${status.hint}${status.source === 'env' ? ' · .env' : ''}`],
                ...(account
                  ? [
                      ['Remaining', account.remaining == null ? 'no limit' : usd(account.remaining)],
                      ['Today', usd(account.daily, 3)],
                      ['This month', usd(account.monthly)],
                      ['All time', usd(account.usage)],
                    ]
                  : []),
              ].map(([k, v]) => (
                <div className="proc__row" key={k}>
                  <span className="label label--sm dim">{k}</span>
                  <span className="data">{v}</span>
                </div>
              ))}
            </div>
          )}

          {editing ? (
            <form onSubmit={submit} className="stack" style={{ marginTop: 20 }}>
              <input
                className="field"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-or-v1-…"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn--commit" type="submit" disabled={saving || !draft.trim()}>
                  <span>{saving ? 'Checking…' : 'Save'}</span>
                  <span>→</span>
                </button>
                {replacing && (
                  <button type="button" className="btn btn--ghost" onClick={() => setReplacing(false)}>
                    Cancel
                  </button>
                )}
              </div>
              <a className="data data--sm dim" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                Get a key ↗
              </a>
            </form>
          ) : (
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setReplacing(true)}>
                <span>Replace</span>
                <span>↺</span>
              </button>
              {status.source === 'stored' && (
                <button className="btn btn--ghost" style={{ flex: 1 }} onClick={clearKey}>
                  <span>Remove</span>
                  <span>×</span>
                </button>
              )}
            </div>
          )}

          {result && (
            <p className={result.verified ? 'banner banner--ok' : 'banner banner--err'} style={{ marginTop: 16 }}>
              {result.verified ? 'Verified' : result.detail}
            </p>
          )}
        </section>

        <StoragePanel {...storage} />
      </div>
    </div>
  )
}
