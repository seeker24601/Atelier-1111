import { parseModelId } from './modelid.js'

/**
 * What a result is called once it leaves the gallery. Shared by the browser,
 * which saves one, and the server, which zips several, so both agree.
 */

/**
 * A usable file extension. `media_type` gives "svg+xml", which is not one, and
 * the measured format is truer than the request in any case.
 */
const EXT_ALIAS = { jpeg: 'jpg', 'svg+xml': 'svg' }
export function extensionOf(image) {
  const sub =
    image.format || String(image.media_type || '').split('/')[1]?.split(';')[0]?.toLowerCase()
  return EXT_ALIAS[sub] || String(sub || 'bin').replace(/[^a-z0-9]/g, '') || 'bin'
}

/** `flux-3-image-1e1769c0.png`: the model, the id's first block, the measured format. */
export const downloadName = (image) =>
  `${parseModelId(image.model).model.split('/').pop().toLowerCase()}-${image.id.slice(0, 8)}.${extensionOf(image)}`
