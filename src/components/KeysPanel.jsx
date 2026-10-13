import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import Plate from './ui/Plate.jsx'
import Logo from './ui/Logo.jsx'
import { markForProvider } from '../makers.js'

// Where each provider issues keys. A provider missing here simply shows no link.
export const GET_A_KEY = {
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
  xai: 'https://console.x.ai',
  fal: 'https://fal.ai/dashboard/keys',
  replicate: 'https://replicate.com/account/api-tokens',
  wavespeed: 'https://wavespeed.ai/accesskey',
  higgsfield: 'https://console.higgsfield.ai',
}
// Higgsfield's key is its key id and secret together.
export const PLACEHOLDER = { openrouter: 'sk-or-v1-…', openai: 'sk-…', google: 'AIza…', xai: 'xai-…', replicate: 'r8_…', higgsfield: 'KEY_ID:KEY_SECRET' }

/**
 * Providers with a key get a row; the rest wait under "Add a service" as their
 * marks, so ten providers do not mean ten empty rows. Keys are typed here and
 * posted to the local API, which stores them in data/settings.json; the panel
 * only ever sees a masked hint. One service is active at a time; Use switches.
 */
export default function KeysPanel({ settings }) {
  const { status, result, saving, saveKey, clearKey, setActive, account } = settings
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const usd = (n, places = 2) => (n == null ? '——' : `$${n.toFixed(places)}`)
  const providers = status.providers ?? []
  // A row stays while it is being edited, so adding a key never makes the form jump.
  const rows = providers.filter((p) => p.configured)
  const addable = providers.filter((p) => !p.configured)
  const label = (id) => providers.find((p) => p.id === id)?.label ?? id

  function edit(id) {
    setEditing(editing === id ? null : id)
    setDraft('')
  }

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
    <Plate id="01 / Keys" right={`${rows.length} saved`}>
      {rows.length > 0 && (
        <div className="keys">
          {rows.map((p) => (
            <div className="key" key={p.id}>
              <Logo id={markForProvider(p.id)} />
              <span className="key__name">
                <b>{p.label}</b>
                {status.active === p.id && <span className="label key__on">Active</span>}
                <span className="data dim truncate">
                  {p.hint}
                  {p.source === 'env' ? ' · .env' : ''}
                </span>
              </span>
              {status.active !== p.id && (
                <button className="btn" disabled={saving} title={`Use ${p.label}'s models`} onClick={() => setActive(p.id)}>
                  Use
                </button>
              )}
              <button className="btn" disabled={saving} onClick={() => edit(p.id)}>
                Replace
              </button>
              {p.source === 'stored' && (
                <button className="btn btn--icon" disabled={saving} aria-label={`Remove the ${p.label} key`} onClick={() => clearKey(p.id)}>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="settings__note">One service is active at a time; its models fill the picker. Keys stay on this computer.</p>

      {editing && (
        <form onSubmit={submit} className="keyform">
          <label className="label" htmlFor="keyfield">
            {rows.some((p) => p.id === editing) ? `Replace the ${label(editing)} key` : `${label(editing)} key`}
          </label>
          <input
            id="keyfield"
            className="field field--mono"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={PLACEHOLDER[editing] ?? `${label(editing)} key`}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <div className="row">
            <button className="btn btn--ink" type="submit" disabled={saving || !draft.trim()}>
              {saving ? 'Checking' : 'Save key'}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <span className="spacer" />
            {GET_A_KEY[editing] && (
              <a className="data inline-icon" href={GET_A_KEY[editing]} target="_blank" rel="noreferrer">
                Get a key
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </div>
        </form>
      )}

      {addable.length > 0 && (
        <div className="stack-sm">
          <span className="label dim">Add a service</span>
          <div className="svcs" role="group" aria-label="Add a service">
            {addable.map((p) => (
              <button key={p.id} className="svc" aria-pressed={editing === p.id} disabled={saving} onClick={() => edit(p.id)}>
                <Logo id={markForProvider(p.id)} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {account && (
        <dl className="facts" aria-label="OpenRouter account">
          <dt>OpenRouter left</dt>
          <dd>{account.remaining == null ? 'no limit' : usd(account.remaining)}</dd>
          <dt>Today</dt>
          <dd>{usd(account.daily, 3)}</dd>
          <dt>This month</dt>
          <dd>{usd(account.monthly)}</dd>
          <dt>All time</dt>
          <dd>{usd(account.usage)}</dd>
        </dl>
      )}

      {result && (
        <p className={result.verified || result.unchecked ? 'banner banner--ok' : 'banner banner--err'}>
          {result.verified ? `Key works. ${result.detail ?? ''}` : result.detail}
        </p>
      )}
    </Plate>
  )
}
