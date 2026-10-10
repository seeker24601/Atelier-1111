import express from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR, IMAGE_DIR, ROOT } from './paths.js'
import { api } from './routes/index.js'
import { reconcileOrphans } from './reconcile.js'
import { getTheme, getHiddenModels, setHiddenModels } from './settings.js'
import { describe } from './keys.js'
import { db } from './db/index.js'
import { qualifyModelIds } from './migrations.js'
import { localOnly } from './localonly.js'

/**
 * Two ways to run:
 *
 *   --app   one process on APP_PORT (5180) serving the built UI and the API —
 *           what the desktop launcher and `npm start` use.
 *   (none)  API only on API_PORT (8788), behind the Vite dev server.
 */
const APP = process.argv.includes('--app')
const PORT = APP
  ? Number(process.env.APP_PORT ?? 5180)
  : Number(process.env.API_PORT) || 8788
const DIST = join(ROOT, 'dist')

const app = express()
app.disable('x-powered-by')
app.use(localOnly)
app.use(express.json({ limit: '64mb' })) // reference images arrive as data URLs
app.use('/api', api)
// Vector models return SVG, which is script-capable when opened directly (an
// <img> tag is inert, a browser tab is not). Served locked down and never
// content-sniffed, so the extension written by the queue is the only authority.
app.use(
  '/files',
  express.static(IMAGE_DIR, {
    maxAge: '1y',
    immutable: true,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
    },
  })
)

if (APP) {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[atelier-1111] no build found — run `npm start`, which builds first.')
    process.exit(1)
  }
  // Hashed assets never change under their name; the page itself always revalidates.
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders(res, path) {
        res.setHeader(
          'Cache-Control',
          path.includes(`${join('dist', 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
        )
      },
    })
  )
  // The saved theme is written into the page itself, so a dark choice never
  // flashes light while the app boots. "system" leaves it to the OS.
  app.get('*', (_req, res) => {
    const theme = getTheme()
    const page = readFileSync(join(DIST, 'index.html'), 'utf8')
    res.setHeader('Cache-Control', 'no-cache')
    res.type('html').send(theme === 'system' ? page : page.replace('<html', `<html data-theme="${theme}"`))
  })
}

// Stored model ids become provider-qualified (openrouter:…), backed up first.
// Runs every start so data written by an older version catches up.
const migrated = qualifyModelIds({
  db,
  dataDir: DATA_DIR,
  hiddenModels: { get: getHiddenModels, set: setHiddenModels },
})
if (migrated.changed) {
  console.log(`[atelier-1111] qualified ${migrated.changed} stored model ids; backup at ${migrated.backup.dbCopy}`)
}

// Nothing survives a restart on its own: settle what was in flight first.
// A video that recorded an upstream id is still generating, and is recoverable
// rather than lost; finished work is already on disk.
reconcileOrphans()

const listener = app.listen(PORT, '127.0.0.1', () => {
  const port = listener.address().port
  if (process.env.ATELIER_DESKTOP) console.log(`ATELIER_READY:${port}`)
  const { configured, active, source } = describe()
  console.log(`[atelier-1111] ${APP ? 'app' : 'api'} on http://127.0.0.1:${port}`)
  console.log(`[atelier-1111] gallery at ${IMAGE_DIR}`)
  console.log(
    configured
      ? `[atelier-1111] ${active} key loaded from ${source}`
      : '[atelier-1111] no api key — add one in Settings'
  )
})
