import test from 'node:test'
import assert from 'node:assert/strict'
import { hostname, allowedHost, allowedOrigin } from './localonly.js'

test('host headers are reduced to the name, ports and brackets handled', () => {
  assert.equal(hostname('127.0.0.1:5180'), '127.0.0.1')
  assert.equal(hostname('LOCALHOST:8788'), 'localhost')
  assert.equal(hostname('[::1]:5180'), '[::1]')
  assert.equal(hostname(undefined), '')
})

test('only loopback names are served', () => {
  assert.ok(allowedHost('127.0.0.1'))
  assert.ok(allowedHost('localhost'))
  assert.ok(allowedHost('[::1]'))
  assert.ok(!allowedHost('evil.example'), 'a rebound domain keeps its own name in Host')
  assert.ok(!allowedHost('192.168.1.20'))
  assert.ok(!allowedHost(''))
})

test('a browser request is accepted only from a loopback page', () => {
  assert.ok(allowedOrigin(undefined), 'same-origin GETs carry no Origin')
  assert.ok(allowedOrigin('http://127.0.0.1:5180'))
  assert.ok(allowedOrigin('http://localhost:5180'))
  assert.ok(allowedOrigin('http://[::1]:5180'))
  assert.ok(!allowedOrigin('https://some-site.example'), 'another site cannot spend the key')
  assert.ok(!allowedOrigin('null'), 'sandboxed frames and file:// pages are refused')
  assert.ok(!allowedOrigin('not a url'))
})
