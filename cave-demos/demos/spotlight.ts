import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

// ── Geertz preface text ────────────────────────────────────────────────
// Extracted from preface.md, split into paragraphs

const PARAGRAPHS = [
  `As befits two disciplines, neither of which is clearly defined and both of which address themselves to the whole of human life and thought, anthropology and philosophy are more than a little suspicious of one another. The anxiety that comes with a combination of a diffuse and miscellaneous academic identity and an ambition to connect just about everything with everything else and get, thereby, to the bottom of things leaves both of them unsure as to which of them should be doing what. It is not that their borders overlap, it is that they have no borders anyone can, with any assurance, draw. It is not that their interests diverge, it is that nothing, apparently, is alien to either of them.`,

  `Beyond their normally oblique and implicit competition for the last word and the first, the two fields share a number of other characteristics that trouble their relations with one another and make cooperation between them unnecessarily difficult. Most especially, both of them are porous and imperiled, fragile and under siege. They find themselves, these days, repeatedly invaded and imposed upon by interlopers claiming to do their job in a more effective manner than they themselves, trapped in inertial rigidities, are able to do it.`,

  `For philosophy this is an old story. Its history consists of one after another of its protectorates and principalities—mathematics, physics, biology, psychology, latterly even logic and epistemology—breaking away to become independent, self-governing special sciences. For anthropology, this contraction of imperium under separatist pressure is more recent and less orderly, but it is no less severe.`,

  `Yet, the attempt to so interact and so combine remains well worth making. Not only are the fears exaggerated and the suspicions ungrounded (neither field is about to go away quite yet, and they are less opposed in either style or temper than their louder champions like to imagine), but the stirred up and trackless postmodern seas they are now indeed alike passing through makes them, more and more, in active need of one another. The end is not nigh, or anywhere near, for either enterprise. But aimlessness, a baffled wandering in search of direction and rationale, is.`,

  `My own interest in effecting a connection, or strengthening one, or, thinking of Montaigne or Montesquieu, perhaps reviving one, stems not from any interest in altering my professional identity, with which I am as comfortable as could be expected after fifty years struggling to establish it, nor in widening it out to some sort of higher-order thinker-without-portfolio. I am an ethnographer, and a writer about ethnography, from beginning to end; and I don't do systems.`,

  `Paradoxically, relating the sort of work I do—ferreting out the singularities of other peoples' ways-of-life—to that philosophers, or at least the sort of philosophers who interest me, do—examining the reach and structure of human experience, and the point of it all—is in many ways easier today than it was in the late forties when I imagined myself headed for a philosopher's career.`,

  `The main figure making this shift possible, if not causing it, is, again in my view, that posthumous and mind-clearing insurrectionist, "The Later Wittgenstein." The appearance in 1953, two years after his death, of Philosophical Investigations, and the transformation of what had been but rumors out of Oxbridge into an apparently endlessly generative text, had an enormous impact upon my sense of what I was about and what I hoped to accomplish.`,

  `The way in which the gap was narrowed, or perhaps only located and described, is suggested by what, for a working anthropologist, is the most inviting of the tags just listed: "Back to the rough ground!" "We have got," Wittgenstein wrote, "on to slippery ice where there is no friction and so in a certain sense conditions are ideal, but also, just because of that, we are unable to walk. We want to walk: so we need friction. Back to the rough ground!"`,
]

// ── Configuration ──────────────────────────────────────────────────────

const FONT = '400 18px "EB Garamond", Georgia, "Times New Roman", serif'
const LINE_HEIGHT = 30
const PARA_GAP = 22
const DEFAULT_WIDTH = 530
const MIN_WIDTH = 320
const MAX_WIDTH = 680
const FOCUS_BAND = 5      // how many lines around cursor are "in focus"
const NEAR_BAND = 3       // additional lines that are "near"

// ── Types ──────────────────────────────────────────────────────────────

type ParaPrepared = {
  prepared: PreparedTextWithSegments
  text: string
}

type State = {
  columnWidth: number
  focusLineIndex: number
  deepFocus: boolean
  totalLineCount: number
  events: {
    sliderValue: number | null
  }
}

// ── DOM cache ──────────────────────────────────────────────────────────

const domCache = {
  root: document.documentElement,
  vignette: getRequired('vignette'),
  meterFill: getRequired('meter-fill'),
  readingBody: getRequired('reading-body'),
  widthSlider: getRequiredInput('width-slider'),
  widthValue: getRequired('width-value'),
  focusToggle: getRequired('focus-toggle'),
  progressThumb: getRequired('progress-thumb'),
  progressTrack: getRequired('progress-track'),
}

// ── Prepare all paragraphs ────────────────────────────────────────────

const paragraphs: ParaPrepared[] = PARAGRAPHS.map(text => ({
  prepared: prepareWithSegments(text, FONT),
  text,
}))

// ── State ──────────────────────────────────────────────────────────────

const st: State = {
  columnWidth: DEFAULT_WIDTH,
  focusLineIndex: 0,
  deepFocus: false,
  totalLineCount: 0,
  events: {
    sliderValue: null,
  },
}

let scheduledRaf: number | null = null

// ── Events ─────────────────────────────────────────────────────────────

domCache.widthSlider.addEventListener('input', () => {
  st.events.sliderValue = Number.parseInt(
    (domCache.widthSlider as HTMLInputElement).value,
    10,
  )
  scheduleRender()
})

domCache.focusToggle.addEventListener('click', () => {
  st.deepFocus = !st.deepFocus
  scheduleRender()
})

window.addEventListener('resize', () => scheduleRender())

// Track mouse position for spotlight effect
document.addEventListener('mousemove', (e) => {
  const body = domCache.readingBody
  const rect = body.getBoundingClientRect()
  if (rect.height === 0) return
  const relativeY = e.clientY - rect.top + window.scrollY - body.offsetTop
  const lineIndex = Math.max(0, Math.floor(relativeY / LINE_HEIGHT))
  if (lineIndex !== st.focusLineIndex) {
    st.focusLineIndex = lineIndex
    scheduleRender()
  }
})

// Track scroll for progress
window.addEventListener('scroll', () => scheduleRender(), { passive: true })

scheduleRender()

// ── Helpers ────────────────────────────────────────────────────────────

function getRequired(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`#${id} not found`)
  return el
}

function getRequiredInput(id: string): HTMLInputElement {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} not found`)
  return el
}

function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderSpotlightFrame() {
    scheduledRaf = null
    render()
  })
}

// ── Render ──────────────────────────────────────────────────────────────

function render(): void {
  // Handle width changes
  let columnWidth = st.columnWidth
  if (st.events.sliderValue !== null) columnWidth = st.events.sliderValue
  const viewportWidth = document.documentElement.clientWidth
  const maxAllowed = Math.min(MAX_WIDTH, viewportWidth - 48)
  columnWidth = Math.max(MIN_WIDTH, Math.min(maxAllowed, columnWidth))
  st.columnWidth = columnWidth
  st.events.sliderValue = null

  // Update slider
  const slider = domCache.widthSlider as HTMLInputElement
  slider.max = String(maxAllowed)
  slider.value = String(columnWidth)
  domCache.widthValue.textContent = `${Math.round(columnWidth)}px`

  // Layout all paragraphs
  const fragment = document.createDocumentFragment()
  let yOffset = 0
  let globalLineIndex = 0
  const allLineElements: HTMLElement[] = []

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx]!
    const { lines } = layoutWithLines(para.prepared, columnWidth, LINE_HEIGHT)

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx]!
      const lineEl = document.createElement('div')
      lineEl.className = 'reading-line'
      lineEl.style.top = `${yOffset}px`
      lineEl.textContent = line.text

      // Apply spotlight classes
      const dist = Math.abs(globalLineIndex - st.focusLineIndex)
      if (st.deepFocus) {
        if (dist === 0) {
          lineEl.classList.add('reading-line--focus')
        } else if (dist <= NEAR_BAND) {
          lineEl.classList.add('reading-line--near')
        } else {
          lineEl.classList.add('reading-line--dim')
        }
      } else {
        if (dist <= FOCUS_BAND) {
          lineEl.classList.add('reading-line--focus')
        } else if (dist <= FOCUS_BAND + NEAR_BAND) {
          lineEl.classList.add('reading-line--near')
        } else {
          lineEl.classList.add('reading-line--dim')
        }
      }

      fragment.appendChild(lineEl)
      allLineElements.push(lineEl)
      yOffset += LINE_HEIGHT
      globalLineIndex++
    }

    // Paragraph gap
    if (pIdx < paragraphs.length - 1) {
      const gap = document.createElement('div')
      gap.className = 'para-gap'
      gap.style.top = `${yOffset + PARA_GAP / 2}px`
      fragment.appendChild(gap)
      yOffset += PARA_GAP
    }
  }

  st.totalLineCount = globalLineIndex

  // Commit DOM
  domCache.readingBody.textContent = ''
  domCache.readingBody.style.height = `${yOffset}px`
  domCache.readingBody.style.width = `${columnWidth}px`
  domCache.readingBody.appendChild(fragment)

  // Update CSS custom property for page width
  domCache.root.style.setProperty('--column-width', `${columnWidth}px`)

  // Update focus toggle state
  domCache.focusToggle.classList.toggle('focus-toggle--active', st.deepFocus)
  domCache.focusToggle.textContent = st.deepFocus ? 'Spotlight On' : 'Deep Focus'

  // Update vignette
  domCache.vignette.classList.toggle('vignette--deep', st.deepFocus)

  // Update focus meter
  const focusDepth = st.deepFocus ? 92 : Math.min(100, (st.focusLineIndex / Math.max(1, st.totalLineCount)) * 100)
  domCache.meterFill.style.width = `${focusDepth}%`

  // Update progress thumb
  const scrollTop = window.scrollY
  const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const scrollRatio = Math.min(1, scrollTop / docHeight)
  const trackHeight = domCache.progressTrack.offsetHeight
  domCache.progressThumb.style.top = `${scrollRatio * (trackHeight - 7)}px`
}
