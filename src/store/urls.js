/**
 * Where a stored plate's bytes are served. Files are named by their id and
 * never rewritten, so the URL is stable and safely cached forever.
 */
export function urlFor(record) {
  if (!record?.file) return null
  return `/files/${encodeURIComponent(record.file)}`
}
