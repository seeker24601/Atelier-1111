import test from 'node:test'
import assert from 'node:assert/strict'
import { assessOutput, VERDICT } from './capabilities.js'

const png = (width, height) => ({ width, height, format: 'png' })

test('an ignored ratio that matches the reference says so', () => {
  const [finding] = assessOutput({ aspect_ratio: '9:16' }, png(864, 1152), png(768, 1024))
  assert.equal(finding.verdict, VERDICT.IGNORED)
  assert.match(finding.evidence, /reference’s own shape/)
})

test('an ignored ratio unrelated to the reference does not claim a rule', () => {
  const [finding] = assessOutput({ aspect_ratio: '9:16' }, png(1024, 1024), png(768, 1024))
  assert.equal(finding.verdict, VERDICT.IGNORED)
  assert.doesNotMatch(finding.evidence, /reference/)
})

test('an honoured ratio is never explained away by the reference', () => {
  const [finding] = assessOutput({ aspect_ratio: '3:4' }, png(768, 1024), png(768, 1024))
  assert.equal(finding.verdict, VERDICT.OK)
  assert.doesNotMatch(finding.evidence, /reference/)
})

test('no reference means no claim about one', () => {
  const [finding] = assessOutput({ aspect_ratio: '9:16' }, png(864, 1152))
  assert.doesNotMatch(finding.evidence, /reference/)
})

test('resolution is judged on area, not the longest side', () => {
  const [portrait] = assessOutput({ resolution: '1K' }, png(1024, 1536))
  assert.equal(portrait.verdict, VERDICT.OK, '1024×1536 is a 1K image, not a 2K one')
})

test('a transparent background is judged by the alpha channel; opaque cannot be disproved by one', async () => {
  const { readImageMeta } = await import('./imagemeta.js')
  // A 1×1 PNG header: IHDR colour type 6 is RGBA, 2 is RGB.
  const header = (colourType) => {
    const buf = Buffer.alloc(33)
    buf.writeUInt32BE(0x89504e47, 0)
    buf.writeUInt32BE(1, 16)
    buf.writeUInt32BE(1, 20)
    buf[25] = colourType
    return buf
  }
  assert.equal(readImageMeta(header(6)).alpha, true)
  assert.equal(readImageMeta(header(2)).alpha, false)
  assert.equal(readImageMeta(header(3)).alpha, null, 'a palette may hold transparency elsewhere')

  const judge = (value, meta) => assessOutput({ background: value }, meta)[0]
  assert.equal(judge('transparent', { ...png(1, 1), alpha: true }).verdict, VERDICT.OK)
  const opaque = judge('transparent', { width: 1, height: 1, format: 'jpeg', alpha: false })
  assert.equal(opaque.verdict, VERDICT.IGNORED)
  assert.match(opaque.evidence, /no alpha channel/)
  assert.equal(judge('opaque', { ...png(1, 1), alpha: false }).verdict, VERDICT.OK)
  assert.equal(judge('opaque', { ...png(1, 1), alpha: true }).verdict, VERDICT.UNVERIFIABLE)
  assert.equal(judge('transparent', { ...png(1, 1), alpha: null }).verdict, VERDICT.UNVERIFIABLE)
})

test('0.5K and 4K are judged like the other resolutions', () => {
  assert.equal(assessOutput({ resolution: '4K' }, png(4096, 4096))[0].verdict, VERDICT.OK)
  assert.equal(assessOutput({ resolution: '0.5K' }, png(512, 512))[0].verdict, VERDICT.OK)
  assert.equal(assessOutput({ resolution: '4K' }, png(1024, 1024))[0].verdict, VERDICT.IGNORED)
})
