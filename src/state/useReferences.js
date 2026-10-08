import { useCallback, useMemo } from 'react'
import { api } from '../api.js'

/**
 * Which models have been reported to ignore the reference image they were sent.
 *
 * This is the one capability the app cannot measure for itself: the request
 * succeeds, the bytes look like any other image, and only someone comparing the
 * result to the reference can tell. Reported once from the image detail, it then
 * drives the interlock between the model picker and the reference tray.
 */
export function useReferences({ rows, reload }) {
  const verdicts = useMemo(
    () => new Map(rows.filter((r) => r.param === 'reference').map((r) => [r.model, r.verdict])),
    [rows]
  )

  /**
   * How many references this model will take. Zero if it ignores them, and
   * otherwise one below the smallest count a provider has refused — Azure
   * refusing 2 means MAI takes 1. Unmeasured models are uncapped, so nothing is
   * restricted on a guess.
   */
  const capFor = useCallback(
    (id) => {
      if (verdicts.get(id) === 'ignored') return 0
      const refused = rows
        .filter((r) => r.model === id && r.param === 'input_references')
        .map((r) => Number(r.value))
        .filter((n) => n > 0)
      return refused.length ? Math.min(...refused) - 1 : Infinity
    },
    [rows, verdicts]
  )

  const report = useCallback(
    async (model, verdict) => {
      await api.setReference(model, verdict)
      await reload()
    },
    [reload]
  )

  return {
    verdicts,
    capFor,
    /** True only when reported — an untested model keeps its tray. */
    ignoresRefs: useCallback((id) => verdicts.get(id) === 'ignored', [verdicts]),
    report,
  }
}
