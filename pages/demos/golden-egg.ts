// ══════════════════════════════════════════════════════════════
// GOLDEN EDITOR × PRETEXT — Inline Worldtext Editor
//
// Derived from GOLDEN SHIELD. Every wall surface is now an
// editable text panel. Click any wall in LiDAR mode to open
// the inline editor. Edits flow live into the walls.
//
//   1. WALL EDITOR: Click center wall face to open floating
//      textarea. Edits update MOUNTAIN_LORE in real time.
//
//   2. PERSISTENCE: All edits auto-save to localStorage.
//      Reload the page and your text is still on the walls.
//
//   3. LIDAR MODE: First-person text raycaster. WASD to move.
//      Walls display Pretext-laid-out text at close range.
//
//   4. COALESCENCE + PARTICLES: Same visual system.
// ══════════════════════════════════════════════════════════════

import {
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ═══════════════════════════════════════════════════════════
// LLM TEXT GENERATION ENGINE — Live Worldtext expansion
// Adapted from trout.html's cognitive engine.
// Press 'G' to generate new zone-specific lore from an LLM.
// Supports Ollama (local) and OpenAI-compatible endpoints.
// Generated text is appended to MOUNTAIN_LORE and re-prepared
// by Pretext, making walls expand live as you explore.
// ═══════════════════════════════════════════════════════════
let llmUrl = 'https://api.openai.com/v1/chat/completions'
let llmModel = 'gpt-4o'
let llmKey = ''
let llmActive = false
let llmGenerating = false
let llmStatus = ''

const WORLDTEXT_SYSTEM = `You are a Worldtext Architect. Given a zone name and existing text, generate 5-8 new lines of dense, specific prose that extend the zone's content. Use concrete nouns, proper names, measurements, materials, and sensory detail. Each line should be a complete thought. Never use: whispers, echoes, dance, weave, tapestry, shimmer, ancient wisdom, mystical. Output one line per line.`

async function llmGenerate(zone: string, existingSample: string): Promise<string[]> {
  if (!llmUrl || llmGenerating) return []
  llmGenerating = true
  llmStatus = 'GENERATING...'

  const zoneLabel = ZONE_LABELS[zone] || zone
  const prompt = `Generate new text for zone "${zoneLabel}".\n\nExisting sample:\n${existingSample}\n\nGenerate 5-8 NEW, UNIQUE lines extending this content. Each line should be a complete thought. Focus on: concrete nouns, observable actions, material vocabulary.`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (llmKey) headers['Authorization'] = `Bearer ${llmKey}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(llmUrl, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: WORLDTEXT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.85,
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    const lines = text.split('\n').map((l: string) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter((l: string) => l.length > 10)
    llmStatus = `+${lines.length} LINES`
    llmGenerating = false
    llmActive = true
    return lines
  } catch (e: any) {
    llmStatus = `ERROR: ${e.message}`
    llmGenerating = false
    return []
  }
}

function injectLore(zone: string, newLines: string[]): void {
  if (!MOUNTAIN_LORE[zone]) MOUNTAIN_LORE[zone] = []
  if (newLines.length === 0) return
  for (const line of newLines) {
    MOUNTAIN_LORE[zone]!.push(line)
  }
  LORE_FULL[zone] = MOUNTAIN_LORE[zone]!.join(' ')
  wallLineCache.clear()
  editorPersist()
}

// ═══════════════════════════════════════════════════════════
// DOCKED EDITOR BAR — no modal, no apply button
// Press E or click center wall → bar slides up from bottom.
// Every keystroke auto-saves to MOUNTAIN_LORE + localStorage.
// Walls re-render in real time as you type.
// ═══════════════════════════════════════════════════════════
let editorActive = false
let editorZone = ''

function editorOpen(zoneKey: string): void {
  // If already editing this zone, just focus
  if (editorActive && editorZone === zoneKey) {
    ;(document.getElementById('editor-bar-textarea') as HTMLTextAreaElement).focus()
    return
  }

  editorActive = true
  editorZone = zoneKey

  const bar = document.getElementById('editor-bar')!
  const ta = document.getElementById('editor-bar-textarea') as HTMLTextAreaElement
  const zoneEl = document.getElementById('editor-bar-zone')!
  const infoEl = document.getElementById('editor-bar-info')!

  // Populate with current zone lore (one line per array entry)
  ta.value = (MOUNTAIN_LORE[zoneKey] || []).join('\n')

  const label = ZONE_LABELS[zoneKey] || zoneKey.toUpperCase()
  zoneEl.textContent = `✎ ${label}`
  infoEl.textContent = `${ta.value.split(/\s+/).filter(Boolean).length} words · auto-saving`

  bar.classList.add('active')
  setTimeout(() => ta.focus(), 50)

  // Update status bar
  const sbLlm = document.getElementById('sb-llm')
  if (sbLlm) sbLlm.textContent = `EDITING ${label}`
}

function editorClose(): void {
  if (!editorActive) return
  // Final save before closing
  editorFlush()
  editorActive = false
  editorZone = ''
  document.getElementById('editor-bar')!.classList.remove('active')
  const sbLlm = document.getElementById('sb-llm')
  if (sbLlm) sbLlm.textContent = '—'
}

// Flush current textarea content to MOUNTAIN_LORE + localStorage (synchronous)
function editorFlush(): void {
  if (!editorActive || !editorZone) return
  const ta = document.getElementById('editor-bar-textarea') as HTMLTextAreaElement
  const text = ta.value.trim()
  const lines = text.split('\n').filter(l => l.trim().length > 0)

  MOUNTAIN_LORE[editorZone] = lines.length > 0 ? lines : ['(empty)']
  LORE_FULL[editorZone] = MOUNTAIN_LORE[editorZone]!.join(' ')
  PANEL_METADATA[editorZone] = { lastEditTime: Date.now() }

  // Extract [[links]] to auto-populate CLUE_GRAPH
  const linkRegex = /\[\[(.*?)\]\]/g
  let match
  let addedLinks = false
  while ((match = linkRegex.exec(text)) !== null) {
    const word = match[1]!.trim().toLowerCase()
    if (word && !CLUE_GRAPH[word]) {
      CLUE_GRAPH[word] = {
        word, color: '#0ca', zone: editorZone,
        connections: [], clue: `Authored in ${ZONE_LABELS[editorZone] || editorZone}`,
        collected: true
      }
      addedLinks = true
    }
  }
  if (addedLinks) rebuildHotWords()

  wallLineCache.clear()
  prepCache.clear()
  editorPersist()
}

// Auto-save on every keystroke (debounced 150ms for performance)
let editorDebounce: ReturnType<typeof setTimeout> | null = null
function editorLiveUpdate(): void {
  if (!editorActive || !editorZone) return
  if (editorDebounce) clearTimeout(editorDebounce)
  editorDebounce = setTimeout(() => {
    editorFlush()
    // Update word count
    const ta = document.getElementById('editor-bar-textarea') as HTMLTextAreaElement
    const infoEl = document.getElementById('editor-bar-info')
    if (infoEl) {
      const wc = ta.value.split(/\s+/).filter(Boolean).length
      infoEl.textContent = `${wc} words · saved ✓`
      setTimeout(() => { if (infoEl) infoEl.textContent = `${wc} words · auto-saving` }, 1200)
    }
  }, 150)
}

// ── PERSISTENCE — localStorage ──
const STORAGE_KEY = 'golden-egg-lore'

function editorPersist(): void {
  try { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOUNTAIN_LORE)) 
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(PANEL_METADATA))
  } catch { /* quota */ }
}

function editorRestore(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as Record<string, string[]>
      for (const [key, lines] of Object.entries(data)) {
        if (Array.isArray(lines) && lines.length > 0) {
          MOUNTAIN_LORE[key] = lines
          LORE_FULL[key] = lines.join(' ')
        }
      }
    }
    const savedMeta = localStorage.getItem(META_STORAGE_KEY)
    if (savedMeta) {
      const metaData = JSON.parse(savedMeta)
      for (const [key, val] of Object.entries(metaData)) {
         PANEL_METADATA[key] = val as any
      }
    }
    wallLineCache.clear()
    prepCache.clear()
  } catch { /* corrupt — ignore */ }
}

// ── MARKDOWN EXPORT — all zones as a single .md file ──
function exportMarkdown(): void {
  const zoneKeys = Object.keys(MOUNTAIN_LORE)
  let md = `# Golden Egg — Worldtext Export\n\n`
  md += `> Exported ${new Date().toISOString()}\n\n---\n\n`

  for (const key of zoneKeys) {
    const label = ZONE_LABELS[key] || key.toUpperCase()
    const lines = MOUNTAIN_LORE[key] || []
    md += `## ${label}\n\n`
    md += lines.join('\n\n') + '\n\n'

    // Add cross-references if any hot words link to this zone
    const links: string[] = []
    for (const [word, node] of Object.entries(CLUE_GRAPH)) {
      if (node.zone === key) links.push(`- **${word}**: ${node.clue}`)
    }
    if (links.length > 0) {
      md += `### Links\n\n${links.join('\n')}\n\n`
    }
    md += `---\n\n`
  }

  // Download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `golden-egg-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// Restore on load
editorRestore()

// ═══════════════════════════════════════════════════════════
// DYNAMIC WORLDTEXT — accepts any text corpus
// The default lore explains the system. Upload your own text
// via Sheet A to replace it. Upload a scene graph to create
// hyperportals. Works with Homer, recipes, constitutions, etc.
// ═══════════════════════════════════════════════════════════

const MOUNTAIN_LORE: Record<string, string[]> = {}
for (let i = 1; i <= 16; i++) {
  MOUNTAIN_LORE[`panel_${i}`] = i === 1 
    ? [
      "GOLDEN EGG · EMPTY FIELD",
      "This is Panel 1. You are standing in an empty structural field.",
      "Click any monolith to edit it. Type your text. Build your architecture.",
      "[[hyperlinks]] still work. Blank canvases await."
    ]
    : [`(blank panel ${i})`]
}

// ── MOUNTAIN MEDIA (Volatile Session Audio/Video) ──
const MOUNTAIN_MEDIA: Record<string, { type: 'image' | 'video', url: string, el?: HTMLImageElement | HTMLVideoElement }> = {}

// ── PANEL METADATA (Spatio-Temporal Tracking) ──
const PANEL_METADATA: Record<string, { lastEditTime: number }> = {}
const META_STORAGE_KEY = 'golden-egg-meta'

const LORE_FULL: Record<string, string> = {}
for (const [k, v] of Object.entries(MOUNTAIN_LORE)) {
  LORE_FULL[k] = v.join(' ')
}

// CSPR Evidence — starts empty
const EVIDENCE: Record<string, { itemNo: string; entityClass: string; attributes: string; relationship: string; zone: string }> = {}

const ZONE_LABELS: Record<string, string> = {}
const ZONES: Record<string, { name: string; color: string; minR: number; maxR: number; flavor: string }> = {}

// Generate 16 architecture panels
const gridColors = ['#daa520', '#4682b4', '#cd853f', '#5f9ea0', '#9370db', '#8fbc8f', '#bc8f8f', '#f4a460']
for (let i = 1; i <= 16; i++) {
  const keyStr = `panel_${i}`
  ZONE_LABELS[keyStr] = `PANEL ${i}`
  ZONES[keyStr.toUpperCase()] = {
    name: `PANEL ${i}`,
    color: gridColors[i % gridColors.length]!,
    minR: 0, maxR: 999, // Radii logic will be ignored/replaced by specific map placement
    flavor: `PANEL ${i}`
  }
}

// Allow renaming zones dynamically
function renameZone(key: string, newLabel: string): void {
  ZONE_LABELS[key] = newLabel
  const zk = key.toUpperCase()
  if (ZONES[zk]) {
    ZONES[zk]!.name = newLabel
    ZONES[zk]!.flavor = newLabel
  }
}

// Lerp between two hex colors
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

function zoneForRadius(r: number) {
  // Dynamic: iterate all zones sorted by maxR
  const entries = Object.values(ZONES).filter(Boolean).sort((a, b) => a!.maxR - b!.maxR)
  for (const z of entries) {
    if (z && r < z.maxR) return z
  }
  return entries[entries.length - 1] || Object.values(ZONES)[0]!
}

function loreKeyForZone(zone: typeof ZONES[string]): string {
  for (const [key, z] of Object.entries(ZONES)) {
    if (z === zone) return key.toLowerCase()
  }
  return Object.keys(ZONES)[0]?.toLowerCase() || 'unknown'
}

// ═══ CLUE GRAPH — starts empty, populated via Sheet A upload ═══
interface ClueNode {
  word: string
  color: string
  zone: string
  connections: string[]
  clue: string
  collected: boolean
}

const CLUE_GRAPH: Record<string, ClueNode> = {}

// HOT_WORDS — rebuilt whenever graph changes
const HOT_WORDS: Record<string, string> = {}
function rebuildHotWords(): void {
  for (const k of Object.keys(HOT_WORDS)) delete HOT_WORDS[k]
  for (const [key, node] of Object.entries(CLUE_GRAPH)) {
    HOT_WORDS[key] = node.color
  }
}

// ── GRID STATE ──
const GRID_SIZE = 32
const CENTER = 16

interface CellState {
  x: number; y: number; r: number
  zone: typeof ZONES[string]
  text: string
  color: string
  height: number
}

const gridState: CellState[][] = []

function compileCell(x: number, y: number): CellState {
  const dx = x - CENTER, dy = y - CENTER
  const r = Math.sqrt(dx * dx + dy * dy)
  const zone = zoneForRadius(r)
  const key = loreKeyForZone(zone)
  const content = MOUNTAIN_LORE[key]!
  const text = content[Math.floor(Math.abs(x + y * 3)) % content.length]!
  const height = Math.sin(x / 2) + Math.cos(y / 2) * 2
  return { x, y, r, zone, text, color: zone.color, height }
}

for (let y = 0; y < GRID_SIZE; y++) {
  gridState[y] = []
  for (let x = 0; x < GRID_SIZE; x++) {
    gridState[y]![x] = compileCell(x, y)
  }
}

// ── CLICKABLE HOT WORDS — hyperlinks in the worldtext ──
interface HotWordHit {
  x: number; y: number; w: number; h: number
  word: string; color: string; zone: string
}
let hotWordHits: HotWordHit[] = []
let hoveredHotWord: HotWordHit | null = null

// ═══ ACTIVE PURSUIT — which clue the player is currently following ═══
let activePursuit: ClueNode | null = null
let collectedClues: ClueNode[] = []
// ═══ Zone navigation positions (populated by generateCircularMap) ═══
const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {}

// Navigate to a zone: switch to LiDAR + glide to the room
function navigateToZone(zone: string): void {
  const pos = ZONE_POSITIONS[zone]
  if (!pos) return
  // Switch to LiDAR if not already
  if (engineMode !== 'LIDAR') setMode('LIDAR')
  // Close any open sheets
  document.querySelectorAll('.sheet.active').forEach(s => s.classList.remove('active'))
  // Glide to target
  playerGlideTarget = { x: pos.x + 0.5, y: pos.y + 0.5 }
}

// Hot word click handler — the investigation mechanic
function onHotWordClick(hit: HotWordHit): void {
  const word = hit.word
  const lowerWord = word.toLowerCase()

  // Look up in CLUE_GRAPH (case-insensitive match)
  let node: ClueNode | null = null
  for (const [key, n] of Object.entries(CLUE_GRAPH)) {
    if (key.toLowerCase() === lowerWord || word === key) { node = n; break }
  }

  if (node) {
    // Mark collected
    if (!node.collected) {
      node.collected = true
      collectedClues.push(node)
    }
    // Set as active pursuit — this drives thread rendering
    activePursuit = node

    // Show clue panel
    showCluePanel(node)

    // ═══ NAVIGATE — teleport to the word's home zone in LiDAR ═══
    navigateToZone(node.zone)

    // Any clue node click can trigger LLM generation for its zone
    if (llmUrl && !llmGenerating) {
      const sample = (MOUNTAIN_LORE[node.zone] || []).slice(-3).join('\n')
      llmGenerate(node.zone, sample).then(lines => {
        if (lines.length > 0) { injectLore(node.zone, lines); prepCache.clear() }
      })
    }
    return
  }

  // Fallback: flash in scanner output
  const out = document.getElementById('scanner-output')
  if (out) { out.innerText = `KEYWORD: ${word.toUpperCase()}`; out.style.color = hit.color }
}

// ═══ CLUE DISPLAY — shows clue text in the scanner output ═══
function showCluePanel(node: ClueNode): void {
  const connList = node.connections.map(c => {
    const cn = CLUE_GRAPH[c]
    return cn?.collected ? `✓${c}` : `○${c}`
  }).join(' · ')
  const out = document.getElementById('scanner-output')
  if (out) {
    out.innerText = `${node.word.toUpperCase()} → ${node.clue} [${connList}]`
    out.style.color = node.color
  }
}

// ── SKY STARS (letters from the source text) ──
interface SkyStar { x: number; y: number; size: number; brightness: number; speed: number; phase: number; color: string; char: string }
const skyStars: SkyStar[] = []
function seedStars(): void {
  skyStars.length = 0
  const starColors = ['#ffffff', '#ccd8ff', '#aabbff', '#ffeedd', '#ffddaa', '#ddeeff']
  const halfH = Math.floor(ch / 2)
  // Harvest characters from the worldtext to use as star glyphs
  const allText = Object.values(MOUNTAIN_LORE).flat().join(' ').replace(/\s+/g, '')
  const chars = allText.length > 0 ? allText : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = 0; i < 180; i++) {
    skyStars.push({
      x: Math.random() * cw,
      y: Math.random() * halfH * 0.92,
      size: Math.random() < 0.15 ? 8 : 6,
      brightness: 0.15 + Math.random() * 0.6,
      speed: 0.3 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)]!,
      char: chars[Math.floor(Math.random() * chars.length)]!,
    })
  }
}


// ── PARTICLES ──
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
const particles: Particle[] = []
function spawnParticle(): void {
  if (particles.length > 80) return
  particles.push({
    x: Math.random() * 2000 - 500,
    y: Math.random() * 1200 - 200,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.5 - 0.1,
    life: 0,
    maxLife: 200 + Math.random() * 300,
    size: 1 + Math.random() * 2,
  })
}

// ── CANVAS ──
const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const mmCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement
const mmCtx = mmCanvas.getContext('2d')!
let mmMinimized = false
mmCanvas.addEventListener('click', () => {
  mmMinimized = !mmMinimized
  mmCanvas.style.opacity = mmMinimized ? '0.3' : '1'
  mmCanvas.style.width = mmMinimized ? '20px' : ''
  mmCanvas.style.height = mmMinimized ? '20px' : ''
})
const ptReaderCanvas = document.getElementById('pt-reader-canvas') as HTMLCanvasElement
const ptReaderCtx = ptReaderCanvas.getContext('2d')!

// LiDAR canvas
const lidarCanvas = document.getElementById('lidar-canvas') as HTMLCanvasElement
const lidarCtx = lidarCanvas.getContext('2d')!

let cw = 0, ch = 0, cx = 0, cy = 0
function resize(): void {
  canvas.width = canvas.parentElement!.offsetWidth
  canvas.height = canvas.parentElement!.offsetHeight
  lidarCanvas.width = canvas.width
  lidarCanvas.height = canvas.height
  cw = canvas.width; ch = canvas.height
  cx = cw / 2; cy = ch / 2
  seedStars()
}
resize()
window.addEventListener('resize', resize)

// ── STATE ──
let zoom = 1.2, panX = 0, panY = 0
let viewMode: 'TOPO' | 'ORBIT' = 'TOPO'
let engineMode: 'GRID' | 'LIDAR' = 'GRID'
let isDragging = false
let startX = 0, startY = 0, lastX = 0, lastY = 0
let mousePos: { x: number; y: number } | null = null
let hoverCell: (CellState & { sx: number; sy: number }) | null = null
let time = 0

// Config
let charSize = 10
let coalesceRadius = 120
let waveSpeed = 40
let showRelations = true

// LiDAR player
const player = { x: 4.5, y: 4.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 }
let playerGlideTarget: { x: number; y: number } | null = null // smooth movement target
const keys: Record<string, boolean> = {}

// ── DYNAMIC CIRCULAR LIDAR MAP ──
// Generated on import based on zone count. Each zone = one room in a circle.
// No repeated text. Hub at center, corridors to each room.

let LIDAR_PLAN: string[] = []
let LIDAR_H = 0
let LIDAR_W = 0
let WALL_LORE: Record<string, string> = {}
let MAP_CENTER = 0

function isWalkable(ch: string | undefined): boolean {
  return ch === '.'
}

function generateEmptyFieldMap(zoneKeys: string[]): void {
  const N = zoneKeys.length || 1 // We expect at least 1 panel
  const spacing = 14
  const cols = Math.max(4, Math.ceil(Math.sqrt(N)))
  const sz = Math.max(65, 22 + cols * spacing)
  const center = Math.floor(sz / 2)

  // Initialize grid — entirely open
  const grid: string[][] = Array.from({ length: sz }, () =>
    Array.from({ length: sz }, () => '.')
  )
  
  // ═══ BUILD PANEL MATRIX ═══
  const startOffset = 11

  // Map 0 to N-1 to x,y in a grid
  for (let i = 0; i < N; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const px = startOffset + col * spacing
    const py = startOffset + row * spacing

    // Build a 3-block wide wall at [px, py]
    // Horizontal structure:
    const ch = String.fromCharCode(i + 161)
    grid[py]![px - 1] = ch
    grid[py]![px] = ch
    grid[py]![px + 1] = ch
  }

  // ═══ OUTER BOUNDARY ═══
  for (let i = 0; i < sz; i++) {
    grid[0]![i] = '#'
    grid[sz - 1]![i] = '#'
    grid[i]![0] = '#'
    grid[i]![sz - 1] = '#'
  }

  // Update module-level state
  LIDAR_PLAN = grid.map(row => row.join(''))
  LIDAR_H = sz
  LIDAR_W = sz
  MAP_CENTER = center

  // Rebuild WALL_LORE
  WALL_LORE = {}
  for (let z = 0; z < N; z++) {
    WALL_LORE[String.fromCharCode(z + 161)] = zoneKeys[z]!
  }

  // Rebuild ZONE_POSITIONS (target the space right below each panel)
  for (const key of Object.keys(ZONE_POSITIONS)) {
    delete ZONE_POSITIONS[key]
  }
  for (let i = 0; i < N; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const px = startOffset + col * spacing
    const py = startOffset + row * spacing
    ZONE_POSITIONS[zoneKeys[i]!] = { x: px, y: py + 2 }
  }

  // Set player (don't reset heavily if already playing, but for this simple version we don't change player position automatically unless it's initial load)
  if (!player.x || player.x < 1) {
    player.x = center + 0.5
    player.y = center + 0.5
    player.dirX = 0; player.dirY = -1
    player.planeX = 0.66; player.planeY = 0
  }

  player.y = center + 0.5
  player.dirX = 0; player.dirY = -1
  player.planeX = 0.66; player.planeY = 0
  playerGlideTarget = null

  // Re-seed sky letters from new text
  if (cw > 0) seedStars()
}

// Initial map generation with empty field panels
generateEmptyFieldMap(Object.keys(MOUNTAIN_LORE))

// Pretext cache for wall text
const wallLineCache = new Map<string, string[]>()

// ── PRETEXT STATE ──
const prepCache = new Map<string, PreparedTextWithSegments>()
let currentFont = ''
let lastPtMs = 0

function ensureFont(): string {
  const f = `${charSize}px Courier New`
  if (f !== currentFont) { currentFont = f; prepCache.clear(); wallLineCache.clear() }
  return f
}

function getPrepared(key: string): PreparedTextWithSegments {
  ensureFont()
  if (!prepCache.has(key)) {
    prepCache.set(key, prepareWithSegments(LORE_FULL[key] || MOUNTAIN_LORE[key]?.join(' ') || '', currentFont))
  }
  return prepCache.get(key)!
}

// Get Pretext-wrapped lines for wall text, cached per key+width+fontSize
function getWallLines(key: string, width: number, fontSize?: number): string[] {
  const fs = fontSize || charSize
  const font = `${fs}px Courier New`
  const cacheKey = `${key}_${width}_${fs}`
  if (wallLineCache.has(cacheKey)) return wallLineCache.get(cacheKey)!
  // Prepare at the exact font size that will be rendered
  const text = LORE_FULL[key] || MOUNTAIN_LORE[key]?.join(' ') || ''
  const prepared = prepareWithSegments(text, font)
  const lh = Math.ceil(fs * 1.3)
  const result = layoutWithLines(prepared, Math.max(40, width), lh)
  const lines = result.lines.map(l => l.text)
  wallLineCache.set(cacheKey, lines)
  return lines
}

// ── COALESCENCE ──
interface TypesetChar { char: string; tx: number; ty: number }

function getTypesetPositions(zoneKey: string, blockX: number, blockY: number, blockW: number): TypesetChar[] {
  const prepared = getPrepared(zoneKey)
  const lh = Math.ceil(charSize * 1.3)
  const chars: TypesetChar[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = blockY
  for (let row = 0; row < 100; row++) {
    const line = layoutNextLine(prepared, cursor, blockW)
    if (!line) break
    for (let i = 0; i < line.text.length; i++) {
      chars.push({ char: line.text[i]!, tx: blockX + (i * charSize * 0.6), ty: y })
    }
    cursor = line.end
    y += lh
    if (cursor.segmentIndex >= prepared.segments.length) break
  }
  return chars
}

// ── MOUSE EVENTS (grid mode) ──
canvas.addEventListener('mousedown', e => { isDragging = false; startX = e.clientX; startY = e.clientY })
canvas.addEventListener('mousemove', e => {
  if (e.buttons === 1) {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) isDragging = true
    if (isDragging) { panX += e.clientX - lastX; panY += e.clientY - lastY }
  }
  lastX = e.clientX; lastY = e.clientY
  const rect = canvas.getBoundingClientRect()
  mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
})
canvas.addEventListener('mouseup', () => { isDragging = false })
canvas.addEventListener('wheel', e => { zoom = Math.min(Math.max(0.5, zoom - e.deltaY * 0.001), 3.0) })

// ═══ SKY MODE LOCK — 'auto' | 'light' | 'dark' ═══
let skyModeLock: 'auto' | 'light' | 'dark' = 'auto'

// ═══ CONTEXT CHAT — discuss any text passage via LLM ═══
let contextChatActive = false
let contextChatInput: HTMLInputElement | null = null
let contextChatOverlay: HTMLDivElement | null = null
let contextChatLog: { role: 'user' | 'assistant' | 'context'; text: string }[] = []
let lastFacedLoreKey = '' // tracks what zone text the player is currently looking at
let lastFacedText = ''    // the actual text content being faced

function openContextChat(): void {
  if (contextChatActive) return
  if (!lastFacedLoreKey) return // not facing any text wall

  contextChatActive = true
  const zoneColor = ZONES[lastFacedLoreKey.toUpperCase()]?.color || '#daa520'
  const zoneLabel = ZONE_LABELS[lastFacedLoreKey] || lastFacedLoreKey
  contextChatLog = [{ role: 'context', text: lastFacedText.substring(0, 500) }]

  // Build overlay
  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed; bottom:0; left:0; right:0; z-index:9999;
    background:rgba(0,0,0,0.92); border-top:2px solid ${zoneColor};
    padding:10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); display:flex; flex-direction:column; gap:6px; font-family:Courier New;`

  // Chat log area
  const logDiv = document.createElement('div')
  logDiv.id = 'context-chat-log'
  logDiv.style.cssText = 'max-height:160px; overflow-y:auto; font-size:11px; color:#ccc; line-height:1.5;'
  logDiv.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <span style="background:${zoneColor}; color:#000; font-size:9px; font-weight:bold; padding:2px 8px; letter-spacing:1px;">LOADED CONTEXT</span>
      <span style="color:${zoneColor}; font-size:10px; font-weight:bold;">${zoneLabel}</span>
      <span style="color:#555; font-size:8px; margin-left:auto;">responses write onto walls</span>
      <button id="ctx-chat-close" style="background:none; border:1px solid #555; color:#aaa; font-size:14px; width:28px; height:28px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">✕</button>
    </div>
    <div style="color:#999; font-size:10px; border-left:3px solid ${zoneColor}40; padding:4px 8px; margin:4px 0; background:rgba(255,255,255,0.02); max-height:60px; overflow-y:auto;">
      ${lastFacedText.substring(0, 300)}${lastFacedText.length > 300 ? '…' : ''}
    </div>`
  overlay.appendChild(logDiv)

  // Wire close button
  setTimeout(() => {
    document.getElementById('ctx-chat-close')?.addEventListener('click', () => closeContextChat())
  }, 0)

  // Input row
  const inputRow = document.createElement('div')
  inputRow.style.cssText = 'display:flex; gap:8px;'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Ask about this text...'
  input.style.cssText = `flex:1; background:#111; color:#fff; border:1px solid #444; padding:6px 10px;
    font-family:Courier New; font-size:12px; outline:none;`
  input.addEventListener('keydown', e => {
    e.stopPropagation() // don't let WASD move the player while typing
    if (e.key === 'Enter' && input.value.trim()) {
      sendContextChat(input.value.trim())
      input.value = ''
    }
    if (e.key === 'Escape') {
      closeContextChat()
    }
  })
  inputRow.appendChild(input)

  const sendBtn = document.createElement('button')
  sendBtn.innerText = 'SEND'
  sendBtn.style.cssText = 'background:#222; color:#daa520; border:1px solid #daa520; padding:4px 12px; font-family:Courier New; font-size:10px; cursor:pointer;'
  sendBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      sendContextChat(input.value.trim())
      input.value = ''
    }
  })
  inputRow.appendChild(sendBtn)

  overlay.appendChild(inputRow)
  document.body.appendChild(overlay)

  contextChatOverlay = overlay
  contextChatInput = input
  setTimeout(() => input.focus(), 50)
}

function closeContextChat(): void {
  contextChatActive = false
  if (contextChatOverlay) {
    contextChatOverlay.remove()
    contextChatOverlay = null
  }
  contextChatInput = null
}

async function sendContextChat(msg: string): Promise<void> {
  if (!llmUrl) {
    appendChatMsg('assistant', 'No LLM connected. Configure via Sheet C or ?llm_url= param.')
    return
  }

  contextChatLog.push({ role: 'user', text: msg })
  appendChatMsg('user', msg)

  // Build messages array with context
  const messages = [
    { role: 'system', content: `You are a worldtext guide. The user is standing in the "${ZONE_LABELS[lastFacedLoreKey] || lastFacedLoreKey}" zone of a spatial text engine. Here is the passage they are reading:\n\n${lastFacedText}\n\nHelp them understand, explore, and discuss this text. Be concise (2-3 sentences).` },
    ...contextChatLog.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.text }))
  ]

  try {
    const res = await fetch(llmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(llmKey ? { Authorization: `Bearer ${llmKey}` } : {}) },
      body: JSON.stringify({ model: llmModel, messages, max_tokens: 150 })
    })
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || 'No response.'
    contextChatLog.push({ role: 'assistant', text: reply })
    appendChatMsg('assistant', reply)

    // ═══ WRITE ONTO THE WALLS ═══
    // The reply becomes part of the worldtext — it materializes on the zone wall.
    if (lastFacedLoreKey && MOUNTAIN_LORE[lastFacedLoreKey]) {
      // Split reply into sentences for wall display
      const newLines = reply.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 0)
      MOUNTAIN_LORE[lastFacedLoreKey]!.push(...newLines)
      // Clear caches so the new text renders immediately
      wallLineCache.clear()
      prepCache.clear()
      currentFont = ''

      // Visual confirmation in chat
      const wallNote = document.createElement('div')
      wallNote.style.cssText = `color:#0fa; font-size:8px; letter-spacing:1px; margin:4px 0; padding:2px 6px;
        background:rgba(0,255,170,0.08); border-left:2px solid #0fa;`
      wallNote.textContent = `✦ WRITTEN TO WALL · ${newLines.length} line${newLines.length !== 1 ? 's' : ''} added to ${ZONE_LABELS[lastFacedLoreKey] || lastFacedLoreKey}`
      document.getElementById('context-chat-log')?.appendChild(wallNote)
    }
  } catch (err) {
    appendChatMsg('assistant', `Error: ${err}`)
  }
}

function appendChatMsg(role: string, text: string): void {
  const logDiv = document.getElementById('context-chat-log')
  if (!logDiv) return
  const div = document.createElement('div')
  div.style.cssText = role === 'user'
    ? 'color:#88ccff; margin:3px 0;'
    : 'color:#daa520; margin:3px 0; padding-left:8px; border-left:2px solid #333;'
  div.textContent = `${role === 'user' ? '▸' : '◂'} ${text}`
  logDiv.appendChild(div)
  logDiv.scrollTop = logDiv.scrollHeight
}

// ── KEYBOARD ──
window.addEventListener('keydown', e => {
  // Block movement keys when editor or chat is active
  if (editorActive) {
    if (e.key === 'Escape') { editorClose(); e.preventDefault() }
    return // let textarea handle all other keys
  }
  keys[e.key.toLowerCase()] = true
  if (e.key === ' ' && engineMode === 'LIDAR') { e.preventDefault(); lidarScan() }
  if (e.key === 'Escape' && engineMode === 'LIDAR') {
    if (contextChatActive) { closeContextChat() }
    else if (activePursuit) { activePursuit = null }
    else { setMode('GRID') }
  }
  // 'E' — open inline wall editor for faced zone
  if (e.key === 'e' && engineMode === 'LIDAR' && !contextChatActive && lastFacedLoreKey) {
    e.preventDefault()
    editorOpen(lastFacedLoreKey)
  }
  // 'L' — cycle sky mode: auto → light → dark
  if (e.key === 'l' && engineMode === 'LIDAR' && !contextChatInput) {
    skyModeLock = skyModeLock === 'auto' ? 'light' : skyModeLock === 'light' ? 'dark' : 'auto'
  }
  // 'G' — generate new lore for current zone via LLM
  if (e.key === 'g' && engineMode === 'LIDAR' && !llmGenerating) {
    const pr = Math.sqrt((Math.floor(player.x) - MAP_CENTER) ** 2 + (Math.floor(player.y) - MAP_CENTER) ** 2)
    const zone = zoneForRadius(pr)
    const key = loreKeyForZone(zone)
    const sample = (MOUNTAIN_LORE[key] || []).slice(-5).join('\n')
    llmGenerate(key, sample).then(lines => {
      if (lines.length > 0) {
        injectLore(key, lines)
        // Also clear prep cache to force re-preparation
        prepCache.clear()
      }
    })
  }

  // ═══ NUMBER KEYS 0-9 — teleport to zones (0=center) ═══
  const numKey = parseInt(e.key)
  if (engineMode === 'LIDAR' && !isNaN(numKey) && numKey >= 0 && numKey <= 9) {
    if (numKey === 0) {
      // Teleport to center hub
      playerGlideTarget = { x: MAP_CENTER + 0.5, y: MAP_CENTER + 0.5 }
    } else {
      const zKeys = Object.keys(MOUNTAIN_LORE)
      if (numKey <= zKeys.length) {
        const targetKey = zKeys[numKey - 1]!
        const pos = ZONE_POSITIONS[targetKey]
        if (pos) {
          playerGlideTarget = { x: pos.x + 0.5, y: pos.y + 0.5 }
        }
      }
    }
  }

  // ═══ 'C' — CONTEXT CHAT: bring wall text into a chat ═══
  if (e.key === 'c' && engineMode === 'LIDAR' && !contextChatInput) {
    e.preventDefault()
    openContextChat()
  }
  if (e.key === 'Escape' && contextChatActive) {
    e.preventDefault()
    closeContextChat()
    return
  }
})
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })

// LLM config from URL params (e.g. ?llm_url=http://localhost:11434/v1/chat/completions&llm_model=llama3)
{
  const params = new URLSearchParams(window.location.search)
  const url = params.get('llm_url')
  const model = params.get('llm_model')
  const key = params.get('llm_key')
  if (url) { llmUrl = url; llmModel = model || 'llama3'; llmKey = key || '' }
}

// ── LIDAR CANVAS CLICK + HOVER — clickable worldtext hyperlinks ──
function hotWordAt(mx: number, my: number): HotWordHit | null {
  for (let i = hotWordHits.length - 1; i >= 0; i--) {
    const h = hotWordHits[i]!
    if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) return h
  }
  return null
}

lidarCanvas.addEventListener('click', e => {
  if (engineMode !== 'LIDAR') return
  if (editorActive) return // don't process clicks behind editor
  const rect = lidarCanvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left) * (lidarCanvas.width / rect.width)
  const my = (e.clientY - rect.top) * (lidarCanvas.height / rect.height)
  const hit = hotWordAt(mx, my)
  if (hit) { onHotWordClick(hit); e.stopPropagation(); return }
  // No hot word hit — check if clicking center area → open editor
  if (lastFacedLoreKey) {
    const centerX = lidarCanvas.width / 2
    const centerY = lidarCanvas.height / 2
    const dx = Math.abs(mx - centerX)
    const dy = Math.abs(my - centerY)
    // Click within the center 60% of the screen opens editor
    if (dx < lidarCanvas.width * 0.3 && dy < lidarCanvas.height * 0.3) {
      editorOpen(lastFacedLoreKey)
    }
  }
})

lidarCanvas.addEventListener('mousemove', e => {
  if (engineMode !== 'LIDAR') return
  const rect = lidarCanvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left) * (lidarCanvas.width / rect.width)
  const my = (e.clientY - rect.top) * (lidarCanvas.height / rect.height)
  hoveredHotWord = hotWordAt(mx, my)
  lidarCanvas.style.cursor = hoveredHotWord ? 'pointer' : 'crosshair'
})

// ══════════════════════════════════════════════════════════════
// RENDER: GRID MODE
// ══════════════════════════════════════════════════════════════
function renderGrid(): void {
  ctx.fillStyle = '#0b0a08'
  ctx.fillRect(0, 0, cw, ch)

  const topoScale = 30 * zoom
  let closest: (CellState & { sx: number; sy: number }) | null = null
  let minDist = 1000
  const projectedPoints: { x: number; y: number; sx: number; sy: number; cell: CellState }[] = []

  // Coalescence setup
  let coalesceZone: string | null = null
  let coalesceSX = 0, coalesceSY = 0
  let typesetChars: TypesetChar[] | null = null
  let typesetCharIdx = 0

  if (hoverCell && coalesceRadius > 0) {
    coalesceZone = loreKeyForZone(hoverCell.zone)
    coalesceSX = hoverCell.sx; coalesceSY = hoverCell.sy
    const blockW = coalesceRadius * 2
    const t0 = performance.now()
    typesetChars = getTypesetPositions(coalesceZone, coalesceSX - coalesceRadius, coalesceSY - coalesceRadius * 0.5, blockW)
    lastPtMs = performance.now() - t0
    typesetCharIdx = 0
  }

  // ── DRAW GRID ──
  ctx.font = `${charSize * zoom}px Courier New`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = gridState[y]![x]!
      const rx = x - CENTER, ry = y - CENTER

      // Z wave
      const z = cell.height + Math.sin((Math.sqrt(rx * rx + ry * ry) * 0.5) - time * (waveSpeed / 40)) * 1.5

      // Projection
      let sx: number, sy: number
      if (viewMode === 'TOPO') {
        sx = cx + panX + (rx - ry) * topoScale
        sy = cy + panY + (rx + ry) * (topoScale * 0.4) - (z * zoom * 10)
      } else {
        sx = cx + panX + (rx * topoScale * 1.2)
        sy = cy + panY + (ry * topoScale * 1.2)
      }

      projectedPoints.push({ x, y, sx, sy, cell })

      // Character cycling — show more of the text, not just charAt(0)
      const textIdx = Math.floor(time * 0.8 + x * 0.7 + y * 0.3) % cell.text.length
      const char = cell.text[textIdx] || '.'

      // Distance fade
      const dist = Math.abs(rx) + Math.abs(ry)
      let alpha = Math.max(0.1, 1 - dist / 20)
      let fillColor = cell.color

      // Flow highlight wave
      if (Math.sin(rx * 0.5 + time * (waveSpeed / 40) + ry * 0.5) > 0.8) {
        fillColor = '#fff'; alpha = 1
      }

      // Coalescence
      let drawX = sx, drawY = sy
      if (typesetChars && coalesceZone === loreKeyForZone(cell.zone) && typesetCharIdx < typesetChars.length) {
        const dToHover = Math.hypot(sx - coalesceSX, sy - coalesceSY)
        if (dToHover < coalesceRadius * zoom) {
          const tc = typesetChars[typesetCharIdx]!
          const t = Math.max(0, Math.min(1, 1 - dToHover / (coalesceRadius * zoom)))
          const ease = t * t * (3 - 2 * t)
          drawX = sx + (tc.tx - sx) * ease
          drawY = sy + (tc.ty - sy) * ease
          alpha = Math.max(alpha, 0.3 + 0.7 * ease)
          if (ease > 0.5) fillColor = '#fff'
          typesetCharIdx++
        }
      }

      ctx.globalAlpha = alpha
      ctx.fillStyle = fillColor
      ctx.fillText(char, drawX, drawY)

      // Interaction
      if (mousePos) {
        const d = Math.hypot(sx - mousePos.x, sy - mousePos.y)
        if (d < 30 * zoom && d < minDist) { minDist = d; closest = { ...cell, sx, sy } }
      }
    }
  }

  // ── PARTICLES ──
  if (Math.random() < 0.15) spawnParticle()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.x += p.vx; p.y += p.vy; p.life++
    if (p.life > p.maxLife) { particles.splice(i, 1); continue }
    const a = Math.sin(Math.PI * p.life / p.maxLife) * 0.5
    ctx.globalAlpha = a
    ctx.fillStyle = '#daa520'
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── RELATIONSHIP LINES ──
  if (closest && showRelations) {
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 1; ctx.lineWidth = 2
    ctx.beginPath()
    const ringSize = (15 * zoom) + Math.sin(time * 4) * 5
    ctx.arc(closest.sx, closest.sy, ringSize, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 1; ctx.globalAlpha = 0.3; ctx.strokeStyle = closest.zone.color
    ctx.beginPath()
    let relCount = 0
    for (const p of projectedPoints) {
      if (p.cell.zone === closest.zone && p.cell !== closest as any && relCount < 20) {
        const d = Math.hypot(p.sx - closest.sx, p.sy - closest.sy)
        if (d < 200 * zoom) {
          ctx.moveTo(closest.sx, closest.sy)
          const midX = (closest.sx + p.sx) / 2
          const midY = (closest.sy + p.sy) / 2 - (20 * Math.sin(time + p.x))
          ctx.quadraticCurveTo(midX, midY, p.sx, p.sy)
          relCount++
        }
      }
    }
    ctx.stroke()

    // Floating label
    const lx = closest.sx + 40 * zoom, ly = closest.sy - 40 * zoom
    ctx.fillStyle = closest.zone.color; ctx.globalAlpha = 1
    ctx.font = `bold ${12 * zoom}px Courier New`
    ctx.fillText(closest.zone.name, lx, ly)
    ctx.strokeStyle = closest.zone.color; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(closest.sx, closest.sy); ctx.lineTo(lx, ly); ctx.stroke()
  }

  ctx.globalAlpha = 1

  // ── UPDATE READER PANEL ──
  if (closest && closest !== hoverCell) {
    hoverCell = closest
    document.getElementById('zone-header')!.innerText = closest.zone.flavor
    document.getElementById('zone-header')!.style.color = closest.color
    document.getElementById('text-display')!.innerHTML = `> ${closest.zone.name}<br>"${closest.text}"`

    // Pretext reader panel — full zone lore
    const key = loreKeyForZone(closest.zone)
    const prepared = getPrepared(key)
    const panelW = 256
    const lh = Math.ceil(charSize * 1.3)
    const lines = layoutWithLines(prepared, panelW, lh)

    ptReaderCtx.clearRect(0, 0, ptReaderCanvas.width, ptReaderCanvas.height)
    ptReaderCtx.font = currentFont
    ptReaderCtx.fillStyle = closest.zone.color
    ptReaderCtx.textAlign = 'left'
    ptReaderCtx.textBaseline = 'top'
    for (let i = 0; i < lines.lines.length; i++) {
      ptReaderCtx.fillText(lines.lines[i]!.text, 4, 4 + i * lh)
    }
    document.getElementById('pretext-reader')!.classList.add('visible')
    document.getElementById('data-display')!.innerText = `${lines.lines.length} lines · ${key} · pretext ${lastPtMs.toFixed(1)}ms`
    document.getElementById('sb-zone')!.innerText = closest.zone.name
  }

  // ── MINIMAP ──
  mmCtx.fillStyle = '#111'; mmCtx.fillRect(0, 0, 100, 100)
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      mmCtx.fillStyle = gridState[y]![x]!.color
      mmCtx.globalAlpha = 0.4
      mmCtx.fillRect(x * 3.1, y * 3.1, 3, 3)
    }
  }
  if (closest) { mmCtx.fillStyle = '#fff'; mmCtx.globalAlpha = 1; mmCtx.fillRect(closest.x * 3.1, closest.y * 3.1, 4, 4) }
  mmCtx.globalAlpha = 1
}

// ══════════════════════════════════════════════════════════════
// RENDER: LIDAR MODE — Two-Layer Architecture
// Layer 1: Solid colored wall strips (ALL walls) → spatial depth
// Layer 2: Screen-aligned Pretext text (CENTER wall) → readable lore
// Layer 3: Hot words + tendrils → hyperlink world
// Layer 4: Particles, crosshair, ambient → habitable space
// ══════════════════════════════════════════════════════════════
let scanPulseTime = -1

interface RayHit {
  screenX: number
  perp: number
  drawStart: number
  drawEnd: number
  mapX: number
  mapY: number
  side: number
  wallX: number
  loreKey: string
  zone: typeof ZONES[string]
}

function renderLidar(): void {
  const ms = 0.06, rs = 0.05
  hotWordHits = [] // Clear hit boxes for this frame

  // Movement
  if (keys['a'] || keys['arrowleft']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(-rs) - player.dirY * Math.sin(-rs)
    player.dirY = od * Math.sin(-rs) + player.dirY * Math.cos(-rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(-rs) - player.planeY * Math.sin(-rs)
    player.planeY = op * Math.sin(-rs) + player.planeY * Math.cos(-rs)
  }
  if (keys['d'] || keys['arrowright']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(rs) - player.dirY * Math.sin(rs)
    player.dirY = od * Math.sin(rs) + player.dirY * Math.cos(rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(rs) - player.planeY * Math.sin(rs)
    player.planeY = op * Math.sin(rs) + player.planeY * Math.cos(rs)
  }
  if (keys['w'] || keys['arrowup']) {
    const nx = player.x + player.dirX * ms, ny = player.y + player.dirY * ms
    if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
    if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
  }
  if (keys['s'] || keys['arrowdown']) {
    const nx = player.x - player.dirX * ms, ny = player.y - player.dirY * ms
    if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
    if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
  }

  // Smooth glide toward clicked zone (calm, not snapping)
  if (playerGlideTarget) {
    // Any manual movement cancels glide
    if (keys['w'] || keys['s'] || keys['a'] || keys['d'] ||
        keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright']) {
      playerGlideTarget = null
    } else {
      const dx = playerGlideTarget.x - player.x
      const dy = playerGlideTarget.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) {
        playerGlideTarget = null
      } else {
        const ease = 0.02 // slow, contemplative drift
        const nx = player.x + dx * ease
        const ny = player.y + dy * ease
        // Collision-aware movement
        if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
        if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
        // Turn to face destination
        const targetAngle = Math.atan2(dy, dx)
        const currentAngle = Math.atan2(player.dirY, player.dirX)
        let angleDiff = targetAngle - currentAngle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        const turnRate = 0.03
        if (Math.abs(angleDiff) > 0.05) {
          const turn = angleDiff * turnRate
          const c = Math.cos(turn), s = Math.sin(turn)
          const od = player.dirX
          player.dirX = od * c - player.dirY * s
          player.dirY = od * s + player.dirY * c
          const op = player.planeX
          player.planeX = op * c - player.planeY * s
          player.planeY = op * s + player.planeY * c
        }
      }
    }
  }

  lidarCtx.fillStyle = '#000'
  lidarCtx.fillRect(0, 0, cw, ch)

  // ═══ SKY — full day/night cycle with mode lock ═══
  const sunAngle = time * 0.012 // slow sweep
  const sunX = cw * (0.3 + 0.4 * Math.sin(sunAngle))
  const sunY = ch * (0.12 + 0.06 * Math.cos(sunAngle * 0.7))
  let sunPhase = (Math.sin(sunAngle) + 1) / 2 // 0 = midnight, 1 = noon

  // Mode lock override
  if (skyModeLock === 'light') sunPhase = 0.95
  else if (skyModeLock === 'dark') sunPhase = 0.05

  const isDaytime = sunPhase > 0.4

  // Sky gradient — night-to-day transition
  const gs = lidarCtx.createLinearGradient(0, 0, 0, ch / 2)
  if (isDaytime) {
    const dayT = Math.min(1, (sunPhase - 0.4) / 0.4) // 0..1 during day
    gs.addColorStop(0, lerpColor('#0d0820', '#4a90d9', dayT))
    gs.addColorStop(0.4, lerpColor('#1a0c2a', '#87CEEB', dayT))
    gs.addColorStop(0.8, lerpColor('#1c1030', '#b8ddf0', dayT))
    gs.addColorStop(1, lerpColor('#1c1030', '#d4e8f5', dayT))
  } else {
    const nightT = sunPhase / 0.4
    gs.addColorStop(0, lerpColor('#000510', '#0d0820', nightT))
    gs.addColorStop(0.5, lerpColor('#060318', '#1a0c2a', nightT))
    gs.addColorStop(1, lerpColor('#0a0520', '#1c1030', nightT))
  }
  lidarCtx.fillStyle = gs
  lidarCtx.fillRect(0, 0, cw, ch / 2)

  // Clouds made of letters (day only)
  if (isDaytime) {
    const dayT = Math.min(1, (sunPhase - 0.4) / 0.4)
    const allText = Object.values(MOUNTAIN_LORE).flat().join(' ')
    lidarCtx.textAlign = 'center'
    lidarCtx.textBaseline = 'middle'
    for (let i = 0; i < 6; i++) {
      const cloudX = ((i * 173 + time * 0.6) % (cw + 300)) - 150
      const cloudY = ch * (0.06 + (i % 3) * 0.07)
      const cloudW = 60 + (i % 3) * 40
      // Each cloud is a cluster of ~20 scattered letters
      const textOffset = (i * 31) % Math.max(1, allText.length)
      for (let j = 0; j < 18; j++) {
        const charIdx = (textOffset + j) % Math.max(1, allText.length)
        const ch2 = allText[charIdx] || '·'
        if (ch2 === ' ') continue
        const dx = (Math.sin(j * 2.3 + i) * 0.5 + 0.5 - 0.5) * cloudW
        const dy = (Math.cos(j * 1.7 + i * 0.5) * 0.5) * 14
        const sz2 = 7 + (j % 3) * 2
        lidarCtx.globalAlpha = dayT * (0.15 + 0.15 * Math.sin(j * 0.7 + time * 0.1))
        lidarCtx.fillStyle = '#fff'
        lidarCtx.font = `${sz2}px Courier New`
        lidarCtx.fillText(ch2, cloudX + dx, cloudY + dy)
      }
    }
    lidarCtx.globalAlpha = 1
  }

  // Sun glow — golden at night, bright white-yellow at day
  const sunGlow = lidarCtx.createRadialGradient(sunX, sunY, 0, sunX, sunY, cw * 0.4)
  if (isDaytime) {
    sunGlow.addColorStop(0, `rgba(255, 240, 180, ${0.15 + 0.25 * sunPhase})`)
    sunGlow.addColorStop(0.3, `rgba(255, 220, 120, ${0.06 + 0.10 * sunPhase})`)
  } else {
    sunGlow.addColorStop(0, `rgba(255, 200, 80, ${0.08 + 0.12 * sunPhase})`)
    sunGlow.addColorStop(0.3, `rgba(255, 160, 60, ${0.04 + 0.06 * sunPhase})`)
  }
  sunGlow.addColorStop(1, 'transparent')
  lidarCtx.fillStyle = sunGlow
  lidarCtx.fillRect(0, 0, cw, ch / 2)

  // Sun disc — bigger and brighter during day
  lidarCtx.beginPath()
  const sunR = isDaytime ? 6 + 5 * sunPhase : 4 + 3 * sunPhase
  lidarCtx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
  lidarCtx.fillStyle = isDaytime
    ? `rgba(255, 245, 200, ${0.5 + 0.5 * sunPhase})`
    : `rgba(255, 220, 120, ${0.3 + 0.5 * sunPhase})`
  lidarCtx.fill()

  // Starfield — letters from the source text (fade during day)
  const starAlpha = isDaytime ? Math.max(0, 1 - (sunPhase - 0.4) * 3) : 1
  if (starAlpha > 0.01) {
    lidarCtx.textAlign = 'center'
    lidarCtx.textBaseline = 'middle'
    for (let i = 0; i < skyStars.length; i++) {
      const s = skyStars[i]!
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * s.speed + s.phase))
      lidarCtx.globalAlpha = s.brightness * twinkle * starAlpha
      lidarCtx.fillStyle = s.color
      lidarCtx.font = `${s.size}px Courier New`
      lidarCtx.fillText(s.char, s.x, s.y)
    }
  }

  // ═══ SHOOTING STARS — night only, letter streaks ═══
  if (!isDaytime) {
    // Each shooting star is a short burst of letters streaking across the sky
    // Spawn based on time — roughly one every ~5 seconds
    const shootIdx = Math.floor(time * 0.2) // new one every ~5s
    for (let ss = 0; ss < 2; ss++) {
      const seed = shootIdx * 3 + ss
      const life = (time * 0.2 - shootIdx) // 0..1 lifespan
      if (life > 0.8) continue // faded out
      const sx0 = ((Math.sin(seed * 7.3) * 0.5 + 0.5) * cw * 0.8) + cw * 0.1
      const sy0 = Math.sin(seed * 3.1) * 0.3 * (ch / 2) + ch * 0.1
      const angle = -0.3 + Math.sin(seed * 2.7) * 0.4
      const speed = 150 + Math.sin(seed * 5.1) * 80

      // Trail of 4-6 characters
      const trailLen = 4 + (seed % 3)
      const allChars = skyStars.length > 0 ? skyStars.map(s => s.char).join('') : 'ABCDEFGHIJKLM'
      lidarCtx.textAlign = 'center'
      lidarCtx.textBaseline = 'middle'
      for (let t = 0; t < trailLen; t++) {
        const progress = life * speed - t * 12
        if (progress < 0) continue
        const tx = sx0 + Math.cos(angle) * progress
        const ty = sy0 + Math.sin(angle) * progress
        if (tx < 0 || tx > cw || ty < 0 || ty > ch / 2) continue
        const fade = Math.max(0, 1 - t / trailLen) * (1 - life * 1.2) * starAlpha
        lidarCtx.globalAlpha = fade * 0.7
        lidarCtx.fillStyle = t === 0 ? '#fff' : '#aac8ff'
        lidarCtx.font = `${8 - t}px Courier New`
        lidarCtx.fillText(allChars[(seed + t) % allChars.length]!, tx, ty)
      }
    }
  }

  // ═══ WORD KITES — daytime, small word clusters drifting ═══
  if (isDaytime && sunPhase > 0.5) {
    const kiteAlpha = Math.min(0.3, (sunPhase - 0.5) * 0.6)
    const numKites = 3
    lidarCtx.textAlign = 'center'
    lidarCtx.textBaseline = 'middle'
    const allZoneKeys = Object.keys(MOUNTAIN_LORE)
    for (let k = 0; k < numKites; k++) {
      const kSeed = k * 17 + 5
      const kx = (Math.sin(time * 0.003 * (k + 1) + kSeed) * 0.4 + 0.5) * cw
      const ky = ch * (0.08 + k * 0.08) + Math.sin(time * 0.01 + kSeed) * 10
      const zKey = allZoneKeys[k % allZoneKeys.length]!
      const words = (MOUNTAIN_LORE[zKey] || []).join(' ').split(/\s+/)
      const word = words[(Math.floor(time * 0.05 + kSeed)) % words.length] || '~'

      lidarCtx.globalAlpha = kiteAlpha
      lidarCtx.font = `${7 + k}px Courier New`
      lidarCtx.fillStyle = '#556'
      lidarCtx.fillText(word, kx, ky)

      // Tiny trailing thread
      lidarCtx.globalAlpha = kiteAlpha * 0.3
      lidarCtx.beginPath()
      lidarCtx.moveTo(kx, ky + 4)
      lidarCtx.lineTo(kx + Math.sin(time * 0.02 + k) * 8, ky + 14 + k * 3)
      lidarCtx.strokeStyle = '#445'
      lidarCtx.lineWidth = 0.5
      lidarCtx.stroke()
    }
  }

  lidarCtx.globalAlpha = 1

  // ═══ GROUND — sand and earth, day/night aware ═══
  const dayGroundT = isDaytime ? Math.min(1, (sunPhase - 0.4) / 0.4) : 0
  const earthBase = lidarCtx.createLinearGradient(0, ch / 2, 0, ch)
  earthBase.addColorStop(0, lerpColor('#1a150e', '#8B7B5E', dayGroundT * 0.5))
  earthBase.addColorStop(0.2, lerpColor('#1f1810', '#9B8B6E', dayGroundT * 0.4))
  earthBase.addColorStop(0.5, lerpColor('#251c14', '#A09078', dayGroundT * 0.3))
  earthBase.addColorStop(1, lerpColor('#1c1610', '#7B6B58', dayGroundT * 0.3))
  lidarCtx.fillStyle = earthBase
  lidarCtx.fillRect(0, ch / 2, cw, ch / 2)

  // Sand grain texture — randomized dots receding with perspective
  lidarCtx.globalAlpha = 0.12
  for (let row = 0; row < 25; row++) {
    const yRatio = row / 25
    const gy = ch / 2 + yRatio * ch / 2
    const spacing = Math.max(6, 50 * (1 - yRatio))
    const grainSize = 1 + yRatio * 2
    // Vary grain color for depth
    lidarCtx.fillStyle = row % 3 === 0 ? '#8B7355' : row % 3 === 1 ? '#6B5B45' : '#9B8B75'
    for (let gx = 0; gx < cw; gx += spacing) {
      const jitter = Math.sin(gx * 0.1 + row * 2.7 + time * 0.01) * 3
      lidarCtx.fillRect(gx + jitter, gy, grainSize, 1)
    }
  }

  // Dirt clump texture — occasional larger spots
  lidarCtx.globalAlpha = 0.06
  lidarCtx.fillStyle = '#5a4a3a'
  for (let i = 0; i < 40; i++) {
    const dx = (Math.sin(i * 7.3 + time * 0.005) * 0.5 + 0.5) * cw
    const dy = ch / 2 + (Math.cos(i * 3.1) * 0.5 + 0.5) * ch / 2
    const dSize = 2 + Math.sin(i * 1.7) * 2
    lidarCtx.fillRect(dx, dy, dSize, dSize)
  }

  // Sun-warmth spill onto ground (warm glow near horizon)
  const groundSunGlow = lidarCtx.createRadialGradient(sunX, ch / 2, 0, sunX, ch / 2, cw * 0.5)
  groundSunGlow.addColorStop(0, `rgba(200, 150, 60, ${0.04 + 0.06 * sunPhase})`)
  groundSunGlow.addColorStop(1, 'transparent')
  lidarCtx.globalAlpha = 0.4
  lidarCtx.fillStyle = groundSunGlow
  lidarCtx.fillRect(0, ch / 2, cw, ch / 4)

   // Ground zone glow — ring color tints the entire floor
  const pMx = Math.floor(player.x), pMy = Math.floor(player.y)
  const pRow = LIDAR_PLAN[pMy]
  const playerDist = Math.sqrt((pMx - MAP_CENTER) ** 2 + (pMy - MAP_CENTER) ** 2)
  if (pRow) {
    const nearZone = zoneForRadius(playerDist)
    const gzg = lidarCtx.createRadialGradient(cw / 2, ch, 0, cw / 2, ch, ch / 2)
    gzg.addColorStop(0, nearZone.color + '30')
    gzg.addColorStop(0.5, nearZone.color + '10')
    gzg.addColorStop(1, 'transparent')
    lidarCtx.globalAlpha = 0.6
    lidarCtx.fillStyle = gzg
    lidarCtx.fillRect(0, ch / 2, cw, ch / 2)
  }

  // ═══ QUADRANT GROUND COLORING ═══
  // Four colored wedges radiate from the horizon vanishing point.
  // Each wedge = one compass quadrant (NE/SE/SW/NW), tinted so
  // you always know which direction the floor faces.
  const quadrantColors: [number, number, string][] = [
    // [worldDirX, worldDirY, color] — compass directions
    [1, -1, 'rgba(255, 200, 80, 0.06)'],   // NE = warm gold
    [1, 1, 'rgba(255, 100, 60, 0.06)'],     // SE = warm red
    [-1, 1, 'rgba(80, 200, 100, 0.06)'],    // SW = green
    [-1, -1, 'rgba(80, 160, 255, 0.06)'],   // NW = blue
  ]

  const vpX = cw / 2, vpY = ch / 2 // vanishing point
  for (const [wdx, wdy, qColor] of quadrantColors) {
    // Project quadrant direction boundaries to screen space
    // Two boundary rays: one for each edge of this 90° wedge
    const angles = [
      Math.atan2(wdy as number, wdx as number) - Math.PI / 4,
      Math.atan2(wdy as number, wdx as number) + Math.PI / 4,
    ]

    // Transform world directions into screen-space via player orientation
    const screenEdges: number[] = []
    for (const a of angles) {
      const wx = Math.cos(a), wy = Math.sin(a)
      const dot = wx * player.dirX + wy * player.dirY
      const cross = wx * player.planeX + wy * player.planeY
      if (dot > 0.01) {
        screenEdges.push(vpX + (cross / dot) * (cw / 2))
      }
    }

    if (screenEdges.length === 2) {
      const left = Math.max(0, Math.min(screenEdges[0]!, screenEdges[1]!))
      const right = Math.min(cw, Math.max(screenEdges[0]!, screenEdges[1]!))
      if (right > left) {
        // Fill wedge from vanishing point down
        lidarCtx.globalAlpha = 1
        lidarCtx.fillStyle = qColor as string
        lidarCtx.beginPath()
        lidarCtx.moveTo(vpX, vpY)
        lidarCtx.lineTo(left, ch)
        lidarCtx.lineTo(right, ch)
        lidarCtx.closePath()
        lidarCtx.fill()

        // Stronger intensity closer to the ground (distance = ring indicator)
        const ringIntensity = Math.min(0.08, playerDist * 0.002)
        lidarCtx.globalAlpha = ringIntensity
        lidarCtx.fillRect(left, ch * 0.75, right - left, ch * 0.25)
      }
    }
  }

  // ═══ COMPASS LABELS — N/S/E/W at the horizon ═══
  // Project cardinal directions onto the screen based on player facing
  const compassLabels: [string, number, number, string][] = [
    ['N', 0, -1, '#88ccff'],  // North = map -Y
    ['E', 1, 0, '#ffcc44'],
    ['S', 0, 1, '#ff6644'],
    ['W', -1, 0, '#44ff88'],
  ]
  const horizonY = Math.floor(ch / 2) - 2
  lidarCtx.textAlign = 'center'
  lidarCtx.textBaseline = 'bottom'

  for (const [label, wx, wy, color] of compassLabels) {
    // Dot product with player direction gives forward alignment
    // Cross product with plane gives screen-X position
    const dot = (wx as number) * player.dirX + (wy as number) * player.dirY
    const cross = (wx as number) * player.planeX + (wy as number) * player.planeY

    if (dot > 0.01) { // Only show if roughly in front of player
      const screenX = cw / 2 + (cross / dot) * (cw / 2)
      if (screenX > 20 && screenX < cw - 20) {
        const alpha = Math.min(1, dot * 1.5)
        lidarCtx.globalAlpha = alpha * 0.7
        lidarCtx.font = `bold ${14 + Math.floor(dot * 6)}px Courier New`
        lidarCtx.fillStyle = color as string
        lidarCtx.fillText(label as string, screenX, horizonY)
        // Small tick mark
        lidarCtx.fillRect(screenX - 1, horizonY, 2, 6)
      }
    }
  }

  // ═══ RING INDICATOR — which ring am I in? ═══
  // Subtle ring number on the ground at center-bottom
  const ringIdx = Math.max(0, Math.floor((playerDist - 5) / 6)) // coreRadius=5, ringWidth=6
  const zoneKeysArr = Object.keys(MOUNTAIN_LORE)
  const currentZoneKey = zoneKeysArr[Math.min(ringIdx, zoneKeysArr.length - 1)]
  const currentZoneLabel = ZONE_LABELS[currentZoneKey || ''] || currentZoneKey || ''

  // Ground ring stripe — thin colored line at the horizon
  if (currentZoneKey) {
    const zoneObj = ZONES[currentZoneKey.toUpperCase()] || Object.values(ZONES)[0]
    if (zoneObj) {
      lidarCtx.globalAlpha = 0.4
      lidarCtx.fillStyle = zoneObj.color
      lidarCtx.fillRect(0, Math.floor(ch / 2) - 1, cw, 2)
    }
  }

  // ═══ COMPASS HUD — bearing + zone at top of screen ═══
  const bearing = ((Math.atan2(player.dirX, -player.dirY) * 180 / Math.PI) + 360) % 360
  const bearingLabel = bearing < 22.5 ? 'N' : bearing < 67.5 ? 'NE' : bearing < 112.5 ? 'E' :
    bearing < 157.5 ? 'SE' : bearing < 202.5 ? 'S' : bearing < 247.5 ? 'SW' :
    bearing < 292.5 ? 'W' : bearing < 337.5 ? 'NW' : 'N'

  lidarCtx.globalAlpha = 0.8
  lidarCtx.textAlign = 'center'
  lidarCtx.textBaseline = 'top'
  lidarCtx.font = 'bold 11px Courier New'
  lidarCtx.fillStyle = '#fff'
  lidarCtx.fillText(`${bearingLabel} ${Math.round(bearing)}°`, cw / 2, 8)

  // Zone label below compass
  if (currentZoneLabel) {
    lidarCtx.font = '9px Courier New'
    lidarCtx.fillStyle = ZONES[currentZoneKey!.toUpperCase()]?.color || '#888'
    lidarCtx.fillText(`RING ${ringIdx + 1} · ${currentZoneLabel}`, cw / 2, 22)
  }

  // Zone teleport shortcuts — subtle key hints
  const zkArr = Object.keys(MOUNTAIN_LORE)
  if (zkArr.length > 1) {
    lidarCtx.font = '8px Courier New'
    lidarCtx.globalAlpha = 0.4
    const shortcutText = zkArr.map((k, i) => `${i + 1}:${(ZONE_LABELS[k] || k).substring(0, 8)}`).join('  ')
    lidarCtx.fillStyle = '#aaa'
    lidarCtx.fillText(shortcutText, cw / 2, 34)
  }

  lidarCtx.globalAlpha = 1

  const pulseDt = time - scanPulseTime
  const pulseActive = pulseDt >= 0 && pulseDt < 3

  // ═══ PASS 1: Raycast every column ═══
  const hits: (RayHit | null)[] = []
  let centerHit: RayHit | null = null
  const centerCol = Math.floor(cw / 2)

  for (let x = 0; x < cw; x++) {
    const camX = 2 * x / cw - 1
    const rdx = player.dirX + player.planeX * camX
    const rdy = player.dirY + player.planeY * camX

    let mx = Math.floor(player.x), my = Math.floor(player.y)
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy)
    let sdx: number, sdy: number, sx: number, sy: number, side = 0

    if (rdx < 0) { sx = -1; sdx = (player.x - mx) * ddx }
    else { sx = 1; sdx = (mx + 1 - player.x) * ddx }
    if (rdy < 0) { sy = -1; sdy = (player.y - my) * ddy }
    else { sy = 1; sdy = (my + 1 - player.y) * ddy }

    let hit = false
    for (let d = 0; d < 30; d++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0 }
      else { sdy += ddy; my += sy; side = 1 }
      const tile = LIDAR_PLAN[my]?.[mx]
      if (tile && tile !== '.') { hit = true; break }
    }

    if (!hit) { hits.push(null); continue }

    let perp: number
    if (side === 0) perp = (mx - player.x + (1 - sx) / 2) / rdx
    else perp = (my - player.y + (1 - sy) / 2) / rdy
    if (perp < 0.01) perp = 0.01

    const lineH = Math.floor(ch / perp)
    const drawStart = Math.max(0, (ch - lineH) / 2)
    const drawEnd = Math.min(ch, (ch + lineH) / 2)

    let wallX: number
    if (side === 0) wallX = player.y + perp * rdy
    else wallX = player.x + perp * rdx
    wallX -= Math.floor(wallX)

    const wallChar = LIDAR_PLAN[my]?.[mx] || '#'
    const loreKey = WALL_LORE[wallChar] || ''
    const zone = ZONES[loreKey.toUpperCase()] || ZONES.CAVE || Object.values(ZONES)[0]!

    const rh: RayHit = { screenX: x, perp, drawStart, drawEnd, mapX: mx, mapY: my, side, wallX, loreKey, zone }
    hits.push(rh)

    if (x === centerCol) centerHit = rh
  }

  // ═══ PASS 2: Group into wall faces ═══
  interface WallFace {
    startX: number; endX: number
    minDrawStart: number; maxDrawEnd: number
    avgPerp: number
    loreKey: string
    zone: typeof ZONES[string]
    side: number
    mapX: number; mapY: number
  }

  const faces: WallFace[] = []
  let curFace: WallFace | null = null

  for (let x = 0; x < cw; x++) {
    const h = hits[x]
    if (!h) {
      if (curFace) { faces.push(curFace); curFace = null }
      continue
    }
    if (curFace && h.mapX === curFace.mapX && h.mapY === curFace.mapY && h.side === curFace.side) {
      curFace.endX = x
      curFace.minDrawStart = Math.min(curFace.minDrawStart, h.drawStart)
      curFace.maxDrawEnd = Math.max(curFace.maxDrawEnd, h.drawEnd)
      curFace.avgPerp = (curFace.avgPerp + h.perp) / 2
    } else {
      if (curFace) faces.push(curFace)
      curFace = {
        startX: x, endX: x,
        minDrawStart: h.drawStart, maxDrawEnd: h.drawEnd,
        avgPerp: h.perp, loreKey: h.loreKey, zone: h.zone, side: h.side,
        mapX: h.mapX, mapY: h.mapY,
      }
    }
  }
  if (curFace) faces.push(curFace)

  // Find which face the crosshair is on
  let centerFace: WallFace | null = null
  for (const f of faces) {
    if (f.startX <= centerCol && f.endX >= centerCol) { centerFace = f; break }
  }

  // Track faced text for context chat — capture actual VISIBLE lines, not whole zone
  if (centerFace) {
    lastFacedLoreKey = centerFace.loreKey
    // Will be updated with exact visible lines during center face rendering below
  }

  // ═══ UNIFIED RENDERING: Every wall face is made of text ═══
  // Close = large readable text on black bg
  // Far = tiny text as texture over zone color
  // Center face = enhanced with hot-word highlighting

  for (const face of faces) {
    const faceW = face.endX - face.startX + 1
    const faceH = face.maxDrawEnd - face.minDrawStart
    if (faceW < 2 || faceH < 4) continue

    const isCenter = face === centerFace
    let bright = Math.max(0.1, 1 - face.avgPerp / 12) * (face.side === 1 ? 0.7 : 1)
    // Center face needs minimum brightness for readability
    if (isCenter) bright = Math.max(0.5, bright)

    if (pulseActive) {
      const pulseR = pulseDt * 8
      if (Math.abs(face.avgPerp - pulseR) < 1.5) bright = Math.min(1, bright + 0.6)
    }

    const hex = face.zone.color
    const cr = parseInt(hex.slice(1, 3), 16)
    const cg = parseInt(hex.slice(3, 5), 16)
    const cb = parseInt(hex.slice(5, 7), 16)

    // ── CLIP: center face uses INSCRIBED RECTANGLE (no mid-character cuts) ──
    // Peripheral faces use trapezoid clip (texture doesn't need perfect readability)
    lidarCtx.save()
    lidarCtx.beginPath()
    const lHit = hits[face.startX], rHit = hits[face.endX]

    // Compute inscribed rectangle: largest rect fully inside the trapezoid
    const inscribedTop = Math.max(lHit?.drawStart ?? face.minDrawStart, rHit?.drawStart ?? face.minDrawStart)
    const inscribedBot = Math.min(lHit?.drawEnd ?? face.maxDrawEnd, rHit?.drawEnd ?? face.maxDrawEnd)

    if (isCenter && faceW > 60) {
      // Rectangle clip — text never gets cut at perspective angles
      lidarCtx.rect(face.startX, inscribedTop, faceW, inscribedBot - inscribedTop)
    } else if (lHit && rHit) {
      // Trapezoid clip for peripheral faces
      lidarCtx.moveTo(face.startX, lHit.drawStart)
      lidarCtx.lineTo(face.endX + 1, rHit.drawStart)
      lidarCtx.lineTo(face.endX + 1, rHit.drawEnd)
      lidarCtx.lineTo(face.startX, lHit.drawEnd)
    } else {
      lidarCtx.rect(face.startX, face.minDrawStart, faceW, faceH)
    }
    lidarCtx.clip()

    // Background: dark zone-tinted base → brighter when closer
    const bgDarkness = Math.max(0.05, 0.3 - face.avgPerp * 0.02)
    lidarCtx.globalAlpha = 1
    lidarCtx.fillStyle = `rgb(${cr * bgDarkness | 0},${cg * bgDarkness | 0},${cb * bgDarkness | 0})`
    lidarCtx.fillRect(face.startX, face.minDrawStart, faceW, faceH)

    // Center face: use inscribed rect bounds for text area
    const textTop = isCenter ? inscribedTop : face.minDrawStart
    const textBot = isCenter ? inscribedBot : face.maxDrawEnd
    const textFaceH = textBot - textTop

    // Render media overlay if active
    const media = MOUNTAIN_MEDIA[face.loreKey]
    if (media && media.el) {
      lidarCtx.globalAlpha = 0.95
      try {
        lidarCtx.drawImage(media.el, face.startX, face.minDrawStart, faceW, faceH)
      } catch (e) { /* element might not be ready */ }
    }

    // Center face gets contrast overlay — dark at night, cream at day
    if (isCenter && faceW > 60) {
      if (media && media.el) {
         // Semi-transparent overlay so text is perfectly readable over bright dynamic media
         lidarCtx.globalAlpha = 0.55
         lidarCtx.fillStyle = '#050508'
         lidarCtx.fillRect(face.startX, textTop, faceW, textFaceH)
      } else {
         lidarCtx.globalAlpha = 0.94
         lidarCtx.fillStyle = isDaytime ? lerpColor('#050508', '#f5f0e5', dayGroundT) : '#050508'
         lidarCtx.fillRect(face.startX, textTop, faceW, textFaceH)
      }

      // Zone border frame
      lidarCtx.fillStyle = face.zone.color
      lidarCtx.globalAlpha = 0.7
      lidarCtx.fillRect(face.startX, textTop, faceW, 2)
      lidarCtx.fillRect(face.startX, textBot - 2, faceW, 2)
      lidarCtx.fillRect(face.startX, textTop, 2, textFaceH)
      lidarCtx.fillRect(face.endX - 1, textTop, 2, textFaceH)
    }

    // Font scales with distance: close = large readable, far = tiny texture
    const fontSize = isCenter
      ? Math.max(12, Math.min(18, textFaceH / 18))
      : Math.max(5, Math.min(14, faceH / 10))
    const lh = fontSize * 1.35
    const padding = isCenter ? Math.max(12, fontSize) : Math.max(3, fontSize * 0.4)

    // Get Pretext lines for this face width — measured at EXACT render font
    const textW = Math.max(10, faceW - padding * 2)
    const t0 = performance.now()
    const allLines = getWallLines(face.loreKey, textW, fontSize)
    lastPtMs = performance.now() - t0

    // Offset into text based on wall position — each face shows different lines
    // This prevents every wall segment from repeating the same opening text
    const faceHash = (face.mapX * 7 + face.mapY * 3 + face.side * 13) % Math.max(1, allLines.length)
    const lines: string[] = []
    for (let i = 0; i < allLines.length; i++) {
      lines.push(allLines[(faceHash + i) % allLines.length]!)
    }

    // Capture visible lines for context chat (center face only)
    if (isCenter) {
      // Estimate how many lines fit on screen
      const visibleCount = Math.floor((textBot - textTop - 30) / lh)
      lastFacedText = lines.slice(0, Math.max(10, visibleCount)).join(' ')
    }

    // Render style
    lidarCtx.font = `${fontSize}px Courier New`
    lidarCtx.textAlign = 'left'
    lidarCtx.textBaseline = 'top'

    if (isCenter && faceW > 60) {
      // ── CENTER FACE: Enhanced with hot-word highlighting ──
      lidarCtx.shadowColor = face.zone.color
      lidarCtx.shadowBlur = 2

      // Zone header
      lidarCtx.globalAlpha = 0.85
      lidarCtx.font = 'bold 11px Courier New'
      lidarCtx.fillStyle = face.zone.color
      
      let geo = ''
      const pos = ZONE_POSITIONS[face.loreKey]
      if (pos) {
          const dx = pos.x - MAP_CENTER
          const dy = pos.y - MAP_CENTER
          const angle = Math.atan2(dy, dx)
          const deg = (angle * 180 / Math.PI + 360) % 360
          const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']
          const cardinal = dirs[Math.round(deg / 45) % 8] || '?'
          const ns = dy <= 0 ? 'N' : 'S'
          const ew = dx >= 0 ? 'E' : 'W'
          geo = ` · ${Math.abs(dy * 0.0019).toFixed(4)}°${ns} ${Math.abs(dx * 0.0019).toFixed(4)}°${ew} · ${cardinal}`
      }
      const meta = PANEL_METADATA[face.loreKey]
      const timeStr = meta ? ` · LAST TRACE: ${new Date(meta.lastEditTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}` : ''
      
      lidarCtx.fillText(`[${face.zone.name}]${geo}${timeStr}`, face.startX + padding, textTop + 6)

      lidarCtx.font = `${fontSize}px Courier New`
      let ly = textTop + 22
      let lineIdx = 0

      while (ly < textBot - 4 && lineIdx < lines.length) {
        const txt = lines[lineIdx]!
        lidarCtx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)

        // Hot-word scan — ALL scene-graph words are interactive
        type Seg = { start: number; end: number; color: string; isPortal: boolean }
        const hotSegs: Seg[] = []
        const wallZone = face.loreKey // which zone this wall belongs to
        for (const [word, color] of Object.entries(HOT_WORDS)) {
            const node = CLUE_GRAPH[word]
            // Portal = word belongs to a DIFFERENT zone (clicking teleports)
            // Local = word belongs to THIS zone (clicking shows clue)
            const isPortal = node ? node.zone !== wallZone : true
            let idx = txt.toLowerCase().indexOf(word.toLowerCase())
            while (idx >= 0) {
              hotSegs.push({ start: idx, end: idx + word.length, color, isPortal })
              idx = txt.toLowerCase().indexOf(word.toLowerCase(), idx + word.length)
            }
          }
        hotSegs.sort((a, b) => a.start - b.start)

        let x = face.startX + padding
        if (hotSegs.length === 0) {
          lidarCtx.fillStyle = isDaytime ? lerpColor('#e8e0d0', '#1a1510', dayGroundT) : '#e8e0d0'
          lidarCtx.fillText(txt, x, ly)
        } else {
          let cur = 0
          for (const seg of hotSegs) {
            if (seg.start < cur) continue
            if (seg.start > cur) {
              const plain = txt.substring(cur, seg.start)
              lidarCtx.fillStyle = isDaytime ? lerpColor('#e8e0d0', '#1a1510', dayGroundT) : '#e8e0d0'
              lidarCtx.fillText(plain, x, ly)
              x += lidarCtx.measureText(plain).width
            }
            const hotText = txt.substring(seg.start, seg.end)
            const hotW = lidarCtx.measureText(hotText).width

            if (seg.isPortal) {
              // ═══ PORTAL: bright, glowing, underlined — click teleports ═══
              lidarCtx.fillStyle = seg.color
              lidarCtx.shadowColor = seg.color
              lidarCtx.shadowBlur = 10
              lidarCtx.fillText(hotText, x, ly)
              // Solid underline for portals
              lidarCtx.fillRect(x, ly + fontSize - 1, hotW, 2)
            } else {
              // ═══ LOCAL: warm glow, dotted underline — click shows clue ═══
              lidarCtx.fillStyle = seg.color
              lidarCtx.shadowColor = seg.color
              lidarCtx.shadowBlur = 4
              lidarCtx.globalAlpha = 0.75
              lidarCtx.fillText(hotText, x, ly)
              // Dotted underline for local keywords
              for (let dx = 0; dx < hotW; dx += 4) {
                lidarCtx.fillRect(x + dx, ly + fontSize - 1, 2, 1)
              }
              lidarCtx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)
            }
            // ALL keywords are clickable — record hit box
            hotWordHits.push({ x, y: ly, w: hotW, h: lh, word: hotText, color: seg.color, zone: face.loreKey })

            lidarCtx.shadowBlur = 2
            lidarCtx.shadowColor = face.zone.color
            x += hotW
            cur = seg.end
          }
          if (cur < txt.length) {
            lidarCtx.fillStyle = isDaytime ? lerpColor('#e8e0d0', '#1a1510', dayGroundT) : '#e8e0d0'
            lidarCtx.fillText(txt.substring(cur), x, ly)
          }
        }

        ly += lh
        lineIdx++
        if (lineIdx > 200) break
      }

      lidarCtx.shadowBlur = 0

      // Editor badge on center wall
      lidarCtx.font = 'bold 9px Courier New'
      lidarCtx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 0.3)
      if (editorActive && editorZone === face.loreKey) {
        lidarCtx.fillStyle = '#0ca'
        lidarCtx.fillText(`✎ EDITING · ${lines.length} LINES`, face.startX + padding, textBot - 12)
      } else {
        lidarCtx.fillStyle = '#0ca'
        lidarCtx.fillText(`CLICK TO EDIT · [E] · ${lines.length} LINES`, face.startX + padding, textBot - 12)
      }

      // Hover highlight on clickable hot words
      if (hoveredHotWord) {
        lidarCtx.globalAlpha = 0.3
        lidarCtx.strokeStyle = hoveredHotWord.color
        lidarCtx.lineWidth = 1.5
        lidarCtx.strokeRect(hoveredHotWord.x - 2, hoveredHotWord.y - 1, hoveredHotWord.w + 4, hoveredHotWord.h + 2)
        lidarCtx.globalAlpha = 0.08
        lidarCtx.fillStyle = hoveredHotWord.color
        lidarCtx.fillRect(hoveredHotWord.x - 2, hoveredHotWord.y - 1, hoveredHotWord.w + 4, hoveredHotWord.h + 2)
      }

      document.getElementById('sb-zone')!.innerText = face.zone.name

    } else {
      // ── PERIPHERAL WALLS: Text as material ──
      // Use bright readable text, not zone-colored (dark zones were invisible)
      lidarCtx.fillStyle = '#d4cfc0'

      let ly = face.minDrawStart + 2
      let lineIdx = 0
      while (ly < face.maxDrawEnd && lineIdx < lines.length) {
        const txt = lines[lineIdx]!
        lidarCtx.globalAlpha = bright * (0.55 + 0.15 * Math.sin(lineIdx * 0.5 + time * 0.3))
        lidarCtx.fillText(txt, face.startX + padding, ly)
        ly += lh
        lineIdx++
      }
    }

    // Zone edge accents
    lidarCtx.globalAlpha = bright * 0.4
    lidarCtx.fillStyle = face.zone.color
    lidarCtx.fillRect(face.startX, face.minDrawStart, 1, faceH)
    lidarCtx.fillRect(face.endX, face.minDrawStart, 1, faceH)

    lidarCtx.restore()
  }

  // ═══ LAYER 3: Investigation Tendrils ═══
  // When a clue is active, draw threads to all visible connected words
  if (activePursuit && hotWordHits.length > 0) {
    // Find the active word's hit box(es) on screen
    const activeHits = hotWordHits.filter(h => {
      const node = CLUE_GRAPH[h.word]
      return node === activePursuit
    })
    // Find all connected words' hit boxes on screen
    const connectedWords = new Set(activePursuit.connections)
    const targetHits = hotWordHits.filter(h => connectedWords.has(h.word))

    if (activeHits.length > 0 && targetHits.length > 0) {
      const ah = activeHits[0]! // primary source
      const ax = ah.x + ah.w / 2
      const ay = ah.y + ah.h / 2

      lidarCtx.lineWidth = 1.5
      let tCount = 0
      for (const th of targetHits) {
        if (tCount >= 12) break
        const tx = th.x + th.w / 2
        const ty = th.y + th.h / 2
        const cn = CLUE_GRAPH[th.word]
        const color = cn ? cn.color : activePursuit.color

        // Pulse alpha
        const pulse = 0.15 + 0.2 * Math.sin(time * 0.8 + tCount * 0.7)
        lidarCtx.globalAlpha = pulse
        lidarCtx.strokeStyle = color

        // Bezier thread
        const midX = (ax + tx) / 2
        const midY = Math.min(ay, ty) - 25 - 15 * Math.sin(time * 0.5 + tCount)

        lidarCtx.beginPath()
        lidarCtx.moveTo(ax, ay)
        lidarCtx.quadraticCurveTo(midX, midY, tx, ty)
        lidarCtx.stroke()

        // Glow dot at target
        lidarCtx.globalAlpha = pulse + 0.1
        lidarCtx.fillStyle = color
        lidarCtx.beginPath()
        lidarCtx.arc(tx, ty, 3, 0, Math.PI * 2)
        lidarCtx.fill()

        tCount++
      }
    }
    lidarCtx.globalAlpha = 1
  }
  // Fallback: zone-based tendrils when no pursuit is active
  else if (centerFace) {
    const cfx = (centerFace.startX + centerFace.endX) / 2
    const cfy = (centerFace.minDrawStart + centerFace.maxDrawEnd) / 2

    lidarCtx.lineWidth = 1.5
    lidarCtx.strokeStyle = centerFace.zone.color
    lidarCtx.globalAlpha = 0.25

    lidarCtx.beginPath()
    let threadCount = 0
    for (const f of faces) {
      if (f === centerFace) continue
      if (f.loreKey !== centerFace.loreKey) continue
      if (threadCount >= 8) break

      const fx = (f.startX + f.endX) / 2
      const fy = (f.minDrawStart + f.maxDrawEnd) / 2
      const midX = (cfx + fx) / 2
      const midY = Math.min(cfy, fy) - 30 - 20 * Math.sin(time * 0.7 + threadCount)

      lidarCtx.moveTo(cfx, cfy)
      lidarCtx.quadraticCurveTo(midX, midY, fx, fy)
      threadCount++
    }
    lidarCtx.stroke()
    lidarCtx.globalAlpha = 1
  }

  // ═══ LAYER 4: Particles, crosshair, ambient ═══

  // Floating particles in the corridor
  if (Math.random() < 0.1) spawnParticle()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.x += p.vx; p.y += p.vy; p.life++
    if (p.life > p.maxLife) { particles.splice(i, 1); continue }
    const a = Math.sin(Math.PI * p.life / p.maxLife) * 0.3
    lidarCtx.globalAlpha = a
    lidarCtx.fillStyle = '#daa520'
    lidarCtx.beginPath()
    lidarCtx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2)
    lidarCtx.fill()
  }

  lidarCtx.globalAlpha = 1

  // Crosshair
  lidarCtx.strokeStyle = '#fff'
  lidarCtx.lineWidth = 1
  lidarCtx.globalAlpha = 0.4
  lidarCtx.beginPath()
  lidarCtx.moveTo(cw / 2 - 10, ch / 2); lidarCtx.lineTo(cw / 2 + 10, ch / 2)
  lidarCtx.moveTo(cw / 2, ch / 2 - 10); lidarCtx.lineTo(cw / 2, ch / 2 + 10)
  lidarCtx.stroke()

  lidarCtx.globalAlpha = 1

  // Instructions — hide on narrow screens (touch controls replace them)
  if (cw > 600) {
    lidarCtx.font = 'bold 11px Courier New'
    lidarCtx.textAlign = 'center'
    lidarCtx.textBaseline = 'bottom'
    lidarCtx.fillStyle = '#555'
    const skyLabel = skyModeLock === 'auto' ? '' : skyModeLock === 'light' ? ' · ☀ LIGHT' : ' · ☽ DARK'
    lidarCtx.fillText(`WASD MOVE · SPACE SCAN · C CHAT · L MODE · 1-5 TELEPORT · ESC EXIT${skyLabel}`, cw / 2, ch - 12)
  }


  // ═══ MINIMAP with investigation web ═══

  const mmW = mmCanvas.width, mmH = mmCanvas.height
  mmCtx.fillStyle = '#0a0a0a'; mmCtx.fillRect(0, 0, mmW, mmH)
  const mmScale = mmW / Math.max(LIDAR_W, LIDAR_H)
  const mmCx = MAP_CENTER * mmScale, mmCy = MAP_CENTER * mmScale

  // Floor plan — draw BOTH floor and wall cells
  for (let my2 = 0; my2 < LIDAR_H; my2++) {
    for (let mx2 = 0; mx2 < LIDAR_W; mx2++) {
      const t = LIDAR_PLAN[my2]?.[mx2]
      if (!t || t === '#') continue

      if (t === '.') {
        // Floor — subtle warm tint so ring structure is visible
        mmCtx.fillStyle = '#1a1510'
        mmCtx.globalAlpha = 0.8
      } else {
        // Zone wall — full color
        const wk = WALL_LORE[t]
        const wz = wk ? (ZONES[wk.toUpperCase()] || null) : null
        mmCtx.fillStyle = wz ? wz.color : '#444'
        mmCtx.globalAlpha = 0.6
      }
      mmCtx.fillRect(mx2 * mmScale, my2 * mmScale, Math.ceil(mmScale), Math.ceil(mmScale))
    }
  }

  // Ring structure overlay — concentric circles for clarity
  mmCtx.globalAlpha = 0.25
  mmCtx.strokeStyle = '#666'
  mmCtx.lineWidth = 0.5
  const coreR = 5 // must match coreRadius
  const ringW = 6 // must match ringWidth
  const nZones = Object.keys(MOUNTAIN_LORE).length
  for (let z = 0; z <= nZones; z++) {
    const r = (coreR + z * ringW) * mmScale
    mmCtx.beginPath()
    mmCtx.arc(mmCx, mmCy, r, 0, Math.PI * 2)
    mmCtx.stroke()
  }

  // Cardinal corridor lines
  mmCtx.globalAlpha = 0.15
  mmCtx.strokeStyle = '#888'
  mmCtx.lineWidth = 1
  const totalR = (coreR + nZones * ringW) * mmScale
  mmCtx.beginPath()
  mmCtx.moveTo(mmCx, mmCy - totalR); mmCtx.lineTo(mmCx, mmCy + totalR) // N-S
  mmCtx.moveTo(mmCx - totalR, mmCy); mmCtx.lineTo(mmCx + totalR, mmCy) // E-W
  mmCtx.stroke()

  // Ring number labels
  mmCtx.globalAlpha = 0.4
  mmCtx.font = 'bold 7px Courier New'
  mmCtx.fillStyle = '#888'
  mmCtx.textAlign = 'center'
  mmCtx.textBaseline = 'middle'
  for (let z = 0; z < nZones; z++) {
    const labelR = (coreR + z * ringW + ringW / 2) * mmScale
    mmCtx.fillText(String(z + 1), mmCx + labelR * 0.7, mmCy - labelR * 0.7)
  }

  mmCtx.globalAlpha = 1

  // Zone center positions on minimap (from ZONE_POSITIONS)
  const mmZones: Record<string, { x: number; y: number }> = {}
  for (const [zone, pos] of Object.entries(ZONE_POSITIONS)) {
    mmZones[zone] = { x: pos.x * mmScale, y: pos.y * mmScale }
  }

  // Draw connection lines between clue nodes
  mmCtx.lineWidth = 0.5
  const drawnEdges = new Set<string>()
  for (const node of Object.values(CLUE_GRAPH)) {
    const from = mmZones[node.zone]
    if (!from) continue
    for (const conn of node.connections) {
      const cn = CLUE_GRAPH[conn]
      if (!cn) continue
      const edgeKey = [node.word, cn.word].sort().join('→')
      if (drawnEdges.has(edgeKey)) continue
      drawnEdges.add(edgeKey)

      // Only draw cross-zone connections (portals)
      if (cn.zone === node.zone) continue
      const to = mmZones[cn.zone]
      if (!to) continue

      // Spread endpoints slightly per node so lines don't all overlap
      const hashA = node.word.charCodeAt(0) % 7 - 3
      const hashB = cn.word.charCodeAt(0) % 7 - 3

      mmCtx.globalAlpha = (activePursuit && (activePursuit === node || activePursuit === cn)) ? 0.6 : 0.12
      mmCtx.strokeStyle = node.color
      mmCtx.beginPath()
      mmCtx.moveTo(from.x + hashA, from.y + hashA * 0.7)
      mmCtx.lineTo(to.x + hashB, to.y + hashB * 0.7)
      mmCtx.stroke()
    }
  }

  // Draw zone cluster dots
  mmCtx.globalAlpha = 1
  for (const [zone, pos] of Object.entries(mmZones)) {
    const zoneNodes = Object.values(CLUE_GRAPH).filter(n => n.zone === zone)
    const collected = zoneNodes.filter(n => n.collected).length
    const zoneColor = ZONES[zone.toUpperCase()]?.color || '#888'

    // Zone dot — size based on number of nodes
    const r = 3 + Math.min(4, zoneNodes.length * 0.3)
    mmCtx.fillStyle = zoneColor
    mmCtx.globalAlpha = 0.6
    mmCtx.beginPath()
    mmCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    mmCtx.fill()

    // Collected ring
    if (collected > 0) {
      mmCtx.globalAlpha = 0.8
      mmCtx.strokeStyle = '#fff'
      mmCtx.lineWidth = 1
      mmCtx.beginPath()
      mmCtx.arc(pos.x, pos.y, r + 1, 0, Math.PI * 2 * (collected / zoneNodes.length))
      mmCtx.stroke()
    }

    // Zone label
    mmCtx.globalAlpha = 0.5
    mmCtx.font = 'bold 6px Courier New'
    mmCtx.fillStyle = '#fff'
    mmCtx.textAlign = 'center'
    mmCtx.textBaseline = 'top'
    mmCtx.fillText(zone.charAt(0).toUpperCase(), pos.x, pos.y + r + 2)
  }

  // Active pursuit — pulse the home zone
  if (activePursuit) {
    const ap = mmZones[activePursuit.zone]
    if (ap) {
      const pulse = 4 + 2 * Math.sin(time * 2)
      mmCtx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 2)
      mmCtx.strokeStyle = activePursuit.color
      mmCtx.lineWidth = 1.5
      mmCtx.beginPath()
      mmCtx.arc(ap.x, ap.y, pulse, 0, Math.PI * 2)
      mmCtx.stroke()
    }
  }

  // Player position + direction
  mmCtx.globalAlpha = 1
  mmCtx.fillStyle = '#0ff'
  mmCtx.fillRect(player.x * mmScale - 2, player.y * mmScale - 2, 4, 4)
  mmCtx.strokeStyle = '#0ff'; mmCtx.lineWidth = 1
  mmCtx.beginPath()
  mmCtx.moveTo(player.x * mmScale, player.y * mmScale)
  mmCtx.lineTo((player.x + player.dirX * 2) * mmScale, (player.y + player.dirY * 2) * mmScale)
  mmCtx.stroke()
}

function lidarScan(): void {
  scanPulseTime = time
  // Show scanner output with Pretext-laid-out text for the nearest wall
  const lookX = Math.floor(player.x + player.dirX * 1.5)
  const lookY = Math.floor(player.y + player.dirY * 1.5)
  const tile = LIDAR_PLAN[lookY]?.[lookX]
  if (tile && tile !== '.') {
    const loreKey = WALL_LORE[tile] || ''
    if (loreKey) {
      const label = ZONE_LABELS[loreKey] || loreKey.toUpperCase()
      const lines = getWallLines(loreKey, 400)
      const scannerEl = document.getElementById('scanner-output')!
      scannerEl.textContent = `[LIDAR SCAN · ${label}]\n\n${lines.join('\n')}`
      scannerEl.classList.add('visible')
      setTimeout(() => scannerEl.classList.remove('visible'), 4000)
    }
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════════════════════
function loop(): void {
  requestAnimationFrame(loop)
  time += 0.02

  if (engineMode === 'GRID') {
    renderGrid()
  } else {
    renderLidar()
  }

  // HUD
  document.getElementById('pretext-hud')!.innerText = `PRETEXT · ${lastPtMs.toFixed(1)}ms`
  document.getElementById('sb-layout')!.innerText = `${lastPtMs.toFixed(1)}ms`
  document.getElementById('sb-mode')!.innerText = engineMode === 'GRID' ? viewMode : 'LIDAR'

  if (engineMode === 'LIDAR') {
    document.getElementById('ui-coords')!.innerText = `POS: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`
    // LLM status indicator
    const llmEl = document.getElementById('sb-llm')
    if (llmEl) {
      if (llmGenerating) {
        llmEl.innerText = '⟳ GENERATING...'
        llmEl.style.color = '#ff9922'
      } else if (llmUrl) {
        llmEl.innerText = llmStatus || 'G = GENERATE'
        llmEl.style.color = llmActive ? '#0fa' : '#888'
      } else {
        llmEl.innerText = 'SHEET A → CONNECT LLM'
        llmEl.style.color = '#555'
      }
    }
  } else {
    const hc = hoverCell
    document.getElementById('ui-coords')!.innerText = hc ? `LOC: ${hc.x - 16}, ${hc.y - 16}` : 'LOC: —'
  }
}

// ══════════════════════════════════════════════════════════════
// MODE SWITCHING
// ══════════════════════════════════════════════════════════════
function setMode(mode: 'GRID' | 'LIDAR'): void {
  engineMode = mode
  const lidarLayer = document.getElementById('lidar-layer')!
  const gridControls = document.getElementById('grid-controls')!
  const readerPanel = document.getElementById('reader-panel')!
  const btnLidar = document.getElementById('btn-lidar')!

  // Grid-only buttons — hide in LIDAR mode
  const gridOnlyBtns = ['btn-view', 'btn-recenter', 'btn-size-up', 'btn-size-dn']
  for (const id of gridOnlyBtns) {
    const el = document.getElementById(id)
    if (el) el.style.display = mode === 'LIDAR' ? 'none' : ''
  }

  if (mode === 'LIDAR') {
    lidarLayer.classList.add('active')
    gridControls.style.display = 'none'
    readerPanel.style.display = 'none'
    btnLidar.innerText = 'EXIT EDITOR'
    btnLidar.style.borderColor = '#0ca'
    btnLidar.style.color = '#0ca'
  } else {
    lidarLayer.classList.remove('active')
    gridControls.style.display = ''
    readerPanel.style.display = ''
    btnLidar.innerText = 'ENTER EDITOR'
    btnLidar.style.borderColor = ''
    btnLidar.style.color = ''
    // Close editor when leaving LiDAR
    if (editorActive) { editorClose() }
  }
}

// ══════════════════════════════════════════════════════════════
// CONTROLS
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-view')!.addEventListener('click', () => {
  viewMode = viewMode === 'TOPO' ? 'ORBIT' : 'TOPO'
  document.getElementById('btn-view')!.innerText = `VIEW: ${viewMode}`
})
document.getElementById('btn-recenter')!.addEventListener('click', () => { panX = 0; panY = 0; zoom = 1.2 })
document.getElementById('btn-size-up')!.addEventListener('click', () => { charSize = Math.min(24, charSize + 2); currentFont = '' })
document.getElementById('btn-size-dn')!.addEventListener('click', () => { charSize = Math.max(6, charSize - 2); currentFont = '' })
document.getElementById('btn-lidar')!.addEventListener('click', () => { setMode(engineMode === 'GRID' ? 'LIDAR' : 'GRID') })

// ══════════════════════════════════════════════════════════════
// DOCKED EDITOR BAR — EVENT WIRING
// ══════════════════════════════════════════════════════════════
document.getElementById('editor-bar-dismiss')!.addEventListener('click', () => editorClose())
;(document.getElementById('editor-bar-textarea') as HTMLTextAreaElement).addEventListener('input', () => editorLiveUpdate())
;(document.getElementById('editor-bar-textarea') as HTMLTextAreaElement).addEventListener('keydown', (e: KeyboardEvent) => {
  e.stopPropagation() // don't let WASD move player while typing
  if (e.key === 'Escape') { editorClose(); e.preventDefault() }
})

// Markdown export button
document.getElementById('btn-export-md')?.addEventListener('click', () => exportMarkdown())

// ── SHEET SYSTEM ──
let activeSheet: string | null = null

function openSheet(id: string): void {
  if (activeSheet === id) { closeSheets(); return }
  closeSheets(); activeSheet = id
  // Refresh dynamic sheets
  if (id === 'a') populateLoreSheet()
  if (id === 'b') populateCluesSheet()
  document.getElementById('sheet-backdrop')!.classList.add('on')
  document.getElementById(`sheet-${id}`)!.classList.add('on')
  document.getElementById(`tab-${id}`)!.classList.add('on')
}

function closeSheets(): void {
  activeSheet = null
  document.getElementById('sheet-backdrop')!.classList.remove('on')
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'))
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'))
}

for (const id of ['a', 'b', 'c', 'd']) {
  document.getElementById(`tab-${id}`)!.addEventListener('click', () => openSheet(id))
  document.getElementById(`close-${id}`)!.addEventListener('click', closeSheets)
}
document.getElementById('sheet-backdrop')!.addEventListener('click', closeSheets)

// Sheet A: Populate lore with Copy buttons per zone + Upload
const loreBody = document.getElementById('lore-body')!

// ── Sanitize JSON from LLM output — fix smart quotes, BOM, markdown fences ──
function sanitizeJSON(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')                     // BOM
    .replace(/^```json\s*/i, '')                // markdown fence open
    .replace(/^```\s*/m, '')                    // markdown fence close
    .replace(/```\s*$/m, '')                    // trailing fence
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // smart double quotes → straight
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // smart single quotes → straight
    .replace(/[\u2013\u2014]/g, '-')            // em/en dash → hyphen
    .replace(/[\u2026]/g, '...')                // ellipsis → dots
    .trim()
}

// ═══ ONE-SHOT IMPORT BUILDER (called at top of Sheet A) ═══
function buildOneShotImport(): void {
  // ═══ FULL IMPORT — one-shot JSON from LLM converter ═══
  const fullDiv = document.createElement('div')
  fullDiv.style.marginBottom = '20px'
  fullDiv.style.borderBottom = '1px solid #333'
  fullDiv.style.paddingBottom = '16px'
  fullDiv.innerHTML = `
    <div class="sh-label" style="color:#ff0;">⚡ ONE-SHOT IMPORT · LLM CONVERTER</div>
    <div style="font-size:10px; color:#888; margin-bottom:6px; line-height:1.5;">
      1. Click <strong>COPY SYSTEM PROMPT</strong> below<br>
      2. Paste into ChatGPT / Claude / Gemini as the system instruction<br>
      3. Paste your source text as the user message<br>
      4. Copy the LLM's JSON output and paste below<br>
      5. Click <strong>IMPORT ALL</strong> — zones + portals populate in one shot
    </div>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <button class="sh-btn" id="btn-copy-prompt" style="font-size:9px; padding:3px 10px; border-color:#ff0; color:#ff0;">⎘ COPY SYSTEM PROMPT</button>
      <span id="prompt-status" style="font-size:9px; color:#555; line-height:24px;">Ready</span>
    </div>
    <textarea id="full-import-text" style="width:100%; height:140px; background:#0a0a0a; color:#ccc; border:1px solid #444; padding:8px; font-family:Courier New; font-size:10px; resize:vertical;" placeholder='Paste the full JSON from the LLM here: {"zones":[...],"sceneGraph":[...]}'></textarea>
    <button class="sh-btn primary" id="btn-full-import" style="margin-top:6px; background:#ff0; border-color:#ff0; color:#000;">⚡ IMPORT ALL (ZONES + PORTALS)</button>
  `
  loreBody.appendChild(fullDiv)

  // System prompt text (embedded)
  const SYSTEM_PROMPT = `You are a Worldtext Architect. The user will give you a text — any text: a poem, a recipe, a legal document, a novel chapter, field notes, song lyrics, a Wikipedia article. Your job is to convert it into a structured JSON payload for the Golden Shield Worldtext Engine.

The engine has exactly 5 ZONES. Each zone is a room whose walls display text. Words that appear in multiple zones become clickable HYPERPORTALS that teleport the reader between rooms.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no explanation:

{
  "zones": [
    { "key": "shack", "label": "YOUR ZONE 1 NAME", "text": ["Line 1.", "Line 2.", "..."] },
    { "key": "creek", "label": "YOUR ZONE 2 NAME", "text": ["..."] },
    { "key": "ridge", "label": "YOUR ZONE 3 NAME", "text": ["..."] },
    { "key": "cave",  "label": "YOUR ZONE 4 NAME", "text": ["..."] },
    { "key": "puddle","label": "YOUR ZONE 5 NAME", "text": ["..."] }
  ],
  "sceneGraph": [
    { "word": "keyword", "zone": "shack", "connections": ["other_keyword"], "clue": "Short description." }
  ]
}

RULES FOR ZONES:
1. Zone keys MUST be exactly: shack, creek, ridge, cave, puddle (internal IDs).
2. Give each zone a descriptive "label" fitting the source text.
3. Split the source text into 5 thematic sections. Each becomes a zone.
4. Each "text" array: 5-30 lines. Each line is a complete sentence or thought.
5. Preserve the source author's language. Use direct quotes when possible.

RULES FOR SCENE GRAPH:
1. Identify 20-50 keywords. The engine highlights them on the walls and makes them clickable.
2. Each keyword gets a "zone" — its HOME zone where it is most important.
3. "connections" lists related keywords in OTHER zones — this creates the navigation web.
4. "clue" is 1-2 sentences: what is this word, why does it matter, what does it connect?
5. CRITICAL: The best portals are words whose HOME zone is different from the zone text they appear in. For example, if "gold" has zone "creek" but also appears in cave text ("golden clusters"), then "gold" becomes a glowing portal on the cave walls that teleports to creek. ACTIVELY PLANT keywords in other zones' text to create these cross-links.
6. Words that only appear in their own zone still work — they show as local references with a dotted underline and show clue text when clicked. But cross-zone words are the TELEPORTATION hyperlinks.
7. Aim for at least 3-5 cross-zone keywords per zone. Repeat important words in multiple zones' text arrays to create the portal web.
8. Use specific vocabulary: proper nouns, technical terms, repeated motifs, concrete objects.
9. Do NOT use common words (the, is, and) as portals. Use meaningful content words.
10. Multi-word keywords like "Pallas Minerva" work — they will be found as substrings in the text.`

  // Copy prompt handler
  document.getElementById('btn-copy-prompt')!.addEventListener('click', () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
      const s = document.getElementById('prompt-status')
      if (s) { s.innerText = 'COPIED ✓ — paste into any LLM'; s.style.color = '#ff0'
        setTimeout(() => { s.innerText = 'Ready'; s.style.color = '#555' }, 3000)
      }
    })
  })

  // Full import handler
  document.getElementById('btn-full-import')!.addEventListener('click', () => {
    const raw = (document.getElementById('full-import-text') as HTMLTextAreaElement).value.trim()
    if (!raw) return
    const promptStatus = document.getElementById('prompt-status')
    try {
      const data = JSON.parse(sanitizeJSON(raw)) as {
        zones?: { key: string; label: string; text: string[] }[]
        sceneGraph?: { word: string; zone: string; connections: string[]; clue: string }[]
      }

      // Import zones
      let zoneCount = 0
      if (data.zones && Array.isArray(data.zones)) {
        // Zone colors pulled from ZONES dynamically
        for (const z of data.zones) {
          if (!z.key || !z.text || !Array.isArray(z.text)) continue
          MOUNTAIN_LORE[z.key] = z.text
          LORE_FULL[z.key] = z.text.join(' ')
          if (z.label) renameZone(z.key, z.label)
          zoneCount++
        }
      }

      // Import scene graph
      let nodeCount = 0
      if (data.sceneGraph && Array.isArray(data.sceneGraph)) {
        for (const n of data.sceneGraph) {
          if (!n.word || !n.zone || !n.connections || !n.clue) continue
          const color = ZONES[n.zone.toUpperCase()]?.color || '#888'
          CLUE_GRAPH[n.word] = {
            word: n.word, color, zone: n.zone,
            connections: n.connections, clue: n.clue, collected: false,
          }
          HOT_WORDS[n.word] = color
          nodeCount++
        }
      }

      // Clear caches
      prepCache.clear()
      wallLineCache.clear()

      // Regenerate circular LiDAR map for the new zones
      generateCircularMap(Object.keys(MOUNTAIN_LORE))

      // Rebuild grid cells so walls use new text
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          gridState[y]![x] = compileCell(x, y)
        }
      }

      if (promptStatus) {
        promptStatus.innerText = `✓ ${zoneCount} zones + ${nodeCount} portals loaded`
        promptStatus.style.color = '#0fa'
        setTimeout(() => { promptStatus.innerText = 'Ready'; promptStatus.style.color = '#555' }, 4000)
      }
      ;(document.getElementById('full-import-text') as HTMLTextAreaElement).value = ''
      populateLoreSheet() // refresh display
    } catch (e) {
      if (promptStatus) {
        promptStatus.innerText = `ERROR: ${(e as Error).message}`
        promptStatus.style.color = '#f44'
        setTimeout(() => { promptStatus.innerText = 'Ready'; promptStatus.style.color = '#555' }, 4000)
      }
    }
  })

  // ═══ LLM CONFIGURATION — OpenAI GPT-4o by default ═══
  const llmDiv = document.createElement('div')
  llmDiv.style.cssText = 'margin-top:16px; border-top:1px solid #333; padding-top:12px;'
  const isConnected = llmKey.length > 0
  const statusColor = isConnected ? '#0fa' : '#ff0'
  const statusText = isConnected ? `✓ Connected: ${llmModel}` : 'Paste API key to connect'
  llmDiv.innerHTML = `
    <div style="color:#0ff; font-size:10px; letter-spacing:2px; margin-bottom:8px;">🤖 LLM ENGINE · <span style="color:${statusColor}; font-size:9px;">${statusText}</span></div>
    <div style="font-size:9px; color:#888; margin-bottom:8px;">Paste your OpenAI API key below. Press C in LIDAR to chat with any wall text. Responses write onto the walls.</div>
    <div style="display:flex; gap:6px; margin-bottom:6px;">
      <input type="password" id="llm-key-input" placeholder="sk-... (OpenAI API Key)" 
        value="${llmKey}" style="flex:1; background:#0a0a0a; color:#ccc; border:1px solid ${isConnected ? '#0fa' : '#444'}; padding:6px 10px; font-size:11px; font-family:Courier New;">
      <button class="sh-btn" id="btn-llm-connect" style="font-size:10px; padding:4px 16px; border-color:#0ff; color:#0ff;">${isConnected ? '✓ CONNECTED' : 'CONNECT'}</button>
    </div>
    <details style="margin-top:6px;">
      <summary style="cursor:pointer; color:#555; font-size:9px;">Advanced: change model or API endpoint</summary>
      <div style="display:flex; gap:6px; margin-top:6px;">
        <input type="text" id="llm-url-input" placeholder="API URL" 
          value="${llmUrl}" style="flex:2; min-width:180px; background:#0a0a0a; color:#888; border:1px solid #222; padding:4px 8px; font-size:9px;">
        <input type="text" id="llm-model-input" placeholder="Model" 
          value="${llmModel}" style="flex:1; min-width:60px; background:#0a0a0a; color:#888; border:1px solid #222; padding:4px 8px; font-size:9px;">
      </div>
    </details>
  `
  loreBody.appendChild(llmDiv)

  document.getElementById('btn-llm-connect')!.addEventListener('click', () => {
    const url = (document.getElementById('llm-url-input') as HTMLInputElement).value.trim()
    const model = (document.getElementById('llm-model-input') as HTMLInputElement).value.trim()
    const key = (document.getElementById('llm-key-input') as HTMLInputElement).value.trim()
    if (url) {
      llmUrl = url
      llmModel = model || 'llama3'
      llmKey = key || ''
      populateLoreSheet() // refresh to show connected status
    }
  })
}

function populateLoreSheet(): void {
  loreBody.innerHTML = ''
  buildOneShotImport() // ⚡ ONE-SHOT IMPORT goes at the top
  for (const [key, texts] of Object.entries(MOUNTAIN_LORE)) {
    const zone = ZONES[key.toUpperCase()] || Object.values(ZONES)[0]!
    const div = document.createElement('div')
    div.style.marginBottom = '16px'
    div.innerHTML =
      `<div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="sh-label" style="color:${zone.color}">${zone.name} (${texts.length} lines)</div>
        <button class="sh-btn copy-zone-btn" data-zone="${key}" style="font-size:9px; padding:2px 8px;">COPY</button>
      </div>` +
      texts.slice(0, 20).map(t => `<div style="font-size:11px; color:#aaa; padding:3px 0; border-bottom:1px solid #1a1a1a;">${t}</div>`).join('') +
      (texts.length > 20 ? `<div style="font-size:10px; color:#555; padding:4px;">... +${texts.length - 20} more</div>` : '')
    loreBody.appendChild(div)
  }

  // Copy buttons
  loreBody.querySelectorAll('.copy-zone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoneKey = (btn as HTMLElement).dataset.zone!
      const text = (MOUNTAIN_LORE[zoneKey] || []).join('\n')
      navigator.clipboard.writeText(text).then(() => {
        (btn as HTMLElement).innerText = 'COPIED ✓'
        setTimeout(() => { (btn as HTMLElement).innerText = 'COPY' }, 1500)
      })
    })
  })

  // Upload area
  const uploadDiv = document.createElement('div')
  uploadDiv.style.marginTop = '16px'
  const zoneOptions = Object.entries(ZONE_LABELS).map(([k, v]) =>
    `<option value="${k}">${v}</option>`
  ).join('')
  uploadDiv.innerHTML = `
    <div class="sh-label" style="color:#0fa;">UPLOAD TEXT</div>
    <div style="font-size:10px; color:#666; margin-bottom:6px;">Paste text below. Each line becomes a wall entry. Use REPLACE to clear old text first.</div>
    <div style="display:flex; gap:8px; margin-bottom:6px; align-items:center;">
      <select id="upload-zone" style="background:#1a1a1a; color:#ccc; border:1px solid #333; padding:4px 8px; font-size:11px; flex:1;">
        ${zoneOptions}
      </select>
      <input type="text" id="rename-zone" placeholder="Rename zone..." style="background:#1a1a1a; color:#ccc; border:1px solid #333; padding:4px 8px; font-size:10px; width:120px;">
      <button class="sh-btn" id="btn-rename-zone" style="font-size:9px; padding:2px 8px; min-height:auto;">RENAME</button>
    </div>
    <textarea id="upload-text" style="width:100%; height:120px; background:#0a0a0a; color:#ccc; border:1px solid #333; padding:8px; font-family:Courier New; font-size:11px; resize:vertical;" placeholder="Paste any text here: Homer, recipes, law, field notes..."></textarea>
    <div style="display:flex; gap:8px; margin-top:6px;">
      <button class="sh-btn primary" id="btn-upload-lore" style="flex:1;">INJECT INTO WALLS</button>
      <button class="sh-btn" id="btn-replace-lore" style="flex:1;">REPLACE (CLEAR + INJECT)</button>
    </div>
  `
  loreBody.appendChild(uploadDiv)

  // Rename handler
  document.getElementById('btn-rename-zone')!.addEventListener('click', () => {
    const zoneKey = (document.getElementById('upload-zone') as HTMLSelectElement).value
    const newName = (document.getElementById('rename-zone') as HTMLInputElement).value.trim()
    if (newName) {
      renameZone(zoneKey, newName)
      populateLoreSheet()
    }
  })

  // Upload handler
  document.getElementById('btn-upload-lore')!.addEventListener('click', () => {
    const zoneKey = (document.getElementById('upload-zone') as HTMLSelectElement).value
    const text = (document.getElementById('upload-text') as HTMLTextAreaElement).value.trim()
    if (!text) return
    const lines = text.split('\n').filter(l => l.trim().length > 5)
    if (lines.length > 0) {
      injectLore(zoneKey, lines)
      prepCache.clear();
      (document.getElementById('upload-text') as HTMLTextAreaElement).value = ''
      populateLoreSheet() // refresh counts
    }
  })

  // Replace handler (clear + inject)
  document.getElementById('btn-replace-lore')!.addEventListener('click', () => {
    const zoneKey = (document.getElementById('upload-zone') as HTMLSelectElement).value
    const text = (document.getElementById('upload-text') as HTMLTextAreaElement).value.trim()
    if (!text) return
    const lines = text.split('\n').filter(l => l.trim().length > 5)
    if (lines.length > 0) {
      MOUNTAIN_LORE[zoneKey] = [] // clear
      injectLore(zoneKey, lines)
      prepCache.clear();
      (document.getElementById('upload-text') as HTMLTextAreaElement).value = ''
      populateLoreSheet()
    }
  })

  // ═══ SCENE GRAPH — upload/export clue linkages ═══
  const graphDiv = document.createElement('div')
  graphDiv.style.marginTop = '20px'
  graphDiv.style.borderTop = '1px solid #333'
  graphDiv.style.paddingTop = '16px'
  graphDiv.innerHTML = `
    <div class="sh-label" style="color:#ff8c00;">⬡ SCENE GRAPH · HYPERPORTAL LINKAGES</div>
    <div style="font-size:10px; color:#666; margin-bottom:8px; line-height:1.4;">
      Export the current clue graph or upload new nodes. Each node becomes a clickable hyperportal on the walls.<br>
      Format: <code style="color:#0fa; font-size:9px;">[{"word":"lamp","zone":"cave","connections":["beam","flashlight"],"clue":"Oil lamp. 1842 vintage."}]</code>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <button class="sh-btn" id="btn-export-graph" style="font-size:9px; padding:3px 10px;">⬇ EXPORT GRAPH JSON</button>
      <button class="sh-btn" id="btn-copy-graph" style="font-size:9px; padding:3px 10px;">⎘ COPY TO CLIPBOARD</button>
      <span id="graph-status" style="font-size:9px; color:#555; line-height:24px;">${Object.keys(CLUE_GRAPH).length} nodes</span>
    </div>
    <textarea id="upload-graph" style="width:100%; height:100px; background:#0a0a0a; color:#ccc; border:1px solid #333; padding:8px; font-family:Courier New; font-size:10px; resize:vertical;" placeholder='[{"word":"lamp","zone":"cave","connections":["beam"],"clue":"Oil lamp."}]'></textarea>
    <button class="sh-btn primary" id="btn-upload-graph" style="margin-top:6px;">MERGE INTO SCENE GRAPH</button>
  `
  loreBody.appendChild(graphDiv)

  // Export handler
  document.getElementById('btn-export-graph')!.addEventListener('click', () => {
    const exported = Object.values(CLUE_GRAPH).map(n => ({
      word: n.word, zone: n.zone, connections: n.connections,
      clue: n.clue, collected: n.collected,
    }))
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `golden-shield-graph-${Date.now()}.json`
    link.href = URL.createObjectURL(blob); link.click()
  })

  // Copy handler
  document.getElementById('btn-copy-graph')!.addEventListener('click', () => {
    const exported = Object.values(CLUE_GRAPH).map(n => ({
      word: n.word, zone: n.zone, connections: n.connections, clue: n.clue,
    }))
    navigator.clipboard.writeText(JSON.stringify(exported, null, 2)).then(() => {
      const s = document.getElementById('graph-status')
      if (s) { s.innerText = 'COPIED ✓'; s.style.color = '#0fa'
        setTimeout(() => { s.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; s.style.color = '#555' }, 1500)
      }
    })
  })

  // Upload/merge handler
  document.getElementById('btn-upload-graph')!.addEventListener('click', () => {
    const raw = (document.getElementById('upload-graph') as HTMLTextAreaElement).value.trim()
    if (!raw) return
    const statusEl = document.getElementById('graph-status')
    try {
      const nodes = JSON.parse(sanitizeJSON(raw)) as { word: string; zone: string; connections: string[]; clue: string }[]
      if (!Array.isArray(nodes)) throw new Error('Expected array')

      let added = 0
      for (const n of nodes) {
        if (!n.word || !n.zone || !n.connections || !n.clue) continue
        const color = ZONES[n.zone.toUpperCase()]?.color || '#888'
        CLUE_GRAPH[n.word] = {
          word: n.word, color, zone: n.zone,
          connections: n.connections, clue: n.clue, collected: false,
        }
        HOT_WORDS[n.word] = color
        added++
      }

      // Clear caches so walls re-render with new keywords
      prepCache.clear()
      wallLineCache.clear()

      if (statusEl) {
        statusEl.innerText = `+${added} nodes merged (${Object.keys(CLUE_GRAPH).length} total)`
        statusEl.style.color = '#0fa'
        setTimeout(() => { statusEl.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; statusEl.style.color = '#555' }, 3000)
      }
      ;(document.getElementById('upload-graph') as HTMLTextAreaElement).value = ''
    } catch (e) {
      if (statusEl) {
        statusEl.innerText = `ERROR: ${(e as Error).message}`
        statusEl.style.color = '#f44'
        setTimeout(() => { statusEl.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; statusEl.style.color = '#555' }, 4000)
      }
    }
  })

}
populateLoreSheet()

// Sheet B: Collected Clues Journal (dynamic)
const csprBody = document.getElementById('cspr-body')!
function populateCluesSheet(): void {
  csprBody.innerHTML = ''
  if (collectedClues.length === 0) {
    csprBody.innerHTML = `<div style="color:#555; font-size:12px; padding:20px; text-align:center;">No clues collected yet.<br>Click glowing words on the walls to begin your investigation.</div>`
    return
  }

  // Summary header
  const total = Object.keys(CLUE_GRAPH).length
  const header = document.createElement('div')
  header.innerHTML = `<div style="color:#daa520; font-size:11px; letter-spacing:2px; margin-bottom:12px;">INVESTIGATION LOG · ${collectedClues.length}/${total} CLUES COLLECTED</div>`
  csprBody.appendChild(header)

  // Each collected clue — now clickable for navigation
  for (const node of collectedClues) {
    const div = document.createElement('div')
    div.style.cssText = 'border-bottom:1px solid #1a1a1a; padding:8px 0; cursor:pointer;'
    div.addEventListener('mouseenter', () => { div.style.background = '#111' })
    div.addEventListener('mouseleave', () => { div.style.background = '' })
    const connections = node.connections.map(c => {
      const cn = CLUE_GRAPH[c]
      const color = cn ? cn.color : '#666'
      const mark = cn?.collected ? '✓' : '○'
      return `<span class="clue-conn-link" data-word="${c}" style="color:${color}; font-size:10px; margin-right:8px; cursor:pointer; text-decoration:underline dotted;">${mark} ${c}</span>`
    }).join('')
    div.innerHTML = `
      <div style="color:${node.color}; font-weight:bold; font-size:12px; text-transform:uppercase;">
        ▸ ${node.word} <span style="color:#555; font-size:9px; font-weight:normal;">${ZONE_LABELS[node.zone] || node.zone.toUpperCase()} · CLICK TO NAVIGATE</span>
      </div>
      <div style="color:#999; font-size:11px; line-height:1.4; margin:4px 0;">${node.clue}</div>
      <div style="margin-top:4px;">${connections}</div>
    `
    // Click the clue word → navigate to its zone in LiDAR
    div.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('clue-conn-link')) return // handled below
      navigateToZone(node.zone)
    })
    csprBody.appendChild(div)
  }

  // Connection links → navigate to that word's zone
  csprBody.querySelectorAll('.clue-conn-link').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const word = (el as HTMLElement).dataset.word
      if (word) {
        const cn = CLUE_GRAPH[word]
        if (cn) navigateToZone(cn.zone)
      }
    })
  })
}

// Sheet C: Lens config
;(document.getElementById('range-size') as HTMLInputElement).addEventListener('input', function () { charSize = parseInt(this.value, 10); currentFont = '' })
;(document.getElementById('range-coalesce') as HTMLInputElement).addEventListener('input', function () { coalesceRadius = parseInt(this.value, 10) })
;(document.getElementById('range-speed') as HTMLInputElement).addEventListener('input', function () { waveSpeed = parseInt(this.value, 10) })
document.getElementById('btn-rel-on')!.addEventListener('click', () => { showRelations = true })
document.getElementById('btn-rel-off')!.addEventListener('click', () => { showRelations = false })

// Sheet D: Document management
document.getElementById('btn-export-png')!.addEventListener('click', () => {
  const c = engineMode === 'GRID' ? canvas : lidarCanvas
  const link = document.createElement('a')
  link.download = `golden-egg-${Date.now()}.png`; link.href = c.toDataURL('image/png'); link.click()
})
document.getElementById('btn-export-lore')!.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(MOUNTAIN_LORE, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `golden-egg-lore-${Date.now()}.json`; link.href = URL.createObjectURL(blob); link.click()
})

// ── MEDIA UPLOAD ──
document.getElementById('btn-attach-media')?.addEventListener('click', () => {
  document.getElementById('media-upload')?.click()
})
document.getElementById('media-upload')?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !editorZone) return
  const url = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video')
  
  if (isVideo) {
    const video = document.createElement('video')
    video.src = url
    video.playsInline = true
    video.autoplay = true
    video.loop = true
    video.muted = true
    video.play().catch(e => console.error("Video play failed:", e))
    MOUNTAIN_MEDIA[editorZone] = { type: 'video', url, el: video }
  } else {
    const img = new Image()
    img.src = url
    MOUNTAIN_MEDIA[editorZone] = { type: 'image', url, el: img }
  }
  // Clear file input
  ;(e.target as HTMLInputElement).value = ''
})

// Build new monolith
document.getElementById('btn-build-monolith')?.addEventListener('click', () => {
  const newIdx = Object.keys(MOUNTAIN_LORE).length + 1
  const key = `panel_${newIdx}`
  MOUNTAIN_LORE[key] = [`(blank panel ${newIdx})`]
  LORE_FULL[key] = `(blank panel ${newIdx})`
  ZONE_LABELS[key] = `PANEL ${newIdx}`
  const gridColors = ['#daa520', '#4682b4', '#cd853f', '#5f9ea0', '#9370db', '#8fbc8f', '#bc8f8f', '#f4a460']
  ZONES[key.toUpperCase()] = {
    name: `PANEL ${newIdx}`,
    color: gridColors[newIdx % gridColors.length]!,
    minR: 0, maxR: 999,
    flavor: `PANEL ${newIdx}`
  }
  generateEmptyFieldMap(Object.keys(MOUNTAIN_LORE))
  // Close the menu
  document.getElementById('sheet-d')?.classList.remove('on')
  document.getElementById('sheet-backdrop')?.classList.remove('on')
  if (editorActive) editorClose()
  navigateToZone(key)
})

// New blank document
document.getElementById('btn-new-doc')?.addEventListener('click', () => {
  if (!confirm('Start a new blank document? Current text will be cleared.')) return
  const zoneKeys = Object.keys(MOUNTAIN_LORE)
  for (const key of zoneKeys) {
    MOUNTAIN_LORE[key] = ['(blank — press E on this wall to start writing)']
    LORE_FULL[key] = MOUNTAIN_LORE[key]!.join(' ')
  }
  wallLineCache.clear()
  prepCache.clear()
  editorPersist()
  if (editorActive) editorClose()
  // Recompile grid cells
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      gridState[y]![x] = compileCell(x, y)
    }
  }
})

// Clear all saved data
document.getElementById('btn-clear-data')?.addEventListener('click', () => {
  if (!confirm('Clear all saved data? This cannot be undone.')) return
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  location.reload()
})

// ── START ──
loop()

// ═══ MOBILE TOUCH CONTROLS ═══
// Virtual joystick + action buttons for touch devices
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  const touchUI = document.createElement('div')
  touchUI.id = 'mobile-controls'
  touchUI.style.cssText = `position:fixed; bottom:0; left:0; right:0; z-index:9990;
    pointer-events:none; display:block;`

  // Virtual joystick (left side)
  const joystick = document.createElement('div')
  joystick.style.cssText = `position:absolute; bottom:20px; left:20px; width:120px; height:120px;
    border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15);
    pointer-events:auto; touch-action:none;`
  const joyKnob = document.createElement('div')
  joyKnob.style.cssText = `position:absolute; width:40px; height:40px; border-radius:50%;
    background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.3);
    left:40px; top:40px; transition:none;`
  joystick.appendChild(joyKnob)
  touchUI.appendChild(joystick)

  let joyActive = false
  let joyDx = 0, joyDy = 0

  joystick.addEventListener('touchstart', e => { e.preventDefault(); joyActive = true }, { passive: false })
  joystick.addEventListener('touchmove', e => {
    e.preventDefault()
    const rect = joystick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    const t = e.touches[0]!
    joyDx = Math.max(-1, Math.min(1, (t.clientX - cx) / 50))
    joyDy = Math.max(-1, Math.min(1, (t.clientY - cy) / 50))
    joyKnob.style.left = `${40 + joyDx * 30}px`
    joyKnob.style.top = `${40 + joyDy * 30}px`
  }, { passive: false })
  joystick.addEventListener('touchend', () => {
    joyActive = false; joyDx = 0; joyDy = 0
    joyKnob.style.left = '40px'; joyKnob.style.top = '40px'
  })

  // Map joystick to keys every frame
  setInterval(() => {
    if (!joyActive || engineMode !== 'LIDAR') return
    keys['w'] = joyDy < -0.3
    keys['s'] = joyDy > 0.3
    keys['a'] = joyDx < -0.3  // strafe left
    keys['d'] = joyDx > 0.3   // strafe right
    // Rotation via horizontal edges
    keys['arrowleft'] = joyDx < -0.6
    keys['arrowright'] = joyDx > 0.6
  }, 50)

  // Action buttons (right side)
  const btnContainer = document.createElement('div')
  btnContainer.style.cssText = `position:absolute; bottom:20px; right:12px; display:flex;
    flex-direction:column; gap:8px; pointer-events:auto;`

  const mobileActions: [string, string, () => void][] = [
    ['EDIT', '✎', () => { if (lastFacedLoreKey) editorOpen(lastFacedLoreKey) }],
    ['SCAN', '⊕', () => lidarScan()],
    ['CHAT', 'C', () => { if (lastFacedLoreKey) openContextChat() }],
    ['☀/☽', 'L', () => { skyModeLock = skyModeLock === 'auto' ? 'light' : skyModeLock === 'light' ? 'dark' : 'auto' }],
    ['EXIT', '✕', () => setMode('GRID')],
  ]

  for (const [label, icon, action] of mobileActions) {
    const btn = document.createElement('button')
    btn.style.cssText = `width:48px; height:48px; border-radius:50%; background:rgba(0,0,0,0.6);
      border:1px solid rgba(255,255,255,0.2); color:#daa520; font-family:Courier New;
      font-size:10px; touch-action:none; display:flex; flex-direction:column;
      align-items:center; justify-content:center; line-height:1.1;`
    btn.innerHTML = `<span style="font-size:14px;">${icon}</span><span style="font-size:7px; color:#888;">${label}</span>`
    btn.addEventListener('touchstart', e => { e.preventDefault(); action() }, { passive: false })
    btnContainer.appendChild(btn)
  }

  // Zone teleport row
  const zoneRow = document.createElement('div')
  zoneRow.style.cssText = 'display:flex; gap:4px; margin-top:4px;'
  for (let z = 0; z <= 5; z++) {
    const zBtn = document.createElement('button')
    zBtn.style.cssText = `width:22px; height:22px; border-radius:4px; background:rgba(0,0,0,0.5);
      border:1px solid rgba(255,255,255,0.15); color:#aaa; font-size:9px; font-family:Courier New;
      touch-action:none;`
    zBtn.textContent = String(z)
    zBtn.addEventListener('touchstart', e => {
      e.preventDefault()
      if (z === 0) {
        playerGlideTarget = { x: MAP_CENTER + 0.5, y: MAP_CENTER + 0.5 }
      } else {
        const zKeys = Object.keys(MOUNTAIN_LORE)
        if (z <= zKeys.length) {
          const pos = ZONE_POSITIONS[zKeys[z - 1]!]
          if (pos) playerGlideTarget = { x: pos.x + 0.5, y: pos.y + 0.5 }
        }
      }
    }, { passive: false })
    zoneRow.appendChild(zBtn)
  }
  btnContainer.appendChild(zoneRow)
  touchUI.appendChild(btnContainer)
  document.body.appendChild(touchUI)

  // Show/hide with mode changes
  const mobileObserver = new MutationObserver(() => {
    touchUI.style.display = engineMode === 'LIDAR' ? 'block' : 'none'
  })
  mobileObserver.observe(document.getElementById('lidar-layer')!, { attributes: true, attributeFilter: ['class'] })
}
