import { useEffect, useRef, useState } from 'react'
import { urlFor } from '../store/urls.js'
import { dollars } from '../format.js'
import { makerOf } from '../makers.js'
import Logo from './ui/Logo.jsx'
import TileActions from './ui/TileActions.jsx'
import PendingTile from './ui/PendingTile.jsx'
import FailedTile from './ui/FailedTile.jsx'
import Tick from './ui/Tick.jsx'
import { plateOrder } from '../selection.js'
import Reveal from './ui/Reveal.jsx'

const REVEAL_MS = 700

/**
 * The plate grid: work in flight first, where its result will land, then the
 * finished plates and the failed jobs in the order they were made. With
 * nothing at all, the first slot is drawn as an outline.
 *
 * Finished plates and failed jobs can be selected. In select mode a click
 * ticks; outside it, the box in a plate's corner, Shift or Ctrl/Cmd-click
 * tick one and turn the mode on. `box` is the drag box in progress, and
 * `plates` the shared order of plates and failed jobs.
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
  plates,
  gridRef,
  box = null,
  selecting = false,
  selected = new Set(),
  onToggle,
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

  const items = plates ?? plateOrder(images, failures)
  // In select mode any click ticks; outside it, Shift or Ctrl/Cmd-click does.
  const ticks = (e) => selecting || e.shiftKey || e.ctrlKey || e.metaKey

  return (
    <div className={`gallery${selecting ? ' is-selecting' : ''}`} ref={gridRef}>
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

      {items.map(({ key, img, job }) =>
        job ? (
          <FailedTile
            key={key}
            job={job}
            name={nameFor(job.model)}
            onFix={onFix}
            onDismiss={onDismiss}
            selectKey={key}
            selecting={selecting}
            selected={selected.has(key)}
            onToggle={onToggle}
          />
        ) : (
          <article
            className={`tile${selected.has(key) ? ' is-selected' : ''}`}
            key={key}
            data-select-id={key}
            onClick={(e) => (ticks(e) ? onToggle(key, { range: e.shiftKey }) : onOpen(img))}
            role="button"
            tabIndex={0}
            title={img.prompt}
            aria-label={`${selecting ? 'Select' : 'Open'}: ${img.prompt}`}
            aria-pressed={selecting ? selected.has(key) : undefined}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                e.preventDefault()
                if (selecting) onToggle(key, { range: e.shiftKey })
                else onOpen(img)
              }
            }}
          >
            <div className="tile__frame">
              <Tick checked={selected.has(key)} onToggle={(range) => onToggle(key, { range })} />
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
                <img src={urlFor(img)} alt={img.prompt} loading="lazy" decoding="async" draggable={false} />
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

      {box && (
        <div className="marquee" aria-hidden="true" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
      )}
    </div>
  )
}
