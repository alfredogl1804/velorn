const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const {
  PRODUCT_BUNDLE_ID,
  PRODUCT_DISPLAY_NAME,
  configureProductIdentity,
} = require('../electron/productIdentity.cjs')

test('configures Monstruo Studio userData before callers can read it', () => {
  const calls = []
  let userData = '/legacy/velorn'
  const app = {
    setName(name) { calls.push(['setName', name]) },
    getPath(name) {
      calls.push(['getPath', name])
      if (name === 'appData') return '/Users/test/Library/Application Support'
      if (name === 'userData') return userData
      throw new Error(`unexpected path ${name}`)
    },
    setPath(name, value) {
      calls.push(['setPath', name, value])
      if (name === 'userData') userData = value
    },
  }

  const result = configureProductIdentity(app, path)
  assert.equal(PRODUCT_DISPLAY_NAME, 'Monstruo Studio')
  assert.equal(PRODUCT_BUNDLE_ID, 'mx.hivecom.monstruostudio')
  assert.equal(result, '/Users/test/Library/Application Support/Monstruo Studio')
  assert.equal(userData, result)
  assert.deepEqual(calls, [
    ['setName', 'Monstruo Studio'],
    ['getPath', 'appData'],
    ['setPath', 'userData', result],
  ])
})

test('main configures identity before its first userData read', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'electron', 'main.js'), 'utf8')
  const configureAt = source.indexOf('configureProductIdentity(app, path)')
  const firstUserDataReadAt = source.indexOf("app.getPath('userData')")
  assert.ok(configureAt >= 0)
  assert.ok(firstUserDataReadAt > configureAt)
})
