import { useEffect, useRef, useState } from 'react'
import { urlFor } from '../store/urls.js'
import { dollars } from '../format.js'
import { makerOf } from '../makers.js'
import Logo from './ui/Logo.jsx'
import TileActions from './ui/TileActions.jsx'
import PendingTile from './ui/PendingTile.jsx'
import FailedTile from './ui/FailedTile.jsx'
import Reveal from './ui/Reveal.jsx'

const REVEAL_MS = 700

/**
 * The plate grid: work in flight first, where its result will land, then the
 * finished plates and the failed jobs in the order they were made. With
 * nothing at all, the first slot is drawn as an outline.
 */
export default function Gallery({
  kind = 'image',
  images,
  pending = [],
  failures = [],
  nameFor,
  usualFor,
  onOpen,
  onReuse,
  onUseAsRef,
  onFix,
  onDismiss,
}) {
  // An image whose job was seen running lands through the pixel grid.
  const running = useRef(new Set())
  const [fresh, setFresh] = useState(() => new Set())
  useEffect(() => {
    for (const j of pending) running.current.add(j.id)
  }, [pending])
  useEffect(() => {
    const landed = images.filter((i) => i.job_id && running.current.has(i.job_id)).map((i) => i.id)
    if (!landed.length) return
    for (const i of images) if (i.job_id) running.current.delete(i.job_id)
    setFresh((f) => new Set([...f, ...landed]))
    const t = setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !landed.includes(id)))), REVEAL_MS)
    return () => clearTimeout(t)
  }, [images])

  const items = [
    ...images.map((img) => ({ at: img.created_at, img })),
    ...failures.map((job) => ({ at: job.created_at, job })),
  ].sort((a, b) => b.at - a.at)

  return (
    <div className="gallery">
      {pending.map((job) => (
        <PendingTile key={job.id} job={job} name={nameFor(job.model)} usualMs={usualFor(job.model, job.kind)} />
      ))}

      {!pending.length && !items.length && (
        <article className="tile tile--empty" aria-label={kind === 'video' ? 'No clips yet' : 'No images yet'}>
          <div className="tile__frame">
            <span className="label dim">{kind === 'video' ? 'No clips yet' : 'No images yet'}</span>
          </div>
          <div className="tile__meta">
            <span className="tile__prompt">Your first one lands here.</span>
          </div>
        </article>
      )}

      {items.map(({ img, job }) =>
        job ? (
          <FailedTile key={`f-${job.id}`} job={job} name={nameFor(job.model)} onFix={onFix} onDismiss={onDismiss} />
        ) : (
          <article
            className="tile"
            key={img.id}
            onClick={() => onOpen(img)}
            role="button"
            tabIndex={0}
            title={img.prompt}
            aria-label={`Open: ${img.prompt}`}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && onOpen(img)}
          >
            <div className="tile__frame">
              {img.kind === 'video' ? (
                <video
                  src={urlFor(img)}
                  preload="metadata"
                  muted
                  playsInline
                  controls
                  /* Without a poster the element paints blank; stepping just past
                     the start makes the browser decode a real frame to show. */
                  onLoadedMetadata={(e) => {
                    e.currentTarget.currentTime = 0.1
                  }}
                />
              ) : (
                <img src={urlFor(img)} alt={img.prompt} loading="lazy" decoding="async" />
              )}
              {fresh.has(img.id) && <Reveal />}
              <TileActions image={img} onReuse={onReuse} onUseAsRef={onUseAsRef} />
            </div>
            <div className="tile__meta">
              <div className="tile__row">
                <span className="tile__model">
                  <Logo id={makerOf(img.model)} />
                  <span className="label">{nameFor(img.model)}</span>
                </span>
                <span className="data">{dollars(img.cost)}</span>
              </div>
              <span className="tile__prompt">{img.prompt}</span>
            </div>
          </article>
        )
      )}
    </div>
  )
}
