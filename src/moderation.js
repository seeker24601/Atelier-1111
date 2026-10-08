/**
 * Telling a content refusal apart from a real failure.
 *
 * These say nothing about what a model can do — they are a verdict on one
 * prompt, or on one reference image, and filing them as model defects makes a
 * capable model look broken. They are also **not deterministic**: in this
 * corpus, riverflow-v2.5-pro and gemini-3.1-flash-lite each refused a request
 * and then completed the identical request seconds later.
 *
 * Every provider words it differently and none of them use a distinct status
 * code, so this matches on wording. A miss costs only a label.
 */

const SIGNS = [
  /moderat/i, //                        Black Forest Labs, Recraft
  /inappropriate content/i, //          Sourceful
  /safety polic/i, //                   Azure / MAI
  /content blocked/i, //                Azure / MAI
  /blocked by label/i, //               Azure / MAI
  /sexual/i, //                         several
  /finish_reason: IMAGE_OTHER/i, //     Gemini, which declines to say why
  /violated/i,
  /suspected to include real human faces/i, // Qwen, about the reference
  /sensitivecontentdetected/i, //       ByteDance, on the reference
  /privacyinformation/i, //             ByteDance's code for a real face
  /may contain (a )?real person/i,
]

export function isModeration(message) {
  const text = String(message || '')
  return SIGNS.some((sign) => sign.test(text))
}

/** Whether the refusal was about the reference rather than the prompt. */
export function blamesInput(message) {
  return /input content|input_content|input image|real human faces|real person|reference/i.test(
    String(message || '')
  )
}

/** What the provider objected to. The badge stays one word; this qualifies it. */
export function moderationSubject(message) {
  return blamesInput(message) ? 'reference refused' : 'prompt refused'
}
