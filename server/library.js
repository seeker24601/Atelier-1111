import { randomUUID } from 'node:crypto'
import { writeFile, unlink, readdir, stat } from 'node:fs/promises'
import { statfsSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGE_DIR, DATA_DIR } from './paths.js'
import * as imagesRepo from './db/images.js'
import { extFor, slimRefs } from './media.js'

/**
 * The gallery, on this machine's disk.
 *
 * Single user, local process: the safest place for a paid generation is a file
 * written the moment it arrives, before anything else can go wrong. No browser
 * has to come and collect it, no tab has to stay open, and a restart loses
 * nothing. Bytes go to data/images, everything that describes them to SQLite.
 */

/**
 * @param {object} job the job row
 * @param {{outputs: Array<{buf: Buffer, mediaType: string, meta: object|null}>,
 *          params: object, refs?: Array<{width: number|null, height: number|null}>,
 *          cost: number|null, note?: string|null}} result
 * @returns {Promise<number>} how many files were written
 */
export async function save(job, { outputs, params, refs = [], cost, note = null }) {
  const each = cost != null ? cost / Math.max(1, outputs.length) : null
  const described = slimRefs(job.refs).map((ref, i) => ({ ...ref, ...(refs[i] || {}) }))

  for (const [seq, out] of outputs.entries()) {
    const id = randomUUID()
    const file = `${id}.${extFor(out.mediaType)}`
    // File first, row second: a row that points at nothing is worse than a
    // stray file, which the storage readout still counts.
    await writeFile(join(IMAGE_DIR, file), out.buf)
    imagesRepo.insert({
      id,
      job_id: job.id,
      kind: job.kind || 'image',
      created_at: Date.now(),
      model: job.model,
      prompt: job.prompt,
      note,
      params,
      refs: described,
      seq,
      file,
      media_type: out.mediaType,
      bytes: out.buf.length,
      width: out.meta?.width ?? null,
      height: out.meta?.height ?? null,
      format: out.meta?.format ?? null,
      seconds: out.meta?.seconds ?? null,
      cost: each,
    })
  }
  return outputs.length
}

/**
 * A plate made by the browser-storage build, handed over from IndexedDB.
 * Keeps its own id so a repeated import is a no-op rather than a duplicate.
 */
export async function adopt(record, buf) {
  const id = String(record.id || randomUUID())
  if (imagesRepo.get(id)) return false
  const mediaType = record.media_type || 'application/octet-stream'
  const file = `${id}.${extFor(mediaType)}`
  await writeFile(join(IMAGE_DIR, file), buf)
  imagesRepo.insert({
    id,
    job_id: record.job_id || id,
    kind: record.kind === 'video' ? 'video' : 'image',
    created_at: Number(record.created_at) || Date.now(),
    model: String(record.model || 'unknown'),
    prompt: String(record.prompt || ''),
    note: record.note ?? null,
    params: record.params || {},
    refs: slimRefs(record.refs),
    seq: Number(record.seq) || 0,
    file,
    media_type: mediaType,
    bytes: buf.length,
    width: record.width ?? null,
    height: record.height ?? null,
    format: record.format ?? null,
    seconds: record.seconds ?? null,
    cost: typeof record.cost === 'number' ? record.cost : null,
  })
  return true
}

/** Row and file together, or neither is gone. */
export async function remove(id) {
  const row = imagesRepo.get(id)
  if (!row) return false
  imagesRepo.remove(row.id)
  await unlink(join(IMAGE_DIR, row.file)).catch(() => {})
  return true
}

export async function clear() {
  for (const row of imagesRepo.all()) {
    await unlink(join(IMAGE_DIR, row.file)).catch(() => {})
  }
  return imagesRepo.clear()
}

/** What the gallery occupies, and what the disk under it has left. */
export async function storage() {
  let bytes = 0
  for (const name of await readdir(IMAGE_DIR).catch(() => [])) {
    bytes += (await stat(join(IMAGE_DIR, name)).catch(() => ({ size: 0 }))).size
  }
  let free = null
  try {
    const fs = statfsSync(DATA_DIR)
    free = fs.bavail * fs.bsize
  } catch {
    // statfs is missing on some platforms; the readout shows a dash instead.
  }
  return { dir: IMAGE_DIR, bytes, free, ...imagesRepo.totals() }
}
