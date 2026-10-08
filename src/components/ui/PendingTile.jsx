import { useEffect, useRef, useState } from 'react'
import { shortModel } from '../../format.js'

const POLL_MS = 1500

/**
 * A tile for work still running, holding the place the result will take.
 *
 * Where a model streams partial frames, this is the real image forming rather
 * than a placeholder — the same bytes it has drawn so far, replaced as newer
 * ones arrive. Models that send no partials simply never resolve a frame and
 * the tile stays a marked-out box, which is still better than the grid
 * silently doing nothing for two minutes.
 */
export default function PendingTile({ job }) {
  const [frame, setFrame] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const current = useRef(null)

  useEffect(() => {
    let live = true

    const poll = async () => {
      try {
        const res = await fetch(`/api/output/${job.id}/preview`)
        if (!res.ok || !live) return
        const url = URL.createObjectURL(await res.blob())
        // Revoke the frame this replaces, or every partial leaks.
        if (current.current) URL.revokeObjectURL(current.current)
        current.current = url
        setFrame(url)
      } catch {
        // A preview is optional; a failed poll is not worth reporting.
      }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => {
      live = false
      clearInterval(t)
      if (current.current) URL.revokeObjectURL(current.current)
      current.current = null
    }
  }, [job.id])

  useEffect(() => {
    const tick = () => setElapsed(Math.round((Date.now() - job.created_at) / 1000))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [job.created_at])

  return (
    <article className="tile tile--pending crop" title={job.prompt}>
      <div className="tile__frame">
        {frame ? (
          <img src={frame} alt="" className="tile__partial" />
        ) : (
          <span className="tile__wait" aria-hidden="true" />
        )}
      </div>
      <div className="tile__meta">
        <div className="row row--between">
          <span className="data data--sm">{shortModel(job.model)}</span>
          <span className="data data--sm live">{job.status === 'queued' ? 'queued' : `${elapsed}s`}</span>
        </div>
        <span className="data data--sm dim truncate">{job.prompt}</span>
      </div>
    </article>
  )
}
