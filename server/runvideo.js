import * as jobsRepo from './db/jobs.js'
import * as capsRepo from './db/capabilities.js'
import { readVideoMeta } from './videometa.js'
import { save } from './library.js'
import { generateVideo, collectVideo } from './videos.js'
import { openrouterModel } from './modelid.js'
import { assessVideo } from './videoassess.js'
import { paramsBlamedBy, acceptedValuesFor, looksLikeParamRejection } from './rejection.js'
import { VERDICT } from './capabilities.js'

/**
 * A refused video parameter is the cheapest fact in the app: nothing renders,
 * nothing bills, and the provider usually names the whole legal set —
 * "Supported durations: 5, 10s". The image path has recorded these from the
 * start; without this the video path threw them away.
 *
 * Not retried, unlike images: dropping `duration` from a video request changes
 * what you get and what it costs, and the clip is a dollar either way.
 */
function recordRejection(job, message) {
  if (!looksLikeParamRejection(message)) return
  for (const param of paramsBlamedBy(message, job.params)) {
    const accepted = acceptedValuesFor(message, param)
    capsRepo.record({
      model: job.model,
      param,
      value: String(job.params[param]),
      verdict: VERDICT.REJECTED,
      evidence: (accepted ? `Accepted: ${accepted}. ` : '') + String(message).slice(0, 300),
    })
  }
}

/**
 * Video is a job on the far side too: started, polled, then downloaded. Nothing
 * is streamed and there is no batch, so it shares only the reference handling
 * and the measure-what-came-back discipline.
 */
/**
 * Pick up a clip that was already generating when this process last stopped.
 * Nothing new is requested: it polls the id it recorded and collects the
 * result, which is otherwise billed and lost.
 */
export async function resumeVideoJob(job) {
  const { cost, video } = await collectVideo(job.remote_id)
  const meta = readVideoMeta(video.buf)

  for (const finding of assessVideo(job.params, meta)) {
    capsRepo.record({ model: job.model, ...finding })
  }

  const note = 'Recovered after a restart'
  await save(job, {
    params: job.params,
    outputs: [{ buf: video.buf, mediaType: video.mediaType, meta }],
    cost,
    note,
  })

  return { cost, note }
}

export async function runVideoJob(job, references) {
  let started
  const result = await generateVideo({
    model: openrouterModel(job.model),
    prompt: job.prompt,
    params: job.params,
    inputReferences: references.map((r) => r.url),
    // Kept as soon as the job exists upstream: without it a clip that finishes
    // after a restart is billed and unreachable.
    onStarted: (id) => {
      started = id
      jobsRepo.setRemoteId(job.id, id)
    },
  }).catch((err) => {
    recordRejection(job, err.message)
    throw err
  })
  const { request, cost, video } = result

  const meta = readVideoMeta(video.buf)
  for (const finding of assessVideo(job.params, meta)) {
    capsRepo.record({ model: job.model, ...finding })
  }

  const note = request.duration ? null : 'Length chosen by the model'
  await save(job, {
    params: job.params,
    outputs: [{ buf: video.buf, mediaType: video.mediaType, meta }],
    refs: references.map((r) => ({ width: r.width ?? null, height: r.height ?? null })),
    cost,
    note,
  })

  return { cost, note }
}
