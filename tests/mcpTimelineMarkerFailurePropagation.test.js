const test = require('node:test')
const assert = require('node:assert/strict')

const { createComfyStudioMcpServer } = require('../electron/mcpServer')

function snapshot() {
  return {
    app: { name: 'Velorn' },
    project: { id: 'project-1', name: 'Project 1', path: '/tmp/project-1' },
    assets: [],
    timelines: [],
    currentTimeline: {
      id: 'timeline-1',
      name: 'Timeline 1',
      fps: 24,
      duration: 10,
      playheadPosition: 1,
      tracks: [],
      clips: [],
      markers: [{ id: 'marker-1', time: 1, label: 'Original', color: '#f5c451' }],
    },
  }
}

for (const testCase of [
  {
    tool: 'add_timeline_markers',
    args: { timeSeconds: 2, label: 'New' },
    action: 'add_timeline_markers',
  },
  {
    tool: 'remove_timeline_markers',
    args: { markerIds: ['marker-1'] },
    action: 'remove_timeline_markers',
  },
  {
    tool: 'set_timeline_marker_properties',
    args: { markerIds: ['marker-1'], label: 'Updated' },
    action: 'set_timeline_marker_properties',
  },
]) {
  test(`${testCase.tool} propagates a renderer rejection as an MCP error`, async () => {
    const calls = []
    const server = createComfyStudioMcpServer({
      performAction: async (request) => {
        calls.push(request)
        return { success: false, error: `renderer rejected ${request.action}` }
      },
    })
    server.updateSnapshot(snapshot())

    const result = await server.callTool(testCase.tool, testCase.args)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].action, testCase.action)
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, new RegExp(`renderer rejected ${testCase.action}`))
  })

  test(`${testCase.tool} preserves a successful renderer response`, async () => {
    const calls = []
    const server = createComfyStudioMcpServer({
      performAction: async (request) => {
        calls.push(request)
        return { success: true, receipt: `renderer accepted ${request.action}` }
      },
    })
    server.updateSnapshot(snapshot())

    const result = await server.callTool(testCase.tool, testCase.args)
    const body = JSON.parse(result.content[0].text)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].action, testCase.action)
    assert.equal(result.isError, undefined)
    assert.equal(body.success, true)
    assert.equal(body.action, testCase.action)
    assert.equal(body.result.success, true)
    assert.equal(body.result.receipt, `renderer accepted ${testCase.action}`)
  })
}
