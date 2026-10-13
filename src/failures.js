/**
 * A failed job, put in words: what went wrong, the one move that fixes it, and
 * a link when the provider gave one. The provider's own message is kept for
 * anyone who wants it; this is the headline above it.
 *
 * `fix` is one of: 'ref' (the model needs a reference image), 'settings' (the
 * key itself was refused), or 'retry'.
 */
const RULES = [
  {
    test: /input_references?[^.]*must have between 1|requires? (an? )?(input )?(reference|image)/i,
    title: 'Needs a reference image',
    detail: 'This model only works from at least one reference. Add one and it runs.',
    fix: 'ref',
  },
  {
    test: /quota|rate.?limit|too many requests|\b429\b/i,
    title: 'Quota used up',
    detail: 'This key has hit its limit for now. Check the plan, then retry.',
    fix: 'retry',
  },
  {
    test: /insufficient (credits?|funds|balance)|out of credits?|\b402\b|payment required/i,
    title: 'Out of credit',
    detail: 'Add credit with the provider, then retry.',
    fix: 'retry',
  },
  {
    test: /\b401\b|unauthori[sz]ed|invalid (api )?key|incorrect api key|authentication/i,
    title: 'Key not accepted',
    detail: 'The provider turned the key down. Replace it in Settings.',
    fix: 'settings',
  },
  {
    test: /moderat|safety|flagged|content polic|not allowed|blocked/i,
    title: 'Refused by the filter',
    detail: "The provider's filter turned the prompt down. Try rewording it.",
    fix: 'retry',
  },
  {
    test: /time(d)? ?out|ETIMEDOUT|deadline/i,
    title: 'Timed out',
    detail: 'The provider took too long to answer. Retry.',
    fix: 'retry',
  },
]

export function describeFailure(error = '') {
  const text = String(error || '')
  const rule = RULES.find((r) => r.test.test(text))
  const link = /https?:\/\/[^\s)'"<>]+[^\s)'"<>.,]/.exec(text)?.[0] ?? null
  if (rule) return { title: rule.title, detail: rule.detail, fix: rule.fix, link }
  return { title: 'Failed', detail: 'The provider returned an error. Its message is below.', fix: 'retry', link }
}
