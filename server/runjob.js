import * as jobsRepo from './db/jobs.js'
import { resolveReferences } from './references.js'
import * as capsRepo from './db/capabilities.js'
import { resolve } from './providers/index.js'
import { readImageMeta } from './imagemeta.js'
import { setPreview, dropPreview } from './outbox.js'
import { save } from './library.js'
import { slimRefs } from './media.js'
import { runVideoJob, resumeVideoJob } from './runvideo.js'
import { assessOutput, VERDICT } from './capabilities.js'
import { paramsBlamedBy, acceptedValuesFor, looksLikeParamRejection } from './rejection.js'

/**
 * A parameter rejection is a 400 — nothing is generated and nothing is billed —
 * so dropping the offending parameter and trying once more costs only latency,
 * and turns a dead end into a result plus a permanent capability fact.
 */
async function generateWithFallback(job, references) {
  const inputReferences = references.map((r) => r.url)
  const { adapter, model } = resolve(job.model)
  const call = (params) =>
    adapter.generateImage({
      model,
      prompt: job.prompt,
      params,
      refs: inputReferences,
      // Each partial replaces the last, so the gallery can show the image
      // forming. Nothing here is kept once the job settles.
      onPartial: ({ b64, mediaType }) =>
        setPreview(job.id, { buf: Buffer.from(b64, 'base64'), mediaType }),
    })

  try {
    // The ledger judges what the adapter actually sent, never the raw request.
    const result = await call(job.params)
    return { result, params: result.sent, note: omittedNote(result.omitted) }
  } catch (err) {
    // How many references the provider will take is a capability like any
    // other, and it only ever surfaces as a rejection — Azure caps MAI at one:
    // "input_references: must have between 0 and 1 items". Recorded against the
    // count that was refused, so the ceiling is one less than the lowest refusal.
    if (inputReferences?.length > 1 && /input_references/i.test(err.message)) {
      capsRepo.record({
        model: job.model,
        param: 'input_references',
        value: String(inputReferences.length),
        verdict: VERDICT.REJECTED,
        evidence: String(err.message).slice(0, 300),
      })
    }

    const blamed = looksLikeParamRejection(err.message)
      ? paramsBlamedBy(err.message, job.params)
      : []
    if (!blamed.length) throw err

    for (const param of blamed) {
      // "Accepted: 1K" is the most actionable part of a rejection, so it leads.
      const accepted = acceptedValuesFor(err.message, param)
      capsRepo.record({
        model: job.model,
        param,
        value: job.params[param],
        verdict: VERDICT.REJECTED,
        evidence:
          (accepted ? `Accepted: ${accepted}. ` : '') + String(err.message).slice(0, 300),
      })
    }

    const reduced = { ...job.params }
    for (const param of blamed) delete reduced[param]

    const result = await call(reduced)
    return {
      result,
      params: result.sent,
      note: [`Retried without ${blamed.join(', ')}`, omittedNote(result.omitted)].filter(Boolean).join('. '),
    }
  }
}

const omittedNote = (omitted = []) =>
  omitted.length ? `Not offered by this provider: ${omitted.join(', ')}` : null

/**
 * Measure what came back, record the verdicts, and write the bytes to disk.
 * The ledger keeps what a model did; the gallery keeps what it made.
 */
async function saveImages(job, result, params, note, references = []) {
  dropPreview(job.id)
  const outputs = result.images.map((img) => {
    const buf = Buffer.from(img.b64, 'base64')
    return { buf, mediaType: img.mediaType, meta: readImageMeta(buf) }
  })

  // One assessment per job — every image in a batch shares the request, and
  // the first reference is what a model would follow if it follows one.
  for (const finding of assessOutput(params, outputs[0]?.meta, references[0])) {
    capsRepo.record({ model: job.model, ...finding })
  }

  await save(job, {
    params,
    outputs,
    refs: references.map((r) => ({ width: r.width ?? null, height: r.height ?? null })),
    cost: result.cost,
    note,
  })
}

export async function runJob(jobId) {
  const job = jobsRepo.get(jobId)
  if (!job) return
  jobsRepo.setStatus(jobId, 'running')

  try {
    const references = await resolveReferences(job.refs || [])

    if (job.kind === 'video') {
      // Already started upstream: collect it rather than pay for it twice.
      const { cost, note } = job.remote_id
        ? await resumeVideoJob(job)
        : await runVideoJob(job, references)
      jobsRepo.finish(jobId, { status: 'done', cost, note })
      return
    }

    const { result, params, note } = await generateWithFallback(job, references)
    await saveImages(job, result, params, note, references)
    jobsRepo.finish(jobId, { status: 'done', cost: result.cost, note })
  } catch (err) {
    console.error(`[job ${jobId}]`, err.message)
    dropPreview(jobId)
    jobsRepo.finish(jobId, { status: 'error', error: err.message })
  } finally {
    jobsRepo.setRefs(jobId, slimRefs(job.refs))
  }
}
