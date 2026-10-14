/**
 * Selecting plates in the gallery. Pure, so the rules are tested apart from
 * the pointer handling that drives them.
 */

/**
 * Finished plates and failed jobs as the gallery lays them out: newest first,
 * each with a key unique across both, since a plate and a job can share an id.
 */
export function plateOrder(images, failures = []) {
  return [
    ...images.map((img) => ({ key: `img:${img.id}`, at: img.created_at, img })),
    ...failures.map((job) => ({ key: `job:${job.id}`, at: job.created_at, job })),
  ].sort((a, b) => b.at - a.at)
}

/** Selected keys split back into plate ids and job ids. */
export function splitKeys(keys) {
  const images = []
  const jobs = []
  for (const key of keys) {
    if (key.startsWith('img:')) images.push(key.slice(4))
    else if (key.startsWith('job:')) jobs.push(key.slice(4))
  }
  return { images, jobs }
}

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
