import { useEffect, useRef, useState } from 'react'
import Plate from '../ui/Plate.jsx'
import { blobToDataUrl } from '../../api.js'
import { canBeReference } from '../../format.js'
import { normalizeReference } from '../../store/normalize.js'

const imagesIn = (list) => Array.from(list || []).filter((f) => f.type.startsWith('image/'))

export default function RefsPlate({ refs, onRefs, max }) {
  const fileInput = useRef(null)
  const [refused, setRefused] = useState(null)

  // Read through a ref so the window listeners below never see a stale tray.
  const latest = useRef({ refs, onRefs, max })
  latest.current = { refs, onRefs, max }

  async function addFiles(files) {
    const { refs, onRefs, max } = latest.current
    const added = []
    const bad = []

    for (const file of imagesIn(files).slice(0, max - refs.length)) {
      // `image/*` includes SVG, which every model rejects as a reference.
      if (!canBeReference(file.type)) {
        bad.push(file.name)
        continue
      }
      try {
        // An animation becomes its first frame before any model will take it.
        const { blob } = await normalizeReference(file)
        added.push({ kind: 'data', url: await blobToDataUrl(blob), name: file.name })
      } catch {
        bad.push(file.name)
      }
    }

    setRefused(bad.length ? bad.join(', ') : null)
    if (added.length) onRefs([...refs, ...added])
  }

  // Paste or drop an image anywhere on the page — the tray is the only place
  // an image can go, so there is no reason to aim for it.
  useEffect(() => {
    const onPaste = (e) => {
      const files = imagesIn(e.clipboardData?.files)
      if (!files.length) return
      e.preventDefault()
      addFiles(files)
    }
    const onDrop = (e) => {
      const files = imagesIn(e.dataTransfer?.files)
      if (files.length) addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <Plate id="03 / References" right={`${refs.length} / ${max}`}>
      <div className="reftray">
        {refs.map((r, i) => (
          <div className="refslot" key={r.id || i} title={r.name}>
            <img src={r.url} alt="" />
            <button
              className="refslot__kill"
              onClick={() => onRefs(refs.filter((_, j) => j !== i))}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {refs.length < max && (
          <button
            className="refslot refslot--add"
            onClick={() => fileInput.current?.click()}
            aria-label="Add reference"
          >
            +
          </button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {refused && (
        <p className="banner banner--err" style={{ marginTop: 8 }}>
          Raster only · {refused}
        </p>
      )}
    </Plate>
  )
}
