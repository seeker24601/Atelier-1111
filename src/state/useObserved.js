import { useMemo } from 'react'
import { observe, silenced } from '../observed.js'
import { couplingFor } from '../coupling.js'

/**
 * Observed output behaviour for the selected model, derived from its stored
 * images plus the capability ledger. Pure derivation — no fetching.
 */
export function useObserved(runs, unusable) {
  const facts = useMemo(() => observe(runs), [runs])

  const hidden = useMemo(() => {
    const map = silenced(facts, unusable)
    // An ignored parameter may still be decided by another one; say which.
    for (const [key, reason] of map) {
      if (reason.kind === 'dead') reason.coupling = couplingFor(key, runs)
    }
    return map
  }, [facts, unusable, runs])

  return { facts, hidden }
}
