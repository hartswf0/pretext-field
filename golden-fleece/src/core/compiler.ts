// ══════════════════════════════════════════════════════════════
// LAYER 2: THE WORLDTEXT COMPILER
//
// Headless ingestion pipeline. Takes raw text strings and outputs
// typed, interconnected WorldNode[] topologies.
//
// This is the /wt compiler from Twine Bridge, extracted and
// cleaned into a pure function with zero DOM dependencies.
//
// Two modes:
//   1. STRUCTURAL PARSE — regex-based, no LLM required.
//      Detects WorldText format (location <X>, entity <Y>, etc.)
//      and falls back to NLP heuristics for freeform text.
//
//   2. LLM COMPILE — sends text to an LLM with the WorldText
//      Generator prompt, then parses the structured output.
//      (Requires API key — mocked in tests.)
// ══════════════════════════════════════════════════════════════

import {
  type WorldNode,
  type WorldGraph,
  type WLESCategory,
  type BlockFormat,
  createNode,
  createGraph,
  addNode,
  connectNodes,
  detectBlockFormat,
} from './worldnode.js'

// ── EXTRACTION RESULT ──
export interface CompilationResult {
  graph: WorldGraph
  worldName: string
  counts: {
    locations: number
    entities: number
    states: number
    events: number
    relations: number
  }
  raw?: string  // The raw WorldText output (from LLM or input)
}

// ── STRUCTURAL PARSER ──
// Parses WorldText format directly without LLM.
// Handles both the canonical format and freeform markdown.

interface ExtractedRelation {
  verb: string
  from: string
  to: string
}

interface RawExtraction {
  worldName: string
  locations: { name: string; description?: string }[]
  entities: { name: string; type: string }[]
  relations: ExtractedRelation[]
  states: { key: string; value: string }[]
  events: string[]
}

/** Parse WorldText format into raw extractions */
export function extractWorldText(input: string): RawExtraction {
  const result: RawExtraction = {
    worldName: 'Compiled',
    locations: [],
    entities: [],
    relations: [],
    states: [],
    events: [],
  }

  // Normalize delimiters — pipes and semicolons become newlines
  const norm = input.replace(/\|/g, '\n').replace(/;\s*/g, '\n')

  // World name
  const wnMatch = norm.match(/world\s+<?([^>{\n]+)>?/)
  if (wnMatch) result.worldName = wnMatch[1]!.trim()

  // Locations (L → inverter) — with optional { description: "..." }
  const locReg = /location\s+<?([^>{}|\n]+)>?(?:\s*\{\s*description:\s*"([^"]*)"\s*\})?/gi
  let m: RegExpExecArray | null
  while ((m = locReg.exec(norm)) !== null) {
    const n = m[1]!.trim()
    if (n.length > 1) result.locations.push({ name: n, description: m[2]?.trim() })
  }

  // Entities (E → aphorist) — type is optional
  const entReg = /entity\s+<?([^>{}|\n:]+)>?(?:\s*:\s*(\w+))?/gi
  while ((m = entReg.exec(norm)) !== null) {
    const n = m[1]!.trim()
    if (n.length > 1) result.entities.push({ name: n, type: m[2] || 'unknown' })
  }

  // Relations — [verb](A -> B)
  const relReg = /rel\s+\[([^\]]+)\]\s*\(?<?([^>\s,)]+)>?\s*->\s*<?([^>\s,)]+)>?\)?/gi
  while ((m = relReg.exec(norm)) !== null) {
    result.relations.push({
      verb: m[1]!.trim(),
      from: m[2]!.trim(),
      to: m[3]!.trim(),
    })
  }

  // States (S → analyst)
  const stReg = /state\s+<?([^>=|\n]+)>?\s*=\s*([^|\n{}]+)/gi
  while ((m = stReg.exec(norm)) !== null) {
    result.states.push({ key: m[1]!.trim(), value: m[2]!.trim() })
  }

  // Events (W → site)
  const evReg = /event\s+<?([^>{}|\n]+)>?/gi
  while ((m = evReg.exec(norm)) !== null) {
    const n = m[1]!.trim()
    if (n.length > 1) result.events.push(n)
  }

  // Rules → treated as events
  const ruReg = /rule\s+<?([^>{}|\n]+)>?/gi
  while ((m = ruReg.exec(norm)) !== null) {
    const n = m[1]!.trim()
    if (n.length > 1) result.events.push('⚙ ' + n)
  }

  // Fallback: angle-bracket tokens as entities
  const total = result.locations.length + result.entities.length +
                result.states.length + result.events.length
  if (total === 0) {
    const abReg = /<([A-Z][A-Za-z0-9_ ]+)>/g
    while ((m = abReg.exec(input)) !== null) {
      const name = m[1]!.trim()
      if (!result.entities.find(e => e.name === name)) {
        result.entities.push({ name, type: 'extracted' })
      }
    }
  }

  return result
}

/** 
 * Freeform markdown parser — for text that is NOT in WorldText format.
 * Uses NLP heuristics to extract structure from prose.
 */
export function extractFreeform(input: string): RawExtraction {
  const result: RawExtraction = {
    worldName: 'Freeform',
    locations: [],
    entities: [],
    relations: [],
    states: [],
    events: [],
  }

  const lines = input.split('\n').filter(l => l.trim().length > 0)

  // First h1 becomes world name
  for (const line of lines) {
    if (line.startsWith('# ')) {
      result.worldName = line.slice(2).trim()
      break
    }
  }

  // Proper nouns heuristic — capitalized multi-word sequences
  const properNouns = new Set<string>()
  const pnReg = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
  let m: RegExpExecArray | null
  while ((m = pnReg.exec(input)) !== null) {
    const name = m[1]!
    // Filter out common sentence starters and short words
    if (name.length > 3 && !COMMON_STARTERS.has(name)) {
      properNouns.add(name)
    }
  }

  // Classify proper nouns by context
  for (const name of properNouns) {
    const lower = name.toLowerCase()
    const ctx = input.toLowerCase()
    
    // Location heuristics
    if (ctx.includes(`in ${lower}`) || ctx.includes(`at ${lower}`) ||
        ctx.includes(`to ${lower}`) || ctx.includes(`from ${lower}`)) {
      result.locations.push({ name, description: undefined })
    }
    // Entity by default
    else {
      result.entities.push({ name, type: 'proper_noun' })
    }
  }

  // Extract quoted strings as notable states
  const quoteReg = /"([^"]{5,80})"/g
  while ((m = quoteReg.exec(input)) !== null) {
    result.states.push({ key: 'quote', value: m[1]! })
  }

  return result
}

const COMMON_STARTERS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'There', 'They',
  'What', 'When', 'Where', 'Which', 'While', 'With',
  'How', 'However', 'Here', 'His', 'Her',
  'But', 'Because', 'Before', 'Between',
  'Each', 'Every', 'Even',
  'For', 'From', 'First',
  'Its', 'Into',
  'Most', 'Many', 'More',
  'Not', 'Now', 'Next',
  'One', 'Our', 'Other',
  'She', 'Some', 'Such',
  'Very',
])

// ══════════════════════════════════════════════════════════════
// COMPILATION — Raw Extraction → WorldGraph
// ══════════════════════════════════════════════════════════════

/** Convert raw extractions into a typed WorldGraph */
export function compileExtraction(
  extraction: RawExtraction,
  sourceId?: string,
): CompilationResult {
  const graph = createGraph(extraction.worldName)

  // ── ROOT NODE ──
  const root = createNode(extraction.worldName, 'root', {
    metadata: { operator: 'WT', parentIds: sourceId ? [sourceId] : [] },
  })
  addNode(graph, root)

  // Label → node ID lookup for wiring relations
  const lookup = new Map<string, string>()
  lookup.set(extraction.worldName, root.id)

  // ── LOCATIONS → inverter ──
  // Locations with rich descriptions become photospheres (Achilles v2)
  for (const loc of extraction.locations) {
    const hasDesc = loc.description && loc.description.length > 10
    const node = createNode(loc.name, 'inverter', {
      metadata: { operator: 'WT', parentIds: [root.id] },
      environment: hasDesc
        ? { isPhotosphere: true, assetUrl: undefined }
        : undefined,
    })
    // Store description as portal keyword for search
    if (loc.description) node.portals.push(loc.description)
    addNode(graph, node)
    connectNodes(graph, root.id, node.id)
    lookup.set(loc.name, node.id)
  }

  // ── ENTITIES → aphorist ──
  for (const ent of extraction.entities) {
    const node = createNode(`${ent.name} [${ent.type}]`, 'aphorist', {
      metadata: { operator: 'WT', parentIds: [root.id] },
    })
    // Store entity type in portals as a keyword
    node.portals.push(ent.name.toLowerCase())
    addNode(graph, node)
    connectNodes(graph, root.id, node.id)
    lookup.set(ent.name, node.id)
  }

  // ── STATES → analyst ──
  for (const st of extraction.states) {
    const node = createNode(`${st.key} = ${st.value}`, 'analyst', {
      metadata: { operator: 'WT', parentIds: [root.id] },
    })
    addNode(graph, node)
    connectNodes(graph, root.id, node.id)
    lookup.set(st.key, node.id)
  }

  // ── EVENTS → site ──
  for (const ev of extraction.events) {
    const node = createNode(ev, 'site', {
      metadata: { operator: 'WT', parentIds: [root.id] },
    })
    addNode(graph, node)
    connectNodes(graph, root.id, node.id)
    lookup.set(ev, node.id)
  }

  // ── RELATIONS → directed edges between named nodes ──
  let relCount = 0
  for (const rel of extraction.relations) {
    const fromId = lookup.get(rel.from)
    const toId = lookup.get(rel.to)
    if (fromId && toId) {
      connectNodes(graph, fromId, toId)
      relCount++
    }
  }

  return {
    graph,
    worldName: extraction.worldName,
    counts: {
      locations: extraction.locations.length,
      entities: extraction.entities.length,
      states: extraction.states.length,
      events: extraction.events.length,
      relations: relCount,
    },
    raw: undefined,
  }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API — The compiler surface
// ══════════════════════════════════════════════════════════════

/** 
 * Compile raw text into a WorldGraph.
 * Auto-detects whether input is WorldText format or freeform prose.
 */
export function compile(input: string, sourceId?: string): CompilationResult {
  const trimmed = input.trim()
  
  // Detect WorldText format — look for structural keywords
  const hasWorldText = /\b(world|location|entity|rel|state|event)\s+/i.test(trimmed)
  
  const extraction = hasWorldText
    ? extractWorldText(trimmed)
    : extractFreeform(trimmed)

  const result = compileExtraction(extraction, sourceId)
  result.raw = trimmed
  return result
}

/**
 * Compile with LLM assistance.
 * Sends raw text to an LLM with the WorldText Generator prompt,
 * then parses the structured output.
 * 
 * @param fetchFn - Injectable fetch for testing (mock the LLM)
 */
export async function compileWithLLM(
  input: string,
  opts: {
    apiUrl: string
    apiKey: string
    model: string
    fetchFn?: typeof fetch
  },
  sourceId?: string,
): Promise<CompilationResult> {
  const doFetch = opts.fetchFn ?? fetch

  const WT_PROMPT = `You are a <WorldText Compiler>. Convert the input into structured WorldText.

FORMAT (each element on its own line):
world <WorldName> {
  location <LocationName> { description: "1-sentence physical description" }
  entity <EntityName> : type { location: <Loc>, traits: ["trait1","trait2"] }
  rel [verb](<EntityA> -> <EntityB>)
  state <Entity.property> = value
  event <EventName> { actors: [<A>,<B>], effects: ["effect"] }
}

RULES:
- Extract EVERY named character, place, object, force, concept.
- Entity types: character, creature, object, system, force, concept, structure.
- Relations should be specific verbs: [chases], [controls], [fears], [contains].
- States should capture measurable properties: health, mood, position, intensity.
- Put each element on its own line.
- Output ONLY the world block. No commentary.`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`

  const res = await doFetch(opts.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: WT_PROMPT },
        { role: 'user', content: input },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
  const data = await res.json() as {
    choices?: { message?: { content?: string } }[]
  }
  const wt = data.choices?.[0]?.message?.content?.trim() || ''
  if (!wt) throw new Error('LLM returned empty WorldText')

  const extraction = extractWorldText(wt)
  const result = compileExtraction(extraction, sourceId)
  result.raw = wt
  return result
}

// ══════════════════════════════════════════════════════════════
// OPERATOR PROMPTS — analytical instruments from Twine Bridge
// These are pure data; they don't touch the DOM.
// ══════════════════════════════════════════════════════════════

export interface OperatorDef {
  key: string
  label: string
  hue: number
  verb: string
  category: 'Narrative' | 'Reveal' | 'Structure' | 'Manipulate' | 'Meta'
  systemPrompt: string
}

const BASE_SYS = `You are a WORLD COMPILER. You analyze and extend narrative structures with extreme specificity.

RULES:
- Name every entity, location, mechanic, and relation explicitly.
- Be concrete: materials, colors, sounds, temperatures, distances, timestamps.
- Avoid filler adjectives (mysterious, enigmatic, cryptic, ethereal, eerie).
- Every sentence must contain a PROPER NOUN, a SPECIFIC MECHANIC, or a CAUSAL LINK.
- Prefer short declarative sentences over long flowing prose.
- Reference exact elements from the source text.
- Never use: "whispers", "beckons", "tapestry", "labyrinthine", "ethereal".`

export const OPERATORS: Record<string, OperatorDef> = {
  fork: {
    key: 'fork', label: 'FORK', hue: 320,
    verb: 'Generate 3 branching paths', category: 'Narrative',
    systemPrompt: `You are a NARRATIVE FORKING ENGINE. Generate exactly 3 distinct paths from the source material.
Each fork diverges on a DIFFERENT AXIS: spatial, temporal, causal.
Each fork: 2-3 paragraphs MAX. Dense. No filler.
Format: # FORK 1: [Title]\n[Content]\n# FORK 2: [Title]\n[Content]\n# FORK 3: [Title]\n[Content]`,
  },
  surface: {
    key: 'surface', label: 'SURFACE', hue: 205,
    verb: 'Trace causal chains', category: 'Reveal',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Trace hidden causal chains between entities. Map causality not visible from names alone. Format with ## headings.`,
  },
  limits: {
    key: 'limits', label: 'LIMITS', hue: 270,
    verb: 'Find narrative bottlenecks', category: 'Structure',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Identify narrative bottlenecks. Which entities concentrate the most relations? Name exact choke points. Format with ## headings.`,
  },
  modes: {
    key: 'modes', label: 'MODES', hue: 148,
    verb: 'Find parallel storylines', category: 'Reveal',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Identify parallel storylines. Map which entities appear in multiple threads. Format with ## headings.`,
  },
  zoom: {
    key: 'zoom', label: 'ZOOM', hue: 168,
    verb: 'Decompose hierarchy', category: 'Structure',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Decompose hierarchy. Level 1: genre/theme. Level 2: entity groups. Level 3: individual states. Format with ## headings.`,
  },
  play: {
    key: 'play', label: 'PLAY', hue: 38,
    verb: 'Identify counterfactuals', category: 'Manipulate',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Identify counterfactuals. What if key entity removed? What cascades? Format with ## headings.`,
  },
  holistic: {
    key: 'holistic', label: 'HOLISTIC', hue: 355,
    verb: 'Full world audit', category: 'Meta',
    systemPrompt: `${BASE_SYS}\nDIRECTIVE: Full world audit. Entity census, relation graph, event timeline, state inventory, bottleneck, counterfactual. Format with ## headings.`,
  },
}
