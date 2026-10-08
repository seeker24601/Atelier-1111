import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = join(ROOT, 'data')
export const IMAGE_DIR = join(DATA_DIR, 'images')

mkdirSync(IMAGE_DIR, { recursive: true })
