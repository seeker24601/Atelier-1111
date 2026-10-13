import { useEffect, useRef, useState } from 'react'
import Logo from './Logo.jsx'
import DecodeField from './DecodeField.jsx'
import { makerOf } from '../../makers.js'

const POLL_MS = 1500

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const seedOf = (id) => [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7)

/**
 * A tile for work still running, holding the place the result will take.
 *
 * The decode field runs while nothing is drawn yet, settling as the job nears
 * this model's usual time. Where a model streams partial frames, the real
 * image forming replaces it: the same bytes it has drawn so far, swapped as
 * newer ones arrive.
 */
export default function PendingTile({ job, name, usualMs }) {
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
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - job.created_at) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [job.created_at])

  const queued = job.status === 'queued'
  return (
    <article className="tile tile--pending" title={job.prompt} aria-label={`${name}: ${queued ? 'queued' : 'generating'}`}>
      <div className="tile__frame">
        <DecodeField seed={seedOf(job.id)} progress={queued ? 0 : (elapsed * 1000) / usualMs} />
        {frame && <img src={frame} alt="" className="tile__partial" />}
      </div>
      <div className="tile__meta">
        <div className="tile__row">
          <span className="tile__model">
            <Logo id={makerOf(job.model)} />
            <span className="label">{name}</span>
          </span>
          <span className="data live">{queued ? 'queued' : clock(elapsed)}</span>
        </div>
        <span className="tile__prompt">{job.kind === 'video' ? 'Takes minutes. Keeps going if you quit.' : job.prompt}</span>
      </div>
    </article>
  )
}
