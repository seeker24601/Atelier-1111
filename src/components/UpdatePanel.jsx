import { useState } from 'react'
import { canUpdate, checkForUpdate, installUpdate, wantsTestBuilds, setWantsTestBuilds } from '../updates.js'

/**
 * Desktop only: check the release feed, then install and restart. "Include
 * test builds" switches this machine to the test feed, which offers each new
 * build before it is promoted to a release everyone gets.
 */
export default function UpdatePanel() {
  const [state, setState] = useState({ step: 'idle' })
  const [testBuilds, setTestBuilds] = useState(wantsTestBuilds)

  if (!canUpdate()) return null
  const channel = testBuilds ? 'test' : null

  async function check() {
    setState({ step: 'checking' })
    try {
      const status = await checkForUpdate(channel)
      setState({ step: status.available ? 'available' : 'current', ...status })
    } catch (e) {
      setState({ step: 'error', error: String(e) })
    }
  }

  async function install() {
    setState((s) => ({ ...s, step: 'installing' }))
    try {
      await installUpdate(channel)
    } catch (e) {
      setState((s) => ({ ...s, step: 'error', error: String(e) }))
    }
  }

  function toggleTestBuilds() {
    const next = !testBuilds
    setTestBuilds(next)
    setWantsTestBuilds(next)
    // What was found on the other feed no longer applies.
    setState({ step: 'idle' })
  }

  const { step } = state
  return (
    <section className="settings__col">
      <span className="plate-title">Updates</span>

      {state.current && (
        <div className="proc" style={{ marginTop: 20 }}>
          <div className="proc__row">
            <span className="label label--sm dim">Installed</span>
            <span className="data">v{state.current}</span>
          </div>
          {state.available && (
            <div className="proc__row">
              <span className="label label--sm dim">Available</span>
              <span className="data">v{state.available}</span>
            </div>
          )}
        </div>
      )}

      <div className="stack-sm" style={{ marginTop: 16 }}>
        {step === 'available' || step === 'installing' ? (
          <button className="btn" onClick={install} disabled={step === 'installing'}>
            <span>{step === 'installing' ? 'Installing…' : 'Install and restart'}</span>
            <span>↓</span>
          </button>
        ) : (
          <button className="btn" onClick={check} disabled={step === 'checking'}>
            <span>
              {step === 'checking' ? 'Checking…' : step === 'current' ? 'Up to date · check again' : 'Check for updates'}
            </span>
            <span>→</span>
          </button>
        )}
        <button
          className="send-toggle"
          aria-pressed={testBuilds}
          onClick={toggleTestBuilds}
          disabled={step === 'checking' || step === 'installing'}
          title="Test builds arrive as soon as they are made, before they are released to everyone."
        >
          <span className={`mark ${testBuilds ? 'mark--on' : ''}`} style={{ width: 8, height: 8 }} />
          include test builds
        </button>
        {state.notes && step === 'available' && <p className="prose prose--sm">{state.notes}</p>}
        {step === 'error' && <p className="banner banner--err">{state.error}</p>}
      </div>
    </section>
  )
}
