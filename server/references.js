import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IMAGE_DIR } from './paths.js'
import { readImageMeta } from './imagemeta.js'
import * as imagesRepo from './db/images.js'

/**
 * Turning reference descriptors into what the API wants, and refusing the ones
 * it cannot use.
 *
 * Models ingest raster only. Grok names its accepted set in the rejection
 * itself — "a valid JPG, PNG, WebP, or ICO image" — and an SVG reference fails
 * there in under a second. Since the recraft `-vector` models *produce* SVG,
 * a vector plate can reach the reference tray by an entirely ordinary route, so
 * this is checked before the job ever leaves for the API.
 */
const RASTER = new Set(['png', 'jpeg', 'jpg', 'webp', 'gif', 'ico'])

/** `image/svg+xml` → `SVG` */
function subtype(mediaType) {
  return String(mediaType || '')
    .split('/')
    .pop()
    .split(';')[0]
    .split('+')[0]
    .toLowerCase()
}

function assertRaster(mediaType, label) {
  const sub = subtype(mediaType)
  if (sub && !RASTER.has(sub)) {
    throw Object.assign(
      new Error(
        `Reference ${label} is ${sub.toUpperCase()}. Models take raster references only ` +
          `(PNG, JPEG, WebP) — vector files are rejected.`
      ),
      { status: 400 }
    )
  }
}

/**
 * Descriptors are either an inline data URL from an upload or the id of an
 * image already on disk; both become data URLs for the API call.
 *
 * The reference is decoded on the way through. Some models derive the output
 * geometry from the reference rather than from the request — recraft's raster
 * tiers ignore aspect_ratio and resolution outright — and without the
 * reference's own dimensions that reads as an arbitrary substitution instead of
 * the rule it is.
 *
 * @returns {Array<{url: string, width?: number, height?: number, format?: string}>}
 */
export async function resolveReferences(refs) {
  const out = []
  for (const [i, ref] of refs.entries()) {
    const label = `#${i + 1}`

    if (ref.kind === 'data' && typeof ref.url === 'string') {
      assertRaster(/^data:([^;,]+)/.exec(ref.url)?.[1], label)
      const base64 = ref.url.slice(ref.url.indexOf(',') + 1)
      out.push({ url: ref.url, ...(readImageMeta(Buffer.from(base64, 'base64')) || {}) })
    } else if (ref.kind === 'image' && ref.id) {
      const row = imagesRepo.get(ref.id)
      if (!row) continue
      assertRaster(row.media_type, label)
      const buf = await readFile(join(IMAGE_DIR, row.file))
      out.push({
        url: `data:${row.media_type};base64,${buf.toString('base64')}`,
        width: row.width,
        height: row.height,
        format: row.format,
      })
    }
  }
  return out
}
