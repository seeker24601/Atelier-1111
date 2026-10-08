/**
 * Updates come from the desktop shell, which checks the signed release feed on
 * GitHub and installs from it. In a plain browser (`npm start`, `npm run dev`)
 * there is no shell, so there is nothing to update in place.
 */
const invoke = () => window.__TAURI__?.core?.invoke

export const canUpdate = () => typeof invoke() === 'function'

/** @returns {Promise<{current: string, available: string|null, notes: string|null}>} */
export const checkForUpdate = () => invoke()('update_check')

/** Resolves only if it fails: on success the app restarts into the new version. */
export const installUpdate = () => invoke()('update_install')
