export const MY_COMPUTER_DEFAULT_HOST = '127.0.0.1'
export const MY_COMPUTER_DEFAULT_PORT = 8799
export const MY_COMPUTER_CONNECTION_CHANGED_EVENT = 'velorn-mycomputer-connection-changed'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function normalizePort(value) {
  const port = Number(value ?? MY_COMPUTER_DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return port
}

export function normalizeMyComputerConnection(value = {}) {
  const host = String(value.host || MY_COMPUTER_DEFAULT_HOST).trim().toLowerCase()
  const port = normalizePort(value.port)
  if (!LOOPBACK_HOSTS.has(host)) {
    return { success: false, error: 'My Computer must use localhost/127.0.0.1.' }
  }
  if (!port) {
    return { success: false, error: 'Port must be between 1 and 65535.' }
  }
  return {
    success: true,
    connection: {
      host,
      port,
      httpBase: `http://${host}:${port}`,
    },
  }
}

function bridge() {
  const api = typeof window !== 'undefined' ? window?.electronAPI?.myComputer : null
  if (!api) {
    throw new Error('My Computer requires the Velorn desktop application.')
  }
  return api
}

function emitConnectionChanged(connection) {
  try {
    window.dispatchEvent(new CustomEvent(MY_COMPUTER_CONNECTION_CHANGED_EVENT, { detail: connection }))
  } catch (_) {
    // Non-fatal in headless tests.
  }
}

export async function getMyComputerConnection() {
  const response = await bridge().getConnection()
  if (!response?.success) throw new Error(response?.error || 'Could not read My Computer connection.')
  return response.connection
}

export async function saveMyComputerConnection(value = {}) {
  const normalized = normalizeMyComputerConnection(value)
  if (!normalized.success) return normalized
  const response = await bridge().saveConnection(normalized.connection)
  if (!response?.success) return { success: false, error: response?.error || 'Could not save My Computer connection.' }
  emitConnectionChanged(response.connection)
  return response
}

export async function setMyComputerToken(token) {
  const response = await bridge().setToken(String(token || ''))
  if (!response?.success) return { success: false, error: response?.error || 'Could not store My Computer token.' }
  emitConnectionChanged(response.connection)
  return response
}

export async function clearMyComputerToken() {
  const response = await bridge().clearToken()
  if (!response?.success) return { success: false, error: response?.error || 'Could not clear My Computer token.' }
  emitConnectionChanged(response.connection)
  return response
}

export async function checkMyComputerConnection() {
  try {
    const response = await bridge().health()
    if (!response?.success) {
      return { ok: false, status: response?.status || null, error: response?.error || 'My Computer is unavailable.' }
    }
    return { ok: true, payload: response.payload }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}
