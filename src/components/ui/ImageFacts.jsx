import { dollars, stamp } from '../../format.js'

function Row({ k, v }) {
  return (
    <div className="kv">
      <span className="label label--sm dim">{k}</span>
      <span className="kv__v">{v}</span>
    </div>
  )
}

/** Everything known about one image, measured rather than requested. */
export default function ImageFacts({ image, params, refs }) {
  const kb = Math.round(image.bytes / 1024)
  const shapes = refs.filter((r) => r.width).map((r) => `${r.width}×${r.height}`)

  return (
    <div>
      <Row k="Model" v={image.model} />
      <Row k="Created" v={stamp(image.created_at)} />
      <Row k="Cost" v={dollars(image.cost)} />
      <Row k="File" v={`${image.media_type} · ${kb} KB`} />
      {/* Measured from the bytes, not from what was requested. */}
      <Row
        k="Measured"
        v={
          image.width
            ? [
                `${image.width}×${image.height}`,
                image.format || '——',
                image.seconds != null ? `${image.seconds}s` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : '——'
        }
      />
      {image.note && <Row k="Note" v={image.note} />}
      {/* The reference's own size, which is what some models copy instead of
          the aspect ratio that was asked for. */}
      <Row
        k="Refs"
        v={refs.length ? [refs.length, ...shapes].join(' · ') : '——'}
      />
      {Object.entries(params).map(([k, v]) => (
        <Row key={k} k={k.replace(/_/g, ' ')} v={String(v)} />
      ))}
    </div>
  )
}
