const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const sha256 = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex')

const VISIBLE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css'])
const VISIBLE_ROOTS = ['src', 'electron', 'public']
const LEGACY_VISIBLE_ALLOWLIST = new Map([
  ['electron/comfyLauncher.js', ["'User-Agent': 'Velorn-Launcher/1.0'"]],
  ['electron/comfyui-injected/comfystudio_bridge/web/js/comfystudio_bridge.js', ['name: "Velorn.Bridge"']],
  ['src/services/comfyui.js', ["'Velorn Output Resize'", "'ComfyStudio Output Resize'"]],
  ['src/components/SettingsModal.jsx', ['derived from the Velorn open-source project']],
])

function walk(relative) {
  const absolute = path.join(ROOT, relative)
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name)
    return entry.isDirectory() ? walk(child) : [child]
  })
}

test('distribution metadata declares Monstruo Studio while npm compatibility name stays stable', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'velorn')
  assert.equal(pkg.build.productName, 'Monstruo Studio')
  assert.equal(pkg.build.appId, 'mx.hivecom.monstruostudio')
  assert.equal(pkg.build.mac.icon, 'build/icon.icns')
  assert.equal(pkg.build.win.icon, 'build/icon.ico')
})

test('A2 is the single production icon source and required production derivatives exist', () => {
  const expected = sha256('docs/monstruo-studio/brand/monstruo-studio-ms-a2-optical.svg')
  assert.equal(sha256('public/monstruo-studio-app-icon.svg'), expected)
  assert.equal(sha256('build/monstruo-studio-app-icon.svg'), expected)
  for (const relative of ['build/icon.png', 'build/icon.icns', 'build/icon.ico']) {
    assert.ok(fs.statSync(path.join(ROOT, relative)).size > 0, `${relative} must be non-empty`)
  }
  const svg = read('build/monstruo-studio-app-icon.svg')
  assert.match(svg, /#000000/i)
  assert.match(svg, /#00E5FF/i)
  assert.doesNotMatch(svg, /filter=|feDropShadow|glow/i)
})

test('visible source contains only four explicit historical compatibility/provenance exceptions', () => {
  const findings = []
  for (const base of VISIBLE_ROOTS) {
    for (const relative of walk(base)) {
      if (!VISIBLE_EXTENSIONS.has(path.extname(relative))) continue
      const text = read(relative)
      for (const match of text.matchAll(/\b(?:Velorn|ComfyStudio)\b/g)) {
        findings.push({ relative, match: match[0], line: text.slice(0, match.index).split('\n').length, text })
      }
    }
  }

  const unexpected = findings.filter(({ relative, match, line, text }) => {
    const lineText = text.split('\n')[line - 1]
    const allowed = LEGACY_VISIBLE_ALLOWLIST.get(relative) || []
    return !allowed.some((needle) => lineText.includes(needle))
  })
  assert.deepEqual(unexpected.map(({ relative, match, line }) => ({ relative, match, line })), [])
  assert.equal(findings.length, 5)
})

test('MCP server keeps its stable machine ID and exact 130-tool contract while exposing the new title', () => {
  const { createComfyStudioMcpServer } = require('../electron/mcpServer')
  const server = createComfyStudioMcpServer({ version: 'test' })
  const actual = server.tools.map((tool) => tool.name).sort()
  const expected = JSON.parse(read('tests/fixtures/monstruo-studio-mcp-tool-ids.json'))
  assert.deepEqual(actual, expected)
  assert.equal(actual.length, 130)
  for (const required of ['get_project', 'list_velorn_workflows', 'inspect_velorn_workflow']) {
    assert.ok(actual.includes(required), `missing MCP tool ${required}`)
  }
  const source = read('electron/mcpServer.js')
  assert.match(source, /serverInfo:\s*\{\s*name: 'velorn',\s*title: 'Monstruo Studio',/)
  assert.match(source, /const MCP_PROTOCOL_VERSION = '2024-11-05'/)
  assert.match(source, /list_comfystudio_workflows/)
  assert.match(source, /inspect_comfystudio_workflow/)
})

test('legacy protocols, project filenames, workflow markers, and storage namespaces remain present', () => {
  assert.match(read('src/services/fileSystem.js'), /const PROJECT_FILENAME = 'project\.comfystudio'/)
  assert.match(read('src/services/fileSystem.js'), /const PROJECT_FILENAME_LEGACY = 'project\.storyflow'/)
  assert.match(read('electron/main.js'), /comfystudio:/)
  assert.match(read('src/services/comfyui.js'), /VELORN_INPUT_IMAGE/)
  assert.match(read('src/services/comfyui.js'), /COMFYSTUDIO_/)
  assert.match(read('src/services/comfyui.js'), /Monstruo Studio Output Resize/)
  assert.match(read('src/services/comfyui.js'), /Velorn Output Resize/)
  assert.match(read('src/services/comfyui.js'), /ComfyStudio Output Resize/)
  assert.match(read('.mcp.json'), /"velorn"/)
  assert.match(read('.mcp.json'), /127\.0\.0\.1:19790\/mcp/)
})

test('shell, splash, Welcome and About use the canonical product identity without inherited art', () => {
  assert.match(read('index.html'), /<title>Monstruo Studio/)
  assert.match(read('public/splash.html'), /monstruo-studio-app-icon\.svg/)
  assert.match(read('src/components/WelcomeScreen.jsx'), /Monograma MS de Monstruo Studio/)
  assert.doesNotMatch(read('src/components/WelcomeScreen.jsx'), /velorn-home-balanced|velorn-project-selection|HeroVideoLoop/)
  assert.doesNotMatch(read('src/components/BottomBar.jsx'), /linearGradient|DropShadow|glow/)
  assert.match(read('src/components/SettingsModal.jsx'), /About Monstruo Studio/)
  assert.match(read('src/index.css'), /--sf-accent: 0 229 255;/)
  assert.match(read('src/index.css'), /font-family: 'Space Grotesk'/)
})
