import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibrary } from './state/useLibrary.js'
import { useComposer } from './state/useComposer.js'
import { useSettings } from './state/useSettings.js'
import { useCapabilities } from './state/useCapabilities.js'
import { useObserved } from './state/useObserved.js'
import { useLedger } from './state/useLedger.js'
import { useReferences } from './state/useReferences.js'
import TopBar from './components/TopBar.jsx'
import ControlColumn from './components/ControlColumn.jsx'
import Workspace from './components/Workspace.jsx'
import ImageDetail from './components/ImageDetail.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'

/** Composition only. State lives in state/, presentation in components/. */
export default function App() {
  // Which catalogue and pipeline the whole page is working in.
  const [view, setView] = useState('image')

  const library = useLibrary(view)
  const settings = useSettings()
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

  const [detail, setDetail] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
    setDetail(null)
  }

  function reuseAndClose(image) {
    composer.reuse(image)
    setDetail(null)
  }

  // Deleting has to drop the image from the reference tray too, or a commit
  // would cite a file that no longer exists.
  async function removeImage(image) {
    composer.detachRef(image.id)
    await library.remove(image)
  }

  async function deleteAndClose(image) {
    setDetail(null)
    await removeImage(image)
  }

  // Arrow keys and the header arrows walk the gallery in the order it is shown.
  const at = detail ? library.images.findIndex((i) => i.id === detail.id) : -1
  const step = useCallback(
    (delta) => {
      const list = library.images
      if (at < 0 || !list.length) return
      setDetail(list[(at + delta + list.length) % list.length])
    },
    [at, library.images]
  )
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <div className="app">
      <TopBar
        activeJobs={library.activeJobs}
        spend={library.spend}
        keyStatus={settings.status}
        account={settings.account}
        view={view}
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
          onOpen={setDetail}
          onRemove={removeImage}
        />
      </div>

      <ImageDetail
        image={detail}
        position={at >= 0 ? `${at + 1} / ${library.images.length}` : null}
        onStep={step}
        onClose={closeDetail}
        onUseAsRef={attachAndClose}
        onReuse={reuseAndClose}
        onDelete={deleteAndClose}
        refVerdict={detail ? references.verdicts.get(detail.model) : null}
        onReportRef={references.report}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={closeSettings}
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
