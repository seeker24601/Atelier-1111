import { useState } from 'react'
import Plate from './ui/Plate.jsx'

const mb = (n) => (n == null ? '——' : `${(n / 1048576).toFixed(1)} MB`)
const gb = (n) => (n == null ? '——' : `${(n / 1073741824).toFixed(1)} GB`)

/**
 * Where the generations live — plain files in the app's data folder — and the
 * one control that empties it. The capability ledger is kept: it records what
 * models do, not what you made.
 */
export default function StoragePanel({ storage, count, onClear }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <Plate id="03 / Storage">
      <dl className="facts">
        <dt>Generations</dt>
        <dd>{count}</dd>
        <dt>Size</dt>
        <dd>{mb(storage?.bytes)}</dd>
        <dt>Disk free</dt>
        <dd>{gb(storage?.free)}</dd>
        <dt>Folder</dt>
        <dd title={storage?.dir}>{storage?.dir ?? '——'}</dd>
      </dl>

      {/* An explicit two-button confirm rather than a control that arms and
          then quietly disarms: in a settings panel that reads as broken. */}
      <div className="row">
        {confirming ? (
          <>
            <button className="btn btn--ink" style={{ flex: 1 }} onClick={() => onClear().then(() => setConfirming(false))}>
              Delete {count} for good
            </button>
            <button className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn" style={{ flex: 1 }} disabled={!count} onClick={() => setConfirming(true)}>
            Clear history
          </button>
        )}
      </div>
    </Plate>
  )
}
