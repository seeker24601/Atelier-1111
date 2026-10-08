import { useEffect, useState } from 'react'
import { urlFor } from '../../store/urls.js'
import { extensionOf, shortModel } from '../../format.js'

/**
 * Per-image controls, revealed on hover. Both sit inside a tile that opens the
 * detail view on click, so every handler stops the event from reaching it.
 *
 * Delete arms on the first click rather than acting on it: these are 24px
 * targets on a dense grid, the gallery is the only copy of the image, and there
 * is no undo. The armed state is spelled, not coloured.
 */

const GLYPH = {
  reuse: 'M12.5 8A4.5 4.5 0 1 1 8 3.5h2.5M8.5 1.5l2 2-2 2',
  download: 'M8 2.5v6.5M4.75 6.25 8 9.5l3.25-3.25M3 13h10',
  remove: 'M4 4l8 8M12 4l-8 8',
}

/** Named from the measured format, not from what was asked for. */
const nameFor = (image) =>
  `${shortModel(image.model).toLowerCase()}-${image.id.slice(0, 8)}.${extensionOf(image)}`

function Glyph({ name }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d={GLYPH[name]} fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export default function TileActions({ image, onRemove, onReuse }) {
  const [armed, setArmed] = useState(false)

  // Disarm on its own, so a tile left armed does not stay a hair-trigger.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <div className="tile__actions" onClick={(e) => e.stopPropagation()}>
      {onReuse && (
        <button className="tile__act" title="Reuse prompt and settings" onClick={() => onReuse(image)}>
          <Glyph name="reuse" />
        </button>
      )}
      <a
        className="tile__act"
        href={urlFor(image)}
        download={nameFor(image)}
        title={`Download ${nameFor(image)}`}
      >
        <Glyph name="download" />
      </a>

      <button
        className="tile__act"
        data-armed={armed ? 'true' : undefined}
        title={armed ? 'Click again to delete' : 'Delete'}
        onClick={() => (armed ? onRemove(image) : setArmed(true))}
        onBlur={() => setArmed(false)}
      >
        {armed ? <span className="tile__act-word">del</span> : <Glyph name="remove" />}
      </button>
    </div>
  )
}
