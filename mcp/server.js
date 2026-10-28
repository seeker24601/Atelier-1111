import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { request } from './connection.js'
import { references } from './references.js'

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version
const kind = z.enum(['image', 'video'])
const id = z.string().uuid()
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value })

export function createMcpServer() {
  const server = new McpServer({ name: 'atelier-1111', version })
  const tool = (name, description, inputSchema, annotations, handler) => server.registerTool(name,
    { description, inputSchema, annotations }, async args => {
      try { return await handler(args) }
      catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] } }
    })

  tool('atelier_status', 'Read the active provider, configured providers, and local gallery storage.', {}, readOnly, async () => {
    const { key } = await request('/health')
    return text({ configured: key.configured, active: key.active,
      providers: key.providers.map(({ id, label, configured }) => ({ id, label, configured })),
      storage: await request('/storage') })
  })

  tool('atelier_list_models', 'List the active provider’s models, prices, and published parameter options.', {
    kind: kind.default('image'), query: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).default(40),
  }, { ...readOnly, openWorldHint: true }, async ({ kind, query, limit }) => {
    const { models } = await request(`/models?kind=${kind}`)
    const found = models.filter(m => !query || `${m.id} ${m.name}`.toLowerCase().includes(query.toLowerCase()))
    return text({ models: found.slice(0, limit), total: found.length })
  })

  tool('atelier_capabilities', 'Read measured parameter support for one provider-qualified model.', {
    model: z.string().min(1).max(300),
  }, readOnly, async ({ model }) => text(await request(`/capabilities?model=${encodeURIComponent(model)}`)))

  tool('atelier_generate', 'Queue an image or video using the active provider. Spends provider credits. Returns job IDs; check atelier_get_job for completion before retrying.', {
    model: z.string().min(1).max(300), prompt: z.string().trim().min(1).max(32000), kind: kind.default('image'),
    params: z.object({
      aspect_ratio: z.string().max(20).optional(), resolution: z.string().max(30).optional(),
      output_format: z.enum(['png', 'jpeg', 'webp', 'svg']).optional(), quality: z.string().max(30).optional(),
      background: z.enum(['transparent', 'opaque', 'auto']).optional(),
      duration: z.number().positive().max(120).optional(), generate_audio: z.boolean().optional(),
    }).strict().default({}),
    reference_image_ids: z.array(id).max(8).default([]),
    reference_paths: z.array(z.string().min(1).max(4096).refine(isAbsolute, 'Use an absolute file path.')).max(8).default([]),
  }, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  async ({ model, prompt, kind, params, reference_image_ids, reference_paths }) => {
    const refs = await references(reference_image_ids, reference_paths)
    return text(await request('/generate', { method: 'POST', body: { models: [model], prompt, kind, params, refs } }))
  })

  tool('atelier_get_job', 'Read a generation job’s status, error, cost, and saved output records.', { id }, readOnly,
    async ({ id }) => text(await request(`/jobs/${id}`)))

  tool('atelier_list_jobs', 'Read recent generation jobs. Uploaded reference bytes are excluded.', {}, readOnly, async () => {
    const { jobs } = await request('/jobs')
    return text({ jobs: jobs.map(({ refs, ...job }) => job) })
  })

  tool('atelier_list_gallery', 'Find saved images and videos by prompt, model, or media kind.', {
    query: z.string().max(200).optional(), model: z.string().max(300).optional(), kind: kind.optional(),
    limit: z.number().int().min(1).max(100).default(40),
  }, readOnly, async ({ query, model, kind, limit }) => {
    const params = new URLSearchParams({ limit: String(limit) })
    for (const [key, value] of Object.entries({ q: query, model, kind })) if (value) params.set(key, value)
    return text(await request(`/images?${params}`))
  })

  tool('atelier_get_media', 'Read saved media metadata and its local file path. Optionally include a raster image preview up to 5 MiB.', {
    id, include_image: z.boolean().default(false),
  }, readOnly, async ({ id, include_image }) => {
    const media = await request(`/media/${id}`)
    const result = text(media)
    result.content.push({ type: 'resource_link', uri: pathToFileURL(media.path).href,
      name: media.file, mimeType: media.media_type })
    if (include_image) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(media.media_type) || media.bytes > 5 * 1024 * 1024) {
        throw new Error('Use the local file path for this media. Inline previews support raster images up to 5 MiB.')
      }
      const bytes = await request(`/media/${id}/content`, { binary: true })
      if (bytes.length > 5 * 1024 * 1024) throw new Error('Image exceeds the 5 MiB preview limit.')
      result.content.push({ type: 'image', mimeType: media.media_type, data: bytes.toString('base64') })
    }
    return result
  })

  tool('atelier_select_provider', 'Select a configured provider for both Atelier and agent generations.', {
    provider: z.string().min(1).max(100),
  }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ provider }) => {
    const { active, configured } = await request('/settings/active', { method: 'PUT', body: { provider } })
    return text({ active, configured })
  })

  tool('atelier_delete_media', 'Permanently delete one saved image or video and its gallery record.', { id },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    async ({ id }) => text(await request(`/images/${id}`, { method: 'DELETE' })))
  return server
}
