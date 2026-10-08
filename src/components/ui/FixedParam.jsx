/**
 * A parameter measured to offer no choice on this model — the output is the
 * same whatever is asked, or every other value is a known dead end. The row
 * stays and states the outcome; the evidence is on hover.
 */

const DRIVER = { resolution: 'resolution', aspect_ratio: 'aspect', output_format: 'format' }

function describe(reason) {
  const { kind, value, dead, fact, coupling } = reason

  if (kind === 'fixed') {
    return {
      tag: `always ${value}`,
      why: `Asked ${fact.contradicted.join(', ')}; all ${fact.samples} results came back ${value}.`,
    }
  }
  if (kind === 'sole') {
    return {
      tag: `always ${value}`,
      why: `${dead.join(', ')} measured rejected or ignored here.`,
    }
  }
  if (coupling) {
    const driver = DRIVER[coupling.driver] ?? coupling.driver
    return {
      tag: `follows ${driver}`,
      why: `Ignored on its own; matched ${driver} every time: ${coupling.map
        .map(([from, to]) => `${from} → ${to}`)
        .join(', ')}.`,
    }
  }
  return {
    tag: 'no effect',
    why: `Returned ${[...fact.produced.keys()].join(', ')} whatever was asked.`,
  }
}

export default function FixedParam({ label, reason }) {
  const { tag, why } = describe(reason)
  return (
    <div className="param param--fixed" title={why}>
      <div className="param__head">
        <span className="label label--sm">{label.text}</span>
        <span className="data data--sm">{tag}</span>
      </div>
    </div>
  )
}
