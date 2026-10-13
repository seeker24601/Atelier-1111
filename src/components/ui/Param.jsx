import { useState } from 'react'
import { VERDICT_LABEL } from '../../state/useCapabilities.js'
import { ROW, groupOptions } from '../../groups.js'

/**
 * One request parameter. Auto comes first: the model decides and nothing is
 * sent. Picking a value is the only way to send one, so there is no separate
 * send switch to learn.
 *
 * A parameter whose support cannot be looked up anywhere — OpenRouter publishes
 * nothing about it — carries what this model was last *observed* to do with
 * each option: struck through when refused, dotted when ignored, bracketed when
 * expected to fail. The evidence is on hover.
 *
 * A row never runs off the panel. Past ROW options, `groupBy` splits them
 * under tabs (Portrait, Square, Landscape) beside Auto, one group at a time; a
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
  const name = label.text ?? label
  const [openGroup, setOpenGroup] = useState(null)

  const groups = groupBy && options.length > ROW ? groupOptions(options, groupBy) : null
  // The tab the user opened, else the one holding the current choice.
  const holding = groups?.find((g) => g.options.includes(value))
  const shownGroup = groups ? (groups.find((g) => g.key === openGroup) ?? holding ?? groups[0]) : null
  const visible = shownGroup ? shownGroup.options : options
  // On Auto with tabs, the values stay folded away until a group is opened.
  const showValues = !groups || enabled || openGroup != null

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

  const choose = (opt) => {
    onValue(opt)
    if (!enabled) onEnabled(true)
  }
  const auto = () => {
    onEnabled(false)
    setOpenGroup(null)
  }

  const autoButton = (
    <button
      className="seg__opt seg__opt--auto"
      aria-pressed={!enabled}
      onClick={auto}
      title="The model decides; nothing is sent"
    >
      Auto
    </button>
  )

  return (
    <div className="param">
      <div className="param__head">
        <span className="label">
          {name}
          {flag && (
            <span className="param__flag" title={flag.title}>
              {flag.text}
            </span>
          )}
        </span>
        <span className="label label--sm dim">
          {enabled ? format(value) : 'Model decides'}
        </span>
      </div>

      {groups && (
        <div className="seg seg--tabs" role="group" aria-label={`${name}: Auto or a group`}>
          {autoButton}
          {groups.map((g) => (
            <button
              key={g.key}
              className="seg__opt"
              aria-pressed={showValues && g === shownGroup && (enabled || openGroup === g.key)}
              data-holds={enabled && g === holding ? 'true' : undefined}
              onClick={() => setOpenGroup(g.key)}
              title={`${g.label} · ${g.options.length} option${g.options.length === 1 ? '' : 's'}${enabled && g === holding ? ' · current choice' : ''}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {showValues &&
        (visible.length > ROW ? (
          <Slider
            options={visible.filter((opt) => !judge(opt).unusable)}
            value={value}
            onValue={choose}
            enabled={enabled}
            glyph={glyph}
            format={format}
            label={name}
          />
        ) : (
          <div className={`seg${glyph ? ' seg--glyph' : ''}`}>
            {!groups && autoButton}
            {visible.map((opt) => {
              const { seen, unusable, expected } = judge(opt)
              return (
                <button
                  key={opt}
                  className="seg__opt"
                  data-verdict={seen?.verdict || (expected ? 'expected' : 'untested')}
                  aria-pressed={enabled && value === opt}
                  disabled={unusable}
                  onClick={() => choose(opt)}
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
        ))}
    </div>
  )
}

/** One group too long for a row: a slider over its usable values, the choice drawn beside it. */
function Slider({ options, value, onValue, enabled, glyph, format, label }) {
  const index = options.indexOf(value)
  const shown = enabled && index >= 0 ? value : null
  return (
    <div className="param__slider">
      <input
        type="range"
        min={0}
        max={Math.max(options.length - 1, 0)}
        step={1}
        value={Math.max(index, 0)}
        disabled={options.length === 0}
        onChange={(e) => onValue(options[Number(e.target.value)])}
        aria-label={label}
        aria-valuetext={shown ? format(shown) : 'model decides'}
      />
      <span className="param__slider-value data">
        {shown && glyph?.(shown)}
        <span>{shown ? format(shown) : 'Auto'}</span>
      </span>
    </div>
  )
}
