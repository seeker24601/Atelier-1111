/**
 * Read true dimensions and format straight from the returned bytes.
 *
 * This is what makes a silently-dropped parameter detectable. A model that
 * ignores aspect_ratio still returns HTTP 200 with a perfectly good image —
 * the only evidence is that its pixels don't match what was asked for.
 */

/** PNG: 8-byte signature, then IHDR carries width and height as big-endian u32. */
function png(buf) {
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** JPEG: walk the marker chain to the first start-of-frame. */
function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null

  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]
    // SOF0–SOF15, excluding DHT (c4), JPG (c8) and DAC (cc) which aren't frames.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    const len = buf.readUInt16BE(i + 2)
    if (len < 2) return null
    i += 2 + len
  }
  return null
}

/** WebP: RIFF container, three possible chunk layouts. */
function webp(buf) {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null

  const chunk = buf.toString('ascii', 12, 16)

  if (chunk === 'VP8X') {
    return {
      format: 'webp',
      width: (buf.readUIntLE(24, 3) & 0xffffff) + 1,
      height: (buf.readUIntLE(27, 3) & 0xffffff) + 1,
    }
  }
  if (chunk === 'VP8 ') {
    return {
      format: 'webp',
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return {
      format: 'webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }
  return null
}

/**
 * SVG: text, not a container. Vector models return it regardless of the
 * requested output_format, so its dimensions come from width/height
 * attributes, falling back to the viewBox.
 */
function svg(buf) {
  const head = buf.subarray(0, 4096).toString('utf8')
  if (!/<svg[\s>]/i.test(head)) return null

  const num = (re) => {
    const m = re.exec(head)
    const v = m ? parseFloat(m[1]) : NaN
    return Number.isFinite(v) ? Math.round(v) : null
  }

  const width = num(/<svg[^>]*?\bwidth\s*=\s*["']\s*([\d.]+)/i)
  const height = num(/<svg[^>]*?\bheight\s*=\s*["']\s*([\d.]+)/i)
  if (width && height) return { format: 'svg', width, height }

  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(head)
  if (vb) {
    return { format: 'svg', width: Math.round(parseFloat(vb[1])), height: Math.round(parseFloat(vb[2])) }
  }
  return { format: 'svg', width: null, height: null }
}

/** @returns {{format: string, width: number|null, height: number|null} | null} */
export function readImageMeta(buf) {
  try {
    // Binary signatures first — they are exact. SVG is a text sniff, so it goes last.
    return png(buf) || jpeg(buf) || webp(buf) || svg(buf) || null
  } catch {
    return null // a truncated or exotic encoding just means "unknown", never a crash
  }
}

/**
 * File extension for a media type. express.static derives Content-Type from
 * the extension, so a wrong one is served with a wrong type and fails to
 * decode. Derived, never whitelisted — vector models return image/svg+xml
 * whatever output_format was requested, and that is how this was found.
 */
const EXT_ALIAS = { jpeg: 'jpg', 'svg+xml': 'svg' }

export function extensionFor(mediaType) {
  const sub = String(mediaType || '')
    .split('/')[1]
    ?.split(';')[0]
    ?.trim()
    .toLowerCase()
  if (!sub) return 'bin'
  return EXT_ALIAS[sub] || sub.replace(/[^a-z0-9]/g, '') || 'bin'
}

/** Nearest name for a width:height ratio, or null when nothing is close. */
export function describeRatio(width, height, tolerance = 0.04) {
  if (!width || !height) return null
  const actual = width / height
  const known = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9', '5:4', '4:5']

  let best = null
  for (const name of known) {
    const [w, h] = name.split(':').map(Number)
    const delta = Math.abs(actual - w / h) / (w / h)
    if (delta <= tolerance && (!best || delta < best.delta)) best = { name, delta }
  }
  return best?.name ?? null
}
