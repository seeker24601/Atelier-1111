import { pad } from '../format.js'

const VIEWS = [
  { id: 'image', text: 'Image' },
  { id: 'video', text: 'Video' },
]

/**
 * What the key can still spend, as OpenRouter counts it: the remaining limit
 * when the key has one, otherwise today's usage — an unlimited key's only
 * meaningful running figure.
 */
function keyFigure(account) {
  if (!account) return null
  if (account.remaining != null) return { label: 'Left', value: `$${account.remaining.toFixed(2)}` }
  if (account.daily != null) return { label: 'Today', value: `$${account.daily.toFixed(3)}` }
  return null
}

export default function TopBar({ activeJobs, spend, keyStatus, account, view, onView, onOpenSettings }) {
  const figure = keyStatus.configured ? keyFigure(account) : null
  return (
    <header className="topbar">
      <span className="topbar__mark">Atelier—1111</span>

      {/* Two catalogues, two pipelines. The tab is the only place the app is
          told which one it is working in. */}
      <nav className="tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className="tab"
            aria-pressed={view === v.id}
            onClick={() => onView(v.id)}
          >
            {v.text}
          </button>
        ))}
      </nav>

      <div className="topbar__spacer" />

      {activeJobs.length > 0 && (
        <div className="topbar__cell">
          <span className="label label--sm dim">Running</span>
          <span className="data live">{pad(activeJobs.length)}</span>
        </div>
      )}

      {/* The key's own figure when OpenRouter reports one; this app's tally otherwise. */}
      <div className="topbar__cell" title={figure ? `This app: $${spend.toFixed(3)}` : undefined}>
        <span className="label label--sm dim">{figure ? figure.label : 'Spend'}</span>
        <span className="data">{figure ? figure.value : `$${spend.toFixed(3)}`}</span>
      </div>

      {/* No key material in the chrome — not even a masked hint. */}
      <button className="topbar__cell topbar__cell--action" onClick={onOpenSettings}>
        <span className="label label--sm dim">{keyStatus.configured ? 'Key set' : 'No key'}</span>
        <span className="data">Settings</span>
      </button>
    </header>
  )
}
