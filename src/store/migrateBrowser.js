import { api, blobToDataUrl } from '../api.js'

/**
 * Moving a gallery the browser-storage build left in IndexedDB onto disk.
 *
 * That build kept every plate in this browser only. This runs once per browser
 * on load: each record is handed to the server, which writes it to
 * data/images keeping its id, and the browser database is deleted only after
 * every record is safely across. A failure part-way leaves the rest in place
 * for the next load; a repeat is a no-op because ids are kept.
 */

const NAME = 'atelier-1111'
const STORE = 'outputs'

async function exists() {
  // Without databases() the only way to look is to open, which creates an
  // empty one — harmless, and deleted again below.
  if (!indexedDB.databases) return true
  return (await indexedDB.databases()).some((d) => d.name === NAME)
}

function readAll() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.close()
        return resolve([])
      }
      const get = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      get.onsuccess = () => {
        db.close()
        resolve(get.result || [])
      }
      get.onerror = () => {
        db.close()
        reject(get.error)
      }
    }
  })
}

const drop = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })

/** @returns {Promise<number>} how many plates were moved onto disk */
export async function migrateBrowserGallery() {
  if (typeof indexedDB === 'undefined' || !(await exists())) return 0

  const records = await readAll()
  let moved = 0
  for (const { blob, ...record } of records) {
    if (!(blob instanceof Blob)) continue
    const { adopted } = await api.importImage(record, await blobToDataUrl(blob))
    if (adopted) moved++
  }
  await drop()
  return moved
}
