const fs = require('fs')
const http = require('http')
const path = require('path')

const [,, action = 'inspect', outputPath = '', expression = ''] = process.argv
const host = '127.0.0.1'
const port = 9223

function getJson(route) {
  return new Promise((resolve, reject) => {
    http.get({ host, port, path: route }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (error) { reject(error) }
      })
    }).on('error', reject)
  })
}

async function run() {
  const targets = await getJson('/json/list')
  const target = targets.find((item) => item.type === 'page' && /^file:|^http/.test(item.url))
  if (!target) throw new Error('No renderer page target found')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let id = 0
  const pending = new Map()
  socket.addEventListener('message', async (event) => {
    const raw = typeof event.data === 'string'
      ? event.data
      : (typeof event.data?.text === 'function'
          ? await event.data.text()
          : Buffer.from(event.data).toString('utf8'))
    const message = JSON.parse(raw)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id
    pending.set(callId, { resolve, reject })
    socket.send(JSON.stringify({ id: callId, method, params }))
  })

  await call('Page.enable')
  await call('Runtime.enable')

  if (action === 'inspect') {
    const result = await call('Runtime.evaluate', {
      expression: `(() => ({
        title: document.title,
        url: location.href,
        text: document.body.innerText.slice(0, 12000),
        buttons: [...document.querySelectorAll('button')].map((button, index) => ({
          index,
          text: button.innerText.trim(),
          title: button.title || '',
          aria: button.getAttribute('aria-label') || '',
          disabled: button.disabled,
        })).slice(0, 300),
      }))()`,
      returnByValue: true,
    })
    process.stdout.write(`${JSON.stringify(result.result.value, null, 2)}\n`)
  } else if (action === 'evaluate') {
    const result = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    process.stdout.write(`${JSON.stringify(result.result.value, null, 2)}\n`)
  } else if (action === 'capture') {
    if (!outputPath) throw new Error('capture requires output path')
    await call('Page.bringToFront')
    await call('Runtime.evaluate', {
      expression: `(() => { document.querySelectorAll('video').forEach((video) => { try { video.pause() } catch {} }); return true })()`,
      returnByValue: true,
    })
    const metrics = await call('Page.getLayoutMetrics')
    const width = Math.max(1, Math.ceil(metrics.cssVisualViewport.clientWidth))
    const height = Math.max(1, Math.ceil(metrics.cssVisualViewport.clientHeight))
    const jpeg = /\.jpe?g$/i.test(outputPath)
    const result = await call('Page.captureScreenshot', {
      format: jpeg ? 'jpeg' : 'png',
      quality: jpeg ? 88 : undefined,
      fromSurface: false,
      captureBeyondViewport: false,
      optimizeForSpeed: true,
    })
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'))
    process.stdout.write(`${JSON.stringify({ outputPath, width, height })}\n`)
  } else {
    throw new Error(`Unknown action: ${action}`)
  }
  socket.close()
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
