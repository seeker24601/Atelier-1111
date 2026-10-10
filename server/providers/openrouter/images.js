import { getKey } from '../../settings.js'
import { call, readError } from '../../http.js'
import { readImageStream } from './imagestream.js'
import { fetchModels } from './modelindex.js'
import { nativeResolution } from './modelfacts.js'

export const BASE = 'https://openrouter.ai/api/v1'

export function authHeaders() {
  const key = getKey()
  if (!key) {
    const err = new Error('No API key. Open Settings and add your OpenRouter key.')
    err.status = 401
    throw err
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5180',
    'X-Title': process.env.OPENROUTER_APP_TITLE || 'Atelier-1111',
  }
}


/** Image models, with the one field only they have: a stated native size. */
export const listImageModels = (opts) =>
  fetchModels('image', {
    ...opts,
    // Stated in prose only; output size is a model property, not a parameter.
    decorate: (model, raw) => ({ ...model, nativeResolution: nativeResolution(raw.description) }),
  })

/**
 * POST /api/v1/images
 * Only defined params are forwarded — model support for aspect_ratio /
 * resolution / output_format varies, so the client decides what to send and the
 * raw upstream error is surfaced when a model rejects something.
 */
export async function generateImages({
  model,
  prompt,
  n,
  params = {},
  inputReferences = [],
  onPartial,
}) {
  const body = { model, prompt }
  if (n && n > 1) body.n = n
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') body[k] = v
  }
  if (inputReferences.length) {
    body.input_references = inputReferences.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
  }

  // Streamed so slow models keep the socket busy — a silent request is cut at
  // 60s. Providers that ignore `stream` answer with plain JSON, which the
  // content-type branch handles; one that rejects it outright falls back below,
  // so enabling streaming cannot break a model that worked without it.
  try {
    return await send({ ...body, stream: true }, onPartial)
  } catch (err) {
    if (!/stream/i.test(err.message || '')) throw err
    return await send(body)
  }
}

async function send(body, onPartial) {
  const res = await call(`${BASE}/images`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw Object.assign(new Error(await readError(res)), { status: res.status, request: body })
  }

  const streamed = (res.headers.get('content-type') || '').includes('text/event-stream')
  const { cost, images } = streamed
    ? await readImageStream(res, onPartial)
    : parseImagesJson(await res.json())

  if (!images.length) {
    throw Object.assign(new Error('Model returned no image data.'), { status: 502, request: body })
  }

  return { request: body, cost, images }
}

/** Non-streaming shape: everything arrives at once under `data`. */
function parseImagesJson(json) {
  return {
    cost: json.usage?.cost ?? null,
    images: (Array.isArray(json.data) ? json.data : []).map((d) => ({
      b64: d.b64_json,
      mediaType: d.media_type || d.mime_type || 'image/png',
    })),
  }
}
