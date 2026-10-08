import { call, readError } from './http.js'
import { fetchModels } from './modelindex.js'
import { authHeaders, BASE } from './openrouter.js'

/**
 * POST /api/v1/videos — a job, not a response.
 *
 * Unlike images, video generation returns 202 immediately with a polling URL
 * and finishes minutes later, so there is nothing to stream and nothing to
 * decode until the job says `completed`. The finished record carries signed
 * content URLs and the real cost; the bytes come from a separate content call.
 *
 * The endpoint validates its own parameters and names the legal values in the
 * error, which is more than the images endpoint has ever published — but an
 * accepted value is still not an honoured one, so output is measured the same
 * way.
 */

const POLL_MS = 5000
const GIVE_UP_MS = 15 * 60 * 1000

/**
 * Segmented controls hand back strings; this endpoint type-checks strictly and
 * rejects `duration: "8"` outright. Coerced here rather than in the UI so the
 * control can stay a row of buttons.
 */
const COERCE = {
  duration: Number,
  seed: Number,
  generate_audio: (v) => v === true || v === 'true',
}

export const listVideoModels = (opts) => fetchModels('video', opts)

/** Not batched: the endpoint has no `n`, so one job is one clip. */
export async function generateVideo({
  model,
  prompt,
  params = {},
  inputReferences = [],
  onStarted,
  onStatus,
}) {
  const body = { model, prompt }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') body[k] = COERCE[k] ? COERCE[k](v) : v
  }
  if (inputReferences.length) {
    body.input_references = inputReferences.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
  }

  const started = await start(body)
  onStarted?.(started.id)
  const done = await waitFor(started.id, onStatus)
  const video = await content(started.id)

  return { request: body, cost: done.usage?.cost ?? null, video }
}

/**
 * Collect a generation that was already started — after a restart, say. The
 * clip has been paid for whether or not anything is listening, so the id is
 * worth more than the request that produced it.
 */
export async function collectVideo(remoteId, onStatus) {
  const done = await waitFor(remoteId, onStatus)
  return { cost: done.usage?.cost ?? null, video: await content(remoteId) }
}

async function start(body) {
  const res = await call(`${BASE}/videos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw Object.assign(new Error(await readError(res)), { status: res.status, request: body })
  }
  const job = await res.json()
  if (!job.id) throw Object.assign(new Error('Video job started without an id.'), { status: 502 })
  return job
}

const PENDING = new Set(['pending', 'queued', 'running', 'in_progress', 'processing'])

async function waitFor(id, onStatus) {
  const until = Date.now() + GIVE_UP_MS

  while (Date.now() < until) {
    const res = await call(`${BASE}/videos/${id}`, { headers: authHeaders() })
    if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status })

    const job = await res.json()
    onStatus?.(job.status)

    if (job.status === 'completed' || job.status === 'succeeded') return job
    if (!PENDING.has(job.status)) {
      // Providers put the reason in different places; keep whichever is there.
      const why = job.error?.message || job.error || job.failure_reason || job.status
      throw Object.assign(new Error(`Video job ${job.status}: ${why}`), { status: 502 })
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }

  throw Object.assign(new Error(`Video job still running after ${GIVE_UP_MS / 60000} minutes.`), {
    status: 504,
  })
}

/** The finished bytes, which arrive as a plain file rather than base64. */
async function content(id, index = 0) {
  const res = await call(`${BASE}/videos/${id}/content?index=${index}`, { headers: authHeaders() })
  if (!res.ok) throw Object.assign(new Error(await readError(res)), { status: res.status })

  return {
    buf: Buffer.from(await res.arrayBuffer()),
    mediaType: res.headers.get('content-type') || 'video/mp4',
  }
}
