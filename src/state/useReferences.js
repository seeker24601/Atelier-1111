import { useCallback, useMemo } from 'react'
import { api } from '../api.js'
import { publishedReferenceLimit } from '../specs.js'

/** The tray's size for a model that publishes no limit. */
export const DEFAULT_REFS = 8

/**
 * Which models have been reported to ignore the reference image they were sent.
 *
 * This is the one capability the app cannot measure for itself: the request
 * succeeds, the bytes look like any other image, and only someone comparing the
 * result to the reference can tell. Reported once from the image detail, it then
 * drives the interlock between the model picker and the reference tray.
 */
export function useReferences({ rows, reload, models = [] }) {
  const verdicts = useMemo(
    () => new Map(rows.filter((r) => r.param === 'reference').map((r) => [r.model, r.verdict])),
    [rows]
  )
  const published = useMemo(
    () => new Map(models.map((m) => [m.id, publishedReferenceLimit(m.spec)])),
    [models]
  )

  /**
   * How many references this model will take. Zero if it ignores them.
   * Otherwise the lower of what it publishes (GPT Image 2 takes 16, MAI 1;
   * DEFAULT_REFS when it states no limit) and one below the smallest count a
   * provider has refused: Azure refusing 2 means MAI takes 1.
   */
  const capFor = useCallback(
    (id) => {
      if (verdicts.get(id) === 'ignored') return 0
      const refused = rows
        .filter((r) => r.model === id && r.param === 'input_references')
        .map((r) => Number(r.value))
        .filter((n) => n > 0)
      const measured = refused.length ? Math.min(...refused) - 1 : Infinity
      return Math.min(measured, published.get(id) ?? DEFAULT_REFS)
    },
    [rows, verdicts, published]
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
