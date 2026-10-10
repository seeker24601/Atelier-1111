import Plate from '../ui/Plate.jsx'
import { parseModelId } from '../../../server/modelid.js'

/** Just the choice. Price, context and release date read in the band above. */
export default function ModelPlate({
  models,
  model,
  onModel,
  refCapFor = () => Infinity,
  refsAttached = 0,
}) {
  // A model that cannot take the references currently attached is not a choice:
  // it would either ignore them and bill a plain text-to-image result, or refuse
  // outright. The option says why it is disabled, in place.
  const blocked = (m) => refsAttached > refCapFor(m.id)

  const why = (m) => {
    const cap = refCapFor(m.id)
    return cap === 0 ? ' — no references' : ` — max ${cap} reference${cap === 1 ? '' : 's'}`
  }

  return (
    <Plate id="01 / Model">
      <label className="select-wrap">
        <select
          className="select"
          value={model}
          onChange={(e) => onModel(e.target.value)}
          disabled={models.length === 0}
        >
          {models.length === 0 && <option value="">Loading…</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={blocked(m)}>
              {/* The picker lists one provider's models, so the prefix says nothing. */}
              {parseModelId(m.id).model}
              {blocked(m) ? why(m) : ''}
            </option>
          ))}
        </select>
      </label>
    </Plate>
  )
}
