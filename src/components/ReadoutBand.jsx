import { perMillion, plural, priceLabel, releaseDate, shortModel, tokens } from '../format.js'
import { makerOf, modelName } from '../makers.js'
import Logo from './ui/Logo.jsx'
import { useScramble } from './ui/useScramble.js'

/**
 * The model heads the workspace, with its facts on the line beneath. Cells
 * appear only when they carry a fact — an empty reference slot is not
 * information, and what the next commit will do is already stated by the
 * commit button and, once running, by the activity readout.
 *
 * Select (Done while it is on) switches the gallery's select mode.
 */
export default function ReadoutBand({ models, model, runs = [], kind = 'image', selecting = false, canSelect = false, onSelectMode }) {
  const active = models.find((m) => m.id === model)
  // The name in the display face; it scrambles into place when the model changes.
  const name = active ? modelName(active) : model ? shortModel(model) : 'No model'
  const shown = useScramble(name)
  const pricing = active?.pricing || {}

  const measured = runs.filter((r) => r.cost != null)
  const measuredAvg = measured.length
    ? measured.reduce((s, r) => s + r.cost, 0) / measured.length
    : null
  const rate = pricing.imageOutput ?? pricing.imageToken ?? pricing.completion

  const cells = [
    {
      label: 'Price',
      value: priceLabel({ pricing, measuredAvg, kind }),
      // The published rate stays reachable once the headline switches to measured.
      title: measuredAvg
        ? `Measured across ${plural(measured.length, 'run').toLowerCase()}${
            kind === 'video' ? '' : ` · published ${perMillion(rate)}/M output tokens`
          }`
        : kind === 'video'
          ? 'OpenRouter reports no rate for video models — cost is only known after a run'
          : 'Published image-output rate, per token',
    },
    { label: 'Released', value: releaseDate(active?.created), title: 'Added to OpenRouter' },
  ]

  /**
   * Output size is a property of the model, not something `resolution` can ask
   * for — recraft's -pro tiers *are* the 2K tiers. Measured pixels win over the
   * vendor's prose; the cell is omitted entirely when neither is known, rather
   * than showing a placeholder.
   */
  // Video models all report a context length of 0, which is not a fact about
  // them — the cell is dropped rather than printed as a zero.
  if (active?.contextLength) {
    cells.push({ label: 'Context', value: tokens(active.contextLength), title: 'Context window' })
  }

  const clips = runs.filter((r) => r.seconds != null)
  if (clips.length) {
    const lengths = [...new Set(clips.map((r) => r.seconds))].sort((a, b) => a - b)
    cells.push({
      label: 'Length',
      value: `${lengths.join('/')}s`,
      title: `Measured across ${plural(clips.length, 'clip').toLowerCase()}`,
    })
  }

  const sized = runs.filter((r) => r.width && r.height)
  if (sized.length) {
    const longest = Math.max(...sized.map((r) => Math.max(r.width, r.height)))
    cells.push({
      label: 'Output',
      value: `${longest}px`,
      title: `Longest side measured across ${plural(sized.length, 'run').toLowerCase()}`,
    })
  } else if (active?.nativeResolution) {
    cells.push({
      label: 'Output',
      value: active.nativeResolution,
      title: 'Stated by the vendor — not yet measured here',
    })
  }

  return (
    <div className="readout">
      <div className="readout__name">
        <Logo id={makerOf(model)} size="lg" />
        <h1 className="plate-title" aria-label={name}>
          {shown}
        </h1>
        <span className="spacer" />
        {(canSelect || selecting) && (
          <button className="btn btn--sm" aria-pressed={selecting} onClick={onSelectMode}>
            {selecting ? 'Done' : 'Select'}
          </button>
        )}
      </div>

      <div className="readout-meta">
        {cells.map((c) => (
          <div className="meta-cell" key={c.label} title={c.title}>
            <span className="label label--sm dim">{c.label}</span>
            <span className={`data ${c.live ? 'live' : ''}`}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
