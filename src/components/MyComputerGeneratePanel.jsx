import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clapperboard, Loader2, RefreshCcw, ShieldAlert, Sparkles, Video } from 'lucide-react'
import useAssetsStore from '../stores/assetsStore'
import useProjectStore from '../stores/projectStore'
import useTimelineStore from '../stores/timelineStore'
import { getProjectFileUrl, importAsset, isElectron } from '../services/fileSystem'
import {
  capabilitiesFromHealth,
  extractMyComputerArtifacts,
  MY_COMPUTER_CAPABILITIES,
  myComputerMedia,
} from '../services/myComputerMedia.js'
import {
  getMyComputerConnection,
  MY_COMPUTER_CONNECTION_CHANGED_EVENT,
} from '../services/localMyComputerConnection.js'

const DEFAULT_PROMPT = 'A cinematic wide shot at golden hour, natural motion, realistic lighting, coherent details, professional camera movement.'

function safeFilename(value, fallback = 'mycomputer-output.mp4') {
  const name = String(value || fallback).split(/[\\/]/).pop() || fallback
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160)
  return sanitized || fallback
}

function statusTone(kind) {
  if (kind === 'success') return 'border-green-700/40 bg-green-950/30 text-green-200'
  if (kind === 'error') return 'border-red-700/40 bg-red-950/30 text-red-200'
  if (kind === 'warning') return 'border-amber-700/40 bg-amber-950/30 text-amber-100'
  return 'border-sf-dark-700 bg-sf-dark-900/60 text-sf-text-muted'
}

function roleLabel(role) {
  return {
    reference_image: 'Reference image',
    reference_video: 'Performance/reference video',
    source_video: 'Source video',
  }[role] || role
}

function acceptsAsset(role, asset) {
  if (role === 'reference_image') return asset?.type === 'image'
  if (role === 'reference_video' || role === 'source_video') return asset?.type === 'video'
  return false
}

function getAssetLocalPath(asset) {
  return String(asset?.absolutePath || '').trim()
}

export default function MyComputerGeneratePanel() {
  const assets = useAssetsStore((state) => state.assets)
  const addAsset = useAssetsStore((state) => state.addAsset)
  const generateName = useAssetsStore((state) => state.generateName)
  const currentProject = useProjectStore((state) => state.currentProject)
  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle)
  const saveProject = useProjectStore((state) => state.saveProject)
  const tracks = useTimelineStore((state) => state.tracks)
  const addTrack = useTimelineStore((state) => state.addTrack)
  const addClip = useTimelineStore((state) => state.addClip)

  const [capabilities, setCapabilities] = useState(() => capabilitiesFromHealth({}, false))
  const [capabilityId, setCapabilityId] = useState(MY_COMPUTER_CAPABILITIES[0].id)
  const [hasToken, setHasToken] = useState(false)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, watermark, deformed anatomy, unstable motion')
  const [duration, setDuration] = useState(5)
  const [width, setWidth] = useState(1280)
  const [height, setHeight] = useState(720)
  const [fps, setFps] = useState(24)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2_147_483_647))
  const [assetByRole, setAssetByRole] = useState({})
  const [addToTimeline, setAddToTimeline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState('')
  const [resumeJobId, setResumeJobId] = useState('')
  const [progress, setProgress] = useState({ kind: 'idle', message: 'Ready to submit through My Computer.' })
  const [lastAsset, setLastAsset] = useState(null)

  const capability = useMemo(
    () => capabilities.find((item) => item.id === capabilityId) || capabilities[0],
    [capabilities, capabilityId]
  )
  const capabilityReady = Boolean(capability?.enabled && hasToken)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [reported, connection] = await Promise.all([
          myComputerMedia.capabilities(),
          getMyComputerConnection(),
        ])
        if (!active) return
        setCapabilities(reported)
        setHasToken(Boolean(connection?.hasToken))
        setCapabilityId((current) => {
          if (reported.find((item) => item.id === current)?.enabled) return current
          return reported.find((item) => item.enabled)?.id || current
        })
      } catch (error) {
        if (!active) return
        setCapabilities(capabilitiesFromHealth({}, false))
        setProgress({ kind: 'error', message: error?.message || 'Could not load My Computer capabilities.' })
      }
    }
    const onConnectionChanged = (event) => {
      setHasToken(Boolean(event?.detail?.hasToken))
      void refresh()
    }
    void refresh()
    window.addEventListener(MY_COMPUTER_CONNECTION_CHANGED_EVENT, onConnectionChanged)
    return () => {
      active = false
      window.removeEventListener(MY_COMPUTER_CONNECTION_CHANGED_EVENT, onConnectionChanged)
    }
  }, [])

  const assetOptionsByRole = useMemo(() => Object.fromEntries(
    capability.requiredAssetRoles.map((role) => [
      role,
      assets.filter((asset) => acceptsAsset(role, asset) && getAssetLocalPath(asset)),
    ])
  ), [assets, capability])

  const healthCheck = async () => {
    setProgress({ kind: 'working', message: 'Checking My Computer…' })
    const reported = await myComputerMedia.capabilities()
    setCapabilities(reported)
    const enabledCount = reported.filter((item) => item.enabled).length
    setProgress(enabledCount > 0 && hasToken
      ? { kind: 'success', message: `My Computer is ready; ${enabledCount}/${reported.length} capabilities enabled.` }
      : { kind: 'warning', message: enabledCount > 0 ? 'My Computer is reachable; save the required token in Settings.' : 'My Computer is reachable but no media capability is promoted.' })
  }

  const materializeArtifact = async (artifact, sourceJobId, sourceJob = null) => {
    if (!currentProjectHandle) throw new Error('Open or create a Velorn project before generating.')
    if (!isElectron()) throw new Error('My Computer artifact materialization currently requires Velorn desktop.')

    const cacheDir = await window.electronAPI.pathJoin(currentProjectHandle, 'cache', 'mycomputer')
    await window.electronAPI.createDirectory(cacheDir)
    const destination = await window.electronAPI.pathJoin(
      cacheDir,
      `${Date.now()}-${safeFilename(artifact.filename)}`
    )

    const downloaded = await myComputerMedia.downloadArtifact(artifact, destination)
    const assetInfo = await importAsset(currentProjectHandle, downloaded.path || destination, 'video')
    const projectUrl = assetInfo.path
      ? await getProjectFileUrl(currentProjectHandle, assetInfo.path)
      : assetInfo.url

    const sourceRequest = sourceJob?.raw?.args?.request || {}
    const sourceResult = sourceJob?.result || {}
    const sourceParameters = sourceRequest?.parameters || {}
    const assetPrompt = String(sourceResult.prompt || sourceParameters.prompt || prompt || '')
    const assetCapabilityId = String(sourceResult.capability_id || sourceRequest.capability_id || capabilityId)
    const assetSeed = Number(sourceParameters.seed ?? seed)

    const generatedAsset = addAsset({
      ...assetInfo,
      name: generateName(assetPrompt || capability.label),
      type: 'video',
      url: projectUrl || assetInfo.url,
      prompt: assetPrompt,
      negativePrompt: String(sourceParameters.negative_prompt || negativePrompt || ''),
      isImported: true,
      provenance: {
        origin: 'mycomputer',
        jobId: sourceJobId,
        capabilityId: assetCapabilityId,
        casSha256: artifact.sha256 || downloaded.sha256 || '',
        receiptRef: artifact.receiptRef || '',
        provider: artifact.provider || '',
        workflowId: artifact.workflowId || '',
        workflowSha256: artifact.workflowSha256 || '',
        imageDigest: artifact.imageDigest || '',
        releaseStatus: artifact.releaseStatus || 'unknown',
        c01Required: artifact.c01Required,
        c01Passed: artifact.c01Passed,
      },
      settings: {
        ...(assetInfo.settings || {}),
        duration: assetInfo.duration,
        width: assetInfo.width,
        height: assetInfo.height,
        fps: assetInfo.fps,
        seed: assetSeed,
        workflow: assetCapabilityId,
        myComputerJobId: sourceJobId,
        casSha256: artifact.sha256 || downloaded.sha256 || '',
        releaseStatus: artifact.releaseStatus || 'unknown',
        c01Required: artifact.c01Required,
        c01Passed: artifact.c01Passed,
      },
    })

    const quarantined = artifact.releaseStatus === 'quarantined' || artifact.c01Passed === false
    if (addToTimeline && !quarantined) {
      let targetTrack = tracks.find((track) => track.type === 'video' && track.role === 'mycomputer')
        || tracks.find((track) => track.type === 'video')
      if (!targetTrack) targetTrack = addTrack('video', { role: 'mycomputer', name: 'My Computer' })
      addClip(targetTrack.id, generatedAsset, null, fps, {
        metadata: generatedAsset.provenance,
      })
    }

    try {
      await window.electronAPI.deleteFile(downloaded.path || destination)
    } catch {
      // The project copy is authoritative; a failed cache cleanup must not hide a successful generation.
    }

    await saveProject()
    setLastAsset(generatedAsset)
    return { generatedAsset, quarantined }
  }

  const buildInputs = async () => {
    const refs = []
    for (const role of capability.requiredAssetRoles) {
      const asset = assets.find((item) => item.id === assetByRole[role])
      const filePath = getAssetLocalPath(asset)
      if (!asset || !filePath) throw new Error(`${roleLabel(role)} must be a local project asset.`)
      setProgress({ kind: 'working', message: `Ingesting ${roleLabel(role)}…` })
      refs.push(await myComputerMedia.ingestAsset({ filePath, role }))
    }
    return refs
  }

  const completeExistingJob = async (sourceJobId) => {
    setJobId(sourceJobId)
    setProgress({ kind: 'working', message: `Attaching to job ${sourceJobId}…` })
    const completed = await myComputerMedia.waitForCompletion(sourceJobId, {
      onProgress: (job) => {
        const latestLog = job.logs.at(-1)
        setProgress({
          kind: 'working',
          message: latestLog ? `${job.status}: ${latestLog}` : `Job ${job.status}…`,
        })
      },
    })
    const videoArtifact = extractMyComputerArtifacts(completed).find((artifact) => artifact.kind === 'video')
    if (!videoArtifact) throw new Error('The job succeeded but did not return a downloadable video artifact.')

    setProgress({ kind: 'working', message: 'Materializing MP4 in the Velorn project…' })
    const { generatedAsset, quarantined } = await materializeArtifact(videoArtifact, sourceJobId, completed)
    setProgress(quarantined
      ? { kind: 'warning', message: `${generatedAsset.name} was preserved in Assets but not released to the timeline.` }
      : { kind: 'success', message: `${generatedAsset.name} is in Assets${addToTimeline ? ' and the timeline' : ''}.` })
  }

  const resumeExistingJob = async () => {
    if (busy) return
    const sourceJobId = resumeJobId.trim()
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(sourceJobId)) {
      setProgress({ kind: 'error', message: 'Enter a valid My Computer job ID.' })
      return
    }
    if (!currentProjectHandle) {
      setProgress({ kind: 'error', message: 'Open or create a project before materializing a job.' })
      return
    }
    if (!hasToken) {
      setProgress({ kind: 'error', message: 'Save the required My Computer token in Settings first.' })
      return
    }
    setBusy(true)
    setLastAsset(null)
    try {
      await completeExistingJob(sourceJobId)
    } catch (error) {
      setProgress({ kind: 'error', message: error?.message || 'Could not resume the My Computer job.' })
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (busy) return
    if (!currentProjectHandle) {
      setProgress({ kind: 'error', message: 'Open or create a project before generating.' })
      return
    }
    if (!hasToken) {
      setProgress({ kind: 'error', message: 'Save the required My Computer token in Settings before generating.' })
      return
    }
    if (!capability?.enabled) {
      setProgress({ kind: 'error', message: `${capabilityId} is not promoted by My Computer.` })
      return
    }

    setBusy(true)
    setJobId('')
    setLastAsset(null)
    try {
      const inputs = await buildInputs()
      setProgress({ kind: 'working', message: `Submitting ${capability.label}…` })
      const submitted = await myComputerMedia.submit({
        capabilityId,
        projectId: currentProject?.id || currentProject?.name,
        inputs,
        humanReviewRequired: capabilityId === 'wan_animate2_v1',
        parameters: {
          prompt,
          negative_prompt: negativePrompt,
          duration_seconds: Number(duration),
          width: Number(width),
          height: Number(height),
          fps: Number(fps),
          seed: Number(seed),
          upscale_factor: capabilityId === 'restore_upscale_2x_v1' ? 2 : undefined,
        },
      })
      await completeExistingJob(submitted.jobId)
    } catch (error) {
      setProgress({ kind: 'error', message: error?.message || 'My Computer generation failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-3">
      <div className="rounded-lg border border-sf-accent/30 bg-sf-accent/5 p-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-md bg-sf-accent/15 p-2 text-sf-accent"><Clapperboard className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-semibold text-sf-text-primary">El Monstruo · B200</div>
            <p className="mt-1 text-[11px] text-sf-text-muted">Generate through the sovereign My Computer control plane. Outputs are materialized in CAS before entering Velorn.</p>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-sf-text-primary">Capability</span>
        <select
          value={capabilityId}
          onChange={(event) => {
            setCapabilityId(event.target.value)
            setAssetByRole({})
          }}
          className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary focus:border-sf-accent focus:outline-none"
        >
          {capabilities.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.enabled}>
              {item.label}{item.enabled ? ` · ${item.availability}` : ' · unavailable'}
            </option>
          ))}
        </select>
        <code className="mt-1 block text-[10px] text-sf-text-muted">{capabilityId}</code>
      </label>

      {capability.requiredAssetRoles.map((role) => (
        <label key={role} className="block">
          <span className="mb-1 block text-xs font-medium text-sf-text-primary">{roleLabel(role)}</span>
          <select
            value={assetByRole[role] || ''}
            onChange={(event) => setAssetByRole((current) => ({ ...current, [role]: event.target.value }))}
            className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary focus:border-sf-accent focus:outline-none"
          >
            <option value="">Select a local project asset…</option>
            {(assetOptionsByRole[role] || []).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          {(assetOptionsByRole[role] || []).length === 0 && <p className="mt-1 text-[10px] text-amber-300">Import a local {role.includes('image') ? 'image' : 'video'} into Assets first.</p>}
        </label>
      ))}

      {capabilityId !== 'restore_upscale_2x_v1' && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-sf-text-primary">Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              className="w-full resize-y rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary focus:border-sf-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-sf-text-primary">Negative prompt</span>
            <textarea
              value={negativePrompt}
              onChange={(event) => setNegativePrompt(event.target.value)}
              rows={2}
              className="w-full resize-y rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary focus:border-sf-accent focus:outline-none"
            />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="mb-1 block text-[10px] text-sf-text-muted">Duration (s)</span><input type="number" min={1} max={120} value={duration} onChange={(event) => setDuration(event.target.value)} className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
        <label className="block"><span className="mb-1 block text-[10px] text-sf-text-muted">FPS</span><input type="number" min={1} max={120} value={fps} onChange={(event) => setFps(event.target.value)} className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
        <label className="block"><span className="mb-1 block text-[10px] text-sf-text-muted">Width</span><input type="number" min={256} max={4096} step={8} value={width} onChange={(event) => setWidth(event.target.value)} className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
        <label className="block"><span className="mb-1 block text-[10px] text-sf-text-muted">Height</span><input type="number" min={256} max={4096} step={8} value={height} onChange={(event) => setHeight(event.target.value)} className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" /></label>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between"><span className="text-[10px] text-sf-text-muted">Seed</span><button type="button" onClick={() => setSeed(Math.floor(Math.random() * 2_147_483_647))} className="text-[10px] text-sf-accent hover:text-sf-accent-hover">Randomize</button></div>
        <input type="number" value={seed} onChange={(event) => setSeed(event.target.value)} className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" />
      </div>

      <label className="flex items-center justify-between rounded border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-2">
        <div><div className="text-xs text-sf-text-primary">Add released video to timeline</div><div className="text-[10px] text-sf-text-muted">Quarantined artifacts remain in Assets only.</div></div>
        <input type="checkbox" checked={addToTimeline} onChange={(event) => setAddToTimeline(event.target.checked)} className="h-4 w-4 accent-sf-accent" />
      </label>

      <div className={`rounded-lg border px-3 py-3 ${statusTone(progress.kind)}`}>
        <div className="flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" /> : progress.kind === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : progress.kind === 'warning' || progress.kind === 'error' ? <ShieldAlert className="h-4 w-4 flex-shrink-0" /> : <Video className="h-4 w-4 flex-shrink-0" />}
          <span className="min-w-0 text-xs">{progress.message}</span>
        </div>
        {jobId && <code className="mt-2 block truncate text-[10px] opacity-70">Job: {jobId}</code>}
      </div>

      <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/40 p-3">
        <label className="block">
          <span className="mb-1 block text-[10px] text-sf-text-muted">Resume an existing My Computer job</span>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input type="text" value={resumeJobId} onChange={(event) => setResumeJobId(event.target.value)} placeholder="My Computer job ID" disabled={busy} className="min-w-0 rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1.5 text-xs text-sf-text-primary" />
            <button type="button" onClick={() => { void resumeExistingJob() }} disabled={busy || !hasToken || !currentProjectHandle} className="inline-flex items-center justify-center gap-1.5 rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50"><RefreshCcw className="h-3.5 w-3.5" /> Resume job</button>
          </div>
          <p className="mt-1 text-[10px] text-sf-text-muted">Reattaches after a restart or recovery. It never submits a new generation.</p>
        </label>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={() => { void healthCheck() }} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50"><RefreshCcw className="h-3.5 w-3.5" /> Health</button>
        <button type="button" onClick={() => { void submit() }} disabled={busy || !capabilityReady} className="inline-flex items-center justify-center gap-1.5 rounded bg-sf-accent px-3 py-2 text-xs font-semibold text-white hover:bg-sf-accent/90 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> {busy ? 'Generating…' : 'Generate with My Computer'}</button>
      </div>

      {lastAsset && <div className="rounded border border-green-700/30 bg-green-950/20 px-3 py-2 text-[11px] text-green-200">Latest asset: {lastAsset.name}</div>}
    </div>
  )
}
