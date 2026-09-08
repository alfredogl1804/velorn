import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WORKFLOW_EVIDENCE_LEVELS,
  enrichWorkflowWithOperationalMetadata,
  getWorkflowOperationalMetadata,
  mergeWorkflowRuntimeReadiness,
} from './workflowPortfolio.js'

test('keeps exact product proof narrower than provider-family evidence', () => {
  const seedance = getWorkflowOperationalMetadata({
    id: 'seedance2-r2v',
    workflowId: 'seedance2-r2v',
    route: 'cloud',
    category: 'image-to-video',
    provider: 'ByteDance',
    runnable: true,
  })
  const wan = getWorkflowOperationalMetadata({
    id: 'wan22-i2v',
    workflowId: 'wan22-i2v',
    route: 'local',
    category: 'image-to-video',
    provider: 'Local',
    runnable: true,
  })

  assert.equal(seedance.evidenceLevel, WORKFLOW_EVIDENCE_LEVELS.TECHNICALLY_VALIDATED)
  assert.match(seedance.evidenceLabel, /exact 2\.0 workflow still needs product proof/i)
  assert.match(seedance.limitation, /another Seedance version\/provider route/i)
  assert.equal(wan.evidenceLevel, WORKFLOW_EVIDENCE_LEVELS.PRODUCT_PROVEN)
})

test('derives operational metadata without duplicating workflow bindings', () => {
  const source = {
    id: 'custom-candidate',
    workflowId: 'custom-candidate',
    route: 'custom',
    category: 'video',
    provider: 'Velorn',
    fields: [{ id: 'prompt' }],
    runnable: true,
  }
  const enriched = enrichWorkflowWithOperationalMetadata(source)

  assert.notEqual(enriched, source)
  assert.deepEqual(enriched.fields, source.fields)
  assert.equal(source.operational, undefined)
  assert.equal(enriched.operational.sovereignty, 'Self-hosted')
  assert.equal(enriched.operational.capabilityLane, 'Video')
})

test('runtime readiness changes availability without promoting evidence', () => {
  const workflow = {
    id: 'ltx23-i2v',
    workflowId: 'ltx23-i2v',
    route: 'local',
    category: 'image-to-video',
    provider: 'Local',
    runnable: true,
  }
  const ready = mergeWorkflowRuntimeReadiness(workflow, {
    workflowId: 'ltx23-i2v',
    status: 'ready',
  })
  const missing = mergeWorkflowRuntimeReadiness(workflow, {
    workflowId: 'ltx23-i2v',
    status: 'missing',
  })

  assert.equal(ready.operational.availability, 'Ready on connected runtime')
  assert.equal(missing.operational.availability, 'Blocked by missing dependencies')
  assert.equal(ready.operational.evidenceLevel, WORKFLOW_EVIDENCE_LEVELS.INSTALLED)
  assert.equal(missing.operational.evidenceLevel, WORKFLOW_EVIDENCE_LEVELS.INSTALLED)
})
