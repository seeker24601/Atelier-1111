import { useState } from 'react'

/**
 * The empty gallery. With no key, the key is the only thing worth asking for,
 * so the field is right here; otherwise there is nothing to say — the left
 * column is the procedure.
 */
export default function Specimen({ kind = 'image', settings }) {
  const [draft, setDraft] = useState('')
  const { status, result, saving, saveKey } = settings

  if (status.configured) {
    return (
      <div className="specimen">
        <span className="plate-title dim">No {kind === 'video' ? 'clips' : 'images'} yet</span>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    await saveKey(draft.trim())
    setDraft('')
  }

  return (
    <div className="specimen">
      <form className="keyform stack" onSubmit={submit}>
        <span className="plate-title">OpenRouter key</span>
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
        <button className="btn btn--commit" type="submit" disabled={saving || !draft.trim()}>
          <span>{saving ? 'Checking…' : 'Save'}</span>
          <span>→</span>
        </button>
        {result && !result.verified && <p className="banner banner--err">{result.detail}</p>}
        <a className="data data--sm dim" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
          Get a key ↗
        </a>
      </form>
    </div>
  )
}
