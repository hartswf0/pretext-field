import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

// ── Geertz preface text ────────────────────────────────────────────────

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

// ── Marginalia — associative thoughts triggered by paragraphs ──────────

type ThoughtSpec = {
  paraIndex: number     // which paragraph triggers this thought
  label: string
  text: string
}

const THOUGHTS: ThoughtSpec[] = [
  {
    paraIndex: 0,
    label: 'Association',
    text: 'If borders can\'t be drawn between anthropology and philosophy, what about between <em>reading</em> and <em>thinking</em>? Where does one end and the other begin?',
  },
  {
    paraIndex: 1,
    label: 'Wandering thought',
    text: 'Fragile and under siege — like attention itself in the age of notifications. The interlopers are apps, feeds, pings.',
  },
  {
    paraIndex: 2,
    label: 'Epiphany',
    text: 'Every discipline that "breaks away" started as a question someone couldn\'t stop asking. What questions are you sitting with right now?',
  },
  {
    paraIndex: 3,
    label: 'Peripheral vision',
    text: 'The "stirred up and trackless postmodern seas" — this is exactly the feeling of <em>lantern consciousness</em>. Everything at once, directionless but alive.',
  },
  {
    paraIndex: 4,
    label: 'Personal note',
    text: '"I don\'t do systems." What a confession. What would it mean to read without trying to systematize? To just… receive?',
  },
  {
    paraIndex: 5,
    label: 'Creative leap',
    text: 'The singularities of other peoples\' ways-of-life. Each book you\'ve read is a singularity. Each sentence in this one is a small world.',
  },
  {
    paraIndex: 6,
    label: 'Cross-reference',
    text: 'Wittgenstein\'s "language games" — reading itself is a language game. The rules change when you let the lantern widen.',
  },
  {
    paraIndex: 7,
    label: 'The rough ground',
    text: '"We want to walk: so we need friction." The friction of the physical page, the weight of the book in your hands. That\'s the scaffold.',
  },
]

// ── Configuration ──────────────────────────────────────────────────────

const FONT = '400 19px "Cormorant Garamond", Georgia, "Times New Roman", serif'
const LINE_HEIGHT = 32
const PARA_GAP = 28
const DEFAULT_WIDTH = 560
const MIN_WIDTH = 360
const MAX_WIDTH = 680

// ── Types ──────────────────────────────────────────────────────────────

type ParaPrepared = {
  prepared: PreparedTextWithSegments
  text: string
}

type ParaLayout = {
  yStart: number
  lineCount: number
}

type State = {
  columnWidth: number
  wanderMode: boolean
  events: {
    sliderValue: number | null
  }
}

// ── DOM cache ──────────────────────────────────────────────────────────

const domCache = {
  root: document.documentElement,
  readingBody: getRequired('reading-body'),
  margins: getRequired('margins'),
  widthSlider: getRequiredInput('width-slider'),
  widthValue: getRequired('width-value'),
  wanderBtn: getRequired('wander-btn'),
  epiphanyFlash: getRequired('epiphany-flash'),
  particlesContainer: getRequired('particles-container'),
}

// ── Prepare paragraphs ─────────────────────────────────────────────────

const paragraphs: ParaPrepared[] = PARAGRAPHS.map(text => ({
  prepared: prepareWithSegments(text, FONT),
  text,
}))

// ── State ──────────────────────────────────────────────────────────────

const st: State = {
  columnWidth: DEFAULT_WIDTH,
  wanderMode: false,
  events: {
    sliderValue: null,
  },
}

let scheduledRaf: number | null = null
let wanderParticlesCreated = false

// ── Events ─────────────────────────────────────────────────────────────

domCache.widthSlider.addEventListener('input', () => {
  st.events.sliderValue = Number.parseInt(
    (domCache.widthSlider as HTMLInputElement).value,
    10,
  )
  scheduleRender()
})

domCache.wanderBtn.addEventListener('click', () => {
  st.wanderMode = !st.wanderMode
  if (st.wanderMode) {
    triggerEpiphany()
    if (!wanderParticlesCreated) createWanderParticles()
  }
  scheduleRender()
})

window.addEventListener('resize', () => scheduleRender())
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
  scheduledRaf = requestAnimationFrame(function renderLanternFrame() {
    scheduledRaf = null
    render()
  })
}

function triggerEpiphany(): void {
  // Random position for the glow origin
  domCache.epiphanyFlash.style.setProperty('--flash-x', `${30 + Math.random() * 40}%`)
  domCache.epiphanyFlash.style.setProperty('--flash-y', `${20 + Math.random() * 60}%`)
  domCache.epiphanyFlash.classList.add('epiphany-flash--active')
  setTimeout(() => {
    domCache.epiphanyFlash.classList.remove('epiphany-flash--active')
  }, 800)
}

function createWanderParticles(): void {
  wanderParticlesCreated = true
  const container = domCache.particlesContainer
  for (let i = 0; i < 6; i++) {
    const particle = document.createElement('div')
    particle.className = 'wander-particle'
    const size = 40 + Math.random() * 80
    particle.style.width = `${size}px`
    particle.style.height = `${size}px`
    particle.style.left = `${10 + Math.random() * 80}%`
    particle.style.top = `${10 + Math.random() * 80}%`
    particle.style.animationDelay = `${Math.random() * -12}s`
    particle.style.animationDuration = `${10 + Math.random() * 8}s`
    container.appendChild(particle)
  }
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
  const paraLayouts: ParaLayout[] = []

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx]!
    const { lines } = layoutWithLines(para.prepared, columnWidth, LINE_HEIGHT)

    const paraYStart = yOffset

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx]!
      const lineEl = document.createElement('div')
      lineEl.className = 'reading-line'
      lineEl.style.top = `${yOffset}px`
      lineEl.textContent = line.text
      fragment.appendChild(lineEl)
      yOffset += LINE_HEIGHT
    }

    paraLayouts.push({ yStart: paraYStart, lineCount: lines.length })

    // Paragraph gap
    if (pIdx < paragraphs.length - 1) {
      const gap = document.createElement('div')
      gap.className = 'para-gap'
      gap.style.top = `${yOffset + PARA_GAP / 2}px`
      fragment.appendChild(gap)
      yOffset += PARA_GAP
    }
  }

  // Commit reading body
  domCache.readingBody.textContent = ''
  domCache.readingBody.style.height = `${yOffset}px`
  domCache.readingBody.style.width = `${columnWidth}px`
  domCache.readingBody.appendChild(fragment)

  // Update CSS
  domCache.root.style.setProperty('--column-width', `${columnWidth}px`)

  // Update wander button
  domCache.wanderBtn.classList.toggle('wander-btn--active', st.wanderMode)
  domCache.wanderBtn.textContent = st.wanderMode ? 'Mind Wandering' : 'Let Mind Wander'

  // Toggle particles visibility
  domCache.particlesContainer.style.display = st.wanderMode ? 'block' : 'none'

  // Render marginalia — positioned relative to the paragraph that triggers each
  renderMarginalia(paraLayouts)
}

function renderMarginalia(paraLayouts: ParaLayout[]): void {
  const marginsEl = domCache.margins
  marginsEl.textContent = ''
  const fragment = document.createDocumentFragment()

  // Determine which thoughts are visible based on scroll position
  const viewportHeight = window.innerHeight

  for (const thought of THOUGHTS) {
    const layout = paraLayouts[thought.paraIndex]
    if (layout === undefined) continue

    const thoughtEl = document.createElement('div')
    thoughtEl.className = 'thought'
    thoughtEl.style.top = `${layout.yStart + 60}px`

    // Check if this paragraph is roughly in view
    const readingBody = domCache.readingBody
    const bodyRect = readingBody.getBoundingClientRect()
    const paraScreenY = bodyRect.top + layout.yStart
    const isInView = paraScreenY > -200 && paraScreenY < viewportHeight + 100

    if (isInView || st.wanderMode) {
      thoughtEl.classList.add('thought--visible')
    }

    const labelSpan = document.createElement('span')
    labelSpan.className = 'thought-label'
    labelSpan.textContent = thought.label

    const textSpan = document.createElement('span')
    textSpan.innerHTML = thought.text

    thoughtEl.appendChild(labelSpan)
    thoughtEl.appendChild(textSpan)
    fragment.appendChild(thoughtEl)
  }

  marginsEl.appendChild(fragment)
}
