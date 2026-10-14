import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibrary } from './state/useLibrary.js'
import { useComposer } from './state/useComposer.js'
import { useSettings } from './state/useSettings.js'
import { useCapabilities } from './state/useCapabilities.js'
import { useObserved } from './state/useObserved.js'
import { useLedger } from './state/useLedger.js'
import { useReferences } from './state/useReferences.js'
import { useDetail } from './state/useDetail.js'
import TopBar from './components/TopBar.jsx'
import ControlColumn from './components/ControlColumn.jsx'
import Workspace from './components/Workspace.jsx'
import ModelPicker from './components/ModelPicker.jsx'
import ImageDetail from './components/ImageDetail.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import FirstRun from './components/FirstRun.jsx'
import { LogoSprite } from './components/ui/Logo.jsx'
import { REF_PICKER_ID } from './components/controls/RefsPlate.jsx'
import { api } from './api.js'
import { unpublishedChoices } from './specs.js'
import { fieldsFor } from './params.js'
import { shortModel } from './format.js'
import { modelName } from './makers.js'

// When a model has no finished run yet, how long to expect, by modality.
const USUAL_FALLBACK = { image: 30000, video: 180000 }
const DISMISSED_KEY = 'atelier.dismissed-failures'

const readDismissed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

/** Composition only. State lives in state/, presentation in components/. */
export default function App() {
  // Which catalogue and pipeline the whole page is working in.
  const [view, setView] = useState('image')

  const settings = useSettings()
  const { active, configured } = settings.status
  // The catalogue follows the active provider: switching it re-reads the picker.
  const library = useLibrary(view, active)

  // A tab appears only when the active provider has models of that kind.
  const [views, setViews] = useState(['image', 'video'])
  useEffect(() => {
    let live = true
    Promise.all(
      ['image', 'video'].map((kind) =>
        api.models({ kind }).then(({ models }) => (models.length ? kind : null), () => null)
      )
    ).then((kinds) => live && setViews(kinds.filter(Boolean)))
    return () => {
      live = false
    }
  }, [active, configured])
  useEffect(() => {
    if (views.length && !views.includes(view)) setView(views[0])
  }, [views, view])
  // Built before the composer: how many references a model will take decides
  // what the composer is allowed to hold.
  const ledger = useLedger(library.images.length)
  const references = useReferences({ ...ledger, models: library.models })
  const composer = useComposer({
    kind: view,
    models: library.models,
    refCapFor: references.capFor,
    onCommitted: library.refresh,
    onError: library.setError,
  })

  // Verdicts appear as jobs settle, so re-read whenever the ledger moves.
  const capabilities = useCapabilities(composer.model, library.jobs.length + library.images.length)

  const detail = useDetail(library.images)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const [pickerOpen, setPickerOpen] = useState(false)

  const runsForModel = useMemo(
    () => library.images.filter((i) => i.model === composer.model),
    [library.images, composer.model]
  )

  // What the model actually returns, which decides whether a control is a
  // choice at all — a parameter with a fixed outcome is hidden, not offered.
  const observed = useObserved(runsForModel, capabilities.unusable)

  // A choice the model's published spec does not include is withheld like a
  // measured dead end: the setting goes back to Auto, the value stays for other models.
  const activeSpec = library.models.find((m) => m.id === composer.model)?.spec ?? null
  const unusable = useMemo(
    () => new Set([...(capabilities.unusable ?? []), ...unpublishedChoices(composer.params, activeSpec, fieldsFor(view))]),
    [capabilities.unusable, composer.params, activeSpec, view]
  )
  const { withhold } = composer
  useEffect(() => {
    withhold(unusable, observed.hidden)
  }, [unusable, observed.hidden, withhold])

  // A new plate means a new charge: re-read what the key has left.
  const { readAccount } = settings
  const held = library.totals.count
  useEffect(() => {
    if (held) readAccount(true)
  }, [held, readAccount])

  // ── What the gallery and picker know about each model ──────────────────

  // The average a model has actually cost here, per run.
  const measured = useMemo(() => {
    const sums = new Map()
    for (const i of library.images) {
      if (i.cost == null) continue
      const [s, n] = sums.get(i.model) ?? [0, 0]
      sums.set(i.model, [s + i.cost, n + 1])
    }
    return new Map([...sums].map(([id, [s, n]]) => [id, s / n]))
  }, [library.images])

  // How long a model usually takes here: the median of its finished jobs.
  const usual = useMemo(() => {
    const times = new Map()
    for (const j of library.jobs) {
      if (j.status !== 'done' || !j.finished_at || !j.created_at) continue
      times.set(j.model, [...(times.get(j.model) ?? []), j.finished_at - j.created_at])
    }
    return new Map([...times].map(([id, t]) => [id, t.sort((a, b) => a - b)[Math.floor(t.length / 2)]]))
  }, [library.jobs])
  const usualFor = useCallback((id, kind = 'image') => usual.get(id) ?? USUAL_FALLBACK[kind] ?? 30000, [usual])

  const names = useMemo(() => new Map(library.models.map((m) => [m.id, modelName(m)])), [library.models])
  const nameFor = useCallback((id) => names.get(id) ?? shortModel(id), [names])

  // Models used here, most recent first: the picker lists them on top.
  const recent = useMemo(() => [...new Set(library.images.map((i) => i.model))], [library.images])

  // ── Failed jobs, shown where they would have landed until dismissed ────

  const [dismissed, setDismissed] = useState(readDismissed)
  const dismiss = useCallback((job) => {
    setDismissed((d) => {
      const next = new Set(d).add(job.id)
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next].slice(-200)))
      } catch {
        // Storage refused: it stays dismissed for this session only.
      }
      return next
    })
  }, [])
  const failures = useMemo(
    () => library.jobs.filter((j) => j.status === 'error' && (j.kind || 'image') === view && !dismissed.has(j.id)),
    [library.jobs, view, dismissed]
  )

  // A reused prompt lands with one cyan frame, so you see where it went.
  const [promptFlash, setPromptFlash] = useState(false)
  const reuse = useCallback(
    (item) => {
      composer.reuse(item)
      setPromptFlash(true)
      setTimeout(() => setPromptFlash(false), 260)
    },
    [composer]
  )

  async function fixFailure(job, fix) {
    if (fix === 'settings') return setSettingsOpen(true)
    reuse(job)
    if (fix === 'ref') {
      // The tray appears once the model is switched; then its file picker opens.
      setTimeout(() => document.getElementById(REF_PICKER_ID)?.click(), 60)
      return
    }
    // Uploaded references are not kept with a settled job, so a job that used
    // them comes back into the composer instead of being sent again blind.
    if (job.refs?.length) return
    dismiss(job)
    try {
      await api.generate({ kind: job.kind || 'image', models: [job.model], prompt: job.prompt, params: job.params || {} })
      library.refresh()
    } catch (e) {
      library.setError(e.message)
    }
  }

  // ── Dropping an image anywhere shows where it goes ─────────────────────

  const activeModel = library.models.find((m) => m.id === composer.model)
  const refCap = activeModel && !activeModel.acceptsImages ? 0 : references.capFor(composer.model)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const enter = (e) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = (e) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const drop = () => {
      depth = 0
      setDragging(false)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  function attachAndClose(image) {
    composer.attachRef(image)
    detail.close()
  }

  function reuseAndClose(image) {
    reuse(image)
    detail.close()
  }

  // Deleting has to drop the image from the reference tray too, or a commit
  // would cite a file that no longer exists.
  async function removeImage(image) {
    composer.detachRef(image.id)
    await library.remove(image)
  }

  // Plates leave the reference tray too, or a commit would cite a missing file.
  async function removeSelected({ images, jobs }) {
    for (const id of images) composer.detachRef(id)
    try {
      if (images.length) await library.removeMany(images)
      if (jobs.length) await library.removeJobs(jobs)
    } catch (e) {
      library.setError(e.message)
    }
  }

  // The selection as one zip, fetched like any single download.
  async function downloadImages(ids) {
    try {
      const { url } = await api.archive(ids)
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      document.body.append(a)
      a.click()
      a.remove()
    } catch (e) {
      library.setError(e.message)
    }
  }

  async function deleteAndClose(image) {
    detail.close()
    await removeImage(image)
  }

  const settingsPage = (
    <SettingsPanel
      open={settingsOpen}
      onClose={closeSettings}
      onModelsChange={library.reloadModels}
      settings={settings}
      storage={{ storage: library.storage, count: library.totals.count, onClear: library.clearAll }}
    />
  )

  if (!configured) {
    return (
      <>
        <LogoSprite />
        <FirstRun settings={settings} />
      </>
    )
  }

  return (
    <div className="app">
      <LogoSprite />
      <TopBar
        activeJobs={library.activeJobs}
        spend={library.spend}
        keyStatus={settings.status}
        account={settings.account}
        view={view}
        views={views}
        onView={setView}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="main">
        <aside className="control" aria-label="Generation settings">
          <ControlColumn
            kind={view}
            models={library.models}
            composer={composer}
            observed={observed}
            references={references}
            verdictFor={capabilities.verdictFor}
            acceptedFor={capabilities.acceptedFor}
            inferenceFor={capabilities.inferenceFor}
            ledger={ledger.rows}
            inFlight={library.activeJobs.length}
            measuredPrice={measured.get(composer.model) ?? null}
            promptFlash={promptFlash}
            onOpenPicker={() => setPickerOpen(true)}
            error={library.error}
            onDismissError={() => library.setError(null)}
          />
        </aside>

        <Workspace
          kind={view}
          models={library.models}
          model={composer.model}
          runs={runsForModel}
          overlay={Boolean(detail.image) || pickerOpen || settingsOpen}
          onDownloadMany={downloadImages}
          onDeleteMany={removeSelected}
          gallery={{
            images: library.images,
            pending: library.activeJobs.filter((j) => (j.kind || 'image') === view),
            failures,
            nameFor,
            usualFor,
            onOpen: detail.open,
            onReuse: reuse,
            onUseAsRef: refCap > 0 ? composer.attachRef : null,
            onFix: fixFailure,
            onDismiss: dismiss,
          }}
        />

        <ModelPicker
          open={pickerOpen}
          kind={view}
          models={library.models}
          model={composer.model}
          recent={recent}
          measured={measured}
          refCapFor={references.capFor}
          refsAttached={composer.refs.length}
          onPick={composer.setModel}
          onClose={() => setPickerOpen(false)}
        />

        {dragging && (
          <div className={`drop${refCap > 0 ? '' : ' drop--no'}`} aria-hidden="true">
            <div className="drop__inner">
              <span className="plate-title">{refCap > 0 ? 'Drop to reference' : 'No references'}</span>
              <span className="data dim">
                {refCap > 0
                  ? `${composer.refs.length} of ${refCap} · ${nameFor(composer.model)}`
                  : `${nameFor(composer.model)} takes none. Pick another model to use images.`}
              </span>
            </div>
          </div>
        )}
      </div>

      <ImageDetail
        image={detail.image}
        name={detail.image ? nameFor(detail.image.model) : null}
        position={detail.position}
        onStep={detail.step}
        onClose={detail.close}
        onUseAsRef={attachAndClose}
        onReuse={reuseAndClose}
        onDelete={deleteAndClose}
        refVerdict={detail.image ? references.verdicts.get(detail.image.model) : null}
        onReportRef={references.report}
      />

      {settingsPage}
    </div>
  )
}
