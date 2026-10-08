/**
 * The request parameters offered in panel 04, per modality.
 *
 * Image values are guesses that had to be measured — OpenRouter publishes no
 * support data for them. The video endpoint is the opposite: it validates its
 * own input and names the legal values in the error, so these enums are copied
 * from what it actually accepts. Accepted still isn't honoured, so both are
 * measured the same way.
 */
export const PARAM_FIELDS = [
  {
    key: 'aspect_ratio',
    text: 'Aspect',
    // Ordered tallest to widest so the row reads as a shape gradient:
    // portrait on the left, square in the middle, landscape on the right.
    options: ['9:16', '2:3', '3:4', '1:1', '4:3', '3:2', '16:9'],
    glyph: true,
  },
  {
    // No 4K: nothing in the catalogue advertises above ~2K, and offering it only
    // invites a silently downgraded image that still bills in full. 2K itself is
    // usually a property of the model (recraft's -pro tiers are the 2K tiers),
    // not something this parameter can ask for.
    key: 'resolution',
    text: 'Resolution',
    options: ['1K', '2K'],
  },
  {
    // svg belongs here because vector models return it whatever is requested.
    key: 'output_format',
    text: 'Format',
    options: ['png', 'jpeg', 'webp', 'svg'],
  },
]

/** Straight from the endpoint's own validator; 21:9 and 9:21 are video-only. */
export const VIDEO_PARAM_FIELDS = [
  {
    key: 'aspect_ratio',
    text: 'Aspect',
    options: ['9:21', '9:16', '2:3', '3:4', '1:1', '4:3', '3:2', '16:9', '21:9'],
    glyph: true,
  },
  {
    key: 'resolution',
    text: 'Resolution',
    options: ['480p', '720p', '768p', '1080p', '1K', '2K', '4K'],
  },
  {
    // A number upstream, sent as one; the picker offers the lengths models
    // actually produce. Veo returned 8s whatever was asked.
    key: 'duration',
    text: 'Duration',
    options: ['4', '6', '8', '10', '12'],
    unit: 's',
    numeric: true,
  },
  {
    key: 'generate_audio',
    text: 'Audio',
    options: ['true', 'false'],
    boolean: true,
  },
]

export const fieldsFor = (kind) => (kind === 'video' ? VIDEO_PARAM_FIELDS : PARAM_FIELDS)
