/**
 * Which failures are news.
 *
 * The banner reports what just went wrong, not what ever went wrong: errors
 * already in the log when the page loads are history, and the job strip shows
 * those. Kept apart from useLibrary because it is a small piece of memory with
 * an easy rule, and it reads worse inlined among the polling.
 */
export function makeFailureWatch() {
  const seen = new Set()
  let primed = false

  return {
    /** @returns {object|null} the first failure worth surfacing, if any. */
    check(jobs) {
      const failed = jobs.filter((j) => j.status === 'error')
      const fresh = primed ? failed.find((j) => !seen.has(j.id)) : null
      primed = true
      for (const j of failed) seen.add(j.id)
      return fresh ?? null
    },
    reset() {
      seen.clear()
      primed = false
    },
  }
}
