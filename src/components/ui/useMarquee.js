import { useEffect, useRef, useState } from 'react'

/** How far the pointer moves before a press becomes a drag rather than a click. */
const THRESHOLD = 6
/** Within this many pixels of the scroller's top or bottom, the drag scrolls it. */
const EDGE = 48
const MAX_SPEED = 18

/** Presses that belong to a control, not to the gallery. */
const OWN_GESTURE = 'button, a, input, textarea, select, video, [role="checkbox"]'

/**
 * Drag a box across the gallery to select what it touches. A press only
 * becomes a drag once it moves, so a click still opens a plate. Near the
 * scroller's edge the drag scrolls, and the box keeps growing with it.
 *
 * Tiles to hit carry `data-select-id`. The box is in the gallery's own
 * coordinates, which scroll with it, so it stays pinned to the plates.
 *
 * @param {object} opts
 * @param {React.RefObject<HTMLElement>} opts.gallery
 * @param {React.RefObject<HTMLElement>} opts.scroller
 * @param {(ids: string[], additive: boolean) => void} opts.onSelect  called as the box changes
 * @param {() => void} opts.onStart  called once a press becomes a drag
 */
export function useMarquee({ gallery, scroller, onSelect, onStart }) {
  const [box, setBox] = useState(null)
  const live = useRef({ onSelect, onStart })
  live.current = { onSelect, onStart }

  useEffect(() => {
    const el = gallery.current
    if (!el) return
    let drag = null
    let frame = 0

    const local = (clientX, clientY) => {
      const r = el.getBoundingClientRect()
      return { x: clientX - r.left, y: clientY - r.top }
    }

    const update = () => {
      const { start, client, additive } = drag
      const now = local(client.x, client.y)
      const rect = {
        x: Math.min(start.x, now.x),
        y: Math.min(start.y, now.y),
        w: Math.abs(now.x - start.x),
        h: Math.abs(now.y - start.y),
      }
      setBox(rect)
      const origin = el.getBoundingClientRect()
      const hits = []
      for (const tile of el.querySelectorAll('[data-select-id]')) {
        const t = tile.getBoundingClientRect()
        const left = t.left - origin.left
        const top = t.top - origin.top
        if (left < rect.x + rect.w && left + t.width > rect.x && top < rect.y + rect.h && top + t.height > rect.y) {
          hits.push(tile.dataset.selectId)
        }
      }
      live.current.onSelect(hits, additive)
    }

    // While the pointer sits near an edge, keep scrolling and keep the box growing.
    const tick = () => {
      frame = 0
      if (!drag?.active) return
      const s = scroller.current
      if (!s) return
      const r = s.getBoundingClientRect()
      const y = drag.client.y
      const speed =
        y < r.top + EDGE ? -Math.ceil(((r.top + EDGE - y) / EDGE) * MAX_SPEED)
        : y > r.bottom - EDGE ? Math.ceil(((y - (r.bottom - EDGE)) / EDGE) * MAX_SPEED)
        : 0
      if (!speed) return
      const before = s.scrollTop
      s.scrollTop += speed
      if (s.scrollTop !== before) update()
      frame = requestAnimationFrame(tick)
    }

    const down = (e) => {
      if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest(OWN_GESTURE)) return
      drag = {
        id: e.pointerId,
        start: local(e.clientX, e.clientY),
        from: { x: e.clientX, y: e.clientY },
        client: { x: e.clientX, y: e.clientY },
        additive: e.shiftKey || e.ctrlKey || e.metaKey,
        active: false,
      }
    }

    const move = (e) => {
      if (!drag || e.pointerId !== drag.id) return
      drag.client = { x: e.clientX, y: e.clientY }
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.from.x, e.clientY - drag.from.y) < THRESHOLD) return
        drag.active = true
        // Keeps the drag when the pointer leaves the gallery; a refused capture only loses that.
        try {
          el.setPointerCapture(e.pointerId)
        } catch {}
        el.classList.add('is-dragging')
        window.getSelection()?.removeAllRanges()
        live.current.onStart?.()
      }
      update()
      if (!frame) frame = requestAnimationFrame(tick)
    }

    // The click that ends a drag is not a click on whatever it ended over.
    const swallow = (e) => {
      e.stopPropagation()
      e.preventDefault()
    }

    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return
      if (drag.active) {
        el.classList.remove('is-dragging')
        window.addEventListener('click', swallow, { capture: true, once: true })
        // A drag that ends off any element fires no click; drop the trap then.
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
        setBox(null)
      }
      drag = null
      cancelAnimationFrame(frame)
      frame = 0
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      cancelAnimationFrame(frame)
    }
  }, [gallery, scroller])

  return box
}
