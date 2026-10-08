import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'

/**
 * The whole capability ledger, every model and parameter.
 *
 * Loaded once and shared: the reference interlock reads it per model, and the
 * parameter record reads it across the catalogue. Two consumers of one fetch.
 */
export function useLedger(revision) {
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    try {
      const { capabilities } = await api.capabilities()
      setRows(capabilities)
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, revision])

  return { rows, reload: load }
}
