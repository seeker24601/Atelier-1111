import { useEffect, useMemo, useRef, useState } from 'react'
import ReadoutBand from './ReadoutBand.jsx'
import Gallery from './Gallery.jsx'
import SelectionBar from './SelectionBar.jsx'
import { clickSelect, boxSelect, prune, plateOrder, splitKeys } from '../selection.js'
import { useMarquee } from './ui/useMarquee.js'

/**
 * The right-hand column: what the selected model is, and what came out.
 * Work in flight sits in the grid where its result will land.
 *
 * Select mode: the Select button turns it on and Done (or Esc) turns it off.
 * While it is on, a click ticks a plate or a failed job, Shift extends a
 * range, a drag draws a box over what to tick, and the bar at the foot
 * downloads or deletes the selection. A plate's corner box, Shift or
 * Ctrl/Cmd-click and Ctrl/Cmd+A turn it on from outside.
 */
export default function Workspace({ kind = 'image', models, model, runs, gallery, overlay = false, onDownloadMany, onDeleteMany }) {
  const plates = useMemo(() => plateOrder(gallery.images, gallery.failures), [gallery.images, gallery.failures])
  const order = useMemo(() => plates.map((p) => p.key), [plates])
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const anchor = useRef(null)
  const held = useRef(selected)
  held.current = selected

  const exit = () => {
    setSelecting(false)
    setSelected(new Set())
    anchor.current = null
  }

  useEffect(() => setSelected((s) => prune(s, order)), [order])
  useEffect(exit, [kind])

  const scroller = useRef(null)
  const grid = useRef(null)
  const dragBase = useRef(selected)
  const box = useMarquee({
    gallery: grid,
    scroller,
    enabled: selecting,
    onStart: () => {
      dragBase.current = held.current
    },
    onSelect: (hits, additive) => setSelected(boxSelect(dragBase.current, hits, additive)),
  })

  const toggle = (key, { range = false } = {}) => {
    // Read the anchor now: the updater runs later, after it has moved.
    const from = anchor.current
    setSelecting(true)
    setSelected((s) => clickSelect(s, order, key, { range, anchor: from }))
    anchor.current = key
  }
  const selectAll = () => {
    setSelecting(true)
    setSelected(new Set(order))
  }

  // Esc leaves select mode and Ctrl/Cmd+A selects everything, unless an overlay or a text field has the keys.
  useEffect(() => {
    if (overlay) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'Escape' && selecting) {
        e.preventDefault()
        exit()
      } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && order.length) {
        e.preventDefault()
        selectAll()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keys = order.filter((key) => selected.has(key))
  const { images, jobs } = splitKeys(keys)

  async function download() {
    setBusy(true)
    try {
      await onDownloadMany(images)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await onDeleteMany({ images, jobs })
      exit()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="workspace" ref={scroller}>
      <ReadoutBand
        models={models}
        model={model}
        runs={runs}
        kind={kind}
        selecting={selecting}
        canSelect={order.length > 0}
        onSelectMode={() => (selecting ? exit() : setSelecting(true))}
      />
      <Gallery
        kind={kind}
        {...gallery}
        plates={plates}
        gridRef={grid}
        box={box}
        selecting={selecting}
        selected={selected}
        onToggle={toggle}
      />
      {selecting && (
        <SelectionBar
          count={keys.length}
          total={order.length}
          files={images.length}
          busy={busy}
          onSelectAll={selectAll}
          onDownload={download}
          onDelete={remove}
        />
      )}
    </main>
  )
}
