import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/**
 * What to do with what is ticked, at the foot of the workspace for as long as
 * select mode is on. Download takes the plates (a failed job has no file);
 * Delete takes plates and failed jobs, and arms first as the viewer's does.
 */
export default function SelectionBar({ count, total, files, busy, onSelectAll, onDownload, onDelete }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  // A different selection is a different delete.
  useEffect(() => setArmed(false), [count])

  return (
    <div className="selbar" role="toolbar" aria-label="Selection">
      <span className="label" aria-live="polite">
        {count} selected
      </span>
      <button className="btn btn--sm" onClick={onSelectAll} disabled={count === total}>
        Select all
      </button>
      <span className="spacer" />
      <button className="btn" onClick={onDownload} disabled={busy || files === 0}>
        {busy ? <span className="wait" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        Download
      </button>
      <button
        className={`btn${armed ? ' btn--armed' : ''}`}
        onClick={() => (armed ? onDelete() : setArmed(true))}
        disabled={busy || count === 0}
        title={armed ? 'Click again to delete for good' : undefined}
      >
        {armed ? 'Confirm delete' : 'Delete'}
      </button>
    </div>
  )
}
