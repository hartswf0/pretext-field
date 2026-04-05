// ORCA PRETEXT LIDAR — Pulse-bounce text illumination engine
//
// Architecture:
//   1. 2D tile map defines collision geometry (walls of the Holler)
//   2. Player moves via WASD, aims via mouse cursor direction
//   3. Pressing SPACEBAR fires a light pulse from the player dot
//      toward the aimed direction
//   4. The pulse ray travels until it hits a wall, then BOUNCES
//      (reflects off the wall surface normal), losing energy
//   5. Each bounce spawns a radial light splash that fades with
//      distance from the impact point
//   6. Text visibility depends on the accumulated light energy
//      from all active pulse impacts and their bounce splashes
//   7. Canvas renders the resulting lines at 60 FPS
//
// This demonstrates pretext flowing text into dynamically-lit
// regions — the illumination shape is determined by physics
// (reflection) rather than a static cone.

import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ── MAP ──────────────────────────────────────────────────────────────────

const MAP_RAW = [
  '################',
  '#......#.......#',
  '#......#.......#',
  '#......#.......#',
  '#...........E..#',
  '#......#.......#',
  '###.####.###.###',
  '#......#.......#',
  '#..E...........#',
  '#......#.......#',
  '#......#.......#',
  '###.####.###.###',
  '#..............#',
  '#......E.......#',
  '#..............#',
  '################',
]

const MAP_H = MAP_RAW.length
const MAP_W = MAP_RAW[0]!.length
const TILE = 40

type TileCell = { solid: boolean; evidence: string | null }
const MAP: TileCell[][] = []

const EVIDENCE_POSITIONS: { x: number; y: number; key: string; collected: boolean }[] = []
const EVIDENCE_KEYS = ['PRISM', 'LAMBCHOP', 'HUBCAP']
let evidenceIdx = 0

for (let y = 0; y < MAP_H; y++) {
  MAP[y] = []
  for (let x = 0; x < MAP_W; x++) {
    const ch = MAP_RAW[y]![x]!
    if (ch === '#') {
      MAP[y]![x] = { solid: true, evidence: null }
    } else if (ch === 'E') {
      const key = EVIDENCE_KEYS[evidenceIdx % EVIDENCE_KEYS.length]!
      MAP[y]![x] = { solid: false, evidence: key }
      EVIDENCE_POSITIONS.push({ x: x + 0.5, y: y + 0.5, key, collected: false })
      evidenceIdx++
    } else {
      MAP[y]![x] = { solid: false, evidence: null }
    }
  }
}

// ── LORE TEXT (CULTURE-MIND-BRAIN CORPUS) ─────────────────────────────────

const HOLLER_LORE = [
  "Mind in its purest play is like some bat that beats about in caverns all alone, contriving by a kind of senseless wit not to conclude against a wall of stone.",
  "It has no need to falter or explore; darkly it knows what obstacles are there, and so may weave and flitter, dip and soar in perfect courses through the blackest air.",
  "And has this simile a like perfection? The mind is like a bat. Precisely. Save that in the very happiest intellection a graceful error may correct the cave.",
  "Mind in its purest play is like some bat that beats about in caverns all alone. The skull is not a boundary.",
  "Contriving by a kind of senseless wit not to conclude against a wall of stone. Where does mind stop and the rest of the world begin?",
  "Darkly it knows what obstacles are there. Feelings are physically felt and biologically grounded, acting as somatic markers enmeshed in the networks of reason.",
  "And so may weave and flitter, dip and soar in perfect courses through the blackest air. The Cartesian illusion of a private, autonomous, bounded mind.",
  "A graceful error may correct the cave. The ghost in the machine is exorcised only to reveal a piece of meat hopelessly entangled in a web of symbols.",
  "Save that in the very happiest intellection. Culture and mind are complements, not levels. Aspects, not entities. Landscapes, not realms.",
  "The death of Cartesian dualism. Brains in bodies, bodies in worlds. The end of the blank slate. The fiction of the borderless bio-cultural loop.",
]

const EVIDENCE_LORE: Record<string, string> = {
  PRISM: '◆ ARTIFACT #CMB-01: THE GAGE MATRIX — A 19th-century neurological trauma creates an archival void, eventually filled by late-20th-century anthropologists and neurologists to dismantle the Cartesian mind-body divide.',
  LAMBCHOP: '◆ ARTIFACT #CMB-02: THE SOMATIC MARKER — Damasio proves that emotion is not an intruder on reason but a necessary structural component. Without it, the decision-making landscape goes flat.',
  HUBCAP: '◆ ARTIFACT #CMB-03: THE UNCANNY BREACH — Andy Clark asks where mind stops. The heimlich space of private thought leaks into the terrifyingly public world. The skull is no longer a container.',
}

// ── ZONES (DISCIPLINARY MATRICES) ────────────────────────────────────────

type Zone = { name: string; color: string }

function getZone(tx: number, ty: number): Zone {
  if (ty < 6) {
    if (tx < 7) return { name: 'THE GAGE MATRIX', color: '#e8c547' }
    return { name: 'THE SEMIOTIC FIELD', color: '#6eb5ff' }
  }
  if (ty < 11) {
    if (tx < 7) return { name: 'THE SOMATIC WARD', color: '#e09050' }
    return { name: 'THE UNCANNY BREACH', color: '#9b7ecc' }
  }
  return { name: 'THE EXTENDED MIND', color: '#50c8a0' }
}

// ── PLAYER ───────────────────────────────────────────────────────────────

const player = {
  x: 3.5,
  y: 3.5,
  angle: 0,
  speed: 0.06,
}

const keys: Record<string, boolean> = {}
let mouseX = 0
let mouseY = 0
let isPointerLocked = false

// ── PRETEXT PREPARED HANDLES ─────────────────────────────────────────────

const BODY_FONT = '500 17px "Cormorant Garamond", Georgia, serif'
const MONO_FONT = '400 13px "JetBrains Mono", monospace'

const allLoreText = HOLLER_LORE.join(' ')
let preparedLore: PreparedTextWithSegments
let preparedEvidence: Map<string, PreparedTextWithSegments>

function prepareLore() {
  preparedLore = prepareWithSegments(allLoreText, BODY_FONT)
  preparedEvidence = new Map()
  for (const [key, text] of Object.entries(EVIDENCE_LORE)) {
    preparedEvidence.set(key, prepareWithSegments(text, MONO_FONT))
  }
}

// ── FLASHLIGHT CONE (always-on baseline) ────────────────────────────────

const RAY_COUNT = 120
const LIGHT_RANGE = 7     // tiles
const CONE_HALF_ANGLE = Math.PI / 4  // 90-degree cone

type VisPoint = { x: number; y: number; angle: number; dist: number }

function castFlashlightRay(ox: number, oy: number, angle: number): VisPoint {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let t = 0
  const step = 0.05
  while (t < LIGHT_RANGE) {
    t += step
    const cx = ox + dx * t
    const cy = oy + dy * t
    const mx = Math.floor(cx)
    const my = Math.floor(cy)
    if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) break
    if (MAP[my]![mx]!.solid) break
  }
  return { x: ox + dx * t, y: oy + dy * t, angle, dist: t }
}

function computeVisibilityPolygon(): VisPoint[] {
  const points: VisPoint[] = []
  const startAngle = player.angle - CONE_HALF_ANGLE
  const endAngle = player.angle + CONE_HALF_ANGLE
  const step = (endAngle - startAngle) / RAY_COUNT
  for (let i = 0; i <= RAY_COUNT; i++) {
    const a = startAngle + step * i
    points.push(castFlashlightRay(player.x, player.y, a))
  }
  return points
}

// Get cone-based light alpha at a world position
function getConeLightAlpha(wx: number, wy: number): number {
  const dx = wx - player.x
  const dy = wy - player.y
  const dist = Math.hypot(dx, dy)
  if (dist > LIGHT_RANGE) return 0

  // Check if point is within the cone angle
  const pointAngle = Math.atan2(dy, dx)
  let angleDiff = pointAngle - player.angle
  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
  if (Math.abs(angleDiff) > CONE_HALF_ANGLE) return 0

  // Check line of sight
  if (!hasLineOfSight(player.x, player.y, wx, wy)) return 0

  // Proximity-based brightness
  const proximity = Math.max(0, 1 - dist / LIGHT_RANGE)
  // Brighter in center of cone
  const angleFade = 1 - Math.abs(angleDiff) / CONE_HALF_ANGLE
  return proximity * 0.55 * (0.5 + angleFade * 0.5)
}

// ── PULSE-BOUNCE SYSTEM ─────────────────────────────────────────────────
//
// Pressing SPACE fires a ray that bounces off walls.
// Each impact creates a radial light splash that layers on TOP of the
// always-on flashlight cone.

const MAX_BOUNCES = 4
const PULSE_SPEED = 12      // tiles per second
const PULSE_ENERGY_DECAY = 0.6  // energy multiplier per bounce
const SPLASH_RADIUS = 7      // tiles
const SPLASH_FADE_TIME = 5.0 // seconds to full fade
const MAX_PULSES = 12        // max simultaneous pulses

type PulseImpact = {
  x: number       // tile coords
  y: number
  energy: number  // 0-1
  time: number    // timestamp when splash started
}

type PulseRay = {
  originX: number
  originY: number
  dirX: number
  dirY: number
  energy: number
  travelDist: number   // how far pulse has traveled so far (animated)
  maxDist: number      // total distance to wall
  hitX: number
  hitY: number
  alive: boolean
  spawnTime: number    // when this segment started
  bounceChildren: PulseRay[]  // reflected rays spawned on impact
}

type Pulse = {
  impacts: PulseImpact[]
  rootRay: PulseRay
  startTime: number
}

let activePulses: Pulse[] = []
let gameTime = 0

// Light energy grid (tile resolution)
const lightGrid: number[][] = []
for (let y = 0; y < MAP_H; y++) {
  lightGrid[y] = []
  for (let x = 0; x < MAP_W; x++) {
    lightGrid[y]![x] = 0
  }
}

function isSolid(x: number, y: number): boolean {
  const mx = Math.floor(x)
  const my = Math.floor(y)
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return true
  return MAP[my]![mx]!.solid
}

// Cast a ray and return the hit point + distance + wall normal
function castPulseRay(ox: number, oy: number, dx: number, dy: number): {
  hitX: number; hitY: number; dist: number; normalX: number; normalY: number
} {
  const step = 0.02
  let t = 0
  const maxRange = 20
  let lastX = ox, lastY = oy

  while (t < maxRange) {
    t += step
    const cx = ox + dx * t
    const cy = oy + dy * t

    if (isSolid(cx, cy)) {
      // Determine which face we hit by checking neighbors
      const hitTileX = Math.floor(cx)
      const hitTileY = Math.floor(cy)
      const lastTileX = Math.floor(lastX)
      const lastTileY = Math.floor(lastY)

      let nx = 0, ny = 0
      if (hitTileX !== lastTileX && hitTileY !== lastTileY) {
        // Corner hit — pick dominant axis
        if (Math.abs(dx) > Math.abs(dy)) {
          nx = dx > 0 ? -1 : 1
        } else {
          ny = dy > 0 ? -1 : 1
        }
      } else if (hitTileX !== lastTileX) {
        nx = dx > 0 ? -1 : 1
      } else {
        ny = dy > 0 ? -1 : 1
      }

      return { hitX: lastX, hitY: lastY, dist: t - step, normalX: nx, normalY: ny }
    }
    lastX = cx
    lastY = cy
  }

  return { hitX: ox + dx * maxRange, hitY: oy + dy * maxRange, dist: maxRange, normalX: 0, normalY: 0 }
}

function createPulseRay(ox: number, oy: number, dx: number, dy: number, energy: number, spawnTime: number, bouncesLeft: number): PulseRay {
  const hit = castPulseRay(ox, oy, dx, dy)

  const ray: PulseRay = {
    originX: ox,
    originY: oy,
    dirX: dx,
    dirY: dy,
    energy,
    travelDist: 0,
    maxDist: hit.dist,
    hitX: hit.hitX,
    hitY: hit.hitY,
    alive: true,
    spawnTime,
    bounceChildren: [],
  }

  // Pre-compute bounce children (they'll activate when parent hits wall)
  if (bouncesLeft > 0 && energy * PULSE_ENERGY_DECAY > 0.05 && (hit.normalX !== 0 || hit.normalY !== 0)) {
    // Reflect direction
    const dot = dx * hit.normalX + dy * hit.normalY
    const rdx = dx - 2 * dot * hit.normalX
    const rdy = dy - 2 * dot * hit.normalY

    // Nudge origin slightly off wall
    const bounceOx = hit.hitX + hit.normalX * 0.1
    const bounceOy = hit.hitY + hit.normalY * 0.1

    const childRay = createPulseRay(
      bounceOx, bounceOy,
      rdx, rdy,
      energy * PULSE_ENERGY_DECAY,
      spawnTime + hit.dist / PULSE_SPEED,
      bouncesLeft - 1,
    )
    ray.bounceChildren.push(childRay)
  }

  return ray
}

function firePulse() {
  const dx = Math.cos(player.angle)
  const dy = Math.sin(player.angle)

  const rootRay = createPulseRay(player.x, player.y, dx, dy, 1.0, gameTime, MAX_BOUNCES)

  const pulse: Pulse = {
    impacts: [],
    rootRay,
    startTime: gameTime,
  }

  activePulses.push(pulse)
  if (activePulses.length > MAX_PULSES) {
    activePulses.shift()
  }

  const zone = getZone(Math.floor(player.x), Math.floor(player.y))
  document.getElementById('hud-scan')!.textContent = `PULSE FIRED\nZONE: ${zone.name}`
}

function updatePulseRay(ray: PulseRay, pulse: Pulse) {
  if (!ray.alive) {
    // Still update children
    for (const child of ray.bounceChildren) {
      updatePulseRay(child, pulse)
    }
    return
  }

  const elapsed = gameTime - ray.spawnTime
  ray.travelDist = elapsed * PULSE_SPEED

  if (ray.travelDist >= ray.maxDist) {
    // Ray has hit the wall — record impact and deactivate
    ray.alive = false
    ray.travelDist = ray.maxDist

    pulse.impacts.push({
      x: ray.hitX,
      y: ray.hitY,
      energy: ray.energy,
      time: gameTime,
    })

    // Activate children
    for (const child of ray.bounceChildren) {
      child.spawnTime = gameTime
    }
  }
}

function updatePulses() {
  for (const pulse of activePulses) {
    updatePulseRay(pulse.rootRay, pulse)
  }

  // Prune old pulses
  activePulses = activePulses.filter(p => {
    const age = gameTime - p.startTime
    return age < SPLASH_FADE_TIME + 3.0
  })
}

// Compute COMBINED light intensity: flashlight cone + pulse bounces
function getLightIntensity(wx: number, wy: number): number {
  // Baseline: always-on flashlight cone
  let total = getConeLightAlpha(wx, wy)

  // Layer pulse-bounce energy on top
  for (const pulse of activePulses) {
    // Add energy from each impact splash
    for (const impact of pulse.impacts) {
      const age = gameTime - impact.time
      if (age < 0 || age > SPLASH_FADE_TIME) continue

      const dist = Math.hypot(wx - impact.x, wy - impact.y)
      if (dist > SPLASH_RADIUS) continue

      if (!hasLineOfSight(impact.x, impact.y, wx, wy)) continue

      const distFade = 1 - dist / SPLASH_RADIUS
      const timeFade = 1 - age / SPLASH_FADE_TIME
      const timeCurve = age < 0.15 ? age / 0.15 : timeFade

      total += impact.energy * distFade * distFade * timeCurve * 0.85
    }

    // Add energy from traveling ray beam
    total += addRayBeamLight(pulse.rootRay, wx, wy)
  }

  return Math.min(1, total)
}

function addRayBeamLight(ray: PulseRay, wx: number, wy: number): number {
  let contribution = 0

  if (ray.travelDist > 0) {
    // Point-to-line distance from (wx, wy) to the ray segment
    const segLen = Math.min(ray.travelDist, ray.maxDist)
    if (segLen > 0.1) {
      const ex = ray.originX + ray.dirX * segLen
      const ey = ray.originY + ray.dirY * segLen

      // Project point onto segment
      const dx = ex - ray.originX
      const dy = ey - ray.originY
      const px = wx - ray.originX
      const py = wy - ray.originY
      let t = (px * dx + py * dy) / (dx * dx + dy * dy)
      t = Math.max(0, Math.min(1, t))

      const nearX = ray.originX + dx * t
      const nearY = ray.originY + dy * t
      const perpDist = Math.hypot(wx - nearX, wy - nearY)

      if (perpDist < 1.5) {
        const beamFade = 1 - perpDist / 1.5
        // Fade based on how recently the beam front passed
        const distAlongRay = t * segLen
        const headDist = ray.travelDist - distAlongRay
        const headFade = headDist < 2 ? Math.max(0, 1 - headDist / 2) : 0
        contribution = ray.energy * beamFade * headFade * 0.6
      }
    }
  }

  // Recurse into children
  for (const child of ray.bounceChildren) {
    contribution += addRayBeamLight(child, wx, wy)
  }

  return contribution
}

function hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)
  if (dist < 0.1) return true

  const steps = Math.ceil(dist / 0.2)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const cx = x1 + dx * t
    const cy = y1 + dy * t
    if (isSolid(cx, cy)) return false
  }
  return true
}

// ── CANVAS SETUP ─────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement
const minimapCtx = minimapCanvas.getContext('2d')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  minimapCanvas.width = 140
  minimapCanvas.height = 140
}

// ── INPUT ────────────────────────────────────────────────────────────────

let touchMoveId: number | null = null
let touchLookId: number | null = null
let touchMoveOriginX = 0
let touchMoveOriginY = 0
let touchLookLastX = 0
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

function bindInput() {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true
    // SPACEBAR fires pulse
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      firePulse()
    }
  })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })

  // Desktop mouse — click for pointer lock, NOT for scan
  canvas.addEventListener('click', () => {
    if (isMobile) return
    if (!isPointerLocked) {
      canvas.requestPointerLock()
    }
    // When locked, spacebar fires pulse (handled in keydown)
  })

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas
  })

  document.addEventListener('mousemove', (e) => {
    if (isPointerLocked) {
      player.angle += e.movementX * 0.003
    } else {
      mouseX = e.clientX
      mouseY = e.clientY
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      player.angle = Math.atan2(mouseY - cy, mouseX - cx)
    }
  })

  // Mobile touch controls
  if (isMobile) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.clientX < canvas.width / 2) {
          touchMoveId = touch.identifier
          touchMoveOriginX = touch.clientX
          touchMoveOriginY = touch.clientY
        } else {
          touchLookId = touch.identifier
          touchLookLastX = touch.clientX
        }
      }
    }, { passive: false })

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === touchMoveId) {
          const dx = (touch.clientX - touchMoveOriginX) / 60
          const dy = (touch.clientY - touchMoveOriginY) / 60
          keys['a'] = dx < -0.3
          keys['d'] = dx > 0.3
          keys['w'] = dy < -0.3
          keys['s'] = dy > 0.3
        } else if (touch.identifier === touchLookId) {
          const deltaX = touch.clientX - touchLookLastX
          player.angle += deltaX * 0.008
          touchLookLastX = touch.clientX
        }
      }
    }, { passive: false })

    canvas.addEventListener('touchend', (e) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === touchMoveId) {
          touchMoveId = null
          keys['w'] = false
          keys['a'] = false
          keys['s'] = false
          keys['d'] = false
        } else if (touch.identifier === touchLookId) {
          touchLookId = null
          // Quick tap on right side = fire pulse
          firePulse()
        }
      }
    })
  }
}

// ── GAME LOGIC ───────────────────────────────────────────────────────────

function updatePlayer() {
  let dx = 0
  let dy = 0
  if (keys['w']) { dy -= 1 }
  if (keys['s']) { dy += 1 }
  if (keys['a']) { dx -= 1 }
  if (keys['d']) { dx += 1 }

  if (dx === 0 && dy === 0) return

  const len = Math.sqrt(dx * dx + dy * dy)
  dx = (dx / len) * player.speed
  dy = (dy / len) * player.speed

  const newX = player.x + dx
  const newY = player.y + dy

  const mx = Math.floor(newX)
  const my = Math.floor(player.y)
  if (mx >= 0 && mx < MAP_W && my >= 0 && my < MAP_H && !MAP[my]![mx]!.solid) {
    player.x = newX
  }

  const mx2 = Math.floor(player.x)
  const my2 = Math.floor(newY)
  if (mx2 >= 0 && mx2 < MAP_W && my2 >= 0 && my2 < MAP_H && !MAP[my2]![mx2]!.solid) {
    player.y = newY
  }

  // Evidence collection
  for (const ev of EVIDENCE_POSITIONS) {
    if (ev.collected) continue
    const d = Math.hypot(player.x - ev.x, player.y - ev.y)
    if (d < 0.6) {
      ev.collected = true
      const hudScan = document.getElementById('hud-scan')!
      hudScan.textContent = `COLLECTED: ${ev.key}\n${EVIDENCE_LORE[ev.key] || ''}`
    }
  }
}

// ── RENDERING ────────────────────────────────────────────────────────────

function render(time: number) {
  gameTime = time / 1000
  const w = canvas.width
  const h = canvas.height

  // Update pulse physics
  updatePulses()

  // Clear
  ctx.fillStyle = '#030302'
  ctx.fillRect(0, 0, w, h)

  // Camera offset (center player)
  const offX = w / 2 - player.x * TILE
  const offY = h / 2 - player.y * TILE

  // Draw walls (dim)
  ctx.fillStyle = 'rgba(255, 140, 0, 0.04)'
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (MAP[y]![x]!.solid) {
        ctx.fillRect(x * TILE + offX, y * TILE + offY, TILE, TILE)
      }
    }
  }

  // ── Draw the flashlight cone fill (always on) ──
  const visPoly = computeVisibilityPolygon()
  ctx.beginPath()
  ctx.moveTo(player.x * TILE + offX, player.y * TILE + offY)
  for (const vp of visPoly) {
    ctx.lineTo(vp.x * TILE + offX, vp.y * TILE + offY)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 140, 0, 0.02)'
  ctx.fill()

  // Draw pulse ray beams
  drawPulseRays(offX, offY)

  // Draw impact splashes (radial glow)
  drawImpactSplashes(offX, offY)

  // ── THE PRETEXT MAGIC: Text illuminated by cone + pulse ──
  renderTextByPulseLight(offX, offY, w, h)

  // Draw evidence markers (visible when lit by cone OR pulse)
  for (const ev of EVIDENCE_POSITIONS) {
    if (ev.collected) continue
    const ex = ev.x * TILE + offX
    const ey = ev.y * TILE + offY

    const light = getLightIntensity(ev.x, ev.y)
    if (light < 0.03) continue

    const pulseBeat = Math.sin(gameTime * 3) * 0.3 + 0.7
    ctx.globalAlpha = pulseBeat * Math.min(1, light * 1.5)
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 20px "JetBrains Mono"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('◆', ex, ey)
    ctx.globalAlpha = 1
  }

  // Player dot
  const px = player.x * TILE + offX
  const py = player.y * TILE + offY
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fill()

  // Aiming line (dim pointer)
  ctx.strokeStyle = 'rgba(255,140,0,0.35)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px + Math.cos(player.angle) * 40, py + Math.sin(player.angle) * 40)
  ctx.stroke()
  ctx.setLineDash([])

  // Update HUD
  const zone = getZone(Math.floor(player.x), Math.floor(player.y))
  document.getElementById('hud-zone')!.textContent = zone.name
  document.getElementById('hud-zone')!.style.color = zone.color
  document.getElementById('hud-pos')!.textContent =
    `${(player.x - MAP_W / 2).toFixed(1)}, ${(player.y - MAP_H / 2).toFixed(1)}`

  // Minimap
  renderMinimap()
}

function drawRaySegment(ray: PulseRay, offX: number, offY: number) {
  if (ray.travelDist <= 0) return

  const segLen = Math.min(ray.travelDist, ray.maxDist)
  const sx = ray.originX * TILE + offX
  const sy = ray.originY * TILE + offY
  const ex = (ray.originX + ray.dirX * segLen) * TILE + offX
  const ey = (ray.originY + ray.dirY * segLen) * TILE + offY

  // Bright leading edge
  const headX = (ray.originX + ray.dirX * ray.travelDist) * TILE + offX
  const headY = (ray.originY + ray.dirY * ray.travelDist) * TILE + offY

  // Trail
  ctx.strokeStyle = `rgba(255,140,0,${ray.energy * 0.4})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()

  // Bright head dot (only if still traveling)
  if (ray.alive) {
    ctx.fillStyle = `rgba(255,220,100,${ray.energy * 0.9})`
    ctx.beginPath()
    ctx.arc(headX, headY, 3, 0, Math.PI * 2)
    ctx.fill()

    // Glow around head
    const grad = ctx.createRadialGradient(headX, headY, 0, headX, headY, 15)
    grad.addColorStop(0, `rgba(255,200,60,${ray.energy * 0.3})`)
    grad.addColorStop(1, 'rgba(255,200,60,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(headX, headY, 15, 0, Math.PI * 2)
    ctx.fill()
  }

  // Recurse into children
  for (const child of ray.bounceChildren) {
    drawRaySegment(child, offX, offY)
  }
}

function drawPulseRays(offX: number, offY: number) {
  for (const pulse of activePulses) {
    drawRaySegment(pulse.rootRay, offX, offY)
  }
}

function drawImpactSplashes(offX: number, offY: number) {
  for (const pulse of activePulses) {
    for (const impact of pulse.impacts) {
      const age = gameTime - impact.time
      if (age < 0 || age > SPLASH_FADE_TIME) continue

      const timeFade = age < 0.15 ? age / 0.15 : 1 - age / SPLASH_FADE_TIME
      const pixR = SPLASH_RADIUS * TILE * timeFade
      const ix = impact.x * TILE + offX
      const iy = impact.y * TILE + offY

      // Radial glow
      const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, pixR)
      grad.addColorStop(0, `rgba(255,180,60,${impact.energy * timeFade * 0.15})`)
      grad.addColorStop(0.4, `rgba(255,140,0,${impact.energy * timeFade * 0.06})`)
      grad.addColorStop(1, 'rgba(255,140,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(ix, iy, pixR, 0, Math.PI * 2)
      ctx.fill()

      // Impact flash (first 0.1s)
      if (age < 0.12) {
        const flashAlpha = (1 - age / 0.12) * impact.energy * 0.6
        ctx.fillStyle = `rgba(255,255,200,${flashAlpha})`
        ctx.beginPath()
        ctx.arc(ix, iy, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function renderTextByPulseLight(
  offX: number,
  offY: number,
  canvasW: number,
  canvasH: number,
) {
  const lineHeight = 22
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }

  ctx.font = '500 17px "Cormorant Garamond", Georgia, serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  // Scan across visible tile rows
  // Convert canvas coords back to tile coords
  const startTileY = Math.max(0, Math.floor(-offY / TILE))
  const endTileY = Math.min(MAP_H, Math.ceil((canvasH - offY) / TILE))
  const startTileX = Math.max(0, Math.floor(-offX / TILE))
  const endTileX = Math.min(MAP_W, Math.ceil((canvasW - offX) / TILE))

  // For each scanline within visible tiles
  for (let tileY = startTileY; tileY < endTileY; tileY++) {
    for (let subRow = 0; subRow < TILE; subRow += lineHeight) {
      const pixY = tileY * TILE + subRow + offY
      if (pixY < 0 || pixY + lineHeight > canvasH) continue

      // Find horizontal spans of non-wall tiles at this row
      const worldY = tileY + (subRow + lineHeight / 2) / TILE
      let spanStart = -1

      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const isWall = tileX >= MAP_W || isSolid(tileX + 0.5, worldY)

        if (!isWall && spanStart < 0) {
          spanStart = tileX
        }

        if ((isWall || tileX === endTileX) && spanStart >= 0) {
          const spanEnd = tileX
          const spanLeftPx = spanStart * TILE + offX
          const spanRightPx = spanEnd * TILE + offX
          const spanWidth = spanRightPx - spanLeftPx

          if (spanWidth < 20) {
            spanStart = -1
            continue
          }

          // Sample light intensity at the midpoint of this span
          const midWorldX = (spanStart + spanEnd) / 2
          const midWorldY = worldY
          const alpha = getLightIntensity(midWorldX, midWorldY)

          if (alpha < 0.04) {
            spanStart = -1
            continue
          }

          // Layout text into this span
          let line = layoutNextLine(preparedLore, cursor, spanWidth)
          if (line === null) {
            cursor = { segmentIndex: 0, graphemeIndex: 0 }
            line = layoutNextLine(preparedLore, cursor, spanWidth)
            if (line === null) {
              spanStart = -1
              continue
            }
          }
          cursor = line.end

          // Zone color
          const zone = getZone(Math.floor(midWorldX), Math.floor(midWorldY))

          ctx.globalAlpha = alpha

          // Color based on intensity
          if (alpha > 0.6) {
            ctx.fillStyle = '#ffffff'
          } else if (alpha > 0.3) {
            ctx.fillStyle = '#f0e8d8'
          } else {
            ctx.fillStyle = zone.color
          }

          const textX = spanLeftPx + (spanWidth - line.width) / 2
          ctx.fillText(line.text, textX, pixY)

          // Subtle shadow
          if (alpha > 0.4) {
            ctx.globalAlpha = alpha * 0.15
            ctx.fillStyle = zone.color
            ctx.fillText(line.text, textX + 1, pixY + 1)
          }

          spanStart = -1
        }
      }
    }
  }

  ctx.globalAlpha = 1
}

function renderMinimap() {
  const mw = 140
  const mh = 140
  const scale = mw / MAP_W

  minimapCtx.fillStyle = '#0a0906'
  minimapCtx.fillRect(0, 0, mw, mh)

  // Walls
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (MAP[y]![x]!.solid) {
        minimapCtx.fillStyle = 'rgba(255,140,0,0.3)'
        minimapCtx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
  }

  // Evidence
  for (const ev of EVIDENCE_POSITIONS) {
    if (ev.collected) continue
    minimapCtx.fillStyle = '#ffd700'
    minimapCtx.fillRect(ev.x * scale - 2, ev.y * scale - 2, 4, 4)
  }

  // Light from impacts on minimap
  for (const pulse of activePulses) {
    for (const impact of pulse.impacts) {
      const age = gameTime - impact.time
      if (age < 0 || age > SPLASH_FADE_TIME) continue
      const fade = 1 - age / SPLASH_FADE_TIME
      minimapCtx.fillStyle = `rgba(255,180,60,${fade * impact.energy * 0.4})`
      minimapCtx.beginPath()
      minimapCtx.arc(impact.x * scale, impact.y * scale, SPLASH_RADIUS * scale * fade, 0, Math.PI * 2)
      minimapCtx.fill()
    }
  }

  // Player
  minimapCtx.fillStyle = '#fff'
  minimapCtx.beginPath()
  minimapCtx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2)
  minimapCtx.fill()

  // Direction
  minimapCtx.strokeStyle = '#ff8c00'
  minimapCtx.lineWidth = 1
  minimapCtx.beginPath()
  minimapCtx.moveTo(player.x * scale, player.y * scale)
  minimapCtx.lineTo(
    player.x * scale + Math.cos(player.angle) * 12,
    player.y * scale + Math.sin(player.angle) * 12,
  )
  minimapCtx.stroke()
}

// ── GAME LOOP ────────────────────────────────────────────────────────────

let running = false

function loop(time: number) {
  if (!running) return
  updatePlayer()
  render(time)
  requestAnimationFrame(loop)
}

// ── BOOT ─────────────────────────────────────────────────────────────────

function boot() {
  resize()
  window.addEventListener('resize', resize)
  bindInput()
  prepareLore()

  const hint = document.getElementById('controls-hint')
  if (hint) {
    if (isMobile) {
      hint.textContent = 'LEFT: MOVE  ·  RIGHT: AIM  ·  TAP RIGHT: PULSE'
    } else {
      hint.textContent = 'WASD: MOVE  ·  MOUSE: AIM  ·  SPACE: FIRE PULSE'
    }
  }

  document.getElementById('boot-btn')!.addEventListener('click', () => {
    document.getElementById('boot-screen')!.style.display = 'none'
    running = true
    requestAnimationFrame(loop)

    setTimeout(() => {
      if (hint) hint.style.opacity = '0'
    }, 8000)
  })
}

boot()
