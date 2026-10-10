// Prepares a data directory for v0.1.0 by stripping the `openrouter:` prefix
// from stored model ids. Backs up first. Usage: node scripts/downgrade-model-ids.mjs [dataDir]
import { resolve } from 'node:path'

process.env.ATELIER_DATA_DIR = resolve(process.argv[2] || 'data')
const { db } = await import('../server/db/index.js')
const { getHiddenModels, setHiddenModels } = await import('../server/settings.js')
const { downgradeModelIds } = await import('../server/migrations.js')
const { changed, backup } = downgradeModelIds({
  db,
  dataDir: process.env.ATELIER_DATA_DIR,
  hiddenModels: { get: getHiddenModels, set: setHiddenModels },
})
db.close()
console.log(`Stripped the openrouter: prefix from ${changed} rows. Backup: ${backup.dbCopy}`)
