import { appendFileSync, existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = process.env.ATELIER_TEST_BACKEND_ROOT
  ? pathToFileURL(resolve(process.env.ATELIER_TEST_BACKEND_ROOT) + sep)
  : new URL('../../', import.meta.url)
const { adapter } = await import(new URL('server/providers/index.js', root))
const { storeKey } = await import(new URL('server/settings.js', root))

storeKey('openrouter', 'sk-or-fixture-secret-1234')
storeKey('google', 'fixture-google-key')
const provider = adapter('openrouter')
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII='
provider.listModels = async kind => [{ id: `fixture-${kind}`, name: `Fixture ${kind}`, pricing: {}, inputs: ['text', 'image'] }]
provider.generateImage = async ({ params, prompt }) => {
  appendFileSync(join(process.env.ATELIER_DATA_DIR, 'provider-calls.log'), `${prompt}\n`)
  if (prompt.startsWith('hold queue')) {
    while (!existsSync(join(process.env.ATELIER_DATA_DIR, 'release-queue'))) await delay(10)
  }
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
await import(new URL('server/index.js', root))
