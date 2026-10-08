/**
 * How a parameter has fared across the whole catalogue, not just one model.
 *
 * Per-model evidence is thin — most models have seen one or two values — but
 * the aggregate can be decisive: `resolution` has been honoured by no video
 * model, ever, across every attempt. That is worth saying out loud without
 * disabling anything, because it is a fact about the record so far and not a
 * measurement of the model in front of you.
 */

/**
 * @param {Array} rows every capability row
 * @param {Array<string>} modelIds the catalogue in view, which scopes the count
 * @param {string} param
 */
export function recordFor(rows = [], modelIds = [], param) {
  const scope = new Set(modelIds)
  const mine = rows.filter((r) => r.param === param && scope.has(r.model))

  const count = { ok: 0, ignored: 0, rejected: 0 }
  for (const row of mine) if (row.verdict in count) count[row.verdict]++

  const attempts = count.ok + count.ignored + count.rejected
  return {
    ...count,
    attempts,
    models: new Set(mine.map((r) => r.model)).size,
    /** Never once respected, on enough evidence to be worth reporting. */
    neverHonoured: attempts >= 3 && count.ok === 0,
  }
}
