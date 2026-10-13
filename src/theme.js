/**
 * Atelier is dark only. The page's colours live in tokens.css; this keeps the
 * desktop app's native title bar dark to match. In a plain browser there is no
 * Tauri global and this does nothing.
 */
export function applyDarkChrome() {
  const win = window.__TAURI__?.window?.getCurrentWindow?.()
  win?.setTheme('dark').catch(() => {})
}
