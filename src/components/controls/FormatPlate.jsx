import Plate from '../ui/Plate.jsx'
import Param from '../ui/Param.jsx'
import FixedParam from '../ui/FixedParam.jsx'
import { fieldsFor } from '../../params.js'
import { recordFor } from '../../paramrecord.js'
import { offerableOptions } from '../../ratios.js'

/**
 * A box drawn at the ratio it names. "4:3" and "3:4" are one character apart
 * and read identically at a glance; the shape does not.
 */
const GLYPH_BOX = 15

function RatioGlyph({ value }) {
  const [w, h] = value.split(':').map(Number)
  if (!w || !h) return null
  const scale = GLYPH_BOX / Math.max(w, h)
  return (
    <span
      className="ratio-glyph"
      style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
      aria-hidden="true"
    />
  )
}

/**
 * The catalogue-wide record, flagged only when it is damning: a parameter that
 * has never been respected by anything here.
 */
function neverHonoured(stat) {
  if (!stat?.neverHonoured) return null
  return {
    text: 'never honoured',
    title: `Not respected once in ${stat.attempts} attempts across ${stat.models} models`,
  }
}

export default function FormatPlate({
  params,
  onParams,
  paramsOn,
  onParamsOn,
  verdictFor,
  acceptedFor = () => null,
  inferenceFor = () => null,
  ledger = [],
  modelIds = [],
  hidden = new Map(),
  kind = 'image',
}) {
  const fields = fieldsFor(kind)
  const shown = fields.filter((f) => !hidden.has(f.key))
  const sent = shown.filter((f) => paramsOn[f.key]).length

  return (
    <Plate id="04 / Format" right={`${sent} sent`}>
      <div className="stack">
        {fields.map((f) =>
          hidden.has(f.key) ? (
            <FixedParam key={f.key} label={f} reason={hidden.get(f.key)} />
          ) : (
            <Param
              key={f.key}
              label={f}
              options={offerableOptions(f, verdictFor, acceptedFor)}
              value={params[f.key]}
              onValue={(v) => onParams({ ...params, [f.key]: v })}
              enabled={paramsOn[f.key]}
              onEnabled={(v) => onParamsOn({ ...paramsOn, [f.key]: v })}
              verdictFor={verdictFor}
              inferenceFor={inferenceFor}
              glyph={f.glyph ? (v) => <RatioGlyph value={v} /> : undefined}
              format={(v) => (f.unit ? `${v}${f.unit}` : f.boolean ? (v === 'true' ? 'on' : 'off') : v)}
              flag={neverHonoured(recordFor(ledger, modelIds, f.key))}
            />
          )
        )}
      </div>
    </Plate>
  )
}
