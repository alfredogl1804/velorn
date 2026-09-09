const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { createComfyStudioMcpServer } = require('../electron/mcpServer')

const identityAsset = {
  id: 'asset-approved-identity',
  name: '01_seedance_dance_1.mp4',
  type: 'video',
  path: 'assets/01_seedance_dance_1.mp4',
  duration: 10.042,
  width: 1080,
  height: 1920,
}

const motionAsset = {
  id: 'asset-dynamic-climax',
  name: '02_seedance_climax_1.mp4',
  type: 'video',
  path: 'assets/02_seedance_climax_1.mp4',
  duration: 10.042,
  width: 1080,
  height: 1920,
}

function createSnapshot() {
  return {
    app: { name: 'Velorn' },
    project: {
      id: 'project-modela',
      name: 'Modela Seedance25 Maximum Master',
      path: '/tmp/modela',
      settings: { width: 1080, height: 1920, fps: 24 },
    },
    assets: [identityAsset, motionAsset],
    currentTimeline: {
      id: 'timeline-main',
      name: 'Main Timeline',
      fps: 24,
      width: 1080,
      height: 1920,
      duration: 26.583,
      playheadPosition: 18,
      selectedClipIds: [],
      tracks: [{
        id: 'video-1',
        type: 'video',
        enabled: true,
      }],
      clips: [
        {
          id: 'clip-identity',
          trackId: 'video-1',
          assetId: identityAsset.id,
          type: 'video',
          startTime: 6.458,
          duration: 10.042,
          inPoint: 0,
          outPoint: 10.042,
          enabled: true,
        },
        {
          id: 'clip-dynamic-climax',
          trackId: 'video-1',
          assetId: motionAsset.id,
          type: 'video',
          startTime: 16.542,
          duration: 10.041,
          inPoint: 0,
          outPoint: 10.041,
          enabled: true,
        },
      ],
    },
    timelines: [],
  }
}

function installTemplateCatalogMock(t) {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => [{
      title: 'Video',
      templates: [{
        name: 'video_wan_animate2',
        title: 'Wan Animate 2',
        description: 'Transfers pose and identity from reference media.',
        models: ['Wan Animate 2'],
        openSource: true,
        size: 25661244672,
        vram: 71403831296,
        io: {
          inputs: [
            { mediaType: 'image', nodeId: '451' },
            { mediaType: 'video', nodeId: '455' },
          ],
          outputs: [{ mediaType: 'video', nodeId: '486' }],
        },
      }, {
        name: 'api_seedance2_5_i2v_1080p',
        title: 'Seedance 2.5 I2V 1080p',
        description: 'Official identity-motion image-to-video template.',
        models: ['Seedance 2.5'],
        openSource: false,
        size: 1024,
        vram: 0,
        tags: ['image to video', 'identity', 'motion'],
        io: {
          inputs: [{ mediaType: 'image', nodeId: '1' }],
          outputs: [{ mediaType: 'video', nodeId: '2' }],
        },
      }],
    }],
  })
  t.after(() => { global.fetch = originalFetch })
}

function parseTextResult(result) {
  assert.equal(result?.isError, undefined, result?.content?.[0]?.text || 'Unexpected MCP error')
  return JSON.parse(result.content[0].text)
}

test('exposes benchmarked champions through the existing template catalog MCP tool', async (t) => {
  installTemplateCatalogMock(t)
  const server = createComfyStudioMcpServer()
  server.updateSnapshot(createSnapshot())
  const result = await server.callTool('list_comfyui_templates', {
    portfolioRole: 'CHAMPION',
    forceRefresh: true,
  })
  const body = parseTextResult(result)

  assert.equal(body.returnedCount, 1)
  assert.equal(body.templates[0].name, 'api_seedance2_5_i2v_1080p')
  assert.equal(body.templates[0].operational.portfolioRole, 'CHAMPION')
  assert.equal(body.templates[0].operational.modelEvidenceLevel, 'PRODUCT_PROVEN')
  assert.equal(body.templates[0].operational.routeEvidenceLevel, 'DISCOVERABLE')
  assert.equal(body.templates[0].operational.benchmark.score, 9.55)

  const searchResult = await server.callTool('list_comfyui_templates', {
    query: 'identity motion',
    forceRefresh: true,
  })
  const searchBody = parseTextResult(searchResult)
  assert.equal(searchBody.templates[0].name, 'api_seedance2_5_i2v_1080p')
})

test('previews the Wan Animate 2 champion with profile, patch, locks, cost and undo without dispatching', async (t) => {
  installTemplateCatalogMock(t)
  let dispatched = false
  const server = createComfyStudioMcpServer({
    performAction: async () => {
      dispatched = true
      return { success: true }
    },
  })
  server.updateSnapshot(createSnapshot())

  const result = await server.callTool('queue_timeline_template_generation', {
    templateName: 'video_wan_animate2',
    timeSeconds: 10,
    retakeTargetClipId: 'clip-dynamic-climax',
    retakeStartTimeSeconds: 23.2083333333,
    prompt: 'Preserve the approved identity while reproducing the source choreography and camera movement.',
    seed: 424242,
    durationSeconds: 3.375,
    fps: 24,
    resolution: { width: 480, height: 848 },
    assetFieldIds: { templateInput1: motionAsset.id },
    calibrationProfileId: 'wan-animate2-identity-motion-v1',
    calibrationControls: {
      identityFidelity: 80,
      motionAdherence: 65,
      choreographyLock: 100,
    },
    forceRefreshTemplates: true,
    previewOnly: true,
  })
  const body = parseTextResult(result)

  assert.equal(dispatched, false)
  assert.equal(body.previewOnly, true)
  assert.equal(body.plan.template.name, 'video_wan_animate2')
  assert.equal(body.plan.source.sourceClip.id, 'clip-identity')
  assert.equal(body.plan.calibrationProfile.id, 'wan-animate2-identity-motion-v1')
  assert.equal(body.plan.calibrationProfile.lifecycle, 'champion')
  assert.equal(body.plan.calibrationProfile.checkpoint.requiredBeforeApply, true)
  assert.equal(body.plan.calibrationProfile.undo.strategy, 'restore_project_checkpoint')
  assert.deepEqual(body.plan.calibrationProfile.undo.suggestedCall.arguments, {
    previewOnly: true,
    saveProject: false,
  })
  assert.equal(body.plan.calibrationProfile.estimatedCost.requiresExplicitAuthorization, true)
  assert.equal(body.plan.calibrationProfile.controls.length, 3)
  assert.deepEqual(body.plan.calibrationPatch.controls, {
    identityFidelity: 80,
    motionAdherence: 65,
    choreographyLock: 100,
  })
  assert.equal(body.plan.calibrationPatch.operations[0].inputs.reference_image_strength, 1.3)
  assert.equal(body.plan.calibrationPatch.operations[0].inputs.video_frame_offset, 160)
  assert.equal(body.plan.calibrationPatch.operations[0].inputs.pose_strength, 1.15)
  assert.equal(body.plan.calibrationProfile.retake.targetClipId, 'clip-dynamic-climax')
  assert.equal(body.plan.calibrationProfile.retake.identitySourceClipId, 'clip-identity')
  assert.equal(body.plan.sourceFrameTimeSeconds, 3.542)
  assert.equal(body.plan.calibrationProfile.retake.identitySourceFrameTimeSeconds, 3.542)
  assert.equal(body.plan.calibrationProfile.retake.timelineRange.startTimeSeconds, 23.2083333333)
  assert.equal(body.plan.calibrationReceipt.status, 'prepared')
  assert.equal(body.plan.calibrationReceipt.workflowSha256, '772a7dfce6d5b61b8f838ec0609211a0c9b1c04a7c64e26d05f0852f147edac7')
  assert.equal(body.plan.calibrationReceipt.sourceFrameTimeSeconds, 3.542)
  assert.equal(body.plan.calibrationReceipt.targetClipId, 'clip-dynamic-climax')
  assert.equal(body.plan.calibrationReceipt.retakeRange.startTimeSeconds, 23.2083333333)
  assert.equal(body.plan.calibrationPatch.operations[0].inputs.pose_end_percent, 1)
  assert.equal(body.suggestedApplyCall.arguments.previewOnly, false)
  assert.equal(body.suggestedApplyCall.arguments.calibrationProfileId, 'wan-animate2-identity-motion-v1')
  assert.equal(body.suggestedApplyCall.arguments.frameTime, 3.542)
})

function postMcp(port, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (response) => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => resolve(JSON.parse(data)))
    })
    request.on('error', reject)
    request.end(body)
  })
}

test('serves the champion preview through a live MCP HTTP endpoint on an isolated port', async (t) => {
  installTemplateCatalogMock(t)
  const server = createComfyStudioMcpServer({ port: 0 })
  server.updateSnapshot(createSnapshot())
  await server.start()
  t.after(() => server.stop())
  const port = server.server.address().port

  const response = await postMcp(port, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'queue_timeline_template_generation',
      arguments: {
        templateName: 'video_wan_animate2',
        timeSeconds: 10,
        retakeTargetClipId: 'clip-dynamic-climax',
        retakeStartTimeSeconds: 23.2083333333,
        prompt: 'Preserve identity and reproduce motion.',
        seed: 424242,
        assetFieldIds: { templateInput1: motionAsset.id },
        calibrationProfileId: 'wan-animate2-identity-motion-v1',
        calibrationControls: { identityFidelity: 80, motionAdherence: 65, choreographyLock: 100 },
        forceRefreshTemplates: true,
        previewOnly: true,
      },
    },
  })
  const body = JSON.parse(response.result.content[0].text)

  assert.equal(response.jsonrpc, '2.0')
  assert.equal(body.previewOnly, true)
  assert.equal(body.plan.calibrationProfile.id, 'wan-animate2-identity-motion-v1')
  assert.equal(body.plan.calibrationPatch.operations[0].inputs.reference_image_strength, 1.3)
})

test('dispatches the exact previewed CalibrationPatch only after previewOnly is false', async (t) => {
  installTemplateCatalogMock(t)
  let dispatchedRequest = null
  const server = createComfyStudioMcpServer({
    performAction: async (request) => {
      dispatchedRequest = request
      return { success: true, previewOnly: false, queued: 1 }
    },
  })
  server.updateSnapshot(createSnapshot())

  const result = await server.callTool('queue_timeline_template_generation', {
    templateName: 'video_wan_animate2',
    timeSeconds: 10,
    retakeTargetClipId: 'clip-dynamic-climax',
    retakeStartTimeSeconds: 23.2083333333,
    prompt: 'Preserve identity and reproduce motion.',
    seed: 424242,
    assetFieldIds: { templateInput1: motionAsset.id },
    calibrationProfileId: 'wan-animate2-identity-motion-v1',
    calibrationControls: { identityFidelity: 80, motionAdherence: 65, choreographyLock: 100 },
    forceRefreshTemplates: true,
    previewOnly: false,
  })
  parseTextResult(result)

  assert.equal(dispatchedRequest.action, 'queue_timeline_template_generation')
  assert.equal(dispatchedRequest.payload.previewOnly, false)
  assert.equal(dispatchedRequest.payload.calibrationProfile.id, 'wan-animate2-identity-motion-v1')
  assert.equal(dispatchedRequest.payload.calibrationPatch.operations[0].inputs.reference_image_strength, 1.3)
  assert.equal(dispatchedRequest.payload.calibrationReceipt.status, 'prepared')
  assert.equal(dispatchedRequest.payload.calibrationReceipt.targetClipId, 'clip-dynamic-climax')
  assert.equal(dispatchedRequest.payload.frameTime, 3.542)
  assert.deepEqual(dispatchedRequest.payload.assetFieldIds, { templateInput1: motionAsset.id })
})
