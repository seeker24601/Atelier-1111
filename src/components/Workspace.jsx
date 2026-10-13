import ReadoutBand from './ReadoutBand.jsx'
import Gallery from './Gallery.jsx'

/**
 * The right-hand column: what the selected model is, and what came out.
 * Work in flight sits in the grid where its result will land.
 */
export default function Workspace({ kind = 'image', models, model, runs, gallery }) {
  return (
    <main className="workspace">
      <ReadoutBand models={models} model={model} runs={runs} kind={kind} />
      <Gallery kind={kind} {...gallery} />
    </main>
  )
}
