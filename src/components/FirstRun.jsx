import { useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import Logo from './ui/Logo.jsx'
import { markForProvider } from '../makers.js'
import { GET_A_KEY, PLACEHOLDER } from './KeysPanel.jsx'

/**
 * As the server decides: only a prefix no other service shares names the
 * service. Shown as you type; the server checks again on save.
 */
function recognise(key) {
  const k = key.trim()
  if (/^sk-or-/.test(k)) return 'openrouter'
  if (/^sk-/.test(k)) return 'openai'
  if (/^AIza/.test(k)) return 'google'
  if (/^xai-/.test(k)) return 'xai'
  if (/^r8_/.test(k)) return 'replicate'
  return null
}

const FALLBACK = ['openrouter', 'openai', 'google', 'xai', 'fal', 'replicate', 'bfl', 'luma', 'bytedance', 'prodia', 'higgsfield', 'wavespeed']

/**
 * The first screen: no bar, the name as the background, one field. Every
 * service Atelier takes a key for is shown as its mark; the one the key belongs
 * to lights up. A key that could be several asks which, right there.
 */
export default function FirstRun({ settings }) {
  const { status, result, saving, saveKey } = settings
  const [draft, setDraft] = useState('')
  const [shown, setShown] = useState(false)
  const [picked, setPicked] = useState(null)

  const services = status.providers?.length
    ? status.providers.map((p) => ({ id: p.id, label: p.label }))
    : FALLBACK.map((id) => ({ id, label: id }))
  const labelOf = (id) => services.find((s) => s.id === id)?.label ?? id
  const choices = result?.choices?.map((c) => c.id) ?? null

  const found = draft.trim() ? recognise(draft) : null
  const provider = found || picked
  const asking = Boolean(choices && !picked)

  async function save(chosen = provider) {
    if (!draft.trim()) return
    const res = await saveKey(draft.trim(), chosen ?? undefined)
    if (res) setDraft('')
  }

  let statusText = 'Paste a key from any service below.'
  let statusClass = 'status'
  if (saving) statusText = 'Checking the key'
  else if (result && !result.verified && !result.unchecked && !choices) {
    statusText = result.detail
    statusClass = 'status status--ask'
  } else if (asking) {
    statusText = 'This key could belong to several services. Which one is it for?'
    statusClass = 'status status--ask'
  } else if (provider && draft.trim()) {
    statusText = found ? `Recognised: ${labelOf(found)} key` : `Saving as a ${labelOf(picked)} key`
    statusClass = 'status status--found'
  }
  const getId = provider || 'openrouter'

  return (
    <div className="first">
      <div className="first__backdrop" aria-hidden="true">
        Atelier 1111
      </div>
      <main className="first__center">
        <form
          className="first__card"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="first__head">
            <h1 className="plate-title">
              <span className="sr">Atelier 1111: </span>Paste a key
            </h1>
            <p className="first__lede">
              Atelier runs on <b>your own API key</b> from any of the services below. It stays on this computer and is only ever sent
              to the service it belongs to.
            </p>
          </div>

          <div className="stack-sm">
            <label className="sr" htmlFor="firstkey">
              API key
            </label>
            <div className="keyrow">
              <input
                id="firstkey"
                className="keyrow__input"
                type={shown ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder={PLACEHOLDER[provider] ?? 'sk-or-v1-…'}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  setPicked(null)
                }}
              />
              <button className="keyrow__show" type="button" aria-pressed={shown} onClick={() => setShown(!shown)}>
                {shown ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={statusClass} role="status">
              {statusClass === 'status status--found' && <Logo id={markForProvider(provider)} />}
              <span>{statusText}</span>
            </div>
          </div>

          <div className="svcs" role="group" aria-label="Services">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`svc${asking && choices.includes(s.id) ? ' svc--ask' : ''}`}
                aria-pressed={provider === s.id}
                disabled={saving}
                onClick={() => {
                  setPicked(s.id)
                  if (asking && choices.includes(s.id)) save(s.id)
                }}
              >
                <Logo id={markForProvider(s.id)} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="first__foot">
            <p className="data dim">
              No key yet?{' '}
              <a className="inline-icon" href={GET_A_KEY[getId] ?? GET_A_KEY.openrouter} target="_blank" rel="noreferrer">
                Get one from {GET_A_KEY[getId] ? labelOf(getId) : 'OpenRouter'}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </p>
            <button className={`go${saving ? ' go--wait' : ''}`} type="submit" disabled={saving || !draft.trim()}>
              <span>{saving ? 'Checking' : 'Save key'}</span>
              {saving ? <span className="wait" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
