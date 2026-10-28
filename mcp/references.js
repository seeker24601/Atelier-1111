import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'

function mime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  throw new Error('Reference files must be PNG, JPEG, or WebP images.')
}

export async function references(ids, paths) {
  if (ids.length + paths.length > 8) throw new Error('Use at most 8 reference images.')
  const refs = ids.map(id => ({ kind: 'image', id }))
  let total = 0
  for (const path of paths) {
    const info = await stat(path)
    if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error('Each reference must be an image file under 8 MiB.')
    const bytes = await readFile(path)
    total += bytes.length
    if (total > 32 * 1024 * 1024) throw new Error('Reference files must total less than 32 MiB.')
    refs.push({ kind: 'data', name: basename(path), url: `data:${mime(bytes)};base64,${bytes.toString('base64')}` })
  }
  return refs
}
