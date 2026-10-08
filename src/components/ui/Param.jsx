import { VERDICT_LABEL } from '../../state/useCapabilities.js'

/**
 * A parameter whose support cannot be looked up anywhere — OpenRouter publishes
 * nothing about it — so each option carries whatever this model was last
 * *observed* to do with it: struck through when refused, dotted when ignored,
 * bracketed when expected to fail. The evidence is on hover; the send switch
 * withholds the parameter entirely.
 */
export default function Param({
  label,
  options,
  value,
  onValue,
  enabled,
  onEnabled,
  verdictFor = () => null,
  inferenceFor = () => null,
  glyph = null,
  flag = null,
  format = (v) => v,
}) {
  const key = label.key ?? label

  return (
    <div className="param">
      <div className="param__head">
        <span className="label label--sm">
          {label.text ?? label}
          {flag && (
            <span className="param__flag" title={flag.title}>
              {flag.text}
            </span>
          )}
        </span>
        <button
          className="send-toggle"
          aria-pressed={enabled}
          onClick={() => onEnabled(!enabled)}
          title={enabled ? 'Sent with the request' : 'Left out of the request'}
        >
          <span className={`mark ${enabled ? 'mark--on' : ''}`} style={{ width: 8, height: 8 }} />
          send
        </button>
      </div>

      <div className={`seg ${glyph ? 'seg--glyph' : ''}`} style={{ opacity: enabled ? 1 : 0.45 }}>
        {options.map((opt) => {
          const seen = verdictFor(key, opt)
          // A value this model has been measured to reject or silently override
          // cannot be chosen — picking it would spend money for a known result.
          const unusable = seen?.verdict === 'rejected' || seen?.verdict === 'ignored'
          // An expected failure is marked but stays clickable: it is reasoning,
          // not a measurement, and the run that would disprove it is free.
          const expected = seen ? null : inferenceFor(key, opt)
          return (
            <button
              key={opt}
              className="seg__opt"
              data-verdict={seen?.verdict || (expected ? 'expected' : 'untested')}
              aria-pressed={enabled && value === opt}
              disabled={!enabled || unusable}
              onClick={() => onValue(opt)}
              title={
                seen
                  ? `${VERDICT_LABEL[seen.verdict]}${seen.evidence ? ` — ${seen.evidence}` : ''}`
                  : expected
                    ? `Expected to fail — ${expected}`
                    : 'Untested on this model'
              }
            >
              {glyph?.(opt)}
              <span>{format(opt)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
