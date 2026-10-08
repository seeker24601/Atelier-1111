/** Pure helpers for naming and describing stored output. No I/O. */

const EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export const extFor = (mediaType) =>
  EXT[String(mediaType || '').split(';')[0].trim().toLowerCase()] || 'bin'

/**
 * A reference uploaded as a data URL is the request, not the record. The
 * gallery keeps what describes it — name, measured size — and drops the bytes,
 * which would otherwise be copied into every row that used them.
 */
export const slimRefs = (refs = []) => (refs || []).map(({ url, ...rest }) => rest)
