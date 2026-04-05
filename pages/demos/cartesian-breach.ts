// THE CARTESIAN BREACH — Pretext Disciplinary Matrix Demo
//
// Architecture:
//   1. Three "discipline containers" (Anthropology, Psychology, Neurology)
//      are drawn as bordered regions on a dark canvas
//   2. Each container holds a different passage from Geertz's essay,
//      laid out using pretext's walkLineRanges() into its bounding box
//   3. Walls between containers have "integrity" (0–1). At 1.0, text
//      stays strictly inside its box. As the user drags the Gage spike
//      across a wall, integrity drops toward 0.
//   4. When a wall's integrity falls below 1.0, the two containers on
//      either side MERGE — their texts concatenate and pretext reflows
//      the combined text across the merged region at 60 FPS
//   5. At 0% total integrity, all three containers merge into one
//      unified field — the Cartesian boundary is fully dissolved
//
// This demonstrates pretext's unique ability to instantly reflow text
// into arbitrary rectangular regions without DOM mutation.

import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ── GEERTZ SOURCE TEXTS (three disciplinary registers) ──────────────────

const ANTHROPOLOGY_TEXT =
  `Between them, anthropology and psychology have chosen two of the more improbable ` +
  `objects around which to try to build a positive science: Culture and Mind. Both are ` +
  `inheritances of defunct philosophies, both have checkered histories of ideological ` +
  `inflation and rhetorical abuse. They have been repeatedly condemned as mystical or ` +
  `metaphysical, repeatedly banished from the disciplined precincts of serious inquiry, ` +
  `repeatedly refused to go away. When they are coupled, the difficulties do not merely ` +
  `add, they explode. ` +
  `Such theorists take an essentially semiotic approach to emotions — one which sees ` +
  `them in terms of the signific instruments and constructional practices through which ` +
  `they are given shape, sense, and public currency. Words, images, gestures, body-marks, ` +
  `and terminologies, stories, rites, customs, harangues, melodies, and conversations, ` +
  `are not mere vehicles of feelings lodged elsewhere, so many reflections, symptoms, ` +
  `and transpirations. They are the locus and machinery of the thing itself. ` +
  `There are vocabulary of emotion studies, ethnomedical studies of indigenous concepts ` +
  `of disease, suffering, pain, cure, and well-being. There are ethnopsychological studies ` +
  `of the importance of different emotions in different societies. ` +
  `The m'enis-wrath of Achilles and the liget-rage of Rosaldo's Philippine headhunters ` +
  `draw their specific substance from distinctive contexts and distinctive forms of life.`

const PSYCHOLOGY_TEXT =
  `A seriously revised conception of the infant mind has emerged — not blooming, buzzing ` +
  `confusion, not ravenous fantasy whirling helplessly about in blind desire, not ` +
  `ingenerate algorithms churning out syntactic categories and ready-to-wear concepts, ` +
  `but meaning making, meaning seeking, meaning preserving, meaning using; in a word, ` +
  `world-constructing. Studies of the ability and inclination of children to build models ` +
  `of society, of others, of nature, of self, of thought as such, and of feeling, and to ` +
  `use them to come to terms with what is going on round and about have proliferated. ` +
  `Studies of autism as a failure on the part of a child to develop a workable theory ` +
  `of other minds, of reality-imagining through narrative and storytelling, of self-construction ` +
  `as a social enterprise — doing things with emotion words and personal meaning creation ` +
  `do not much look like separate registers. The development of the child's thinking ` +
  `depends on his mastery of the social means of thinking. The use of signs leads humans ` +
  `to a specific structure of behavior that breaks away from biological development and ` +
  `creates new forms of a culturally based psychological process. ` +
  `Between a literal lesion and a literary trope there is a lot of room for a broken heart.`

const NEUROLOGY_TEXT =
  `Between a literal lesion and a literary trope, there is a lot of room for a broken ` +
  `heart. Neurologists have long investigated the implications for mental functioning ` +
  `of lesions located in one or another region of the brain. But, until recently, the ` +
  `bulk of this work has had to do with cognitive processing in the narrower sense. ` +
  `Emotional alterations, perhaps because they are less definite in form and more ` +
  `difficult to measure, have been more phenomenologically reported than somatically unpacked. ` +
  `The presenting condition — a certain affectlessness, shallowness, detachment, and ` +
  `indecision, an irregularity of aim, an inability to choose a course, foresee consequences, ` +
  `or learn from mistakes. All this in the company of otherwise normal, even superior, ` +
  `motor, linguistic, perceptual, and intellectual abilities. ` +
  `This Gage matrix is fundamentally an affective disorder, an attenuation of emotional ` +
  `capacity that cripples at once judgment, will, and social sensitivity. The coldbloodedness ` +
  `of their reasoning prevents them from assigning different values to different options, ` +
  `and makes their decision-making landscape hopelessly flat. Emotions and feelings are ` +
  `not intruders in the bastion of reason — they are enmeshed in its networks for worse ` +
  `and for better. The passions can wreck our lives. But so, and as completely, can their ` +
  `loss or absence.`

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
  prepareFonts()
  scheduleRender()
}

// ── FONTS & PREPARED TEXTS ──────────────────────────────────────────────

const BODY_FONT = '400 16px "Cormorant Garamond", Georgia, serif'
const LABEL_FONT = '300 11px "JetBrains Mono", monospace'
const LINE_HEIGHT = 24

let prepAnthro: PreparedTextWithSegments
let prepPsych: PreparedTextWithSegments
let prepNeuro: PreparedTextWithSegments
let prepMergedAP: PreparedTextWithSegments   // Anthropology + Psychology merged
let prepMergedPN: PreparedTextWithSegments   // Psychology + Neurology merged
let prepMergedAll: PreparedTextWithSegments  // All three merged

function prepareFonts() {
  prepAnthro = prepareWithSegments(ANTHROPOLOGY_TEXT, BODY_FONT)
  prepPsych = prepareWithSegments(PSYCHOLOGY_TEXT, BODY_FONT)
  prepNeuro = prepareWithSegments(NEUROLOGY_TEXT, BODY_FONT)
  prepMergedAP = prepareWithSegments(
    ANTHROPOLOGY_TEXT + ' ' + PSYCHOLOGY_TEXT, BODY_FONT
  )
  prepMergedPN = prepareWithSegments(
    PSYCHOLOGY_TEXT + ' ' + NEUROLOGY_TEXT, BODY_FONT
  )
  prepMergedAll = prepareWithSegments(
    ANTHROPOLOGY_TEXT + ' ' + PSYCHOLOGY_TEXT + ' ' + NEUROLOGY_TEXT, BODY_FONT
  )
}

// ── LAYOUT GEOMETRY ─────────────────────────────────────────────────────

type ContainerRect = {
  x: number; y: number; w: number; h: number
  label: string
  color: string
  labelColor: string
}

let containers: [ContainerRect, ContainerRect, ContainerRect] = [
  { x: 0, y: 0, w: 0, h: 0, label: 'ANTHROPOLOGY', color: '#6eb5ff', labelColor: '#6eb5ff' },
  { x: 0, y: 0, w: 0, h: 0, label: 'PSYCHOLOGY', color: '#e09050', labelColor: '#e09050' },
  { x: 0, y: 0, w: 0, h: 0, label: 'NEUROLOGY', color: '#50c8a0', labelColor: '#50c8a0' },
]

// Wall integrity: 0 = fully breached, 1 = intact
let wallAP = 1.0  // wall between Anthropology & Psychology
let wallPN = 1.0  // wall between Psychology & Neurology

const WALL_THICKNESS = 3
const PADDING = 20
const TITLE_BAR_H = 56
const LABEL_H = 28

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

function computeLayout() {
  const margin = isMobile ? 12 : 24
  const gap = 10
  const usableH = H - TITLE_BAR_H - margin * 2
  const usableW = W - margin * 2

  if (W > 800) {
    // Desktop: three columns side by side
    const colW = Math.floor((usableW - gap * 2) / 3)
    containers[0] = {
      ...containers[0], x: margin, y: TITLE_BAR_H + margin,
      w: colW, h: usableH
    }
    containers[1] = {
      ...containers[1], x: margin + colW + gap, y: TITLE_BAR_H + margin,
      w: colW, h: usableH
    }
    containers[2] = {
      ...containers[2], x: margin + (colW + gap) * 2, y: TITLE_BAR_H + margin,
      w: usableW - (colW + gap) * 2, h: usableH
    }
  } else {
    // Mobile: three rows stacked
    const rowH = Math.floor((usableH - gap * 2) / 3)
    containers[0] = {
      ...containers[0], x: margin, y: TITLE_BAR_H + margin,
      w: usableW, h: rowH
    }
    containers[1] = {
      ...containers[1], x: margin, y: TITLE_BAR_H + margin + rowH + gap,
      w: usableW, h: rowH
    }
    containers[2] = {
      ...containers[2], x: margin, y: TITLE_BAR_H + margin + (rowH + gap) * 2,
      w: usableW, h: usableH - (rowH + gap) * 2
    }
  }
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
  const c0 = containers[0]
  const c1 = containers[1]


  if (W > 800) {
    // Desktop: vertical walls
    const wallAP_x = c0.x + c0.w
    const wallPN_x = c1.x + c1.w

    // Check if spike is near the AP wall
    if (Math.abs(x - wallAP_x) < 40 && y > c0.y && y < c0.y + c0.h) {
      const erosion = 0.015 * (1 - Math.abs(x - wallAP_x) / 40)
      wallAP = Math.max(0, wallAP - erosion)
    }

    // Check if spike is near the PN wall
    if (Math.abs(x - wallPN_x) < 40 && y > c1.y && y < c1.y + c1.h) {
      const erosion = 0.015 * (1 - Math.abs(x - wallPN_x) / 40)
      wallPN = Math.max(0, wallPN - erosion)
    }
  } else {
    // Mobile: horizontal walls
    const wallAP_y = c0.y + c0.h
    const wallPN_y = c1.y + c1.h

    if (Math.abs(y - wallAP_y) < 40 && x > c0.x && x < c0.x + c0.w) {
      const erosion = 0.015 * (1 - Math.abs(y - wallAP_y) / 40)
      wallAP = Math.max(0, wallAP - erosion)
    }

    if (Math.abs(y - wallPN_y) < 40 && x > c1.x && x < c1.x + c1.w) {
      const erosion = 0.015 * (1 - Math.abs(y - wallPN_y) / 40)
      wallPN = Math.max(0, wallPN - erosion)
    }
  }
}

// ── INPUT BINDING ───────────────────────────────────────────────────────

function bindInput() {
  // Mouse
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true
    updateSpike(e.clientX, e.clientY)
    instructions.style.opacity = '0'
  })
  canvas.addEventListener('mousemove', (e) => {
    updateSpike(e.clientX, e.clientY)
  })
  canvas.addEventListener('mouseup', () => { isDragging = false })
  canvas.addEventListener('mouseleave', () => { isDragging = false })

  // Touch
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
  canvas.addEventListener('touchend', () => { isDragging = false })
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
  // Simple hex interpolation
  const ra = parseInt(a.slice(1, 3), 16)
  const ga = parseInt(a.slice(3, 5), 16)
  const ba = parseInt(a.slice(5, 7), 16)
  const rb = parseInt(b.slice(1, 3), 16)
  const gb = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ra + (rb - ra) * t)
  const g = Math.round(ga + (gb - ga) * t)
  const bl = Math.round(ba + (bb - ba) * t)
  return `rgb(${r},${g},${bl})`
}

function render() {
  rafScheduled = false

  // Clear
  ctx.fillStyle = '#0c0a08'
  ctx.fillRect(0, 0, W, H)

  const c0 = containers[0]
  const c1 = containers[1]
  const c2 = containers[2]

  // Determine merge state
  const apMerged = wallAP < 0.5
  const pnMerged = wallPN < 0.5
  const allMerged = apMerged && pnMerged

  // ── Draw breach trail ──
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

  // ── Draw containers ──
  if (allMerged) {
    // All three merged into one unified field
    const mergedRect = {
      x: c0.x, y: c0.y,
      w: (c2.x + c2.w) - c0.x,
      h: Math.max(c0.h, c1.h, c2.h),
    }

    // Unified container
    ctx.fillStyle = 'rgba(42,37,32,0.4)'
    ctx.fillRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

    // Unified border with merged color
    ctx.strokeStyle = lerpColor('#e09050', '#f0e8d8', 0.5)
    ctx.lineWidth = 1
    ctx.strokeRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

    // Label
    ctx.font = LABEL_FONT
    ctx.fillStyle = '#f0e8d8'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText('CULTURE · MIND · BRAIN', mergedRect.x + PADDING, mergedRect.y + 10)

    // Flow all text into the unified region
    layoutTextInRect(prepMergedAll, mergedRect, '#f0e8d8', 0.9)

  } else {
    // Draw individual or partially merged containers

    if (apMerged) {
      // Anthropology + Psychology merged
      const mergedRect = {
        x: c0.x, y: c0.y,
        w: W > 800 ? (c1.x + c1.w) - c0.x : c0.w,
        h: W > 800 ? Math.max(c0.h, c1.h) : (c1.y + c1.h) - c0.y,
      }

      ctx.fillStyle = 'rgba(42,37,32,0.4)'
      ctx.fillRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

      const mergeColor = lerpColor('#6eb5ff', '#e09050', 0.5)
      ctx.strokeStyle = mergeColor
      ctx.lineWidth = 1
      ctx.strokeRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

      ctx.font = LABEL_FONT
      ctx.fillStyle = mergeColor
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText('ANTHROPOLOGY ↔ PSYCHOLOGY', mergedRect.x + PADDING, mergedRect.y + 10)

      layoutTextInRect(prepMergedAP, mergedRect, mergeColor, 0.9)

      // Neurology stays separate
      drawContainer(c2, 1)
      layoutTextInRect(prepNeuro, c2, c2.color, 0.85)

    } else if (pnMerged) {
      // Psychology + Neurology merged
      const mergedRect = {
        x: c1.x, y: c1.y,
        w: W > 800 ? (c2.x + c2.w) - c1.x : c1.w,
        h: W > 800 ? Math.max(c1.h, c2.h) : (c2.y + c2.h) - c1.y,
      }

      // Anthropology stays separate
      drawContainer(c0, 1)
      layoutTextInRect(prepAnthro, c0, c0.color, 0.85)

      ctx.fillStyle = 'rgba(42,37,32,0.4)'
      ctx.fillRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

      const mergeColor = lerpColor('#e09050', '#50c8a0', 0.5)
      ctx.strokeStyle = mergeColor
      ctx.lineWidth = 1
      ctx.strokeRect(mergedRect.x, mergedRect.y, mergedRect.w, mergedRect.h)

      ctx.font = LABEL_FONT
      ctx.fillStyle = mergeColor
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText('PSYCHOLOGY ↔ NEUROLOGY', mergedRect.x + PADDING, mergedRect.y + 10)

      layoutTextInRect(prepMergedPN, mergedRect, mergeColor, 0.9)

    } else {
      // All three separate — the default Cartesian state
      for (let i = 0; i < 3; i++) {
        const c = containers[i]!
        const prep = [prepAnthro, prepPsych, prepNeuro][i]!
        drawContainer(c, 1)
        layoutTextInRect(prep, c, c.color, 0.85)
      }
    }

    // Draw walls with integrity visualization
    drawWall('AP', wallAP)
    drawWall('PN', wallPN)
  }

  // Update breach meter
  const totalIntegrity = Math.round(((wallAP + wallPN) / 2) * 100)
  breachMeter.textContent = `BOUNDARY INTEGRITY: ${totalIntegrity}%`
  if (totalIntegrity < 30) {
    breachMeter.style.color = '#ff4444'
  } else if (totalIntegrity < 70) {
    breachMeter.style.color = '#e8c547'
  } else {
    breachMeter.style.color = '#50c8a0'
  }
}

function drawContainer(c: ContainerRect, opacity: number) {
  // Background
  ctx.fillStyle = `rgba(42,37,32,${0.3 * opacity})`
  ctx.fillRect(c.x, c.y, c.w, c.h)

  // Border
  ctx.strokeStyle = c.color
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4 * opacity
  ctx.strokeRect(c.x, c.y, c.w, c.h)
  ctx.globalAlpha = 1

  // Label
  ctx.font = LABEL_FONT
  ctx.fillStyle = c.labelColor
  ctx.globalAlpha = 0.6
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(c.label, c.x + PADDING, c.y + 10)
  ctx.globalAlpha = 1
}

function drawWall(which: 'AP' | 'PN', integrity: number) {
  const c0 = containers[0]
  const c1 = containers[1]

  let wx: number, wy: number, ww: number, wh: number

  if (W > 800) {
    // Vertical walls
    if (which === 'AP') {
      wx = c0.x + c0.w
      wy = c0.y
      ww = WALL_THICKNESS
      wh = c0.h
    } else {
      wx = c1.x + c1.w
      wy = c1.y
      ww = WALL_THICKNESS
      wh = c1.h
    }
  } else {
    // Horizontal walls
    if (which === 'AP') {
      wx = c0.x
      wy = c0.y + c0.h
      ww = c0.w
      wh = WALL_THICKNESS
    } else {
      wx = c1.x
      wy = c1.y + c1.h
      ww = c1.w
      wh = WALL_THICKNESS
    }
  }

  if (integrity > 0.01) {
    // Draw wall segments with gaps based on erosion
    const segments = Math.max(1, Math.round(8 * integrity))
    const isVertical = W > 800

    ctx.fillStyle = lerpColor('#ff4444', '#3d3830', integrity)
    ctx.globalAlpha = integrity

    if (isVertical) {
      const segH = wh / segments
      for (let i = 0; i < segments; i++) {
        // Skip random segments as integrity decreases
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

  // Draw breach glow when damaged
  if (integrity < 0.8) {
    const glowAlpha = (1 - integrity) * 0.25
    const grad = W > 800
      ? ctx.createLinearGradient(wx - 30, 0, wx + ww + 30, 0)
      : ctx.createLinearGradient(0, wy - 30, 0, wy + wh + 30)
    grad.addColorStop(0, 'rgba(255,68,68,0)')
    grad.addColorStop(0.5, `rgba(255,68,68,${glowAlpha})`)
    grad.addColorStop(1, 'rgba(255,68,68,0)')
    ctx.fillStyle = grad

    if (W > 800) {
      ctx.fillRect(wx - 30, wy, ww + 60, wh)
    } else {
      ctx.fillRect(wx, wy - 30, ww, wh + 60)
    }
  }
}

// ── BOOT ────────────────────────────────────────────────────────────────

function boot() {
  resize()
  window.addEventListener('resize', resize)
  bindInput()

  // Initial render
  scheduleRender()

  // Mobile instructions update
  if (isMobile) {
    instructions.textContent = 'DRAG YOUR FINGER ACROSS THE WALLS'
  }

  // Subtle idle animation — walls pulse faintly
  function idlePulse() {
    if (wallAP > 0 || wallPN > 0) {
      scheduleRender()
    }
    requestAnimationFrame(idlePulse)
  }
  requestAnimationFrame(idlePulse)
}

boot()
