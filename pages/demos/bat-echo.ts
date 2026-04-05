// BAT ECHO — Pretext Echolocation Typography
//
// Architecture:
//   1. Procedural cave maze (tile-based, ~30x20 rooms)
//   2. The 12 lines of Wilbur's "Mind" poem are placed as INDIVIDUAL
//      fragments at specific locations in the maze
//   3. Player moves with WASD, aims with mouse
//   4. HOLD CLICK: continuous echolocation cone (text visible in cone)
//   5. SPACE: single pulse that bounces off walls, revealing text
//   6. A fragment is "found" when you illuminate it — it appears in
//      the HUD log and stays dimly visible
//   7. Pretext's layoutNextLine() flows each fragment into the exact
//      illuminated width at that position
//
// The bat metaphor: you are the bat. You echolocate. You find the poem
// about yourself, scattered in the dark. A graceful error may correct the cave.

import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ── THE POEM (each line is a separate discovery) ────────────────────────

const POEM_LINES = [
  'Mind in its purest play is like some bat',
  'That beats about in caverns all alone,',
  'Contriving by a kind of senseless wit',
  'Not to conclude against a wall of stone.',
  'It has no need to falter or explore;',
  'Darkly it knows what obstacles are there,',
  'And so may weave and flitter, dip and soar',
  'In perfect courses through the blackest air.',
  'And has this simile a like perfection?',
  'The mind is like a bat. Precisely. Save',
  'That in the very happiest intellection',
  'A graceful error may correct the cave.',
]

// ── MAP ─────────────────────────────────────────────────────────────────

// Larger maze with rooms and corridors
const MAP_W = 32
const MAP_H = 24
const TILE = 36

// Generate the maze procedurally
const MAP: boolean[][] = [] // true = wall

function generateMaze() {
  // Start with everything as walls
  for (let y = 0; y < MAP_H; y++) {
    MAP[y] = []
    for (let x = 0; x < MAP_W; x++) {
      MAP[y]![x] = true
    }
  }

  // Carve rooms (rectangular chambers)
  const rooms: { x: number; y: number; w: number; h: number }[] = []
  const NUM_ROOMS = 14

  for (let attempt = 0; attempt < 200 && rooms.length < NUM_ROOMS; attempt++) {
    const rw = 3 + Math.floor(Math.random() * 4)
    const rh = 2 + Math.floor(Math.random() * 3)
    const rx = 1 + Math.floor(Math.random() * (MAP_W - rw - 2))
    const ry = 1 + Math.floor(Math.random() * (MAP_H - rh - 2))

    // Check overlap
    let overlaps = false
    for (const r of rooms) {
      if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x &&
          ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
        overlaps = true
        break
      }
    }
    if (overlaps) continue

    // Carve room
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        MAP[y]![x] = false
      }
    }
    rooms.push({ x: rx, y: ry, w: rw, h: rh })
  }

  // Connect rooms with corridors (L-shaped tunnels)
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i]!
    const b = rooms[i + 1]!
    const ax = Math.floor(a.x + a.w / 2)
    const ay = Math.floor(a.y + a.h / 2)
    const bx = Math.floor(b.x + b.w / 2)
    const by = Math.floor(b.y + b.h / 2)

    // Horizontal then vertical
    let cx = ax
    while (cx !== bx) {
      if (ay >= 0 && ay < MAP_H && cx >= 0 && cx < MAP_W) MAP[ay]![cx] = false
      cx += cx < bx ? 1 : -1
    }
    let cy = ay
    while (cy !== by) {
      if (cy >= 0 && cy < MAP_H && bx >= 0 && bx < MAP_W) MAP[cy]![bx] = false
      cy += cy < by ? 1 : -1
    }
  }

  // Also connect first to last for a loop
  if (rooms.length >= 2) {
    const first = rooms[0]!
    const last = rooms[rooms.length - 1]!
    const ax = Math.floor(first.x + first.w / 2)
    const ay = Math.floor(first.y + first.h / 2)
    const bx = Math.floor(last.x + last.w / 2)
    const by = Math.floor(last.y + last.h / 2)

    let cy = ay
    while (cy !== by) {
      if (cy >= 0 && cy < MAP_H && ax >= 0 && ax < MAP_W) MAP[cy]![ax] = false
      cy += cy < by ? 1 : -1
    }
    let cx = ax
    while (cx !== bx) {
      if (by >= 0 && by < MAP_H && cx >= 0 && cx < MAP_W) MAP[by]![cx] = false
      cx += cx < bx ? 1 : -1
    }
  }

  return rooms
}

const rooms = generateMaze()

// ── POEM FRAGMENT PLACEMENT ─────────────────────────────────────────────

type PoemFragment = {
  line: string
  worldX: number  // tile center X
  worldY: number  // tile center Y
  prepared: PreparedTextWithSegments | null
  found: boolean
  revealAlpha: number  // persistent glow after found (0-1 animated)
}

const BODY_FONT = '400 18px "Cormorant Garamond", Georgia, serif'
const LINE_HEIGHT = 24
const fragments: PoemFragment[] = []

function placeFragments() {
  // Place each poem line in a different room
  // If more lines than rooms, place extras in corridors
  for (let i = 0; i < POEM_LINES.length; i++) {
    let wx: number, wy: number

    if (i < rooms.length) {
      // Place in room center
      const room = rooms[i]!
      wx = room.x + Math.floor(room.w / 2)
      wy = room.y + Math.floor(room.h / 2)
    } else {
      // Place in a random open tile
      let placed = false
      wx = MAP_W / 2
      wy = MAP_H / 2
      for (let attempt = 0; attempt < 500; attempt++) {
        const tx = 1 + Math.floor(Math.random() * (MAP_W - 2))
        const ty = 1 + Math.floor(Math.random() * (MAP_H - 2))
        if (!MAP[ty]![tx]) {
          wx = tx
          wy = ty
          placed = true
          break
        }
      }
      if (!placed) continue
    }

    fragments.push({
      line: POEM_LINES[i]!,
      worldX: wx,
      worldY: wy,
      prepared: null,
      found: false,
      revealAlpha: 0,
    })
  }
}

function prepareFragments() {
  for (const f of fragments) {
    f.prepared = prepareWithSegments(f.line, BODY_FONT)
  }
}

// ── PLAYER ──────────────────────────────────────────────────────────────

const player = {
  x: 0,
  y: 0,
  angle: 0,
  speed: 0.055,
}

// Start player in first room
function placePlayer() {
  if (rooms.length > 0) {
    const r = rooms[0]!
    player.x = r.x + r.w / 2
    player.y = r.y + r.h / 2
  } else {
    player.x = MAP_W / 2
    player.y = MAP_H / 2
  }
}

const keys: Record<string, boolean> = {}
let mouseX = 0, mouseY = 0
let isPointerLocked = false
let isScanning = false  // mouse held down

// ── PULSE-BOUNCE ────────────────────────────────────────────────────────

const MAX_BOUNCES = 3
const PULSE_SPEED = 10
const SPLASH_RADIUS = 5
const SPLASH_FADE = 4.0
const MAX_PULSES = 6

type PulseImpact = { x: number; y: number; energy: number; time: number }

type PulseRay = {
  ox: number; oy: number; dx: number; dy: number
  energy: number; travelDist: number; maxDist: number
  hitX: number; hitY: number
  alive: boolean; spawnTime: number
  children: PulseRay[]
}

type Pulse = { impacts: PulseImpact[]; root: PulseRay; startTime: number }

let pulses: Pulse[] = []
let gameTime = 0

function isSolid(x: number, y: number): boolean {
  const mx = Math.floor(x), my = Math.floor(y)
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return true
  return MAP[my]![mx]!
}

function castPulse(ox: number, oy: number, dx: number, dy: number) {
  let t = 0
  const step = 0.02
  let lx = ox, ly = oy
  while (t < 20) {
    t += step
    const cx = ox + dx * t, cy = oy + dy * t
    if (isSolid(cx, cy)) {
      const htx = Math.floor(cx), hty = Math.floor(cy)
      const ltx = Math.floor(lx), lty = Math.floor(ly)
      let nx = 0, ny = 0
      if (htx !== ltx && hty !== lty) {
        if (Math.abs(dx) > Math.abs(dy)) nx = dx > 0 ? -1 : 1
        else ny = dy > 0 ? -1 : 1
      } else if (htx !== ltx) nx = dx > 0 ? -1 : 1
      else ny = dy > 0 ? -1 : 1
      return { hitX: lx, hitY: ly, dist: t - step, nx, ny }
    }
    lx = cx; ly = cy
  }
  return { hitX: ox + dx * 20, hitY: oy + dy * 20, dist: 20, nx: 0, ny: 0 }
}

function makeRay(ox: number, oy: number, dx: number, dy: number, energy: number, spawn: number, bounces: number): PulseRay {
  const h = castPulse(ox, oy, dx, dy)
  const ray: PulseRay = {
    ox, oy, dx, dy, energy,
    travelDist: 0, maxDist: h.dist,
    hitX: h.hitX, hitY: h.hitY,
    alive: true, spawnTime: spawn,
    children: [],
  }
  if (bounces > 0 && energy * 0.6 > 0.05 && (h.nx !== 0 || h.ny !== 0)) {
    const dot = dx * h.nx + dy * h.ny
    const rdx = dx - 2 * dot * h.nx
    const rdy = dy - 2 * dot * h.ny
    ray.children.push(makeRay(
      h.hitX + h.nx * 0.1, h.hitY + h.ny * 0.1,
      rdx, rdy, energy * 0.6,
      spawn + h.dist / PULSE_SPEED, bounces - 1,
    ))
  }
  return ray
}

function firePulse() {
  const dx = Math.cos(player.angle), dy = Math.sin(player.angle)
  const root = makeRay(player.x, player.y, dx, dy, 1.0, gameTime, MAX_BOUNCES)
  pulses.push({ impacts: [], root, startTime: gameTime })
  if (pulses.length > MAX_PULSES) pulses.shift()
  document.getElementById('hud-echo')!.textContent = 'PULSE SENT'
}

function updateRay(ray: PulseRay, pulse: Pulse) {
  if (!ray.alive) {
    for (const c of ray.children) updateRay(c, pulse)
    return
  }
  ray.travelDist = (gameTime - ray.spawnTime) * PULSE_SPEED
  if (ray.travelDist >= ray.maxDist) {
    ray.alive = false
    ray.travelDist = ray.maxDist
    pulse.impacts.push({ x: ray.hitX, y: ray.hitY, energy: ray.energy, time: gameTime })
    for (const c of ray.children) c.spawnTime = gameTime
  }
}

function updatePulses() {
  for (const p of pulses) updateRay(p.root, p)
  pulses = pulses.filter(p => gameTime - p.startTime < SPLASH_FADE + 2)
}

// ── LIGHT COMPUTATION ───────────────────────────────────────────────────

const CONE_RANGE = 6
const CONE_HALF = Math.PI / 5  // narrow cone

function hasLOS(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1, dy = y2 - y1
  const d = Math.hypot(dx, dy)
  if (d < 0.1) return true
  const steps = Math.ceil(d / 0.2)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (isSolid(x1 + dx * t, y1 + dy * t)) return false
  }
  return true
}

function getLightAt(wx: number, wy: number): number {
  let total = 0

  // Cone light (when scanning)
  if (isScanning) {
    const dx = wx - player.x, dy = wy - player.y
    const dist = Math.hypot(dx, dy)
    if (dist < CONE_RANGE) {
      const angle = Math.atan2(dy, dx)
      let diff = angle - player.angle
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      if (Math.abs(diff) < CONE_HALF && hasLOS(player.x, player.y, wx, wy)) {
        const prox = 1 - dist / CONE_RANGE
        const aDim = 1 - Math.abs(diff) / CONE_HALF
        total += prox * 0.65 * (0.4 + aDim * 0.6)
      }
    }
  }

  // Pulse splash light
  for (const p of pulses) {
    for (const imp of p.impacts) {
      const age = gameTime - imp.time
      if (age < 0 || age > SPLASH_FADE) continue
      const dist = Math.hypot(wx - imp.x, wy - imp.y)
      if (dist > SPLASH_RADIUS) continue
      if (!hasLOS(imp.x, imp.y, wx, wy)) continue
      const dFade = 1 - dist / SPLASH_RADIUS
      const tFade = age < 0.1 ? age / 0.1 : 1 - age / SPLASH_FADE
      total += imp.energy * dFade * dFade * tFade * 0.8
    }
  }

  // Tiny ambient near player
  const playerDist = Math.hypot(wx - player.x, wy - player.y)
  if (playerDist < 1.5) {
    total += (1 - playerDist / 1.5) * 0.08
  }

  return Math.min(1, total)
}

// ── CANVAS SETUP ────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

// ── INPUT ───────────────────────────────────────────────────────────────

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
let touchMoveId: number | null = null
let touchLookId: number | null = null
let touchMoveOX = 0, touchMoveOY = 0
let touchLookLastX = 0

function bindInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true
    if (e.code === 'Space') { e.preventDefault(); firePulse() }
  })
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false })

  canvas.addEventListener('mousedown', () => {
    if (isMobile) return
    if (!isPointerLocked) { canvas.requestPointerLock(); return }
    isScanning = true
  })
  canvas.addEventListener('mouseup', () => { isScanning = false })

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas
  })

  document.addEventListener('mousemove', (e) => {
    if (isPointerLocked) {
      player.angle += e.movementX * 0.003
    } else {
      mouseX = e.clientX; mouseY = e.clientY
      const cx = canvas.width / 2, cy = canvas.height / 2
      player.angle = Math.atan2(mouseY - cy, mouseX - cx)
    }
  })

  if (isMobile) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < canvas.width / 2) {
          touchMoveId = t.identifier
          touchMoveOX = t.clientX; touchMoveOY = t.clientY
        } else {
          touchLookId = t.identifier
          touchLookLastX = t.clientX
          isScanning = true
        }
      }
    }, { passive: false })

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchMoveId) {
          const dx = (t.clientX - touchMoveOX) / 60
          const dy = (t.clientY - touchMoveOY) / 60
          keys['a'] = dx < -0.3; keys['d'] = dx > 0.3
          keys['w'] = dy < -0.3; keys['s'] = dy > 0.3
        } else if (t.identifier === touchLookId) {
          player.angle += (t.clientX - touchLookLastX) * 0.008
          touchLookLastX = t.clientX
        }
      }
    }, { passive: false })

    canvas.addEventListener('touchend', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchMoveId) {
          touchMoveId = null
          keys['w'] = keys['a'] = keys['s'] = keys['d'] = false
        } else if (t.identifier === touchLookId) {
          touchLookId = null; isScanning = false
          firePulse()
        }
      }
    })
  }
}

// ── PLAYER UPDATE ───────────────────────────────────────────────────────

function updatePlayer() {
  let dx = 0, dy = 0
  if (keys['w']) dy -= 1
  if (keys['s']) dy += 1
  if (keys['a']) dx -= 1
  if (keys['d']) dx += 1
  if (dx === 0 && dy === 0) return
  const len = Math.hypot(dx, dy)
  dx = (dx / len) * player.speed
  dy = (dy / len) * player.speed

  const nx = player.x + dx, ny = player.y + dy
  if (!isSolid(nx, player.y)) player.x = nx
  if (!isSolid(player.x, ny)) player.y = ny
}

// ── FRAGMENT DISCOVERY ──────────────────────────────────────────────────

let foundCount = 0
const foundLog = document.getElementById('found-log')!
const foundCountEl = document.getElementById('found-count')!
const hudFragment = document.getElementById('hud-fragment')!
let logFadeTimer = 0

function checkDiscovery() {
  for (const f of fragments) {
    if (f.found) continue
    const light = getLightAt(f.worldX + 0.5, f.worldY + 0.5)
    if (light > 0.25) {
      f.found = true
      foundCount++
      foundCountEl.textContent = `${foundCount} / ${POEM_LINES.length}`
      hudFragment.textContent = f.line
      document.getElementById('hud-echo')!.textContent = 'FRAGMENT FOUND'

      // Show in center log
      foundLog.textContent = f.line
      foundLog.classList.add('visible')
      logFadeTimer = gameTime + 4

      // Check completion
      if (foundCount === POEM_LINES.length) {
        setTimeout(() => {
          foundLog.innerHTML = POEM_LINES.join('<br>')
          foundLog.classList.add('visible')
          document.getElementById('hud-echo')!.textContent = 'POEM COMPLETE'
        }, 2000)
      }
    }
  }

  // Fade log
  if (logFadeTimer > 0 && gameTime > logFadeTimer) {
    if (foundCount < POEM_LINES.length) {
      foundLog.classList.remove('visible')
    }
    logFadeTimer = 0
  }
}

// ── RENDERING ───────────────────────────────────────────────────────────

function render(time: number) {
  gameTime = time / 1000
  const w = canvas.width, h = canvas.height

  updatePlayer()
  updatePulses()
  checkDiscovery()

  ctx.fillStyle = '#030304'
  ctx.fillRect(0, 0, w, h)

  const offX = w / 2 - player.x * TILE
  const offY = h / 2 - player.y * TILE

  // Walls
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const px = x * TILE + offX, py = y * TILE + offY
      if (px + TILE < 0 || px > w || py + TILE < 0 || py > h) continue

      if (MAP[y]![x]) {
        // Wall — show dimly if lit
        const light = getLightAt(x + 0.5, y + 0.5)
        if (light > 0.02) {
          ctx.fillStyle = `rgba(0,255,204,${light * 0.12})`
          ctx.fillRect(px, py, TILE, TILE)
          // Edge highlight
          ctx.strokeStyle = `rgba(0,255,204,${light * 0.2})`
          ctx.lineWidth = 0.5
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1)
        }
      }
    }
  }

  // Draw pulse rays
  for (const p of pulses) {
    drawRay(p.root, offX, offY)
  }

  // Draw impact flashes
  for (const p of pulses) {
    for (const imp of p.impacts) {
      const age = gameTime - imp.time
      if (age < 0 || age > 0.3) continue
      const flash = (1 - age / 0.3) * imp.energy
      ctx.fillStyle = `rgba(0,255,204,${flash * 0.5})`
      ctx.beginPath()
      ctx.arc(imp.x * TILE + offX, imp.y * TILE + offY, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Scan cone visualization
  if (isScanning) {
    const px = player.x * TILE + offX
    const py = player.y * TILE + offY
    const r = CONE_RANGE * TILE
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.arc(px, py, r, player.angle - CONE_HALF, player.angle + CONE_HALF)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,255,204,0.015)'
    ctx.fill()
  }

  // ── POEM FRAGMENTS (the Pretext magic) ──
  renderFragments(offX, offY, w, h)

  // Player
  const px = player.x * TILE + offX
  const py = player.y * TILE + offY
  ctx.fillStyle = '#00ffcc'
  ctx.beginPath()
  ctx.arc(px, py, 3, 0, Math.PI * 2)
  ctx.fill()

  // Aim line
  ctx.strokeStyle = 'rgba(0,255,204,0.25)'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px + Math.cos(player.angle) * 30, py + Math.sin(player.angle) * 30)
  ctx.stroke()
  ctx.setLineDash([])

  // Pulse glow
  const glow = Math.sin(gameTime * 4) * 0.15 + 0.35
  ctx.strokeStyle = `rgba(0,255,204,${glow})`
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(px, py, 6, 0, Math.PI * 2)
  ctx.stroke()

  // HUD
  if (Math.floor(gameTime * 5) % 5 === 0) {
    document.getElementById('hud-pos')!.textContent =
      `${player.x.toFixed(1)}, ${player.y.toFixed(1)}`
  }

  requestAnimationFrame(render)
}

function drawRay(ray: PulseRay, offX: number, offY: number) {
  if (ray.travelDist <= 0) return
  const len = Math.min(ray.travelDist, ray.maxDist)
  const sx = ray.ox * TILE + offX, sy = ray.oy * TILE + offY
  const ex = (ray.ox + ray.dx * len) * TILE + offX
  const ey = (ray.oy + ray.dy * len) * TILE + offY

  ctx.strokeStyle = `rgba(0,255,204,${ray.energy * 0.35})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()

  if (ray.alive) {
    const hx = (ray.ox + ray.dx * ray.travelDist) * TILE + offX
    const hy = (ray.oy + ray.dy * ray.travelDist) * TILE + offY
    ctx.fillStyle = `rgba(0,255,204,${ray.energy * 0.8})`
    ctx.beginPath()
    ctx.arc(hx, hy, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const c of ray.children) drawRay(c, offX, offY)
}

function renderFragments(offX: number, offY: number, _cw: number, _ch: number) {
  ctx.font = BODY_FONT
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  for (const f of fragments) {
    if (!f.prepared) continue

    const fy = f.worldY * TILE + offY

    // Get light at this fragment's position
    const light = getLightAt(f.worldX + 0.5, f.worldY + 0.5)

    // If found, maintain a dim persistent glow
    let alpha = light
    if (f.found) {
      f.revealAlpha = Math.min(1, f.revealAlpha + 0.01)
      alpha = Math.max(alpha, f.revealAlpha * 0.15)
    }

    if (alpha < 0.03) continue

    // Compute available width (room width at this position)
    let spanLeft = f.worldX
    while (spanLeft > 0 && !MAP[f.worldY]![spanLeft - 1]) spanLeft--
    let spanRight = f.worldX
    while (spanRight < MAP_W - 1 && !MAP[f.worldY]![spanRight + 1]) spanRight++

    const availWidth = (spanRight - spanLeft + 1) * TILE - 12
    if (availWidth < 40) continue

    // ── THE PRETEXT CALL ──
    // Flow this single poem line into the available room width
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineY = fy

    while (true) {
      const line = layoutNextLine(f.prepared, cursor, availWidth)
      if (line === null) break

      ctx.globalAlpha = alpha * 0.9
      // Color: bright when freshly found, warm bone when persistent
      if (f.found && f.revealAlpha > 0.5) {
        ctx.fillStyle = `rgba(232,220,200,${alpha})`
      } else if (light > 0.5) {
        ctx.fillStyle = '#ffffff'
      } else {
        ctx.fillStyle = `rgba(0,255,204,${0.6 + alpha * 0.4})`
      }

      // Center text in the room span
      const textLeft = spanLeft * TILE + offX + 6
      const textX = textLeft + (availWidth - line.width) / 2
      ctx.fillText(line.text, textX, lineY)

      cursor = line.end
      lineY += LINE_HEIGHT
    }
  }

  ctx.globalAlpha = 1
}

// ── BOOT ────────────────────────────────────────────────────────────────



function boot() {
  resize()
  window.addEventListener('resize', resize)
  placePlayer()
  placeFragments()
  prepareFragments()
  bindInput()

  const hint = document.getElementById('controls-hint')
  if (hint && isMobile) {
    hint.textContent = 'LEFT: MOVE · RIGHT: AIM + SCAN · TAP RIGHT: PULSE'
  }

  document.getElementById('boot-btn')!.addEventListener('click', () => {
    document.getElementById('boot-screen')!.style.display = 'none'
    requestAnimationFrame(render)

    setTimeout(() => {
      if (hint) hint.style.opacity = '0'
    }, 8000)
  })
}

boot()
