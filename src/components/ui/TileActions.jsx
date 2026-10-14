import { CornerUpLeft, Download, ImagePlus } from 'lucide-react'
import { urlFor } from '../../store/urls.js'
import { canBeReference, downloadName } from '../../format.js'

/**
 * Per-image actions, revealed on hover and reachable by keyboard. They sit in
 * a tile that opens the viewer on click, so each stops the event reaching it.
 * Deleting lives in the viewer, where it can be armed and seen.
 */

export default function TileActions({ image, onReuse, onUseAsRef }) {
  const asRef = onUseAsRef && image.kind !== 'video' && canBeReference(image.format || image.media_type)
  return (
    <div className="actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {onReuse && (
        <button className="act" title="Reuse prompt and settings" aria-label="Reuse prompt and settings" onClick={() => onReuse(image)}>
          <CornerUpLeft size={16} aria-hidden="true" />
        </button>
      )}
      {asRef && (
        <button className="act" title="Use as a reference" aria-label="Use as a reference" onClick={() => onUseAsRef(image)}>
          <ImagePlus size={16} aria-hidden="true" />
        </button>
      )}
      <a className="act" href={urlFor(image)} download={downloadName(image)} title={`Save ${downloadName(image)}`} aria-label="Save to disk">
        <Download size={16} aria-hidden="true" />
      </a>
    </div>
  )
}
