import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import StoragePanel from './StoragePanel.jsx'
import UpdatePanel from './UpdatePanel.jsx'
import ModelsPanel from './ModelsPanel.jsx'
import KeysPanel from './KeysPanel.jsx'

/**
 * Settings, as a page in the same system: keys, updates, storage and models.
 * No appearance section: the app is dark only. Keys are typed in KeysPanel
 * and posted straight to the local API; they never come back over the wire.
 */
export default function SettingsPanel({ open, onClose, settings, storage, onModelsChange }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && !e.target.closest?.('input, textarea') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings-page" role="dialog" aria-label="Settings">
      <header className="topbar">
        <span className="word">
          Atelier 1111
          <i aria-hidden="true" />
        </span>
        <span className="here label">Settings</span>
        <span className="spacer" />
        <button className="back label" onClick={onClose} title="Esc">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to the studio
        </button>
      </header>

      <main className="settings">
        {/* Two stacks, not one grid: a long model list must not push Updates out of sight. */}
        <div className="settings__cols">
          <div className="settings__stack">
            <KeysPanel settings={settings} />
            <UpdatePanel />
          </div>
          <div className="settings__stack">
            <StoragePanel {...storage} />
            {/* Remounted per provider: the hide list shows the active provider's models. */}
            <ModelsPanel
              key={settings.status.active ?? 'none'}
              provider={settings.status.providers?.find((p) => p.id === settings.status.active) ?? null}
              onChange={onModelsChange}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
