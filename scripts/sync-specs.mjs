// Refreshes the bundled copy of openrouter-image-specs: the options each
// OpenRouter image model declares on fal (aspect ratios, resolutions, formats,
// backgrounds, reference limits). Run, review the diff, commit.
//
//   node scripts/sync-specs.mjs
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = 'https://raw.githubusercontent.com/seeker24601/openrouter-image-specs/main/specs.json'
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'specs', 'openrouter-image-specs.json')

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`)
const specs = await response.json()
if (!specs.models || typeof specs.models !== 'object') throw new Error('Not a specs file: no models.')
writeFileSync(target, JSON.stringify(specs, null, 2) + '\n')
console.log(`Wrote ${Object.keys(specs.models).length} model specs, generated ${specs.generated_at}.`)
