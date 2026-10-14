import { crc32 } from 'node:zlib'

/**
 * A plain ZIP, written as it goes: each file is stored (images and clips are
 * already compressed) and sent before the next is read, so a large selection
 * never sits in memory at once. No ZIP64: the caller keeps the total under
 * 4 GB and the count under 65,535.
 */

export const ZIP_LIMIT_BYTES = 0xffffffff - 1024 * 1024
export const ZIP_LIMIT_FILES = 0xffff

/** DOS date and time, which is what ZIP records. */
function dos(ms) {
  const d = new Date(ms)
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

/**
 * @param {{ write(chunk: Buffer): unknown }} out
 * @param {AsyncIterable<{ name: string, data: Buffer, mtime: number }>} entries
 */
export async function writeZip(out, entries) {
  const central = []
  let offset = 0
  const put = (buf) => {
    out.write(buf)
    offset += buf.length
  }

  for await (const { name, data, mtime } of entries) {
    const file = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const { time, date } = dos(mtime)
    const at = offset

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // names are UTF-8
    local.writeUInt16LE(0, 8) // stored
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(file.length, 26)
    local.writeUInt16LE(0, 28)
    put(local)
    put(file)
    put(data)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4) // made by
    entry.writeUInt16LE(20, 6) // version needed
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt16LE(time, 12)
    entry.writeUInt16LE(date, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(file.length, 28)
    entry.writeUInt32LE(at, 42)
    central.push(entry, file)
  }

  const start = offset
  const count = central.length / 2
  for (const buf of central) put(buf)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(offset - start, 12)
  end.writeUInt32LE(start, 16)
  put(end)
}
