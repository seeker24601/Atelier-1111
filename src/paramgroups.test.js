import test from 'node:test'
import assert from 'node:assert/strict'
import { groupOptions, ROW, ratioGroup } from './groups.js'

// FLUX 3's published ratios, the row that ran off the panel.
const flux3 = ['1:2', '9:16', '2:3', '5:7', '3:4', '4:5', '1:1', '5:4', '4:3', '7:5', '3:2', '16:9', '2:1', '21:9']

test('a long ratio row splits into portrait, square and landscape, each short enough for a row', () => {
  assert.ok(flux3.length > ROW)
  const groups = groupOptions(flux3, ratioGroup)
  assert.deepEqual(groups.map((g) => [g.label, g.options.length]), [['Portrait', 6], ['Square', 1], ['Landscape', 7]])
  assert.deepEqual(groups[0].options, ['1:2', '9:16', '2:3', '5:7', '3:4', '4:5'], 'order kept, tallest first')
  assert.ok(groups.every((g) => g.options.length <= ROW))
})

test('decimal ratios such as 19.5:9 group by shape too', () => {
  assert.equal(ratioGroup('19.5:9').key, 'landscape')
  assert.equal(ratioGroup('9:19.5').key, 'portrait')
  assert.equal(ratioGroup('1:1').key, 'square')
})
