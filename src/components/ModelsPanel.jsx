import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const KINDS = ['image', 'video']

/**
 * Every model OpenRouter lists, with a box per model: checked shows it in the
 * picker, unchecked hides it. The hidden list is the server's, covering both
 * kinds, so changing one tab never forgets the other.
 */
export default function ModelsPanel({ onChange }) {
  const [kind, setKind] = useState('image')
  const [lists, setLists] = useState({})
  const [hidden, setHiddenIds] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    api.settings
      .hiddenModels()
      .then(({ ids }) => setHiddenIds(new Set(ids)))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (lists[kind]) return
    api
      .models({ kind, all: true })
      .then(({ models }) => setLists((l) => ({ ...l, [kind]: models })))
      .catch((e) => setError(e.message))
  }, [kind, lists])

  const models = lists[kind] || []
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? models.filter((m) => m.id.toLowerCase().includes(q)) : models
  }, [models, query])

  if (!hidden) return null
  const hiddenHere = models.filter((m) => hidden.has(m.id)).length

  async function setHidden(ids, hide) {
    const next = new Set(hidden)
    for (const id of ids) hide ? next.add(id) : next.delete(id)
    setHiddenIds(next)
    try {
      await api.settings.setHiddenModels([...next])
      setError(null)
      onChange?.()
    } catch (e) {
      setHiddenIds(hidden)
      setError(e.message)
    }
  }

  const ids = shown.map((m) => m.id)

  return (
    <section className="settings__col">
      <span className="plate-title">Models</span>

      <div className="seg" role="group" aria-label="Model kind" style={{ marginTop: 20 }}>
        {KINDS.map((k) => (
          <button key={k} className="seg__opt" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>

      <input
        className="field"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter"
        style={{ marginTop: 8 }}
      />

      <div className="row row--between" style={{ marginTop: 8 }}>
        <span className="data data--sm dim">
          {models.length - hiddenHere} of {models.length} shown
        </span>
        <span className="row">
          <button className="btn btn--sm" onClick={() => setHidden(ids, false)}>
            Show all
          </button>
          <button className="btn btn--sm" onClick={() => setHidden(ids, true)}>
            Hide all
          </button>
        </span>
      </div>

      <ul className="modellist" style={{ marginTop: 8 }}>
        {shown.map((m) => {
          const off = hidden.has(m.id)
          return (
            <li key={m.id}>
              <button
                className="modellist__row"
                aria-pressed={!off}
                onClick={() => setHidden([m.id], !off)}
                title={m.supersededBy ? `A newer version exists: ${m.supersededBy}` : m.name}
              >
                <span className={`mark ${off ? '' : 'mark--on'}`} />
                <span className="data truncate">{m.id}</span>
                {m.supersededBy && (
                  <span className="data data--sm dim">newer: {m.supersededBy.split('/').pop()}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="banner banner--err" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}
