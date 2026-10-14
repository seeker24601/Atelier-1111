import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

/**
 * What to do with the plates ticked in the gallery. Sits at the foot of the
 * workspace while anything is selected. Delete arms first, as in the viewer.
 */
export default function SelectionBar({ count, total, busy, onSelectAll, onClear, onDownload, onDelete }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  // A different selection is a different delete.
  useEffect(() => setArmed(false), [count])

  return (
    <div className="selbar" role="toolbar" aria-label="Selected plates">
      <button className="btn btn--icon" onClick={onClear} title="Clear selection (Esc)" aria-label="Clear selection">
        <X size={16} aria-hidden="true" />
      </button>
      <span className="label" aria-live="polite">
        {count} selected
      </span>
      <button className="btn btn--sm" onClick={onSelectAll} disabled={count === total}>
        Select all
      </button>
      <span className="spacer" />
      <button className="btn" onClick={onDownload} disabled={busy}>
        {busy ? <span className="wait" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        Download
      </button>
      <button
        className={`btn${armed ? ' btn--armed' : ''}`}
        onClick={() => (armed ? onDelete() : setArmed(true))}
        disabled={busy}
        title={armed ? 'Click again to delete for good' : undefined}
      >
        {armed ? `Confirm delete` : 'Delete'}
      </button>
    </div>
  )
}
