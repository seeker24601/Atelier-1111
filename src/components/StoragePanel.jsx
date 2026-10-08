import { useState } from 'react'

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
    <section className="settings__col">
      <span className="plate-title">Storage</span>

      <div className="proc proc--state" style={{ marginTop: 20 }}>
        <div className="proc__row">
          <span className="label label--sm dim">Generations</span>
          <span className="data">{count}</span>
        </div>
        <div className="proc__row">
          <span className="label label--sm dim">Size</span>
          <span className="data">{mb(storage?.bytes)}</span>
        </div>
        <div className="proc__row">
          <span className="label label--sm dim">Disk free</span>
          <span className="data">{gb(storage?.free)}</span>
        </div>
        <div className="proc__row">
          <span className="label label--sm dim">Folder</span>
          <span className="data truncate" title={storage?.dir}>{storage?.dir ?? '——'}</span>
        </div>
      </div>

      {/* An explicit two-button confirm rather than a control that arms and
          then quietly disarms — in a settings panel that reads as broken. */}
      <div className="row" style={{ gap: 8, marginTop: 16 }}>
        {confirming ? (
          <>
            <button
              className="btn btn--ghost btn--danger"
              style={{ flex: 1 }}
              onClick={() => onClear().then(() => setConfirming(false))}
            >
              <span>Delete {count} for good</span>
              <span>×</span>
            </button>
            <button className="btn btn--ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn btn--ghost"
            style={{ flex: 1 }}
            disabled={!count}
            onClick={() => setConfirming(true)}
          >
            <span>Clear history</span>
            <span>×</span>
          </button>
        )}
      </div>
    </section>
  )
}
