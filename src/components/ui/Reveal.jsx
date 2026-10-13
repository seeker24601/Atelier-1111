/**
 * A new image takes the same 16×16 grid the decode field used, pixel by pixel,
 * in a shuffled order: 256 squares that vanish in 12 steps (35ms apart, or
 * 14ms when browsing in the viewer). Drawn over the image for a moment.
 */
const ORDER = (() => {
  let x = 7
  const out = []
  for (let i = 0; i < 256; i++) {
    x = (x * 9301 + 49297) % 233280
    out.push(Math.floor((x / 233280) * 12))
  }
  return out
})()

export default function Reveal({ fast = false }) {
  return (
    <span className={`reveal${fast ? ' reveal--fast' : ''}`} aria-hidden="true">
      {ORDER.map((d, i) => (
        <i key={i} style={{ '--d': d }} />
      ))}
    </span>
  )
}
