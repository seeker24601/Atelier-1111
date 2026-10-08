import { useEffect } from 'react'
import { urlFor } from '../store/urls.js'
import { canBeReference, extensionOf, shortModel } from '../format.js'
import ImageFacts from './ui/ImageFacts.jsx'

/**
 * Whether the model used the reference is the one thing the app cannot decode —
 * the request succeeds either way and the bytes look identical. So it is asked
 * here, once, and the answer is recorded against the model.
 */
function ReferenceReport({ model, verdict, onReport }) {
  return (
    <div className="stack-sm">
      <span className="label label--sm dim">Reference</span>
      <div className="row" style={{ gap: 8 }}>
        {['ok', 'ignored'].map((v) => (
          <button
            key={v}
            className="btn btn--ghost btn--sm"
            style={{ flex: 1 }}
            aria-pressed={verdict === v}
            onClick={() => onReport(model, v)}
          >
            {v === 'ok' ? 'Used' : 'Ignored'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ImageDetail({
  image,
  position = null,
  onStep,
  onClose,
  onUseAsRef,
  onReuse,
  onDelete,
  refVerdict,
  onReportRef,
}) {
  useEffect(() => {
    if (!image) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onStep?.(-1)
      else if (e.key === 'ArrowRight') onStep?.(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [image, onClose, onStep])

  if (!image) return null
  const params = image.params || {}
  const refs = image.refs || []
  const raster = canBeReference(image.format || image.media_type)

  return (
    <div className="detail">
      <header className="detail__head">
        <div className="row" style={{ gap: 16 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => onStep?.(-1)} aria-label="Previous">
            ←
          </button>
          <span className="plate__id">{shortModel(image.model)}</span>
          {position && <span className="plate__id dim">{position}</span>}
          <button className="btn btn--ghost btn--sm" onClick={() => onStep?.(1)} aria-label="Next">
            →
          </button>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} title="Esc">
          ×
        </button>
      </header>

      <div className="detail__split">
        <div className="detail__stage">
          {image.kind === 'video' ? (
            <video key={image.id} src={urlFor(image)} controls autoPlay loop playsInline />
          ) : (
            <img src={urlFor(image)} alt={image.prompt} />
          )}
        </div>

        <aside className="detail__side">
          <p className="prose">{image.prompt}</p>

          <ImageFacts image={image} params={params} refs={refs} />

          {refs.length > 0 && (
            <ReferenceReport model={image.model} verdict={refVerdict} onReport={onReportRef} />
          )}

          <div className="stack-sm">
            <button
              className="btn btn--commit"
              disabled={!raster}
              title={raster ? undefined : 'Vector — models take raster references only'}
              onClick={() => onUseAsRef(image)}
            >
              <span>Use as reference</span>
              <span>→</span>
            </button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => onReuse(image)}>
                <span>Reuse</span>
                <span>↺</span>
              </button>
              <a
                className="btn btn--ghost"
                style={{ flex: 1, textDecoration: 'none' }}
                href={urlFor(image)}
                download={`atelier-${image.id.slice(0, 8)}.${extensionOf(image)}`}
              >
                <span>Save</span>
                <span>↓</span>
              </a>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => onDelete(image)}>
                <span>Delete</span>
                <span>×</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
