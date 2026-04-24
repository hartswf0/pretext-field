// ══════════════════════════════════════════════════════════════
// ARGO · OPERATIVE CARTOGRAPHY
//
// Three navigable scales + LLM operator cascade + image generation
// architecture and white-field design system.
//
//   1. VORONOI — bird's-eye topographic map (OrbitControls)
//   2. WALLS  — ground-level monolithic text panels (PointerLock)
//   3. SPHERE — photosphere interior (PointerLock / BackSide)
//
// Extracted from:
//   - Achilles v2: Three.js renderer, EffectComposer, ShaderMaterial,
//     tab-bar, node strip, hover tips, context ring, photosphere
//   - Twine Bridge: WLES colors, node cards, timeline, Voronoi math
//   - ICARO-PRO: tab-bar A/B/C/D sheet architecture
//   - Golden Egg: WorldText editor surface
//
// Kill Criteria enforced:
//   - Three.js is the SOLE visual engine
//   - Gold Egg Canvas 2D raycaster is DEAD
//   - Typography is a TEXTURE FACTORY (OffscreenCanvas → texture)
// ══════════════════════════════════════════════════════════════

import * as THREE from 'three'
import { prepare, layoutWithLines } from '../../src/layout.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// PointerLockControls removed — walk mode uses canvas raycaster
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// ── Import headless core ──
import {
  type WorldNode,
  type WorldGraph,
  type WLESCategory,
  compile,
  createNode,
  createGraph,
  addNode,
  connectNodes,
  nodesByCategory,
  layoutGraph,
  assignZones,
  serializeGraph,
  OPERATORS,
} from '../../golden-fleece/src/core/index.js'

// Declare window globals from HTML shell
declare global {
  interface Window {
    showBanner: (kicker: string, text: string, durationMs?: number) => void
    execNav: (id: string) => void
    closeAllSheets: () => void
  }
}

// ══════════════════════════════════════════════════════════════
// NAVIGATION SCALE
// ══════════════════════════════════════════════════════════════
type Scale = 'voronoi' | 'flat' | 'walk' | 'sphere'
let currentScale: Scale = 'voronoi'
let activeNodeId: string | null = null
let hoveredNodeId: string | null = null

// ══════════════════════════════════════════════════════════════
// WORLD STATE — the single AST
// ══════════════════════════════════════════════════════════════
const DEMO_TEXT = `
world <Colchis> {
  location <Aeaea> { description: "Island of Circe, where herb gardens cover terraced cliffs above a rocky bronze-gated shore." }
  location <Iolcus> { description: "Port city in Thessaly with stone quays, a fish market, and the agora where Jason spoke." }
  location <Sacred Grove> { description: "Oak forest in Colchis where the Golden Fleece hangs on a branch guarded by a sleepless dragon." }
  entity <Jason> : character { traits: ["exiled prince","leader of Argonauts"] }
  entity <Medea> : character { traits: ["sorceress","daughter of Aeetes"] }
  entity <Golden Fleece> : object { traits: ["divine ram's skin","guarded by dragon"] }
  entity <Argo> : structure { traits: ["fifty-oared ship","built by Argus"] }
  entity <Hercules> : character { traits: ["demigod","bronze club"] }
  entity <Dragon> : creature { traits: ["sleepless","coiled around oak"] }
  rel [commands](<Jason> -> <Argo>)
  rel [guards](<Dragon> -> <Golden Fleece>)
  rel [enchants](<Medea> -> <Dragon>)
  rel [seeks](<Jason> -> <Golden Fleece>)
  rel [sails_from](<Argo> -> <Iolcus>)
  rel [allies_with](<Jason> -> <Medea>)
  rel [crew_of](<Hercules> -> <Argo>)
  state <Jason.status> = exiled
  state <Dragon.state> = sleepless
  state <Golden Fleece.location> = sacred grove
  event <Departure> { actors: [<Jason>,<Argo>], effects: ["voyage begins from Iolcus"] }
  event <Arrival at Colchis> { actors: [<Jason>,<Medea>], effects: ["alliance formed"] }
  event <Theft of Fleece> { actors: [<Jason>,<Medea>,<Dragon>], effects: ["Medea sings dragon to sleep"] }
}
`

// Compile and layout
const compiled = compile(DEMO_TEXT)
const graph = compiled.graph
layoutGraph(graph, { width: 200, height: 200, iterations: 80 })
assignZones(graph, 16)

// Populate editor
const editor = document.getElementById('wt-editor') as HTMLTextAreaElement
if (editor) editor.value = DEMO_TEXT.trim()

// ══════════════════════════════════════════════════════════════
// WLES COLOR SYSTEM — extracted from Twine Bridge
// WCAG safe: high contrast against both #f4f4f0 and #000
// ══════════════════════════════════════════════════════════════
const WLES_COLORS: Record<WLESCategory | string, number> = {
  root:     0x1a1a1a,   // black for root
  site:     0x0033cc,   // Achilles Act A blue
  inverter: 0x00884a,   // strong green
  aphorist: 0xcc0000,   // Achilles Act C red
  analyst:  0x6633cc,   // violet
}

function wlesColor(cat: WLESCategory): number {
  return WLES_COLORS[cat] ?? 0x333333
}

function wlesHex(cat: WLESCategory): string {
  return '#' + wlesColor(cat).toString(16).padStart(6, '0')
}

const WLES_NAMES: Record<string, string> = {
  root: 'ROOT', site: 'WORLD', inverter: 'LOCATION',
  aphorist: 'ENTITY', analyst: 'STATE',
}

// ══════════════════════════════════════════════════════════════
// THREE.JS SETUP — Achilles v2 quality bar
// ══════════════════════════════════════════════════════════════
const wrap = document.getElementById('three-wrap')!
const W = wrap.clientWidth
const H = wrap.clientHeight

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(W, H)
renderer.setClearColor(0xeae7e0) // Achilles parchment bg
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
wrap.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xeae7e0)

const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000)
camera.position.set(300, 350, 550)
camera.lookAt(300, 0, 300)

// ── Post-processing (extracted from Achilles v2) ──
const composer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(W, H),
  0.15,  // strength — subtle, not cyberpunk
  0.6,   // radius
  0.85   // threshold
)
composer.addPass(bloomPass)

// ── Controls ──
const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.enableDamping = true
orbitControls.dampingFactor = 0.12
orbitControls.rotateSpeed = 0.6
orbitControls.zoomSpeed = 0.8
orbitControls.panSpeed = 0.5
orbitControls.target.set(300, 0, 300)
orbitControls.maxPolarAngle = Math.PI * 0.48
orbitControls.minPolarAngle = Math.PI * 0.05
orbitControls.minDistance = 80
orbitControls.maxDistance = 1600
orbitControls.enablePan = true
orbitControls.screenSpacePanning = false
orbitControls.update()

// Walk + flat canvases (no PointerLock — golden-egg style)
const walkCanvas = document.getElementById('walk-canvas') as HTMLCanvasElement
const walkCtx = walkCanvas.getContext('2d')!
const flatCanvas = document.getElementById('flat-canvas') as HTMLCanvasElement
const flatCtx = flatCanvas.getContext('2d')!

// ── Lighting — warm white-field ──
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffeedd, 0.9)
dirLight.position.set(80, 120, 60)
dirLight.castShadow = false
scene.add(dirLight)

const fillLight = new THREE.DirectionalLight(0xccddff, 0.3)
fillLight.position.set(-40, 60, -40)
scene.add(fillLight)

// ══════════════════════════════════════════════════════════════
// UNIFIED COORDINATE SYSTEM
// All subsystems (Voronoi floor, meshes, walls) share this.
// Floor plane: FLOOR_SIZE×FLOOR_SIZE centered at (CENTER, 0, CENTER)
// Node spatial coords (0-200 from headless layout) → world XZ
// ══════════════════════════════════════════════════════════════
const FLOOR_SIZE = 600
const CENTER = FLOOR_SIZE / 2
const FLOOR_HALF = FLOOR_SIZE / 2
const FLOOR_PAD = 40 // Inset from floor edge

// Cached mapping state — computed once per layout, used by all systems
let _mapMinX = 0, _mapMinY = 0, _mapSpanX = 1, _mapSpanY = 1
function computeMapping(): void {
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 2) return
  const xs = nodes.map(n => n.spatial.x)
  const ys = nodes.map(n => n.spatial.y)
  _mapMinX = Math.min(...xs)
  _mapMinY = Math.min(...ys)
  _mapSpanX = (Math.max(...xs) - _mapMinX) || 1
  _mapSpanY = (Math.max(...ys) - _mapMinY) || 1
}

// Node spatial → world XZ (both floor and meshes use this)
function nodeWorldX(node: WorldNode): number {
  const t = (node.spatial.x - _mapMinX) / _mapSpanX
  return CENTER - FLOOR_HALF + FLOOR_PAD + t * (FLOOR_SIZE - FLOOR_PAD * 2)
}
function nodeWorldZ(node: WorldNode): number {
  const t = (node.spatial.y - _mapMinY) / _mapSpanY
  return CENTER - FLOOR_HALF + FLOOR_PAD + t * (FLOOR_SIZE - FLOOR_PAD * 2)
}

// World XZ → canvas UV for Voronoi floor texture
function worldToCanvasX(wx: number, canvasW: number): number {
  return ((wx - (CENTER - FLOOR_HALF)) / FLOOR_SIZE) * canvasW
}
function worldToCanvasY(wz: number, canvasH: number): number {
  return ((wz - (CENTER - FLOOR_HALF)) / FLOOR_SIZE) * canvasH
}

computeMapping()

// ══════════════════════════════════════════════════════════════
// PHYSICS SIMULATION — Twine Bridge physTick()
// Velocity/damping on nodes, glow decay, ripple propagation
// ══════════════════════════════════════════════════════════════
interface NodePhysics {
  vx: number; vy: number
  glow: number    // 0–1 decay
  run: number     // spinner animation
}
const nodePhysics = new Map<string, NodePhysics>()
function getPhys(nodeId: string): NodePhysics {
  if (!nodePhysics.has(nodeId)) nodePhysics.set(nodeId, { vx: 0, vy: 0, glow: 0, run: 0 })
  return nodePhysics.get(nodeId)!
}

let phRunning = false
function physTick(): void {
  let dirty = false
  for (const [id, phys] of nodePhysics) {
    const node = graph.nodes.get(id)
    if (!node) continue
    if (Math.abs(phys.vx) > 0.05 || Math.abs(phys.vy) > 0.05) {
      node.spatial.x += phys.vx * 0.5
      node.spatial.y += phys.vy * 0.5
      phys.vx *= 0.8
      phys.vy *= 0.8
      dirty = true
    }
    if (phys.glow > 0) { phys.glow = Math.max(0, phys.glow - 0.014); dirty = true }
    if (phys.run > 0) { phys.run += 0.04; dirty = true }
  }
  // Process ripple decay
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i]!
    const t = (performance.now() - rp.t0) / rp.dur
    if (t >= 1) { ripples.splice(i, 1); dirty = true }
    else if (t >= 0) dirty = true
  }
  if (dirty) {
    computeMapping()
    for (const [id, nm] of nodeMeshMap) {
      const node = graph.nodes.get(id)
      if (!node) continue
      nm.group.position.set(nodeWorldX(node), 0, nodeWorldZ(node))
    }
    drawVoronoiFloor(hoveredNodeId, activeNodeId)
  } else {
    phRunning = false
  }
}
function startPhys(): void {
  if (phRunning) return
  phRunning = true
  ;(function loop() {
    physTick()
    if (phRunning) requestAnimationFrame(loop)
  })()
}
function hapPush(node: WorldNode, fx: number, fy: number, str = 8): void {
  const phys = getPhys(node.id)
  const dx = node.spatial.x - fx, dy = node.spatial.y - fy
  const d = Math.sqrt(dx * dx + dy * dy) || 1
  phys.vx += (dx / d) * str; phys.vy += (dy / d) * str
  phys.glow = 1
  startPhys()
}
function hapSpawn(node: WorldNode, str = 4): void {
  const phys = getPhys(node.id)
  phys.vx = (Math.random() - 0.5) * str
  phys.vy = (Math.random() - 0.5) * str
  phys.glow = 0.6
  startPhys()
}

// ══════════════════════════════════════════════════════════════
// VORONOI NEIGHBOR AFFINITY — Twine Bridge nbMap + border %
// Shared border length = affinity strength
// ══════════════════════════════════════════════════════════════
const nbMap = new Map<string, Map<string, number>>()

function computeAffinity(): void {
  nbMap.clear()
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 2) return

  const d3 = (window as any).d3
  const points: [number, number][] = nodes.map(n => [nodeWorldX(n), nodeWorldZ(n)])
  const delaunay = d3.Delaunay.from(points)
  const voronoi = delaunay.voronoi([
    CENTER - FLOOR_HALF, CENTER - FLOOR_HALF,
    CENTER + FLOOR_HALF, CENTER + FLOOR_HALF,
  ])

  // Compute shared border length between adjacent cells
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i]!
    if (!nbMap.has(n1.id)) nbMap.set(n1.id, new Map())
    for (const j of voronoi.neighbors(i)) {
      const n2 = nodes[j]!
      // Approximate shared border length from cell polygons
      const cell1 = voronoi.cellPolygon(i)
      const cell2 = voronoi.cellPolygon(j)
      if (!cell1 || !cell2) continue
      let sharedLen = 0
      for (let k = 0; k < cell1.length - 1; k++) {
        const [ax, ay] = cell1[k]!
        const [bx, by] = cell1[k + 1]!
        // Check if this edge is shared with cell2
        for (let m = 0; m < cell2.length - 1; m++) {
          const [cx, cy] = cell2[m]!
          const [dx, dy] = cell2[m + 1]!
          const d1 = Math.hypot(ax - cx, ay - cy) + Math.hypot(bx - dx, by - dy)
          const d2 = Math.hypot(ax - dx, ay - dy) + Math.hypot(bx - cx, by - cy)
          if (Math.min(d1, d2) < 2) {
            sharedLen += Math.hypot(bx - ax, by - ay)
            break
          }
        }
      }
      if (sharedLen > 0) {
        nbMap.get(n1.id)!.set(n2.id, sharedLen)
      }
    }
  }
}

interface AffinityEntry { node: WorldNode; len: number; pct: number }
function getNeighbors(node: WorldNode): AffinityEntry[] {
  const m = nbMap.get(node.id)
  if (!m) return []
  const raw: { node: WorldNode; len: number }[] = []
  for (const [id, len] of m) {
    const n = graph.nodes.get(id)
    if (n) raw.push({ node: n, len })
  }
  const mL = Math.max(...raw.map(x => x.len), 1)
  return raw.map(({ node: n, len }) => ({
    node: n, len, pct: Math.round((len / mL) * 100),
  })).filter(x => x.pct >= 8).sort((a, b) => b.pct - a.pct)
}

// Build spatial context string for LLM operator calls (Twine Bridge buildCtx pattern)
function buildSpatialContext(node: WorldNode): string {
  const nbs = getNeighbors(node)
  if (!nbs.length) return ''
  return '\n\nSPATIAL CONTEXT — neighboring nodes (higher % = stronger influence on output):\n' +
    nbs.slice(0, 3).map(({ node: nb, pct }) =>
      `- ${WLES_NAMES[nb.category] ?? nb.category} "${nb.text.slice(0, 80)}" (${pct}% border affinity)`
    ).join('\n') +
    '\nLet these contexts inflect the direction of your analysis.'
}

// ══════════════════════════════════════════════════════════════
// RIPPLE PROPAGATION — Twine Bridge fireRipple()
// Visual cascade from node through neighbor graph
// ══════════════════════════════════════════════════════════════
interface Ripple {
  nodeId: string
  t0: number    // start time
  dur: number   // duration ms
  s: number     // strength
}
const ripples: Ripple[] = []

function fireRipple(node: WorldNode, strength = 1): void {
  const visited = new Set<string>([node.id])
  const queue: { nodeId: string; depth: number; s: number }[] = [
    { nodeId: node.id, depth: 0, s: strength },
  ]
  while (queue.length) {
    const { nodeId, depth, s } = queue.shift()!
    const n = graph.nodes.get(nodeId)
    if (!n) continue
    ripples.push({
      nodeId, t0: performance.now() + depth * 88,
      dur: 650 + depth * 48, s,
    })
    const phys = getPhys(nodeId)
    phys.glow = Math.max(phys.glow, 0.35 * s)
    if (s > 0.1) {
      const nbs = getNeighbors(n)
      const mL = Math.max(...nbs.map(x => x.len), 1)
      for (const { node: nb, len } of nbs) {
        if (!visited.has(nb.id)) {
          visited.add(nb.id)
          queue.push({ nodeId: nb.id, depth: depth + 1, s: s * (0.25 + (len / mL) * 0.35) })
        }
      }
    }
  }
  startPhys()
}

function getRippleGlow(nodeId: string): number {
  const now = performance.now()
  let r = 0
  for (const rp of ripples) {
    if (rp.nodeId !== nodeId) continue
    const t = (now - rp.t0) / rp.dur
    if (t >= 0 && t < 1) r += rp.s * (1 - t)
  }
  return Math.min(r, 1)
}

// ══════════════════════════════════════════════════════════════
// POML OPERATORS — Twine Bridge prompt engineering system
// Sophisticated narrative operators for LLM-driven world building
// ══════════════════════════════════════════════════════════════
const BASE_SYS = `You are a WORLD COMPILER. You analyze and extend narrative structures with extreme specificity.

RULES:
- Name every entity, location, mechanic, and relation explicitly.
- Be concrete: materials, colors, sounds, temperatures, distances, timestamps.
- Avoid filler adjectives (mysterious, enigmatic, cryptic). Show don't tell.
- Every sentence must contain either a PROPER NOUN, a SPECIFIC MECHANIC, or a CAUSAL LINK.
- Prefer short declarative sentences over long flowing prose.
- Reference exact elements from the source text.
- Output should read like a technical bible, not a fantasy novel.`

interface POMLOperator {
  lbl: string
  hue: number
  verb: string
  category: string
  usageCount: number
  sys?: string
}
const OPS: Record<string, POMLOperator> = {
  fork: {
    lbl: 'FORK', hue: 320, verb: 'Generate 2-4 branching paths', category: 'Narrative', usageCount: 0,
    sys: `You are a NARRATIVE FORKING ENGINE. Generate exactly 3 distinct paths from the source material.

REQUIREMENTS:
- Each fork must diverge on a DIFFERENT AXIS: one spatial, one temporal, one causal.
- Name every character, object, and location with a specific proper noun.
- State what physically changes. What breaks? What appears? What moves where?
- Each fork: 2-3 paragraphs MAX. Dense. No filler.

FORMAT:
FORK 1: [Specific Action Title]
[Concrete, specific narrative.]

FORK 2: [Different Axis Title]
[Different direction entirely.]

FORK 3: [Third Axis Title]
[Structural reversal or perspective shift.]`,
  },
  surface: { lbl: 'SURFACE', hue: 205, verb: 'trace causal chains', category: 'Reveal', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Trace hidden causal chains between entities. What relations connect entities? What event sequences unfold? Map causality not visible from names alone.` },
  limits: { lbl: 'LIMITS', hue: 270, verb: 'find narrative bottlenecks', category: 'Structure', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Identify narrative bottlenecks. Which entities concentrate the most relations? Where does story flow narrow through a single entity? Name exact choke points.` },
  modes: { lbl: 'MODES', hue: 148, verb: 'find parallel storylines', category: 'Reveal', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Identify parallel storylines. Which entities appear in multiple threads? Which events unfold independently? Map the parallel narratives.` },
  manip: { lbl: 'MANIP', hue: 35, verb: 'trace action→reaction chains', category: 'Manipulate', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Trace action-reaction chains. For each entity action: what event triggers? What state change? Build explicit cause→effect→consequence chains.` },
  zoom: { lbl: 'ZOOM', hue: 168, verb: 'decompose world hierarchy', category: 'Structure', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Decompose world hierarchy. Level 1: genre/theme. Level 2: entity groups. Level 3: individual states and events.` },
  play: { lbl: 'PLAY', hue: 38, verb: 'identify counterfactuals', category: 'Manipulate', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Identify counterfactuals. What if key entity removed? What cascades? What becomes impossible?` },
  holistic: { lbl: 'HOLISTIC', hue: 355, verb: 'full world audit', category: 'Meta', usageCount: 0,
    sys: `${BASE_SYS}\nDIRECTIVE: Full world audit. Entity census, relation graph, event timeline, state inventory, bottleneck, counterfactual.` },
}
let currentOp = 'fork'

// ── Token Burn Tracker ──
const tokenBurn = { total: 0, session: 0, calls: 0 }
function trackTokens(usage: { prompt_tokens?: number; completion_tokens?: number }): void {
  const total = (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
  tokenBurn.total += total
  tokenBurn.session += total
  tokenBurn.calls++
}

// ══════════════════════════════════════════════════════════════
// OPENAI IMAGE GENERATION — gpt-image-2 / gpt-image-1 fallback
// Extracted from Achilles v2 with budget + fallback chain
// ══════════════════════════════════════════════════════════════
const IMAGE_MODEL_PRIMARY = 'gpt-image-2'
const IMAGE_MODEL_FALLBACK = 'gpt-image-1'
const IMAGE_QUALITY = 'medium'         // low | medium | high
const IMAGE_SIZE = '1536x1024'         // 2:1 equirectangular for photospheres
const TEXT_MODEL = 'gpt-4.1-mini'      // LLM for operator analysis
const IMAGE_PREPROMPT = `Operative ekphrasis for one site-specific film-previsualization photosphere.
Render one place only, as a seamless equirectangular 360 photosphere.
Preserve site identity across variants. The image must feel like a production design still from one standing camera position inside the place.
Honor material consequence: waterlines, rust bloom, glass fog, salt bloom, cables, beams, roots, reeds, sediment, lamps, concrete failure, moss, rot, and thresholds.
Prefer one coherent scene with one horizon and one embodied standing viewpoint.
No typography, labels, diagrams, charts, split panels, collage, contact sheets, posters, UI, or decorative borders.
No cutaway object showcase. No floating product render. No multiple disconnected scenes.`

const COST_TABLE: Record<string, number> = { low: 0.005, medium: 0.041, high: 0.165 }

interface APIState {
  apiKey: string
  preferredModel: string
  costUsd: number
  imageCount: number
  lastError: string
  generating: boolean
  hardCapUsd: number
}

const apiState: APIState = {
  apiKey: localStorage.getItem('gf_api_key') ?? '',
  preferredModel: IMAGE_MODEL_PRIMARY,
  costUsd: 0,
  imageCount: 0,
  lastError: '',
  generating: false,
  hardCapUsd: 2.00,  // Safety cap: $2.00 per session
}

function updateAPIDot(): void {
  const dot = document.getElementById('api-dot')
  const status = document.getElementById('api-status')
  const costEl = document.getElementById('api-cost')
  const countEl = document.getElementById('api-count')
  const healthEl = document.getElementById('api-health')
  const modelEl = document.getElementById('api-model')
  if (!dot || !status) return

  if (apiState.generating) {
    dot.style.background = '#ffaa00'
    healthEl!.textContent = 'GENERATING…'
    healthEl!.style.color = '#ffaa00'
  } else if (apiState.lastError) {
    dot.style.background = '#e60000'
    healthEl!.textContent = 'ERROR'
    healthEl!.style.color = '#e60000'
  } else if (apiState.apiKey) {
    dot.style.background = '#00cc44'
    healthEl!.textContent = 'READY'
    healthEl!.style.color = '#00cc44'
  } else {
    dot.style.background = '#666'
    healthEl!.textContent = 'IDLE'
    healthEl!.style.color = '#666'
  }
  status!.textContent = apiState.apiKey ? `KEY SET · ${apiState.preferredModel}` : 'NO KEY'
  costEl!.textContent = `$${apiState.costUsd.toFixed(3)}`
  costEl!.style.color = apiState.costUsd > 1.0 ? '#e60000' : apiState.costUsd > 0.5 ? '#ffaa00' : 'inherit'
  countEl!.textContent = String(apiState.imageCount)
  modelEl!.textContent = apiState.preferredModel
}

// Key management
document.getElementById('btn-api-save')?.addEventListener('click', () => {
  const input = document.getElementById('api-key-input') as HTMLInputElement
  const key = input.value.trim()
  if (!key) return
  apiState.apiKey = key
  localStorage.setItem('gf_api_key', key)
  apiState.lastError = ''
  updateAPIDot()
  window.showBanner('API', 'OpenAI key saved')
})
document.getElementById('btn-api-clear')?.addEventListener('click', () => {
  apiState.apiKey = ''
  localStorage.removeItem('gf_api_key')
  ;(document.getElementById('api-key-input') as HTMLInputElement).value = ''
  apiState.lastError = ''
  updateAPIDot()
  window.showBanner('API', 'Key cleared')
})
// Restore saved key
if (apiState.apiKey) {
  const inp = document.getElementById('api-key-input') as HTMLInputElement
  if (inp) inp.value = apiState.apiKey.slice(0, 3) + '•'.repeat(12)
}
updateAPIDot()

// ── Core image request with fallback chain ──
async function requestImage(prompt: string, model: string): Promise<{ url: string; model: string }> {
  const body = { model, prompt, quality: IMAGE_QUALITY, size: IMAGE_SIZE, output_format: 'b64_json', n: 1 }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiState.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.error(`[ARGO/IMG] ${model} ${res.status}:`, txt.slice(0, 300))
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  apiState.costUsd += COST_TABLE[IMAGE_QUALITY] ?? 0.041
  apiState.imageCount++
  const item = data?.data?.[0]
  if (!item?.b64_json) throw new Error('No image payload in response')
  return { url: `data:image/png;base64,${item.b64_json}`, model }
}

async function generateImage(prompt: string): Promise<string | null> {
  if (!apiState.apiKey) {
    window.showBanner('API', 'No API key set — open D · API + EXPORT tab')
    return null
  }
  if (apiState.costUsd >= apiState.hardCapUsd) {
    window.showBanner('API', `Budget cap $${apiState.hardCapUsd.toFixed(2)} reached`)
    return null
  }
  if (apiState.generating) {
    window.showBanner('API', 'Generation in progress — please wait')
    return null
  }

  apiState.generating = true
  apiState.lastError = ''
  updateAPIDot()

  const models = [apiState.preferredModel, apiState.preferredModel === IMAGE_MODEL_PRIMARY ? IMAGE_MODEL_FALLBACK : IMAGE_MODEL_PRIMARY]

  for (const model of models) {
    try {
      const result = await requestImage(prompt, model)
      apiState.preferredModel = model
      apiState.generating = false
      apiState.lastError = ''
      updateAPIDot()
      console.log(`[ARGO/IMG] ${model} OK · $${apiState.costUsd.toFixed(3)} total`)
      window.showBanner('IMAGE', `Generated with ${model} · $${apiState.costUsd.toFixed(3)} total`)
      return result.url
    } catch (err: any) {
      const msg = String(err.message || err)
      apiState.lastError = msg
      console.warn(`[ARGO/IMG] ${model} failed:`, msg.slice(0, 120))
      // Auto-retry on 429 — log reset time
      if (msg.includes('429')) {
        const waitSec = 30
        const resetTime = new Date(Date.now() + waitSec * 1000).toLocaleTimeString()
        console.warn(`[ARGO/IMG] Rate limited — waiting ${waitSec}s · Reset ~${resetTime}`)
        window.showBanner('IMAGE', `Rate limited — retrying in ${waitSec}s (reset ~${resetTime})`)
        await new Promise(r => setTimeout(r, waitSec * 1000))
        try {
          const result = await requestImage(prompt, model)
          apiState.preferredModel = model
          apiState.generating = false
          apiState.lastError = ''
          updateAPIDot()
          return result.url
        } catch (_) { /* fall through to next model */ }
      }
      continue
    }
  }

  apiState.generating = false
  updateAPIDot()
  window.showBanner('API ERROR', apiState.lastError.slice(0, 80))
  return null
}

// ── LLM Text Analysis — gpt-4.1-mini for operator reasoning ──
async function requestLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!apiState.apiKey) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiState.apiKey}` },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`[ARGO/LLM] ${TEXT_MODEL} ${res.status}:`, txt.slice(0, 300))
      // Auto-retry on 429 rate limit — read Retry-After header
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60')
        const waitSec = Math.min(120, Math.max(10, retryAfter))
        const resetTime = new Date(Date.now() + waitSec * 1000).toLocaleTimeString()
        console.warn(`[ARGO/LLM] Rate limited — Retry-After: ${retryAfter}s · Will reset ~${resetTime}`)
        window.showBanner('LLM', `Rate limited — retrying in ${waitSec}s (reset ~${resetTime})`)
        await new Promise(r => setTimeout(r, waitSec * 1000))
        return requestLLM(systemPrompt, userPrompt)  // Retry once
      }
      throw new Error(`LLM ${res.status}: ${txt.slice(0, 200)}`)
    }
    const data = await res.json()
    console.log(`[ARGO/LLM] ${TEXT_MODEL} OK — ${data.usage?.total_tokens ?? '?'} tokens`)
    if (data.usage) trackTokens(data.usage)
    const burnEl = document.getElementById('token-burn')
    if (burnEl) burnEl.textContent = `${tokenBurn.total / 1000 | 0}k`
    return data.choices?.[0]?.message?.content ?? null
  } catch (err: any) {
    console.error('[ARGO/LLM] Error:', err.message || err)
    apiState.lastError = String(err.message || err)
    return null
  }
}

// ══════════════════════════════════════════════════════════════
// LLM EVENT LOG — spatiotemporal timeline of all operator firings
// ══════════════════════════════════════════════════════════════
interface LLMEvent {
  id: string
  epoch: number
  nodeId: string
  nodeName: string
  operator: string
  opHue: number
  analysis: string
  isCascade: boolean
  parentEventId?: string
  depth: number
}

const llmEvents: LLMEvent[] = []

function addLLMEvent(evt: LLMEvent): void {
  llmEvents.push(evt)
  renderTimelineEvents()
}

function renderTimelineEvents(): void {
  const strip = document.getElementById('tl-event-strip')
  if (!strip) return
  strip.innerHTML = ''
  for (const evt of llmEvents) {
    const card = document.createElement('div')
    card.className = `tl-event${evt.isCascade ? ' cascade' : ''}`
    const timeStr = new Date(evt.epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    card.innerHTML = `
      <div class="tl-event-bar" style="background:hsl(${evt.opHue},68%,45%);"></div>
      <div class="tl-event-op" style="color:hsl(${evt.opHue},68%,45%);">${evt.operator}</div>
      <div class="tl-event-node">${evt.nodeName}</div>
      <div class="tl-event-time">${timeStr}${evt.isCascade ? ' · cascade' : ''}</div>
    `
    card.addEventListener('click', () => {
      const node = graph.nodes.get(evt.nodeId)
      if (node) {
        showInspector(node)
        focusNode(node)
        const panel = document.getElementById('inspector-panel')
        if (panel) {
          const analysisDiv = document.createElement('div')
          analysisDiv.style.cssText = 'margin-top:12px; padding:10px; border:2px solid #000; background:#f8f7f4; font-size:12px; line-height:1.5; max-height:300px; overflow-y:auto;'
          analysisDiv.innerHTML = `
            <div class="sh-label" style="color:hsl(${evt.opHue},68%,45%);">${evt.operator} ANALYSIS${evt.isCascade ? ' (CASCADE)' : ''}</div>
            <div style="white-space:pre-wrap; font-family:var(--serif); margin-top:6px;">${evt.analysis}</div>
          `
          panel.appendChild(analysisDiv)
        }
      }
    })
    strip.appendChild(card)
  }
  strip.scrollLeft = strip.scrollWidth
}

// ── Operator Firing — LLM analysis + ripple cascade + timeline ──
async function fireOperator(node: WorldNode, depth = 0, parentEventId?: string, parentAnalysis?: string): Promise<void> {
  const op = OPS[currentOp]
  if (!op) return

  if (!apiState.apiKey) {
    window.showBanner('API', 'No API key set — open D · API + EXPORT tab (key 4)')
    return
  }

  // Cascade depth limit + cooldown guard
  if (depth > 3) {
    console.warn('[ARGO/API] Cascade depth limit (3) reached — stopping')
    return
  }
  if (apiState.generating) {
    window.showBanner('API', 'Request already in progress — please wait')
    return
  }

  const nbs = getNeighbors(node)
  const spatialCtx = nbs.map(({ node: nb, pct }) =>
    `- ${WLES_NAMES[nb.category] ?? nb.category} "${nb.text}" (${pct}% border affinity)`
  ).join('\n')

  const catName = WLES_NAMES[node.category] ?? node.category
  const isCascade = depth > 0

  // Auto-snapshot before mutation (only on root fires, not cascades)
  if (!isCascade && typeof captureSnapshot === 'function') {
    captureSnapshot(`${op.lbl}`)
  }

  op.usageCount++
  fireRipple(node)
  if (!isCascade) {
    window.showBanner('OPERATOR', `Firing ${op.lbl} on "${node.text}"…`)
  } else {
    window.showBanner('CASCADE', `${op.lbl} ripple → "${node.text}" (depth ${depth})`)
  }
  updateAPIDot()

  let userPrompt = `WORLD CONTEXT:
Entity: "${node.text}" [${catName}]
Valence: ${node.valence}
Operator: ${op.lbl} — ${op.verb}

SPATIAL NEIGHBORS (higher % = closer spatial relationship):
${spatialCtx || '(no neighbors)'}
`

  if (isCascade && parentAnalysis) {
    userPrompt += `
PRIOR ANALYSIS FROM NEIGHBORING NODE:
${parentAnalysis.slice(0, 600)}

Continue this analysis from the perspective of "${node.text}". How does this entity respond to, amplify, or resist the findings above? Be specific and concrete.`
  } else {
    userPrompt += `\nAnalyze this entity through the ${op.lbl} lens. Be specific, concrete, and surgical.`
  }

  const analysis = await requestLLM(op.sys ?? BASE_SYS, userPrompt)
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  if (analysis) {
    addLLMEvent({
      id: eventId,
      epoch: Date.now(),
      nodeId: node.id,
      nodeName: node.text,
      operator: op.lbl,
      opHue: op.hue,
      analysis,
      isCascade,
      parentEventId,
      depth,
    })

    if (!isCascade || activeNodeId === node.id) {
      const panel = document.getElementById('inspector-panel')
      if (panel) {
        const analysisDiv = document.createElement('div')
        analysisDiv.style.cssText = 'margin-top:12px; padding:10px; border:2px solid #000; background:#f8f7f4; font-size:12px; line-height:1.5; max-height:300px; overflow-y:auto;'
        analysisDiv.innerHTML = `
          <div class="sh-label" style="color:hsl(${op.hue},68%,45%);">${op.lbl} ANALYSIS${isCascade ? ' (CASCADE)' : ''}</div>
          <div style="white-space:pre-wrap; font-family:var(--serif); margin-top:6px;">${analysis}</div>
          <button class="sh-btn primary" style="margin-top:8px; background:hsl(${op.hue},68%,45%); color:white;"
            onclick="window._generateImageForNode('${node.id}')">GENERATE PHOTOSPHERE IMAGE</button>
        `
        panel.appendChild(analysisDiv)
      }
    }

    if (!isCascade) {
      window.showBanner(op.lbl, `Analysis complete for "${node.text}" — cascading…`)
    }

    // ── RIPPLE CASCADE: auto-fire on top 2 neighbors ──
    if (depth < 2 && nbs.length > 0) {
      const cascadeTargets = nbs.slice(0, 2)
      for (const { node: nb } of cascadeTargets) {
        await new Promise(r => setTimeout(r, 800))
        await fireOperator(nb, depth + 1, eventId, analysis)
      }
    }
  } else {
    window.showBanner('LLM', apiState.lastError ? `Error: ${apiState.lastError.slice(0, 60)}` : 'No response')
  }
  updateAPIDot()
}

// ── Image generation (phase 2, triggered from analysis panel) ──
;(window as any)._generateImageForNode = async (id: string) => {
  const node = graph.nodes.get(id)
  if (!node) return
  const op = OPS[currentOp]
  if (!op) return

  const nbs = getNeighbors(node)
  const spatialCtx = nbs.map(({ node: nb, pct }) =>
    `- ${WLES_NAMES[nb.category] ?? nb.category} "${nb.text}" (${pct}% border affinity)`
  ).join('\n')
  const catName = WLES_NAMES[node.category] ?? node.category

  const imgPrompt = `${IMAGE_PREPROMPT}

WORLD CONTEXT:
Entity: "${node.text}" [${catName}]
Valence: ${node.valence}
Operator: ${op.lbl} — ${op.verb}

SPATIAL NEIGHBORS (higher % = closer spatial relationship):
${spatialCtx || '(no neighbors)'}

Generate an immersive equirectangular photosphere interior for this location.
The scene must embody the ${catName.toLowerCase()} nature of "${node.text}" with the ${op.lbl} operator's analytical lens applied.`

  fireRipple(node)

  addLLMEvent({
    id: `img_${Date.now()}`,
    epoch: Date.now(),
    nodeId: node.id,
    nodeName: node.text,
    operator: `${op.lbl} IMG`,
    opHue: op.hue,
    analysis: `[Generating photosphere for "${node.text}"]`,
    isCascade: false,
    depth: 0,
  })

  const imageUrl = await generateImage(imgPrompt)
  if (!imageUrl) return

  const nm = nodeMeshMap.get(node.id)
  if (nm) {
    const loader = new THREE.TextureLoader()
    loader.load(imageUrl, (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      nm.group.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          if (child.material.side === THREE.BackSide) {
            child.material.map = tex
            child.material.needsUpdate = true
          }
        }
      })
      if (!node.environment) node.environment = { isPhotosphere: true }
      else node.environment.isPhotosphere = true
      ;(node as any)._generatedImageUrl = imageUrl
      window.showBanner('PHOTOSPHERE', `${node.text} enviro updated via ${op.lbl}`)
      if (activeNodeId === node.id) showInspector(node)
    })
  }
}

// Compute initial affinity
computeAffinity()

// ── Voronoi Floor — d3-delaunay canvas texture on ground plane ──
// Extracted from Twine Bridge: d3.Delaunay.from → voronoi.renderCell()
const FLOOR_RES = 4096
const voronoiCanvas = document.createElement('canvas')
voronoiCanvas.width = FLOOR_RES
voronoiCanvas.height = FLOOR_RES
const voronoiCtx = voronoiCanvas.getContext('2d')!
const voronoiTexture = new THREE.CanvasTexture(voronoiCanvas)
voronoiTexture.minFilter = THREE.LinearFilter
voronoiTexture.magFilter = THREE.LinearFilter

// HSL helper — Twine Bridge pattern
const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${h},${s}%,${l}%,${a})`

const WLES_HUES: Record<string, number> = {
  root: 45, site: 220, inverter: 148, aphorist: 0, analyst: 270,
}
function wlesHue(cat: WLESCategory): number {
  return WLES_HUES[cat] ?? 200
}

function drawVoronoiFloor(highlightId?: string | null, selectedId?: string | null): void {
  const ctx = voronoiCtx
  const w = FLOOR_RES
  const h = FLOOR_RES

  // Clear — warm parchment
  ctx.fillStyle = '#f0ece4'
  ctx.fillRect(0, 0, w, h)

  // Grid — faint architectural lines
  ctx.strokeStyle = 'rgba(80,60,30,.07)'
  ctx.lineWidth = 1
  const gridStep = w / 30
  for (let gx = 0; gx < w; gx += gridStep) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
  }
  for (let gy = 0; gy < h; gy += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
  }

  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 2) { voronoiTexture.needsUpdate = true; return }

  // Map world coords → canvas coords (shared mapping)
  const points: [number, number][] = nodes.map(n => [
    worldToCanvasX(nodeWorldX(n), w),
    worldToCanvasY(nodeWorldZ(n), h),
  ])

  // d3-delaunay Voronoi — the heart of Twine Bridge
  const d3 = (window as any).d3
  const delaunay = d3.Delaunay.from(points)
  const voronoi = delaunay.voronoi([0, 0, w, h])

  // ── Draw cells — territory fills + ripple glow ──
  nodes.forEach((node, i) => {
    const baseH = wlesHue(node.category)
    const isHov = node.id === highlightId
    const isSel = node.id === selectedId
    const rip = getRippleGlow(node.id)
    const phys = getPhys(node.id)
    const lum = 68 + (isHov ? 12 : 0) + (isSel ? 6 : 0) + rip * 10
    const baseAlpha = 0.45 + (isHov ? 0.2 : 0) + (isSel ? 0.15 : 0) + rip * 0.2

    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.fillStyle = hsl(baseH, 72 + (isHov ? 12 : 0), lum, baseAlpha)
    ctx.fill()
  })

  // ── PRETEXT TEXT IN CELLS — the world IS text ──
  // Each Voronoi cell gets its node text laid out by Pretext, clipped to the cell boundary
  const textFont = '16px "EB Garamond", Georgia, serif'
  const textLineHeight = 20
  ctx.font = textFont

  nodes.forEach((node, i) => {
    if (!node.text || node.text.length < 2) return
    const [cx, cy] = points[i]!
    const baseH = wlesHue(node.category)

    // Get cell polygon bounds for text area
    const poly = voronoi.cellPolygon(i)
    if (!poly || poly.length < 3) return

    // Compute cell bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [px, py] of poly) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
    }

    const cellW = maxX - minX
    const cellH = maxY - minY
    if (cellW < 60 || cellH < 40) return // too small for text

    // Inset from edges
    const inset = 12
    const textW = cellW - inset * 2
    if (textW < 30) return

    // Build text content — node text + connected names
    let fullText = node.text
    if (node.edges.length > 0) {
      const connected = node.edges
        .map(eid => graph.nodes.get(eid)?.text)
        .filter(Boolean)
        .slice(0, 4)
        .join(', ')
      if (connected) fullText += ` — ${connected}`
    }

    // Prepare text with Pretext
    try {
      const prepared = prepare(fullText, ctx, { font: textFont })
      const result = layoutWithLines(prepared, textW, textLineHeight)

      // Clip to cell
      ctx.save()
      ctx.beginPath()
      voronoi.renderCell(i, ctx)
      ctx.clip()

      // Start text below the node dot area (center + offset)
      const textStartY = cy + 80
      const maxLines = Math.floor((maxY - textStartY - inset) / textLineHeight)
      const lines = result.lines.slice(0, Math.max(0, maxLines))

      ctx.font = textFont
      ctx.fillStyle = `hsla(${baseH}, 25%, 12%, 0.65)`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      lines.forEach((line, li) => {
        const lx = cx - textW / 2
        const ly = textStartY + li * textLineHeight
        ctx.fillText(line.text, lx, ly)
      })

      ctx.restore()
    } catch (_e) {
      // Pretext not ready or text too short — skip silently
    }
  })

  // ── Draw borders — CRISP territory lines ──
  // Individual cell borders for maximum crispness
  nodes.forEach((node, i) => {
    const isSel = node.id === selectedId
    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.strokeStyle = isSel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.45)'
    ctx.lineWidth = isSel ? 6 : 3
    ctx.stroke()
  })

  ctx.beginPath()
  voronoi.renderBounds(ctx)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 3
  ctx.stroke()

  // ── Node dots + labels ──
  nodes.forEach((node, i) => {
    const [px, py] = points[i]!
    const baseH = wlesHue(node.category)
    const isHov = node.id === highlightId
    const isSel = node.id === selectedId

    // Outer dot
    ctx.beginPath()
    ctx.arc(px, py, isHov ? 22 : 16, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, 80, 50, isHov ? 1.0 : 0.8)
    ctx.fill()
    ctx.strokeStyle = hsl(baseH, 85, 65, 1)
    ctx.lineWidth = isSel ? 5 : 3
    ctx.stroke()

    // Inner core
    ctx.beginPath()
    ctx.arc(px, py, isHov ? 12 : 8, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, 100, 80, 1)
    ctx.fill()

    // Label
    ctx.font = `bold ${isHov ? 34 : 28}px "Share Tech Mono", sans-serif`
    ctx.fillStyle = hsl(baseH, 60, 20, 0.85)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const label = node.text.length > 20 ? node.text.slice(0, 18) + '…' : node.text
    ctx.fillText(label.toUpperCase(), px, py + 28)

    // Category badge
    ctx.font = '20px "Share Tech Mono", sans-serif'
    ctx.fillStyle = hsl(baseH, 40, 30, 0.5)
    ctx.fillText(WLES_NAMES[node.category] ?? node.category, px, py + 64)
  })

  // ── Edge lines ──
  ctx.lineWidth = 1.5
  for (const node of nodes) {
    const srcIdx = nodes.indexOf(node)
    const [sx, sy] = points[srcIdx]!
    for (const edgeId of node.edges) {
      const tgtIdx = nodes.findIndex(n => n.id === edgeId)
      if (tgtIdx < 0) continue
      const [tx, ty] = points[tgtIdx]!
      const baseH = wlesHue(node.category)
      ctx.strokeStyle = hsl(baseH, 65, 55, 0.22)
      ctx.setLineDash([3, 7])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // ── Affinity percentage readouts — Twine Bridge drawAff() ──
  // Only show when a node is hovered or selected
  const focusId = highlightId ?? selectedId
  if (focusId) {
    const focusNode = graph.nodes.get(focusId)
    if (focusNode) {
      const nbs = getNeighbors(focusNode)
      const focusIdx = nodes.indexOf(focusNode)
      if (focusIdx >= 0) {
        const [fx, fy] = points[focusIdx]!
        nbs.forEach(({ node: nb, pct }) => {
          const nbIdx = nodes.indexOf(nb)
          if (nbIdx < 0) return
          const [nx, ny] = points[nbIdx]!
          const h1 = wlesHue(focusNode.category)
          const h2 = wlesHue(nb.category)

          // Gradient line
          const grad = ctx.createLinearGradient(fx, fy, nx, ny)
          const alpha = (pct / 100) * 0.8 + 0.1
          grad.addColorStop(0, hsl(h1, 80, 60, alpha))
          grad.addColorStop(1, hsl(h2, 80, 60, alpha))
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(fx, fy)
          ctx.lineTo(nx, ny)
          ctx.stroke()

          // Percentage readout at midpoint
          const mx = (fx + nx) / 2, my = (fy + ny) / 2
          ctx.font = `bold 24px "Share Tech Mono", monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          // Background pill
          const label = pct + '%'
          const tw = ctx.measureText(label).width
          ctx.fillStyle = 'rgba(240,236,228,0.85)'
          ctx.fillRect(mx - tw / 2 - 6, my - 14, tw + 12, 28)
          // Text
          ctx.fillStyle = `rgba(20,20,30,${alpha})`
          ctx.fillText(label, mx, my)
        })
      }
    }
  }

  // ── Ripple rings — Twine Bridge drawRips() ──
  const now = performance.now()
  for (const rp of ripples) {
    const t = (now - rp.t0) / rp.dur
    if (t < 0 || t >= 1) continue
    const rpNode = graph.nodes.get(rp.nodeId)
    if (!rpNode) continue
    const rpIdx = nodes.indexOf(rpNode)
    if (rpIdx < 0) continue
    const [rpx, rpy] = points[rpIdx]!
    const baseH = wlesHue(rpNode.category)
    ctx.strokeStyle = hsl(baseH, 78, 60, (1 - t) * rp.s * 0.36)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(rpx, rpy, 30 + t * 80, 0, Math.PI * 2)
    ctx.stroke()
  }

  voronoiTexture.needsUpdate = true
}

const groundGeo = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE)
const groundMat = new THREE.MeshStandardMaterial({
  map: voronoiTexture,
  roughness: 0.9,
  metalness: 0,
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.position.set(CENTER, -0.1, CENTER)
scene.add(ground)

drawVoronoiFloor()

// Grid helper hidden — Voronoi floor is the ground truth
const gridHelper = new THREE.GridHelper(FLOOR_SIZE, 60, 0xd8d5cd, 0xe0ddd8)
gridHelper.position.set(CENTER, 0.01, CENTER)
gridHelper.visible = false
let showGrid = false  // Toggle with H key
scene.add(gridHelper)

// ══════════════════════════════════════════════════════════════
// TYPOGRAPHY — OffscreenCanvas texture factory
// Achilles v2 quality: 2048x1024 with serif + mono
// ══════════════════════════════════════════════════════════════
function makeLabelTexture(text: string, color: string, sub?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  // Main label
  ctx.font = 'bold 28px "Share Tech Mono", monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const truncated = text.length > 24 ? text.slice(0, 22) + '…' : text
  ctx.fillText(truncated.toUpperCase(), 256, sub ? 44 : 64)
  // Sub label
  if (sub) {
    ctx.font = '18px "Share Tech Mono", monospace'
    ctx.fillStyle = '#999'
    ctx.fillText(sub, 256, 84)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

function createTextTexture(text: string, width = 1024, height = 1024, opts?: {
  fontSize?: number; color?: string; bg?: string; padding?: number
  titleFont?: string; bodyFont?: string
}): THREE.CanvasTexture {
  const fontSize = opts?.fontSize ?? 16
  const color = opts?.color ?? '#1a1a1a'
  const bg = opts?.bg ?? '#f4f4f0'
  const pad = opts?.padding ?? 40

  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!

  // Background
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Border — Achilles-style 3px black
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, width - 4, height - 4)

  // Text
  ctx.fillStyle = color
  ctx.font = `${fontSize}px "EB Garamond", "Georgia", serif`
  ctx.textBaseline = 'top'

  // Word wrap
  const maxW = width - pad * 2
  const lineHeight = fontSize * 1.65
  const words = text.split(/\s+/)
  let line = ''
  let y = pad

  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    const w = ctx.measureText(test).width
    if (w > maxW && line) {
      ctx.fillText(line, pad, y)
      y += lineHeight
      line = word
      if (y > height - pad) break
    } else {
      line = test
    }
  }
  if (line && y < height - pad) ctx.fillText(line, pad, y)

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

// ══════════════════════════════════════════════════════════════
// PHOTOSPHERE SHADER — extracted from Achilles v2
// Fresnel rim glow + mosaic texture + BackSide interior
// ══════════════════════════════════════════════════════════════
function createPhotosphereMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tMosaic: { value: texture },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0x333333) },
      uOpacity: { value: 0.85 },
      uImageMode: { value: 0.0 },
      uImmersive: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D tMosaic;
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uOpacity;
      uniform float uImageMode;
      uniform float uImmersive;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 tex = texture2D(tMosaic, vUv);
        if (uImmersive > 0.5) {
          gl_FragColor = vec4(tex.rgb, min(1.0, uOpacity));
          return;
        }
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        float pulse = sin(vUv.y * 60.0 - uTime * 1.8) * 0.5 + 0.5;
        float tintMix = mix(0.18, 0.04, uImageMode);
        float pulseAmt = mix(0.08, 0.02, uImageMode);
        float fresnelAmt = mix(0.70, 0.18, uImageMode);
        float alphaAmt = mix(0.82, 0.97, uImageMode);
        vec3 finalColor = mix(tex.rgb, uTint, tintMix);
        finalColor += uTint * pulse * pulseAmt;
        finalColor += uTint * fresnel * fresnelAmt;
        gl_FragColor = vec4(finalColor, alphaAmt * uOpacity);
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
  })
}

// ══════════════════════════════════════════════════════════════
// NODE MESH CLASS — extracted from Achilles v2
// Sphere + core + ring + label + hit mesh
// ══════════════════════════════════════════════════════════════
const SPHERE_RADIUS = 11.5

class FleeceNodeMesh {
  id: string
  node: WorldNode
  group: THREE.Group
  sphere: THREE.Mesh
  material: THREE.ShaderMaterial
  core: THREE.Mesh
  ring: THREE.Mesh
  hitMesh: THREE.Mesh
  label: THREE.Sprite
  surfaceCanvas: HTMLCanvasElement
  surfaceTexture: THREE.CanvasTexture

  constructor(node: WorldNode) {
    this.id = node.id
    this.node = node
    this.group = new THREE.Group()

    // UNIFIED COORDS — photosphere sits at centroid of its Voronoi cell
    const wx = nodeWorldX(node)
    const wz = nodeWorldZ(node)
    this.group.position.set(wx, 0, wz)

    // Surface canvas (Achilles: 2048×1024)
    this.surfaceCanvas = document.createElement('canvas')
    this.surfaceCanvas.width = 2048
    this.surfaceCanvas.height = 1024
    this.surfaceTexture = new THREE.CanvasTexture(this.surfaceCanvas)
    this.surfaceTexture.wrapS = THREE.ClampToEdgeWrapping
    this.surfaceTexture.wrapT = THREE.ClampToEdgeWrapping
    this.surfaceTexture.anisotropy = 8

    // Photosphere material
    this.material = createPhotosphereMaterial(this.surfaceTexture)
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS, 96, 48),
      this.material
    )
    this.group.add(this.sphere)

    // Inner core
    const coreMat = new THREE.MeshBasicMaterial({
      color: wlesColor(node.category),
      transparent: true,
      opacity: 0.5,
      blending: THREE.NormalBlending,
    })
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS * 0.28, 24, 24),
      coreMat
    )
    this.group.add(this.core)

    // Shadow ring (Achilles v2 pattern)
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(SPHERE_RADIUS + 2.5, SPHERE_RADIUS + 4.3, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.12,
        side: THREE.DoubleSide,
      })
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = -SPHERE_RADIUS - 4
    this.group.add(this.ring)

    // Hit mesh (invisible, for raycasting)
    this.hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS, 18, 18),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    this.hitMesh.userData.nodeId = this.id
    this.group.add(this.hitMesh)

    // Label sprite
    const labelTex = makeLabelTexture(
      node.text,
      wlesHex(node.category),
      WLES_NAMES[node.category] ?? node.category.toUpperCase()
    )
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true })
    this.label = new THREE.Sprite(labelMat)
    this.label.scale.set(22, 5.5, 1)
    this.label.position.y = SPHERE_RADIUS + 5
    this.group.add(this.label)

    // Draw surface
    this.redrawSurface()

    scene.add(this.group)
  }

  redrawSurface(): void {
    const ctx = this.surfaceCanvas.getContext('2d')!
    const w = this.surfaceCanvas.width
    const h = this.surfaceCanvas.height
    const node = this.node
    const hexColor = wlesHex(node.category)

    // Background — warm parchment
    ctx.fillStyle = '#f0ece4'
    ctx.fillRect(0, 0, w, h)

    // Border strip — WLES color
    ctx.fillStyle = hexColor
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)

    // Title
    ctx.font = 'bold 64px "Share Tech Mono", monospace'
    ctx.fillStyle = '#1a1a1a'
    ctx.textBaseline = 'top'
    ctx.fillText(node.text.toUpperCase(), 60, 60)

    // Category badge
    ctx.font = 'bold 32px "Share Tech Mono", monospace'
    ctx.fillStyle = hexColor
    ctx.fillText(`[${(WLES_NAMES[node.category] ?? node.category).toUpperCase()}]`, 60, 150)

    // Body text — use serif for the description-like content
    ctx.font = 'italic 36px "EB Garamond", Georgia, serif'
    ctx.fillStyle = '#333'
    const bodyText = node.text
    const maxW = w - 120
    const lineH = 52
    let y = 240
    const words = bodyText.split(' ')
    let line = ''
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, 60, y)
        y += lineH
        line = word
        if (y > h - 100) break
      } else {
        line = test
      }
    }
    if (line && y < h - 100) ctx.fillText(line, 60, y)

    // Edge count
    ctx.font = 'bold 28px "Share Tech Mono", monospace'
    ctx.fillStyle = '#999'
    ctx.fillText(`EDGES: ${node.edges.length}  ·  EPOCH: ${node.epoch}`, 60, h - 80)

    this.surfaceTexture.needsUpdate = true
  }
}

// ══════════════════════════════════════════════════════════════
// VORONOI SCALE — node spheres + edge lines
// ══════════════════════════════════════════════════════════════
const nodeMeshMap = new Map<string, FleeceNodeMesh>()
const hitMeshToNode = new Map<THREE.Object3D, string>()
const edgeLines: THREE.Line[] = []

function buildVoronoi(): void {
  // Clear previous
  for (const nm of nodeMeshMap.values()) scene.remove(nm.group)
  nodeMeshMap.clear()
  hitMeshToNode.clear()
  for (const line of edgeLines) scene.remove(line)
  edgeLines.length = 0

  // Build node meshes
  for (const node of graph.nodes.values()) {
    const nm = new FleeceNodeMesh(node)
    nodeMeshMap.set(node.id, nm)
    hitMeshToNode.set(nm.hitMesh, node.id)
  }

  // Build edge lines — Achilles style black ink
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.15,
  })
  for (const node of graph.nodes.values()) {
    const srcMesh = nodeMeshMap.get(node.id)
    if (!srcMesh) continue
    for (const edgeId of node.edges) {
      const tgtMesh = nodeMeshMap.get(edgeId)
      if (!tgtMesh) continue
      const pts = [
        srcMesh.group.position.clone().setY(0),
        tgtMesh.group.position.clone().setY(0),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const line = new THREE.Line(geo, edgeMat)
      scene.add(line)
      edgeLines.push(line)
    }
  }
}

buildVoronoi()

// ══════════════════════════════════════════════════════════════
// WALLS — monolithic text architecture rising from Voronoi cells
// Walls grow from each node's Voronoi cell center (UNIFIED COORDS)
// Height scales with text volume. This is not decoration.
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// WALK ENGINE — Canvas 2D raycaster (extracted from golden-egg)
// No Three.js, no PointerLock, no WebGL for walking
// ══════════════════════════════════════════════════════════════

// LIDAR plan — character grid, '#' = wall, '.' = walkable, other = panel
let LIDAR_PLAN: string[] = []
let LIDAR_W = 0
let LIDAR_H = 0
const WALL_LORE: Record<string, string> = {}  // wallChar → nodeId
const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {}

// Walk wall text cache — keyed by nodeId_fontSize_width → Pretext-laid-out lines
const wallTextCache = new Map<string, string[]>()

function isWalkable(ch: string | undefined): boolean { return ch === '.' }

// Player state — golden-egg style: {x, y, dirX, dirY, planeX, planeY}
const player = { x: 40, y: 42, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0 }
let playerGlideTarget: { x: number; y: number } | null = null
let playerGlideArrivalFaceNorth = false
const walkKeys: Record<string, boolean> = {}

// ── Spatial Prompting State ──
// Walking IS prompting — crossing territory boundaries triggers generation
let walkPrevTerritory: string | null = null
let walkLastCrossingTs = 0
let walkDwellTarget: string | null = null
let walkDwellStart = 0
let spatialPromptEnabled = true // toggle with 'P' key
const SPATIAL_PROMPT_COOLDOWN = 5000 // 5s between spatial prompts

async function fireSpatialPrompt(srcNode: WorldNode | undefined, dstNode: WorldNode): Promise<void> {
  if (!apiState.apiKey || apiState.generating) return

  const srcName = srcNode?.text ?? 'the void'
  const srcCat = srcNode ? (WLES_NAMES[srcNode.category] ?? srcNode.category) : 'unknown'
  const dstCat = WLES_NAMES[dstNode.category] ?? dstNode.category

  // Build neighbors context
  const dstNeighbors = dstNode.edges
    .map(eid => graph.nodes.get(eid))
    .filter(Boolean)
    .slice(0, 4)
    .map(n => `${n!.text} (${WLES_NAMES[n!.category] ?? n!.category})`)
    .join(', ')

  const prompt = `A traveler has just crossed from "${srcName}" (${srcCat}) into "${dstNode.text}" (${dstCat}).

Existing description: ${dstNode.text}
Nearby territories: ${dstNeighbors || 'none mapped yet'}

Write 1-2 vivid sentences extending the description of "${dstNode.text}" from the perspective of someone arriving from "${srcName}". Focus on spatial and sensory details. Do not repeat the existing text.`

  apiState.generating = true
  window.showBanner('SPATIAL', `Generating: ${srcName} → ${dstNode.text}…`)
  console.log(`[ARGO/SPATIAL] Firing: ${srcName} → ${dstNode.text}`)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiState.apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.8,
      }),
    })

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      console.warn(`[ARGO/SPATIAL] Rate limited. Retry after: ${retryAfter}s`)
      window.showBanner('SPATIAL', `Rate limited — retry in ${retryAfter ?? '?'}s`)
      apiState.generating = false
      return
    }

    const data = await res.json()
    const generated = data?.choices?.[0]?.message?.content?.trim()

    if (generated) {
      // Snapshot before mutation
      if (typeof captureSnapshot === 'function') captureSnapshot('WALK')

      // Append to node text
      dstNode.text = dstNode.text + '. ' + generated
      console.log(`[ARGO/SPATIAL] Generated for ${dstNode.text.slice(0, 40)}…`)

      // Track cost
      const tokens = (data?.usage?.total_tokens ?? 0)
      apiState.costUsd += tokens * 0.0000004

      // Refresh visuals
      drawVoronoiFloor(null, activeNodeId)
      buildNodeStrip()
      window.showBanner('SPATIAL', `${dstNode.text.split('.')[0]} — world extended`)

      addLLMEvent({
        epoch: Date.now(),
        nodeId: dstNode.id,
        nodeName: dstNode.text.split('.')[0] ?? dstNode.text,
        operator: 'SPATIAL',
        opHue: 180,
        analysis: `[CROSSING] ${srcName} → ${dstNode.text.split('.')[0]}\n\n${generated}`,
        isCascade: false,
        depth: 0,
      })
    }
  } catch (err) {
    console.error('[ARGO/SPATIAL] Error:', err)
    window.showBanner('SPATIAL', 'Generation failed')
  } finally {
    apiState.generating = false
  }
}

// Build LIDAR_PLAN from WorldNode positions
function buildLidarPlan(): void {
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 1) return

  const spacing = 12
  const cols = Math.max(4, Math.ceil(Math.sqrt(nodes.length)))
  const sz = Math.max(60, 16 + cols * spacing)

  // Initialize grid — entirely open
  const grid: string[][] = Array.from({ length: sz }, () =>
    Array.from({ length: sz }, () => '.')
  )

  // Outer boundary
  for (let i = 0; i < sz; i++) {
    grid[0]![i] = '#'
    grid[sz - 1]![i] = '#'
    grid[i]![0] = '#'
    grid[i]![sz - 1] = '#'
  }

  // Place walls for each node
  const startOffset = 8
  for (const key of Object.keys(WALL_LORE)) delete WALL_LORE[key]
  for (const key of Object.keys(ZONE_POSITIONS)) delete ZONE_POSITIONS[key]

  for (let i = 0; i < nodes.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const px = startOffset + col * spacing
    const py = startOffset + row * spacing
    const ch = String.fromCharCode(i + 161)

    // Build 5-block wide wall
    for (let bx = -2; bx <= 2; bx++) {
      if (py >= 0 && py < sz && px + bx >= 0 && px + bx < sz) {
        grid[py]![px + bx] = ch
      }
    }

    WALL_LORE[ch] = nodes[i]!.id
    ZONE_POSITIONS[nodes[i]!.id] = { x: px, y: py + 2 }
  }

  LIDAR_PLAN = grid.map(row => row.join(''))
  LIDAR_W = sz
  LIDAR_H = sz

  // Start player in front of first node
  const firstPos = ZONE_POSITIONS[nodes[0]!.id]
  if (firstPos) {
    player.x = firstPos.x + 0.5
    player.y = firstPos.y + 0.5
  }
  player.dirX = 0; player.dirY = -1
  player.planeX = 0.66; player.planeY = 0
  playerGlideTarget = null

  console.log(`[ARGO/WALK] Built LIDAR plan: ${sz}x${sz}, ${nodes.length} walls`)
}

// Navigate to a node in walk mode
function walkToNode(nodeId: string): void {
  const pos = ZONE_POSITIONS[nodeId]
  if (!pos) return
  playerGlideTarget = { x: pos.x + 0.5, y: pos.y + 0.5 }
  playerGlideArrivalFaceNorth = true
}

// Get node color
function getNodeColor(nodeId: string): string {
  const node = graph.nodes.get(nodeId)
  if (!node) return '#888'
  return `hsl(${wlesHue(node.category)}, 65%, 50%)`
}

// ── Raycaster renderer (extracted from golden-egg renderLidar) ──
function renderWalk(): void {
  const cw = walkCanvas.width
  const ch = walkCanvas.height
  if (cw === 0 || ch === 0) return

  const ms = 0.06, rs = 0.05

  // Movement
  if (walkKeys['a'] || walkKeys['arrowleft']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(-rs) - player.dirY * Math.sin(-rs)
    player.dirY = od * Math.sin(-rs) + player.dirY * Math.cos(-rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(-rs) - player.planeY * Math.sin(-rs)
    player.planeY = op * Math.sin(-rs) + player.planeY * Math.cos(-rs)
  }
  if (walkKeys['d'] || walkKeys['arrowright']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(rs) - player.dirY * Math.sin(rs)
    player.dirY = od * Math.sin(rs) + player.dirY * Math.cos(rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(rs) - player.planeY * Math.sin(rs)
    player.planeY = op * Math.sin(rs) + player.planeY * Math.cos(rs)
  }
  if (walkKeys['w'] || walkKeys['arrowup']) {
    const nx = player.x + player.dirX * ms, ny = player.y + player.dirY * ms
    if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
    if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
  }
  if (walkKeys['s'] || walkKeys['arrowdown']) {
    const nx = player.x - player.dirX * ms, ny = player.y - player.dirY * ms
    if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
    if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
  }

  // Smooth glide
  if (playerGlideTarget) {
    if (walkKeys['w'] || walkKeys['s'] || walkKeys['a'] || walkKeys['d']) {
      playerGlideTarget = null
    } else {
      const dx = playerGlideTarget.x - player.x
      const dy = playerGlideTarget.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) {
        if (playerGlideArrivalFaceNorth) {
          player.dirX = 0; player.dirY = -1; player.planeX = 0.66; player.planeY = 0
          playerGlideArrivalFaceNorth = false
        }
        playerGlideTarget = null
      } else {
        const ease = 0.06
        const nx = player.x + dx * ease, ny = player.y + dy * ease
        if (isWalkable(LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)])) player.x = nx
        if (isWalkable(LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)])) player.y = ny
        const targetAngle = Math.atan2(dy, dx)
        const curAngle = Math.atan2(player.dirY, player.dirX)
        let angleDiff = targetAngle - curAngle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        if (Math.abs(angleDiff) > 0.05) {
          const turn = angleDiff * 0.03
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

  // ── Clear + sky ──
  const skyGrad = walkCtx.createLinearGradient(0, 0, 0, ch / 2)
  skyGrad.addColorStop(0, '#c8d8e8')
  skyGrad.addColorStop(0.6, '#dde8f0')
  skyGrad.addColorStop(1, '#eef2f4')
  walkCtx.fillStyle = skyGrad
  walkCtx.fillRect(0, 0, cw, ch / 2)

  // ── Ground — clean gradient + territory color tint ──
  // No scanline sampling — just a smooth gradient tinted by current territory.
  // The minimap shows the full Voronoi; the floor communicates territory via color.
  const gndGrad = walkCtx.createLinearGradient(0, ch / 2, 0, ch)
  gndGrad.addColorStop(0, '#d4cfc5')
  gndGrad.addColorStop(0.4, '#c8c2b8')
  gndGrad.addColorStop(1, '#b8b2a8')
  walkCtx.fillStyle = gndGrad
  walkCtx.fillRect(0, ch / 2, cw, ch / 2)

  // ── Nearest node label + zone glow on ground ──
  let nearestNodeId = ''
  let nearestDist = Infinity
  for (const [nid, pos] of Object.entries(ZONE_POSITIONS)) {
    const dx = player.x - pos.x, dy = player.y - pos.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < nearestDist) { nearestDist = d; nearestNodeId = nid }
  }
  const nearNode = graph.nodes.get(nearestNodeId)

  // ── SPATIAL PROMPTING — boundary crossing detector ──
  // Walking IS prompting: crossing a territory triggers generation
  if (nearestNodeId && nearestNodeId !== walkPrevTerritory) {
    const now = Date.now()
    if (walkPrevTerritory && (now - walkLastCrossingTs) > SPATIAL_PROMPT_COOLDOWN) {
      const srcNode = graph.nodes.get(walkPrevTerritory)
      const dstNode = graph.nodes.get(nearestNodeId)
      if (srcNode && dstNode && spatialPromptEnabled && apiState.apiKey) {
        walkLastCrossingTs = now
        // Delay generation — player must dwell 500ms in new territory
        walkDwellTarget = nearestNodeId
        walkDwellStart = now
        console.log(`[ARGO/SPATIAL] Crossed: ${srcNode.text} → ${dstNode.text}`)
      }
    }
    walkPrevTerritory = nearestNodeId
  }

  // Check dwell timer — if player stayed in territory long enough, fire spatial prompt
  if (walkDwellTarget && nearestNodeId === walkDwellTarget) {
    const elapsed = Date.now() - walkDwellStart
    if (elapsed > 500 && !apiState.generating) {
      const src = graph.nodes.get(walkPrevTerritory ?? '')
      const dst = graph.nodes.get(walkDwellTarget)
      if (dst) {
        fireSpatialPrompt(src, dst)
        walkDwellTarget = null
      }
    }
  } else {
    // Player left the territory before dwell time — cancel
    walkDwellTarget = null
  }

  // Ground zone glow — tint floor with nearest node's color
  if (nearNode) {
    const h = wlesHue(nearNode.category)
    const gzg = walkCtx.createRadialGradient(cw / 2, ch, 0, cw / 2, ch, ch / 2)
    gzg.addColorStop(0, `hsla(${h}, 65%, 50%, 0.18)`)
    gzg.addColorStop(0.5, `hsla(${h}, 65%, 50%, 0.06)`)
    gzg.addColorStop(1, 'transparent')
    walkCtx.globalAlpha = 0.5
    walkCtx.fillStyle = gzg
    walkCtx.fillRect(0, ch / 2, cw, ch / 2)
  }

  // ── Perspective grid lines on ground (spatial orientation) ──
  walkCtx.globalAlpha = 0.08
  walkCtx.strokeStyle = '#333'
  walkCtx.lineWidth = 1
  const vpX = cw / 2, vpY = ch / 2
  for (let i = 0; i < 20; i++) {
    const ratio = i / 20
    const gy = vpY + ratio * (ch / 2)
    const spread = (1 + ratio * 3) * cw * 0.3
    walkCtx.beginPath()
    walkCtx.moveTo(vpX - spread, gy)
    walkCtx.lineTo(vpX + spread, gy)
    walkCtx.stroke()
  }
  // Radial lines
  for (let i = -4; i <= 4; i++) {
    const screenX = vpX + i * cw * 0.08
    walkCtx.beginPath()
    walkCtx.moveTo(vpX, vpY)
    walkCtx.lineTo(screenX + i * cw * 0.3, ch)
    walkCtx.stroke()
  }

  // ── Compass labels at horizon (N/E/S/W) ──
  const compassLabels: [string, number, number, string][] = [
    ['N', 0, -1, '#3366cc'], ['E', 1, 0, '#cc9900'],
    ['S', 0, 1, '#cc3300'], ['W', -1, 0, '#339933'],
  ]
  walkCtx.textAlign = 'center'
  walkCtx.textBaseline = 'bottom'
  for (const [label, wx, wy, color] of compassLabels) {
    const dot = (wx as number) * player.dirX + (wy as number) * player.dirY
    const cross = (wx as number) * player.planeX + (wy as number) * player.planeY
    if (dot > 0.01) {
      const screenX = cw / 2 + (cross / dot) * (cw / 2)
      if (screenX > 20 && screenX < cw - 20) {
        walkCtx.globalAlpha = Math.min(1, dot * 1.5) * 0.7
        walkCtx.font = `bold ${14 + Math.floor(dot * 6)}px "Share Tech Mono", monospace`
        walkCtx.fillStyle = color as string
        walkCtx.fillText(label as string, screenX, vpY - 2)
      }
    }
  }
  walkCtx.globalAlpha = 1

  // ── Horizon line — colored by nearest zone ──
  if (nearNode) {
    walkCtx.globalAlpha = 0.35
    walkCtx.fillStyle = getNodeColor(nearestNodeId)
    walkCtx.fillRect(0, Math.floor(ch / 2) - 1, cw, 2)
    walkCtx.globalAlpha = 1
  }

  // ── Compass HUD ──
  const bearing = ((Math.atan2(player.dirX, -player.dirY) * 180 / Math.PI) + 360) % 360
  const bearingLabel = bearing < 22.5 ? 'N' : bearing < 67.5 ? 'NE' : bearing < 112.5 ? 'E' :
    bearing < 157.5 ? 'SE' : bearing < 202.5 ? 'S' : bearing < 247.5 ? 'SW' :
    bearing < 292.5 ? 'W' : bearing < 337.5 ? 'NW' : 'N'
  walkCtx.globalAlpha = 0.85
  walkCtx.textAlign = 'center'
  walkCtx.textBaseline = 'top'
  walkCtx.font = 'bold 14px "Share Tech Mono", monospace'
  walkCtx.fillStyle = '#1a1a1a'
  walkCtx.fillText(`${bearingLabel} ${Math.round(bearing)}°`, cw / 2, 10)

  if (nearNode) {
    walkCtx.font = 'bold 11px "Share Tech Mono", monospace'
    walkCtx.fillStyle = getNodeColor(nearestNodeId)
    const distLabel = nearestDist < 2 ? 'FACING' : `${Math.round(nearestDist)}m`
    const typeLabel = nearNode.category ? ` · ${nearNode.category}` : ''
    walkCtx.fillText(`${nearNode.text.toUpperCase()} · ${distLabel}${typeLabel}`, cw / 2, 28)
  }

  // ── API / Rate limit status ──
  walkCtx.font = '10px "Share Tech Mono", monospace'
  walkCtx.textAlign = 'right'
  walkCtx.fillStyle = apiState.lastError?.includes('429') ? '#e60000' : '#666'
  walkCtx.fillText(
    apiState.lastError?.includes('429') ? 'RATE LIMITED — wait 60s'
    : apiState.generating ? 'GENERATING…'
    : `$${apiState.costUsd.toFixed(3)} · ${apiState.imageCount} img`,
    cw - 12, 14
  )
  walkCtx.globalAlpha = 1

  // ── Raycasting loop — DDA algorithm ──
  let centerLoreKey = ''
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

    if (!hit) continue

    let perp: number
    if (side === 0) perp = (mx - player.x + (1 - sx) / 2) / rdx
    else perp = (my - player.y + (1 - sy) / 2) / rdy
    if (perp < 0.01) perp = 0.01

    const lineH = Math.floor(ch / perp)
    const drawStart = Math.max(0, (ch - lineH) / 2)
    const drawEnd = Math.min(ch, (ch + lineH) / 2)

    const wallChar = LIDAR_PLAN[my]?.[mx] || '#'
    const nodeId = WALL_LORE[wallChar] || ''
    const node = graph.nodes.get(nodeId)

    // Track center-facing node
    if (x === centerCol && nodeId) centerLoreKey = nodeId

    // Wall color — deeper hue, side shading for depth
    const brightness = Math.max(0.15, 1 - perp / 12) * (side === 1 ? 0.65 : 1)
    if (wallChar === '#') {
      const v = Math.floor(35 * brightness)
      walkCtx.fillStyle = `rgb(${v},${v},${v})`
    } else if (node) {
      const h = wlesHue(node.category)
      const s = 50 + brightness * 15
      const l = Math.floor(15 + brightness * 40)
      walkCtx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`
    } else {
      walkCtx.fillStyle = `rgb(${Math.floor(80 * brightness)},${Math.floor(80 * brightness)},${Math.floor(70 * brightness)})`
    }

    walkCtx.globalAlpha = 1
    walkCtx.fillRect(x, drawStart, 1, drawEnd - drawStart)

    // Text on center-facing wall (close enough to read)
    if (x === centerCol && node && perp < 5) {
      const faceW = Math.floor(ch / perp * 0.6)
      const fs = Math.max(11, Math.min(18, lineH / 16))
      const lh = fs * 1.4
      const textX = centerCol - faceW / 2
      let textY = drawStart + 8

      // Dark background for readability — subtle zone-colored border
      walkCtx.globalAlpha = 0.92
      walkCtx.fillStyle = '#08080a'
      walkCtx.fillRect(centerCol - faceW / 2 - 8, drawStart, faceW + 16, drawEnd - drawStart)

      // Zone-colored frame
      const nc = getNodeColor(nodeId)
      walkCtx.fillStyle = nc
      walkCtx.globalAlpha = 0.6
      walkCtx.fillRect(centerCol - faceW / 2 - 8, drawStart, faceW + 16, 2)
      walkCtx.fillRect(centerCol - faceW / 2 - 8, drawEnd - 2, faceW + 16, 2)
      walkCtx.fillRect(centerCol - faceW / 2 - 8, drawStart, 2, drawEnd - drawStart)
      walkCtx.fillRect(centerCol + faceW / 2 + 6, drawStart, 2, drawEnd - drawStart)

      // Zone header
      walkCtx.globalAlpha = 0.9
      walkCtx.font = `bold 11px "Share Tech Mono", monospace`
      walkCtx.fillStyle = nc
      walkCtx.textAlign = 'left'
      walkCtx.textBaseline = 'top'
      walkCtx.fillText(`[${node.text.toUpperCase()}]`, textX, textY)
      textY += 14

      // Metadata line — type + category + photo indicator
      walkCtx.font = `9px "Share Tech Mono", monospace`
      walkCtx.fillStyle = '#888'
      const hasPhoto = node.environment?.isPhotosphere ? ' · HAS PHOTOSPHERE' : ''
      walkCtx.fillText(`TYPE: ${node.category}${hasPhoto}`, textX, textY)
      textY += 12

      // Affinity neighbors
      if (node.affinity) {
        walkCtx.fillStyle = '#666'
        const topAff = Object.entries(node.affinity)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
        for (const [nbrId, pct] of topAff) {
          const nbr = graph.nodes.get(nbrId)
          if (nbr) {
            walkCtx.fillStyle = getNodeColor(nbrId)
            walkCtx.fillText(`${nbr.text.slice(0, 16).toUpperCase()}  ${Math.round(pct * 100)}%`, textX, textY)
            textY += 11
          }
        }
      }
      textY += 6

      // Node text body — Pretext layout for proper wrapping
      const wallFont = `${Math.round(fs)}px "Share Tech Mono", monospace`
      walkCtx.font = wallFont
      walkCtx.fillStyle = '#e0ddd5'
      try {
        const cacheKey = `${nodeId}_${Math.round(fs)}_${Math.round(faceW)}`
        let wallLines: string[]
        if (wallTextCache.has(cacheKey)) {
          wallLines = wallTextCache.get(cacheKey)!
        } else {
          const prepared = prepare(node.text, walkCtx, { font: wallFont })
          const result = layoutWithLines(prepared, faceW, Math.round(lh))
          wallLines = result.lines.map(l => l.text)
          wallTextCache.set(cacheKey, wallLines)
        }
        for (const wallLine of wallLines) {
          walkCtx.fillText(wallLine, textX, textY)
          textY += lh
          if (textY > drawEnd - 10) break
        }
      } catch (_e) {
        // Fallback manual wrap
        const words = node.text.split(/\s+/)
        let line = ''
        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          if (walkCtx.measureText(test).width > faceW) {
            if (line) {
              walkCtx.fillText(line, textX, textY)
              textY += lh
              if (textY > drawEnd - 10) break
            }
            line = word
          } else {
            line = test
          }
        }
        if (line && textY < drawEnd - 10) walkCtx.fillText(line, textX, textY)
      }
    }
  }

  // Select faced node
  if (centerLoreKey && centerLoreKey !== activeNodeId) {
    const node = graph.nodes.get(centerLoreKey)
    if (node) updateInfoReadout(node)
  }

  walkCtx.globalAlpha = 1

  // ── Controls hint ──
  walkCtx.textAlign = 'center'
  walkCtx.textBaseline = 'bottom'
  walkCtx.font = '11px "Share Tech Mono", monospace'
  walkCtx.fillStyle = 'rgba(0,0,0,0.4)'
  const spIndicator = spatialPromptEnabled ? 'SPATIAL ON' : 'SPATIAL OFF'
  walkCtx.fillText(`WASD MOVE · A/D TURN · 1-9 TELEPORT · P ${spIndicator} · G FIRE`, cw / 2, ch - 8)
}

// ── Flat overhead view — REAL Voronoi tessellation + player overlay ──
// This renders the same d3-delaunay Voronoi map as the Three.js floor,
// but directly on a canvas with the walk-mode player position overlaid.
function renderFlat(): void {
  const cw = flatCanvas.width
  const ch = flatCanvas.height
  if (cw === 0 || ch === 0) return

  const ctx = flatCtx
  const nodes = Array.from(graph.nodes.values())

  // Clear — same parchment as the Voronoi floor texture
  ctx.fillStyle = '#f0ece4'
  ctx.fillRect(0, 0, cw, ch)

  if (nodes.length < 2) return

  // Apply zoom/pan transform
  ctx.save()
  ctx.translate(cw / 2 + flatPanX, ch / 2 + flatPanY)
  ctx.scale(flatZoom, flatZoom)
  ctx.translate(-cw / 2, -ch / 2)

  // ── Fit the Voronoi into the canvas with margin ──
  const margin = 40
  const vw = cw - margin * 2
  const vh = ch - margin * 2

  // Map world coords → flat canvas coords (same transform as voronoi floor)
  const points: [number, number][] = nodes.map(n => {
    const wx = nodeWorldX(n)
    const wz = nodeWorldZ(n)
    // worldToCanvas maps [CENTER-FLOOR_HALF, CENTER+FLOOR_HALF] → [0, canvasW]
    // We remap [0, FLOOR_RES] → [margin, margin+vw]
    const u = worldToCanvasX(wx, FLOOR_RES) / FLOOR_RES
    const v = worldToCanvasY(wz, FLOOR_RES) / FLOOR_RES
    return [margin + u * vw, margin + v * vh] as [number, number]
  })

  // ── d3-delaunay Voronoi — same as drawVoronoiFloor() ──
  const d3 = (window as any).d3
  if (!d3?.Delaunay) return
  const delaunay = d3.Delaunay.from(points)
  const voronoi = delaunay.voronoi([margin, margin, margin + vw, margin + vh])

  // ── Grid — faint architectural lines ──
  ctx.strokeStyle = 'rgba(80,60,30,.06)'
  ctx.lineWidth = 0.5
  const gridStep = vw / 20
  for (let gx = margin; gx <= margin + vw; gx += gridStep) {
    ctx.beginPath(); ctx.moveTo(gx, margin); ctx.lineTo(gx, margin + vh); ctx.stroke()
  }
  for (let gy = margin; gy <= margin + vh; gy += gridStep) {
    ctx.beginPath(); ctx.moveTo(margin, gy); ctx.lineTo(margin + vw, gy); ctx.stroke()
  }

  // ── Draw Voronoi cells — same palette as the 3D floor ──
  nodes.forEach((node, i) => {
    const baseH = wlesHue(node.category)
    const isHov = node.id === hoveredNodeId
    const isSel = node.id === activeNodeId
    const rip = getRippleGlow(node.id)
    const lum = 68 + (isHov ? 12 : 0) + (isSel ? 6 : 0) + rip * 10
    const baseAlpha = 0.45 + (isHov ? 0.2 : 0) + (isSel ? 0.15 : 0) + rip * 0.2

    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.fillStyle = hsl(baseH, 72 + (isHov ? 12 : 0), lum, baseAlpha)
    ctx.fill()
  })

  // ── Crisp territory borders ──
  nodes.forEach((node, i) => {
    const isSel = node.id === activeNodeId
    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.strokeStyle = isSel ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)'
    ctx.lineWidth = isSel ? 3 : 1.5
    ctx.stroke()
  })

  // ── Outer bounds ──
  ctx.beginPath()
  voronoi.renderBounds(ctx)
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  // ── Edge lines (same dashed style as 3D floor) ──
  ctx.lineWidth = 1
  ctx.setLineDash([2, 5])
  for (let si = 0; si < nodes.length; si++) {
    const node = nodes[si]!
    const [sx, sy] = points[si]!
    for (const edgeId of node.edges) {
      const ti = nodes.findIndex(n => n.id === edgeId)
      if (ti < 0) continue
      const [tx, ty] = points[ti]!
      ctx.strokeStyle = hsl(wlesHue(node.category), 65, 55, 0.2)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // ── Node dots + labels (same style as 3D floor) ──
  nodes.forEach((node, i) => {
    const [px, py] = points[i]!
    const baseH = wlesHue(node.category)
    const isHov = node.id === hoveredNodeId
    const isSel = node.id === activeNodeId

    // Outer dot
    const dotR = Math.max(6, Math.min(14, vw / nodes.length * 0.4))
    ctx.beginPath()
    ctx.arc(px, py, isHov ? dotR * 1.4 : dotR, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, 80, 50, isHov ? 1.0 : 0.8)
    ctx.fill()
    ctx.strokeStyle = hsl(baseH, 85, 65, 1)
    ctx.lineWidth = isSel ? 3 : 1.5
    ctx.stroke()

    // Inner core
    ctx.beginPath()
    ctx.arc(px, py, isHov ? dotR * 0.8 : dotR * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, 100, 80, 1)
    ctx.fill()

    // Label
    const fs = Math.max(10, Math.min(16, vw / nodes.length * 0.7))
    ctx.font = `bold ${isHov ? fs + 2 : fs}px "Share Tech Mono", sans-serif`
    ctx.fillStyle = hsl(baseH, 60, 20, 0.85)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const label = node.text.length > 18 ? node.text.slice(0, 16) + '…' : node.text
    ctx.fillText(label.toUpperCase(), px, py + dotR + 4)

    // Category badge
    ctx.font = `${Math.max(8, fs - 3)}px "Share Tech Mono", sans-serif`
    ctx.fillStyle = hsl(baseH, 40, 30, 0.5)
    const catName = WLES_NAMES[node.category] ?? node.category
    ctx.fillText(catName, px, py + dotR + fs + 6)

    // Photosphere badge
    if (node.environment?.isPhotosphere) {
      ctx.font = `bold ${Math.max(7, fs - 4)}px "Share Tech Mono", monospace`
      ctx.fillStyle = '#0033cc'
      ctx.fillText('SPHERE', px, py + dotR + fs + 18)
    }
  })

  // ── Player position — convert LIDAR grid coords to Voronoi canvas coords ──
  // The player walks through the LIDAR grid, but we need to show them on the Voronoi map.
  // Map player LIDAR position → nearest node → Voronoi canvas position, then interpolate.
  let nearestIdx = 0, nearestDist = Infinity
  for (const [nid, pos] of Object.entries(ZONE_POSITIONS)) {
    const d = Math.hypot(player.x - pos.x, player.y - pos.y)
    if (d < nearestDist) {
      nearestDist = d
      nearestIdx = nodes.findIndex(n => n.id === nid)
    }
  }

  // Compute player position as weighted blend of nearby nodes
  let playerFlatX = points[nearestIdx]?.[0] ?? cw / 2
  let playerFlatY = points[nearestIdx]?.[1] ?? ch / 2

  // Better: use all node positions to interpolate
  const entries = Object.entries(ZONE_POSITIONS)
  if (entries.length > 1) {
    let totalW = 0, wx = 0, wy = 0
    for (const [nid, pos] of entries) {
      const d = Math.max(0.5, Math.hypot(player.x - pos.x, player.y - pos.y))
      const w = 1 / (d * d)
      const ni = nodes.findIndex(n => n.id === nid)
      if (ni >= 0 && points[ni]) {
        wx += points[ni]![0] * w
        wy += points[ni]![1] * w
        totalW += w
      }
    }
    if (totalW > 0) {
      playerFlatX = wx / totalW
      playerFlatY = wy / totalW
    }
  }

  // FOV cone
  const dirAngle = Math.atan2(player.dirY, player.dirX)
  const coneR = Math.max(30, vw * 0.08)
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#e60000'
  ctx.beginPath()
  ctx.moveTo(playerFlatX, playerFlatY)
  ctx.arc(playerFlatX, playerFlatY, coneR, dirAngle - 0.5, dirAngle + 0.5)
  ctx.closePath()
  ctx.fill()

  // Direction line
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = '#e60000'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(playerFlatX, playerFlatY)
  ctx.lineTo(playerFlatX + Math.cos(dirAngle) * coneR * 0.7, playerFlatY + Math.sin(dirAngle) * coneR * 0.7)
  ctx.stroke()

  // Player dot
  ctx.globalAlpha = 1
  ctx.fillStyle = '#e60000'
  ctx.beginPath()
  ctx.arc(playerFlatX, playerFlatY, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Restore transform — HUD below is screen-space
  ctx.restore()

  // ── HUD overlay ──
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.font = 'bold 12px "Share Tech Mono", monospace'
  ctx.fillStyle = '#1a1a1a'
  ctx.fillText(`ARGO · ${graph.nodes.size} NODES · ${graph.epoch} EPOCHS`, 12, ch - 24)
  ctx.font = '10px "Share Tech Mono", monospace'
  ctx.fillStyle = '#666'
  ctx.fillText(`$${apiState.costUsd.toFixed(3)} · ${apiState.imageCount} IMG · ${Math.round(flatZoom * 100)}% zoom`, 12, ch - 10)

  ctx.textAlign = 'center'
  ctx.font = '11px "Share Tech Mono", monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillText('CLICK TERRITORY TO TELEPORT · SCROLL ZOOM · DRAG TO PAN', cw / 2, ch - 8)
}

// Flat canvas click to teleport (suppressed if user dragged)
flatCanvas.addEventListener('click', (e: MouseEvent) => {
  if (currentScale !== 'flat') return
  if (flatDragTotal > 5) return // Was a drag, not a click
  const rect = flatCanvas.getBoundingClientRect()
  let mx = (e.clientX - rect.left) * (flatCanvas.width / rect.width)
  let my = (e.clientY - rect.top) * (flatCanvas.height / rect.height)

  // Inverse zoom/pan transform
  const cw = flatCanvas.width, ch = flatCanvas.height
  mx = (mx - cw / 2 - flatPanX) / flatZoom + cw / 2
  my = (my - ch / 2 - flatPanY) / flatZoom + ch / 2

  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 2) return

  // Same coordinate mapping as renderFlat()
  const margin = 40
  const vw = flatCanvas.width - margin * 2
  const vh = flatCanvas.height - margin * 2

  const points: [number, number][] = nodes.map(n => {
    const wx = nodeWorldX(n)
    const wz = nodeWorldZ(n)
    const u = worldToCanvasX(wx, FLOOR_RES) / FLOOR_RES
    const v = worldToCanvasY(wz, FLOOR_RES) / FLOOR_RES
    return [margin + u * vw, margin + v * vh] as [number, number]
  })

  // Use d3-delaunay find() for proper Voronoi cell hit
  const d3 = (window as any).d3
  if (!d3?.Delaunay) return
  const delaunay = d3.Delaunay.from(points)
  const hitIdx = delaunay.find(mx, my)
  const hitNode = nodes[hitIdx]

  if (hitNode) {
    walkToNode(hitNode.id)
    activeNodeId = hitNode.id
    showInspector(hitNode)
    drawVoronoiFloor(null, hitNode.id)
    window.showBanner('TELEPORT', `Walking to ${hitNode.text}`)
  }
})

buildLidarPlan()

// ══════════════════════════════════════════════════════════════
// PHOTOSPHERE SCALE — 360° immersive interior
// Extracted from Achilles v2 ShaderMaterial + BackSide
// ══════════════════════════════════════════════════════════════
const sphereGroup = new THREE.Group()
sphereGroup.name = 'sphere'
sphereGroup.visible = false
scene.add(sphereGroup)

let activeSphereNode: WorldNode | null = null

function enterPhotosphere(node: WorldNode): void {
  while (sphereGroup.children.length) sphereGroup.remove(sphereGroup.children[0]!)
  activeSphereNode = node

  const INTERIOR_RADIUS = 80

  // Interior surface canvas — high-res like Achilles
  const intCanvas = document.createElement('canvas')
  intCanvas.width = 2048
  intCanvas.height = 1024
  const ictx = intCanvas.getContext('2d')!
  const hexColor = wlesHex(node.category)

  // ── Step 1: Voronoi territory map as the base layer (painted FIRST, opaque) ──
  // This is the background environment. Text goes ON TOP.
  const allNodes = Array.from(graph.nodes.values())
  const mosaicD3 = (window as any).d3
  if (allNodes.length >= 2 && mosaicD3?.Delaunay) {
    const iW = 2048, iH = 1024
    const mMarg = 30

    const mPoints: [number, number][] = allNodes.map(n => {
      const wx = nodeWorldX(n)
      const wz = nodeWorldZ(n)
      const u = worldToCanvasX(wx, FLOOR_RES) / FLOOR_RES
      const v = worldToCanvasY(wz, FLOOR_RES) / FLOOR_RES
      return [mMarg + u * (iW - mMarg * 2), mMarg + v * (iH - mMarg * 2)] as [number, number]
    })

    const mDel = mosaicD3.Delaunay.from(mPoints)
    const mVor = mDel.voronoi([0, 0, iW, iH])

    // Opaque cell fills — no alpha compositing artifacts
    allNodes.forEach((n, i) => {
      const baseH = wlesHue(n.category)
      const isCur = n.id === node.id
      ictx.beginPath()
      mVor.renderCell(i, ictx)
      ictx.fillStyle = `hsl(${baseH}, 40%, ${isCur ? 18 : 10}%)`
      ictx.fill()
    })

    // Cell borders
    allNodes.forEach((_n, i) => {
      ictx.beginPath()
      mVor.renderCell(i, ictx)
      ictx.strokeStyle = 'rgba(255,255,255,0.12)'
      ictx.lineWidth = 2
      ictx.stroke()
    })

    // Node dots
    allNodes.forEach((n, i) => {
      const [px, py] = mPoints[i]!
      const isCur = n.id === node.id
      ictx.beginPath()
      ictx.arc(px, py, isCur ? 8 : 4, 0, Math.PI * 2)
      ictx.fillStyle = isCur ? '#fff' : `hsla(${wlesHue(n.category)}, 60%, 55%, 0.7)`
      ictx.fill()

      // Small label near dot
      if (!isCur) {
        ictx.font = '14px "Share Tech Mono", monospace'
        ictx.fillStyle = 'rgba(255,255,255,0.35)'
        ictx.textAlign = 'center'
        ictx.textBaseline = 'top'
        const lbl = n.text.length > 14 ? n.text.slice(0, 12) + '…' : n.text
        ictx.fillText(lbl.toUpperCase(), px, py + 8)
      }
    })
  } else {
    // Fallback solid dark background
    ictx.fillStyle = '#0e0d0a'
    ictx.fillRect(0, 0, 2048, 1024)
  }

  // ── Step 2: Text content ON TOP of the Voronoi ──
  // Semi-transparent dark panel behind text for legibility
  ictx.fillStyle = 'rgba(14, 13, 10, 0.7)'
  ictx.fillRect(40, 40, 1200, 940)

  // Title band
  ictx.fillStyle = hexColor
  ictx.font = 'bold 72px "Share Tech Mono", monospace'
  ictx.textAlign = 'left'
  ictx.textBaseline = 'top'
  ictx.fillText(node.text.toUpperCase(), 80, 80)

  // Category
  ictx.font = 'bold 36px "Share Tech Mono", monospace'
  ictx.fillStyle = '#888'
  ictx.fillText(`[${(WLES_NAMES[node.category] ?? node.category).toUpperCase()}]  EPOCH ${node.epoch}`, 80, 180)

  // Description body — use Pretext for proper text layout
  const sphereFont = 'italic 38px "EB Garamond", Georgia, serif'
  ictx.font = sphereFont
  let bodyY = 280
  try {
    const prepared = prepare(node.text, ictx, { font: sphereFont })
    const result = layoutWithLines(prepared, 1100, 52)
    ictx.fillStyle = '#ccc'
    for (const line of result.lines.slice(0, 12)) {
      ictx.fillText(line.text, 80, bodyY)
      bodyY += 52
    }
  } catch (_e) {
    // Fallback: simple word-wrap
    ictx.fillStyle = '#ccc'
    const bodyWords = node.text.split(' ')
    let bodyLine = ''
    for (const word of bodyWords) {
      const test = bodyLine + (bodyLine ? ' ' : '') + word
      if (ictx.measureText(test).width > 1100 && bodyLine) {
        ictx.fillText(bodyLine, 80, bodyY)
        bodyY += 52
        bodyLine = word
      } else {
        bodyLine = test
      }
    }
    if (bodyLine) ictx.fillText(bodyLine, 80, bodyY)
  }

  // Connected nodes list
  bodyY += 80
  ictx.font = 'bold 28px "Share Tech Mono", monospace'
  ictx.fillStyle = '#666'
  ictx.fillText('CONNECTED NODES:', 80, bodyY)
  bodyY += 48
  for (const edgeId of node.edges) {
    const target = graph.nodes.get(edgeId)
    if (!target || bodyY > 900) continue
    ictx.fillStyle = wlesHex(target.category)
    ictx.fillText(`→ ${target.text}`, 120, bodyY)
    bodyY += 40
  }

  const intTexture = new THREE.CanvasTexture(intCanvas)
  intTexture.wrapS = THREE.ClampToEdgeWrapping
  intTexture.wrapT = THREE.ClampToEdgeWrapping

  // Interior sphere — BackSide immersive (Achilles v2 core pattern)
  const intMaterial = createPhotosphereMaterial(intTexture)
  intMaterial.side = THREE.BackSide
  intMaterial.uniforms.uImmersive.value = 1.0
  intMaterial.uniforms.uOpacity.value = 1.0

  const interiorSphere = new THREE.Mesh(
    new THREE.SphereGeometry(INTERIOR_RADIUS, 96, 48),
    intMaterial,
  )
  sphereGroup.add(interiorSphere)

  // Interior ambient light
  const glowLight = new THREE.PointLight(
    wlesColor(node.category), 1.5, INTERIOR_RADIUS * 2,
  )
  sphereGroup.add(glowLight)

  // Connected node orbs floating inside
  for (let i = 0; i < node.edges.length; i++) {
    const target = graph.nodes.get(node.edges[i]!)
    if (!target) continue
    const angle = (i / node.edges.length) * Math.PI * 2
    const r = INTERIOR_RADIUS * 0.5
    const orbGeo = new THREE.SphereGeometry(2.5, 16, 8)
    const orbMat = new THREE.MeshStandardMaterial({
      color: wlesColor(target.category),
      emissive: wlesColor(target.category),
      emissiveIntensity: 0.6,
    })
    const orb = new THREE.Mesh(orbGeo, orbMat)
    orb.position.set(
      Math.cos(angle) * r,
      Math.sin(i * 1.5) * 15,
      Math.sin(angle) * r,
    )
    sphereGroup.add(orb)

    // Orb label
    const orbLabel = makeLabelTexture(target.text, wlesHex(target.category))
    const orbSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: orbLabel, transparent: true })
    )
    orbSprite.scale.set(12, 3, 1)
    orbSprite.position.copy(orb.position).add(new THREE.Vector3(0, 5, 0))
    sphereGroup.add(orbSprite)
  }

  // Place camera at center of sphere
  camera.position.set(0, 2, 0)
  orbitControls.target.set(0, 2, 10)
  orbitControls.enabled = true
  orbitControls.minDistance = 0
  orbitControls.maxDistance = INTERIOR_RADIUS * 0.8
  orbitControls.maxPolarAngle = Math.PI
}

// ══════════════════════════════════════════════════════════════
// SCALE SWITCHING
// ══════════════════════════════════════════════════════════════
function setScale(scale: Scale): void {
  currentScale = scale

  // Visibility — Three.js elements
  for (const nm of nodeMeshMap.values()) nm.group.visible = scale === 'voronoi'
  for (const line of edgeLines) line.visible = scale === 'voronoi'
  sphereGroup.visible = scale === 'sphere'
  ground.visible = scale === 'voronoi'
  gridHelper.visible = scale === 'voronoi' && showGrid

  // Canvas layers — walk and flat overlay the Three.js scene
  walkCanvas.style.display = scale === 'walk' ? 'block' : 'none'
  flatCanvas.style.display = scale === 'flat' ? 'block' : 'none'

  // Resize canvases on activation
  if (scale === 'walk' || scale === 'flat') {
    const zone = document.getElementById('canvas-zone')!
    const w = zone.clientWidth
    const h = zone.clientHeight
    if (scale === 'walk') {
      walkCanvas.width = w; walkCanvas.height = h
    } else {
      flatCanvas.width = w; flatCanvas.height = h
    }
    // Rebuild LIDAR plan in case graph changed
    buildLidarPlan()
  }

  // Background
  if (scale === 'sphere') {
    scene.background = new THREE.Color(0x0e0d0a)
  } else {
    scene.background = new THREE.Color(0xeae7e0)
  }

  // Walk minimap visibility
  const minimap = document.getElementById('walk-minimap') as HTMLCanvasElement
  minimap.style.display = scale === 'walk' ? 'block' : 'none'

  // Camera position
  if (scale === 'voronoi') {
    camera.position.set(300, 350, 550)
    orbitControls.target.set(300, 0, 300)
    orbitControls.enabled = true
    // Restore zoom limits (sphere may have changed them)
    orbitControls.minDistance = 150
    orbitControls.maxDistance = 1200
    orbitControls.maxPolarAngle = Math.PI * 0.48
    renderer.domElement.style.cursor = 'auto'
  } else if (scale === 'flat') {
    orbitControls.enabled = false
    renderer.domElement.style.cursor = 'auto'
    window.showBanner('FLAT', 'Click a territory to teleport · Scroll to zoom')
  } else if (scale === 'walk') {
    orbitControls.enabled = false
    renderer.domElement.style.cursor = 'crosshair'
    window.showBanner('WALK', 'WASD to move · A/D to turn · 1-9 teleport')
  } else if (scale === 'sphere') {
    orbitControls.enabled = false
    const photoNodes = Array.from(graph.nodes.values()).filter(n => n.environment?.isPhotosphere)
    if (photoNodes.length > 0) {
      enterPhotosphere(photoNodes[0]!)
    } else {
      const first = Array.from(graph.nodes.values())[0]
      if (first) enterPhotosphere(first)
    }
    renderer.domElement.style.cursor = 'crosshair'
  }

  // Update scale buttons
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('on', (btn as HTMLElement).dataset.scale === scale)
  })

  window.showBanner('SCALE', scale.toUpperCase())
}

// ══════════════════════════════════════════════════════════════
// TIMELINE NODE STRIP — extracted from Achilles v2
// ══════════════════════════════════════════════════════════════
function buildNodeStrip(): void {
  const strip = document.getElementById('tl-node-strip')!
  strip.innerHTML = ''

  for (const node of graph.nodes.values()) {
    const btn = document.createElement('button')
    btn.className = 'tl-node'
    if (activeNodeId === node.id) btn.classList.add('on')

    const dot = document.createElement('span')
    dot.className = 'tl-node-dot'
    dot.style.background = wlesHex(node.category)
    btn.appendChild(dot)

    const name = document.createElement('span')
    name.className = 'tl-node-name'
    name.textContent = node.text.length > 14 ? node.text.slice(0, 12) + '…' : node.text
    btn.appendChild(name)

    btn.addEventListener('click', () => {
      activeNodeId = node.id
      focusNode(node)
      showInspector(node)
      buildNodeStrip() // Re-render strip to update active state
    })

    strip.appendChild(btn)
  }
}

buildNodeStrip()

// ══════════════════════════════════════════════════════════════
// INSPECTOR PANEL — extracted from Achilles v2
// ══════════════════════════════════════════════════════════════
function showInspector(node: WorldNode): void {
  const panel = document.getElementById('inspector-panel')!
  const hexColor = wlesHex(node.category)
  const catName = WLES_NAMES[node.category] ?? node.category

  const edgeLinks = node.edges.map(id => {
    const target = graph.nodes.get(id)
    return target
      ? `<button class="insp-edge-link" onclick="window._focusNodeId('${id}')"
           style="border-color:${wlesHex(target.category)}; color:${wlesHex(target.category)};">${target.text}</button>`
      : ''
  }).join('')

  panel.innerHTML = `
    <div class="insp-cat" style="color:${hexColor};">${catName}</div>
    <div class="insp-title">${node.text}</div>
    <div class="insp-row"><span class="insp-k">ID</span><span class="insp-v" style="font-size:10px;">${node.id.slice(0, 12)}…</span></div>
    <div class="insp-row"><span class="insp-k">VALENCE</span><span class="insp-v">${node.valence}</span></div>
    <div class="insp-row"><span class="insp-k">EPOCH</span><span class="insp-v">${node.epoch}</span></div>
    <div class="insp-row"><span class="insp-k">ZONE</span><span class="insp-v">${node.spatial.zoneKey || '—'}</span></div>
    <div class="insp-row"><span class="insp-k">POSITION</span><span class="insp-v">${node.spatial.x.toFixed(0)}, ${node.spatial.y.toFixed(0)}</span></div>
    <div class="insp-row"><span class="insp-k">PHOTOSPHERE</span><span class="insp-v">${node.environment?.isPhotosphere ? '✓ YES' : '—'}</span></div>
    <div class="insp-row"><span class="insp-k">EDGES</span><span class="insp-v">${node.edges.length}</span></div>
    ${node.edges.length > 0 ? `
      <div class="insp-edges">
        <div class="sh-label" style="margin-top:8px;">CONNECTED NODES</div>
        ${edgeLinks}
      </div>
    ` : ''}
    ${node.environment?.isPhotosphere ? `
      <button class="sh-btn primary" style="margin-top:12px;" onclick="window._enterSphereById('${node.id}')">
        ENTER PHOTOSPHERE
      </button>
    ` : ''}
    ${(() => {
      const nbs = getNeighbors(node)
      if (!nbs.length) return ''
      return `
        <div class="sh-label" style="margin-top:8px;">BORDER AFFINITY</div>
        ${nbs.map(({ node: nb, pct }) => {
          const h1 = wlesHue(node.category)
          const h2 = wlesHue(nb.category)
          return `
            <div style="margin:3px 0;">
              <div class="insp-row">
                <span class="insp-k" style="color:${wlesHex(nb.category)};">${nb.text.slice(0, 20)}</span>
                <span class="insp-v">${pct}%</span>
              </div>
              <div style="height:4px; background:#ddd; border:1px solid #000; margin-top:2px;">
                <div style="height:100%; width:${pct}%; background:linear-gradient(to right, hsl(${h1},80%,60%), hsl(${h2},80%,60%));"></div>
              </div>
            </div>
          `
        }).join('')}
      `
    })()}
    <button class="sh-btn primary" style="margin-top:12px; background:hsl(${OPS[currentOp]?.hue ?? 0},68%,45%); color:white; border-color:hsl(${OPS[currentOp]?.hue ?? 0},68%,35%);"
      onclick="window._fireOperatorOnNode('${node.id}')">
      FIRE ${OPS[currentOp]?.lbl ?? 'OPERATOR'} → ANALYZE
    </button>
    <button class="sh-btn" style="margin-top:6px; color:#e60000; border-color:#e60000;"
      onclick="window._deleteNode('${node.id}')">
      DELETE NODE
    </button>
  `

  // Open Sheet A
  window.execNav('A')
}

// Global handler for operator firing from inspector
;(window as any)._fireOperatorOnNode = (id: string) => {
  const node = graph.nodes.get(id)
  if (node) fireOperator(node)
}

// Global handler for node deletion
;(window as any)._deleteNode = (id: string) => {
  const node = graph.nodes.get(id)
  if (!node) return

  // Snapshot before destructive action
  if (typeof captureSnapshot === 'function') captureSnapshot('DEL')

  console.log(`[ARGO] Deleting node: ${node.text} (${id})`)

  // Remove edges pointing TO this node
  for (const n of graph.nodes.values()) {
    n.edges = n.edges.filter(e => e !== id)
  }
  // Remove from graph
  graph.nodes.delete(id)

  // Remove 3D mesh
  const nm = nodeMeshMap.get(id)
  if (nm) {
    scene.remove(nm.group)
    nodeMeshMap.delete(id)
  }

  // Clear selection
  activeNodeId = null
  hoveredNodeId = null

  // Rebuild everything
  computeMapping()
  computeAffinity()
  drawVoronoiFloor()
  buildLidarPlan()
  buildNodeStrip()

  window.showBanner('DELETED', `"${node.text}" removed`)
  window.closeAllSheets()
}

// Focus camera on node
// Smooth camera animation state
let cameraTargetGoal: THREE.Vector3 | null = null
let cameraPositionGoal: THREE.Vector3 | null = null
const CAMERA_LERP_SPEED = 0.06

function focusNode(node: WorldNode): void {
  const nm = nodeMeshMap.get(node.id)
  if (!nm) return
  const pos = nm.group.position
  if (currentScale === 'voronoi') {
    // Animate smoothly instead of snapping — prevents camera lock
    cameraTargetGoal = new THREE.Vector3(pos.x, 0, pos.z)
    // Keep current camera angle but move toward the node at comfortable distance
    const dx = camera.position.x - orbitControls.target.x
    const dy = camera.position.y - orbitControls.target.y
    const dz = camera.position.z - orbitControls.target.z
    const dist = Math.max(120, Math.sqrt(dx * dx + dy * dy + dz * dz))
    const dirX = dx / (dist || 1)
    const dirY = dy / (dist || 1) 
    const dirZ = dz / (dist || 1)
    cameraPositionGoal = new THREE.Vector3(
      pos.x + dirX * Math.min(dist, 250),
      Math.max(60, pos.y + dirY * Math.min(dist, 250)),
      pos.z + dirZ * Math.min(dist, 250)
    )
  }
}

// Global handlers
;(window as any)._focusNodeId = (id: string) => {
  const node = graph.nodes.get(id)
  if (node) {
    activeNodeId = id
    focusNode(node)
    showInspector(node)
    buildNodeStrip()
  }
}
;(window as any)._enterSphereById = (id: string) => {
  const node = graph.nodes.get(id)
  if (node) {
    window.closeAllSheets()
    enterPhotosphere(node)
    setScale('sphere')
  }
}

// ══════════════════════════════════════════════════════════════
// OPERATOR QUIVER — click to select active operator
// ══════════════════════════════════════════════════════════════
document.querySelectorAll('.op-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const op = (btn as HTMLElement).dataset.op
    if (!op) return
    currentOp = op
    // Update visual state
    document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('on'))
    btn.classList.add('on')
    const opDef = OPS[op]
    if (opDef) {
      window.showBanner('OPERATOR', `${opDef.lbl} loaded — ${opDef.verb}`)
    }
  })
})

// ── Info Readout (bottom-left) — shows spatial context on hover ──
function updateInfoReadout(node: WorldNode | null): void {
  const readout = document.getElementById('info-readout')!
  const title = document.getElementById('ir-title')!
  const body = document.getElementById('ir-body')!
  if (!node) {
    readout.classList.remove('open')
    return
  }
  readout.classList.add('open')
  title.textContent = node.text
  title.style.color = wlesHex(node.category)

  const nbs = getNeighbors(node)
  const opDef = OPS[currentOp]
  body.innerHTML = `
    <div class="ir-row"><span class="ir-k">TYPE</span><span class="ir-v">${WLES_NAMES[node.category] ?? node.category}</span></div>
    <div class="ir-row"><span class="ir-k">OPERATOR</span><span class="ir-v" style="color:hsl(${opDef?.hue ?? 0},68%,45%);">${opDef?.lbl ?? '—'}</span></div>
    <div class="ir-row"><span class="ir-k">NEIGHBORS</span><span class="ir-v">${nbs.length}</span></div>
    ${nbs.slice(0, 3).map(({ node: nb, pct }) => `
      <div class="ir-row" style="margin-top:2px;">
        <span class="ir-k" style="color:${wlesHex(nb.category)};">${nb.text.slice(0, 16)}</span>
        <span class="ir-v">${pct}%</span>
      </div>
    `).join('')}
  `
}

// ══════════════════════════════════════════════════════════════
// GRAPH STATS (Sheet C)
// ══════════════════════════════════════════════════════════════
function updateGraphStats(): void {
  const stats = document.getElementById('graph-stats')
  if (!stats) return

  const nodes = Array.from(graph.nodes.values())
  const edgeCount = nodes.reduce((sum, n) => sum + n.edges.length, 0)
  const cats = new Map<string, number>()
  for (const n of nodes) {
    cats.set(n.category, (cats.get(n.category) ?? 0) + 1)
  }

  stats.innerHTML = `
    <div class="insp-row"><span class="insp-k">NODES</span><span class="insp-v">${nodes.length}</span></div>
    <div class="insp-row"><span class="insp-k">EDGES</span><span class="insp-v">${edgeCount}</span></div>
    <div class="insp-row"><span class="insp-k">EPOCH</span><span class="insp-v">${graph.epoch}</span></div>
  `

  const bars = document.getElementById('wles-bars')
  if (bars) {
    bars.innerHTML = Array.from(cats.entries()).map(([cat, count]) => {
      const pct = Math.round((count / nodes.length) * 100)
      const hex = wlesHex(cat as WLESCategory)
      return `
        <div style="margin:4px 0;">
          <div class="insp-row"><span class="insp-k" style="color:${hex};">${WLES_NAMES[cat] ?? cat}</span><span class="insp-v">${count}</span></div>
          <div style="height:6px; background:#ddd; border:1px solid #000; margin-top:2px;">
            <div style="height:100%; width:${pct}%; background:${hex};"></div>
          </div>
        </div>
      `
    }).join('')
  }
}
updateGraphStats()

// ══════════════════════════════════════════════════════════════
// RAYCASTER + DRAG — Twine Bridge draggability + hover Voronoi
// ══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const hoverTip = document.getElementById('hover-tip')!

let dragNode: WorldNode | null = null
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
let dragOffset = new THREE.Vector3()
let isDragging = false
let lastVoronoiHighlight: string | null = null

function updateNodePositions(): void {
  // Recompute mapping and redraw everything from spatial coords
  computeMapping()
  computeAffinity()  // Recalculate border percentages
  for (const [id, nm] of nodeMeshMap) {
    const node = graph.nodes.get(id)
    if (!node) continue
    nm.group.position.set(nodeWorldX(node), 0, nodeWorldZ(node))
  }
  drawVoronoiFloor(hoveredNodeId, activeNodeId)
  buildLidarPlan()
}

renderer.domElement.addEventListener('mousedown', (e: MouseEvent) => {
  if (currentScale !== 'voronoi' || e.button !== 0) return

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hitMeshes = Array.from(nodeMeshMap.values()).map(nm => nm.hitMesh)
  const intersects = raycaster.intersectObjects(hitMeshes)

  if (intersects.length > 0) {
    const nodeId = intersects[0]!.object.userData.nodeId as string
    const node = graph.nodes.get(nodeId)
    if (node) {
      dragNode = node
      isDragging = false
      // Suppress orbit controls during drag
      orbitControls.enabled = false
      // Compute offset from intersection to node center
      const intersection = new THREE.Vector3()
      raycaster.ray.intersectPlane(dragPlane, intersection)
      const nm = nodeMeshMap.get(nodeId)
      if (nm) dragOffset.copy(nm.group.position).sub(intersection)
    }
  }
})

renderer.domElement.addEventListener('mousemove', (e: MouseEvent) => {
  if (currentScale !== 'voronoi') return

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  // DRAG MODE — update node position
  if (dragNode) {
    isDragging = true
    raycaster.setFromCamera(pointer, camera)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlane, intersection)
    intersection.add(dragOffset)

    // Reverse-map world XZ → spatial coords
    const t_x = (intersection.x - FLOOR_PAD) / (FLOOR_SIZE - FLOOR_PAD * 2)
    const t_z = (intersection.z - FLOOR_PAD) / (FLOOR_SIZE - FLOOR_PAD * 2)
    dragNode.spatial.x = _mapMinX + t_x * _mapSpanX
    dragNode.spatial.y = _mapMinY + t_z * _mapSpanY

    // Move mesh immediately
    const nm = nodeMeshMap.get(dragNode.id)
    if (nm) nm.group.position.set(intersection.x, 0, intersection.z)

    // Recompute affinity + redraw Voronoi floor during drag
    computeAffinity()
    drawVoronoiFloor(dragNode.id, activeNodeId)
    renderer.domElement.style.cursor = 'grabbing'
    return
  }

  // HOVER MODE — highlight cells
  raycaster.setFromCamera(pointer, camera)
  const hitMeshes = Array.from(nodeMeshMap.values()).map(nm => nm.hitMesh)
  const intersects = raycaster.intersectObjects(hitMeshes)

  if (intersects.length > 0) {
    const nodeId = intersects[0]!.object.userData.nodeId as string
    if (nodeId !== hoveredNodeId) {
      hoveredNodeId = nodeId
      const node = graph.nodes.get(nodeId)
      if (node) {
        hoverTip.textContent = node.text
        hoverTip.style.display = 'block'
        renderer.domElement.style.cursor = 'grab'
        // Redraw floor with highlighted cell
        drawVoronoiFloor(nodeId, activeNodeId)
        updateInfoReadout(node)
      }
    }
    hoverTip.style.left = e.clientX + 12 + 'px'
    hoverTip.style.top = e.clientY + 12 + 'px'
  } else {
    if (hoveredNodeId) {
      hoveredNodeId = null
      hoverTip.style.display = 'none'
      renderer.domElement.style.cursor = 'auto'
      drawVoronoiFloor(null, activeNodeId)
      updateInfoReadout(null)
    }
  }
})

renderer.domElement.addEventListener('mouseup', () => {
  if (dragNode) {
    if (!isDragging) {
      // Was a click, not a drag — handle as selection
    }
    dragNode = null
    isDragging = false
    orbitControls.enabled = true
    renderer.domElement.style.cursor = 'auto'
    // Final Voronoi recompute with updated positions
    updateNodePositions()
  }
})

renderer.domElement.addEventListener('click', (e: MouseEvent) => {
  if (currentScale !== 'voronoi') return
  if (isDragging) return // Don't click-select if we just dragged

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const hitMeshes = Array.from(nodeMeshMap.values()).map(nm => nm.hitMesh)
  const intersects = raycaster.intersectObjects(hitMeshes)

  if (intersects.length > 0) {
    const nodeId = intersects[0]!.object.userData.nodeId as string
    const node = graph.nodes.get(nodeId)
    if (node) {
      activeNodeId = nodeId
      focusNode(node)
      showInspector(node)
      buildNodeStrip()
      fireRipple(node)               // Twine Bridge mechanical tick
      drawVoronoiFloor(hoveredNodeId, nodeId)
    }
  } else {
    // Clicked empty space — deselect
    if (activeNodeId) {
      activeNodeId = null
      hoveredNodeId = null
      drawVoronoiFloor(null, null)
      buildNodeStrip()
      updateInfoReadout(null)
    }
  }
})

// Double-click — zoom to overview
renderer.domElement.addEventListener('dblclick', () => {
  if (currentScale !== 'voronoi') return
  activeNodeId = null
  cameraTargetGoal = new THREE.Vector3(CENTER, 0, CENTER)
  cameraPositionGoal = new THREE.Vector3(CENTER + 200, 400, CENTER + 200)
  drawVoronoiFloor(null, null)
  buildNodeStrip()
  updateInfoReadout(null)
})

// ══════════════════════════════════════════════════════════════
// CONTEXT RING — right-click
// ══════════════════════════════════════════════════════════════
const ctxRing = document.getElementById('ctx-ring')!

renderer.domElement.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault()
  if (currentScale !== 'voronoi') return

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hitMeshes = Array.from(nodeMeshMap.values()).map(nm => nm.hitMesh)
  const intersects = raycaster.intersectObjects(hitMeshes)

  if (intersects.length > 0) {
    const nodeId = intersects[0]!.object.userData.nodeId as string
    const node = graph.nodes.get(nodeId)
    if (node) {
      activeNodeId = nodeId
      ctxRing.style.left = e.clientX + 'px'
      ctxRing.style.top = e.clientY + 'px'
      ctxRing.classList.add('open')

      // Wire context buttons
      ctxRing.querySelector('[data-action="inspect"]')!.addEventListener('click', () => {
        showInspector(node)
        ctxRing.classList.remove('open')
      }, { once: true })
      ctxRing.querySelector('[data-action="enter"]')!.addEventListener('click', () => {
        window.closeAllSheets()
        enterPhotosphere(node)
        setScale('sphere')
        ctxRing.classList.remove('open')
      }, { once: true })
      ctxRing.querySelector('[data-action="focus"]')!.addEventListener('click', () => {
        focusNode(node)
        ctxRing.classList.remove('open')
      }, { once: true })
    }
  }
})

document.addEventListener('click', () => ctxRing.classList.remove('open'))

// ══════════════════════════════════════════════════════════════
// MOVEMENT — WASD for walk mode via walkKeys (no PointerLock)
// ══════════════════════════════════════════════════════════════
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false }
const velocity = new THREE.Vector3()
const moveSpeed = 30

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  // Walk mode — feed into walkKeys
  if (currentScale === 'walk' || currentScale === 'flat') {
    walkKeys[e.key.toLowerCase()] = true

    // Number keys 1-9 = teleport to node
    const num = parseInt(e.key)
    if (num >= 1 && num <= 9) {
      const nodes = Array.from(graph.nodes.values())
      const targetNode = nodes[num - 1]
      if (targetNode) {
        walkToNode(targetNode.id)
        activeNodeId = targetNode.id
        showInspector(targetNode)
        window.showBanner('TELEPORT', `${num}: ${targetNode.text}`)
        console.log(`[ARGO/WALK] Teleport ${num} → ${targetNode.text}`)
      }
    }
  }

  switch (e.code) {
    case 'KeyW': moveState.forward = true; break
    case 'KeyS': moveState.backward = true; break
    case 'KeyA': moveState.left = true; break
    case 'KeyD': moveState.right = true; break
    case 'Space': moveState.up = true; e.preventDefault(); break
    case 'ShiftLeft': moveState.down = true; break
    case 'KeyG':
      // Fire operator on active node (all modes)
      if (activeNodeId) {
        const node = graph.nodes.get(activeNodeId)
        if (node) fireOperator(node)
      }
      break
    case 'KeyP':
      // Toggle spatial prompting
      if (currentScale === 'walk') {
        spatialPromptEnabled = !spatialPromptEnabled
        window.showBanner('SPATIAL', spatialPromptEnabled ? 'Spatial prompting ON — walk to generate' : 'Spatial prompting OFF')
        console.log(`[ARGO/SPATIAL] ${spatialPromptEnabled ? 'Enabled' : 'Disabled'}`)
      }
      break
    case 'KeyH':
      // Toggle grid overlay
      if (currentScale === 'voronoi') {
        showGrid = !showGrid
        gridHelper.visible = showGrid
        window.showBanner('GRID', showGrid ? 'Grid ON' : 'Grid OFF')
      }
      break
  }
})
document.addEventListener('keyup', (e) => {
  // Walk mode
  if (currentScale === 'walk' || currentScale === 'flat') {
    walkKeys[e.key.toLowerCase()] = false
  }

  switch (e.code) {
    case 'KeyW': moveState.forward = false; break
    case 'KeyS': moveState.backward = false; break
    case 'KeyA': moveState.left = false; break
    case 'KeyD': moveState.right = false; break
    case 'Space': moveState.up = false; break
    case 'ShiftLeft': moveState.down = false; break
  }
})

// ══════════════════════════════════════════════════════════════
// SCALE BUTTONS + CONTROL SURFACE WIRING
// ══════════════════════════════════════════════════════════════
document.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setScale((btn as HTMLElement).dataset.scale as Scale)
  })
})

// Compile button
document.getElementById('btn-compile')?.addEventListener('click', () => {
  const src = (document.getElementById('wt-editor') as HTMLTextAreaElement)?.value
  if (!src) return
  // Snapshot before destructive recompile
  if (typeof captureSnapshot === 'function') captureSnapshot('COMP')
  window.showBanner('COMPILER', 'Recompiling WorldText…')
  try {
    const result = compile(src)
    // Rebuild everything from new graph
    graph.nodes.clear()
    for (const [id, node] of result.graph.nodes) graph.nodes.set(id, node)
    graph.epoch = result.graph.epoch

    layoutGraph(graph, { width: 200, height: 200, iterations: 80 })
    assignZones(graph, 16)
    computeMapping()
    buildVoronoi()
    drawVoronoiFloor()
    buildLidarPlan()
    buildNodeStrip()
    updateGraphStats()

    window.showBanner('COMPILER', `✓ ${graph.nodes.size} nodes compiled`)
  } catch (err) {
    window.showBanner('ERROR', String(err), 5000)
  }
})

// Recompile button in timeline
document.getElementById('btn-recompile')?.addEventListener('click', () => {
  document.getElementById('btn-compile')?.click()
})

// Export JSON
document.getElementById('btn-export-json')?.addEventListener('click', () => {
  const json = serializeGraph(graph)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'golden-fleece-graph.json'
  a.click()
  URL.revokeObjectURL(url)
  window.showBanner('EXPORT', 'JSON downloaded')
})

// Export WorldText
document.getElementById('btn-export-wt')?.addEventListener('click', () => {
  const src = (document.getElementById('wt-editor') as HTMLTextAreaElement)?.value || ''
  const blob = new Blob([src], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'golden-fleece.wt'
  a.click()
  URL.revokeObjectURL(url)
  window.showBanner('EXPORT', 'WorldText downloaded')
})

// Copy button
document.getElementById('btn-copy-wt')?.addEventListener('click', () => {
  const src = (document.getElementById('wt-editor') as HTMLTextAreaElement)?.value || ''
  navigator.clipboard.writeText(src)
  window.showBanner('COPY', 'WorldText copied to clipboard')
})

// Screenshot
document.getElementById('btn-screenshot')?.addEventListener('click', () => {
  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'golden-fleece-screenshot.png'
  a.click()
  window.showBanner('EXPORT', 'Screenshot saved')
})

// ══════════════════════════════════════════════════════════════
// RENDER LOOP — with EffectComposer
// ══════════════════════════════════════════════════════════════
const clock = new THREE.Clock()

function animate(): void {
  requestAnimationFrame(animate)
  const dt = clock.getDelta()
  const t = clock.elapsedTime

  // Update shader time uniforms
  for (const nm of nodeMeshMap.values()) {
    nm.material.uniforms.uTime.value = t
  }

  // Walk mode — canvas raycaster (no Three.js movement)
  if (currentScale === 'walk') {
    renderWalk()
    renderWalkMinimap()
  }

  // Flat mode — overhead view
  if (currentScale === 'flat') {
    renderFlat()
  }

  // Orbit controls (voronoi mode) + smooth camera animation
  if (currentScale === 'voronoi') {
    // Smooth camera lerp — animate to focusNode goal
    if (cameraTargetGoal) {
      orbitControls.target.lerp(cameraTargetGoal, CAMERA_LERP_SPEED)
      if (orbitControls.target.distanceTo(cameraTargetGoal) < 1) {
        cameraTargetGoal = null
      }
    }
    if (cameraPositionGoal) {
      camera.position.lerp(cameraPositionGoal, CAMERA_LERP_SPEED)
      if (camera.position.distanceTo(cameraPositionGoal) < 1) {
        cameraPositionGoal = null
      }
    }
    orbitControls.update()
  }

  // Node animation — gentle bob + core pulse
  if (currentScale === 'voronoi') {
    for (const nm of nodeMeshMap.values()) {
      const n = nm.node
      const bob = Math.sin(t * 0.5 + n.epoch) * 0.8
      nm.group.position.y = bob
      // Core pulse
      const coreMat = nm.core.material as THREE.MeshBasicMaterial
      coreMat.opacity = 0.3 + Math.sin(t * 1.2 + n.epoch * 2) * 0.2

      // Active highlight
      if (activeNodeId === n.id) {
        nm.ring.material = new THREE.MeshBasicMaterial({
          color: wlesColor(n.category), transparent: true, opacity: 0.3,
          side: THREE.DoubleSide,
        })
      }
    }
  }

  // Sphere interior slow rotation
  if (currentScale === 'sphere' && sphereGroup.children.length > 0) {
    sphereGroup.children[0]!.rotation.y = t * 0.015
  }

  // Render Three.js scene (voronoi + sphere modes only)
  if (currentScale === 'voronoi' || currentScale === 'sphere') {
    composer.render()
  }
}

animate()

// ── Resize handler ──
window.addEventListener('resize', () => {
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  composer.setSize(w, h)
  // Also resize walk/flat canvases
  if (currentScale === 'walk') {
    walkCanvas.width = w; walkCanvas.height = h
  } else if (currentScale === 'flat') {
    flatCanvas.width = w; flatCanvas.height = h
  }
})

// ── Initial banner ──
window.showBanner('GOLDEN FLEECE', `${graph.nodes.size} nodes · ${graph.epoch} epochs — Shared Control Surface awake`)

// ══════════════════════════════════════════════════════════════
// STATE SNAPSHOT / BUFFER RING — record + undo/redo + thumbnails
// Inspired by rcc-gn / icaro-pro buffer ring pattern
// ══════════════════════════════════════════════════════════════
interface StateSnapshot {
  id: number
  label: string
  epoch: number
  ts: number
  nodes: Map<string, WorldNode>
  positions: Record<string, { x: number; y: number }>
  thumbnail?: HTMLCanvasElement
}

const MAX_SNAPSHOTS = 50
const snapshots: StateSnapshot[] = []
let snapshotCursor = -1 // index of current state in snapshots
let snapshotIdCounter = 0

function deepCloneNodes(): Map<string, WorldNode> {
  const cloned = new Map<string, WorldNode>()
  for (const [id, node] of graph.nodes) {
    cloned.set(id, {
      ...node,
      edges: [...node.edges],
      environment: node.environment ? { ...node.environment } : undefined,
    })
  }
  return cloned
}

function deepClonePositions(): Record<string, { x: number; y: number }> {
  const cloned: Record<string, { x: number; y: number }> = {}
  for (const [nid, pos] of Object.entries(ZONE_POSITIONS)) {
    cloned[nid] = { x: pos.x, y: pos.y }
  }
  return cloned
}

function captureSnapshot(label: string): void {
  // If cursor is not at the end, truncate future snapshots (new branch)
  if (snapshotCursor < snapshots.length - 1) {
    snapshots.length = snapshotCursor + 1
  }

  const snap: StateSnapshot = {
    id: snapshotIdCounter++,
    label,
    epoch: graph.epoch,
    ts: Date.now(),
    nodes: deepCloneNodes(),
    positions: deepClonePositions(),
  }

  // Generate tiny Voronoi thumbnail
  snap.thumbnail = renderSnapshotThumbnail(snap)

  snapshots.push(snap)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()
  snapshotCursor = snapshots.length - 1

  renderBufferRing()
  console.log(`[ARGO/SNAP] #${snap.id} "${label}" — ${snap.nodes.size} nodes, epoch ${snap.epoch}`)
}

function restoreSnapshot(index: number): void {
  if (index < 0 || index >= snapshots.length) return
  const snap = snapshots[index]!
  snapshotCursor = index

  // Restore graph state
  graph.nodes.clear()
  for (const [id, node] of snap.nodes) {
    graph.nodes.set(id, {
      ...node,
      edges: [...node.edges],
      environment: node.environment ? { ...node.environment } : undefined,
    })
  }
  graph.epoch = snap.epoch

  // Restore positions
  for (const [nid, pos] of Object.entries(snap.positions)) {
    ZONE_POSITIONS[nid] = { x: pos.x, y: pos.y }
  }

  // Rebuild visuals
  drawVoronoiFloor(null, activeNodeId)
  buildNodeStrip()
  if (activeNodeId) {
    const node = graph.nodes.get(activeNodeId)
    if (node) showInspector(node)
  }

  renderBufferRing()
  window.showBanner('UNDO', `Restored: ${snap.label} (${snap.nodes.size} nodes)`)
  console.log(`[ARGO/SNAP] Restored #${snap.id} "${snap.label}"`)
}

function undo(): void {
  if (snapshotCursor > 0) restoreSnapshot(snapshotCursor - 1)
  else window.showBanner('UNDO', 'Nothing to undo')
}

function redo(): void {
  if (snapshotCursor < snapshots.length - 1) restoreSnapshot(snapshotCursor + 1)
  else window.showBanner('REDO', 'Nothing to redo')
}

function renderSnapshotThumbnail(snap: StateSnapshot): HTMLCanvasElement {
  const tc = document.createElement('canvas')
  tc.width = 40
  tc.height = 40
  const ctx = tc.getContext('2d')!

  ctx.fillStyle = '#f0ece4'
  ctx.fillRect(0, 0, 40, 40)

  const allNodes = Array.from(snap.nodes.values())
  if (allNodes.length < 2) return tc

  const d3 = (window as any).d3
  if (!d3?.Delaunay) return tc

  const m = 3
  const points: [number, number][] = allNodes.map(n => {
    const wx = nodeWorldX(n)
    const wz = nodeWorldZ(n)
    const u = worldToCanvasX(wx, FLOOR_RES) / FLOOR_RES
    const v = worldToCanvasY(wz, FLOOR_RES) / FLOOR_RES
    return [m + u * (40 - m * 2), m + v * (40 - m * 2)] as [number, number]
  })

  const del = d3.Delaunay.from(points)
  const vor = del.voronoi([m, m, 40 - m, 40 - m])

  allNodes.forEach((n, i) => {
    ctx.beginPath()
    vor.renderCell(i, ctx)
    ctx.fillStyle = `hsla(${wlesHue(n.category)}, 60%, 55%, 0.5)`
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  })

  // Tiny node dots
  allNodes.forEach((_n, i) => {
    const [px, py] = points[i]!
    ctx.beginPath()
    ctx.arc(px, py, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fill()
  })

  return tc
}

function renderBufferRing(): void {
  const ring = document.getElementById('buffer-ring')
  if (!ring) return
  ring.innerHTML = ''

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i]!
    const el = document.createElement('div')
    el.className = `buf-snap${i === snapshotCursor ? ' current' : ''}`
    el.title = `${snap.label} · ${new Date(snap.ts).toLocaleTimeString()} · ${snap.nodes.size} nodes`

    if (snap.thumbnail) {
      el.appendChild(snap.thumbnail.cloneNode(true) as HTMLCanvasElement)
    }

    const label = document.createElement('div')
    label.className = 'buf-snap-label'
    label.textContent = snap.label.length > 6 ? snap.label.slice(0, 5) + '…' : snap.label
    el.appendChild(label)

    el.addEventListener('click', () => restoreSnapshot(i))
    ring.appendChild(el)
  }

  // Scroll to current
  ring.scrollLeft = ring.scrollWidth

  // Update undo/redo buttons
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement
  if (undoBtn) undoBtn.disabled = snapshotCursor <= 0
  if (redoBtn) redoBtn.disabled = snapshotCursor >= snapshots.length - 1
}

// Wire undo/redo buttons
document.getElementById('btn-undo')?.addEventListener('click', undo)
document.getElementById('btn-redo')?.addEventListener('click', redo)

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  }
})

// Capture initial state
captureSnapshot('INIT')

// ══════════════════════════════════════════════════════════════
// WALK MINIMAP — small Voronoi territory overlay in walk mode
// ══════════════════════════════════════════════════════════════
const minimapCanvas = document.getElementById('walk-minimap') as HTMLCanvasElement
const minimapCtx = minimapCanvas.getContext('2d')!

function renderWalkMinimap(): void {
  const mw = minimapCanvas.width
  const mh = minimapCanvas.height
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length < 2) return

  const ctx = minimapCtx
  ctx.fillStyle = 'rgba(240,236,228,0.92)'
  ctx.fillRect(0, 0, mw, mh)

  const margin = 8
  const vw = mw - margin * 2
  const vh = mh - margin * 2

  // Map world → minimap coords (same transform as renderFlat)
  const points: [number, number][] = nodes.map(n => {
    const wx = nodeWorldX(n)
    const wz = nodeWorldZ(n)
    const u = worldToCanvasX(wx, FLOOR_RES) / FLOOR_RES
    const v = worldToCanvasY(wz, FLOOR_RES) / FLOOR_RES
    return [margin + u * vw, margin + v * vh] as [number, number]
  })

  const d3 = (window as any).d3
  if (!d3?.Delaunay) return
  const delaunay = d3.Delaunay.from(points)
  const voronoi = delaunay.voronoi([margin, margin, margin + vw, margin + vh])

  // Cells
  nodes.forEach((node, i) => {
    const baseH = wlesHue(node.category)
    const isSel = node.id === activeNodeId
    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.fillStyle = hsl(baseH, 72, isSel ? 60 : 68, isSel ? 0.7 : 0.4)
    ctx.fill()
  })

  // Borders
  nodes.forEach((_node, i) => {
    ctx.beginPath()
    voronoi.renderCell(i, ctx)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  })

  // Node dots (tiny)
  nodes.forEach((node, i) => {
    const [px, py] = points[i]!
    const baseH = wlesHue(node.category)
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fillStyle = hsl(baseH, 80, 50, 0.9)
    ctx.fill()
  })

  // Player dot — inverse-distance weighted position
  const entries = Object.entries(ZONE_POSITIONS)
  let totalW = 0, wx = 0, wy = 0
  for (const [nid, pos] of entries) {
    const d = Math.max(0.5, Math.hypot(player.x - pos.x, player.y - pos.y))
    const w = 1 / (d * d)
    const ni = nodes.findIndex(n => n.id === nid)
    if (ni >= 0 && points[ni]) {
      wx += points[ni]![0] * w
      wy += points[ni]![1] * w
      totalW += w
    }
  }
  const pfx = totalW > 0 ? wx / totalW : mw / 2
  const pfy = totalW > 0 ? wy / totalW : mh / 2

  // FOV cone
  const dirAngle = Math.atan2(player.dirY, player.dirX)
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#e60000'
  ctx.beginPath()
  ctx.moveTo(pfx, pfy)
  ctx.arc(pfx, pfy, 16, dirAngle - 0.4, dirAngle + 0.4)
  ctx.closePath()
  ctx.fill()

  // Player dot
  ctx.globalAlpha = 1
  ctx.fillStyle = '#e60000'
  ctx.beginPath()
  ctx.arc(pfx, pfy, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Label
  ctx.font = 'bold 8px "Share Tech Mono", monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('MINIMAP', mw / 2, mh - 2)
}

// ══════════════════════════════════════════════════════════════
// FLAT VIEW — zoom / pan with mouse wheel + drag
// ══════════════════════════════════════════════════════════════
let flatZoom = 1
let flatPanX = 0
let flatPanY = 0
let flatDragging = false
let flatDragStartX = 0
let flatDragStartY = 0
let flatDragTotal = 0

flatCanvas.addEventListener('wheel', (e: WheelEvent) => {
  if (currentScale !== 'flat') return
  e.preventDefault()
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  flatZoom = Math.max(0.5, Math.min(4, flatZoom * factor))
}, { passive: false })

flatCanvas.addEventListener('mousedown', (e: MouseEvent) => {
  if (currentScale !== 'flat') return
  flatDragging = true
  flatDragTotal = 0
  flatDragStartX = e.clientX
  flatDragStartY = e.clientY
})
flatCanvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (!flatDragging) return
  const dx = e.clientX - flatDragStartX
  const dy = e.clientY - flatDragStartY
  flatPanX += dx
  flatPanY += dy
  flatDragTotal += Math.abs(dx) + Math.abs(dy)
  flatDragStartX = e.clientX
  flatDragStartY = e.clientY
})
window.addEventListener('mouseup', () => { flatDragging = false })

// ══════════════════════════════════════════════════════════════
// HELP BUTTON — toggles onboarding overlay
// ══════════════════════════════════════════════════════════════
const helpBtn = document.getElementById('help-btn')!
const helpOverlay = document.getElementById('help-overlay')!
const helpClose = document.getElementById('help-close')!

helpBtn.addEventListener('click', () => {
  helpOverlay.classList.toggle('on')
})
helpClose.addEventListener('click', () => {
  helpOverlay.classList.remove('on')
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpOverlay.classList.contains('on')) {
    helpOverlay.classList.remove('on')
    e.stopPropagation()
  }
})

// ══════════════════════════════════════════════════════════════
// API CASCADE COOLDOWN — prevent rapid-fire operator requests
// ══════════════════════════════════════════════════════════════
let lastApiRequestTime = 0
const API_COOLDOWN_MS = 5000 // 5s minimum between API calls

const _originalFireOperator = (window as any).__argo_fireOperator
;(window as any).__argo_cooldownCheck = function(): boolean {
  const now = Date.now()
  if (now - lastApiRequestTime < API_COOLDOWN_MS) {
    const wait = Math.ceil((API_COOLDOWN_MS - (now - lastApiRequestTime)) / 1000)
    window.showBanner('COOLDOWN', `Please wait ${wait}s before next API call`)
    console.warn(`[ARGO/API] Cooldown active — ${wait}s remaining`)
    return false
  }
  lastApiRequestTime = now
  return true
}

// ── HMR accept — prevent full page reloads ──
if (import.meta.hot) {
  import.meta.hot.accept()
}
