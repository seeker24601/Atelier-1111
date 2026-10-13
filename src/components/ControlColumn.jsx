import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import ModelPlate from './controls/ModelPlate.jsx'
import RefsPlate from './controls/RefsPlate.jsx'
import FormatPlate from './controls/FormatPlate.jsx'
import { dollars } from '../format.js'

/**
 * Generate: the one pink control. Its price is on it when this model has a
 * measured one. When it can't act it says why, in place of the action.
 */
function CommitButton({ label, price, busy, disabled, onClick, aria }) {
  const [fired, setFired] = useState(false)
  const go = () => {
    setFired(true)
    setTimeout(() => setFired(false), 140)
    onClick()
  }
  return (
    <button
      className={`commit${fired ? ' is-fired' : ''}`}
      data-busy={busy ? 'true' : undefined}
      disabled={disabled}
      onClick={go}
      title="Ctrl+Enter"
      aria-label={aria}
    >
      <span className="commit__label">
        <span className="commit__text" data-text={label}>
          {label}
        </span>
        {!disabled && !busy && <ArrowRight className="commit__arrow" size={16} aria-hidden="true" />}
      </span>
      {(busy || price) && (
        <span className="commit__side">
          <span>{busy || price}</span>
          {busy && <span className="wait" aria-hidden="true" />}
        </span>
      )}
    </button>
  )
}

/**
 * Settings above, then the composer docked at the foot of the column: what you
 * type and the button that sends it, together and always in view.
 */
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
  measuredPrice = null,
  promptFlash = false,
  onOpenPicker,
  error,
  onDismissError,
}) {
  // Generating stays available while work runs — queueing the next shot is the
  // whole point of a queue. It only closes at the cap, which is a real limit.
  const full = inFlight >= maxInFlight
  const empty = !composer.prompt.trim()
  const canCommit = Boolean(composer.model) && !empty && !full
  const commit = () => canCommit && composer.commit()

  // A model that cannot use a reference has no use for the tray, so the step is
  // removed rather than shown as a dead control.
  const active = models.find((m) => m.id === composer.model)
  const declared = active ? active.acceptsImages : true
  const cap = declared ? references.capFor(composer.model) : 0

  const label = !composer.model ? 'Choose a model first' : empty ? 'Write a prompt first' : full ? 'Queue full' : 'Generate'
  const price = measuredPrice != null && !empty ? `~${dollars(measuredPrice)}` : null

  return (
    <>
      <ModelPlate models={models} model={composer.model} onOpen={onOpenPicker} />

      {cap > 0 && <RefsPlate refs={composer.refs} onRefs={composer.setRefs} max={cap} />}

      <FormatPlate
        number={cap > 0 ? '03' : '02'}
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
        spec={kind === 'image' ? active?.spec : null}
      />

      <div className="dock">
        {error && (
          <button className="banner banner--err banner--dismiss" onClick={onDismissError}>
            <span>{error}</span>
            <X size={12} aria-label="Dismiss" />
          </button>
        )}
        <label className="prompt">
          <span className="sr">Prompt</span>
          <textarea
            className={`field${promptFlash ? ' is-flash' : ''}`}
            rows={5}
            autoFocus
            value={composer.prompt}
            onChange={(e) => composer.setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                commit()
              }
            }}
            placeholder={
              kind === 'video'
                ? 'Describe the clip: what moves, and how the camera does'
                : composer.refs.length
                  ? 'Describe the change: make the shirt red, keep everything else'
                  : 'Describe what you want to see'
            }
          />
          <span className="prompt__hint" aria-hidden="true">
            Ctrl+Enter
          </span>
        </label>
        <CommitButton
          label={label}
          price={price}
          busy={full ? `${inFlight} / ${maxInFlight}` : null}
          disabled={!canCommit && !full}
          onClick={commit}
          aria={full ? `Queue full, ${inFlight} of ${maxInFlight} running` : `${label}${price ? `, about ${price.slice(1)}` : ''}`}
        />
      </div>
    </>
  )
}
