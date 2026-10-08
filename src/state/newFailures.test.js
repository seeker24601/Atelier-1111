import test from 'node:test'
import assert from 'node:assert/strict'
import { makeFailureWatch } from './newFailures.js'

const err = (id, message = 'boom') => ({ id, status: 'error', error: message })

test('failures already in the log at load are history, not news', () => {
  const watch = makeFailureWatch()
  assert.equal(watch.check([err('old-1'), err('old-2')]), null)
})

test('a failure that arrives after load is reported once', () => {
  const watch = makeFailureWatch()
  watch.check([err('old')])

  const fresh = watch.check([err('old'), err('new')])
  assert.equal(fresh?.id, 'new')
  assert.equal(watch.check([err('old'), err('new')]), null, 'not reported twice')
})

test('reset makes the next poll the new baseline', () => {
  const watch = makeFailureWatch()
  watch.check([err('a')])
  watch.reset()
  assert.equal(watch.check([err('a'), err('b')]), null, 'everything is history again')
  assert.equal(watch.check([err('a'), err('b'), err('c')])?.id, 'c')
})

test('successes are never mistaken for failures', () => {
  const watch = makeFailureWatch()
  watch.check([])
  assert.equal(watch.check([{ id: 'x', status: 'done' }]), null)
})
