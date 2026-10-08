import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { inferredDead } from '../inference.js'

export const VERDICT_LABEL = {
  ok: 'OK',
  ignored: 'IGNORED',
  rejected: 'REJECTED',
  unverifiable: 'ACCEPTED',
}

/**
 * What this model has actually been observed to do with each parameter value.
 * Nothing here is declared by OpenRouter — every row was measured from a real
 * response, so an absent entry means "never tried", not "unsupported".
 */
export function useCapabilities(model, revision) {
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    if (!model) return setRows([])
    try {
      const { capabilities } = await api.capabilities(model)
      setRows(capabilities)
    } catch {
      setRows([])
    }
  }, [model])

  // `revision` changes whenever a job settles, which is when verdicts appear.
  useEffect(() => {
    load()
  }, [load, revision])

  const index = useMemo(() => {
    const map = new Map()
    for (const row of rows) map.set(`${row.param}::${row.value}`, row)
    return map
  }, [rows])

  const verdictFor = useCallback(
    (param, value) => index.get(`${param}::${value}`) || null,
    [index]
  )

  /**
   * Why a never-tried value is expected to fail. Advisory only — it does not
   * join `unusable`, so nothing is disabled or withheld on an inference.
   */
  const inferenceFor = useCallback(
    (param, value) =>
      index.has(`${param}::${value}`) ? null : inferredDead(param, value, rows),
    [index, rows]
  )

  /**
   * The values a provider named when it refused one — "Accepted: 1:1, 4:3, 3:4,
   * 16:9, 9:16, auto". This is the closest thing to published support data that
   * exists for these parameters, and it only ever arrives inside an error.
   */
  const acceptedFor = useCallback(
    (param) => {
      for (const row of rows) {
        if (row.param !== param || row.verdict !== 'rejected') continue
        const found = /accepted:\s*([^.]+)/i.exec(row.evidence || '')
        if (found) return found[1].trim()
      }
      return null
    },
    [rows]
  )

  /**
   * Values this model cannot usefully be sent: rejected outright, or accepted
   * and silently overridden. Both are dead ends — one costs nothing, the other
   * costs full price for a result you did not ask for.
   */
  const unusable = useMemo(
    () =>
      new Set(
        rows
          .filter((r) => r.verdict === 'rejected' || r.verdict === 'ignored')
          .map((r) => `${r.param}::${r.value}`)
      ),
    [rows]
  )

  return { rows, verdictFor, acceptedFor, inferenceFor, unusable, reload: load }
}
