/**
 * The log, assembled from the job table and the gallery.
 *
 * The server lists its most recent jobs; anything older, or whose log row was
 * cleared, is still described by the plates it produced. Both are merged so
 * the log reaches as far back as the gallery does.
 */
export function assembleLog(serverJobs = [], stored = [], limit = 40) {
  const done = stored.map((r) => ({
    id: r.job_id ?? r.id,
    status: 'done',
    kind: r.kind,
    model: r.model,
    prompt: r.prompt,
    note: r.note ?? null,
    cost: r.cost,
    created_at: r.created_at,
  }))

  // A job the server still lists wins over the copy built from the gallery, so
  // a row never appears twice.
  const seen = new Set(serverJobs.map((j) => j.id))
  return [...serverJobs, ...done.filter((j) => !seen.has(j.id))]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit)
}
