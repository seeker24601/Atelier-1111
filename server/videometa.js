/**
 * Reading an MP4's real dimensions and duration out of its container boxes.
 *
 * Same purpose as readImageMeta: a video model can accept `resolution` and
 * `duration` and return something else entirely, and the only honest way to
 * know is to measure the file. MP4 is a tree of length-prefixed boxes, so the
 * two facts sit at known offsets inside `moov` — no decoding required.
 */

/** Walk the boxes at this level, yielding [type, payload]. */
function* boxes(buf, start = 0, end = buf.length) {
  let at = start
  while (at + 8 <= end) {
    let size = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    let headerSize = 8
    // size 1 means the real 64-bit size follows the type; 0 means "to the end".
    if (size === 1) {
      if (at + 16 > end) return
      size = Number(buf.readBigUInt64BE(at + 8))
      headerSize = 16
    } else if (size === 0) {
      size = end - at
    }
    if (size < headerSize || at + size > end) return
    yield [type, at + headerSize, at + size]
    at += size
  }
}

function find(buf, path, start = 0, end = buf.length) {
  const [head, ...rest] = path
  for (const [type, from, to] of boxes(buf, start, end)) {
    if (type !== head) continue
    return rest.length ? find(buf, rest, from, to) : [from, to]
  }
  return null
}

/** Track headers carry the display size as 16.16 fixed-point. */
function trackSize(buf) {
  for (const [type, from, to] of boxes(buf)) {
    if (type !== 'moov') continue
    for (const [trakType, trakFrom, trakTo] of boxes(buf, from, to)) {
      if (trakType !== 'trak') continue
      const tkhd = find(buf, ['tkhd'], trakFrom, trakTo)
      if (!tkhd) continue
      const [at] = tkhd
      const version = buf[at]
      // Offsets are from the payload, past the 64-bit time fields version 1
      // uses: width and height are the last two fields, after the 36-byte matrix.
      const offset = at + (version === 1 ? 88 : 76)
      if (offset + 8 > buf.length) continue
      const width = buf.readUInt32BE(offset) / 65536
      const height = buf.readUInt32BE(offset + 4) / 65536
      // Audio and subtitle tracks report 0×0; the video track is the one wanted.
      if (width >= 1 && height >= 1) return { width: Math.round(width), height: Math.round(height) }
    }
  }
  return null
}

/** Movie header: duration in units of its own timescale. */
function movieDuration(buf) {
  const mvhd = find(buf, ['moov', 'mvhd'])
  if (!mvhd) return null
  const [at] = mvhd
  const version = buf[at]
  const timescale = version === 1 ? buf.readUInt32BE(at + 20) : buf.readUInt32BE(at + 12)
  const units = version === 1 ? Number(buf.readBigUInt64BE(at + 24)) : buf.readUInt32BE(at + 16)
  return timescale ? Number((units / timescale).toFixed(2)) : null
}

/**
 * Is there a sound track? This is what makes `generate_audio` checkable rather
 * than taken on trust — a silent file has no `soun` handler in it.
 */
function hasAudio(buf) {
  for (const [type, from, to] of boxes(buf)) {
    if (type !== 'moov') continue
    for (const [trakType, trakFrom, trakTo] of boxes(buf, from, to)) {
      if (trakType !== 'trak') continue
      const hdlr = find(buf, ['mdia', 'hdlr'], trakFrom, trakTo)
      // handler_type sits after version+flags and one pre_defined word.
      if (hdlr && buf.toString('latin1', hdlr[0] + 8, hdlr[0] + 12) === 'soun') return true
    }
  }
  return false
}

/**
 * @returns {{width, height, format, seconds, audio}|null}
 */
export function readVideoMeta(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null
  if (buf.toString('latin1', 4, 8) !== 'ftyp') return null

  const size = trackSize(buf)
  if (!size) return null
  return { ...size, format: 'mp4', seconds: movieDuration(buf), audio: hasAudio(buf) }
}
