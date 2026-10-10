import { Router } from 'express'
import * as outbox from '../outbox.js'

export const output = Router()

/**
 * The newest partial frame of a job still running. 404 until a model sends one
 * — many never do, and the gallery falls back to a plain pending tile.
 * Finished output is on disk and served from /files.
 */
output.get('/output/:jobId/preview', (req, res) => {
  const frame = outbox.preview(req.params.jobId)
  if (!frame) return res.status(404).end()

  res.setHeader('Content-Type', frame.mediaType)
  res.setHeader('Content-Length', frame.buf.length)
  res.setHeader('Cache-Control', 'no-store')
  // Locked down like /files: a frame may be SVG, which is script-capable when
  // opened directly, and the media type is the provider's word.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  res.send(frame.buf)
})
