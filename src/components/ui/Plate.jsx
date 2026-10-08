/** Every plate carries an ID. */
export default function Plate({ id, right, children, bodyless = false }) {
  return (
    <section className="plate">
      <header className="plate__head">
        <span className="plate__id">{id}</span>
        {right != null && <span className="plate__id dim">{right}</span>}
      </header>
      {bodyless ? children : <div className="plate__body">{children}</div>}
    </section>
  )
}
