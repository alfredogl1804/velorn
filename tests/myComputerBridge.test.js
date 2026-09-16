const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs/promises')
const crypto = require('node:crypto')

const {
  decryptToken,
  downloadArtifact,
  encryptToken,
  normalizeConnection,
  registerMyComputerBridgeHandlers,
  requestJson,
  safeDownloadPath,
  safeJobId,
} = require('../electron/myComputerBridge')

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function fakeSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`cipher:${value}`, 'utf8'),
    decryptString: (buffer) => buffer.toString('utf8').replace(/^cipher:/, ''),
  }
}

function fakeIpcMain() {
  const handlers = new Map()
  return {
    handlers,
    handle(name, callback) {
      if (handlers.has(name)) throw new Error(`duplicate handler ${name}`)
      handlers.set(name, callback)
    },
  }
}

test('My Computer connection accepts only loopback hosts', () => {
  assert.deepEqual(normalizeConnection({ host: '127.0.0.1', port: 8799 }), { host: '127.0.0.1', port: 8799 })
  assert.deepEqual(normalizeConnection({ host: 'localhost', port: '8799' }), { host: 'localhost', port: 8799 })
  assert.throws(() => normalizeConnection({ host: 'example.com', port: 8799 }), /loopback/)
  assert.throws(() => normalizeConnection({ host: '127.0.0.1', port: 70000 }), /between 1 and 65535/)
})

test('artifact and job routes reject arbitrary input', () => {
  assert.equal(safeJobId('abc-123_DEF'), 'abc-123_DEF')
  assert.throws(() => safeJobId('../etc/passwd'), /Invalid/)
  assert.equal(safeDownloadPath('/file?name=video.mp4'), '/file?name=video.mp4')
  assert.equal(safeDownloadPath('/attachment?sha256=abc'), '/attachment?sha256=abc')
  assert.throws(() => safeDownloadPath('https://example.com/video.mp4'), /Unsupported/)
})

test('token encryption has no plaintext fallback', () => {
  const storage = fakeSafeStorage()
  const encrypted = encryptToken(storage, 'unit-test-token')
  assert.notEqual(encrypted, 'unit-test-token')
  assert.equal(decryptToken(storage, encrypted), 'unit-test-token')
  assert.throws(() => encryptToken({ isEncryptionAvailable: () => false }, 'secret'), /refusing/)
})

test('requestJson and downloadArtifact use loopback API and verify SHA-256', async (t) => {
  const media = Buffer.from('synthetic-mp4-fixture')
  const digest = crypto.createHash('sha256').update(media).digest('hex')
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, version: 'test' }))
      return
    }
    if (req.url === '/file?name=fixture.mp4') {
      res.writeHead(200, { 'content-type': 'video/mp4' })
      res.end(media)
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  const port = await listen(server)
  t.after(() => close(server))

  const connection = { host: '127.0.0.1', port }
  const health = await requestJson({ connection, route: '/health' })
  assert.equal(health.ok, true)

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'velorn-mycomputer-'))
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }))
  const destinationPath = path.join(tmpDir, 'fixture.mp4')
  const result = await downloadArtifact({
    connection,
    route: '/file?name=fixture.mp4',
    destinationPath,
    expectedSha256: digest,
  })
  assert.equal(result.sha256, digest)
  assert.deepEqual(await fs.readFile(destinationPath), media)

  await assert.rejects(
    downloadArtifact({
      connection,
      route: '/file?name=fixture.mp4',
      destinationPath: path.join(tmpDir, 'wrong.mp4'),
      expectedSha256: '0'.repeat(64),
    }),
    /does not match/
  )
})

test('registered IPC handlers keep the token in main and attach it to submit', async (t) => {
  let observedToken = null
  let observedBody = null
  const server = http.createServer((req, res) => {
    if (req.url === '/run' && req.method === 'POST') {
      observedToken = req.headers['x-mc-token'] || null
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        observedBody = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        res.writeHead(202, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ job_id: 'job-test-1', status: 'running' }))
      })
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  const port = await listen(server)
  t.after(() => close(server))

  let settings = {}
  const readSettingsRaw = async () => settings
  const writeSettingsRaw = async (mutator) => {
    settings = mutator(settings)
    return settings
  }
  const ipcMain = fakeIpcMain()
  const trustedSender = {}
  const trustedEvent = { sender: trustedSender }
  registerMyComputerBridgeHandlers({
    ipcMain,
    safeStorage: fakeSafeStorage(),
    readSettingsRaw,
    writeSettingsRaw,
    getTrustedWebContents: () => trustedSender,
  })

  const rejected = await ipcMain.handlers.get('mycomputer:getConnection')({ sender: {} })
  assert.equal(rejected.success, false)
  assert.match(rejected.error, /Untrusted/)

  const save = await ipcMain.handlers.get('mycomputer:saveConnection')(trustedEvent, { host: '127.0.0.1', port })
  assert.equal(save.success, true)
  const tokenResult = await ipcMain.handlers.get('mycomputer:setToken')(trustedEvent, 'unit-test-token')
  assert.equal(tokenResult.success, true)
  assert.equal(tokenResult.connection.hasToken, true)
  assert.equal(JSON.stringify(tokenResult).includes('unit-test-token'), false)

  const body = { mano: 'execute-work-graph', args: { contract: 'test' } }
  const submit = await ipcMain.handlers.get('mycomputer:submit')(trustedEvent, body)
  assert.equal(submit.success, true)
  assert.equal(submit.payload.job_id, 'job-test-1')
  assert.equal(observedToken, 'unit-test-token')
  assert.deepEqual(observedBody, body)
})
