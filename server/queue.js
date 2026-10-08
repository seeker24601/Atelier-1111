import { runJob } from './runjob.js'

/** Scheduling only — what a job does lives in runjob.js. */

const CONCURRENCY = 2

/**
 * How many jobs may be waiting or running at once.
 *
 * Held at four because that is what the UI offers and because each one is a
 * real charge: a queue you cannot see the end of is a way to spend money by
 * accident. Concurrency stays lower so a single model is not hit with four
 * simultaneous requests — Azure has already rate-limited this app doing them
 * one at a time.
 */
export const MAX_IN_FLIGHT = 4

const pending = []
let running = 0

export function enqueue(jobId) {
  pending.push(jobId)
  pump()
}

function pump() {
  while (running < CONCURRENCY && pending.length) {
    const id = pending.shift()
    running++
    runJob(id).finally(() => {
      running--
      pump()
    })
  }
}

export const depth = () => ({ pending: pending.length, running })
