/**
 * Appearance: 'system' follows the OS, 'light' and 'dark' override it.
 *
 * The page carries the choice as data-theme on <html>; the server writes it
 * there before the page loads, so this only has to keep it in step after a
 * change. In the desktop app the native title bar follows too — a null theme
 * hands it back to the OS. In a plain browser there is no Tauri global and
 * that half is skipped.
 */
export const THEMES = ['system', 'light', 'dark']

export const initialTheme = () => document.documentElement.dataset.theme || 'system'

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme

  const win = window.__TAURI__?.window?.getCurrentWindow?.()
  win?.setTheme(theme === 'light' || theme === 'dark' ? theme : null).catch(() => {})
}
