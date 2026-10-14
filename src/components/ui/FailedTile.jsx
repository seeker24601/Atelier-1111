import { ExternalLink } from 'lucide-react'
import Logo from './Logo.jsx'
import DecodeField from './DecodeField.jsx'
import Tick from './Tick.jsx'
import { makerOf } from '../../makers.js'
import { describeFailure } from '../../failures.js'

const seedOf = (id) => [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 11)

/**
 * A job that failed, where its image would have been. The field froze where it
 * broke. Said in words: what went wrong and the one move that fixes it; the
 * provider's own message is one click away rather than the headline.
 *
 * It can be selected like a plate, to delete it with others. In select mode
 * the whole tile ticks and its own buttons step aside.
 */
export default function FailedTile({ job, name, onFix, onDismiss, selectKey, selecting = false, selected = false, onToggle }) {
  const f = describeFailure(job.error)
  const fixLabel = f.fix === 'ref' ? 'Add a reference' : f.fix === 'settings' ? 'Open Settings' : job.refs?.length ? 'Load it again' : 'Retry'

  return (
    <article
      className={`tile tile--failed${selected ? ' is-selected' : ''}`}
      aria-label={`Failed: ${f.title}`}
      data-select-id={selectKey}
      onClick={(e) => {
        if (selecting || e.shiftKey || e.ctrlKey || e.metaKey) onToggle(selectKey, { range: e.shiftKey })
      }}
    >
      <div className="tile__frame">
        <Tick checked={selected} onToggle={(range) => onToggle(selectKey, { range })} />
        <DecodeField seed={seedOf(job.id)} frozen />
        <div className="fail">
          <p className="fail__title">{f.title}</p>
          <p className="fail__detail">{f.detail}</p>
          <div className="fail__acts">
            <button className="btn" onClick={() => onFix(job, f.fix)}>
              {fixLabel}
            </button>
            {f.link && (
              <a className="btn btn--quiet inline-icon" href={f.link} target="_blank" rel="noreferrer">
                Details
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            <button className="btn btn--quiet" onClick={() => onDismiss(job)}>
              Dismiss
            </button>
          </div>
          {job.error && (
            <details className="why">
              <summary>What the provider said</summary>
              <p>{job.error}</p>
            </details>
          )}
        </div>
      </div>
      <div className="tile__meta">
        <div className="tile__row">
          <span className="tile__model">
            <Logo id={makerOf(job.model)} />
            <span className="label">{name}</span>
          </span>
          <span className="data">Failed</span>
        </div>
        <span className="tile__prompt">{job.prompt}</span>
      </div>
    </article>
  )
}
