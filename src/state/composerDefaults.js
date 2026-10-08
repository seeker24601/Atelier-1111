/**
 * What each modality starts with. Image values are conservative because model
 * support varies and every send switch is a spending decision; video values are
 * the ones the models returned when asked for nothing.
 */
export const DEFAULTS = {
  image: {
    params: { aspect_ratio: '1:1', resolution: '2K', output_format: 'png' },
    // Model support for these varies, so each carries its own send switch.
    on: { aspect_ratio: true, resolution: false, output_format: true },
  },
  video: {
    // Landscape and 8s because that is what the models returned unasked; audio
    // on because the models that generate it are the reason to use them.
    params: { aspect_ratio: '16:9', resolution: '720p', duration: '8', generate_audio: 'true' },
    on: { aspect_ratio: true, resolution: true, duration: true, generate_audio: false },
  },
}

