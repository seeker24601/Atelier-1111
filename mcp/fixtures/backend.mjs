import { adapter } from '../../server/providers/index.js'
import { storeKey } from '../../server/settings.js'

storeKey('openrouter', 'sk-or-fixture-secret-1234')
storeKey('google', 'fixture-google-key')
const provider = adapter('openrouter')
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII='
provider.listModels = async kind => [{ id: `fixture-${kind}`, name: `Fixture ${kind}`, pricing: {}, inputs: ['text', 'image'] }]
provider.generateImage = async ({ params, prompt }) => {
  if (prompt === 'fixture failure') throw new Error('Fixture provider refused the prompt.')
  return { sent: params, omitted: [], images: [{ b64: png, mediaType: 'image/png' }], cost: 0 }
}
provider.generateVideo = async ({ params }) => ({
  request: params, cost: 0, video: { buf: Buffer.from('fixture-video'), mediaType: 'video/mp4' },
})
adapter('google').listModels = provider.listModels
// Every test stays inside this process or on loopback, including unexpected provider calls.
const realFetch = globalThis.fetch
globalThis.fetch = (url, options) => {
  if (new URL(url).hostname !== '127.0.0.1') throw new Error('External network disabled in MCP tests.')
  return realFetch(url, options)
}
process.argv.push('--app')
process.stdin.resume()
process.stdin.on('end', () => process.exit(0))
await import('../../server/index.js')
