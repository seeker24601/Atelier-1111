import { DatabaseSync, backup } from 'node:sqlite'
import { existsSync, mkdirSync, cpSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'

const source = resolve(process.argv[2] || 'data')
if (!process.argv[3]) throw new Error('Supply the destination desktop data directory.')
const destination = resolve(process.argv[3])
if (source === destination || destination.startsWith(source + sep)) throw new Error('Use a separate destination.')
if (existsSync(join(destination, 'atelier.db')) || existsSync(join(destination, 'settings.json'))) {
  throw new Error('Desktop data already exists. Migration refuses to overwrite it.')
}
mkdirSync(destination, { recursive: true })
if (existsSync(join(source, 'atelier.db'))) {
  const database = new DatabaseSync(join(source, 'atelier.db'), { readOnly: true })
  try { await backup(database, join(destination, 'atelier.db')) }
  finally { database.close() }
}
for (const path of ['images', 'settings.json']) {
  if (existsSync(join(source, path))) cpSync(join(source, path), join(destination, path), { recursive: true })
}
console.log('Copied gallery and settings. Original data remains unchanged.')
