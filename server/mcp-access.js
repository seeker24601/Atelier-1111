import { randomBytes, timingSafeEqual } from 'node:crypto'
import { writeFileSync, readFileSync, unlinkSync, renameSync } from 'node:fs'
import { join, basename } from 'node:path'
import { Router } from 'express'
import { DATA_DIR, IMAGE_DIR } from './paths.js'
import * as images from './db/images.js'

const token = randomBytes(32).toString('hex')
const descriptor = join(DATA_DIR, 'mcp-connection.json')

export function publishMcpConnection(port) {
  const connection = { url: `http://127.0.0.1:${port}`, token, pid: process.pid }
  const temporary = `${descriptor}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(connection), { mode: 0o600 })
  renameSync(temporary, descriptor)
  process.once('exit', () => {
    try {
      if (JSON.parse(readFileSync(descriptor, 'utf8')).token === token) unlinkSync(descriptor)
    } catch { /* A newer backend may already own the descriptor. */ }
  })
}

export const mcpAccess = Router()
mcpAccess.use((req, res, next) => {
  const provided = Buffer.from(String(req.headers['x-atelier-mcp-token'] || ''))
  const expected = Buffer.from(token)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Open Atelier and reconnect the MCP server.' })
  }
  res.setHeader('Cache-Control', 'no-store')
  const readable = /^\/(health|models|jobs(?:\/[^/]+)?|images|storage|capabilities|settings|media\/[^/]+(?:\/content)?)$/
  const mutable = (req.method === 'POST' && req.path === '/generate') ||
    (req.method === 'PUT' && req.path === '/settings/active') ||
    (req.method === 'DELETE' && /^\/images\/[^/]+$/.test(req.path))
  if (!(req.method === 'GET' && readable.test(req.path)) && !mutable) {
    return res.status(403).json({ error: 'This operation is unavailable through MCP.' })
  }
  next()
})

mcpAccess.get(['/media/:id', '/media/:id/content'], (req, res) => {
  const row = images.get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Media not found.' })
  if (row.file !== basename(row.file) || /[\\/]/.test(row.file)) {
    return res.status(400).json({ error: 'Invalid gallery filename.' })
  }
  const path = join(IMAGE_DIR, row.file)
  if (req.path.endsWith('/content')) return res.sendFile(path)
  res.json({ ...row, path })
})
