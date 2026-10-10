import { useEffect } from 'react'
import StoragePanel from './StoragePanel.jsx'
import UpdatePanel from './UpdatePanel.jsx'
import ModelsPanel from './ModelsPanel.jsx'
import KeysPanel from './KeysPanel.jsx'
import { THEMES } from '../theme.js'

/**
 * Keys, storage, appearance, models and updates. Keys are typed in KeysPanel
 * and posted straight to the local API; they never come back over the wire.
 */
export default function SettingsPanel({ open, onClose, settings, storage, onModelsChange }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="detail">
      <header className="detail__head">
        <span className="plate__id">Settings</span>
        <button className="btn btn--sm" onClick={onClose} title="Esc">
          ×
        </button>
      </header>

      <div className="settings">
        <KeysPanel settings={settings} />

        <StoragePanel {...storage} />

        <section className="settings__col">
          <span className="plate-title">Appearance</span>
          <div className="seg" role="group" aria-label="Appearance" style={{ marginTop: 20 }}>
            {THEMES.map((t) => (
              <button
                key={t}
                className="seg__opt"
                aria-pressed={settings.theme === t}
                onClick={() => settings.setTheme(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Remounted per provider: the hide list shows the active provider's models. */}
        <ModelsPanel
          key={settings.status.active ?? 'none'}
          provider={settings.status.providers?.find((p) => p.id === settings.status.active) ?? null}
          onChange={onModelsChange}
        />

        <UpdatePanel />
      </div>
    </div>
  )
}
