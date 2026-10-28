import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const id = 'com.seeker24601.atelier1111'

export function connectionFiles(env = process.env, platform = process.platform, home = homedir()) {
  const desktop = platform === 'win32' ? join(env.APPDATA || join(home, 'AppData/Roaming'), id)
    : platform === 'darwin' ? join(home, 'Library/Application Support', id)
    : join(env.XDG_DATA_HOME || join(home, '.local/share'), id)
  return env.ATELIER_DATA_DIR ? [join(env.ATELIER_DATA_DIR, 'mcp-connection.json')]
    : [join(desktop, 'mcp-connection.json'), join(dirname(fileURLToPath(import.meta.url)), '../data/mcp-connection.json')]
}

function discover() {
  for (const file of connectionFiles()) {
    try {
      const connection = JSON.parse(readFileSync(file, 'utf8'))
      const url = new URL(connection.url)
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password ||
          url.pathname !== '/' || url.search || url.hash || !/^[a-f0-9]{64}$/.test(connection.token)) {
        throw new Error('Invalid Atelier connection descriptor.')
      }
      return { url: url.origin, token: connection.token }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  throw new Error('Open Atelier before using its MCP tools. For a source install, run npm start.')
}

export async function request(path, { method = 'GET', body, binary = false } = {}) {
  const connection = discover()
  let response
  try {
    response = await fetch(`${connection.url}/mcp-api${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { 'x-atelier-mcp-token': connection.token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Atelier is unavailable. Open the app and retry. A generation with an uncertain result must be checked in the job log before retrying.')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `Atelier returned HTTP ${response.status}.`)
  }
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json()
}
