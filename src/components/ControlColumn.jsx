import ModelPlate from './controls/ModelPlate.jsx'
import PromptPlate from './controls/PromptPlate.jsx'
import RefsPlate from './controls/RefsPlate.jsx'
import FormatPlate from './controls/FormatPlate.jsx'

/** Composition only — each plate owns its own controls. */
export default function ControlColumn({
  kind = 'image',
  models,
  composer,
  references,
  verdictFor,
  acceptedFor,
  inferenceFor,
  observed,
  ledger = [],
  inFlight = 0,
  maxInFlight = 4,
  error,
  onDismissError,
}) {
  // Generating stays available while work runs — queueing the next shot is the
  // whole point of a queue. It only closes at the cap, which is a real limit.
  const full = inFlight >= maxInFlight
  const canCommit = Boolean(composer.model) && composer.prompt.trim().length > 0 && !full
  const commit = () => canCommit && composer.commit()

  // A model that cannot use a reference has no use for the tray, so the step is
  // removed rather than shown as a dead control.
  const active = models.find((m) => m.id === composer.model)
  const declared = active ? active.acceptsImages : true
  const cap = declared ? Math.min(references.capFor(composer.model), composer.maxRefs) : 0

  return (
    <>
      <ModelPlate
        models={models}
        model={composer.model}
        onModel={composer.setModel}
        refCapFor={references.capFor}
        refsAttached={composer.refs.length}
      />

      <PromptPlate
        prompt={composer.prompt}
        onPrompt={composer.setPrompt}
        hasRefs={composer.refs.length > 0}
        onCommit={commit}
      />

      {cap > 0 && <RefsPlate refs={composer.refs} onRefs={composer.setRefs} max={cap} />}

      <FormatPlate
        params={composer.params}
        onParams={composer.setParams}
        paramsOn={composer.paramsOn}
        onParamsOn={composer.setParamsOn}
        verdictFor={verdictFor}
        acceptedFor={acceptedFor}
        inferenceFor={inferenceFor}
        ledger={ledger}
        modelIds={models.map((m) => m.id)}
        hidden={observed.hidden}
        kind={kind}
      />

      {/* Docked to the bottom of the column, so it is never scrolled away. */}
      <div className="commit-dock">
        {error && (
          <button className="banner banner--err banner--dismiss" onClick={onDismissError}>
            <span>{error}</span>
            <span aria-label="Dismiss">×</span>
          </button>
        )}
        <button
          className="btn btn--commit"
          data-busy={full ? 'true' : undefined}
          disabled={!canCommit}
          onClick={commit}
          title="Ctrl+Enter"
        >
          <span>{full ? `Queue full · ${inFlight}/${maxInFlight}` : 'Generate'}</span>
          {full ? <span className="commit-wait" aria-hidden="true" /> : <span>→</span>}
        </button>
      </div>
    </>
  )
}
