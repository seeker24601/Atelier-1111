import { useEffect, useState } from 'react'
import { api } from '../api.js'

/**
 * Keys for image providers other than OpenRouter, reached through AI
 * Connections. Only providers with a key are listed; the rest sit in one
 * picker, so nine providers cost one row until they are used. Keys go to the
 * local API and never come back — the panel sees a masked hint.
 */
export default function ImageProvidersPanel({ onModelsChange }) {
  const [providers, setProviders] = useState([])
  const [editing, setEditing] = useState(null) // provider id whose key form is open
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api.settings
      .providers()
      .then((res) => setProviders(res.providers))
      .catch((e) => setMessage({ ok: false, text: e.message }))
  }, [])

  const listed = providers.filter((p) => p.configured || p.id === editing)
  const addable = providers.filter((p) => !p.configured && p.id !== editing)
  const nameOf = (id) => providers.find((p) => p.id === id)?.name ?? id

  async function apply(change, text) {
    setBusy(true)
    setMessage(null)
    try {
      setProviders((await change()).providers)
      setMessage({ ok: true, text })
      setEditing(null)
      setDraft('')
      onModelsChange?.()
    } catch (e) {
      setMessage({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    if (!draft.trim()) return
    const id = editing
    apply(
      () => api.settings.saveProviderKey(id, draft.trim()),
      `${nameOf(id)} key saved. Its models are in the picker; the key is checked on first use.`
    )
  }

  return (
    <section className="settings__col">
      <span className="plate-title">Image providers</span>
      <p className="data data--sm dim" style={{ marginTop: 12 }}>
        Your own keys for providers beyond OpenRouter. No streaming preview, cost or references for these yet.
      </p>

      {listed.length > 0 && (
        <div className="proc" style={{ marginTop: 16 }}>
          {listed.map((p) => (
            <div className="proc__row" key={p.id}>
              <span className="label label--sm dim">{p.name}</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="data">
                  {p.configured ? `${p.hint ?? 'set'}${p.source === 'env' ? ' · .env' : ''}` : 'new'}
                </span>
                {p.configured && (
                  <button className="btn btn--sm" disabled={busy} onClick={() => { setEditing(p.id); setDraft('') }}>
                    Replace
                  </button>
                )}
                {p.source === 'stored' && (
                  <button
                    className="btn btn--sm"
                    disabled={busy}
                    onClick={() => apply(() => api.settings.clearProviderKey(p.id), `${p.name} key removed.`)}
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <form onSubmit={save} className="stack" style={{ marginTop: 16 }}>
          <input
            className="field"
            type="password"
            aria-label={`${nameOf(editing)} API key`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`${nameOf(editing)} key`}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--commit" type="submit" disabled={busy || !draft.trim()}>
              <span>{busy ? 'Saving…' : 'Save'}</span>
              <span>→</span>
            </button>
            <button type="button" className="btn" onClick={() => { setEditing(null); setDraft('') }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {addable.length > 0 && !editing && (
        <label className="select-wrap" style={{ marginTop: 16 }}>
          <select
            className="select"
            aria-label="Add an image provider"
            value=""
            disabled={busy}
            onChange={(e) => {
              if (!e.target.value) return
              setEditing(e.target.value)
              setDraft('')
              setMessage(null)
            }}
          >
            <option value="">Add a provider — {addable.length} available</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {message && (
        <p className={message.ok ? 'banner banner--ok' : 'banner banner--err'} style={{ marginTop: 16 }}>
          {message.text}
        </p>
      )}
    </section>
  )
}
