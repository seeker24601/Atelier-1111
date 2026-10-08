/**
 * Partial frames of jobs still generating — the only output held in memory.
 *
 * A preview is not a result: it is never billed, never stored, and is replaced
 * by each newer frame. It exists so the gallery can show the image forming
 * instead of an empty box. Finished output goes straight to disk (library.js).
 */

const TTL_MS = 10 * 60 * 1000
const SWEEP_MS = 60 * 1000

const previews = new Map()

export function setPreview(jobId, { buf, mediaType }) {
  previews.set(jobId, { buf, mediaType, at: Date.now() })
}

export function preview(jobId) {
  return previews.get(jobId) ?? null
}

export function dropPreview(jobId) {
  previews.delete(jobId)
}

// A preview whose job died mid-flight has nothing to replace or drop it.
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [id, p] of previews) if (now - p.at > TTL_MS) previews.delete(id)
}, SWEEP_MS)
sweep.unref?.()

export const pending = () => previews.size
