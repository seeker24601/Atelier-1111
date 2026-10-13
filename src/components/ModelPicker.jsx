import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import Logo, { labelFor } from './ui/Logo.jsx'
import { makerOf, modelName } from '../makers.js'
import { dollars, perMillion } from '../format.js'

const CLOSE_MS = 90

/**
 * The model picker: as tall as the column, searchable, the makers' marks as
 * filters, the models already used here first. Arrow keys move, Enter picks,
 * Escape closes. It wipes in from the column and leaves the way it came.
 *
 * A model that cannot take the references attached is listed but not
 * pickable, and says why, as the old dropdown did.
 */
export default function ModelPicker({ open, kind, models, model, recent = [], measured, refCapFor, refsAttached = 0, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const [maker, setMaker] = useState('all')
  const [hi, setHi] = useState(0)
  const [closing, setClosing] = useState(false)
  const list = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setMaker('all')
      setHi(0)
      setClosing(false)
    }
  }, [open])

  const close = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onClose()
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }

  const makers = useMemo(() => {
    const ids = [...new Set(models.map((m) => makerOf(m.id)))]
    return ids.sort((a, b) => labelFor(a).localeCompare(labelFor(b)))
  }, [models])

  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const row = (m) => {
      const cap = m.acceptsImages === false ? 0 : refCapFor(m.id)
      const avg = measured.get(m.id)
      const rate = m.pricing?.imageOutput ?? m.pricing?.imageToken ?? m.pricing?.completion
      return {
        id: m.id,
        mark: makerOf(m.id),
        name: modelName(m),
        refs: cap > 0 && Number.isFinite(cap) ? `${cap} ref${cap === 1 ? '' : 's'}` : '',
        price: avg != null ? `~${dollars(avg)}` : kind === 'video' || rate == null ? '' : `${perMillion(rate)}/M`,
        measured: avg != null,
        blocked: refsAttached > cap,
        why: cap === 0 ? 'takes no references' : `takes ${cap} reference${cap === 1 ? '' : 's'}`,
      }
    }
    const byId = new Map(models.map((m) => [m.id, m]))
    if (!terms.length && maker === 'all') {
      const used = recent.filter((id) => byId.has(id)).slice(0, 8)
      return [
        ...(used.length ? [{ head: 'Recent' }, ...used.map((id) => row(byId.get(id)))] : []),
        { head: `All models · ${models.length}` },
        ...models.map(row),
      ]
    }
    const hits = models.filter((m) => {
      const hay = `${modelName(m)} ${labelFor(makerOf(m.id))} ${m.id}`.toLowerCase()
      return (maker === 'all' || makerOf(m.id) === maker) && terms.every((t) => hay.includes(t))
    })
    return [{ head: hits.length ? `${hits.length} model${hits.length === 1 ? '' : 's'}` : 'Nothing matches' }, ...hits.map(row)]
  }, [models, query, maker, recent, measured, refCapFor, refsAttached, kind])

  const pickable = rows.filter((r) => r.id && !r.blocked)

  // Keep the highlighted row in view while the arrow keys walk the list.
  useEffect(() => {
    list.current?.querySelector('.pick.is-hi')?.scrollIntoView({ block: 'nearest' })
  }, [hi, rows])

  // Escape closes it wherever focus has gone.
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const pick = (id) => {
    onPick(id)
    close()
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((h) => Math.min(h + 1, pickable.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (pickable[hi]) pick(pickable[hi].id)
    }
  }

  let n = -1
  return (
    <>
      <button className={`scrim${closing ? ' is-closing' : ''}`} type="button" aria-label="Close model picker" onClick={close} />
      <div className={`picker${closing ? ' is-closing' : ''}`} role="dialog" aria-label="Choose a model">
        <div className="picker__search">
          <Search size={16} aria-hidden="true" />
          <input
            className="picker__input"
            type="text"
            aria-label="Search models"
            placeholder={`Search ${models.length} ${kind === 'video' ? 'video models' : 'models'}`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHi(0)
            }}
            onKeyDown={onKey}
            autoFocus
          />
          <button className="btn btn--sm" type="button" onClick={close}>
            Esc
          </button>
        </div>

        {makers.length > 1 && (
          <div className="makers" role="group" aria-label="Filter by maker">
            <button className="maker" type="button" aria-pressed={maker === 'all'} onClick={() => setMaker('all')}>
              All
            </button>
            {makers.map((id) => (
              <button
                key={id}
                className="maker"
                type="button"
                aria-pressed={maker === id}
                aria-label={labelFor(id)}
                title={labelFor(id)}
                onClick={() => {
                  setMaker(maker === id ? 'all' : id)
                  setHi(0)
                }}
              >
                <Logo id={id} size="md" />
              </button>
            ))}
          </div>
        )}

        <div className="picker__list" ref={list}>
          {rows.map((r, i) => {
            if (r.head) return <div key={`h${i}`} className="picker__group">{r.head}</div>
            if (!r.blocked) n++
            const isHi = !r.blocked && n === hi
            return (
              <button
                key={`${r.id}-${i}`}
                className={`pick${isHi ? ' is-hi' : ''}`}
                type="button"
                aria-pressed={r.id === model}
                disabled={r.blocked}
                title={r.blocked ? `${r.name} ${r.why}; remove some references first` : r.id}
                onClick={() => pick(r.id)}
              >
                <Logo id={r.mark} size="md" />
                <span className="pick__name">{r.name}</span>
                <span className="pick__meta">{r.blocked ? r.why : r.refs}</span>
                <span className={`pick__price${r.measured ? '' : ' pick__price--rate'}`}>{r.price}</span>
              </button>
            )
          })}
        </div>
        <div className="picker__foot">↑ ↓ move · Enter choose · Esc close</div>
      </div>
    </>
  )
}
