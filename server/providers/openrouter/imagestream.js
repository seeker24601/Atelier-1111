/**
 * Server-sent events from POST /api/v1/images when `stream: true`.
 *
 * Streaming exists here for a specific reason: a non-streaming request sits
 * silent until the whole image is ready, and anything that generates for more
 * than 60 seconds gets its socket closed by something in the path
 * (UND_ERR_SOCKET, "other side closed", observed at exactly 60.0s across
 * unrelated vendors). Partial-image events keep bytes flowing, so the
 * connection never idles. Partial previews are not billed.
 *
 * Those partials are also a real progressive preview — the same bytes the model
 * has drawn so far — so they are handed to the caller rather than counted and
 * dropped.
 */

const DONE = '[DONE]'

/**
 * @param {Response} res
 * @param {(partial: {b64: string, mediaType: string, index: number}) => void} [onPartial]
 * @returns {{cost: number|null, images: Array<{b64: string, mediaType: string}>}}
 */
export async function readImageStream(res, onPartial) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  const images = []
  let cost = null
  let partials = 0
  let buffer = ''
  let streamError = null

  const handle = (payload) => {
    if (payload === DONE) return
    let event
    try {
      event = JSON.parse(payload)
    } catch {
      return // a heartbeat or comment line, not an event
    }

    switch (event.type) {
      case 'image_generation.partial_image':
        partials++
        // Not every provider sends bytes with a partial; the ones that do give
        // a preview for free, and the ones that do not simply never call back.
        if (event.b64_json) {
          onPartial?.({
            b64: event.b64_json,
            mediaType: event.media_type || 'image/png',
            index: event.partial_image_index ?? partials - 1,
          })
        }
        break
      case 'image_generation.completed':
        if (event.b64_json) {
          images.push({ b64: event.b64_json, mediaType: event.media_type || 'image/png' })
        }
        if (event.usage?.cost != null) cost = (cost ?? 0) + event.usage.cost
        break
      case 'error':
        streamError = event.error?.message || 'Generation failed mid-stream.'
        break
      default:
        // Unknown event types are ignored rather than treated as failures —
        // the format may gain types this client has never heard of.
        break
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by a blank line.
      let split
      while ((split = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, split)
        buffer = buffer.slice(split + 2)
        for (const line of frame.split('\n')) {
          if (line.startsWith('data:')) handle(line.slice(5).trim())
        }
      }
    }
  } finally {
    reader.releaseLock?.()
  }

  if (streamError) throw Object.assign(new Error(streamError), { status: 502 })

  return { cost, images, partials }
}
