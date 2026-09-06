const http = require('http')
const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const crypto = require('crypto')

const CONNECTION_SETTING_KEY = 'myComputerConnection'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8799
const DEFAULT_TIMEOUT_MS = 15000
const MAX_INLINE_RESPONSE_BYTES = 8 * 1024 * 1024
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function normalizePort(value) {
  const port = Number(value ?? DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('My Computer port must be between 1 and 65535.')
  }
  return port
}

function normalizeConnection(value = {}) {
  const host = String(value.host || DEFAULT_HOST).trim().toLowerCase()
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error('My Computer must use a loopback host.')
  }
  return {
    host: host === 'localhost' || host === '::1' ? host : DEFAULT_HOST,
    port: normalizePort(value.port),
  }
}

function safeJobId(value) {
  const jobId = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) {
    throw new Error('Invalid My Computer job id.')
  }
  return jobId
}

function safeDownloadPath(value) {
  const route = String(value || '').trim()
  if (!route.startsWith('/file?name=') && !route.startsWith('/attachment?sha256=')) {
    throw new Error('Unsupported My Computer artifact route.')
  }
  return route
}

function publicConnection(settings = {}) {
  const connection = normalizeConnection(settings)
  return {
    ...connection,
    httpBase: `http://${connection.host}:${connection.port}`,
    hasToken: Boolean(settings.encryptedToken),
  }
}

function encryptToken(safeStorage, token) {
  const normalized = String(token || '').trim()
  if (!normalized) return ''
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('OS encryption is unavailable; refusing to store My Computer token.')
  }
  return safeStorage.encryptString(normalized).toString('base64')
}

function decryptToken(safeStorage, encryptedToken) {
  const encoded = String(encryptedToken || '').trim()
  if (!encoded) return ''
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('OS encryption is unavailable; cannot read My Computer token.')
  }
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

async function readConnection(readSettingsRaw) {
  const settings = await readSettingsRaw().catch(() => ({}))
  const stored = settings?.[CONNECTION_SETTING_KEY] || {}
  return {
    ...normalizeConnection(stored),
    encryptedToken: typeof stored.encryptedToken === 'string' ? stored.encryptedToken : '',
  }
}

async function updateConnection({ readSettingsRaw, writeSettingsRaw }, patch) {
  const current = await readConnection(readSettingsRaw)
  const next = {
    ...current,
    ...patch,
  }
  const normalized = normalizeConnection(next)
  const stored = {
    host: normalized.host,
    port: normalized.port,
    encryptedToken: typeof next.encryptedToken === 'string' ? next.encryptedToken : '',
  }
  await writeSettingsRaw((settings) => ({
    ...settings,
    [CONNECTION_SETTING_KEY]: stored,
  }))
  return publicConnection(stored)
}

function requestBuffer({ connection, token, method = 'GET', route, headers = {}, body = null, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_INLINE_RESPONSE_BYTES }) {
  return new Promise((resolve, reject) => {
    const requestHeaders = { ...headers }
    if (token) requestHeaders['X-MC-Token'] = token
    if (body) requestHeaders['Content-Length'] = Buffer.byteLength(body)

    const req = http.request({
      hostname: connection.host,
      port: connection.port,
      path: route,
      method,
      headers: requestHeaders,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = []
      let total = 0
      res.on('data', (chunk) => {
        total += chunk.length
        if (total > maxBytes) {
          req.destroy(new Error(`My Computer response exceeded ${maxBytes} bytes.`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      })
    })
    req.on('timeout', () => req.destroy(new Error('My Computer request timed out.')))
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function parseJsonResponse(response, context) {
  const text = response.body.toString('utf8')
  let payload = null
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text.slice(0, 2000) }
  }
  if (response.status < 200 || response.status >= 300) {
    const error = new Error(payload?.error || `${context} returned HTTP ${response.status}.`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

async function requestJson(options) {
  const { json, ...requestOptions } = options
  let body = null
  const headers = { ...(requestOptions.headers || {}) }
  if (json !== undefined) {
    body = JSON.stringify(json)
    headers['Content-Type'] = 'application/json'
  }
  const response = await requestBuffer({ ...requestOptions, headers, body })
  return parseJsonResponse(response, requestOptions.route)
}

async function ingestFile({ connection, token, filePath, timeoutMs = 120000 }) {
  const absolutePath = path.resolve(String(filePath || ''))
  const stats = await fsp.stat(absolutePath)
  if (!stats.isFile() || stats.size <= 0) throw new Error('Attachment must be a non-empty file.')

  const filename = path.basename(absolutePath).replace(/[^A-Za-z0-9._-]+/g, '_') || 'attachment'
  const boundary = `----VelornMyComputer${crypto.randomBytes(12).toString('hex')}`
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8'
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const contentLength = prefix.length + stats.size + suffix.length

  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': contentLength,
    }
    if (token) headers['X-MC-Token'] = token
    const req = http.request({
      hostname: connection.host,
      port: connection.port,
      path: '/attachments/ingest',
      method: 'POST',
      headers,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try {
          resolve(parseJsonResponse({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }, 'attachment ingest'))
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('My Computer attachment ingest timed out.')))
    req.on('error', reject)
    req.write(prefix)
    const input = fs.createReadStream(absolutePath)
    input.on('error', reject)
    input.on('end', () => {
      req.write(suffix)
      req.end()
    })
    input.pipe(req, { end: false })
  })
}

async function downloadArtifact({ connection, token, route, destinationPath, expectedSha256 = '', timeoutMs = 10 * 60 * 1000 }) {
  const safeRoute = safeDownloadPath(route)
  const absoluteDestination = path.resolve(String(destinationPath || ''))
  if (!path.isAbsolute(absoluteDestination)) throw new Error('Artifact destination must be absolute.')
  await fsp.mkdir(path.dirname(absoluteDestination), { recursive: true })
  const tempPath = `${absoluteDestination}.part-${process.pid}-${Date.now()}`

  try {
    const result = await new Promise((resolve, reject) => {
      const headers = {}
      if (token) headers['X-MC-Token'] = token
      const req = http.request({
        hostname: connection.host,
        port: connection.port,
        path: safeRoute,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      }, (res) => {
        if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            let message = `Artifact download returned HTTP ${res.statusCode}.`
            try { message = JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error || message } catch (_) { /* ignore */ }
            reject(new Error(message))
          })
          return
        }

        const hasher = crypto.createHash('sha256')
        let bytes = 0
        const output = fs.createWriteStream(tempPath, { flags: 'wx' })
        res.on('data', (chunk) => {
          bytes += chunk.length
          hasher.update(chunk)
        })
        res.on('error', reject)
        output.on('error', reject)
        output.on('finish', () => resolve({ bytes, sha256: hasher.digest('hex') }))
        res.pipe(output)
      })
      req.on('timeout', () => req.destroy(new Error('My Computer artifact download timed out.')))
      req.on('error', reject)
      req.end()
    })

    const expected = String(expectedSha256 || '').trim().toLowerCase()
    if (expected && result.sha256 !== expected) {
      throw new Error('Downloaded artifact SHA-256 does not match the CAS receipt.')
    }
    await fsp.rename(tempPath, absoluteDestination)
    return { success: true, path: absoluteDestination, ...result }
  } catch (error) {
    await fsp.rm(tempPath, { force: true }).catch(() => {})
    throw error
  }
}

function errorResult(error) {
  return {
    success: false,
    status: Number(error?.status) || null,
    error: error?.message || String(error),
    payload: error?.payload || null,
  }
}

function registerMyComputerBridgeHandlers({ ipcMain, safeStorage, readSettingsRaw, writeSettingsRaw, getTrustedWebContents }) {
  const dependencies = { readSettingsRaw, writeSettingsRaw }

  function handle(channel, operation) {
    ipcMain.handle(channel, async (event, ...args) => {
      const trusted = typeof getTrustedWebContents === 'function' ? getTrustedWebContents() : null
      if (!trusted || event?.sender !== trusted) {
        return errorResult(new Error('Untrusted My Computer IPC sender.'))
      }
      return operation(event, ...args)
    })
  }

  async function withConnection(operation) {
    const stored = await readConnection(readSettingsRaw)
    const token = decryptToken(safeStorage, stored.encryptedToken)
    return operation(normalizeConnection(stored), token)
  }

  handle('mycomputer:getConnection', async () => {
    const stored = await readConnection(readSettingsRaw)
    return { success: true, connection: publicConnection(stored) }
  })

  handle('mycomputer:saveConnection', async (_event, value = {}) => {
    try {
      const connection = await updateConnection(dependencies, normalizeConnection(value))
      return { success: true, connection }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:setToken', async (_event, token) => {
    try {
      const encryptedToken = encryptToken(safeStorage, token)
      const connection = await updateConnection(dependencies, { encryptedToken })
      return { success: true, connection }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:clearToken', async () => {
    try {
      const connection = await updateConnection(dependencies, { encryptedToken: '' })
      return { success: true, connection }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:health', async () => {
    try {
      const payload = await withConnection((connection, token) => requestJson({ connection, token, route: '/health' }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:submit', async (_event, request) => {
    try {
      const payload = await withConnection((connection, token) => requestJson({
        connection,
        token,
        method: 'POST',
        route: '/run',
        json: request,
        timeoutMs: 30000,
      }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:status', async (_event, jobId) => {
    try {
      const id = safeJobId(jobId)
      const payload = await withConnection((connection, token) => requestJson({ connection, token, route: `/run/${encodeURIComponent(id)}` }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:gallery', async () => {
    try {
      const payload = await withConnection((connection, token) => requestJson({ connection, token, route: '/gallery' }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:ingestAsset', async (_event, value = {}) => {
    try {
      const payload = await withConnection((connection, token) => ingestFile({ connection, token, filePath: value.filePath }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })

  handle('mycomputer:downloadArtifact', async (_event, value = {}) => {
    try {
      const payload = await withConnection((connection, token) => downloadArtifact({
        connection,
        token,
        route: value.route,
        destinationPath: value.destinationPath,
        expectedSha256: value.expectedSha256,
      }))
      return { success: true, payload }
    } catch (error) {
      return errorResult(error)
    }
  })
}

module.exports = {
  CONNECTION_SETTING_KEY,
  DEFAULT_HOST,
  DEFAULT_PORT,
  decryptToken,
  downloadArtifact,
  encryptToken,
  ingestFile,
  normalizeConnection,
  parseJsonResponse,
  publicConnection,
  registerMyComputerBridgeHandlers,
  requestJson,
  safeDownloadPath,
  safeJobId,
}
