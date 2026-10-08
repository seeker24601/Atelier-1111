import test from 'node:test'
import assert from 'node:assert/strict'
import { recordFor } from './paramrecord.js'

const row = (model, param, verdict) => ({ model, param, value: 'x', verdict })
const MODELS = ['a', 'b', 'c']

test('counts only the parameter and only the catalogue in view', () => {
  const rows = [row('a', 'resolution', 'ok'), row('z', 'resolution', 'ignored'), row('a', 'duration', 'ok')]
  const stat = recordFor(rows, MODELS, 'resolution')
  assert.equal(stat.attempts, 1, 'the model outside the catalogue is not counted')
  assert.equal(stat.ok, 1)
})

test('never-honoured needs enough evidence to mean anything', () => {
  const two = [row('a', 'resolution', 'ignored'), row('b', 'resolution', 'rejected')]
  assert.equal(recordFor(two, MODELS, 'resolution').neverHonoured, false, 'two is not a record')

  const three = [...two, row('c', 'resolution', 'ignored')]
  assert.equal(recordFor(three, MODELS, 'resolution').neverHonoured, true)
})

test('a single success clears it, however many failures there are', () => {
  const rows = [
    row('a', 'resolution', 'ignored'),
    row('b', 'resolution', 'rejected'),
    row('c', 'resolution', 'ignored'),
    row('a', 'resolution', 'ok'),
  ]
  assert.equal(recordFor(rows, MODELS, 'resolution').neverHonoured, false)
})

test('an untried parameter claims nothing', () => {
  const stat = recordFor([], MODELS, 'resolution')
  assert.equal(stat.attempts, 0)
  assert.equal(stat.neverHonoured, false)
})
