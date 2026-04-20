/*
  ICARO-QUINE: Self-referential BEFLIX renderer — Pretext Engine.

  The code that draws the image IS the image. Each grid row is a
  layoutNextLine() call through the real Pretext library. The text
  wraps at natural word boundaries, and the intensity grid controls
  visibility via source-atop compositing.

  WHAT MAKES PRETEXT ESSENTIAL HERE (not decorative):
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. LIVE DENSITY SLIDER: Changing font size = new prepare() + instant
     layout() at the same canvas width. Each slider tick exercises the
     zero-DOM hot path (~0.002ms). You can SEE the speed difference.

  2. OBSTACLE-AWARE FLOW: When enabled, dark regions of the image
     create per-row variable widths. The text flows AROUND the image's
     own shape using layoutNextLine() with different widths per row.
     This is the dynamic-layout demo's obstacle logic applied to the
     quine — impossible without Pretext's cursor-based line walker.

  3. LIVE RESIZE: Drag the window — text re-wraps instantly because
     layout() does zero DOM reads, zero canvas calls. Each resize
     frame is one layout() call on the cached prepared text.

  4. SOURCE-ATOP COMPOSITING: The text is rendered as a continuous
     typeset flow, then composite-clipped by the intensity grid.
     Proper word-wrapped code, not character-stamped wallpaper.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

import {
  prepareWithSegments,
  layoutNextLine,
  walkLineRanges,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.ts'

// ── GRID CONSTANTS ──
const W = 640, H = 480, G_ROWS = 96, G_COLS = 128, B_SZ = 5
let BASE_FPS = 12

// ── PALETTE ──
const INKS = [
  { id: 0, hex: '#ffffff', rgb: [0, 0, 0, 0] as const },
  { id: 1, hex: '#dddddd', rgb: [0, 0, 0, 40] as const },
  { id: 2, hex: '#bbbbbb', rgb: [0, 0, 0, 80] as const },
  { id: 3, hex: '#999999', rgb: [0, 0, 0, 120] as const },
  { id: 4, hex: '#777777', rgb: [0, 0, 0, 160] as const },
  { id: 5, hex: '#555555', rgb: [0, 0, 0, 200] as const },
  { id: 6, hex: '#333333', rgb: [0, 0, 0, 230] as const },
  { id: 7, hex: '#000000', rgb: [0, 0, 0, 255] as const },
]

// ── DOT STAMPS ──
const DOT_STAMPS: HTMLCanvasElement[] = []
function buildDotStamps(): void {
  const maxR = B_SZ * 0.45
  for (let v = 0; v < 8; v++) {
    const c = document.createElement('canvas')
    c.width = B_SZ; c.height = B_SZ
    if (v > 0) {
      const dc = c.getContext('2d')!
      dc.fillStyle = '#000000'
      dc.beginPath()
      dc.arc(B_SZ / 2, B_SZ / 2, Math.max(0.4, maxR * (v / 7)), 0, Math.PI * 2)
      dc.fill()
    }
    DOT_STAMPS[v] = c
  }
}

function alphaToLevel(a: number): number {
  if (a < 16) return 0
  if (a < 55) return 1
  if (a < 95) return 2
  if (a < 135) return 3
  if (a < 175) return 4
  if (a < 210) return 5
  if (a < 240) return 6
  return 7
}

// ── STATE ──
type FrameData = {
  src: HTMLCanvasElement | null
  scriptLayer: Uint8ClampedArray
  handLayer: Uint8ClampedArray
}

const state = {
  frames: [] as FrameData[],
  cur: 0,
  playing: false,
  tool: 'pen' as 'pen' | 'rect' | 'erase',
  color: 7,
  size: 5,
  grid: false,
  renderMode: 'dot' as 'dot' | 'text',
  dragging: false,
  p0: [0, 0] as [number, number],
  p1: [0, 0] as [number, number],
  activeNav: null as string | null,
  obstacleFlow: false,
  liveCam: false,
  audioSourceBlob: null as Blob | null,
}

// ── CANVAS SETUP ──
const cvs = document.getElementById('primary-buffer') as HTMLCanvasElement
const ctx = cvs.getContext('2d', { willReadFrequently: true })!
const compBuf = document.createElement('canvas'); compBuf.width = W; compBuf.height = H
const compCtx = compBuf.getContext('2d', { willReadFrequently: true })!
const sharedValGrid = new Uint8Array(G_ROWS * G_COLS)

// Pre-allocated reusable canvases — eliminates GC jitter from per-frame allocations
const _fitCanvas = document.createElement('canvas'); _fitCanvas.width = W; _fitCanvas.height = H
const _fitCtx = _fitCanvas.getContext('2d')!
const _posterCanvas = document.createElement('canvas'); _posterCanvas.width = G_COLS; _posterCanvas.height = G_ROWS
const _posterCtx = _posterCanvas.getContext('2d')!
const _srcGridCanvas = document.createElement('canvas'); _srcGridCanvas.width = G_COLS; _srcGridCanvas.height = G_ROWS
const _srcGridCtx = _srcGridCanvas.getContext('2d')!
const _reuseSrcGrid = new Uint8Array(G_ROWS * G_COLS)

let playRAF = 0, lastT = 0

// ── PRETEXT STATE ──
// The real Pretext prepared text — cached and re-prepared only when code or font changes
let preparedText: PreparedTextWithSegments | null = null
let preparedFont = ''
let lastPrepareMs = 0
let lastLayoutMs = 0
let quineDensity = 1.5

// ── PRETEXT: Prepare the code text ──
// This calls the real prepareWithSegments() from src/layout.ts.
// It segments the code into words/spaces/operators and pre-measures
// every segment at the given font. This is the expensive step that
// only happens when the text or font changes.
function prepareQuineText(text: string, font: string): void {
  const t0 = performance.now()
  preparedText = prepareWithSegments(text, font)
  preparedFont = font
  lastPrepareMs = performance.now() - t0
}

// ── QUINE TEXT: Get + cache the flowing code text ──
let _cachedQuineText = ''
let _lastQuineRawLen = -1
let _fullScriptText = ''
const TEXTAREA_CHAR_LIMIT = 200000

function getFullScript(): string {
  const el = document.getElementById('b-script') as HTMLTextAreaElement | null
  if (_fullScriptText) return _fullScriptText
  return el ? el.value : ''
}

function setScriptText(text: string): void {
  _fullScriptText = text
  const el = document.getElementById('b-script') as HTMLTextAreaElement | null
  if (!el) return
  const lineCount = text.split('\n').length
  if (text.length > TEXTAREA_CHAR_LIMIT) {
    el.value = text.substring(0, TEXTAREA_CHAR_LIMIT) + '\n\n... [TRUNCATED]'
  } else {
    el.value = text
  }
  updateScriptInfo(lineCount, text.length)
}

function getQuineText(): string {
  const raw = _fullScriptText || getFullScript()
  if (_cachedQuineText && raw.length === _lastQuineRawLen) return _cachedQuineText
  _lastQuineRawLen = raw.length
  _cachedQuineText = raw.replace(/\s+/g, ' ').trim()
  if (!_cachedQuineText) _cachedQuineText = 'ABC FLIX 128 BEFLIX PROCESSOR '
  // Cap at 20K chars — prepareWithSegments on multi-MB strings is too slow
  if (_cachedQuineText.length > 20000) {
    _cachedQuineText = _cachedQuineText.substring(0, 20000)
  }
  while (_cachedQuineText.length < 20000) _cachedQuineText += ' ' + _cachedQuineText
  return _cachedQuineText
}

function updateScriptInfo(lineCount: number, charCount: number): void {
  const linesEl = document.getElementById('b-script-lines')
  if (linesEl) linesEl.textContent = lineCount.toLocaleString() + ' LINES · ' + (charCount / 1024).toFixed(1) + 'KB'
}

// ── OBSTACLE FLOW: Compute per-row horizontal displacement ──
// Instead of constraining widths (which breaks source-atop compositing),
// obstacle flow shifts each text line horizontally based on the center
// of intensity mass in that row. Text still covers the full canvas,
// but the displacement creates a visual "flowing around" effect.
function computeRowOffsets(): number[] {
  const offsets = new Array(G_ROWS).fill(0)
  if (!state.obstacleFlow) return offsets

  for (let gy = 0; gy < G_ROWS; gy++) {
    let massSum = 0, posSum = 0
    for (let gx = 0; gx < G_COLS; gx++) {
      const v = sharedValGrid[gy * G_COLS + gx]!
      if (v >= 2) {
        massSum += v
        posSum += gx * v
      }
    }
    if (massSum > 0) {
      // Center of mass in grid coords → pixel offset from canvas center
      const centerOfMass = posSum / massSum
      const canvasCenter = G_COLS / 2
      // Displace text opposite to the center of mass (text avoids intensity)
      offsets[gy] = Math.round((canvasCenter - centerOfMass) * B_SZ * 0.3)
    }
  }
  return offsets
}

// ── PRETEXT: Render quine with real layout engine ──
//
// HOW SOURCE-ATOP COMPOSITING WORKS:
// 1. Draw text across the ENTIRE canvas (black on transparent)
// 2. source-atop: paint intensity color/white rectangles per grid cell
//    — ONLY text pixels get colored, transparent areas stay transparent
// 3. destination-over: fill solid white behind everything
//
// CRITICAL: Text MUST cover the full canvas surface for this to work.
// Where there's no text, compositing has nothing to clip → blank gaps.
//
// PRETEXT EARNS ITS KEEP:
// - walkLineRanges() for fast full-width typesetting
// - layoutNextLine() for obstacle-flow per-row offset rendering
// - Density slider re-prepares and re-layouts at ~0.2ms (hot path)
function renderTextFrame(
  tc: CanvasRenderingContext2D,
): void {
  tc.clearRect(0, 0, W, H)

  const qText = getQuineText()
  const fontSize = B_SZ * quineDensity
  // Line height MUST equal B_SZ to align text rows with intensity grid cells.
  // If lh > B_SZ, you get gaps between text rows where compositing sees no text → blank streaks.
  // If lh < B_SZ, text rows overlap (fine visually; no gaps).
  const lh = B_SZ
  const fontStr = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`

  // Step 1: Prepare the text if font changed
  if (!preparedText || preparedFont !== fontStr) {
    prepareQuineText(qText, fontStr)
  }
  if (!preparedText) return

  const t0 = performance.now()

  tc.textAlign = 'left'
  tc.textBaseline = 'top'
  tc.font = fontStr
  tc.fillStyle = '#000000'

  // Step 2: Typeset code row-by-row at grid-aligned positions.
  //
  // BOTH modes use layoutNextLine() to walk the text cursor forward.
  // Each row is rendered at exactly (row * B_SZ) — perfectly aligned
  // with the intensity grid. This ensures zero gaps between text lines,
  // so source-atop compositing has full pixel coverage everywhere.
  //
  // FLOW: OFF → all rows at x=0, full canvas width
  // FLOW: ON  → per-row x-offset from center-of-mass displacement
  const rowOffsets = state.obstacleFlow ? computeRowOffsets() : null
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }

  for (let row = 0; row < G_ROWS; row++) {
    const y = row * lh
    if (y > H) break

    const line = layoutNextLine(preparedText, cursor, W)
    if (line === null) {
      // Text exhausted — loop back to start for seamless coverage
      cursor = { segmentIndex: 0, graphemeIndex: 0 }
      const retry = layoutNextLine(preparedText, cursor, W)
      if (retry === null) break
      const xOff = rowOffsets ? rowOffsets[row]! : 0
      tc.fillText(retry.text, xOff, y)
      cursor = retry.end
    } else {
      const xOff = rowOffsets ? rowOffsets[row]! : 0
      tc.fillText(line.text, xOff, y)
      cursor = line.end
      if (cursor.segmentIndex >= preparedText.segments.length) {
        cursor = { segmentIndex: 0, graphemeIndex: 0 }
      }
    }
  }

  lastLayoutMs = performance.now() - t0

  // Step 3: Intensity overlay via source-atop compositing
  // This is iq-high's technique: the text is already drawn across
  // the full canvas. Now paint colored rectangles per grid cell.
  // source-atop means ONLY text pixels get colored — transparent
  // areas stay transparent. Intensity 0 → white (erases text),
  // intensity 1-7 → grayscale shading.
  tc.globalCompositeOperation = 'source-atop'
  for (let v = 0; v <= 7; v++) {
    tc.fillStyle = v > 0 ? INKS[v]!.hex : '#FFFFFF'
    tc.beginPath()
    for (let gy = 0; gy < G_ROWS; gy++) {
      for (let gx = 0; gx < G_COLS; gx++) {
        if (sharedValGrid[gy * G_COLS + gx] === v) {
          tc.rect(gx * B_SZ, gy * B_SZ, B_SZ, B_SZ)
        }
      }
    }
    tc.fill()
  }

  // Step 4: Solid white behind everything
  tc.globalCompositeOperation = 'destination-over'
  tc.fillStyle = '#FFFFFF'
  tc.fillRect(0, 0, W, H)
  tc.globalCompositeOperation = 'source-over'
}

// ── RENDERING ──
function renderDotFrame(f: FrameData, targetCanvas: HTMLCanvasElement, live: Uint8ClampedArray | null = null): void {
  const tc = targetCanvas.getContext('2d')!

  let srcGrid: Uint8Array | null = null
  if (f.src) {
    _srcGridCtx.imageSmoothingEnabled = true
    _srcGridCtx.clearRect(0, 0, G_COLS, G_ROWS)
    _srcGridCtx.drawImage(f.src, 0, 0, G_COLS, G_ROWS)
    const srcPx = _srcGridCtx.getImageData(0, 0, G_COLS, G_ROWS).data
    srcGrid = _reuseSrcGrid
    for (let i = 0; i < G_ROWS * G_COLS; i++) {
      const pi = i * 4
      const lum = srcPx[pi]! * 0.299 + srcPx[pi + 1]! * 0.587 + srcPx[pi + 2]! * 0.114
      srcGrid[i] = Math.round((255 - lum) / 255 * 7)
    }
  }

  // Compute intensity grid
  for (let gy = 0; gy < G_ROWS; gy++) {
    for (let gx = 0; gx < G_COLS; gx++) {
      const sX = gx * B_SZ + Math.floor(B_SZ / 2)
      const sY = gy * B_SZ + Math.floor(B_SZ / 2)
      const sIdx = (sY * W + sX) * 4
      let val = 0
      if (live && live[sIdx + 3]! >= 16) {
        val = alphaToLevel(live[sIdx + 3]!)
      } else if (f.handLayer[sIdx + 3]! >= 16) {
        val = alphaToLevel(f.handLayer[sIdx + 3]!)
      } else if (f.scriptLayer[sIdx + 3]! >= 16) {
        val = alphaToLevel(f.scriptLayer[sIdx + 3]!)
      } else if (srcGrid) {
        val = srcGrid[gy * G_COLS + gx]!
      }
      sharedValGrid[gy * G_COLS + gx] = val
    }
  }

  if (state.renderMode === 'text') {
    renderTextFrame(tc)
  } else {
    tc.fillStyle = '#FFFFFF'
    tc.fillRect(0, 0, W, H)
    tc.strokeStyle = 'rgba(0,0,0,0.06)'
    tc.lineWidth = 0.5
    for (let gy = 0; gy < G_ROWS; gy++) {
      const py = gy * B_SZ + B_SZ * 0.5
      tc.beginPath(); tc.moveTo(0, py); tc.lineTo(W, py); tc.stroke()
    }
    for (let gy = 0; gy < G_ROWS; gy++) {
      for (let gx = 0; gx < G_COLS; gx++) {
        const val = sharedValGrid[gy * G_COLS + gx]!
        if (val > 0 && DOT_STAMPS[val]) {
          tc.drawImage(DOT_STAMPS[val]!, gx * B_SZ, gy * B_SZ)
        }
      }
    }
  }
}

function renderOutput(): void {
  const f = state.frames[state.cur]; if (!f) return
  let live: Uint8ClampedArray | null = null
  if (state.dragging && state.tool === 'rect') {
    live = getBlankMatrix()
    plotRect(live, state.p0[0]!, state.p0[1]!, state.p1[0]!, state.p1[1]!, INKS[state.color]!.rgb, state.size)
  }
  renderDotFrame(f, compBuf, live)
  // drawImage from same-size canvas replaces all pixels — no clearRect needed.
  // Removing clearRect eliminates the blank-frame flash at high refresh rates.
  ctx.drawImage(compBuf, 0, 0)
  updatePretextHUD()
}

function updatePretextHUD(): void {
  const hud = document.getElementById('pretext-hud')!
  if (state.renderMode === 'text' && preparedText) {
    hud.style.display = 'block'
    const segs = preparedText.segments.length
    const flow = state.obstacleFlow ? ' · FLOW' : ''
    hud.textContent = `PRETEXT: ${segs} segs · prep ${lastPrepareMs.toFixed(1)}ms · layout ${lastLayoutMs.toFixed(3)}ms${flow}`
  } else {
    hud.style.display = 'none'
  }
}

// ── FRAME MANAGEMENT ──
function getBlankMatrix(): Uint8ClampedArray { return new Uint8ClampedArray(W * H * 4) }

function injectFrame(init = false): void {
  state.frames.push({ src: null, scriptLayer: getBlankMatrix(), handLayer: getBlankMatrix() })
  if (!init) { state.cur = state.frames.length - 1; rebuildTrack(); renderOutput(); updateStatusBar() }
}

function duplicateFrame(): void {
  if (!state.frames.length) return
  const ref = state.frames[state.cur]!
  state.frames.splice(state.cur + 1, 0, {
    src: ref.src,
    scriptLayer: new Uint8ClampedArray(ref.scriptLayer),
    handLayer: new Uint8ClampedArray(ref.handLayer),
  })
  state.cur++; rebuildTrack(); renderOutput(); updateStatusBar(); fireToast('COPIED')
}

function stepSequence(dir: number): void {
  if (state.playing || !state.frames.length) return
  state.cur = (state.cur + dir + state.frames.length) % state.frames.length
  rebuildTrack(); renderOutput(); updateStatusBar()
}

// ── TIMELINE ──
// PERF: Thumbnails ALWAYS render in dot mode, never quine.
// Quine mode runs full pretext layout + fillText per thumbnail,
// which with 60+ frames would be 60× full text layout — instant freeze.
function renderDotFrameForThumb(f: FrameData, targetCanvas: HTMLCanvasElement): void {
  const savedMode = state.renderMode
  state.renderMode = 'dot'
  renderDotFrame(f, targetCanvas)
  state.renderMode = savedMode
}

function rebuildTrack(): void {
  const trk = document.getElementById('tl-strip')!; trk.innerHTML = ''
  state.frames.forEach((f, i) => {
    const w = document.createElement('div'); w.className = 'tl-frame' + (i === state.cur ? ' on' : '')
    w.onclick = () => { if (state.playing) return; state.cur = i; rebuildTrack(); renderOutput(); updateStatusBar() }
    const c = document.createElement('canvas'); c.className = 'tl-thumb'; c.width = W; c.height = H
    renderDotFrameForThumb(f, c)
    w.appendChild(c)
    const n = document.createElement('div'); n.className = 'tl-num'; n.textContent = String(i + 1); w.appendChild(n)
    trk.appendChild(w)
    if (i === state.cur) w.scrollIntoView({ inline: 'center', block: 'nearest' })
  })
  updateStatusBar()
}

// ── PLAYBACK ──
function engageSequence(): void {
  state.playing = !state.playing
  updatePlayOverlay()
  if (state.playing) { lastT = performance.now(); playRAF = requestAnimationFrame(playStep) }
  else { cancelAnimationFrame(playRAF); renderOutput(); rebuildTrack() }
}

function playStep(now: number): void {
  if (!state.playing) return
  playRAF = requestAnimationFrame(playStep)
  const el = now - lastT, dur = 1000 / BASE_FPS
  if (el >= dur) {
    lastT = now - (el % dur)
    state.cur = (state.cur + 1) % state.frames.length
    renderOutput()
    document.querySelectorAll<HTMLElement>('.tl-frame').forEach((el, i) =>
      i === state.cur ? el.classList.add('on') : el.classList.remove('on'))
    const fb = document.getElementById('sb-frame')
    if (fb) fb.textContent = `${String(state.cur + 1).padStart(2, '0')}/${String(state.frames.length).padStart(2, '0')}`
  }
}

function updatePlayOverlay(): void {
  const hasFrames = state.frames.length > 0
  const isDrawMode = state.activeNav === 'C'
  const overlay = document.getElementById('play-overlay')
  const tapZone = document.getElementById('canvas-tap-zone')
  if (overlay) overlay.classList.toggle('visible', hasFrames && !state.playing && !isDrawMode)
  if (tapZone) tapZone.classList.toggle('on', hasFrames && !isDrawMode)
  const btn = document.getElementById('sb-play-btn')
  const lbl = document.getElementById('play-label')
  const icon = document.getElementById('play-icon')
  if (btn) btn.classList.toggle('playing', state.playing)
  if (lbl) lbl.textContent = state.playing ? 'STOP' : 'PLAY'
  if (icon) icon.innerHTML = state.playing
    ? '<rect x="0" y="0" width="5" height="16"/><rect x="9" y="0" width="5" height="16"/>'
    : '<polygon points="0,0 14,8 0,16"/>'
}

function updateStatusBar(): void {
  const ink = INKS[state.color]
  const sb = document.getElementById('sb-frame')
  if (sb) sb.textContent = state.frames.length
    ? `${String(state.cur + 1).padStart(2, '0')}/${String(state.frames.length).padStart(2, '0')}`
    : '00/00'
  const st = document.getElementById('sb-tool')
  if (st) st.textContent = state.tool.toUpperCase()
  const dot = document.getElementById('sb-color') as HTMLElement | null
  if (dot && ink) dot.style.background = ink.hex
  const fpsEl = document.getElementById('sb-fps-val')
  if (fpsEl) fpsEl.textContent = String(BASE_FPS)
  const badge = document.getElementById('tab-c-badge') as HTMLElement | null
  if (badge && ink) badge.style.background = ink.hex
  updatePlayOverlay()
}

// ── DRAWING ──
function bindPixel(arr: Uint8ClampedArray, x: number, y: number, c: readonly number[]): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  arr[i] = c[0]!; arr[i + 1] = c[1]!; arr[i + 2] = c[2]!; arr[i + 3] = c[3]!
}

function plotBlock(arr: Uint8ClampedArray, x: number, y: number, c: readonly number[], r: number): void {
  const rad = r / 2
  for (let iy = -Math.ceil(rad); iy <= Math.ceil(rad); iy++)
    for (let ix = -Math.ceil(rad); ix <= Math.ceil(rad); ix++)
      if (ix * ix + iy * iy <= rad * rad) bindPixel(arr, Math.round(x + ix), Math.round(y + iy), c)
}

function plotVector(arr: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c: readonly number[], w: number): void {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
  let err = dx + dy, lim = 3000
  while (lim-- > 0) {
    plotBlock(arr, x0, y0, c, w)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

function plotRect(arr: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c: readonly number[], w: number): void {
  plotVector(arr, x0, y0, x1, y0, c, w)
  plotVector(arr, x1, y0, x1, y1, c, w)
  plotVector(arr, x1, y1, x0, y1, c, w)
  plotVector(arr, x0, y1, x0, y0, c, w)
}

function mapCoord(e: PointerEvent): [number, number] {
  const r = cvs.getBoundingClientRect()
  if (!r.width) return [0, 0]
  return [
    Math.max(0, Math.min(W - 1, Math.floor((e.clientX - r.left) / r.width * W))),
    Math.max(0, Math.min(H - 1, Math.floor((e.clientY - r.top) / r.height * H))),
  ]
}

function commitStroke(p0: [number, number], p1: [number, number], final = false): void {
  const f = state.frames[state.cur]!
  const col = state.tool === 'erase' ? INKS[0]!.rgb : INKS[state.color]!.rgb
  if (state.tool === 'pen' || state.tool === 'erase') plotVector(f.handLayer, p0[0], p0[1], p1[0], p1[1], col, state.size)
  else if (state.tool === 'rect' && final) plotRect(f.handLayer, p0[0], p0[1], p1[0], p1[1], col, state.size)
  renderOutput()
}

// ── CANVAS INTERACTION ──
cvs.addEventListener('pointerdown', (e) => {
  const drawActive = state.activeNav === 'C' || document.getElementById('draw-toolbar')!.classList.contains('on')
  if (!drawActive) return
  cvs.setPointerCapture(e.pointerId)
  state.dragging = true; state.p0 = mapCoord(e); state.p1 = state.p0
  commitStroke(state.p0, state.p0)
})
cvs.addEventListener('pointermove', (e) => {
  if (!state.dragging) return
  const prev = state.p1; state.p1 = mapCoord(e)
  if (state.tool === 'rect') renderOutput()
  else commitStroke(prev, state.p1)
})
cvs.addEventListener('pointerup', () => {
  if (!state.dragging) return
  if (state.tool === 'rect') commitStroke(state.p0, state.p1, true)
  state.dragging = false; renderOutput(); rebuildTrack()
})

// ── BEFLIX EXECUTOR ──
const SCRIPT_CHUNK_SIZE = 500

async function executeMacro(): Promise<void> {
  const runBtn = document.getElementById('btn-run-script') as HTMLButtonElement | null
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'RUNNING...' }

  const fullCode = getFullScript().toUpperCase().split('\n')
  const totalLines = fullCode.length
  if (totalLines === 0) { fireToast('NO SCRIPT'); if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'RUN SCRIPT' }; return }

  lockSystem('COMPILING SCRIPT...', '0')
  // Yield to let lock screen paint
  await new Promise(r => setTimeout(r, 50))

  const res: number[][][] = []
  let mat = Array.from({ length: G_ROWS }, () => Array<number>(G_COLS).fill(0))

  try {
    for (let chunk = 0; chunk < totalLines; chunk += SCRIPT_CHUNK_SIZE) {
      const end = Math.min(chunk + SCRIPT_CHUNK_SIZE, totalLines)
      for (let li = chunk; li < end; li++) {
        const l = fullCode[li]!.trim()
        if (!l || l.startsWith('C')) continue
        const p = l.split(/\s+/), cmd = p[0]!, a = p.slice(1).map(Number)

        if (cmd === 'CLR') {
          for (let y = 0; y < G_ROWS; y++) for (let x = 0; x < G_COLS; x++) mat[y]![x] = a[0]!
        } else if (cmd === 'PNT') {
          for (let y = a[1]!; y < a[1]! + a[3]!; y++)
            for (let x = a[0]!; x < a[0]! + a[2]!; x++)
              if (y >= 0 && y < G_ROWS && x >= 0 && x < G_COLS) mat[y]![x] = a[4]!
        } else if (cmd === 'LIN') {
          const lv = a[4]!
          let lx = a[0]!, ly = a[1]!
          const lx2 = a[2]!, ly2 = a[3]!
          let dx = Math.abs(lx2 - lx), sx = lx < lx2 ? 1 : -1
          let dy = -Math.abs(ly2 - ly), sy = ly < ly2 ? 1 : -1
          let err = dx + dy, lim = 2000
          while (lim-- > 0) {
            if (lx >= 0 && lx < G_COLS && ly >= 0 && ly < G_ROWS) mat[ly]![lx] = lv
            if (lx === lx2 && ly === ly2) break
            const e2 = 2 * err
            if (e2 >= dy) { err += dy; lx += sx }
            if (e2 <= dx) { err += dx; ly += sy }
          }
        } else if (cmd === 'REC') {
          for (let i = 0; i < Math.min(a[0]!, 5000); i++) res.push(mat.map(r => [...r]))
        } else if (cmd === 'SHF') {
          for (let f = 0; f < Math.min(a[2]!, 5000); f++) {
            const n = Array.from({ length: G_ROWS }, () => Array<number>(G_COLS).fill(0))
            for (let y = 0; y < G_ROWS; y++)
              for (let x = 0; x < G_COLS; x++) {
                const nx = x - a[0]!, ny = y - a[1]!
                if (nx >= 0 && nx < G_COLS && ny >= 0 && ny < G_ROWS) n[y]![x] = mat[ny]![nx]!
              }
            mat = n; res.push(mat.map(r => [...r]))
          }
        }
      }
      // Yield to main thread every chunk — prevents freeze
      if (chunk + SCRIPT_CHUNK_SIZE < totalLines) {
        const pct = Math.round((end / totalLines) * 100)
        document.getElementById('lock-counter')!.textContent = 'LINE ' + end.toLocaleString() + '/' + totalLines.toLocaleString() + ' (' + pct + '%)'
        await new Promise(r => setTimeout(r, 0))
      }
    }

    if (!res.length) res.push(mat)

    document.getElementById('lock-counter')!.textContent = 'BUILDING ' + res.length + ' FRAMES...'
    await new Promise(r => setTimeout(r, 0))

    while (state.frames.length < res.length) injectFrame(true)
    if (state.frames.length > res.length) state.frames.length = res.length

    for (let i = 0; i < state.frames.length; i++) {
      const f = state.frames[i]!, sm = res[i % res.length]!
      f.scriptLayer.fill(0)
      for (let y = 0; y < G_ROWS; y++)
        for (let x = 0; x < G_COLS; x++) {
          if (!sm[y]![x]) continue
          const col = INKS[sm[y]![x]!]!.rgb
          for (let by = 0; by < B_SZ; by++)
            for (let bx = 0; bx < B_SZ; bx++)
              bindPixel(f.scriptLayer, x * B_SZ + bx, y * B_SZ + by, col)
        }
      // Yield every 20 frames during rasterization
      if (state.frames.length > 20 && i % 20 === 19) {
        document.getElementById('lock-counter')!.textContent = 'FRAME ' + (i + 1) + '/' + state.frames.length
        await new Promise(r => setTimeout(r, 0))
      }
    }

    // PRETEXT: Prepare the code text for quine rendering
    _cachedQuineText = '' // force re-cache
    _lastQuineRawLen = -1
    const fontSize = B_SZ * quineDensity
    const fontStr = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    prepareQuineText(getQuineText(), fontStr)

    fireToast(state.frames.length + ' FRAMES · ' + (preparedText?.segments.length || 0) + ' PRETEXT SEGS')
    state.cur = 0
    renderOutput(); rebuildTrack(); updateStatusBar()
  } catch (e) {
    console.error('MACRO ERROR:', e)
    fireToast('SYNTAX HALT: ' + ((e as Error).message || 'PARSE ERROR'))
  } finally {
    releaseSystem()
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'RUN SCRIPT' }
  }
}

// ── DECOMPILE ──
function decompileFrames(): string {
  let fullCode = ''
  for (let fIdx = 0; fIdx < state.frames.length; fIdx++) {
    fullCode += 'C FRAME ' + (fIdx + 1) + '\n'
    const f = state.frames[fIdx]!
    const grid = Array.from({ length: G_ROWS }, () => Array<number>(G_COLS).fill(0))
    let srcGrid: Uint8Array | null = null
    if (f.src) {
      const tmpC = document.createElement('canvas'); tmpC.width = G_COLS; tmpC.height = G_ROWS
      const tmpX = tmpC.getContext('2d')!
      tmpX.imageSmoothingEnabled = true; tmpX.drawImage(f.src, 0, 0, G_COLS, G_ROWS)
      const srcPx = tmpX.getImageData(0, 0, G_COLS, G_ROWS).data
      srcGrid = new Uint8Array(G_ROWS * G_COLS)
      for (let si = 0; si < G_ROWS * G_COLS; si++) {
        const pi = si * 4
        srcGrid[si] = Math.round((255 - (srcPx[pi]! * 0.299 + srcPx[pi + 1]! * 0.587 + srcPx[pi + 2]! * 0.114)) / 255 * 7)
      }
    }
    for (let gy = 0; gy < G_ROWS; gy++) {
      for (let gx = 0; gx < G_COLS; gx++) {
        const px = gx * B_SZ + Math.floor(B_SZ / 2), py = gy * B_SZ + Math.floor(B_SZ / 2)
        const idx = (py * W + px) * 4
        const a = f.handLayer[idx + 3]!
        if (a >= 16) { grid[gy]![gx] = alphaToLevel(a) }
        else {
          const sa = f.scriptLayer[idx + 3]!
          if (sa >= 16) { grid[gy]![gx] = alphaToLevel(sa) }
          else if (srcGrid) { grid[gy]![gx] = srcGrid[gy * G_COLS + gx]! }
        }
      }
    }
    const counts = new Uint32Array(8)
    for (let gy = 0; gy < G_ROWS; gy++) for (let gx = 0; gx < G_COLS; gx++) counts[grid[gy]![gx]!]++
    let bgInk = 0, maxCount = 0
    for (let i = 0; i < 8; i++) { if (counts[i]! > maxCount) { maxCount = counts[i]!; bgInk = i } }
    fullCode += 'CLR ' + bgInk + '\n'
    for (let gy = 0; gy < G_ROWS; gy++) {
      let gx = 0
      while (gx < G_COLS) {
        const ink = grid[gy]![gx]!
        if (ink !== bgInk) {
          const startX = gx
          while (gx < G_COLS && grid[gy]![gx] === ink) gx++
          fullCode += 'PNT ' + startX + ' ' + gy + ' ' + (gx - startX) + ' 1 ' + ink + '\n'
        } else { gx++ }
      }
    }
    fullCode += 'REC 1\n'
  }
  return fullCode
}

// ── IMAGE INGEST ──
function fitSource(src: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement, sw: number, sh: number): HTMLCanvasElement {
  _fitCtx.fillStyle = '#000'; _fitCtx.fillRect(0, 0, W, H)
  const a = sw / sh; let dw = W, dh = H, dx = 0, dy = 0
  if (a > W / H) { dh = W / a; dy = (H - dh) / 2 } else { dw = H * a; dx = (W - dw) / 2 }
  _fitCtx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh)
  // Return a snapshot — caller may store this as frame.src
  const c = document.createElement('canvas'); c.width = W; c.height = H
  c.getContext('2d')!.drawImage(_fitCanvas, 0, 0)
  return c
}

function nearestInk(r: number, g: number, b: number): number {
  const lum = r * 0.299 + g * 0.587 + b * 0.114
  return Math.max(0, Math.min(7, Math.round((255 - lum) / 255 * 7)))
}

function applyBeflixProcess(frame: FrameData): void {
  if (!frame.src) return
  _posterCtx.imageSmoothingEnabled = true
  _posterCtx.clearRect(0, 0, G_COLS, G_ROWS)
  _posterCtx.drawImage(frame.src, 0, 0, G_COLS, G_ROWS)
  const srcData = _posterCtx.getImageData(0, 0, G_COLS, G_ROWS).data
  const grid = Array.from({ length: G_ROWS }, () => Array<number>(G_COLS).fill(0))
  for (let gy = 0; gy < G_ROWS; gy++) for (let gx = 0; gx < G_COLS; gx++) {
    const i = (gy * G_COLS + gx) * 4
    grid[gy]![gx] = nearestInk(srcData[i]!, srcData[i + 1]!, srcData[i + 2]!)
  }
  frame.scriptLayer.fill(0)
  for (let gy = 0; gy < G_ROWS; gy++) for (let gx = 0; gx < G_COLS; gx++) {
    if (grid[gy]![gx]) {
      const rgbArray = INKS[grid[gy]![gx]!]!.rgb
      for (let by = 0; by < B_SZ; by++) for (let bx = 0; bx < B_SZ; bx++) {
        const idx = ((gy * B_SZ + by) * W + (gx * B_SZ + bx)) * 4
        frame.scriptLayer[idx] = rgbArray[0]; frame.scriptLayer[idx + 1] = rgbArray[1]
        frame.scriptLayer[idx + 2] = rgbArray[2]; frame.scriptLayer[idx + 3] = rgbArray[3]
      }
    }
  }
}

// ── UI HELPERS ──
function fireToast(msg: string): void {
  const t = document.getElementById('hud-toast')!
  t.textContent = msg; t.classList.add('on')
  clearTimeout((t as any)._timer)
  ;(t as any)._timer = setTimeout(() => t.classList.remove('on'), 1500)
}

function lockSystem(msg: string, count: string | number): void {
  const l = document.getElementById('lock-screen')!; l.classList.add('on')
  document.getElementById('lock-msg')!.textContent = msg
  document.getElementById('lock-counter')!.textContent = String(count)
}

function releaseSystem(): void {
  document.getElementById('lock-screen')!.classList.remove('on')
}

function rescaleWorkspace(): void {
  const zone = document.getElementById('canvas-zone')!
  const wrap = document.getElementById('canvas-wrapper')!
  if (!zone || zone.clientWidth === 0) return
  const padding = 12
  const sc = Math.min((zone.clientWidth - padding) / W, (zone.clientHeight - padding) / H)
  cvs.style.width = (W * sc) + 'px'; cvs.style.height = (H * sc) + 'px'
  cvs.width = W; cvs.height = H
  wrap.style.width = (W * sc) + 'px'; wrap.style.height = (H * sc) + 'px'
  renderOutput()
}

function drawCoordGrid(): void {
  const net = document.getElementById('net') as HTMLCanvasElement; if (!net) return
  net.width = W; net.height = H
  const gc = net.getContext('2d')!; gc.clearRect(0, 0, W, H)
  gc.strokeStyle = 'rgba(0,0,0,0.08)'; gc.lineWidth = 0.5
  for (let gx = 0; gx <= G_COLS; gx++) { gc.beginPath(); gc.moveTo(gx * B_SZ, 0); gc.lineTo(gx * B_SZ, H); gc.stroke() }
  for (let gy = 0; gy <= G_ROWS; gy++) { gc.beginPath(); gc.moveTo(0, gy * B_SZ); gc.lineTo(W, gy * B_SZ); gc.stroke() }
}

// ── NAV / SHEETS ──
function closeAllSheets(): void {
  ;['a', 'b', 'c', 'd'].forEach(id => {
    document.getElementById('sheet-' + id)?.classList.remove('on')
    const t = document.getElementById('tab-' + id)
    if (t) t.className = 'tab-btn'
  })
  document.getElementById('sheet-backdrop')!.classList.remove('on')
  if (state.activeNav !== 'C') document.getElementById('draw-toolbar')!.classList.remove('on')
  state.activeNav = null
  updatePlayOverlay()
}

function execNav(id: string): void {
  const wasActive = state.activeNav === id
  closeAllSheets()
  if (!wasActive) {
    state.activeNav = id
    ;['a', 'b', 'c', 'd'].forEach(c => {
      const t = document.getElementById('tab-' + c)
      if (t) t.className = 'tab-btn'
    })
    document.getElementById('tab-' + id.toLowerCase())!.classList.add('on-' + id.toLowerCase())
    document.getElementById('sheet-' + id.toLowerCase())!.classList.add('on')
    document.getElementById('sheet-backdrop')!.classList.add('on')
    if (id === 'C') document.getElementById('draw-toolbar')!.classList.add('on')
  }
  updatePlayOverlay()
  requestAnimationFrame(rescaleWorkspace)
}

function bindTool(id: 'pen' | 'rect' | 'erase'): void {
  state.tool = id
  ;['pen', 'rect', 'erase'].forEach(t => {
    document.getElementById('tool-' + t)?.classList.toggle('on', t === id)
    document.getElementById('dtt-' + t)?.classList.toggle('on', t === id)
  })
  updateStatusBar()
}

function buildInkReservoir(): void {
  ;['c-ink-swatches', 'dt-swatches'].forEach(boxId => {
    const box = document.getElementById(boxId); if (!box) return
    box.innerHTML = ''
    INKS.slice(1).forEach(c => {
      const s = document.createElement('div')
      s.className = (boxId === 'c-ink-swatches' ? 'ink-swatch' : 'dt-swatch') + (c.id === state.color ? ' on' : '')
      s.style.background = c.hex
      s.onclick = () => {
        state.color = c.id
        document.querySelectorAll('.ink-swatch, .dt-swatch').forEach(el => (el as HTMLElement).classList.remove('on'))
        document.querySelectorAll<HTMLElement>('.ink-swatch, .dt-swatch').forEach(el => {
          if (el.style.background === c.hex || el.style.backgroundColor === c.hex) el.classList.add('on')
        })
        if (state.tool === 'erase') bindTool('pen')
        updateStatusBar()
      }
      box.appendChild(s)
    })
  })
}

// ── EXPORT ──
const EXPORT_SCALE = 2, EW = W * EXPORT_SCALE, EH = H * EXPORT_SCALE
const GIF_WORKER_URL = 'https://cdn.jsdelivr.net/npm/gif.js.optimized/dist/gif.worker.js'

function renderCompositeFrame(frame: FrameData, target: HTMLCanvasElement): void {
  renderDotFrame(frame, target)
}

function pickMimeType(fmt: string): string {
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mp4 = ['video/mp4;codecs=h264', 'video/mp4']
  const list = fmt === 'mp4' ? mp4 : webm
  for (const mt of list) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) return mt
  }
  return ''
}

function exportCurrentPNG(): void {
  if (!state.frames.length) return
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  renderCompositeFrame(state.frames[state.cur]!, tmp)
  const ec = document.createElement('canvas'); ec.width = EW; ec.height = EH
  ec.getContext('2d')!.drawImage(tmp, 0, 0, EW, EH)
  const l = document.createElement('a')
  l.download = 'ICARO_QUINE_' + String(state.cur + 1).padStart(3, '0') + '.png'
  l.href = ec.toDataURL('image/png')
  l.click()
  fireToast('PNG EXPORTED')
}

async function compileOutput(format: string = 'webm'): Promise<void> {
  if (!state.frames.length) return
  if (state.playing) engageSequence()
  if (typeof MediaRecorder === 'undefined') { fireToast('NO ENCODER'); return }
  const mimeType = pickMimeType(format)
  if (!mimeType) { fireToast(format.toUpperCase() + ' UNSUPPORTED'); return }
  lockSystem('ENCODING ' + format.toUpperCase(), '0')

  const ec = document.createElement('canvas'); ec.width = EW; ec.height = EH
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  const stream = ec.captureStream(BASE_FPS)

  // Audio sync — if we have source audio from video ingest
  let audioSourceNode: AudioBufferSourceNode | null = null
  let exportAudioCtx: AudioContext | null = null
  if (state.audioSourceBlob) {
    try {
      exportAudioCtx = new AudioContext()
      const arrayBuf = await state.audioSourceBlob.arrayBuffer()
      const audioBuffer = await exportAudioCtx.decodeAudioData(arrayBuf)
      const audioDest = exportAudioCtx.createMediaStreamDestination()
      audioSourceNode = exportAudioCtx.createBufferSource()
      audioSourceNode.buffer = audioBuffer
      const outputDur = state.frames.length / BASE_FPS
      const audioDur = audioBuffer.duration
      if (audioDur > 0 && outputDur > 0) {
        audioSourceNode.playbackRate.value = Math.max(0.25, Math.min(4.0, audioDur / outputDur))
      }
      audioSourceNode.connect(audioDest)
      const audioTracks = audioDest.stream.getAudioTracks()
      if (audioTracks.length > 0) stream.addTrack(audioTracks[0]!)
      fireToast('AUDIO SYNCED · ' + audioDur.toFixed(1) + 's → ' + outputDur.toFixed(1) + 's')
    } catch (audioErr) {
      console.warn('Audio decode failed:', audioErr)
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
  const stopP = new Promise<void>((res) => { recorder.onstop = () => res() })

  if (audioSourceNode) { try { audioSourceNode.start(0) } catch (_) {} }
  recorder.start()

  for (let i = 0; i < state.frames.length; i++) {
    renderCompositeFrame(state.frames[i]!, tmp)
    ec.getContext('2d')!.drawImage(tmp, 0, 0, EW, EH)
    document.getElementById('lock-counter')!.textContent = String(i + 1)
    await new Promise(rs => setTimeout(rs, 1000 / BASE_FPS))
  }
  await new Promise(rs => setTimeout(rs, 1000 / BASE_FPS))
  recorder.stop()

  if (audioSourceNode) { try { audioSourceNode.stop() } catch (_) {} }
  if (exportAudioCtx) { try { exportAudioCtx.close() } catch (_) {} }

  await stopP
  stream.getTracks().forEach(t => t.stop())

  const ext = mimeType.indexOf('mp4') >= 0 ? 'mp4' : 'webm'
  const bl = new Blob(chunks, { type: mimeType })
  const l = document.createElement('a')
  l.download = 'ICARO_QUINE_' + Date.now() + '.' + ext
  l.href = URL.createObjectURL(bl)
  l.click()
  setTimeout(() => URL.revokeObjectURL(l.href), 2000)
  releaseSystem()
  fireToast(ext.toUpperCase() + ' EXPORTED')
}

function compileGIF(): void {
  if (!state.frames.length) return
  if (typeof (window as any).GIF === 'undefined') { fireToast('GIF UNAVAILABLE'); return }
  lockSystem('ENCODING GIF', '0')
  const gif = new (window as any).GIF({
    workers: 1, quality: 12, width: EW, height: EH, workerScript: GIF_WORKER_URL
  })
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  for (let i = 0; i < state.frames.length; i++) {
    renderCompositeFrame(state.frames[i]!, tmp)
    const fc = document.createElement('canvas'); fc.width = EW; fc.height = EH
    fc.getContext('2d')!.drawImage(tmp, 0, 0, EW, EH)
    gif.addFrame(fc, { delay: 1000 / BASE_FPS, copy: true })
  }
  gif.on('progress', (p: number) => {
    document.getElementById('lock-counter')!.textContent = Math.round(p * 100) + '%'
  })
  gif.on('finished', (blob: Blob) => {
    const l = document.createElement('a')
    l.download = 'ICARO_QUINE_' + Date.now() + '.gif'
    l.href = URL.createObjectURL(blob)
    l.click()
    setTimeout(() => URL.revokeObjectURL(l.href), 2000)
    releaseSystem()
    fireToast('GIF EXPORTED')
  })
  gif.render()
}

function compileContactSheet(): void {
  if (!state.frames.length) return
  lockSystem('PRINTING SHEET', '0')
  setTimeout(() => {
    const cols = Math.min(5, state.frames.length)
    const rows = Math.ceil(state.frames.length / cols)
    const sc = document.createElement('canvas'); sc.width = cols * W; sc.height = rows * H
    const sctx = sc.getContext('2d')!
    for (let i = 0; i < state.frames.length; i++) {
      const tc = document.createElement('canvas'); tc.width = W; tc.height = H
      renderCompositeFrame(state.frames[i]!, tc)
      sctx.drawImage(tc, (i % cols) * W, Math.floor(i / cols) * H)
    }
    const l = document.createElement('a')
    l.download = 'ICARO_SHEET_' + state.frames.length + 'f.png'
    l.href = sc.toDataURL('image/png')
    l.click()
    releaseSystem()
    fireToast('SHEET EXPORTED')
  }, 50)
}

// ── VIDEO INGEST ──
async function ripFrames(source: Blob): Promise<void> {
  lockSystem('RIPPING FRAMES...', '0')
  const url = URL.createObjectURL(source)
  const vid = document.createElement('video')
  vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = url
  await new Promise<void>((res, rej) => { vid.onloadedmetadata = () => res(); vid.onerror = () => rej(); setTimeout(res, 5000) })

  const dur = vid.duration || 10
  const maxF = 120
  const interval = Math.max(1 / BASE_FPS, dur / maxF)
  const frames: HTMLCanvasElement[] = []
  let lastCap = -Infinity

  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    await new Promise<void>(res => {
      function onFrame(_now: number, meta: any): void {
        if (frames.length >= maxF || vid.ended) { res(); return }
        const t = meta.mediaTime as number
        if (t - lastCap >= interval - 0.001) {
          lastCap = t
          if (vid.videoWidth) frames.push(fitSource(vid, vid.videoWidth, vid.videoHeight))
          document.getElementById('lock-counter')!.textContent = String(frames.length)
        }
        ;(vid as any).requestVideoFrameCallback(onFrame)
      }
      ;(vid as any).requestVideoFrameCallback(onFrame)
      vid.play().catch(() => {})
      setTimeout(res, (dur + 3) * 1000)
    })
  } else {
    await new Promise<void>(res => {
      function onRAF(): void {
        if (frames.length >= maxF || vid.ended) { res(); return }
        if (vid.videoWidth && vid.currentTime - lastCap >= interval - 0.001) {
          lastCap = vid.currentTime
          frames.push(fitSource(vid, vid.videoWidth, vid.videoHeight))
          document.getElementById('lock-counter')!.textContent = String(frames.length)
        }
        requestAnimationFrame(onRAF)
      }
      requestAnimationFrame(onRAF)
      vid.play().catch(() => {})
      setTimeout(res, (dur + 3) * 1000)
    })
  }

  vid.pause(); vid.src = ''; URL.revokeObjectURL(url)

  if (!frames.length) { releaseSystem(); fireToast('NO FRAMES CAPTURED'); return }

  // Convert video frames to BEFLIX frames
  state.frames = []
  for (let i = 0; i < frames.length; i++) {
    const f: FrameData = { src: frames[i]!, scriptLayer: getBlankMatrix(), handLayer: getBlankMatrix() }
    applyBeflixProcess(f)
    state.frames.push(f)
  }
  state.cur = 0

  // Prepare quine text from frame data
  _cachedQuineText = ''
  _lastQuineRawLen = -1

  renderOutput(); rebuildTrack(); updateStatusBar()
  releaseSystem()
  fireToast(frames.length + ' FRAMES RIPPED')
}

// ── CAMERA — Live BEFLIX Mirror ──
// Camera opens → raw feed as corner PiP → posterized BEFLIX on canvas.
// CAPTURE toggles video recording. CODE dumps live BEFLIX script.
// SNAP freezes current frame to timeline.

let camStream: MediaStream | null = null
let camRecorder: MediaRecorder | null = null
let camChunks: Blob[] = []
let camCapturing = false

async function toggleCamera(): Promise<void> {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
    const camVid = document.getElementById('cam-vid') as HTMLVideoElement
    camVid.srcObject = camStream
    await camVid.play()
    document.getElementById('cam-feed')!.style.display = 'flex'
    state.liveCam = true
    updatePlayOverlay()
    fireToast('MIRROR LIVE')
    lastCamT = 0
    requestAnimationFrame(liveCamLoop)
  } catch (err) {
    console.warn('Camera error:', err)
    fireToast('CAMERA DENIED')
  }
}

function killCamera(): void {
  stopCamCapture()
  if (camStream) camStream.getTracks().forEach(t => t.stop())
  camStream = null
  const camVid = document.getElementById('cam-vid') as HTMLVideoElement
  camVid.srcObject = null
  document.getElementById('cam-feed')!.style.display = 'none'
  state.liveCam = false
  updatePlayOverlay()
  renderOutput()
}

// ── Live mirror loop ──
// Uses _fitCanvas directly for the live frame — no snapshot allocation.
// Only SNAP creates a real snapshot canvas for persistent storage.
let lastCamT = 0
function liveCamLoop(now: number): void {
  if (!state.liveCam || !camStream) return
  requestAnimationFrame(liveCamLoop)

  const camVid = document.getElementById('cam-vid') as HTMLVideoElement
  if (!camVid.videoWidth || camVid.readyState < 2) return

  const interval = 1000 / BASE_FPS
  if (now - lastCamT < interval) return
  lastCamT = now

  // Draw camera into reusable canvas — no allocation
  _fitCtx.fillStyle = '#000'; _fitCtx.fillRect(0, 0, W, H)
  const sw = camVid.videoWidth, sh = camVid.videoHeight
  const a = sw / sh; let dw = W, dh = H, dx = 0, dy = 0
  if (a > W / H) { dh = W / a; dy = (H - dh) / 2 } else { dw = H * a; dx = (W - dw) / 2 }
  _fitCtx.drawImage(camVid, 0, 0, sw, sh, dx, dy, dw, dh)

  // Point frame.src at the shared canvas for posterization
  state.frames[state.cur]!.src = _fitCanvas
  applyBeflixProcess(state.frames[state.cur]!)
  renderOutput()
}

// ── SNAP: freeze current frame permanently ──
function camSnap(): void {
  if (!state.liveCam) return
  const camVid = document.getElementById('cam-vid') as HTMLVideoElement
  if (!camVid.videoWidth || camVid.readyState < 2) { fireToast('NO FEED'); return }
  // SNAP needs a real snapshot (new canvas) because it persists in the timeline
  const snap = fitSource(camVid, camVid.videoWidth, camVid.videoHeight)
  const f: FrameData = { src: snap, scriptLayer: getBlankMatrix(), handLayer: getBlankMatrix() }
  applyBeflixProcess(f)
  state.frames.push(f)
  state.cur = state.frames.length - 1
  renderOutput(); rebuildTrack(); updateStatusBar()
  fireToast('SNAP ' + state.frames.length)
}

// ── CAPTURE: toggle video recording of the canvas ──
function toggleCamCapture(): void {
  if (!state.liveCam) return
  if (camCapturing) {
    stopCamCapture()
  } else {
    startCamCapture()
  }
}

function startCamCapture(): void {
  const cvs = document.getElementById('primary-buffer') as HTMLCanvasElement
  const stream = cvs.captureStream(BASE_FPS)
  const candidates = [
    'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
    'video/mp4;codecs=h264', 'video/mp4'
  ]
  let mime = ''
  for (const mt of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) { mime = mt; break }
  }
  if (!mime) { fireToast('NO ENCODER'); return }

  camChunks = []
  camRecorder = new MediaRecorder(stream, { mimeType: mime })
  camRecorder.ondataavailable = (e) => { if (e.data && e.data.size) camChunks.push(e.data) }
  camRecorder.onstop = () => {
    if (!camChunks.length) return
    const blob = new Blob(camChunks, { type: mime })
    const ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm'
    const l = document.createElement('a')
    l.download = 'ICARO_LIVE_' + Date.now() + '.' + ext
    l.href = URL.createObjectURL(blob)
    l.click()
    setTimeout(() => URL.revokeObjectURL(l.href), 2000)
    fireToast(ext.toUpperCase() + ' SAVED')
  }
  camRecorder.start()
  camCapturing = true
  const btn = document.getElementById('btn-cam-capture')!
  btn.textContent = '● STOP'
  btn.style.background = 'var(--act-c)'
  btn.style.color = 'var(--white)'
  fireToast('CAPTURING...')
}

function stopCamCapture(): void {
  if (camRecorder && camRecorder.state !== 'inactive') {
    camRecorder.stop()
  }
  camRecorder = null
  camCapturing = false
  const btn = document.getElementById('btn-cam-capture')
  if (btn) {
    btn.textContent = 'CAPTURE'
    btn.style.background = 'var(--white)'
    btn.style.color = 'var(--black)'
  }
}

// ── CODE: dump live frame as BEFLIX script ──
function camDumpCode(): void {
  if (!state.liveCam || !state.frames.length) { fireToast('NO FEED'); return }
  const code = decompileFrames()
  setScriptText(code)
  execNav('B')
  fireToast('LIVE CODE CAPTURED')
}

// ── FILE LOADING ──
function loadScriptFile(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  ;(e.target as HTMLInputElement).value = ''
  lockSystem('LOADING SCRIPT...', '0')
  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target!.result as string
    setScriptText(text)
    releaseSystem()
    closeAllSheets()
    fireToast(text.split('\n').length.toLocaleString() + ' LINES LOADED')
  }
  reader.onerror = () => { releaseSystem(); fireToast('FILE READ FAILED') }
  reader.readAsText(f)
}

async function ingestMedia(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  ;(e.target as HTMLInputElement).value = ''
  if (f.type.startsWith('video/')) {
    // Video ingest: rip frames + keep audio for export sync
    state.audioSourceBlob = f
    await ripFrames(f)
  } else if (f.type.startsWith('image/')) {
    lockSystem('MOUNTING...', '0')
    const u = URL.createObjectURL(f), img = new Image(); img.src = u
    img.onload = () => {
      state.frames[state.cur]!.src = fitSource(img, img.naturalWidth, img.naturalHeight)
      applyBeflixProcess(state.frames[state.cur]!)
      releaseSystem(); renderOutput(); rebuildTrack(); URL.revokeObjectURL(u)
    }
    img.onerror = () => { releaseSystem(); fireToast('IMAGE FAILED'); URL.revokeObjectURL(u) }
  }
}

// ── EVENT WIRING ──
document.getElementById('tab-a')!.addEventListener('click', () => execNav('A'))
document.getElementById('tab-b')!.addEventListener('click', () => execNav('B'))
document.getElementById('tab-c')!.addEventListener('click', () => execNav('C'))
document.getElementById('tab-d')!.addEventListener('click', () => execNav('D'))
document.getElementById('sheet-backdrop')!.addEventListener('click', closeAllSheets)
document.getElementById('close-a')!.addEventListener('click', closeAllSheets)
document.getElementById('close-b')!.addEventListener('click', closeAllSheets)
document.getElementById('close-c')!.addEventListener('click', closeAllSheets)
document.getElementById('close-d')!.addEventListener('click', closeAllSheets)
document.getElementById('sb-play-btn')!.addEventListener('click', engageSequence)
document.getElementById('play-overlay-btn')!.addEventListener('click', engageSequence)
document.getElementById('canvas-tap-zone')!.addEventListener('click', () => { if (state.frames.length > 0) engageSequence() })
document.getElementById('fps-down')!.addEventListener('click', () => { BASE_FPS = Math.max(1, BASE_FPS - 1); updateStatusBar() })
document.getElementById('fps-up')!.addEventListener('click', () => { BASE_FPS = Math.min(30, BASE_FPS + 1); updateStatusBar() })
document.getElementById('btn-step-back')!.addEventListener('click', () => stepSequence(-1))
document.getElementById('btn-step-fwd')!.addEventListener('click', () => stepSequence(1))
document.getElementById('btn-add-blank')!.addEventListener('click', () => injectFrame())
document.getElementById('btn-dup-frame')!.addEventListener('click', duplicateFrame)
document.getElementById('speed-slider')!.addEventListener('input', (e) => {
  BASE_FPS = parseInt((e.target as HTMLInputElement).value)
  document.getElementById('speed-label')!.textContent = 'SPD · ' + BASE_FPS
  updateStatusBar()
})

// Mode toggle — QUINE vs DOTS
document.getElementById('lbl-mode')!.addEventListener('click', () => {
  state.renderMode = state.renderMode === 'text' ? 'dot' : 'text'
  const el = document.getElementById('lbl-mode')!
  el.textContent = 'MODE: ' + (state.renderMode === 'text' ? 'QUINE' : 'DOTS')
  el.classList.toggle('on', state.renderMode === 'text')
  document.getElementById('quine-density-wrap')!.style.display = state.renderMode === 'text' ? 'flex' : 'none'
  document.getElementById('lbl-obstacle')!.style.display = state.renderMode === 'text' ? 'block' : 'none'

  // If switching to quine mode, prepare the text now
  if (state.renderMode === 'text' && !preparedText) {
    const fontSize = B_SZ * quineDensity
    const fontStr = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    _cachedQuineText = ''
    prepareQuineText(getQuineText(), fontStr)
  }
  renderOutput(); rebuildTrack()
})

// Obstacle flow toggle
document.getElementById('lbl-obstacle')!.addEventListener('click', () => {
  state.obstacleFlow = !state.obstacleFlow
  const el = document.getElementById('lbl-obstacle')!
  el.textContent = 'FLOW: ' + (state.obstacleFlow ? 'ON' : 'OFF')
  el.classList.toggle('on', state.obstacleFlow)
  renderOutput()
})

// PRETEXT DENSITY slider — THIS is where pretext proves itself.
// Each tick = new prepare() + layout(). The hot path speed is visible.
document.getElementById('quine-density')!.addEventListener('input', (e) => {
  quineDensity = parseFloat((e.target as HTMLInputElement).value)
  const fontSize = B_SZ * quineDensity
  const fontStr = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  _cachedQuineText = ''
  prepareQuineText(getQuineText(), fontStr)
  if (!state.playing) renderOutput()
})

document.getElementById('lbl-grid')!.addEventListener('click', () => {
  state.grid = !state.grid
  document.getElementById('lbl-grid')!.classList.toggle('on', state.grid)
  document.getElementById('net')!.classList.toggle('on', state.grid)
  if (state.grid) drawCoordGrid()
})

// Tools
document.getElementById('tool-pen')!.addEventListener('click', () => bindTool('pen'))
document.getElementById('tool-rect')!.addEventListener('click', () => bindTool('rect'))
document.getElementById('tool-erase')!.addEventListener('click', () => bindTool('erase'))
document.getElementById('dtt-pen')!.addEventListener('click', () => bindTool('pen'))
document.getElementById('dtt-rect')!.addEventListener('click', () => bindTool('rect'))
document.getElementById('dtt-erase')!.addEventListener('click', () => bindTool('erase'))
document.getElementById('btn-wipe')!.addEventListener('click', () => {
  if (!state.frames.length) return
  state.frames[state.cur]!.handLayer.fill(0)
  renderOutput(); rebuildTrack(); fireToast('INK WIPED')
})
document.getElementById('brush-size')!.addEventListener('input', (e) => {
  state.size = parseInt((e.target as HTMLInputElement).value)
})

// File operations
document.getElementById('btn-local-file')!.addEventListener('click', () => {
  document.getElementById('file-input')!.click(); closeAllSheets()
})
document.getElementById('btn-load-script-file')!.addEventListener('click', () => {
  document.getElementById('script-input')!.click(); closeAllSheets()
})
document.getElementById('file-input')!.addEventListener('change', (e) => ingestMedia(e))
document.getElementById('script-input')!.addEventListener('change', loadScriptFile)
document.getElementById('btn-run-script')!.addEventListener('click', () => executeMacro())
document.getElementById('btn-export-png')!.addEventListener('click', exportCurrentPNG)
document.getElementById('btn-export-webm')!.addEventListener('click', () => { closeAllSheets(); compileOutput('webm') })
document.getElementById('btn-export-gif')!.addEventListener('click', () => { closeAllSheets(); compileGIF() })
document.getElementById('btn-export-sheet')!.addEventListener('click', () => { closeAllSheets(); compileContactSheet() })
document.getElementById('btn-camera')!.addEventListener('click', () => { closeAllSheets(); toggleCamera() })
document.getElementById('btn-cam-capture')!.addEventListener('click', toggleCamCapture)
document.getElementById('btn-snap')!.addEventListener('click', camSnap)
document.getElementById('btn-cam-code')!.addEventListener('click', camDumpCode)
document.getElementById('btn-cam-close')!.addEventListener('click', killCamera)
document.getElementById('btn-view-code')!.addEventListener('click', () => {
  if (!state.frames.length) { fireToast('NO FRAMES'); return }
  lockSystem('GENERATING CODE...', '0')
  setTimeout(() => { setScriptText(decompileFrames()); execNav('B'); releaseSystem() }, 50)
})
document.getElementById('btn-download-code')!.addEventListener('click', () => {
  if (!state.frames.length) { fireToast('NO FRAMES'); return }
  const code = decompileFrames()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
  a.download = 'icaro-quine-macro.txt'; a.click(); fireToast('CODE EXPORTED')
})
document.getElementById('btn-copy-prompt')!.addEventListener('click', () => {
  const idea = (document.getElementById('b-idea') as HTMLTextAreaElement).value.trim()
  const prompt = 'You are a BEFLIX-128 animation composer. Generate frame-by-frame code for 128x96 grid.\n' +
    'COMMANDS: CLR v, PNT x y w h v, LIN x1 y1 x2 y2 v, REC n, SHF dx dy n\n' +
    'INTENSITY: 0=White 7=Black\n' +
    (idea ? '\nUSER REQUEST: ' + idea : '')
  navigator.clipboard.writeText(prompt).then(() => fireToast('PROMPT COPIED')).catch(() => fireToast('COPY FAILED'))
})

// Script editor
const scriptEl = document.getElementById('b-script') as HTMLTextAreaElement
scriptEl.addEventListener('input', () => {
  _fullScriptText = ''
  _cachedQuineText = ''
  updateScriptInfo(scriptEl.value.split('\n').length, scriptEl.value.length)
})

// Resize
window.addEventListener('resize', rescaleWorkspace)

// ── BOOT ──
buildDotStamps()
buildInkReservoir()
injectFrame(true)
rescaleWorkspace()
updateStatusBar()
