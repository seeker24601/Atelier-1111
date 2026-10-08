import { urlFor } from '../store/urls.js'
import { dollars, shortModel } from '../format.js'
import TileActions from './ui/TileActions.jsx'
import PendingTile from './ui/PendingTile.jsx'

/** The plate grid. The empty case is Specimen's job, not this component's. */
export default function Gallery({ images, onOpen, onRemove, onReuse, pending = [] }) {
  return (
    <div className="gallery">
      {/* Work in flight sits where its result will land, newest first. */}
      {pending.map((job) => (
        <PendingTile key={job.id} job={job} />
      ))}
      {images.map((img) => (
        <article
          className="tile crop"
          key={img.id}
          onClick={() => onOpen(img)}
          role="button"
          tabIndex={0}
          title={img.prompt}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(img)}
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
            <TileActions image={img} onRemove={onRemove} onReuse={onReuse} />
          </div>
          <div className="tile__meta">
            <div className="row row--between">
              <span className="data data--sm">{shortModel(img.model)}</span>
              <span className="data data--sm dim">{dollars(img.cost)}</span>
            </div>
            <span className="data data--sm dim truncate">{img.prompt}</span>
          </div>
        </article>
      ))}
    </div>
  )
}
