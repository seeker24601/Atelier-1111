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
