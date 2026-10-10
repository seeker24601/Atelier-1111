import { useState } from 'react'

const GET_A_KEY = {
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
}

/**
 * One slot per provider. Keys are typed here and posted to the local API,
 * which stores them in data/settings.json; the panel only ever sees a masked
 * hint. The active provider is marked; Use makes another keyed provider active.
 */
export default function KeysPanel({ settings }) {
  const { status, result, saving, saveKey, clearKey, setActive, account } = settings
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const usd = (n, places = 2) => (n == null ? '——' : `$${n.toFixed(places)}`)

  async function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    const saved = await saveKey(draft.trim(), editing)
    if (saved) {
      setDraft('')
      setEditing(null)
    }
  }

  return (
    <section className="settings__col">
      <span className="plate-title">Keys</span>

      <div className="proc" style={{ marginTop: 20 }}>
        {(status.providers ?? []).map((p) => (
          <div className="proc__row" key={p.id}>
            <span className="label label--sm dim">
              {p.label}
              {status.active === p.id ? ' · active' : ''}
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span className="data">
                {p.configured ? `${p.hint}${p.source === 'env' ? ' · .env' : ''}` : 'No key'}
              </span>
              {p.configured && status.active !== p.id && (
                <button className="btn btn--sm" disabled={saving} title={`Use ${p.label}'s models`} onClick={() => setActive(p.id)}>
                  Use
                </button>
              )}
              <button
                className="btn btn--sm"
                disabled={saving}
                onClick={() => {
                  setEditing(p.id)
                  setDraft('')
                }}
              >
                {p.configured ? 'Replace' : 'Add'}
              </button>
              {p.source === 'stored' && (
                <button className="btn btn--sm" disabled={saving} title={`Remove the ${p.label} key`} onClick={() => clearKey(p.id)}>
                  ×
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {editing && (
        <form onSubmit={submit} className="stack" style={{ marginTop: 16 }}>
          <input
            className="field"
            type="password"
            aria-label={`${status.providers.find((p) => p.id === editing)?.label} key`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={{ openrouter: 'sk-or-v1-…', openai: 'sk-…', google: 'AIza…' }[editing]}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--commit" type="submit" disabled={saving || !draft.trim()}>
              <span>{saving ? 'Checking…' : 'Save'}</span>
              <span>→</span>
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          <a className="data data--sm dim" href={GET_A_KEY[editing]} target="_blank" rel="noreferrer">
            Get a key ↗
          </a>
        </form>
      )}

      {account && (
        <div className="proc" style={{ marginTop: 16 }}>
          {[
            ['OpenRouter left', account.remaining == null ? 'no limit' : usd(account.remaining)],
            ['Today', usd(account.daily, 3)],
            ['This month', usd(account.monthly)],
            ['All time', usd(account.usage)],
          ].map(([k, v]) => (
            <div className="proc__row" key={k}>
              <span className="label label--sm dim">{k}</span>
              <span className="data">{v}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <p className={result.verified ? 'banner banner--ok' : 'banner banner--err'} style={{ marginTop: 16 }}>
          {result.verified ? `Verified. ${result.detail ?? ''}` : result.detail}
        </p>
      )}
    </section>
  )
}
