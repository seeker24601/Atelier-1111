import { parseModelId } from '../server/modelid.js'
import { LOGOS } from './logos.js'

/**
 * Who made a model, as a mark to draw. An OpenRouter id names its vendor
 * (`openrouter:black-forest-labs/flux-3-image`); any other provider's models
 * are that provider's own. A vendor with no published mark gets the generic one.
 */
const VENDOR = {
  'black-forest-labs': 'bfl',
  'bytedance-seed': 'bytedance',
  bytedance: 'bytedance',
  google: 'google',
  openai: 'openai',
  'x-ai': 'xai',
  qwen: 'qwen',
  recraft: 'recraft',
  meta: 'meta',
  'meta-llama': 'meta',
  microsoft: 'microsoft',
  krea: 'krea',
  alibaba: 'alibaba',
  minimax: 'minimax',
  runway: 'runway',
  kwaivgi: 'kling',
}

export const MAKER_LABEL = {
  alibaba: 'Alibaba',
  bfl: 'Black Forest Labs',
  bytedance: 'ByteDance',
  fal: 'fal',
  generic: 'Other',
  google: 'Google',
  higgsfield: 'Higgsfield',
  kling: 'Kling',
  krea: 'Krea',
  luma: 'Luma',
  meta: 'Meta',
  microsoft: 'Microsoft',
  minimax: 'MiniMax',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  prodia: 'Prodia',
  qwen: 'Qwen',
  recraft: 'Recraft',
  replicate: 'Replicate',
  runway: 'Runway',
  wavespeed: 'WaveSpeed',
  xai: 'xAI',
}

/** The mark for a provider id (a key's service), or the generic one. */
export const markForProvider = (id) => (id === 'higgsfield' || LOGOS[id] ? id : 'generic')

export function makerOf(modelId) {
  if (!modelId) return 'generic'
  const { provider, model } = parseModelId(modelId)
  if (provider !== 'openrouter') return markForProvider(provider)
  const mark = VENDOR[model.split('/')[0]]
  return mark && LOGOS[mark] ? mark : 'generic'
}

/**
 * A model's name as people say it. OpenRouter prefixes the vendor
 * ("Black Forest Labs: FLUX.3 Image") and the mark already says who made it.
 */
export function modelName(model) {
  if (!model) return ''
  const raw = model.name && model.name !== model.id ? model.name : parseModelId(model.id).model
  return raw.replace(/^[^:/]+:\s*/, '')
}
