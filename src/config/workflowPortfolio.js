import workflowPortfolioData from '../../electron/workflowPortfolioData.cjs'

export const WORKFLOW_EVIDENCE_LEVELS = Object.freeze({
  DISCOVERABLE: 'DISCOVERABLE',
  INSTALLED: 'INSTALLED',
  EXECUTABLE: 'EXECUTABLE',
  TECHNICALLY_VALIDATED: 'TECHNICALLY_VALIDATED',
  PRODUCT_PROVEN: 'PRODUCT_PROVEN',
})

export const WORKFLOW_PORTFOLIO_ROLES = Object.freeze({
  CHAMPION: 'CHAMPION',
  SPECIALIST_CHAMPION: 'SPECIALIST_CHAMPION',
  SOVEREIGN_ALTERNATIVE: 'SOVEREIGN_ALTERNATIVE',
  ECONOMIC_ALTERNATIVE: 'ECONOMIC_ALTERNATIVE',
  PREMIUM_ALTERNATIVE: 'PREMIUM_ALTERNATIVE',
  FRONTIER_CANDIDATE: 'FRONTIER_CANDIDATE',
  FRONTIER_BLOCKED: 'FRONTIER_BLOCKED',
  UNASSESSED: 'UNASSESSED',
})

export const WORKFLOW_CAPABILITY_LANES = Object.freeze({
  'text-to-image': 'Text to image',
  'image-edit': 'Image edit',
  'image-to-video': 'Image to video',
  'text-to-video': 'Text to video',
  'video-tools': 'Restoration and finishing',
  audio: 'Audio',
  image: 'Image',
  video: 'Video',
  create: 'Guided production',
  utility: 'Utility',
})

const SELF_HOSTED_PROVIDER_NAMES = new Set(['local', 'velorn'])

const WORKFLOW_EVIDENCE_OVERRIDES = Object.freeze({
  'wan22-t2v': Object.freeze({
    portfolioRole: WORKFLOW_PORTFOLIO_ROLES.SOVEREIGN_ALTERNATIVE,
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.PRODUCT_PROVEN,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'B200 artifacts and receipts verified',
    qualityObservation: 'Stable long-form text-to-video artifacts were produced and preserved.',
    limitation: 'Requires a compatible external GPU runtime; no active GPU is assumed.',
  }),
  'wan22-i2v': Object.freeze({
    portfolioRole: WORKFLOW_PORTFOLIO_ROLES.SOVEREIGN_ALTERNATIVE,
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.PRODUCT_PROVEN,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'B200 artifacts and editable-project evidence verified',
    qualityObservation: 'Controlled image-to-video output was generated and imported into an editable project.',
    limitation: 'Identity and temporal continuity remain shot-dependent and require evaluation.',
  }),
  'ltx23-t2v': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.INSTALLED,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'LTX model family physically present on the durable volume',
    limitation: 'The exact Velorn workflow still requires a current end-to-end product proof.',
  }),
  'ltx23-i2v': Object.freeze({
    portfolioRole: WORKFLOW_PORTFOLIO_ROLES.FRONTIER_BLOCKED,
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.INSTALLED,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'LTX model family physically present on the durable volume',
    limitation: 'The exact Velorn workflow still requires a current end-to-end product proof.',
  }),
  'ltx23-ia2v': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.INSTALLED,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'LTX audio-video models physically present on the durable volume',
    limitation: 'Audio-conditioned output has not yet passed the full Velorn product gate.',
  }),
  'frame-interpolation': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.INSTALLED,
    availability: 'Runtime required',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'RIFE and interpolation assets found in the certified inventory',
    limitation: 'The bundled graph must still be matched to a current product artifact.',
  }),
  'music-gen': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE,
    availability: 'Blocked until dependencies are installed',
    sovereignty: 'Self-hosted',
    evidenceLabel: 'Workflow is bundled; durable music-model weights were not found',
    limitation: 'No durable ACE-Step weights were present in the certified volume census.',
  }),
  'kling-o3-i2v': Object.freeze({
    portfolioRole: WORKFLOW_PORTFOLIO_ROLES.PREMIUM_ALTERNATIVE,
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.TECHNICALLY_VALIDATED,
    availability: 'Cloud credentials required',
    sovereignty: 'Commercial API',
    evidenceLabel: 'Exact Kling O3 Pro model benchmarked blind on the shared identity-motion brief',
    qualityObservation: '6.325/10 weighted: strong motion, but it replaced the requested pivot with a jump and changed the lighting.',
    limitation: 'The benchmark proves the model through the Runway workspace, not this ComfyUI execution route.',
    benchmark: Object.freeze({ model: 'kling-o3-pro', score: 6.325, artifact: 'candidate_b.mp4' }),
  }),
  'seedance2-r2v': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.TECHNICALLY_VALIDATED,
    availability: 'Cloud credentials required',
    sovereignty: 'Commercial API',
    evidenceLabel: 'Seedance family artifact verified; exact 2.0 workflow still needs product proof',
    limitation: 'The preserved product artifact used another Seedance version/provider route.',
  }),
  'topaz-video-upscale': Object.freeze({
    evidenceLevel: WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE,
    availability: 'Cloud credentials required',
    sovereignty: 'Commercial API',
    evidenceLabel: 'Workflow is bundled; no exact product receipt was found',
    limitation: 'A current credential and end-to-end artifact are still required.',
  }),
})

const COMFY_TEMPLATE_PORTFOLIO_OVERRIDES = workflowPortfolioData.comfyTemplateOverrides

function inferEvidenceLevel(workflow) {
  if (!workflow) return WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE
  if (workflow.mode === 'create') return WORKFLOW_EVIDENCE_LEVELS.EXECUTABLE
  if (workflow.imported && workflow.runnable) return WORKFLOW_EVIDENCE_LEVELS.EXECUTABLE
  if (workflow.runnable && workflow.route === 'local') return WORKFLOW_EVIDENCE_LEVELS.INSTALLED
  return WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE
}

function inferSovereignty(workflow) {
  const provider = String(workflow?.provider || '').trim().toLowerCase()
  if (SELF_HOSTED_PROVIDER_NAMES.has(provider) || workflow?.route === 'local') return 'Self-hosted'
  if (workflow?.route === 'custom') return 'User-controlled graph'
  return 'Commercial API'
}

function inferAvailability(workflow) {
  if (workflow?.mode === 'create') return 'Available in Velorn'
  if (!workflow?.runnable) return 'Preview only'
  if (workflow?.route === 'local') return 'Runtime required'
  if (workflow?.route === 'cloud') return 'Cloud credentials required'
  return 'Dependency check required'
}

export function getWorkflowOperationalMetadata(workflow) {
  const workflowId = String(workflow?.workflowId || workflow?.id || '').trim()
  const override = WORKFLOW_EVIDENCE_OVERRIDES[workflowId] || {}
  const category = String(workflow?.category || 'utility').trim()
  return {
    capabilityLane: WORKFLOW_CAPABILITY_LANES[category] || category || 'Utility',
    portfolioRole: override.portfolioRole || WORKFLOW_PORTFOLIO_ROLES.UNASSESSED,
    evidenceLevel: override.evidenceLevel || inferEvidenceLevel(workflow),
    availability: override.availability || inferAvailability(workflow),
    sovereignty: override.sovereignty || inferSovereignty(workflow),
    evidenceLabel: override.evidenceLabel || (
      workflow?.mode === 'create'
        ? 'Native guided-creation surface is present in Velorn'
        : 'No exact product receipt is attached to this workflow yet'
    ),
    qualityObservation: override.qualityObservation || '',
    benchmark: override.benchmark || null,
    limitation: override.limitation || (
      workflow?.runnable
        ? 'Runtime readiness is verified when the workflow is selected.'
        : 'Workflow graph or execution bindings are not complete.'
    ),
  }
}

export function getComfyTemplateOperationalMetadata(template) {
  const templateName = String(template?.name || '').trim()
  const override = COMFY_TEMPLATE_PORTFOLIO_OVERRIDES[templateName] || {}
  return {
    capabilityLane: override.capabilityLane || template?.categoryLabel || 'ComfyUI template',
    portfolioRole: override.portfolioRole || WORKFLOW_PORTFOLIO_ROLES.UNASSESSED,
    evidenceLevel: override.evidenceLevel || WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE,
    modelEvidenceLevel: override.modelEvidenceLevel || override.evidenceLevel || WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE,
    routeEvidenceLevel: override.routeEvidenceLevel || WORKFLOW_EVIDENCE_LEVELS.DISCOVERABLE,
    sovereignty: template?.openSource ? 'Open source workflow' : 'Commercial API',
    evidenceLabel: override.evidenceLabel || 'Official ComfyUI template is discoverable; no exact product receipt is attached.',
    qualityObservation: override.qualityObservation || '',
    limitation: override.limitation || 'Import, dependency readiness and an exact-route artifact are still required.',
    benchmark: override.benchmark || null,
  }
}

export function enrichWorkflowWithOperationalMetadata(workflow) {
  if (!workflow || typeof workflow !== 'object') return workflow
  return {
    ...workflow,
    operational: getWorkflowOperationalMetadata(workflow),
  }
}

export function mergeWorkflowRuntimeReadiness(workflow, dependencyCheck) {
  const enriched = enrichWorkflowWithOperationalMetadata(workflow)
  if (!enriched || !dependencyCheck || dependencyCheck.workflowId !== enriched.workflowId) return enriched

  let availability = enriched.operational.availability
  if (dependencyCheck.status === 'ready') availability = 'Ready on connected runtime'
  if (dependencyCheck.status === 'missing') availability = 'Blocked by missing dependencies'
  if (dependencyCheck.status === 'partial') availability = 'Partially verified on connected runtime'
  if (dependencyCheck.status === 'offline') availability = 'Runtime offline'
  if (dependencyCheck.status === 'error') availability = 'Readiness check failed'

  return {
    ...enriched,
    operational: {
      ...enriched.operational,
      availability,
      runtimeStatus: dependencyCheck.status,
    },
  }
}
