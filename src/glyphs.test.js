import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Every non-ASCII character the UI shows must exist in Departure Mono. A
 * missing one is drawn from some other font, and a lone glyph in the wrong
 * face reads as a rendering bug. Comments are ignored; only shipped text counts.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Code points in a WOFF 1.0 font, read from its cmap (formats 4 and 12). */
function coverage(path) {
  const buf = readFileSync(path)
  let cmap
  for (let i = 0; i < buf.readUInt16BE(12); i++) {
    const o = 44 + i * 20
    if (buf.toString('ascii', o, o + 4) !== 'cmap') continue
    const off = buf.readUInt32BE(o + 4)
    const stored = buf.readUInt32BE(o + 8)
    const raw = buf.subarray(off, off + stored)
    cmap = stored === buf.readUInt32BE(o + 12) ? raw : inflateSync(raw)
  }
  const cps = new Set()
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const sub = cmap.readUInt32BE(8 + i * 8)
    const format = cmap.readUInt16BE(sub)
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(sub + 6)
      const ends = sub + 14
      const starts = ends + segX2 + 2
      for (let s = 0; s < segX2 / 2; s++) {
        for (let c = cmap.readUInt16BE(starts + s * 2); c <= cmap.readUInt16BE(ends + s * 2) && c !== 0xffff; c++) cps.add(c)
      }
    } else if (format === 12) {
      for (let g = 0; g < cmap.readUInt32BE(sub + 12); g++) {
        const at = sub + 16 + g * 12
        for (let c = cmap.readUInt32BE(at); c <= cmap.readUInt32BE(at + 4); c++) cps.add(c)
      }
    }
  }
  return cps
}

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))

const shipped = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

test('every non-ASCII character the UI uses exists in Departure Mono', () => {
  const font = coverage(join(ROOT, 'public/fonts/DepartureMono-Regular.woff'))
  const missing = []
  for (const file of walk(join(ROOT, 'src')).filter((f) => /\.(jsx?|css)$/.test(f) && !f.endsWith('.test.js'))) {
    for (const ch of new Set(shipped(readFileSync(file, 'utf8')))) {
      const cp = ch.codePointAt(0)
      if (cp > 127 && !font.has(cp)) missing.push(`${ch} U+${cp.toString(16).toUpperCase()} in ${file.slice(ROOT.length + 1)}`)
    }
  }
  assert.deepEqual(missing, [])
})
