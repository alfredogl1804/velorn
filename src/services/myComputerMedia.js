import { checkMyComputerConnection } from './localMyComputerConnection.js'

export const MY_COMPUTER_MEDIA_CONTRACT = 'el-monstruo.media-worker/v2'
export const MY_COMPUTER_JOB_CONTRACT = 'el-monstruo.media_job/v2'

export const MY_COMPUTER_CAPABILITIES = Object.freeze([
  {
    id: 'wan_t2v_stable_v1',
    label: 'Text to cinematic video',
    kind: 'video',
    requiredAssetRoles: [],
  },
  {
    id: 'wan_i2v_maxquality_v1',
    label: 'Animate an image',
    kind: 'video',
    requiredAssetRoles: ['reference_image'],
  },
  {
    id: 'wan_animate2_v1',
    label: 'Transfer performance',
    kind: 'video',
    requiredAssetRoles: ['reference_image', 'reference_video'],
  },
  {
    id: 'restore_upscale_2x_v1',
    label: 'Restore and upscale 2×',
    kind: 'video',
    requiredAssetRoles: ['source_video'],
  },
])

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled', 'timed_out'])
const ENABLED_AVAILABILITY = new Set(['candidate', 'stable'])
const CAPABILITY_BY_ID = new Map(MY_COMPUTER_CAPABILITIES.map((item) => [item.id, item]))

export function capabilitiesFromHealth(payload = {}, backendReachable = true) {
  const reported = new Map(
    (Array.isArray(payload?.capabilities) ? payload.capabilities : [])
      .filter((item) => item && typeof item === 'object' && item.id)
      .map((item) => [String(item.id), item])
  )
  return MY_COMPUTER_CAPABILITIES.map((capability) => {
    const server = reported.get(capability.id)
    const availability = backendReachable
      ? String(server?.availability || 'unavailable').toLowerCase()
      : 'unavailable'
    return {
      ...capability,
      backendReachable,
      availability,
      backend: String(server?.backend || ''),
      enabled: backendReachable && ENABLED_AVAILABILITY.has(availability),
    }
  })
}

function bridge() {
  const api = typeof window !== 'undefined' ? window?.electronAPI?.myComputer : null
  if (!api) throw new Error('My Computer requires the Velorn desktop application.')
  return api
}

function opaqueId(prefix = 'req') {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}-${random}`
}

function asFiniteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeSha256(value) {
  const digest = String(value || '').trim().toLowerCase()
  return /^[a-f0-9]{64}$/.test(digest) ? digest : ''
}

function normalizeAssetRef(asset = {}) {
  return {
    role: String(asset.role || '').trim(),
    asset_id: String(asset.asset_id || asset.assetId || asset.id || '').trim(),
    sha256: normalizeSha256(asset.sha256 || asset.casSha256),
    transfer_ref: String(asset.transfer_ref || asset.transferRef || asset.url || '').trim(),
    media_type: String(asset.media_type || asset.mediaType || asset.type || '').trim() || 'application/octet-stream',
    original_name: String(asset.original_name || asset.originalName || asset.name || '').trim(),
  }
}

export function validateMyComputerMediaRequest(request = {}) {
  const capability = CAPABILITY_BY_ID.get(String(request.capability_id || ''))
  const errors = []
  if (!capability) errors.push('Unsupported capability_id.')

  const inputs = Array.isArray(request.inputs) ? request.inputs.map(normalizeAssetRef) : []
  const roles = new Set(inputs.map((asset) => asset.role).filter(Boolean))
  for (const role of capability?.requiredAssetRoles || []) {
    if (!roles.has(role)) errors.push(`Missing required asset role: ${role}.`)
  }
  for (const asset of inputs) {
    if (!asset.role) errors.push('Every input asset requires a role.')
    if (!asset.asset_id) errors.push(`Input ${asset.role || 'asset'} requires an asset_id.`)
    if (!asset.sha256) errors.push(`Input ${asset.role || 'asset'} requires a valid SHA-256.`)
    if (!asset.transfer_ref) errors.push(`Input ${asset.role || 'asset'} requires a transfer_ref.`)
  }

  const parameters = request.parameters && typeof request.parameters === 'object'
    ? { ...request.parameters }
    : {}
  if (capability?.id !== 'restore_upscale_2x_v1' && !String(parameters.prompt || '').trim()) {
    errors.push('A prompt is required for this capability.')
  }
  if (parameters.seed === undefined || !Number.isInteger(Number(parameters.seed))) {
    errors.push('An integer seed is required.')
  }

  return {
    ok: errors.length === 0,
    errors,
    capability,
    inputs,
    parameters,
  }
}

export function buildMyComputerRunEnvelope(options = {}) {
  const request = {
    contract_version: MY_COMPUTER_MEDIA_CONTRACT,
    request_id: String(options.requestId || opaqueId('req')),
    capability_id: String(options.capabilityId || ''),
    idempotency_key: String(options.idempotencyKey || opaqueId('idem')),
    policy_route: String(options.policyRoute || 'general_multimedia'),
    inputs: Array.isArray(options.inputs) ? options.inputs.map(normalizeAssetRef) : [],
    parameters: {
      ...(options.parameters || {}),
      seed: Number(options?.parameters?.seed),
    },
    callback: { mode: 'poll' },
    client_context: {
      origin: 'velorn',
      human_review_required: Boolean(options.humanReviewRequired),
      project_id: options.projectId ? String(options.projectId) : undefined,
    },
  }
  if (!request.client_context.project_id) delete request.client_context.project_id

  const validation = validateMyComputerMediaRequest(request)
  if (!validation.ok) throw new Error(validation.errors.join(' '))

  return {
    mano: 'execute-work-graph',
    args: {
      contract: MY_COMPUTER_JOB_CONTRACT,
      source: 'velorn',
      request,
    },
  }
}

export function normalizeMyComputerJob(payload = {}) {
  const rawStatus = String(payload.status || '').toLowerCase()
  const status = rawStatus === 'done'
    ? 'succeeded'
    : rawStatus === 'error'
      ? 'failed'
      : rawStatus === 'timeout'
        ? 'timed_out'
        : rawStatus === 'cancelled'
          ? 'cancelled'
          : rawStatus === 'queued'
            ? 'queued'
            : 'running'
  return {
    id: String(payload.job_id || payload.id || ''),
    status,
    terminal: TERMINAL_STATES.has(status),
    result: payload.result || null,
    error: payload.error || null,
    elapsedSeconds: asFiniteNumber(payload.elapsed_s),
    logs: Array.isArray(payload.log) ? payload.log : [],
    raw: payload,
  }
}

function visitObjects(value, callback, visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return
  visited.add(value)
  callback(value)
  if (Array.isArray(value)) {
    value.forEach((item) => visitObjects(item, callback, visited))
    return
  }
  Object.values(value).forEach((item) => visitObjects(item, callback, visited))
}

function inferArtifactKind(value = {}) {
  const explicit = String(value.kind || value.media_type || value.mediaType || value.type || '').toLowerCase()
  const filename = String(value.filename || value.name || value.path || '').toLowerCase()
  if (explicit.includes('video') || /\.(mp4|mov|webm|mkv|avi)$/.test(filename)) return 'video'
  if (explicit.includes('audio') || /\.(wav|mp3|m4a|aac|flac|ogg)$/.test(filename)) return 'audio'
  if (explicit.includes('image') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/.test(filename)) return 'image'
  return null
}

export function extractMyComputerArtifacts(jobOrResult = {}) {
  const root = jobOrResult?.result || jobOrResult
  const candidates = []
  const seen = new Set()
  visitObjects(root, (value) => {
    const kind = inferArtifactKind(value)
    if (!kind) return
    const filename = String(value.filename || value.name || '').trim()
    const route = String(value.download_route || value.downloadRoute || value.url || '').trim()
      || (filename ? `/file?name=${encodeURIComponent(filename)}` : '')
    const sha256 = normalizeSha256(value.sha256 || value.cas_sha256 || value.casSha256)
    const key = `${sha256}|${route}|${filename}`
    if (!route || seen.has(key)) return
    seen.add(key)
    candidates.push({
      kind,
      filename: filename || `mycomputer-${kind}-${candidates.length + 1}`,
      route,
      sha256,
      receiptRef: String(value.receipt_ref || value.receiptRef || '').trim(),
      releaseStatus: String(value.release_status || value.releaseStatus || root?.release_status || '').trim() || 'unknown',
      c01Required: value.c01_required ?? value.c01Required ?? root?.c01_required ?? null,
      c01Passed: value.c01_passed ?? value.c01Passed ?? root?.c01_passed ?? null,
      provider: String(value.provider || root?.provider || '').trim(),
      workflowId: String(value.workflow_id || value.workflowId || root?.workflow_id || '').trim(),
      workflowSha256: normalizeSha256(value.workflow_sha256 || value.workflowSha256),
      imageDigest: String(value.image_digest || value.imageDigest || '').trim(),
      raw: value,
    })
  })
  return candidates
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class MyComputerMediaBackend {
  async health() {
    return checkMyComputerConnection()
  }

  async capabilities() {
    const health = await this.health()
    return capabilitiesFromHealth(health.payload || {}, health.ok)
  }

  async ingestAsset({ filePath, role }) {
    if (!String(filePath || '').trim()) throw new Error('A local asset path is required.')
    if (!String(role || '').trim()) throw new Error('An input role is required.')
    const response = await bridge().ingestAsset({ filePath })
    if (!response?.success) throw new Error(response?.error || 'My Computer asset ingest failed.')
    const payload = response.payload || {}
    return normalizeAssetRef({
      ...payload,
      role,
      asset_id: payload.id || payload.asset_id || payload.sha256,
      transfer_ref: payload.url,
      original_name: payload.original_name || payload.filename,
    })
  }

  async submit(options = {}) {
    const envelope = options?.mano ? options : buildMyComputerRunEnvelope(options)
    const capabilityId = String(envelope?.args?.request?.capability_id || '')
    const capabilities = await this.capabilities()
    const selected = capabilities.find((capability) => capability.id === capabilityId)
    if (!selected?.enabled) {
      throw new Error(`${capabilityId || 'This capability'} is not promoted by My Computer.`)
    }
    const response = await bridge().submit(envelope)
    if (!response?.success) throw new Error(response?.error || 'My Computer job submit failed.')
    const payload = response.payload || {}
    const jobId = String(payload.job_id || '').trim()
    if (!jobId) throw new Error('My Computer did not return a job_id.')
    return { jobId, payload }
  }

  async status(jobId) {
    const response = await bridge().status(jobId)
    if (!response?.success) throw new Error(response?.error || 'My Computer status request failed.')
    return normalizeMyComputerJob(response.payload || {})
  }

  async *stream(jobId, options = {}) {
    const initialMs = Math.max(250, Number(options.initialIntervalMs) || 1500)
    const maxMs = Math.max(initialMs, Number(options.maxIntervalMs) || 5000)
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 60 * 60 * 1000)
    const startedAt = Date.now()
    let intervalMs = initialMs
    let previousSignature = ''

    while (Date.now() - startedAt < timeoutMs) {
      const job = await this.status(jobId)
      const signature = JSON.stringify([job.status, job.logs.length, job.error, Boolean(job.result)])
      if (signature !== previousSignature) {
        previousSignature = signature
        yield job
      }
      if (job.terminal) return
      await sleep(intervalMs)
      intervalMs = Math.min(maxMs, Math.round(intervalMs * 1.25))
    }
    throw new Error('Timed out waiting for My Computer job completion.')
  }

  async waitForCompletion(jobId, options = {}) {
    let latest = null
    for await (const job of this.stream(jobId, options)) {
      latest = job
      options.onProgress?.(job)
    }
    if (!latest) latest = await this.status(jobId)
    if (latest.status !== 'succeeded') {
      throw new Error(latest.error || `My Computer job ended as ${latest.status}.`)
    }
    return latest
  }

  async cancel() {
    throw new Error('Cancellation is not exposed by the current My Computer server; no cancel request was sent.')
  }

  async reconcileGallery() {
    const response = await bridge().gallery()
    if (!response?.success) throw new Error(response?.error || 'My Computer gallery request failed.')
    return Array.isArray(response?.payload?.items) ? response.payload.items : []
  }

  async downloadArtifact(artifact, destinationPath) {
    if (!artifact?.route) throw new Error('Artifact download route is missing.')
    const response = await bridge().downloadArtifact({
      route: artifact.route,
      destinationPath,
      expectedSha256: artifact.sha256 || '',
    })
    if (!response?.success) throw new Error(response?.error || 'My Computer artifact download failed.')
    return response.payload
  }
}

export const myComputerMedia = new MyComputerMediaBackend()
