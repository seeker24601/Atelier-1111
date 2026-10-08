import ReadoutBand from './ReadoutBand.jsx'
import Gallery from './Gallery.jsx'
import Specimen from './Specimen.jsx'

/**
 * The right-hand column: what the selected model is, and what came out.
 * Work in flight sits in the grid where its result will land.
 */
export default function Workspace({ kind = 'image', library, composer, settings, runs, onOpen, onRemove }) {
  const working = library.activeJobs.length > 0

  return (
    <main className="workspace">
      <ReadoutBand models={library.models} model={composer.model} runs={runs} kind={kind} />

      {library.images.length || working ? (
        <Gallery
          images={library.images}
          onOpen={onOpen}
          onRemove={onRemove}
          onReuse={composer.reuse}
          pending={library.activeJobs}
        />
      ) : (
        <Specimen kind={kind} settings={settings} />
      )}
    </main>
  )
}
