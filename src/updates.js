/**
 * Updates come from the desktop shell, which checks the signed release feed on
 * GitHub and installs from it. In a plain browser (`npm start`, `npm run dev`)
 * there is no shell, so there is nothing to update in place.
 *
 * Channel "test" reads the test feed: every build as soon as it is made, before
 * it is promoted to a release everyone gets. Anything else reads releases.
 */
const invoke = () => window.__TAURI__?.core?.invoke

export const canUpdate = () => typeof invoke() === 'function'

/** @returns {Promise<{current: string, available: string|null, notes: string|null}>} */
export const checkForUpdate = (channel = null) => invoke()('update_check', { channel })

/** Resolves only if it fails: on success the app restarts into the new version. */
export const installUpdate = (channel = null) => invoke()('update_install', { channel })

const TEST_BUILDS = 'atelier.updates.testBuilds'

/** Whether this machine takes test builds. A per-device preference; off if storage is unavailable. */
export function wantsTestBuilds() {
  try {
    return localStorage.getItem(TEST_BUILDS) === 'true'
  } catch {
    return false
  }
}

export function setWantsTestBuilds(on) {
  try {
    if (on) localStorage.setItem(TEST_BUILDS, 'true')
    else localStorage.removeItem(TEST_BUILDS)
  } catch {
    // Storage blocked: the choice lasts until the window closes.
  }
}
