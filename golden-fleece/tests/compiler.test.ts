// ══════════════════════════════════════════════════════════════
// GOLDEN FLEECE COMPILER — UNIT TESTS
//
// Proves the compiler successfully ingests:
//   1. Canonical WorldText format → typed WorldGraph
//   2. Freeform markdown prose → extracted topology
//   3. LLM-mode with mocked fetch → full pipeline
//   4. Layout → spatial positions assigned
//   5. Serialization round-trip → graph survives JSON
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'bun:test'
import {
  createNode,
  createGraph,
  addNode,
  connectNodes,
  nodesByCategory,
  detectBlockFormat,
  serializeGraph,
  deserializeGraph,
  compile,
  compileWithLLM,
  extractWorldText,
  extractFreeform,
  layoutGraph,
  assignZones,
  OPERATORS,
} from '../src/core/index.js'

// ──────────────────────────────────────
// TEST DATA — mock WorldText input
// ──────────────────────────────────────

const WORLDTEXT_INPUT = `
world <Colchis> {
  location <Aeaea> { description: "Island of Circe. Rocky shore, bronze gates, herb gardens." }
  location <Iolcus> { description: "Port city in Thessaly. Stone quays, fishing boats, agora." }
  entity <Jason> : character { location: <Iolcus>, traits: ["brave","exiled"] }
  entity <Medea> : character { location: <Aeaea>, traits: ["sorceress","cunning"] }
  entity <GoldenFleece> : object { location: <Colchis>, traits: ["divine","guarded"] }
  entity <Argo> : structure { location: <Iolcus>, traits: ["ship","fifty-oars"] }
  rel [commands](<Jason> -> <Argo>)
  rel [guards](<Medea> -> <GoldenFleece>)
  rel [sails_from](<Argo> -> <Iolcus>)
  rel [seeks](<Jason> -> <GoldenFleece>)
  state <Jason.status> = exiled
  state <GoldenFleece.location> = sacred grove
  event <Departure> { actors: [<Jason>,<Argo>], effects: ["voyage begins"] }
  event <Arrival> { actors: [<Jason>,<Medea>], effects: ["alliance formed"] }
}
`

const FREEFORM_INPUT = `
# The Voyage of the Argo

Jason assembled fifty heroes at the port of Iolcus. The ship Argo, built by Argus from timber of Dodona, waited at the stone quay. Hercules arrived last, carrying his bronze club.

They sailed east through the Symplegades — the Clashing Rocks — losing only the stern ornament. In Colchis, King Aeetes demanded Jason yoke the fire-breathing bulls of Hephaestus.

Medea, the king's daughter, offered her sorcery in exchange for marriage. She gave Jason an ointment of Prometheus that made him fireproof for one day. He plowed the Field of Ares, sowed the dragon's teeth, and slaughtered the Spartoi warriors.

At midnight Medea led Jason to the sacred grove where the Golden Fleece hung on an oak, guarded by a sleepless dragon. She sang it to sleep. Jason seized the Fleece.
`

// ──────────────────────────────────────
// Layer 1: worldnode.ts
// ──────────────────────────────────────

describe('WorldNode / WorldGraph', () => {
  it('creates a node with correct defaults', () => {
    const node = createNode('Test Node', 'aphorist')
    expect(node.id).toBeTruthy()
    expect(node.text).toBe('Test Node')
    expect(node.category).toBe('aphorist')
    expect(node.edges).toEqual([])
    expect(node.portals).toEqual([])
    expect(node.valence).toBe('DEFAULT')
    expect(node.spatial.x).toBe(0)
    expect(node.spatial.y).toBe(0)
    expect(node.spatial.z).toBe(0)
    expect(node.format.blockType).toBe('text')
    expect(node.metadata.parentIds).toEqual([])
    expect(node.environment).toBeUndefined()  // No photosphere by default
  })

  it('creates a photosphere node with environment', () => {
    const node = createNode('Sacred Grove', 'inverter', {
      environment: { isPhotosphere: true, assetUrl: '/hdri/grove.hdr' },
    })
    expect(node.environment).toBeDefined()
    expect(node.environment!.isPhotosphere).toBe(true)
    expect(node.environment!.assetUrl).toBe('/hdri/grove.hdr')
  })

  it('detects block format from markdown prefix', () => {
    expect(detectBlockFormat('# Heading')).toBe('h1')
    expect(detectBlockFormat('## Subheading')).toBe('h2')
    expect(detectBlockFormat('> Quote')).toBe('quote')
    expect(detectBlockFormat('- List item')).toBe('list')
    expect(detectBlockFormat('---')).toBe('hr')
    expect(detectBlockFormat('Plain text')).toBe('text')
  })

  it('creates a graph and adds connected nodes', () => {
    const graph = createGraph('Test World')
    expect(graph.name).toBe('Test World')
    expect(graph.nodes.size).toBe(0)

    const a = createNode('Node A', 'site')
    const b = createNode('Node B', 'inverter')
    addNode(graph, a)
    addNode(graph, b)
    expect(graph.nodes.size).toBe(2)
    expect(graph.rootId).toBe(a.id)  // First node becomes root

    connectNodes(graph, a.id, b.id)
    expect(a.edges).toContain(b.id)
  })

  it('queries by category', () => {
    const graph = createGraph('Category Test')
    addNode(graph, createNode('World 1', 'site'))
    addNode(graph, createNode('World 2', 'site'))
    addNode(graph, createNode('Location 1', 'inverter'))
    addNode(graph, createNode('Entity 1', 'aphorist'))

    expect(nodesByCategory(graph, 'site').length).toBe(2)
    expect(nodesByCategory(graph, 'inverter').length).toBe(1)
    expect(nodesByCategory(graph, 'aphorist').length).toBe(1)
    expect(nodesByCategory(graph, 'analyst').length).toBe(0)
  })

  it('serializes and deserializes a graph', () => {
    const graph = createGraph('Roundtrip')
    const n = createNode('Survivor', 'root')
    addNode(graph, n)
    
    const json = serializeGraph(graph)
    const restored = deserializeGraph(json)

    expect(restored.name).toBe('Roundtrip')
    expect(restored.nodes.size).toBe(1)
    expect(restored.nodes.get(n.id)?.text).toBe('Survivor')
    expect(restored.rootId).toBe(n.id)
  })
})

// ──────────────────────────────────────
// Layer 2: compiler.ts
// ──────────────────────────────────────

describe('WorldText Compiler', () => {
  it('extracts WorldText format into raw structure', () => {
    const ex = extractWorldText(WORLDTEXT_INPUT)
    expect(ex.worldName).toBe('Colchis')
    expect(ex.locations.length).toBe(2)
    expect(ex.locations[0]!.name).toBe('Aeaea')
    expect(ex.locations[0]!.description).toContain('Rocky shore')
    expect(ex.entities.length).toBeGreaterThanOrEqual(4)
    expect(ex.relations.length).toBeGreaterThanOrEqual(3)
    expect(ex.states.length).toBe(2)
    expect(ex.events.length).toBe(2)
  })

  it('compiles WorldText into a typed WorldGraph', () => {
    const result = compile(WORLDTEXT_INPUT)
    expect(result.worldName).toBe('Colchis')
    expect(result.graph.nodes.size).toBeGreaterThan(5)

    // Check WLES categories are assigned
    const locations = nodesByCategory(result.graph, 'inverter')
    const entities = nodesByCategory(result.graph, 'aphorist')
    const states = nodesByCategory(result.graph, 'analyst')
    const events = nodesByCategory(result.graph, 'site')
    const root = nodesByCategory(result.graph, 'root')

    expect(root.length).toBe(1)
    expect(root[0]!.text).toBe('Colchis')
    expect(locations.length).toBe(2)
    expect(entities.length).toBeGreaterThanOrEqual(4)
    expect(states.length).toBe(2)
    expect(events.length).toBe(2)

    // Check edges are wired
    const rootNode = root[0]!
    expect(rootNode.edges.length).toBeGreaterThan(0)
  })

  it('tags locations with descriptions as photospheres', () => {
    const result = compile(WORLDTEXT_INPUT)
    const locations = nodesByCategory(result.graph, 'inverter')
    
    // Both Aeaea and Iolcus have descriptions > 10 chars → photospheres
    const photospheres = locations.filter(n => n.environment?.isPhotosphere)
    expect(photospheres.length).toBe(2)
    expect(photospheres[0]!.environment!.isPhotosphere).toBe(true)
    // Description stored as portal keyword
    expect(photospheres[0]!.portals.length).toBeGreaterThan(0)
  })

  it('compiles freeform prose into extracted topology', () => {
    const result = compile(FREEFORM_INPUT)
    expect(result.worldName).toBe('The Voyage of the Argo')
    expect(result.graph.nodes.size).toBeGreaterThan(1)

    // Should extract proper nouns as entities
    const entities = nodesByCategory(result.graph, 'aphorist')
    const entityNames = entities.map(e => e.text)
    
    // Jason, Medea, Hercules, Argo should be found
    const foundJason = entityNames.some(n => n.includes('Jason'))
    const foundMedea = entityNames.some(n => n.includes('Medea'))
    expect(foundJason || foundMedea).toBe(true)
  })

  it('auto-detects format: WorldText vs freeform', () => {
    const wt = compile('world <Test> { entity <Foo> : obj }')
    expect(wt.worldName).toBe('Test')

    const ff = compile('The quick brown fox jumped over the lazy dog.')
    expect(ff.worldName).toBe('Freeform')  // Default for prose
  })

  it('compiles with mocked LLM fetch', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: `world <MockWorld> {
  location <MockCity> { description: "A test city" }
  entity <MockHero> : character { traits: ["brave"] }
  rel [explores](<MockHero> -> <MockCity>)
  state <MockHero.health> = 100
  event <Quest> { actors: [<MockHero>], effects: ["adventure"] }
}`
        }
      }]
    }

    const mockFetch = async () => new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await compileWithLLM('Some raw text', {
      apiUrl: 'https://mock.api/v1/chat/completions',
      apiKey: 'mock-key',
      model: 'mock-model',
      fetchFn: mockFetch as typeof fetch,
    })

    expect(result.worldName).toBe('MockWorld')
    expect(result.counts.locations).toBe(1)
    expect(result.counts.entities).toBe(1)
    expect(result.counts.states).toBe(1)
    expect(result.counts.events).toBe(1)
    expect(result.counts.relations).toBe(1)
    expect(result.raw).toContain('MockWorld')
  })
})

// ──────────────────────────────────────
// Layer 3: layout.ts
// ──────────────────────────────────────

describe('Headless Layout', () => {
  it('assigns spatial positions to all nodes', () => {
    const result = compile(WORLDTEXT_INPUT)
    layoutGraph(result.graph)

    for (const node of result.graph.nodes.values()) {
      expect(node.spatial.x).toBeGreaterThan(0)
      expect(node.spatial.y).toBeGreaterThan(0)
    }

    // Root should be near center
    const root = result.graph.nodes.get(result.graph.rootId!)!
    expect(root.spatial.x).toBeGreaterThan(300)
    expect(root.spatial.x).toBeLessThan(700)
    expect(root.spatial.y).toBeGreaterThan(300)
    expect(root.spatial.y).toBeLessThan(700)
  })

  it('assigns z-depth by WLES category', () => {
    const result = compile(WORLDTEXT_INPUT)
    layoutGraph(result.graph)

    const root = nodesByCategory(result.graph, 'root')[0]!
    const analyst = nodesByCategory(result.graph, 'analyst')[0]
    
    expect(root.spatial.z).toBe(0)
    if (analyst) expect(analyst.spatial.z).toBe(4)
  })

  it('assigns panel zones from spatial positions', () => {
    const result = compile(WORLDTEXT_INPUT)
    layoutGraph(result.graph)
    assignZones(result.graph, 16)

    // Every node should have a zoneKey
    for (const node of result.graph.nodes.values()) {
      expect(node.spatial.zoneKey).toMatch(/^panel_\d+$/)
    }
  })
})

// ──────────────────────────────────────
// Operator registry
// ──────────────────────────────────────

describe('Operators', () => {
  it('has all seven operators defined', () => {
    expect(Object.keys(OPERATORS).length).toBe(7)
    expect(OPERATORS.fork).toBeDefined()
    expect(OPERATORS.surface).toBeDefined()
    expect(OPERATORS.limits).toBeDefined()
    expect(OPERATORS.modes).toBeDefined()
    expect(OPERATORS.zoom).toBeDefined()
    expect(OPERATORS.play).toBeDefined()
    expect(OPERATORS.holistic).toBeDefined()
  })

  it('each operator has a system prompt', () => {
    for (const op of Object.values(OPERATORS)) {
      expect(op.systemPrompt.length).toBeGreaterThan(50)
      expect(op.label).toBeTruthy()
      expect(op.hue).toBeGreaterThanOrEqual(0)
    }
  })
})

// ──────────────────────────────────────
// Full pipeline integration
// ──────────────────────────────────────

describe('Full Pipeline: Ingest → Compile → Layout → Serialize', () => {
  it('takes raw thought and outputs a typed, interconnected spatial topology', () => {
    // 1. INGEST
    const result = compile(WORLDTEXT_INPUT)
    expect(result.graph.nodes.size).toBeGreaterThan(5)

    // 2. TOPOGRAPHY
    layoutGraph(result.graph)
    assignZones(result.graph, 16)

    // Every node has spatial coordinates and a zone
    for (const node of result.graph.nodes.values()) {
      expect(node.spatial.x).toBeGreaterThan(0)
      expect(node.spatial.zoneKey).toBeTruthy()
    }

    // 3. SERIALIZE round-trip
    const json = serializeGraph(result.graph)
    const restored = deserializeGraph(json)
    expect(restored.nodes.size).toBe(result.graph.nodes.size)
    expect(restored.name).toBe('Colchis')

    // 4. EDGES survived
    const root = restored.nodes.get(restored.rootId!)!
    expect(root.edges.length).toBeGreaterThan(0)
    
    // 5. WLES categories survived
    const restoredEntities = Array.from(restored.nodes.values())
      .filter(n => n.category === 'aphorist')
    expect(restoredEntities.length).toBeGreaterThanOrEqual(4)

    // 6. PHOTOSPHERES survived the round-trip
    const restoredLocs = Array.from(restored.nodes.values())
      .filter(n => n.category === 'inverter')
    const restoredPhotospheres = restoredLocs.filter(n => n.environment?.isPhotosphere)
    expect(restoredPhotospheres.length).toBe(2)

    // This is the proof: raw text → typed topology → spatial layout → serializable.
    // Photospheres, text panels, and Voronoi zones all live in one AST.
    // Mounting into Three.js is now a display concern, not a data concern.
  })
})
