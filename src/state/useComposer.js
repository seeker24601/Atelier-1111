import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { urlFor } from '../store/urls.js'
import { DEFAULTS } from './composerDefaults.js'

const PREFERRED = ['openrouter:google/gemini-3-pro-image', 'openrouter:openai/gpt-image-2']
const MAX_REFS = 8

/** The request under construction: what will be sent on the next commit. */
export function useComposer({ kind = 'image', models, refCapFor = () => Infinity, onCommitted, onError }) {
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [refs, setRefs] = useState([])
  const [params, setParams] = useState(DEFAULTS.image.params)
  const [paramsOn, setParamsOn] = useState(DEFAULTS.image.on)

  // Each modality has its own parameters; carrying image defaults into video
  // would send output_format to an endpoint that has no such field.
  useEffect(() => {
    setParams(DEFAULTS[kind].params)
    setParamsOn(DEFAULTS[kind].on)
  }, [kind])

  // Settle on a default once the index arrives, without clobbering a choice.
  // Also catches a switch of modality, where the held model is from the old
  // catalogue and no longer exists in this one.
  useEffect(() => {
    if (models.length === 0) return
    if (model && models.some((m) => m.id === model)) return
    setModel(PREFERRED.find((id) => models.some((m) => m.id === id)) || models[0].id)
  }, [models, model])

  // Switching models can leave more references attached than the new one will
  // take — none at all if it declares no image input or has been reported to
  // ignore them, or just one where a provider caps the count. Trim to fit, so
  // nothing is sent behind a control that isn't showing it.
  useEffect(() => {
    const active = models.find((m) => m.id === model)
    const cap = active && !active.acceptsImages ? 0 : refCapFor(model)
    setRefs((current) => (current.length > cap ? current.slice(0, cap) : current))
  }, [model, models, refCapFor])

  /**
   * Stop sending what this model has been measured not to honour: a value it
   * rejects or silently overrides, or a whole parameter whose output is fixed
   * regardless of the request.
   *
   * Deliberately withheld and not auto-corrected: parameters are global, not
   * per-model, so silently swapping png→jpeg for one model would leave jpeg
   * selected for every model afterwards — rewriting a preference the user never
   * changed. The dead values are disabled in the control instead, so re-enabling
   * the switch and picking a live one is the one-click path.
   */
  const withhold = useCallback(
    (unusable, hidden) => {
      if (!unusable?.size && !hidden?.size) return
      setParamsOn((prev) => {
        let changed = false
        const next = { ...prev }
        for (const key of Object.keys(prev)) {
          if (!prev[key]) continue
          if (hidden?.has(key) || unusable?.has(`${key}::${params[key]}`)) {
            next[key] = false
            changed = true
          }
        }
        return changed ? next : prev
      })
    },
    [params]
  )

  const commit = useCallback(async () => {
    onError(null)
    try {
      // The API takes a list — one job per model — so the comparison grid can
      // reuse it later. The picker commits one at a time.
      await api.generate({
        kind,
        models: [model],
        prompt,
        params: Object.fromEntries(Object.entries(params).filter(([k]) => paramsOn[k])),
        // A plate from the gallery is already on the server's disk, so it goes
        // by id; only a fresh upload travels as bytes.
        refs: refs.map((r) =>
          r.kind === 'image' ? { kind: 'image', id: r.id } : { kind: 'data', url: r.url, name: r.name }
        ),
      })
      onCommitted()
    } catch (e) {
      onError(e.message)
    }
  }, [kind, model, prompt, params, paramsOn, refs, onCommitted, onError])

  const attachRef = useCallback((image) => {
    setRefs((current) =>
      current.length >= MAX_REFS || current.some((r) => r.id === image.id)
        ? current
        : [...current, { kind: 'image', id: image.id, url: urlFor(image) }]
    )
  }, [])

  const detachRef = useCallback((imageId) => {
    setRefs((current) => current.filter((r) => r.id !== imageId))
  }, [])

  /** Restore an earlier plate's exact request into the composer. */
  const reuse = useCallback(
    (image) => {
      setPrompt(image.prompt)
      if (models.some((m) => m.id === image.model)) setModel(image.model)

      const used = image.params || {}
      setParams((prev) => ({ ...prev, ...used }))
      setParamsOn((prev) =>
        Object.fromEntries(Object.keys(prev).map((k) => [k, Object.hasOwn(used, k)]))
      )
    },
    [models]
  )

  return {
    model,
    setModel,
    prompt,
    setPrompt,
    refs,
    setRefs,
    params,
    setParams,
    paramsOn,
    setParamsOn,
    commit,
    attachRef,
    detachRef,
    reuse,
    withhold,
    maxRefs: MAX_REFS,
  }
}
