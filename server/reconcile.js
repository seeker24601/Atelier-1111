import * as jobsRepo from './db/jobs.js'
import { enqueue } from './queue.js'

/**
 * Jobs left mid-flight by a restart.
 *
 * The queue lives in memory, so anything `queued` or `running` when the process
 * stopped has nothing driving it and would otherwise sit active forever. A
 * video that recorded an upstream id is resumed — it is generating regardless,
 * and has been paid for. Anything else is closed honestly rather than left
 * spinning. Finished work is already on disk and needs nothing.
 */
export function reconcileOrphans() {
  const stuck = jobsRepo.unfinished()
  if (!stuck.length) return { resumed: 0, closed: 0 }

  let resumed = 0
  let closed = 0

  for (const job of stuck) {
    if (job.kind === 'video' && job.remote_id) {
      enqueue(job.id)
      resumed++
    } else {
      jobsRepo.finish(job.id, {
        status: 'error',
        error: 'Interrupted by a restart before the model answered.',
      })
      closed++
    }
  }

  console.log(`[reconcile] ${resumed} resumed, ${closed} closed`)
  return { resumed, closed }
}
