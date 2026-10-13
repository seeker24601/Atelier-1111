import { LOGOS } from '../../logos.js'
import { MAKER_LABEL } from '../../makers.js'

/** Every mark once, as symbols; each <Logo> after that is a two-line <use>. */
export function LogoSprite() {
  return (
    <svg className="sr" aria-hidden="true" focusable="false">
      {Object.entries(LOGOS).map(([id, { viewBox, shapes }]) => (
        <symbol key={id} id={`logo-${id}`} viewBox={viewBox}>
          {shapes.map((s, i) => (
            <path key={i} d={s.d} fillRule={s.fillRule} clipRule={s.clipRule} />
          ))}
        </symbol>
      ))}
    </svg>
  )
}

/**
 * A maker's or service's mark in the text colour. Decorative unless labelled:
 * the name is nearly always written beside it.
 */
export default function Logo({ id, size = '', label = null }) {
  const cls = `logo${size ? ` logo--${size}` : ''}`
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  // Higgsfield publishes no vector mark; its icon is drawn through a mask.
  if (id === 'higgsfield') return <span className={`${cls} logo--mask`} {...a11y} />
  return (
    <svg className={cls} {...a11y} focusable="false">
      <use href={`#logo-${LOGOS[id] ? id : 'generic'}`} />
    </svg>
  )
}

export const labelFor = (id) => MAKER_LABEL[id] ?? id
