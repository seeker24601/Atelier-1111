/**
 * Selecting plates in the gallery. Pure, so the rules are tested apart from
 * the pointer handling that drives them.
 */

/** Every id from `from` to `to` in gallery order, either way round. */
export function rangeOf(order, from, to) {
  const a = order.indexOf(from)
  const b = order.indexOf(to)
  if (a < 0 || b < 0) return [to]
  return order.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** One click: Shift extends from the last click, anything else flips the one. */
export function clickSelect(selected, order, id, { range = false, anchor = null } = {}) {
  const next = new Set(selected)
  if (range && anchor != null && order.includes(anchor)) {
    for (const each of rangeOf(order, anchor, id)) next.add(each)
  } else if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

/** A drag box: what it touches, on top of what was held when the drag began if adding. */
export function boxSelect(base, hits, additive) {
  return new Set(additive ? [...base, ...hits] : hits)
}

/** Ids that no longer exist drop out; the same Set comes back when nothing did. */
export function prune(selected, order) {
  const live = new Set(order)
  const kept = [...selected].filter((id) => live.has(id))
  return kept.length === selected.size ? selected : new Set(kept)
}
