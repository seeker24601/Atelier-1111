import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

const realFetch = globalThis.fetch
globalThis.fetch = (url, options) => {
  if (new URL(url).hostname !== '127.0.0.1') {
    appendFileSync(join(process.env.ATELIER_DATA_DIR, 'blocked-mcp-network.log'), 'blocked\n')
    throw new Error('External network disabled in MCP tests.')
  }
  return realFetch(url, options)
}
