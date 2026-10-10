/** HTTP transport only. Presentation helpers live in format.js. */

async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}))
  // Extra fields (a key's provider choices) ride along on the error.
  if (!res.ok) throw Object.assign(new Error(body.error || `${res.status} ${res.statusText}`), { status: res.status, body })
  return body
}

const send = (method) => (url, payload) =>
  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).then(jsonOrThrow)

const post = send('POST')
const put = send('PUT')
const del = send('DELETE')

export const api = {
  health: () => fetch('/api/health').then(jsonOrThrow),

  models: ({ kind = 'image', refresh = false, all = false } = {}) => {
    const q = new URLSearchParams({ kind, ...(refresh ? { refresh: '1' } : {}), ...(all ? { all: '1' } : {}) })
    return fetch(`/api/models?${q}`).then(jsonOrThrow)
  },

  images: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    return fetch(`/api/images?${q}`).then(jsonOrThrow)
  },
  clearImages: () => del('/api/images'),
  importImage: (record, data) => post('/api/images/import', { record, data }),
  storage: () => fetch('/api/storage').then(jsonOrThrow),

  jobs: () => fetch('/api/jobs').then(jsonOrThrow),
  clearJobs: () => del('/api/jobs'),

  capabilities: (model) =>
    fetch(`/api/capabilities${model ? `?model=${encodeURIComponent(model)}` : ''}`).then(jsonOrThrow),

  /** Report whether a model used the reference it was given (see the route). */
  setReference: (model, verdict) => put('/api/capabilities/reference', { model, verdict }),

  generate: (payload) => post('/api/generate', payload),
  remove: (id) => del(`/api/images/${id}`),

  settings: {
    read: () => fetch('/api/settings').then(jsonOrThrow),
    saveKey: (key, provider) => put('/api/settings/key', provider ? { key, provider } : { key }),
    clearKey: (provider) => del(`/api/settings/key/${encodeURIComponent(provider)}`),
    setActive: (provider) => put('/api/settings/active', { provider }),
    setTheme: (theme) => put('/api/settings/theme', { theme }),
    hiddenModels: () => fetch('/api/settings/hidden-models').then(jsonOrThrow),
    setHiddenModels: (ids) => put('/api/settings/hidden-models', { ids }),
    account: (fresh = false) =>
      fetch(`/api/settings/account${fresh ? '?fresh=1' : ''}`).then(jsonOrThrow),
  },
}

/** A stored blob, re-encoded for the API — which takes references as data URLs. */
export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}
