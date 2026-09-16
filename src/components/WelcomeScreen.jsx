import { lazy, Suspense, useState, useEffect } from 'react'
import { FolderOpen, Plus, Film, AlertCircle, Loader2, Trash2, KeyRound, CheckCircle2, Compass, LayoutGrid, List, Minus, Square, Copy, X } from 'lucide-react'
import useProjectStore from '../stores/projectStore'
import useAssetsStore from '../stores/assetsStore'
import NewProjectDialog from './NewProjectDialog'
import ComfyLauncherChip from './ComfyLauncherChip'
import CreditsChip from './CreditsChip'
import GettingStartedModal from './GettingStartedModal'
import ApiKeyDialog from './ApiKeyDialog'
import SettingsModal from './SettingsModal'
import {
  getComfyPartnerApiKey,
  COMFY_PARTNER_KEY_CHANGED_EVENT,
} from '../services/comfyPartnerAuth'
import { resolveThumbnailUrl } from '../utils/projectThumbnail'
import { useI18n } from '../i18n/I18nContext'

const DiscoverModal = lazy(() => import('./DiscoverModal'))

const WELCOME_ASSET_BASE_URL = (() => {
  const rawBase = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? String(import.meta.env.BASE_URL)
    : '/'
  return rawBase.endsWith('/') ? rawBase : `${rawBase}/`
})()

function getWelcomeAssetPath(filename) {
  const safeFilename = String(filename || '').replace(/^\/+/, '')
  return `${WELCOME_ASSET_BASE_URL}${safeFilename}`
}

function WelcomeScreen() {
  const { t } = useI18n()
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [recentProjectsList, setRecentProjectsList] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  // Resolved <img>-ready URLs for each project's on-disk thumbnail, keyed
  // by project path (Electron) or name (web fallback).
  const [thumbnailUrls, setThumbnailUrls] = useState({})
  const [gettingStartedOpen, setGettingStartedOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [partnerKeyConfigured, setPartnerKeyConfigured] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState(null)
  const [windowState, setWindowState] = useState({ isMaximized: false, isFullScreen: false })
  const [deleteProjectDialog, setDeleteProjectDialog] = useState(null)
  const [deleteProjectError, setDeleteProjectError] = useState('')
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [duplicatingProjectKey, setDuplicatingProjectKey] = useState('')
  
  const {
    isFirstRun,
    isLoading,
    error,
    defaultProjectsHandle,
    defaultProjectsLocation,
    recentProjects,
    checkBrowserSupport,
    selectDefaultProjectsLocation,
    openProjectFromPicker,
    openLatestAutosaveForFailedProject,
    openRecentProject,
    duplicateProject,
    removeRecentProject,
    clearError,
    getRecentProjectsList,
    isElectronMode,
    lastFailedProjectHandle,
    lastFailedProjectName,
    showHeroBackground,
    projectListViewMode,
    setProjectListViewMode,
  } = useProjectStore()
  const mediaPreparation = useAssetsStore((state) => state.mediaPreparation)
  
  const isBrowserSupported = checkBrowserSupport()
  const canOpenLatestAutosave = Boolean(
    lastFailedProjectHandle && error?.includes('Project file is empty or invalid')
  )
  const mediaPreparationTotal = Math.max(0, Number(mediaPreparation?.total) || 0)
  const mediaPreparationCompleted = Math.max(0, Math.min(mediaPreparationTotal, Number(mediaPreparation?.completed) || 0))
  const mediaPreparationPercent = mediaPreparationTotal > 0
    ? Math.round((mediaPreparationCompleted / mediaPreparationTotal) * 100)
    : 0
  const showMediaPreparation = Boolean(isLoading && mediaPreparation?.active && mediaPreparationTotal > 0)
  const welcomeBrandIconSrc = getWelcomeAssetPath('monstruo-studio-app-icon.svg')
  const desktopMode = isElectronMode()
  
  // Keep partner-key status fresh so the chip in the header reflects
  // changes made from the ApiKeyDialog without remounting.
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      try {
        const key = await getComfyPartnerApiKey()
        if (!cancelled) setPartnerKeyConfigured(Boolean(String(key || '').trim()))
      } catch {
        if (!cancelled) setPartnerKeyConfigured(false)
      }
    }
    hydrate()
    const handler = () => { hydrate() }
    window.addEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, handler)
    return () => {
      cancelled = true
      window.removeEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, handler)
    }
  }, [])

  // Load recent projects on mount
  useEffect(() => {
    const loadRecentProjects = async () => {
      if (defaultProjectsHandle) {
        setLoadingProjects(true)
        try {
          const projects = await getRecentProjectsList()
          setRecentProjectsList(projects)
        } catch (err) {
          console.error('Error loading recent projects:', err)
        }
        setLoadingProjects(false)
      } else {
        setRecentProjectsList(recentProjects)
      }
    }
    
    loadRecentProjects()
  }, [defaultProjectsHandle, recentProjects])

  // Once we have the list, resolve any on-disk thumbnail pointers into
  // <img>-ready URLs. We do this separately so the grid can render cards
  // immediately (with placeholder icons) while thumbnails swap in as they
  // resolve, matching Resolve's "pop in" behaviour.
  useEffect(() => {
    let cancelled = false
    const urls = {}
    const run = async () => {
      for (const project of recentProjectsList) {
        if (cancelled) return
        if (!project?.thumbnail) continue
        try {
          const url = await resolveThumbnailUrl(
            project.path || project.handle,
            project.thumbnail
          )
          if (cancelled) return
          if (url) {
            const key = project.path || project.name
            urls[key] = url
            // Push each as it resolves so cards don't wait for the slowest.
            setThumbnailUrls((prev) => ({ ...prev, [key]: url }))
          }
        } catch (_) {
          // Non-fatal; card falls back to placeholder icon.
        }
      }
    }
    // Clear any stale URLs before resolving the new batch so removed
    // projects don't linger.
    setThumbnailUrls({})
    run()
    return () => {
      cancelled = true
    }
  }, [recentProjectsList])
  
  // Format date for display
  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown'
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }
  
  // Handle opening a recent project
  const handleOpenRecent = async (project) => {
    // Use the unified openRecentProject function which handles both Electron and web modes
    await openRecentProject(project)
  }

  const removeProjectFromRecentList = (project) => {
    if (!project) return
    removeRecentProject(project)
    setRecentProjectsList((prev) =>
      prev.filter((p) => !(p.name === project.name && (p.path || '') === (project.path || '')))
    )
  }

  const getProjectKey = (project) => project?.path || project?.name || ''

  const handleDuplicateProject = async (event, project) => {
    event.stopPropagation()
    if (!project || duplicatingProjectKey) return
    const key = getProjectKey(project)
    setDuplicatingProjectKey(key)
    try {
      await duplicateProject(project)
    } finally {
      setDuplicatingProjectKey('')
    }
  }

  const openDeleteProjectDialog = (event, project) => {
    event.stopPropagation()
    setDeleteProjectError('')
    setDeleteProjectDialog(project)
  }

  const closeDeleteProjectDialog = () => {
    if (isDeletingProject) return
    setDeleteProjectDialog(null)
    setDeleteProjectError('')
  }

  const handleRemoveProjectFromList = () => {
    removeProjectFromRecentList(deleteProjectDialog)
    closeDeleteProjectDialog()
  }

  const handleTrashProjectFolder = async () => {
    if (!deleteProjectDialog) return
    const projectPath = deleteProjectDialog.path
    if (!projectPath) {
      setDeleteProjectError('This project does not have a folder path available, so it can only be removed from the list.')
      return
    }
    if (!desktopMode || !window.electronAPI?.trashItem) {
      setDeleteProjectError('Moving a project folder to the Recycle Bin is only available in the desktop app.')
      return
    }

    setIsDeletingProject(true)
    setDeleteProjectError('')
    try {
      const result = await window.electronAPI.trashItem(projectPath)
      if (!result?.success) {
        throw new Error(result?.error || 'Could not move project folder to the Recycle Bin.')
      }
      removeProjectFromRecentList(deleteProjectDialog)
      setDeleteProjectDialog(null)
    } catch (err) {
      setDeleteProjectError(err?.message || 'Could not move project folder to the Recycle Bin.')
    } finally {
      setIsDeletingProject(false)
    }
  }

  // Keep native-style window controls in sync with the Electron main window.
  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const next = await window.electronAPI?.getWindowState?.()
        if (mounted && next) {
          setWindowState({
            isMaximized: Boolean(next.isMaximized),
            isFullScreen: Boolean(next.isFullScreen),
          })
        }
      } catch (_) { /* non-Electron contexts */ }
    }
    load()

    const unsubscribe = window.electronAPI?.onWindowStateChanged?.((next) => {
      if (!mounted || !next) return
      setWindowState({
        isMaximized: Boolean(next.isMaximized),
        isFullScreen: Boolean(next.isFullScreen),
      })
    })

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [])

  const isRestoreDown = windowState.isMaximized || windowState.isFullScreen
  const handleMinimize = () => window.electronAPI?.minimizeWindow?.()
  const handleToggleMaximize = () => window.electronAPI?.toggleMaximizeWindow?.()
  const handleCloseWindow = () => window.electronAPI?.closeWindow?.()

  // Native-style title strip — thin drag region with window controls.
  // Matches the TitleBar used once a project is open so users always have
  // access to minimize / maximize / close, even on first run.
  const titleStrip = (
    <div className="relative z-50 h-10 flex-shrink-0 bg-black flex items-stretch justify-end drag-region select-none">
      <div className="no-drag flex items-stretch">
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center hover:bg-sf-dark-700 transition-colors"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-sf-text-secondary" />
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-10 h-10 flex items-center justify-center hover:bg-sf-dark-700 transition-colors"
          title={isRestoreDown ? 'Restore Down' : 'Maximize'}
          aria-label={isRestoreDown ? 'Restore Down' : 'Maximize'}
        >
          {isRestoreDown ? (
            <Copy className="w-3 h-3 text-sf-text-secondary" />
          ) : (
            <Square className="w-3 h-3 text-sf-text-secondary" />
          )}
        </button>
        <button
          onClick={handleCloseWindow}
          className="w-10 h-10 flex items-center justify-center hover:bg-red-600 transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-sf-text-secondary" />
        </button>
      </div>
    </div>
  )
  const mediaPreparationBanner = showMediaPreparation ? (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-sf-dark-600 bg-sf-dark-900/95 px-3 py-2 shadow-2xl shadow-black/40">
      <div className="mb-1.5 flex items-center gap-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-sf-accent" />
        <span className="font-medium text-sf-text-primary">Opening project media</span>
        <span className="ml-auto font-mono text-[10px] text-sf-text-muted">
          {mediaPreparationCompleted}/{mediaPreparationTotal}
        </span>
      </div>
      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-sf-dark-700">
        <div
          className="h-full rounded-full bg-sf-accent transition-[width] duration-200"
          style={{ width: `${mediaPreparationPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[10px] text-sf-text-muted">
        <span>{mediaPreparation?.label || 'Preparing media...'}</span>
        <span>{mediaPreparationPercent}%</span>
      </div>
    </div>
  ) : null

  // First-run setup screen
  if (isFirstRun || !defaultProjectsHandle) {
    return (
      <div className="h-screen bg-sf-dark-950 flex flex-col">
        {titleStrip}
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full mx-4">
          {/* Branding */}
          <div className="mb-8 flex flex-col items-center text-center">
            <img src={welcomeBrandIconSrc} alt="" className="mb-4 h-24 w-24" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-sf-accent">El Monstruo</div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-sf-text-primary">Monstruo Studio</h1>
          </div>
          
          {/* Browser Support Warning - only show in web mode */}
          {!isBrowserSupported && !desktopMode && (
            <div className="mb-6 p-4 bg-sf-error/20 border border-sf-error/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-sf-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-sf-text-primary font-medium">{t('welcome.browserUnsupported')}</p>
                  <p className="text-xs text-sf-text-muted mt-1">
                    {t('welcome.browserUnsupportedHelp')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Setup Card */}
          <div className="bg-sf-dark-900 border border-sf-dark-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-sf-text-primary mb-2 text-center">{t('welcome.setupWorkspace')}</h2>
            <p className="text-sm text-sf-text-muted mb-6">
              {t('welcome.setupWorkspaceHelp')}
            </p>
            
            {/* Current Location Display */}
            {defaultProjectsLocation && (
              <div className="mb-4 p-3 bg-sf-dark-800 rounded-lg">
                <p className="text-xs text-sf-text-muted mb-1">{t('welcome.currentLocation')}</p>
                <p className="text-sm text-sf-text-primary truncate">{defaultProjectsLocation}</p>
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-sf-error/20 border border-sf-error/50 rounded-lg">
                <p className="text-xs text-sf-error">{error}</p>
                {canOpenLatestAutosave && (
                  <button
                    onClick={openLatestAutosaveForFailedProject}
                    className="text-xs text-sf-text-primary hover:text-white mt-2 rounded-md border border-sf-dark-500 bg-sf-dark-900 px-2.5 py-1 transition-colors"
                  >
                    {lastFailedProjectName
                      ? t('welcome.openLatestAutosaveFor', { project: lastFailedProjectName })
                      : t('welcome.openLatestAutosave')}
                  </button>
                )}
                <button 
                  onClick={clearError}
                  className="text-xs text-sf-text-muted hover:text-sf-text-primary mt-1"
                >
                  {t('welcome.dismiss')}
                </button>
              </div>
            )}
            
            {/* Action Button - simple outlined style */}
            <button
              onClick={selectDefaultProjectsLocation}
              disabled={(!isBrowserSupported && !desktopMode) || isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sf-dark-800 hover:bg-sf-dark-700 border border-sf-dark-500 disabled:bg-sf-dark-700 disabled:border-sf-dark-600 disabled:cursor-not-allowed rounded-lg text-sf-text-secondary font-medium transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FolderOpen className="w-5 h-5" />
              )}
              {t('welcome.chooseProjectsFolder')}
            </button>
            
            <p className="text-xs text-sf-text-muted text-center mt-4">
              {t('welcome.changeLater')}
            </p>
          </div>
        </div>
        </div>
      </div>
    )
  }
  
  // Main welcome screen with recent projects
  // Header content is the same in both hero and no-hero layouts — we
  // just shift its background/positioning depending on whether the hero
  // is visible behind it.
  const headerContent = (
    <>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <ComfyLauncherChip />
          <button
            type="button"
            onClick={() => setApiKeyDialogOpen(true)}
            title={partnerKeyConfigured ? t('launcherChip.apiKeySetHelp') : t('launcherChip.apiKeyNeededHelp')}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors border ${partnerKeyConfigured
              ? 'bg-sf-dark-800 hover:bg-sf-dark-700 border-sf-dark-700 text-sf-text-primary'
              : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-100'
            }`}
          >
            {partnerKeyConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('launcherChip.apiKeySet')}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t('launcherChip.apiKeyNeeded')}</span>
              </>
            )}
          </button>
          {/* Credits chip — self-hides when no API key is configured. */}
          <CreditsChip />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDiscoverOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 text-xs font-medium text-sf-text-secondary transition-colors hover:bg-sf-dark-800 hover:text-sf-text-primary"
          title={t('welcome.discoverHelp')}
        >
          <Film className="h-4 w-4 text-sf-accent" />
          {t('welcome.discover')}
        </button>
        <button
          onClick={() => setGettingStartedOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sf-text-muted transition-colors hover:bg-sf-dark-800 hover:text-sf-text-primary"
          title="Guide: setup, API keys, workflows"
          aria-label="Open guide"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          onClick={openProjectFromPicker}
          className="flex items-center gap-2 px-4 py-2 bg-sf-dark-800 hover:bg-sf-dark-700 border border-sf-dark-500 rounded-lg text-sm text-sf-text-secondary font-medium transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          {t('welcome.openProject')}
        </button>
        <button
          onClick={() => setShowNewProjectDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sf-accent hover:bg-sf-accent-hover border border-sf-accent rounded-lg text-sm text-white font-medium shadow-lg shadow-sf-accent/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('welcome.newProject')}
        </button>
      </div>
    </>
  )

  return (
    <div className="h-screen bg-sf-dark-950 flex flex-col">
      {titleStrip}

      {/* Header bar — always a solid dark strip, never overlaps the image.
          The top border visually separates the header from the native window
          controls strip above it (matches the border below the banner). */}
      <div className="relative z-30 flex-shrink-0 flex items-center justify-between px-8 py-4 bg-sf-dark-950 border-t border-b border-sf-dark-800/60">
        {headerContent}
      </div>

      {mediaPreparationBanner}

      {showHeroBackground ? (
        <div className="welcome-hero relative z-0 flex-shrink-0 h-[62vh] min-h-[420px] max-h-[720px] overflow-hidden select-none bg-black">
          <div className="absolute inset-x-0 top-0 h-px bg-sf-accent" aria-hidden="true" />
          <div className="relative mx-auto flex h-full w-full max-w-6xl items-start px-8 pt-16">
            <div className="flex items-center gap-8 rounded-3xl border border-sf-dark-700 bg-sf-dark-900/85 p-7">
              <img
                src={welcomeBrandIconSrc}
                alt="Monograma MS de Monstruo Studio"
                className="h-36 w-36 flex-shrink-0"
                draggable={false}
              />
              <div className="max-w-xl">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sf-accent">El Monstruo</div>
                <h1 className="mt-3 text-5xl font-bold tracking-[-0.045em] text-sf-text-primary">Monstruo Studio</h1>
                <p className="mt-4 text-base leading-relaxed text-sf-text-secondary">
                  Genera, edita, calibra y entrega historias desde un solo estudio multimedia asistido por IA.
                </p>
                <div className="mt-6 h-0.5 w-16 bg-sf-accent" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Content. When the hero is visible we pull the recents panel up into
          the hero band with a negative top margin so more projects are
          visible above the fold. */}
      <div
        className={`flex-1 overflow-auto px-6 pb-8 ${showHeroBackground
          ? 'relative z-10 -mt-[190px] pt-12'
          : 'py-8'}`}
      >
        <div className="max-w-5xl mx-auto">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-sf-error/20 border border-sf-error/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-sf-error flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-sf-text-primary">{error}</p>
              {canOpenLatestAutosave && (
                <button
                  onClick={openLatestAutosaveForFailedProject}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sf-dark-500 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-primary hover:border-sf-dark-400 hover:text-white transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open latest autosave{lastFailedProjectName ? ` for ${lastFailedProjectName}` : ''}
                </button>
              )}
            </div>
            <button 
              onClick={clearError}
              className="text-xs text-sf-text-muted hover:text-sf-text-primary"
            >
              {t('welcome.dismiss')}
            </button>
          </div>
        )}
        
        {/* Recent Projects Section */}
        <div className="relative isolate mb-8">
          {showHeroBackground && recentProjectsList.length > 0 && (
            <div
              className="pointer-events-none absolute -inset-x-7 -top-5 -bottom-6 z-0 rounded-[32px] border border-white/[0.05] shadow-[0_34px_100px_rgba(0,0,0,0.48)] backdrop-blur-[1.5px]"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(3, 6, 16, 0.74) 0%, rgba(3, 6, 16, 0.62) 46%, rgba(3, 6, 16, 0.34) 74%, rgba(3, 6, 16, 0) 100%)',
              }}
            />
          )}
          <div className="relative z-10">
          <div className="flex items-end justify-between mb-4">
            {/* Dark glass pill behind the title cluster so it stays readable
                over busy hero artwork without becoming a full-width bar. */}
            <div className="inline-flex items-center rounded-full border border-white/10 bg-black/55 px-3 py-1 shadow-lg shadow-black/40 backdrop-blur-md">
              <h2 className="text-[13px] font-semibold text-sf-text-primary tracking-tight leading-none">
                {t('welcome.selectProject')}
              </h2>
            </div>
            {/* Grid / list toggle */}
            {recentProjectsList.length > 0 && (
              <div className="inline-flex items-center gap-0.5 rounded-md border border-sf-dark-700 bg-sf-dark-900 p-0.5" role="group" aria-label={t('welcome.selectProject')}>
                <button
                  type="button"
                  onClick={() => setProjectListViewMode('grid')}
                  title={t('welcome.gridView')}
                  aria-label={t('welcome.gridView')}
                  aria-pressed={projectListViewMode !== 'list'}
                  className={`p-1 rounded transition-colors ${projectListViewMode !== 'list'
                    ? 'bg-sf-dark-700 text-sf-text-primary'
                    : 'text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-dark-800'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setProjectListViewMode('list')}
                  title={t('welcome.listView')}
                  aria-label={t('welcome.listView')}
                  aria-pressed={projectListViewMode === 'list'}
                  className={`p-1 rounded transition-colors ${projectListViewMode === 'list'
                    ? 'bg-sf-dark-700 text-sf-text-primary'
                    : 'text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-dark-800'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          {loadingProjects ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-sf-accent animate-spin" />
            </div>
          ) : recentProjectsList.length === 0 ? (
            <div className="bg-sf-dark-900 border border-sf-dark-700 rounded-xl p-12 text-center">
              <p className="text-sf-text-primary font-medium mb-2">{t('welcome.noRecentProjects')}</p>
              <p className="text-sm text-sf-text-muted mb-6">{t('welcome.createFirstProject')}</p>
              <button
                onClick={() => setShowNewProjectDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sf-dark-800 hover:bg-sf-dark-700 border border-sf-dark-500 rounded-lg text-sm text-sf-text-secondary font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('welcome.newProject')}
              </button>
            </div>
          ) : projectListViewMode === 'list' ? (
            /* List view — compact rows with small thumbnails */
            <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900 shadow-lg shadow-black/40 overflow-hidden divide-y divide-sf-dark-800">
              {recentProjectsList.map((project, index) => {
                const thumbKey = project.path || project.name
                const projectKey = getProjectKey(project)
                const isDuplicating = duplicatingProjectKey === projectKey
                const resolvedThumb = thumbnailUrls[thumbKey]
                const resolution = project.settings?.width && project.settings?.height
                  ? `${project.settings.width}×${project.settings.height}`
                  : null
                return (
                  <div
                    key={project.name + index}
                    className="group relative flex items-center gap-3 pl-2 pr-2 py-2 hover:bg-sf-dark-800/70 transition-colors"
                  >
                    <button
                      onClick={() => handleOpenRecent(project)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent rounded"
                      title={project.name}
                    >
                      {/* Small thumbnail */}
                      <div className="flex-shrink-0 w-20 aspect-video rounded bg-sf-dark-800 overflow-hidden">
                        {resolvedThumb ? (
                          <img src={resolvedThumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-4 h-4 text-sf-text-muted/60" />
                          </div>
                        )}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-sf-text-primary truncate">{project.name}</p>
                        {project.path && (
                          <p className="text-[10px] text-sf-text-muted truncate">{project.path}</p>
                        )}
                      </div>
                      {/* Metadata columns */}
                      <div className="hidden sm:flex flex-shrink-0 items-center gap-4 text-[11px] text-sf-text-muted tabular-nums">
                        {resolution && <span className="w-24 text-right">{resolution}</span>}
                        <span className="w-24 text-right">{formatDate(project.modified)}</span>
                      </div>
                    </button>
                    {/* Duplicate / remove from recent */}
                    <button
                      type="button"
                      onClick={(e) => handleDuplicateProject(e, project)}
                      disabled={!desktopMode || !project.path || Boolean(duplicatingProjectKey)}
                      className="flex-shrink-0 p-1.5 rounded-md hover:bg-sf-dark-700 text-sf-text-muted hover:text-sf-text-primary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                      title={desktopMode && project.path ? 'Duplicate project and open copy' : 'Duplicate requires a local project folder'}
                    >
                      {isDuplicating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => openDeleteProjectDialog(e, project)}
                      className="flex-shrink-0 p-1.5 rounded-md hover:bg-sf-error/80 text-sf-text-muted hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete or remove project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Grid view — thumbnail cards */
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
            >
              {recentProjectsList.map((project, index) => {
                const thumbKey = project.path || project.name
                const projectKey = getProjectKey(project)
                const isDuplicating = duplicatingProjectKey === projectKey
                const resolvedThumb = thumbnailUrls[thumbKey]
                const resolution = project.settings?.width && project.settings?.height
                  ? `${project.settings.width}×${project.settings.height}`
                  : null
                return (
                  <div
                    key={project.name + index}
                    className="group relative bg-sf-dark-900 border border-sf-dark-700 rounded-lg overflow-hidden shadow-lg shadow-black/40 hover:border-sf-accent/70 hover:shadow-xl hover:shadow-sf-accent/10 hover:-translate-y-0.5 transition-all duration-150 text-left"
                  >
                    <button
                      onClick={() => handleOpenRecent(project)}
                      className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent"
                      title={project.name}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-sf-dark-800 relative overflow-hidden">
                        {resolvedThumb ? (
                          <img
                            src={resolvedThumb}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-5 h-5 text-sf-text-muted/60" />
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-sf-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 bg-sf-accent rounded-full flex items-center justify-center">
                            <FolderOpen className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="px-2.5 py-1.5">
                        <p className="text-[12px] font-medium text-sf-text-primary truncate">
                          {project.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-sf-text-muted mt-0.5 truncate">
                          <span>{formatDate(project.modified)}</span>
                          {resolution && (
                            <>
                              <span className="opacity-50">•</span>
                              <span>{resolution}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Duplicate / remove from recent */}
                    <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateProject(e, project)}
                        disabled={!desktopMode || !project.path || Boolean(duplicatingProjectKey)}
                        className="p-1 rounded-md bg-sf-dark-900/90 hover:bg-sf-dark-700 text-sf-text-muted hover:text-sf-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                        title={desktopMode && project.path ? 'Duplicate project and open copy' : 'Duplicate requires a local project folder'}
                      >
                        {isDuplicating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openDeleteProjectDialog(e, project)}
                        className="p-1 rounded-md bg-sf-dark-900/90 hover:bg-sf-error/80 text-sf-text-muted hover:text-white"
                        title="Delete or remove project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
        
        {/* Projects Location Info */}
        <div className="text-center text-xs text-sf-text-muted">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 shadow-lg shadow-black/50 backdrop-blur-md">
            <span>{t('welcome.projectsSavedTo')}</span>
            <span className="text-sf-text-secondary">{defaultProjectsLocation || t('common.notSet')}</span>
            <button 
              onClick={selectDefaultProjectsLocation}
              className="ml-1 text-sf-accent hover:underline"
            >
              {t('common.change')}
            </button>
          </p>
        </div>
        </div>{/* /max-w-5xl */}
      </div>
      
      {/* New Project Dialog */}
      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
      />

      {/* Getting Started Modal */}
      <GettingStartedModal
        isOpen={gettingStartedOpen}
        onClose={() => setGettingStartedOpen(false)}
        projectName={null}
        defaultProjectsLocation={defaultProjectsLocation}
        onOpenSettings={(section) => {
          setSettingsInitialSection(section || null)
          setSettingsOpen(true)
          setGettingStartedOpen(false)
        }}
        onNavigate={null}
      />

      {discoverOpen && (
        <Suspense
          fallback={(
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75">
              <div className="flex items-center gap-2 rounded-xl border border-sf-dark-700 bg-sf-dark-900 px-4 py-3 text-sm text-sf-text-secondary shadow-2xl">
                <Loader2 className="h-4 w-4 animate-spin text-sf-accent" />
                {t('welcome.discoverLoading')}
              </div>
            </div>
          )}
        >
          <DiscoverModal isOpen={discoverOpen} onClose={() => setDiscoverOpen(false)} />
        </Suspense>
      )}

      {/* Settings Modal (reachable from Getting Started while no project is open) */}
      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          initialSection={settingsInitialSection}
        />
      )}

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onClose={() => setApiKeyDialogOpen(false)}
        onSaved={(value) => setPartnerKeyConfigured(Boolean(String(value || '').trim()))}
      />

      {deleteProjectDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70" onClick={closeDeleteProjectDialog}>
          <div
            className="w-full max-w-lg mx-4 rounded-xl border border-sf-dark-600 bg-sf-dark-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-sf-dark-700">
              <h3 className="text-sm font-medium text-sf-text-primary">Delete project?</h3>
              <button
                type="button"
                onClick={closeDeleteProjectDialog}
                disabled={isDeletingProject}
                className="p-1 rounded hover:bg-sf-dark-700 text-sf-text-muted disabled:opacity-50"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-sm text-sf-text-primary">
                  What do you want to do with <span className="font-medium">{deleteProjectDialog.name}</span>?
                </p>
                {deleteProjectDialog.path && (
                  <p className="mt-1 text-[11px] text-sf-text-muted break-all">{deleteProjectDialog.path}</p>
                )}
              </div>
              <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-800/60 p-3 text-[11px] text-sf-text-secondary">
                <p>
                  <span className="font-medium text-sf-text-primary">Remove from list</span> only hides this project from the selection screen.
                </p>
                <p className="mt-1">
                  <span className="font-medium text-sf-text-primary">Move to Recycle Bin</span> moves the whole project folder, including assets, renders, autosaves, and cache files.
                </p>
              </div>
              {deleteProjectError && (
                <div className="rounded border border-sf-error/40 bg-sf-error/10 px-3 py-2 text-[11px] text-sf-error">
                  {deleteProjectError}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-sf-dark-700 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteProjectDialog}
                disabled={isDeletingProject}
                className="px-3 py-1.5 rounded bg-sf-dark-700 hover:bg-sf-dark-600 text-sf-text-secondary text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveProjectFromList}
                disabled={isDeletingProject}
                className="px-3 py-1.5 rounded bg-sf-dark-700 hover:bg-sf-dark-600 text-sf-text-primary text-xs disabled:opacity-50"
              >
                Remove from list
              </button>
              <button
                type="button"
                onClick={handleTrashProjectFolder}
                disabled={isDeletingProject || !deleteProjectDialog.path || !desktopMode}
                className="px-3 py-1.5 rounded bg-sf-error hover:bg-red-500 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingProject ? 'Moving...' : 'Move to Recycle Bin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WelcomeScreen
