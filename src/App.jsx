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
import ImageDetail from './components/ImageDetail.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import Specimen from './components/Specimen.jsx'
import { api } from './api.js'

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
  const references = useReferences(ledger)
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

  const runsForModel = useMemo(
    () => library.images.filter((i) => i.model === composer.model),
    [library.images, composer.model]
  )

  // What the model actually returns, which decides whether a control is a
  // choice at all — a parameter with a fixed outcome is hidden, not offered.
  const observed = useObserved(runsForModel, capabilities.unusable)

  const { withhold } = composer
  useEffect(() => {
    withhold(capabilities.unusable, observed.hidden)
  }, [capabilities.unusable, observed.hidden, withhold])

  // A new plate means a new charge: re-read what the key has left.
  const { readAccount } = settings
  const held = library.totals.count
  useEffect(() => {
    if (held) readAccount(true)
  }, [held, readAccount])

  function attachAndClose(image) {
    composer.attachRef(image)
    detail.close()
  }

  function reuseAndClose(image) {
    composer.reuse(image)
    detail.close()
  }

  // Deleting has to drop the image from the reference tray too, or a commit
  // would cite a file that no longer exists.
  async function removeImage(image) {
    composer.detachRef(image.id)
    await library.remove(image)
  }

  async function deleteAndClose(image) {
    detail.close()
    await removeImage(image)
  }

  if (!configured) {
    return (
      <div className="app">
        <TopBar
          activeJobs={library.activeJobs}
          spend={library.spend}
          keyStatus={settings.status}
          account={settings.account}
          view={view}
          views={[]}
          onView={setView}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="main main--keyonly">
          <main className="workspace">
            <Specimen kind={view} settings={settings} />
          </main>
        </div>
        <SettingsPanel
          open={settingsOpen}
          onClose={closeSettings}
          onModelsChange={library.reloadModels}
          settings={settings}
          storage={{ storage: library.storage, count: library.totals.count, onClear: library.clearAll }}
        />
      </div>
    )
  }

  return (
    <div className="app">
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
        <div className="control">
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
            error={library.error}
            onDismissError={() => library.setError(null)}
          />
        </div>

        <Workspace
          kind={view}
          library={library}
          composer={composer}
          settings={settings}
          runs={runsForModel}
          onOpen={detail.open}
          onRemove={removeImage}
        />
      </div>

      <ImageDetail
        image={detail.image}
        position={detail.position}
        onStep={detail.step}
        onClose={detail.close}
        onUseAsRef={attachAndClose}
        onReuse={reuseAndClose}
        onDelete={deleteAndClose}
        refVerdict={detail.image ? references.verdicts.get(detail.image.model) : null}
        onReportRef={references.report}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={closeSettings}
        onModelsChange={library.reloadModels}
        settings={settings}
        storage={{
          storage: library.storage,
          count: library.totals.count,
          onClear: library.clearAll,
        }}
      />
    </div>
  )
}
