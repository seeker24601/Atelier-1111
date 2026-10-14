import { useEffect, useMemo, useRef, useState } from 'react'
import ReadoutBand from './ReadoutBand.jsx'
import Gallery from './Gallery.jsx'
import SelectionBar from './SelectionBar.jsx'
import { clickSelect, boxSelect, prune } from '../selection.js'
import { useMarquee } from './ui/useMarquee.js'

/**
 * The right-hand column: what the selected model is, and what came out.
 * Work in flight sits in the grid where its result will land.
 *
 * Plates can be ticked, Shift-clicked as a range, or swept with a drag box;
 * once any are ticked, a click ticks rather than opens, and a bar at the foot
 * downloads or deletes them together.
 */
export default function Workspace({ kind = 'image', models, model, runs, gallery, overlay = false, onDownloadMany, onDeleteMany }) {
  const order = useMemo(() => gallery.images.map((i) => i.id), [gallery.images])
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const anchor = useRef(null)
  const held = useRef(selected)
  held.current = selected

  useEffect(() => setSelected((s) => prune(s, order)), [order])
  useEffect(() => setSelected(new Set()), [kind])

  const scroller = useRef(null)
  const grid = useRef(null)
  const dragBase = useRef(selected)
  const box = useMarquee({
    gallery: grid,
    scroller,
    onStart: () => {
      dragBase.current = held.current
    },
    onSelect: (hits, additive) => setSelected(boxSelect(dragBase.current, hits, additive)),
  })

  const toggle = (id, { range = false } = {}) => {
    // Read the anchor now: the updater runs later, after it has moved.
    const from = anchor.current
    setSelected((s) => clickSelect(s, order, id, { range, anchor: from }))
    anchor.current = id
  }
  const clear = () => setSelected(new Set())
  const selectAll = () => setSelected(new Set(order))

  // Esc clears and Ctrl/Cmd+A selects every plate, unless an overlay or a text field has the keys.
  useEffect(() => {
    if (overlay) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'Escape' && held.current.size) {
        e.preventDefault()
        setSelected(new Set())
      } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && order.length) {
        e.preventDefault()
        setSelected(new Set(order))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, order])

  const ids = order.filter((id) => selected.has(id))

  async function download() {
    setBusy(true)
    try {
      await onDownloadMany(ids)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await onDeleteMany(ids)
      clear()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="workspace" ref={scroller}>
      <ReadoutBand models={models} model={model} runs={runs} kind={kind} />
      <Gallery
        kind={kind}
        {...gallery}
        gridRef={grid}
        box={box}
        selected={selected}
        onToggle={toggle}
      />
      {ids.length > 0 && (
        <SelectionBar
          count={ids.length}
          total={order.length}
          busy={busy}
          onSelectAll={selectAll}
          onClear={clear}
          onDownload={download}
          onDelete={remove}
        />
      )}
    </main>
  )
}
