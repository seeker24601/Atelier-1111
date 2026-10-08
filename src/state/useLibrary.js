import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { migrateBrowserGallery } from '../store/migrateBrowser.js'
import { assembleLog } from '../joblog.js'
import { makeFailureWatch } from './newFailures.js'

const ACTIVE = new Set(['queued', 'running'])
const POLL_BUSY = 1500
const POLL_IDLE = 8000

/**
 * The model index, the job log and the gallery, all from the local server.
 *
 * A job's output is written to disk by the server the moment it arrives, so
 * the page only has to notice that something finished and re-read the gallery.
 * Nothing depends on this tab staying open.
 */
export function useLibrary(kind = 'image') {
  const [models, setModels] = useState([])
  const [serverJobs, setServerJobs] = useState([])
  // Every stored row, both modalities — the log is not per-tab.
  const [all, setAll] = useState([])
  const [storage, setStorage] = useState(null)
  const [error, setError] = useState(null)

  const failures = useRef(makeFailureWatch())
  const settled = useRef(null)

  const images = useMemo(() => all.filter((r) => (r.kind || 'image') === kind), [all, kind])

  const activeJobs = useMemo(
    () => serverJobs.filter((j) => ACTIVE.has(j.status)),
    [serverJobs]
  )

  const jobs = useMemo(() => assembleLog(serverJobs, all), [serverJobs, all])

  // Whole-device, not per-tab: the bill does not care which tab you are on.
  const totals = useMemo(
    () => ({
      count: all.length,
      spend: all.reduce((n, r) => n + (r.cost || 0), 0),
      bytes: all.reduce((n, r) => n + (r.bytes || 0), 0),
    }),
    [all]
  )

  // Bumped when the hidden-model list changes in Settings, to re-read the picker.
  const [modelsVersion, setModelsVersion] = useState(0)
  const reloadModels = useCallback(() => setModelsVersion((v) => v + 1), [])

  useEffect(() => {
    let live = true
    api
      .models({ kind })
      .then(({ models }) => live && setModels(models))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [kind, modelsVersion])

  // A different catalogue starts empty rather than showing the last one's models.
  useEffect(() => setModels([]), [kind])

  const readGallery = useCallback(async () => {
    try {
      const { images } = await api.images({ limit: 2000 })
      setAll(images)
      setStorage(await api.storage())
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { jobs } = await api.jobs()
      setServerJobs(jobs)

      // Re-read the gallery only when a job has newly settled as done.
      const done = jobs.filter((j) => j.status === 'done').map((j) => j.id).join()
      if (settled.current !== null && done !== settled.current) await readGallery()
      settled.current = done

      const fresh = failures.current.check(jobs)
      if (fresh) setError(fresh.error)
    } catch (e) {
      setError(e.message)
    }
  }, [readGallery])

  // A gallery left in this browser by the IndexedDB build moves onto disk once.
  useEffect(() => {
    migrateBrowserGallery()
      .then((moved) => moved && readGallery())
      .catch((e) => setError(`Could not move this browser's gallery to disk: ${e.message}`))
  }, [readGallery])

  useEffect(() => {
    readGallery()
  }, [readGallery])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll fast while work is in flight, slowly when idle.
  useEffect(() => {
    const t = setInterval(refresh, activeJobs.length ? POLL_BUSY : POLL_IDLE)
    return () => clearInterval(t)
  }, [activeJobs.length, refresh])

  const remove = useCallback(
    async (image) => {
      await api.remove(image.id)
      await readGallery()
    },
    [readGallery]
  )

  /** Every generation on disk, both modalities, and the job log. Not undoable. */
  const clearAll = useCallback(async () => {
    await api.clearImages()
    failures.current.reset()
    await readGallery()
    await refresh()
  }, [readGallery, refresh])

  const lastCostFor = useCallback(
    (model) => images.find((i) => i.model === model)?.cost ?? null,
    [images]
  )

  return {
    models,
    jobs,
    images,
    activeJobs,
    spend: totals.spend,
    totals,
    storage,
    error,
    setError,
    refresh,
    remove,
    clearAll,
    refreshGallery: readGallery,
    reloadModels,
    lastCostFor,
  }
}
