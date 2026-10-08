import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleLog } from './joblog.js'

const stored = (id, at) => ({ job_id: id, kind: 'image', model: 'm/x', prompt: 'p', cost: 1, created_at: at })
const server = (id, at, status) => ({ id, status, model: 'm/x', prompt: 'p', created_at: at })

test('successes come from storage, in-flight work from the server', () => {
  const log = assembleLog([server('b', 200, 'running')], [stored('a', 100)])
  assert.deepEqual(log.map((j) => [j.id, j.status]), [['b', 'running'], ['a', 'done']])
})

test('newest first regardless of which side it came from', () => {
  const log = assembleLog([server('c', 50, 'error')], [stored('a', 300), stored('b', 100)])
  assert.deepEqual(log.map((j) => j.id), ['a', 'b', 'c'])
})

test('a job being collected right now is not listed twice', () => {
  // The server still lists it while the browser is mid-collection.
  const log = assembleLog([server('a', 100, 'done')], [stored('a', 100)])
  assert.equal(log.length, 1)
  assert.equal(log[0].status, 'done')
})

test('an empty log is empty, not a crash', () => {
  assert.deepEqual(assembleLog(), [])
  assert.deepEqual(assembleLog([], []), [])
})

test('the log is capped', () => {
  const many = Array.from({ length: 60 }, (_, i) => stored(`j${i}`, i))
  assert.equal(assembleLog([], many).length, 40)
})
