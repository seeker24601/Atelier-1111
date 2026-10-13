import { useEffect, useRef, useState } from 'react'

// Glyphs Silkscreen draws.
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%+='

/**
 * When the text changes, it resolves left to right out of random glyphs over
 * 8 frames, 240ms. The first value shows as it is; so does everything when
 * motion is reduced.
 */
export function useScramble(text) {
  const [shown, setShown] = useState(text)
  const first = useRef(true)

  useEffect(() => {
    if (first.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      first.current = false
      setShown(text)
      return
    }
    let frame = 0
    const t = setInterval(() => {
      frame++
      if (frame > 8) {
        clearInterval(t)
        setShown(text)
        return
      }
      const keep = Math.ceil((text.length * frame) / 8)
      setShown(
        text
          .split('')
          .map((ch, i) => (i < keep || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join('')
      )
    }, 30)
    return () => clearInterval(t)
  }, [text])

  return shown
}
