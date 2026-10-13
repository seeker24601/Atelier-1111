import { useEffect, useRef } from 'react'

/**
 * The generating animation: a 16×16 field of dark pixels, each cycling through
 * its own short loop of greys at one of four co-prime speeds, so the whole
 * never visibly repeats. Pink sparks rarely, cyan more rarely, and now and then
 * a row tears sideways by a pixel for a frame. Drawn on a 16px canvas and
 * scaled up without smoothing, stepped at ~12 frames a second.
 *
 * It settles as the job nears this model's usual time (`progress`, 0 to 1):
 * at each quarter, another quarter of the pixels stop on one flat tone. A
 * quarter never settle, so it stays alive until the image lands. `frozen`
 * draws one still frame with two rows torn: a job that failed.
 */

const N = 16
const FLAT = '#18181c'
const FRAME_MS = 83

// [loop duration in seconds is chosen per pixel] stops: [fraction, colour]
const LOOPS = [
  [[0, '#141417'], [0.22, '#1f1f24'], [0.47, '#2a2a30'], [0.61, '#17171a'], [0.83, '#222227']],
  [[0, '#19191d'], [0.3, '#121214'], [0.52, '#26262b'], [0.78, '#1b1b1f']],
  [[0, '#111113'], [0.4, '#18181c'], [0.7, '#101012']],
  // Pink spark: a frame of live colour, then a dark afterimage.
  [[0, '#18181c'], [0.64, '#25252a'], [0.86, '#fe2c55'], [0.91, '#4a1220'], [0.96, '#18181c']],
  // Cyan spark, rarer.
  [[0, '#16161a'], [0.88, '#25f4ee'], [0.91, '#123b3a'], [0.94, '#16161a']],
]
const SPEEDS = [1.3, 1.7, 2.3, 3.1]
// Row tears: period in seconds, then [start, end, shift in pixels] windows.
const TEARS = [
  [3.7, [[0.9, 0.93, 1]]],
  [5.3, [[0.9, 0.93, 1]]],
  [4.3, [[0.86, 0.88, -2], [0.88, 0.9, 1]]],
]

function field(seed) {
  let x = (seed * 9301 + 49297) % 233280
  const rnd = () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
  const cells = []
  for (let i = 0; i < N * N; i++) {
    const n = rnd()
    const loop = n < 0.022 ? 4 : n < 0.092 ? 3 : n < 0.42 ? 0 : n < 0.72 ? 1 : 2
    cells.push({ loop, speed: SPEEDS[Math.floor(rnd() * 4)], phase: rnd(), rank: Math.floor(rnd() * 4) })
  }
  const tears = new Map()
  while (tears.size < 3) tears.set(Math.floor(rnd() * N), tears.size)
  return { cells, tears }
}

const colourAt = (stops, f) => {
  let c = stops[0][1]
  for (const [at, colour] of stops) if (f >= at) c = colour
  return c
}

function draw(ctx, { cells, tears }, t, settled, frozen) {
  for (let r = 0; r < N; r++) {
    let shift = 0
    const tear = tears.get(r)
    if (tear != null) {
      if (frozen) shift = tear === 0 ? 1 : tear === 2 ? -2 : 0
      else if (!(settled >= 3 && tear > 0)) {
        const [period, windows] = TEARS[tear]
        const f = (t / period) % 1
        for (const [a, b, s] of windows) if (f >= a && f < b) shift = s
      }
    }
    for (let c = 0; c < N; c++) {
      const cell = cells[r * N + ((c - shift + N) % N)]
      ctx.fillStyle =
        cell.rank < settled ? FLAT : frozen ? LOOPS[cell.loop][0][1] : colourAt(LOOPS[cell.loop], (t / cell.speed + cell.phase) % 1)
      ctx.fillRect(c, r, 1, 1)
    }
  }
}

export default function DecodeField({ seed = 1, progress = 0, frozen = false }) {
  const canvas = useRef(null)
  const settledRef = useRef(0)
  settledRef.current = frozen ? 0 : Math.min(3, Math.floor(Math.max(0, progress) * 4))

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const data = field(seed)
    const still = frozen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    if (still) {
      draw(ctx, data, 0, settledRef.current, frozen)
      return
    }
    let last = 0
    let raf = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (now - last < FRAME_MS || document.hidden) return
      last = now
      draw(ctx, data, (now - start) / 1000, settledRef.current, false)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [seed, frozen])

  return <canvas ref={canvas} className="decode" width={N} height={N} aria-hidden="true" />
}
