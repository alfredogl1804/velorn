import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const serviceSource = await readFile(join(process.cwd(), 'src/services/fileSystem.js'), 'utf8')
const serviceUrl = `data:text/javascript;base64,${Buffer.from(serviceSource).toString('base64')}`
const { loadProject, saveProject } = await import(serviceUrl)

function installElectronFileSystemMock() {
  globalThis.window = {
    electronAPI: {
      isElectron: true,
      pathJoin: async (...parts) => join(...parts),
      exists: async (target) => {
        try { await stat(target); return true } catch { return false }
      },
      readFile: async (target) => {
        try { return { success: true, data: await readFile(target, 'utf8') } }
        catch (error) { return { success: false, error: error.message } }
      },
      writeFile: async (target, data) => {
        try { await writeFile(target, data); return { success: true } }
        catch (error) { return { success: false, error: error.message } }
      },
      createDirectory: async (target) => { await mkdir(target, { recursive: true }); return { success: true } },
      listDirectory: async (target) => {
        try {
          const names = await readdir(target)
          const items = await Promise.all(names.map(async (name) => {
            const fullPath = join(target, name)
            const info = await stat(fullPath)
            return {
              name,
              path: fullPath,
              isFile: info.isFile(),
              modified: info.mtime.toISOString(),
            }
          }))
          return { success: true, items }
        } catch (error) {
          return { success: false, error: error.message, items: [] }
        }
      },
      deleteFile: async (target) => { await rm(target, { force: true }); return { success: true } },
    },
  }
}

const fixture = {
  name: 'Monstruo Studio compatibility fixture',
  settings: { width: 1920, height: 1080, fps: 24 },
  assets: [{ id: 'asset-1', name: 'fixture.png', type: 'image', relativePath: 'assets/images/fixture.png' }],
  timelines: [{ id: 'timeline-1', name: 'Main', clips: [{ id: 'clip-1', assetId: 'asset-1', startTime: 0, duration: 1 }] }],
}

test('opens and saves the physical project.comfystudio contract without renaming it', async () => {
  installElectronFileSystemMock()
  const root = await mkdtemp(join(tmpdir(), 'monstruo-studio-project-'))
  try {
    await mkdir(join(root, 'autosave'), { recursive: true })
    await writeFile(join(root, 'project.comfystudio'), JSON.stringify(fixture))
    assert.deepEqual(await loadProject(root), fixture)

    await saveProject(root, { ...fixture, name: 'Saved by Monstruo Studio' })
    const saved = JSON.parse(await readFile(join(root, 'project.comfystudio'), 'utf8'))
    assert.equal(saved.name, 'Saved by Monstruo Studio')
    assert.equal(saved.timelines[0].clips[0].assetId, 'asset-1')
    assert.deepEqual(saved.assets[0], fixture.assets[0])
    await assert.rejects(stat(join(root, 'project.monstruostudio')))
    const snapshots = await readdir(join(root, 'autosave'))
    assert.ok(snapshots.some((name) => /^project-.*\.comfystudio$/.test(name)))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('opens the legacy project.storyflow fallback unchanged', async () => {
  installElectronFileSystemMock()
  const root = await mkdtemp(join(tmpdir(), 'monstruo-studio-storyflow-'))
  try {
    await writeFile(join(root, 'project.storyflow'), JSON.stringify(fixture))
    assert.deepEqual(await loadProject(root), fixture)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
