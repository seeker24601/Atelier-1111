/**
 * Transport concerns only — deadlines and legible failures. What the requests
 * mean belongs in openrouter.js.
 */

/**
 * Image generation on the slower "pro" tiers can run for minutes, so requests
 * carry an explicit, generous deadline rather than inheriting an undeclared
 * platform default. A mystery cut-off is undiagnosable.
 */
export const REQUEST_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 240_000

/**
 * `fetch failed` is a wrapper with the real reason buried in `cause`. Unwrap
 * the whole chain so the job log names the actual fault — a socket reset, a
 * DNS failure, a headers timeout — instead of a generic string.
 */
export function describeTransportError(err) {
  const parts = []
  const seen = new Set()
  for (let e = err; e && !seen.has(e); e = e.cause) {
    seen.add(e)
    const bit = [e.code, e.message].filter(Boolean).join(': ')
    if (bit && !parts.includes(bit)) parts.push(bit)
  }
  return parts.join(' ← ') || 'unknown transport failure'
}

/** fetch with a declared deadline and an error that says what actually broke. */
export async function call(url, init = {}) {
  const started = Date.now()
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    // Time-to-headers separates "the server is slow to start" from "the server
    // buffered the whole response". SSE should answer in well under a second;
    // if it does not, streaming is not actually being honoured upstream.
    const ttfb = Date.now() - started
    const type = res.headers.get('content-type') || ''
    if (ttfb > 2000 || type.includes('event-stream')) {
      console.log(`[http] headers in ${(ttfb / 1000).toFixed(1)}s · ${type.split(';')[0]}`)
    }
    return res
  } catch (err) {
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    if (err.name === 'TimeoutError') {
      throw Object.assign(
        new Error(`No response after ${secs}s (limit ${REQUEST_TIMEOUT_MS / 1000}s).`),
        { status: 504 }
      )
    }
    throw Object.assign(
      new Error(`Connection failed after ${secs}s — ${describeTransportError(err)}`),
      { status: 502 }
    )
  }
}

/** Pull the error text an API actually returned, whatever shape it used. */
export async function readError(res) {
  const text = await res.text()
  try {
    const j = JSON.parse(text)
    return j?.error?.message || j?.message || text
  } catch {
    return text || res.statusText
  }
}
