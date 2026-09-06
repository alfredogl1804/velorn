import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import {
  checkMyComputerConnection,
  clearMyComputerToken,
  getMyComputerConnection,
  MY_COMPUTER_DEFAULT_HOST,
  MY_COMPUTER_DEFAULT_PORT,
  saveMyComputerConnection,
  setMyComputerToken,
} from '../services/localMyComputerConnection.js'
import { capabilitiesFromHealth } from '../services/myComputerMedia.js'

function statusStyles(status) {
  if (status === 'success') return 'border-green-700/40 bg-green-950/30 text-green-200'
  if (status === 'error') return 'border-red-700/40 bg-red-950/30 text-red-200'
  if (status === 'testing') return 'border-amber-700/40 bg-amber-950/30 text-amber-100'
  return 'border-sf-dark-700 bg-sf-dark-900/60 text-sf-text-muted'
}

export default function MyComputerConnectionSection() {
  const [host, setHost] = useState(MY_COMPUTER_DEFAULT_HOST)
  const [port, setPort] = useState(String(MY_COMPUTER_DEFAULT_PORT))
  const [hasToken, setHasToken] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [busy, setBusy] = useState('loading')
  const [capabilities, setCapabilities] = useState(() => capabilitiesFromHealth({}, false))
  const [status, setStatus] = useState({ kind: 'idle', message: 'Loading My Computer settings…' })

  const endpoint = useMemo(() => `http://${host || MY_COMPUTER_DEFAULT_HOST}:${port || MY_COMPUTER_DEFAULT_PORT}`, [host, port])

  const load = useCallback(async () => {
    setBusy('loading')
    try {
      const connection = await getMyComputerConnection()
      setHost(connection.host || MY_COMPUTER_DEFAULT_HOST)
      setPort(String(connection.port || MY_COMPUTER_DEFAULT_PORT))
      setHasToken(Boolean(connection.hasToken))
      setStatus({ kind: 'idle', message: `Configured for ${connection.httpBase}` })
    } catch (error) {
      setStatus({ kind: 'error', message: error?.message || 'Could not read My Computer settings.' })
    } finally {
      setBusy('')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveConnection = async () => {
    setBusy('saving')
    const response = await saveMyComputerConnection({ host, port })
    if (!response.success) {
      setStatus({ kind: 'error', message: response.error })
      setBusy('')
      return false
    }
    setHost(response.connection.host)
    setPort(String(response.connection.port))
    setHasToken(Boolean(response.connection.hasToken))
    setStatus({ kind: 'success', message: `Saved ${response.connection.httpBase}` })
    setBusy('')
    return true
  }

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      setStatus({ kind: 'error', message: 'Paste a token before saving, or use Clear token.' })
      return
    }
    setBusy('token')
    const response = await setMyComputerToken(tokenInput)
    setTokenInput('')
    if (!response.success) {
      setStatus({ kind: 'error', message: response.error })
      setBusy('')
      return
    }
    setHasToken(Boolean(response.connection.hasToken))
    setStatus({ kind: 'success', message: 'Token stored with operating-system encryption.' })
    setBusy('')
  }

  const clearToken = async () => {
    setBusy('token')
    const response = await clearMyComputerToken()
    if (!response.success) {
      setStatus({ kind: 'error', message: response.error })
      setBusy('')
      return
    }
    setTokenInput('')
    setHasToken(false)
    setStatus({ kind: 'success', message: 'My Computer token removed.' })
    setBusy('')
  }

  const testConnection = async () => {
    const saved = await saveConnection()
    if (!saved) return
    setBusy('testing')
    setStatus({ kind: 'testing', message: `Testing ${endpoint}…` })
    const response = await checkMyComputerConnection()
    if (response.ok) {
      const version = response.payload?.version || response.payload?.service || 'healthy'
      const reported = capabilitiesFromHealth(response.payload || {}, true)
      const enabledCount = reported.filter((capability) => capability.enabled).length
      setCapabilities(reported)
      setStatus({
        kind: hasToken ? 'success' : 'testing',
        message: `My Computer reachable (${version}); ${enabledCount}/${reported.length} media capabilities enabled${hasToken ? '.' : '. Save the required token before submitting jobs.'}`,
      })
    } else {
      setCapabilities(capabilitiesFromHealth({}, false))
      setStatus({ kind: 'error', message: response.error || 'My Computer did not respond.' })
    }
    setBusy('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-md bg-sf-dark-800 p-2 text-sf-accent">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-sf-text-primary">Sovereign media control plane</div>
            <p className="mt-1 text-[11px] text-sf-text-muted">
              Velorn sends media jobs to My Computer. My Computer owns provider routing, CAS, receipts, C01 and release/quarantine. Pod and provider credentials never enter the renderer.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-sf-text-muted">Loopback host</span>
          <input
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder={MY_COMPUTER_DEFAULT_HOST}
            className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary focus:border-sf-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-sf-text-muted">Port</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => setPort(event.target.value)}
            className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary focus:border-sf-accent focus:outline-none"
          />
        </label>
      </div>
      <p className="text-[10px] text-sf-text-muted">
        Remote hosts are rejected by design. Use a local My Computer gateway or an authenticated local tunnel.
      </p>

      <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-3">
        <div className="flex items-start gap-2.5">
          <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-sf-accent" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-sf-text-primary">Required My Computer token</div>
                <div className="mt-0.5 text-[11px] text-sf-text-muted">
                  Stored with operating-system encryption and never exposed back to the renderer.
                </div>
              </div>
              {hasToken && (
                <span className="inline-flex items-center gap-1 text-[11px] text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder={hasToken ? 'Stored — paste only to replace' : 'Paste the local My Computer token'}
                autoComplete="off"
                className="min-w-0 flex-1 rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-sm text-sf-text-primary focus:border-sf-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => { void saveToken() }}
                disabled={busy === 'token'}
                className="rounded bg-sf-accent px-3 py-2 text-xs font-medium text-white hover:bg-sf-accent/90 disabled:opacity-50"
              >
                Save token
              </button>
              {hasToken && (
                <button
                  type="button"
                  onClick={() => { void clearToken() }}
                  disabled={busy === 'token'}
                  className="rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50"
                  title="Clear token"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-3 ${statusStyles(status.kind)}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs">{status.message}</span>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => { void saveConnection() }}
              disabled={Boolean(busy)}
              className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { void testConnection() }}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 rounded bg-sf-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-sf-accent/90 disabled:opacity-50"
            >
              {busy === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Test
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-sf-text-primary">Canonical B200 capabilities</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {capabilities.map((capability) => (
            <div key={capability.id} className="rounded border border-sf-dark-700 bg-sf-dark-900/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-sf-text-primary">{capability.label}</div>
                <span className={`text-[10px] ${capability.enabled ? 'text-green-400' : 'text-sf-text-muted'}`}>
                  {capability.availability}
                </span>
              </div>
              <code className="mt-1 block truncate text-[10px] text-sf-text-muted">{capability.id}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
