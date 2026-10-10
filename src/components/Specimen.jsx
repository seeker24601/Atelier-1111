import { useState } from 'react'

/**
 * The empty gallery. With no key, the key is the only thing worth asking for,
 * so the field is right here; otherwise there is nothing to say — the left
 * column is the procedure. Any supported key works: its prefix names the
 * provider, and a key that names none asks which it is.
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

  async function save(provider) {
    if (!draft.trim()) return
    if (await saveKey(draft.trim(), provider)) setDraft('')
  }

  return (
    <div className="specimen">
      <form
        className="keyform stack"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <span className="plate-title">API key</span>
        <input
          className="field"
          type="password"
          aria-label="API key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="OpenRouter, OpenAI or Google key"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <button className="btn btn--commit" type="submit" disabled={saving || !draft.trim()}>
          <span>{saving ? 'Checking…' : 'Save'}</span>
          <span>→</span>
        </button>
        {result?.choices ? (
          <div className="stack">
            <p className="banner banner--err">{result.detail}</p>
            <div className="row" style={{ gap: 8 }}>
              {result.choices.map((c) => (
                <button key={c.id} type="button" className="btn btn--sm" disabled={saving} onClick={() => save(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          result && !result.verified && <p className="banner banner--err">{result.detail}</p>
        )}
        <span className="data data--sm dim">
          Get one from{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter ↗</a>,{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI ↗</a> or{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google ↗</a>
        </span>
      </form>
    </div>
  )
}
