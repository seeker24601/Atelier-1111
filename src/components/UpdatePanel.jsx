import { useState } from 'react'
import { ArrowRight, Download, Square, SquareCheck } from 'lucide-react'
import Plate from './ui/Plate.jsx'
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
  const busy = step === 'checking' || step === 'installing'
  return (
    <Plate id="02 / Updates">
      {state.current && (
        <dl className="facts">
          <dt>Installed</dt>
          <dd>v{state.current}</dd>
          {state.available && (
            <>
              <dt>Available</dt>
              <dd>v{state.available}</dd>
            </>
          )}
        </dl>
      )}

      {step === 'available' || step === 'installing' ? (
        <button className="btn btn--ink btn--wide" onClick={install} disabled={step === 'installing'}>
          <span>{step === 'installing' ? 'Installing' : 'Install and restart'}</span>
          {step === 'installing' ? <span className="wait" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        </button>
      ) : (
        <button className="btn btn--wide" onClick={check} disabled={busy}>
          <span>{step === 'checking' ? 'Checking' : step === 'current' ? 'Up to date · check again' : 'Check for updates'}</span>
          {step === 'checking' ? <span className="wait" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
        </button>
      )}

      <button
        className="toggle"
        aria-pressed={testBuilds}
        onClick={toggleTestBuilds}
        disabled={busy}
        title="Test builds arrive as soon as they are made, before they are released to everyone."
      >
        {testBuilds ? <SquareCheck size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
        Include test builds
      </button>
      {state.notes && step === 'available' && <p className="prose prose--sm">{state.notes}</p>}
      {step === 'error' && <p className="banner banner--err">{state.error}</p>}
    </Plate>
  )
}
