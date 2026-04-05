// POWER OF A MOON — Pretext Lunar Narrative Engine
//
// Architecture:
//   1. A luminous moon dominates the center of a star-field canvas
//   2. Five narrative "epochs" from the epistemic log orbit as text streams:
//      Biodome, Anomaly, Independence, Fusion, Theia
//   3. Clicking cycles through moon phases (New → Waxing → Full → Waning → New)
//   4. Each phase illuminates a crescent/circle region on the moon's surface
//   5. Text from the active epoch flows INTO the illuminated crescent using
//      Pretext's layoutNextLine() — variable-width lines matching the arc
//   6. The remaining epochs orbit as dim floating text fragments
//   7. Mouse position shifts a subtle gravitational parallax on the star field
//
// This demonstrates Pretext flowing text into non-rectangular, arc-shaped
// regions in real-time — the layout engine computes line widths from the
// chord lengths of circular cross-sections.

import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ── NARRATIVE EPOCHS ────────────────────────────────────────────────────

const EPOCHS = [
  {
    key: 'biodome',
    label: 'LUNAR BIODOME',
    color: '#6eb5ff',
    text:
      `The Lunar Biodome Consortium — an international coalition of NASA, Roscosmos, ` +
      `CNSA, and ESA — installs self-sustaining ecosystems at the southern edge of ` +
      `Shackleton Crater, leveraging the established bases Jamestown and Zvezda for ` +
      `logistical support. Solar energy powers hydroponic systems and water recycling ` +
      `units. Advanced transparent aerogel maintains internal temperatures at ` +
      `approximately 24°C. A contained environment allows for the first successful ` +
      `cultivation of genetically modified crops designed to grow in low-gravity ` +
      `environments — lunar wheat and potatoes push through regolith in silence. ` +
      `The biodomes glow faintly on the crater rim, visible from orbit as pale blue ` +
      `jewels set into the grey desolation. Each dome is a closed loop: atmosphere ` +
      `recycled, water purified, waste composted back into substrate. The botanists ` +
      `speak of the plants as collaborators, not specimens.`,
  },
  {
    key: 'anomaly',
    label: 'ANOMALOUS STRUCTURE',
    color: '#3dffe8',
    text:
      `Near Malapert Massif, the Moon Geological Survey Team identifies an unknown ` +
      `metallic structure buried 15 meters beneath the surface using ground-penetrating ` +
      `radar. The structure is composed of a titanium-vanadium alloy not native to lunar ` +
      `geology, suggesting artificial origin. Initial analysis dates the structure to ` +
      `approximately 3 billion years ago, predating known intelligent life on Earth. ` +
      `The implications ripple outward like seismic waves through the scientific ` +
      `community. Who built this? What function did it serve? The alloy's crystalline ` +
      `structure suggests it was designed to withstand cosmic radiation for geological ` +
      `timescales. Some speculate it is a beacon; others, a tomb. The selenologists ` +
      `work in shifts, mapping its contours with millimeter precision, afraid to ` +
      `breach its surface before understanding what lies within.`,
  },
  {
    key: 'independence',
    label: 'LUNAR INDEPENDENCE',
    color: '#c850c8',
    text:
      `The Lunar Independence Collective gains influence from the Hilton Moon Hotel ` +
      `in Mare Tranquillitatis, a neutral meeting ground for negotiations between ` +
      `Moon-born citizens and long-term residents. Their charter emphasizes sustainable ` +
      `resource management and equal rights for all lunar inhabitants. The LIC secures ` +
      `backing from major Earth-based human rights NGOs and gains momentum by organizing ` +
      `peaceful demonstrations across lunar bases. For the first time in human history, ` +
      `a population born off-world demands sovereignty. Their bones are longer, their ` +
      `muscles differently calibrated. They have never felt rain. They propose a ` +
      `constitution drafted under Earth-light, ratified in the silence between ` +
      `communication windows, when the colonies are truly alone.`,
  },
  {
    key: 'fusion',
    label: 'HELIUM-3 FUSION',
    color: '#50c8a0',
    text:
      `At Clavius Base, the Helios Energy Corporation develops a compact fusion reactor ` +
      `capable of generating 500 megawatts of power using superconducting magnets and ` +
      `cryogenic cooling systems to maintain plasma stability. A pilot program provides ` +
      `sustainable fusion energy to both lunar and specific Earth markets, drastically ` +
      `reducing dependency on fossil fuels and reshaping global energy dynamics. The ` +
      `reactor hums at frequencies below human hearing, a vibration felt through the ` +
      `floor plates of the base. Helium-3, extracted from the regolith by automated ` +
      `harvesters, feeds the magnetic bottle. Clean, inexhaustible, transformative. ` +
      `Earth watches the power readings with a mixture of wonder and dread — the ` +
      `old energy empires begin their slow, inevitable dissolution.`,
  },
  {
    key: 'theia',
    label: 'THEIA RETURNS',
    color: '#ff6b3d',
    text:
      `In the Observatory of Celestial Mechanics, Dr. Eleanor Thorne adjusts the ` +
      `coordinates of the massive telescope by precisely 1.3 degrees to the east. ` +
      `As the lens aligns with the moon, an unexpected anomaly becomes apparent — ` +
      `a new satellite, a moonlet, has appeared 3,500 miles from the primary lunar ` +
      `body. Thea, the Greek Titan of sight and the sun, strides across the stony ` +
      `landscape of Mount Olympus as a portal shimmers into existence — glowing a ` +
      `deep azure, like the Aegean Sea at sunset. It is a tear in reality itself. ` +
      `Driven by curiosity, Thea steps through into the bustling world of 2123, ` +
      `her traditional garb morphing into sleek, contemporary attire. In an alternate ` +
      `timeline, Professor Nia Callahan discovers that the moon was not the result ` +
      `of a physical occurrence but of a lost technology from a pre-human civilization. ` +
      `Artifacts found deep within Earth's crust harness gravitational forces in ` +
      `ways not previously understood.`,
  },
]

// ── CANVAS SETUP ────────────────────────────────────────────────────────

const canvas = document.getElementById('moon-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const phaseLabel = document.getElementById('phase-label') as HTMLElement
const instructionsEl = document.getElementById('instructions') as HTMLElement
const epochIndicator = document.getElementById('epoch-indicator') as HTMLElement

let W = 0, H = 0, dpr = 1
let moonR = 0
let moonCx = 0, moonCy = 0

// ── STARS ───────────────────────────────────────────────────────────────

type Star = { x: number; y: number; r: number; brightness: number; twinklePhase: number }
let stars: Star[] = []

function generateStars() {
  stars = []
  const count = Math.floor((W * H) / 1800)
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      brightness: Math.random() * 0.6 + 0.2,
      twinklePhase: Math.random() * Math.PI * 2,
    })
  }
}

// ── MOON PHASE STATE ────────────────────────────────────────────────────

const PHASE_NAMES = ['NEW MOON', 'WAXING CRESCENT', 'FIRST QUARTER', 'WAXING GIBBOUS', 'FULL MOON', 'WANING GIBBOUS', 'LAST QUARTER', 'WANING CRESCENT']
let phaseIndex = 4 // start at full moon
let activeEpoch = 0

// ── MOUSE STATE ─────────────────────────────────────────────────────────

let mouseX = 0, mouseY = 0
let parallaxX = 0, parallaxY = 0

// ── PRETEXT PREPARED ────────────────────────────────────────────────────

const BODY_FONT = '400 17px "Crimson Pro", "Cormorant Garamond", Georgia, serif'
const SMALL_FONT = '300 13px "Crimson Pro", Georgia, serif'
const MONO_FONT = '300 10px "JetBrains Mono", monospace'
const LINE_HEIGHT = 24
const SMALL_LINE_HEIGHT = 19

let preparedEpochs: PreparedTextWithSegments[] = []
let preparedSmallEpochs: PreparedTextWithSegments[] = []

function prepareTexts() {
  preparedEpochs = EPOCHS.map(e => prepareWithSegments(e.text, BODY_FONT))
  preparedSmallEpochs = EPOCHS.map(e => prepareWithSegments(e.text, SMALL_FONT))
}

// ── RESIZE ──────────────────────────────────────────────────────────────

function resize() {
  dpr = window.devicePixelRatio || 1
  W = window.innerWidth
  H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  moonR = Math.min(W, H) * 0.22
  moonCx = W / 2
  moonCy = H / 2

  generateStars()
  if (preparedEpochs.length === 0) prepareTexts()
}

// ── DRAWING: MOON ───────────────────────────────────────────────────────

function getPhaseIllumination(phase: number): number {
  // 0 = new (0%), 4 = full (100%)
  return 1 - Math.abs(phase - 4) / 4
}

function drawMoon(time: number) {
  const illumination = getPhaseIllumination(phaseIndex)
  const isWaxing = phaseIndex <= 4

  // Outer glow
  const glowR = moonR * 1.6
  const grad = ctx.createRadialGradient(moonCx, moonCy, moonR * 0.8, moonCx, moonCy, glowR)
  grad.addColorStop(0, `rgba(255,238,187,${0.06 * illumination + 0.01})`)
  grad.addColorStop(0.5, `rgba(255,238,187,${0.02 * illumination})`)
  grad.addColorStop(1, 'rgba(255,238,187,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(moonCx, moonCy, glowR, 0, Math.PI * 2)
  ctx.fill()

  // Moon body
  ctx.save()
  ctx.beginPath()
  ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2)
  ctx.clip()

  // Base dark side
  ctx.fillStyle = '#1a1814'
  ctx.fillRect(moonCx - moonR, moonCy - moonR, moonR * 2, moonR * 2)

  // Illuminated side
  if (illumination > 0.01) {
    ctx.fillStyle = '#d8d4c8'

    if (illumination >= 0.99) {
      // Full moon
      ctx.beginPath()
      ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Crescent/quarter/gibbous
      ctx.beginPath()
      const terminatorX = moonR * (2 * illumination - 1)
      
      if (isWaxing) {
        // Illuminate the right side
        ctx.arc(moonCx, moonCy, moonR, -Math.PI / 2, Math.PI / 2, false)
        ctx.ellipse(moonCx, moonCy, Math.abs(terminatorX), moonR, 0, Math.PI / 2, -Math.PI / 2, terminatorX > 0)
      } else {
        // Illuminate the left side
        ctx.arc(moonCx, moonCy, moonR, Math.PI / 2, -Math.PI / 2, false)
        ctx.ellipse(moonCx, moonCy, Math.abs(terminatorX), moonR, 0, -Math.PI / 2, Math.PI / 2, terminatorX > 0)
      }
      ctx.fill()
    }
  }

  // Crater texture
  drawCraters(time)

  ctx.restore()

  // Rim highlight
  ctx.strokeStyle = `rgba(255,238,187,${0.15 + illumination * 0.15})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2)
  ctx.stroke()
}

function drawCraters(_time: number) {
  // Deterministic craters
  const craterSeeds = [
    { ox: -0.3, oy: -0.2, r: 0.15 },
    { ox: 0.2, oy: -0.35, r: 0.1 },
    { ox: -0.1, oy: 0.3, r: 0.12 },
    { ox: 0.35, oy: 0.1, r: 0.08 },
    { ox: -0.4, oy: 0.0, r: 0.06 },
    { ox: 0.1, oy: -0.1, r: 0.18 },
    { ox: -0.15, oy: -0.4, r: 0.07 },
    { ox: 0.3, oy: 0.35, r: 0.09 },
    { ox: -0.35, oy: 0.25, r: 0.05 },
    { ox: 0.0, oy: 0.15, r: 0.11 },
  ]

  for (const c of craterSeeds) {
    const cx = moonCx + c.ox * moonR
    const cy = moonCy + c.oy * moonR
    const cr = c.r * moonR

    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.fill()

    // Rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// ── DRAWING: TEXT IN MOON ───────────────────────────────────────────────

function layoutTextInMoon() {
  const illumination = getPhaseIllumination(phaseIndex)
  if (illumination < 0.05) return

  const epoch = EPOCHS[activeEpoch]!
  const prepared = preparedEpochs[activeEpoch]!
  const padding = 20

  // We scan horizontal lines through the moon circle
  // For each line, compute the chord width at that Y, then
  // mask to only the illuminated portion

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  const startY = moonCy - moonR + padding
  const endY = moonCy + moonR - padding
  let y = startY

  ctx.font = BODY_FONT
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  while (y + LINE_HEIGHT <= endY) {
    // Chord width at this Y
    const dy = y + LINE_HEIGHT / 2 - moonCy
    const halfChord = Math.sqrt(Math.max(0, moonR * moonR - dy * dy))
    
    if (halfChord < 20) {
      y += LINE_HEIGHT
      continue
    }

    // Full chord spans [moonCx - halfChord, moonCx + halfChord]
    // But we only want the illuminated portion
    let lineLeft = moonCx - halfChord + padding
    let lineRight = moonCx + halfChord - padding
    const isWaxing = phaseIndex <= 4

    if (illumination < 0.99) {
      // Compute terminator position at this Y
      const terminatorX = moonR * (2 * illumination - 1)
      // The ellipse at this Y: the terminator's X extent
      const ellipseHalf = Math.abs(terminatorX) * Math.sqrt(Math.max(0, 1 - (dy * dy) / (moonR * moonR)))
      
      if (isWaxing) {
        // Right side illuminated
        if (terminatorX >= 0) {
          lineLeft = Math.max(lineLeft, moonCx - ellipseHalf)
        } else {
          lineLeft = Math.max(lineLeft, moonCx + ellipseHalf)
        }
      } else {
        // Left side illuminated
        if (terminatorX >= 0) {
          lineRight = Math.min(lineRight, moonCx + ellipseHalf)
        } else {
          lineRight = Math.min(lineRight, moonCx - ellipseHalf)
        }
      }
    }

    const lineWidth = lineRight - lineLeft
    if (lineWidth < 30) {
      y += LINE_HEIGHT
      continue
    }

    const line = layoutNextLine(prepared, cursor, lineWidth)
    if (line === null) break

    // Compute alpha based on distance from center
    const distFromCenter = Math.abs(dy) / moonR
    const alpha = (1 - distFromCenter * 0.5) * 0.85

    ctx.globalAlpha = alpha
    ctx.fillStyle = epoch.color

    // Center text within the chord
    const textX = lineLeft + (lineWidth - line.width) / 2
    ctx.fillText(line.text, textX, y)

    cursor = line.end
    y += LINE_HEIGHT
  }

  ctx.globalAlpha = 1
}

// ── DRAWING: ORBITING FRAGMENTS ─────────────────────────────────────────

function drawOrbitingFragments(time: number) {
  const orbitR = moonR * 1.7
  
  for (let i = 0; i < EPOCHS.length; i++) {
    if (i === activeEpoch) continue

    const epoch = EPOCHS[i]!
    const prepared = preparedSmallEpochs[i]!
    const angle = (i / EPOCHS.length) * Math.PI * 2 + time * 0.08
    const ox = moonCx + Math.cos(angle) * orbitR
    const oy = moonCy + Math.sin(angle) * orbitR * 0.4 // elliptical

    // Small floating text box
    const boxW = Math.min(180, W * 0.18)
    const boxH = 100

    // Skip if off screen
    if (ox < -boxW || ox > W + boxW || oy < -boxH || oy > H + boxH) continue

    // Faint background
    ctx.fillStyle = `rgba(6,8,16,0.6)`
    ctx.fillRect(ox - boxW / 2, oy - boxH / 2, boxW, boxH)

    // Border
    ctx.strokeStyle = epoch.color
    ctx.globalAlpha = 0.2
    ctx.lineWidth = 0.5
    ctx.strokeRect(ox - boxW / 2, oy - boxH / 2, boxW, boxH)
    ctx.globalAlpha = 1

    // Label
    ctx.font = MONO_FONT
    ctx.fillStyle = epoch.color
    ctx.globalAlpha = 0.5
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(epoch.label, ox - boxW / 2 + 8, oy - boxH / 2 + 6)

    // Layout text into the small box
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    let ty = oy - boxH / 2 + 22
    const maxY = oy + boxH / 2 - 4
    const maxW = boxW - 16

    ctx.font = SMALL_FONT
    ctx.fillStyle = epoch.color
    ctx.globalAlpha = 0.3

    while (ty + SMALL_LINE_HEIGHT <= maxY) {
      const line = layoutNextLine(prepared, cursor, maxW)
      if (line === null) break
      ctx.fillText(line.text, ox - boxW / 2 + 8, ty)
      cursor = line.end
      ty += SMALL_LINE_HEIGHT
    }
    ctx.globalAlpha = 1
  }
}

// ── DRAWING: STARS ──────────────────────────────────────────────────────

function drawStars(time: number) {
  for (const s of stars) {
    const twinkle = Math.sin(time * 1.5 + s.twinklePhase) * 0.3 + 0.7
    const alpha = s.brightness * twinkle

    // Parallax
    const sx = s.x + parallaxX * s.r * 3
    const sy = s.y + parallaxY * s.r * 3

    // Don't draw stars behind the moon
    const dx = sx - moonCx
    const dy = sy - moonCy
    if (dx * dx + dy * dy < (moonR + 5) * (moonR + 5)) continue

    ctx.globalAlpha = alpha
    ctx.fillStyle = '#e8e4f0'
    ctx.beginPath()
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── MAIN RENDER ─────────────────────────────────────────────────────────

function render(timestamp: number) {
  const time = timestamp / 1000

  // Parallax from mouse
  const tx = (mouseX / W - 0.5) * 8
  const ty = (mouseY / H - 0.5) * 8
  parallaxX += (tx - parallaxX) * 0.05
  parallaxY += (ty - parallaxY) * 0.05

  // Clear
  ctx.fillStyle = '#060810'
  ctx.fillRect(0, 0, W, H)

  // Stars
  drawStars(time)

  // Orbiting text fragments
  drawOrbitingFragments(time)

  // Moon
  drawMoon(time)

  // Text inside moon
  layoutTextInMoon()

  // Active epoch label on moon
  const epoch = EPOCHS[activeEpoch]!
  ctx.font = MONO_FONT
  ctx.fillStyle = epoch.color
  ctx.globalAlpha = 0.6
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'center'
  ctx.fillText(epoch.label, moonCx, moonCy - moonR - 12)
  ctx.globalAlpha = 1

  requestAnimationFrame(render)
}

// ── INPUT ───────────────────────────────────────────────────────────────

function bindInput() {
  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
  })

  canvas.addEventListener('click', (e) => {
    instructionsEl.style.opacity = '0'

    // Check if click is on the moon
    const dx = e.clientX - moonCx
    const dy = e.clientY - moonCy
    if (dx * dx + dy * dy < moonR * moonR) {
      // Cycle phase
      phaseIndex = (phaseIndex + 1) % PHASE_NAMES.length
      phaseLabel.textContent = PHASE_NAMES[phaseIndex]!

      // Cycle active epoch every 2 phase changes
      if (phaseIndex % 2 === 0) {
        activeEpoch = (activeEpoch + 1) % EPOCHS.length
        updateEpochIndicator()
      }
    } else {
      // Click outside moon: cycle epoch directly
      activeEpoch = (activeEpoch + 1) % EPOCHS.length
      updateEpochIndicator()
    }
  })

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const t = e.touches[0]!
    mouseX = t.clientX
    mouseY = t.clientY
  }, { passive: false })

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const t = e.touches[0]!
    mouseX = t.clientX
    mouseY = t.clientY
  }, { passive: false })

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault()
    // Cycle on tap
    instructionsEl.style.opacity = '0'
    phaseIndex = (phaseIndex + 1) % PHASE_NAMES.length
    phaseLabel.textContent = PHASE_NAMES[phaseIndex]!
    activeEpoch = (activeEpoch + 1) % EPOCHS.length
    updateEpochIndicator()
  }, { passive: false })
}

function updateEpochIndicator() {
  const divs = epochIndicator.children
  for (let i = 0; i < divs.length; i++) {
    if (i === activeEpoch) {
      divs[i]!.classList.add('active')
    } else {
      divs[i]!.classList.remove('active')
    }
  }
}

// ── BOOT ────────────────────────────────────────────────────────────────

function boot() {
  resize()
  window.addEventListener('resize', resize)
  bindInput()
  updateEpochIndicator()
  requestAnimationFrame(render)
}

boot()
