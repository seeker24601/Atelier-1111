/** Every plate carries an ID: "01 / Model", the number dimmed. */
export default function Plate({ id, right, children, bodyless = false }) {
  const [num, name] = id.includes(' / ') ? id.split(' / ') : [null, id]
  return (
    <section className="plate">
      <header className="plate__head">
        <span className="plate__id">
          {num && <span className="dim">{num} / </span>}
          {name}
        </span>
        {right != null && <span className="plate__id dim">{right}</span>}
      </header>
      {bodyless ? children : <div className="plate__body">{children}</div>}
    </section>
  )
}
