import { useCallback, useState } from 'react'

/**
 * Which plate the detail view shows, and walking the gallery from it in the
 * order the gallery is shown. Stepping wraps at either end.
 */
export function useDetail(images) {
  const [image, setImage] = useState(null)

  const at = image ? images.findIndex((i) => i.id === image.id) : -1

  const step = useCallback(
    (delta) => {
      if (at < 0 || !images.length) return
      setImage(images[(at + delta + images.length) % images.length])
    },
    [at, images]
  )

  const close = useCallback(() => setImage(null), [])

  return {
    image,
    open: setImage,
    close,
    step,
    position: at >= 0 ? `${at + 1} / ${images.length}` : null,
  }
}
