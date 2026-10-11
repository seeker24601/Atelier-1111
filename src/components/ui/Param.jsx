import { useState } from 'react'
import { VERDICT_LABEL } from '../../state/useCapabilities.js'
import { ROW, groupOptions } from '../../groups.js'

/**
 * A parameter whose support cannot be looked up anywhere — OpenRouter publishes
 * nothing about it — so each option carries whatever this model was last
 * *observed* to do with it: struck through when refused, dotted when ignored,
 * bracketed when expected to fail. The evidence is on hover; the send switch
 * withholds the parameter entirely.
 *
 * A row never runs off the panel. Past ROW options, `groupBy` splits them
 * under tabs (Portrait, Square, Landscape) showing one group at a time; a
 * group still longer than a row becomes a slider over its usable values.
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
  groupBy = null,
}) {
  const key = label.key ?? label
  const [openGroup, setOpenGroup] = useState(null)

  const groups = groupBy && options.length > ROW ? groupOptions(options, groupBy) : null
  // The tab the user opened, else the one holding the current choice.
  const holding = groups?.find((g) => g.options.includes(value))
  const shownGroup = groups ? (groups.find((g) => g.key === openGroup) ?? holding ?? groups[0]) : null
  const visible = shownGroup ? shownGroup.options : options

  const judge = (opt) => {
    const seen = verdictFor(key, opt)
    // A value this model has been measured to reject or silently override
    // cannot be chosen — picking it would spend money for a known result.
    const unusable = seen?.verdict === 'rejected' || seen?.verdict === 'ignored'
    // An expected failure is marked but stays clickable: it is reasoning,
    // not a measurement, and the run that would disprove it is free.
    const expected = seen ? null : inferenceFor(key, opt)
    return { seen, unusable, expected }
  }

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

      {groups && (
        <div className="seg seg--tabs" role="tablist" aria-label={`${label.text ?? label} groups`} style={{ opacity: enabled ? 1 : 0.45 }}>
          {groups.map((g) => (
            <button
              key={g.key}
              role="tab"
              className="seg__opt"
              aria-selected={g === shownGroup}
              aria-pressed={g === shownGroup}
              data-holds={g === holding ? 'true' : undefined}
              disabled={!enabled}
              onClick={() => setOpenGroup(g.key)}
              title={g === holding ? `${g.label} · current choice` : g.label}
            >
              {g.label}
              <span className="seg__count">{g.options.length}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length > ROW ? (
        <Slider
          options={visible.filter((opt) => !judge(opt).unusable)}
          value={value}
          onValue={onValue}
          enabled={enabled}
          glyph={glyph}
          format={format}
          label={label.text ?? label}
        />
      ) : (
        <div className={`seg ${glyph ? 'seg--glyph' : ''}`} style={{ opacity: enabled ? 1 : 0.45 }}>
          {visible.map((opt) => {
            const { seen, unusable, expected } = judge(opt)
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
      )}
    </div>
  )
}

/** One group too long for a row: a slider over its usable values, the choice drawn beside it. */
function Slider({ options, value, onValue, enabled, glyph, format, label }) {
  const index = options.indexOf(value)
  const shown = index >= 0 ? value : null
  return (
    <div className="param__slider" style={{ opacity: enabled ? 1 : 0.45 }}>
      <input
        type="range"
        min={0}
        max={Math.max(options.length - 1, 0)}
        step={1}
        value={Math.max(index, 0)}
        disabled={!enabled || options.length === 0}
        onChange={(e) => onValue(options[Number(e.target.value)])}
        aria-label={label}
        aria-valuetext={shown ? format(shown) : 'none chosen'}
      />
      <span className="param__slider-value data">
        {shown && glyph?.(shown)}
        <span>{shown ? format(shown) : '—'}</span>
      </span>
    </div>
  )
}
