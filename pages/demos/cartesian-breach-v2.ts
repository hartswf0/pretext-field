// THE CARTESIAN BREACH V2 — Pretext Disciplinary Matrix Demo
//
// Architecture:
//   1. A 2x2 grid of "discipline containers" (Anthropology, Psychology, Neurology, Sociology)
//   2. Each container holds a different passage, laid out using pretext
//   3. A central cross-wall separates them: a vertical wall and a horizontal wall, 
//      each with their own integrity (0-1).
//   4. Breaching the vertical wall merges Left/Right columns into Top/Bottom rows.
//   5. Breaching the horizontal wall merges Top/Bottom rows into Left/Right columns.
//   6. Breaching both merges all four into a unified text field.

import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ── SOURCE TEXTS (Four disciplinary registers) ──────────────────────────

const ANTHROPOLOGY_TEXT =
  `Between them, anthropology and psychology have chosen two of the more improbable ` +
  `objects around which to try to build a positive science: Culture and Mind. Both are ` +
  `inheritances of defunct philosophies, both have checkered histories of ideological ` +
  `inflation and rhetorical abuse. They have been repeatedly condemned as mystical or ` +
  `metaphysical, repeatedly banished from the disciplined precincts of serious inquiry, ` +
  `repeatedly refused to go away. When they are coupled, the difficulties do not merely ` +
  `add, they explode. Such theorists take an essentially semiotic approach to emotions ` +
  `— one which sees them in terms of the signific instruments and constructional practices ` +
  `through which they are given shape, sense, and public currency.`

const PSYCHOLOGY_TEXT =
  `A seriously revised conception of the infant mind has emerged — not blooming, buzzing ` +
  `confusion, not ravenous fantasy whirling helplessly about in blind desire, not ` +
  `ingenerate algorithms churning out syntactic categories and ready-to-wear concepts, ` +
  `but meaning making, meaning seeking, meaning preserving, meaning using; in a word, ` +
  `world-constructing. Studies of autism as a failure on the part of a child to develop ` +
  `a workable theory of other minds, of reality-imagining through narrative and ` +
  `storytelling, of self-construction as a social enterprise — doing things with ` +
  `emotion words and personal meaning creation do not much look like separate registers.`

const NEUROLOGY_TEXT =
  `Between a literal lesion and a literary trope, there is a lot of room for a broken ` +
  `heart. Neurologists have long investigated the implications for mental functioning ` +
  `of lesions located in one or another region of the brain. The presenting condition ` +
  `— a certain affectlessness, shallowness, detachment, and indecision, an irregularity ` +
  `of aim, an inability to choose a course, foresee consequences, or learn from mistakes. ` +
  `This Gage matrix is fundamentally an affective disorder, an attenuation of emotional ` +
  `capacity that cripples at once judgment, will, and social sensitivity. Emotions and ` +
  `feelings are not intruders in the bastion of reason — they are enmeshed in its networks.`

const SOCIOLOGY_TEXT =
  `Society is not merely an aggregate of individual psychologies or neurological networks, ` +
  `but a structure of relations, institutions, and roles that precede the feeling subject. ` +
  `Social forces pattern the expression of grief, the management of anger, and the display ` +
  `of joy, enforcing norms through subtle choreographies of interaction. The self is socially ` +
  `negotiated; alienation, anomie, and structural violence leave physiological traces, but ` +
  `their origins reside in the architecture of inequality, the division of labor, and ` +
  `the symbolic power embedded within institutional matrices.`

// ── CANVAS SETUP ────────────────────────────────────────────────────────

const canvas = document.getElementById('breach-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const spikeCursor = document.getElementById('spike-cursor') as HTMLElement
const breachMeter = document.getElementById('breach-meter') as HTMLElement
const instructions = document.getElementById('instructions') as HTMLElement

let W = 0
let H = 0

function resize() {
  const dpr = window.devicePixelRatio || 1
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  computeLayout()
  if (!fontsLoaded) {
    prepareFonts()
    fontsLoaded = true
  }
  scheduleRender()
}

// ── FONTS & PREPARED TEXTS ──────────────────────────────────────────────

const BODY_FONT = '400 16px "Cormorant Garamond", Georgia, serif'
const LABEL_FONT = '300 11px "JetBrains Mono", monospace'
const LINE_HEIGHT = 24

let fontsLoaded = false
let prepA: PreparedTextWithSegments, prepP: PreparedTextWithSegments
let prepN: PreparedTextWithSegments, prepS: PreparedTextWithSegments

let prepTop: PreparedTextWithSegments    // A + P
let prepBot: PreparedTextWithSegments    // N + S
let prepLeft: PreparedTextWithSegments   // A + N
let prepRight: PreparedTextWithSegments  // P + S
let prepAll: PreparedTextWithSegments    // A + P + N + S

function prepareFonts() {
  prepA = prepareWithSegments(ANTHROPOLOGY_TEXT, BODY_FONT)
  prepP = prepareWithSegments(PSYCHOLOGY_TEXT, BODY_FONT)
  prepN = prepareWithSegments(NEUROLOGY_TEXT, BODY_FONT)
  prepS = prepareWithSegments(SOCIOLOGY_TEXT, BODY_FONT)

  prepTop = prepareWithSegments(ANTHROPOLOGY_TEXT + ' ' + PSYCHOLOGY_TEXT, BODY_FONT)
  prepBot = prepareWithSegments(NEUROLOGY_TEXT + ' ' + SOCIOLOGY_TEXT, BODY_FONT)
  
  prepLeft = prepareWithSegments(ANTHROPOLOGY_TEXT + ' ' + NEUROLOGY_TEXT, BODY_FONT)
  prepRight = prepareWithSegments(PSYCHOLOGY_TEXT + ' ' + SOCIOLOGY_TEXT, BODY_FONT)
  
  prepAll = prepareWithSegments(
    ANTHROPOLOGY_TEXT + ' ' + PSYCHOLOGY_TEXT + ' ' + NEUROLOGY_TEXT + ' ' + SOCIOLOGY_TEXT, BODY_FONT
  )
}

// ── LAYOUT GEOMETRY ─────────────────────────────────────────────────────

type ContainerRect = {
  x: number; y: number; w: number; h: number
  label: string
  color: string
}

let containers: [ContainerRect, ContainerRect, ContainerRect, ContainerRect] = [
  { x: 0, y: 0, w: 0, h: 0, label: 'ANTHROPOLOGY', color: '#6eb5ff' }, // TL
  { x: 0, y: 0, w: 0, h: 0, label: 'PSYCHOLOGY', color: '#e09050' },     // TR
  { x: 0, y: 0, w: 0, h: 0, label: 'NEUROLOGY', color: '#50c8a0' },      // BL
  { x: 0, y: 0, w: 0, h: 0, label: 'SOCIOLOGY', color: '#c850c8' },      // BR
]

// Wall integrity: 0 = fully breached, 1 = intact
let wallV = 1.0  // Vertical cross wall
let wallH = 1.0  // Horizontal cross wall

const WALL_THICKNESS = 4
const PADDING = 20
const TITLE_BAR_H = 56
const LABEL_H = 28

function computeLayout() {
  const margin = 24
  const gap = 12
  const usableW = W - margin * 2
  const usableH = H - TITLE_BAR_H - margin * 2

  // 2x2 Grid setup
  const colW = Math.floor((usableW - gap) / 2)
  const rowH = Math.floor((usableH - gap) / 2)

  // Top Left (Anthro)
  containers[0] = { ...containers[0], x: margin, y: TITLE_BAR_H + margin, w: colW, h: rowH }
  // Top Right (Psych)
  containers[1] = { ...containers[1], x: margin + colW + gap, y: TITLE_BAR_H + margin, w: usableW - colW - gap, h: rowH }
  // Bottom Left (Neuro)
  containers[2] = { ...containers[2], x: margin, y: TITLE_BAR_H + margin + rowH + gap, w: colW, h: usableH - rowH - gap }
  // Bottom Right (Socio)
  containers[3] = { ...containers[3], x: margin + colW + gap, y: TITLE_BAR_H + margin + rowH + gap, w: usableW - colW - gap, h: usableH - rowH - gap }
}

// ── SPIKE INTERACTION ───────────────────────────────────────────────────

let isDragging = false
let breachTrail: { x: number; y: number; age: number }[] = []

function updateSpike(x: number, y: number) {
  spikeCursor.style.left = `${x}px`
  spikeCursor.style.top = `${y}px`

  if (isDragging) {
    breachTrail.push({ x, y, age: 0 })
    if (breachTrail.length > 80) breachTrail.shift()
    erodeWalls(x, y)
  }
  scheduleRender()
}

function erodeWalls(x: number, y: number) {
  const margin = 24
  const colW = Math.floor((W - margin * 2 - 12) / 2)
  const rowH = Math.floor((H - TITLE_BAR_H - margin * 2 - 12) / 2)

  const wallVx = margin + colW + 6
  const wallHy = TITLE_BAR_H + margin + rowH + 6

  // Erode Vertical Wall
  if (Math.abs(x - wallVx) < 40 && y > TITLE_BAR_H && y < H) {
    const erosion = 0.02 * (1 - Math.abs(x - wallVx) / 40)
    wallV = Math.max(0, wallV - erosion)
  }

  // Erode Horizontal Wall
  if (Math.abs(y - wallHy) < 40 && x > margin && x < W - margin) {
    const erosion = 0.02 * (1 - Math.abs(y - wallHy) / 40)
    wallH = Math.max(0, wallH - erosion)
  }
}

// ── INPUT BINDING ───────────────────────────────────────────────────────

function bindInput() {
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true
    updateSpike(e.clientX, e.clientY)
    instructions.style.opacity = '0'
  })
  canvas.addEventListener('mousemove', (e) => {
    updateSpike(e.clientX, e.clientY)
  })
  window.addEventListener('mouseup', () => { isDragging = false })
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    isDragging = true
    const t = e.touches[0]!
    updateSpike(t.clientX, t.clientY)
    instructions.style.opacity = '0'
  }, { passive: false })
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const t = e.touches[0]!
    updateSpike(t.clientX, t.clientY)
  }, { passive: false })
  window.addEventListener('touchend', () => { isDragging = false })
}

// ── RENDERING ───────────────────────────────────────────────────────────

let rafScheduled = false

function scheduleRender() {
  if (rafScheduled) return
  rafScheduled = true
  requestAnimationFrame(render)
}

function layoutTextInRect(
  prepared: PreparedTextWithSegments,
  rect: { x: number; y: number; w: number; h: number },
  color: string,
  alpha: number,
) {
  const padX = PADDING
  const textY0 = rect.y + LABEL_H + 8
  const maxW = rect.w - padX * 2
  if (maxW < 30) return

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = textY0
  const maxY = rect.y + rect.h - 8

  ctx.font = BODY_FONT
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  ctx.globalAlpha = alpha

  while (y + LINE_HEIGHT <= maxY) {
    const line = layoutNextLine(prepared, cursor, maxW)
    if (line === null) break
    ctx.fillText(line.text, rect.x + padX, y)
    cursor = line.end
    y += LINE_HEIGHT
  }
  ctx.globalAlpha = 1
}

function lerpColor(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16)
  const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ra + (rb - ra) * t)
  const g = Math.round(ga + (gb - ga) * t)
  const bl = Math.round(ba + (bb - ba) * t)
  return `rgb(${r},${g},${bl})`
}

function drawRectArea(rect: {x:number, y:number, w:number, h:number}, label: string, color: string, prep: PreparedTextWithSegments) {
  ctx.fillStyle = `rgba(42,37,32,0.35)`
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.5
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.globalAlpha = 1

  ctx.font = LABEL_FONT
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(label, rect.x + PADDING, rect.y + 10)

  layoutTextInRect(prep, rect, color, 0.9)
}

function render() {
  rafScheduled = false

  // Clear
  ctx.fillStyle = '#0c0a08'
  ctx.fillRect(0, 0, W, H)

  // Determine merge states
  const vMerged = wallV < 0.5
  const hMerged = wallH < 0.5
  
  if (vMerged && hMerged) {
    // All merged
    const rc = {
      x: containers[0].x, y: containers[0].y,
      w: (containers[1].x + containers[1].w) - containers[0].x,
      h: (containers[2].y + containers[2].h) - containers[0].y
    }
    const mix = lerpColor(containers[0].color, containers[3].color, 0.5)
    drawRectArea(rc, 'CULTURE · MIND · BRAIN · SOCIETY', mix, prepAll)
  } else if (vMerged) {
    // Top merged, Bottom merged
    const top_rc = {
      x: containers[0].x, y: containers[0].y,
      w: (containers[1].x + containers[1].w) - containers[0].x,
      h: containers[0].h
    }
    drawRectArea(top_rc, 'ANTHROPOLOGY ↔ PSYCHOLOGY', lerpColor(containers[0].color, containers[1].color, 0.5), prepTop)
    
    const bot_rc = {
      x: containers[2].x, y: containers[2].y,
      w: (containers[3].x + containers[3].w) - containers[2].x,
      h: containers[2].h
    }
    drawRectArea(bot_rc, 'NEUROLOGY ↔ SOCIOLOGY', lerpColor(containers[2].color, containers[3].color, 0.5), prepBot)
    
  } else if (hMerged) {
    // Left merged, Right merged
    const left_rc = {
      x: containers[0].x, y: containers[0].y,
      w: containers[0].w,
      h: (containers[2].y + containers[2].h) - containers[0].y
    }
    drawRectArea(left_rc, 'ANTHROPOLOGY ↕ NEUROLOGY', lerpColor(containers[0].color, containers[2].color, 0.5), prepLeft)
    
    const right_rc = {
      x: containers[1].x, y: containers[1].y,
      w: containers[1].w,
      h: (containers[3].y + containers[3].h) - containers[1].y
    }
    drawRectArea(right_rc, 'PSYCHOLOGY ↕ SOCIOLOGY', lerpColor(containers[1].color, containers[3].color, 0.5), prepRight)
  } else {
    // All unmerged
    drawRectArea(containers[0], containers[0].label, containers[0].color, prepA)
    drawRectArea(containers[1], containers[1].label, containers[1].color, prepP)
    drawRectArea(containers[2], containers[2].label, containers[2].color, prepN)
    drawRectArea(containers[3], containers[3].label, containers[3].color, prepS)
  }

  // Draw breach trail
  for (let i = 0; i < breachTrail.length; i++) {
    const t = breachTrail[i]!
    t.age++
    const fade = Math.max(0, 1 - t.age / 120)
    if (fade <= 0) continue
    ctx.fillStyle = `rgba(255,68,68,${fade * 0.15})`
    ctx.beginPath()
    ctx.arc(t.x, t.y, 3 + (1 - fade) * 6, 0, Math.PI * 2)
    ctx.fill()
  }
  breachTrail = breachTrail.filter(t => t.age < 120)

  // Draw Cross Walls
  drawWall('V', wallV)
  drawWall('H', wallH)

  // Update breach meter
  const totalIntegrity = Math.round(((wallV + wallH) / 2) * 100)
  breachMeter.textContent = `GRID BOUNDARY INTEGRITY: ${totalIntegrity}%`
  if (totalIntegrity < 30) {
    breachMeter.style.color = '#ff4444'
  } else if (totalIntegrity < 70) {
    breachMeter.style.color = '#e8c547'
  } else {
    breachMeter.style.color = '#50c8a0'
  }
}

function drawWall(type: 'V' | 'H', integrity: number) {
  const margin = 24
  const gap = 12
  
  let wx: number, wy: number, ww: number, wh: number
  if (type === 'V') {
    wx = containers[0].x + containers[0].w + gap/2 - WALL_THICKNESS/2
    wy = TITLE_BAR_H + margin
    ww = WALL_THICKNESS
    wh = H - TITLE_BAR_H - margin * 2
  } else {
    wx = margin
    wy = containers[0].y + containers[0].h + gap/2 - WALL_THICKNESS/2
    ww = W - margin * 2
    wh = WALL_THICKNESS
  }

  if (integrity > 0.01) {
    const segments = Math.max(1, Math.round(10 * integrity))
    ctx.fillStyle = lerpColor('#ff4444', '#3d3830', integrity)
    ctx.globalAlpha = integrity

    if (type === 'V') {
      const segH = wh / segments
      for (let i = 0; i < segments; i++) {
        if (Math.random() > integrity + 0.3) continue
        const gapRandom = (1 - integrity) * Math.random() * segH * 0.4
        ctx.fillRect(wx, wy + i * segH + gapRandom, ww, segH - gapRandom * 2)
      }
    } else {
      const segW = ww / segments
      for (let i = 0; i < segments; i++) {
        if (Math.random() > integrity + 0.3) continue
        const gapRandom = (1 - integrity) * Math.random() * segW * 0.4
        ctx.fillRect(wx + i * segW + gapRandom, wy, segW - gapRandom * 2, wh)
      }
    }
    ctx.globalAlpha = 1
  }

  // Glow
  if (integrity < 0.8) {
    const glowAlpha = (1 - integrity) * 0.25
    const grad = type === 'V'
      ? ctx.createLinearGradient(wx - 30, 0, wx + ww + 30, 0)
      : ctx.createLinearGradient(0, wy - 30, 0, wy + wh + 30)
    grad.addColorStop(0, 'rgba(255,68,68,0)')
    grad.addColorStop(0.5, `rgba(255,68,68,${glowAlpha})`)
    grad.addColorStop(1, 'rgba(255,68,68,0)')
    ctx.fillStyle = grad

    if (type === 'V') {
      ctx.fillRect(wx - 30, wy, ww + 60, wh)
    } else {
      ctx.fillRect(wx, wy - 30, ww, wh + 60)
    }
  }
}

function boot() {
  resize()
  window.addEventListener('resize', resize)
  bindInput()

  function idlePulse() {
    if (wallV > 0 || wallH > 0) scheduleRender()
    requestAnimationFrame(idlePulse)
  }
  requestAnimationFrame(idlePulse)
}

boot()
