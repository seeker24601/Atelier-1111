/**
 * This server spends money with your key, so it only answers this machine.
 *
 * Binding to 127.0.0.1 keeps the network out, but not a web page: any site you
 * visit can aim requests at localhost, and a DNS-rebinding page can even read
 * the answers. Two checks close that:
 *
 *   Host    must name a loopback address. A rebound domain arrives with its
 *           own name in Host, so it is refused before any route runs.
 *   Origin  when a browser sends one, it must be a loopback page too. Another
 *           site's fetch carries that site's origin, so it cannot queue a
 *           generation or swap the key.
 *
 * ATELIER_HOSTS adds names (comma-separated) for anyone deliberately putting
 * the app behind something else.
 */

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

const extra = new Set(
  String(process.env.ATELIER_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
)

/** `127.0.0.1:5180` → `127.0.0.1`, `[::1]:5180` → `[::1]` */
export function hostname(hostHeader) {
  const h = String(hostHeader || '').trim().toLowerCase()
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1)
  return h.split(':')[0]
}

export const allowedHost = (name) => LOOPBACK.has(name) || extra.has(name)

export function allowedOrigin(origin) {
  if (!origin) return true // same-origin GETs and non-browser clients send none
  if (origin === 'null') return false // sandboxed frames, file:// pages
  try {
    return allowedHost(new URL(origin).hostname.toLowerCase().replace(/^::1$/, '[::1]'))
  } catch {
    return false
  }
}

export function localOnly(req, res, next) {
  if (!allowedHost(hostname(req.headers.host))) {
    return res.status(421).type('text/plain').send('Atelier only answers on localhost.')
  }
  if (!allowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Requests from other sites are refused.' })
  }
  next()
}
