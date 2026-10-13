import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CornerUpLeft, X } from 'lucide-react'
import { urlFor } from '../store/urls.js'
import { canBeReference, extensionOf, shortModel } from '../format.js'
import { makerOf } from '../makers.js'
import Logo from './ui/Logo.jsx'
import Reveal from './ui/Reveal.jsx'
import ImageFacts from './ui/ImageFacts.jsx'

const CLOSE_MS = 120
const FUSE_MS = 3000

/**
 * Whether the model used the reference is the one thing the app cannot decode —
 * the request succeeds either way and the bytes look identical. So it is asked
 * here, once, and the answer is recorded against the model.
 */
function ReferenceReport({ model, verdict, onReport }) {
  return (
    <div className="stack-sm">
      <span className="label dim">Did it use the reference?</span>
      <div className="row">
        {['ok', 'ignored'].map((v) => (
          <button key={v} className="btn" style={{ flex: 1 }} aria-pressed={verdict === v} onClick={() => onReport(model, v)}>
            {v === 'ok' ? 'Used' : 'Ignored'}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * One image, large, with everything needed to act on it. It switches on like a
 * tube (a line, then the frame) and off the same way; stepping to the next
 * image lands it through the pixel grid. Delete arms first, and the armed
 * button burns down for three seconds before it disarms itself.
 */
export default function ImageDetail({
  image,
  name,
  position = null,
  onStep,
  onClose,
  onUseAsRef,
  onReuse,
  onDelete,
  refVerdict,
  onReportRef,
}) {
  const [closing, setClosing] = useState(false)
  const [armed, setArmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [landing, setLanding] = useState(false)

  const close = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onClose()
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, CLOSE_MS)
  }

  // Every image shown lands through the grid, fast; an armed delete disarms.
  useEffect(() => {
    if (!image) return
    setArmed(false)
    setCopied(false)
    setLanding(true)
    const t = setTimeout(() => setLanding(false), 220)
    return () => clearTimeout(t)
  }, [image?.id])

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), FUSE_MS)
    return () => clearTimeout(t)
  }, [armed])

  useEffect(() => {
    if (!image) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') onStep?.(-1)
      else if (e.key === 'ArrowRight') onStep?.(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [image, onStep])

  if (!image) return null
  const params = image.params || {}
  const refs = image.refs || []
  const raster = image.kind !== 'video' && canBeReference(image.format || image.media_type)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(image.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard refused (no focus, no permission): nothing to show.
    }
  }

  return (
    <div className={`detail${closing ? ' is-closing' : ''}`} role="dialog" aria-label="Image">
      <div className="stage">
        {position && <span className="stage__count">{position}</span>}
        <span className="stage__media">
          {image.kind === 'video' ? (
            <video key={image.id} src={urlFor(image)} controls autoPlay loop playsInline />
          ) : (
            <img src={urlFor(image)} alt={image.prompt} />
          )}
          {landing && image.kind !== 'video' && <Reveal fast />}
        </span>
        <button className="nav nav--prev" onClick={() => onStep?.(-1)} aria-label="Previous image">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button className="nav nav--next" onClick={() => onStep?.(1)} aria-label="Next image">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <aside className="side" aria-label="About this image">
        <div className="side__head">
          <Logo id={makerOf(image.model)} size="md" />
          <span className="label">{name ?? shortModel(image.model)}</span>
          <button className="close" onClick={close} aria-label="Close" title="Esc">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="side__body">
          <p className="prose side__prompt">{image.prompt}</p>

          <div className="btns">
            <button className="btn btn--span" onClick={() => onReuse(image)}>
              <CornerUpLeft size={16} aria-hidden="true" />
              Reuse prompt
            </button>
            <button className="btn" onClick={copy}>
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
            <button
              className="btn"
              disabled={!raster}
              title={raster ? undefined : 'Vector or video: models take raster references only'}
              onClick={() => onUseAsRef(image)}
            >
              Use as reference
            </button>
            <a className="btn" href={urlFor(image)} download={`atelier-${image.id.slice(0, 8)}.${extensionOf(image)}`}>
              Save
            </a>
            <button
              className={`btn${armed ? ' btn--armed' : ''}`}
              onClick={() => (armed ? onDelete(image) : setArmed(true))}
              title={armed ? 'Click again to delete for good' : 'Delete'}
            >
              {armed ? 'Confirm delete' : 'Delete'}
            </button>
          </div>

          {refs.length > 0 && <ReferenceReport model={image.model} verdict={refVerdict} onReport={onReportRef} />}

          <ImageFacts image={image} params={params} refs={refs} />
        </div>
      </aside>
    </div>
  )
}
