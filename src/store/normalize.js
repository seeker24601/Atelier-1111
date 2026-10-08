/**
 * Making a reference something every provider will actually take.
 *
 * A GIF is a valid raster image and this app has always accepted one, but the
 * models do not: Grok names its set outright — "a valid JPG, PNG, WebP, or ICO
 * image" — and the request fails a second later. An animation is also not a
 * reference in any useful sense; only one frame can be looked at.
 *
 * So a GIF is flattened to its first frame as PNG before it is sent.
 * `createImageBitmap` decodes exactly that frame, where an <img> would hand
 * over whatever the animation happened to be showing. PNG rather than JPEG
 * because GIFs carry transparency and JPEG would fill it with black.
 */

const FLATTEN = new Set(['image/gif', 'image/apng'])

export const needsFlattening = (type) => FLATTEN.has(String(type || '').toLowerCase())

/**
 * @param {Blob} blob
 * @returns {Promise<{blob: Blob, converted: boolean, from: string|null}>}
 */
export async function normalizeReference(blob) {
  if (!needsFlattening(blob.type)) return { blob, converted: false, from: null }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close?.()

  const flattened = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error('Could not read the first frame.'))),
      'image/png'
    )
  })

  return { blob: flattened, converted: true, from: blob.type }
}
