import test from 'node:test'
import assert from 'node:assert/strict'

const calls = []
const statuses = [
  { job_id: 'job-1', status: 'running', log: ['queued'] },
  {
    job_id: 'job-1',
    status: 'done',
    result: {
      artifacts: [
        {
          kind: 'video',
          filename: 'shot.mp4',
          sha256: 'a'.repeat(64),
          url: '/file?name=shot.mp4',
          release_status: 'released',
          receipt_ref: 'receipt-1',
        },
      ],
    },
  },
]

globalThis.window = {
  electronAPI: {
    myComputer: {
      health: async () => ({
        success: true,
        payload: {
          ok: true,
          version: '1.4.0-candidate.1',
          auth_required: true,
          capabilities: [
            { id: 'wan_t2v_stable_v1', availability: 'candidate', backend: 'b200_gateway' },
          ],
        },
      }),
      submit: async (request) => {
        calls.push(request)
        return { success: true, payload: { job_id: 'job-1', status: 'running' } }
      },
      status: async () => ({ success: true, payload: statuses.shift() }),
      gallery: async () => ({ success: true, payload: { items: [{ job_id: 'job-1' }] } }),
      ingestAsset: async () => ({
        success: true,
        payload: {
          id: 'asset-1',
          sha256: 'b'.repeat(64),
          url: `/attachment?sha256=${'b'.repeat(64)}`,
          filename: 'reference.png',
        },
      }),
      downloadArtifact: async (payload) => ({ success: true, payload }),
    },
  },
  dispatchEvent() {},
}

const media = await import('./myComputerMedia.js')

test('builds the canonical T2V run envelope', () => {
  const envelope = media.buildMyComputerRunEnvelope({
    capabilityId: 'wan_t2v_stable_v1',
    parameters: {
      prompt: 'A distinctive cinematic scene',
      seed: 12345,
      width: 1280,
      height: 720,
      fps: 24,
      duration_seconds: 5,
    },
  })
  assert.equal(envelope.mano, 'execute-work-graph')
  assert.equal(envelope.args.contract, media.MY_COMPUTER_JOB_CONTRACT)
  assert.equal(envelope.args.request.contract_version, media.MY_COMPUTER_MEDIA_CONTRACT)
  assert.equal(envelope.args.request.capability_id, 'wan_t2v_stable_v1')
  assert.equal(envelope.args.request.client_context.origin, 'velorn')
})

test('requires the correct CAS asset roles for I2V, Animate and restore', () => {
  const base = {
    parameters: { prompt: 'Animate it', seed: 42 },
    inputs: [],
  }
  assert.throws(
    () => media.buildMyComputerRunEnvelope({ ...base, capabilityId: 'wan_i2v_maxquality_v1' }),
    /reference_image/
  )
  assert.throws(
    () => media.buildMyComputerRunEnvelope({ ...base, capabilityId: 'wan_animate2_v1' }),
    /reference_image.*reference_video/
  )
  assert.throws(
    () => media.buildMyComputerRunEnvelope({
      capabilityId: 'restore_upscale_2x_v1',
      parameters: { seed: 42 },
      inputs: [],
    }),
    /source_video/
  )
})

test('normalizes My Computer terminal states and extracts released MP4 artifacts', () => {
  const job = media.normalizeMyComputerJob({
    job_id: 'job-1',
    status: 'done',
    elapsed_s: 12.5,
    result: {
      artifacts: [{
        kind: 'video',
        filename: 'shot.mp4',
        sha256: 'a'.repeat(64),
        url: '/file?name=shot.mp4',
        release_status: 'released',
      }],
    },
  })
  assert.equal(job.status, 'succeeded')
  assert.equal(job.terminal, true)
  const artifacts = media.extractMyComputerArtifacts(job)
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0].kind, 'video')
  assert.equal(artifacts[0].releaseStatus, 'released')
  assert.equal(artifacts[0].sha256, 'a'.repeat(64))
})

test('derives binary capability availability from My Computer health', async () => {
  const backend = new media.MyComputerMediaBackend()
  const capabilities = await backend.capabilities()
  assert.equal(capabilities.find((item) => item.id === 'wan_t2v_stable_v1').enabled, true)
  assert.equal(capabilities.find((item) => item.id === 'wan_t2v_stable_v1').availability, 'candidate')
  assert.equal(capabilities.find((item) => item.id === 'wan_i2v_maxquality_v1').enabled, false)
  assert.equal(capabilities.find((item) => item.id === 'wan_i2v_maxquality_v1').availability, 'unavailable')
})

test('blocks unpromoted capabilities before bridge submit', async () => {
  const backend = new media.MyComputerMediaBackend()
  const before = calls.length
  await assert.rejects(
    backend.submit({
      capabilityId: 'wan_i2v_maxquality_v1',
      inputs: [{
        role: 'reference_image',
        asset_id: 'asset-1',
        sha256: 'b'.repeat(64),
        transfer_ref: `/attachment?sha256=${'b'.repeat(64)}`,
        media_type: 'image/png',
      }],
      parameters: { prompt: 'Animate it', seed: 42 },
    }),
    /not promoted/
  )
  assert.equal(calls.length, before)
})

test('submits and polls through the desktop bridge until success', async () => {
  const backend = new media.MyComputerMediaBackend()
  const submitted = await backend.submit({
    capabilityId: 'wan_t2v_stable_v1',
    parameters: {
      prompt: 'A distinctive cinematic scene',
      seed: 12345,
      width: 1280,
      height: 720,
      fps: 24,
      duration_seconds: 5,
    },
  })
  assert.equal(submitted.jobId, 'job-1')
  assert.equal(calls.length, 1)
  const terminal = await backend.waitForCompletion('job-1', {
    initialIntervalMs: 1,
    maxIntervalMs: 1,
    timeoutMs: 1000,
  })
  assert.equal(terminal.status, 'succeeded')
  const artifacts = media.extractMyComputerArtifacts(terminal)
  assert.equal(artifacts[0].filename, 'shot.mp4')
})

test('ingest and download stay behind the Electron bridge', async () => {
  const backend = new media.MyComputerMediaBackend()
  const ref = await backend.ingestAsset({ filePath: '/tmp/reference.png', role: 'reference_image' })
  assert.equal(ref.role, 'reference_image')
  assert.equal(ref.asset_id, 'asset-1')
  assert.equal(ref.sha256, 'b'.repeat(64))
  const downloaded = await backend.downloadArtifact({
    route: '/file?name=shot.mp4',
    sha256: 'a'.repeat(64),
  }, '/tmp/shot.mp4')
  assert.equal(downloaded.destinationPath, '/tmp/shot.mp4')
})
