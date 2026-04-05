import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '../../src/layout.ts'

// ── DATA DEFINITION ──────────────────────────────────────────────────────

type ParaData = {
  id: string
  text: string
  source: 'manifesto' | 'geertz'
}

type PreparedPara = ParaData & {
  prepared: PreparedTextWithSegments
}

const PARAGRAPHS: ParaData[] = [
  {
    id: 'p1',
    source: 'manifesto',
    text: 'HYPERSTITION IDENTITY: The Co-Evolved Mind. Mind, brain, and culture are not distinct entities but a single, co-evolving cybernetic landscape where symbolic reality physically wires neural architecture.'
  },
  {
    id: 'p2',
    source: 'manifesto',
    text: 'CENTRAL QUESTION: Can the conceptual dissolution of the mind-body-culture boundary materially reorganize scientific infrastructure, technological development, and human self-perception? The reality claim is performative.'
  },
  {
    id: 'p3',
    source: 'geertz',
    text: 'Between them, anthropology and psychology have chosen two of the more improbable objects around which to try to build a positive science: Culture and Mind. Both are inheritances of defunct philosophies, both have checkered histories of ideological inflation and rhetorical abuse. They have been repeatedly condemned as mystical or metaphysical, repeatedly banished from the disciplined precincts of serious inquiry, repeatedly refused to go away.'
  },
  {
    id: 'p4',
    source: 'geertz',
    text: 'When they are coupled, the difficulties do not merely add, they explode. The abandonment of the notion that the homo sapiens brain is capable of autonomous functioning, that it can operate effectively as an endogenously driven, context-independent system, is a necessary first step.'
  },
  {
    id: 'p5',
    source: 'geertz',
    text: 'Our brains are not in a vat, but in our bodies. Our minds are not in our bodies, but in the world. And as for the world, it is not in our brains, our bodies, or our minds: they are, along with gods, verbs, rocks, and politics, in it.'
  },
  {
    id: 'p6',
    source: 'manifesto',
    text: 'FOUR PILLARS: The human infant is functionally incomplete, requiring cultural software to finalize its biological hardware. This productive power forces disparate academic matrices to merge, shifting the locus of inquiry from the skull to the world.'
  },
  {
    id: 'p7',
    source: 'manifesto',
    text: 'As humans adopt the vocabulary of embodied cultural emotion—such as Antonio Damasio\'s somatic markers—they begin to consciously perform, experience, and regulate their biology through this integrated script, fulfilling the retrocausal theory.'
  },
  {
    id: 'p8',
    source: 'manifesto',
    text: 'CYBERNETIC FEEDBACK LOOP: The fiction of a seamless brain-culture landscape is introduced to solve disciplinary dead-ends. Researchers invest attention and capital into mapping emotion as both a literal lesion and a literary trope.'
  },
  {
    id: 'p9',
    source: 'geertz',
    text: 'We are witnessing an increasingly rapid proliferation of disciplinary matrices—loose assemblages of techniques, vocabularies, assumptions, and exemplary achievements that bear with intensifying force upon the direction of one another\'s development.'
  },
  {
    id: 'p10',
    source: 'geertz',
    text: 'Constitutive of one another, reciprocally constructive, they must be treated as such—as complements, not levels; aspects, not entities; landscapes, not realms.'
  },
  {
    id: 'p11',
    source: 'manifesto',
    text: 'THE INFRASTRUCTURE OF REALIZATION: Public research grants, fMRI visualizations mapped to behavioral stimuli, and cross-disciplinary databases form the capital and technical inputs. The retrocausal signature is clear: the inevitably interconnected future demands the dismantling of the 19th-century Cartesian silos in the present.'
  }
]

// ── FONTS & STYLING ──────────────────────────────────────────────────────

const FONTS = {
  manifesto: '400 13px/1.6 "JetBrains Mono", "SF Mono", monospace',
  geertz: '400 21px/1.4 "Cormorant Garamond", Georgia, serif'
}

const LINE_HEIGHTS = {
  manifesto: 24,
  geertz: 32
}

const HIGHLIGHT_REGEX = /\b(culture|cultural|brain|neural|somatic|cybernetic|Cartesian|infrastructure|biology|mind)\b/gi

function highlightKeywords(text: string): string {
  return text.replace(HIGHLIGHT_REGEX, (match) => {
    const lower = match.toLowerCase()
    let variant = ''
    if (lower === 'culture' || lower === 'cultural') variant = ' kw--culture'
    else if (lower === 'brain' || lower === 'neural' || lower === 'somatic' || lower === 'biology') variant = ' kw--brain'
    
    return `<span class="kw${variant}">${match}</span>`
  })
}

// ── STATE & CACHE ────────────────────────────────────────────────────────

const state = {
  colWidth: 600,
  colGap: 80,
  preparedParas: [] as PreparedPara[],
  rafId: null as number | null
}

const dom = {
  container: document.getElementById('document-container') as HTMLDivElement,
  svg: document.getElementById('wiring-overlay') as unknown as SVGSVGElement,
  sliderWidth: document.getElementById('param-width') as HTMLInputElement,
  sliderGap: document.getElementById('param-gap') as HTMLInputElement,
  valWidth: document.getElementById('val-width') as HTMLSpanElement,
  valGap: document.getElementById('val-gap') as HTMLSpanElement
}

// ── INITIALIZATION ───────────────────────────────────────────────────────

function init() {
  // 1. Prepare all texts
  for (const p of PARAGRAPHS) {
    state.preparedParas.push({
      ...p,
      prepared: prepareWithSegments(p.text, FONTS[p.source])
    })
  }

  // 2. Bind events
  dom.sliderWidth.addEventListener('input', () => {
    state.colWidth = Number.parseInt(dom.sliderWidth.value, 10)
    dom.valWidth.textContent = `${state.colWidth}px`
    scheduleRender()
  })

  dom.sliderGap.addEventListener('input', () => {
    state.colGap = Number.parseInt(dom.sliderGap.value, 10)
    dom.valGap.textContent = `${state.colGap}px`
    scheduleRender()
  })

  window.addEventListener('resize', scheduleRender)

  // 3. Kick off first render
  scheduleRender()
}

// ── RENDER PIPELINE ──────────────────────────────────────────────────────

function scheduleRender() {
  if (state.rafId !== null) return
  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    render()
  })
}

function render() {
  const width = state.colWidth
  const gap = state.colGap
  
  // Clear old DOM
  dom.container.textContent = ''
  dom.svg.innerHTML = ''
  
  const availableHeight = Math.max(800, window.innerHeight - 120) // Multi-column threshold

  const fragment = document.createDocumentFragment()
  
  let xOffset = 0
  let yOffset = 0

  for (let i = 0; i < state.preparedParas.length; i++) {
    const p = state.preparedParas[i]!
    const lh = LINE_HEIGHTS[p.source]
    
    // Check if we need to wrap to the next column BEFORE lay outing
    // A rough guess, if we are extremely close to the bottom
    if (yOffset > 0 && yOffset + (lh * 4) > availableHeight) {
      yOffset = 0
      xOffset += width + gap
    }

    const { lines } = layoutWithLines(p.prepared, width, lh)

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx]!
      
      // Strict multi-column wrap
      if (yOffset + lh > availableHeight) {
        yOffset = 0
        xOffset += width + gap
      }

      const el = document.createElement('div')
      el.className = `text-line text-line--${p.source}`
      el.style.left = `${xOffset}px`
      el.style.top = `${yOffset}px`
      el.style.width = `${width}px` // Lock width for justification if needed
      
      // Inject highlighted spans instead of plain textContent
      el.innerHTML = highlightKeywords(line.text)
      
      fragment.appendChild(el)
      yOffset += lh
    }
    
    // Paragraph mark (horizontal rule)
    if (i < state.preparedParas.length - 1) {
      if (yOffset + 40 > availableHeight) {
        yOffset = 0
        xOffset += width + gap
      }
      const mark = document.createElement('div')
      mark.className = 'para-mark'
      mark.style.left = `${xOffset}px`
      mark.style.top = `${yOffset + 12}px`
      fragment.appendChild(mark)
      
      yOffset += 40 // Gap between paragraphs
    }
  }

  // Expand container width based on max xOffset
  const totalWidth = xOffset + width
  dom.container.style.width = `${totalWidth}px`
  dom.container.style.height = `${availableHeight}px`
  dom.svg.style.width = `${totalWidth}px`
  dom.svg.style.height = `${availableHeight}px`
  
  dom.container.appendChild(fragment)

  // ── 2. SVG WIRING PASS ──────────────────────────────────────────────────
  // Now that DOM is laid out, we discover all `.kw` spans and draw paths between them.
  // Delay slightly to ensure browser computed layout is ready
  requestAnimationFrame(() => drawWiring())
}

function drawWiring() {
  const spans = Array.from(dom.container.querySelectorAll<HTMLSpanElement>('.kw'))
  const containerRect = dom.container.getBoundingClientRect()
  
  if (spans.length < 2) return

  let svgHtml = ''

  for (let i = 0; i < spans.length - 1; i++) {
    const s1 = spans[i]!
    const s2 = spans[i + 1]!
    
    const r1 = s1.getBoundingClientRect()
    const r2 = s2.getBoundingClientRect()

    // Calculate center relative to SVG container
    const x1 = (r1.left - containerRect.left) + (r1.width / 2)
    const y1 = (r1.top - containerRect.top) + (r1.height / 2)
    
    const x2 = (r2.left - containerRect.left) + (r2.width / 2)
    const y2 = (r2.top - containerRect.top) + (r2.height / 2)

    const dx = Math.abs(x2 - x1)
    
    // Create a smooth bezier curve
    // If they are in the same column (dx is small), use tight curves
    // If they span columns, use wide flowing curves
    const controlP = dx < 100 ? 40 : dx * 0.4 
    
    const pathData = `M ${x1} ${y1} C ${x1 + controlP} ${y1}, ${x2 - controlP} ${y2}, ${x2} ${y2}`
    
    // Determine link strength / styling
    const kw1 = s1.textContent?.toLowerCase() || ''
    const kw2 = s2.textContent?.toLowerCase() || ''
    
    const isStrong = (kw1 === 'culture' && kw2 === 'brain') || (kw1 === 'brain' && kw2 === 'culture')
    const className = isStrong ? 'connection-path connection-path--strong' : 'connection-path'

    svgHtml += `<path class="${className}" d="${pathData}" />`
  }

  dom.svg.innerHTML = svgHtml
}

// Boot
init()
