import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { parseModelId } from '../../server/modelid.js'

const KINDS = ['image', 'video']

/**
 * Every model the active provider lists, with a box per model: checked shows
 * it in the picker, unchecked hides it. The hidden list is the server's,
 * covering both kinds, so changing one tab never forgets the other.
 *
 * "Add a model" takes an image model id the list does not have. fal, Replicate
 * and the other providers AI Connections cannot list arrive with only a few
 * suggestions, so this is how the rest of their models get in.
 */
export default function ModelsPanel({ provider, onChange }) {
  const [kind, setKind] = useState('image')
  const [lists, setLists] = useState({})
  const [hidden, setHiddenIds] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)
  const [custom, setCustom] = useState([])
  const [adding, setAdding] = useState('')

  useEffect(() => {
    api.settings
      .hiddenModels()
      .then(({ ids }) => setHiddenIds(new Set(ids)))
      .catch((e) => setError(e.message))
    api.settings
      .customModels()
      .then(({ ids }) => setCustom(ids))
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

  async function saveCustom(next) {
    try {
      setCustom((await api.settings.setCustomModels(next)).ids)
      setError(null)
      setLists({}) // refetch: the list now includes or drops the model
      onChange?.()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  async function addModel(e) {
    e.preventDefault()
    const model = adding.trim()
    if (!model || !provider) return
    if (await saveCustom([...custom, `${provider.id}:${model}`])) setAdding('')
  }

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
            <li key={m.id} className={m.custom ? 'modellist__custom' : undefined}>
              <button
                className="modellist__row"
                aria-pressed={!off}
                onClick={() => setHidden([m.id], !off)}
                title={m.supersededBy ? `A newer version exists: ${m.supersededBy}` : m.name}
              >
                <span className={`mark ${off ? '' : 'mark--on'}`} />
                <span className="data truncate">{parseModelId(m.id).model}</span>
                {m.supersededBy && (
                  <span className="data data--sm dim">newer: {m.supersededBy.split('/').pop()}</span>
                )}
                {m.custom && <span className="data data--sm dim">added</span>}
              </button>
              {m.custom && (
                <button
                  className="btn btn--sm"
                  title={`Remove ${parseModelId(m.id).model}`}
                  onClick={() => saveCustom(custom.filter((id) => id !== m.id))}
                >
                  ×
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {kind === 'image' && provider && (
        <form onSubmit={addModel} className="row" style={{ gap: 8, marginTop: 12 }}>
          <input
            className="field"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder={`Add a ${provider.label} model id`}
            aria-label={`Add a ${provider.label} image model by id`}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="btn btn--sm" type="submit" disabled={!adding.trim()}>
            Add
          </button>
        </form>
      )}

      {error && <p className="banner banner--err" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  )
}
