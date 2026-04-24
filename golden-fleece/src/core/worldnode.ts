// ══════════════════════════════════════════════════════════════
// LAYER 1: THE ROSETTA STONE
// The Abstract Syntax Tree for all thought in the Golden Fleece.
//
// This is the SINGLE SOURCE OF TRUTH. Golden Egg no longer owns
// BLOCK_STORE. Ripples no longer owns colReg. Twine no longer
// owns nodes = []. The 3D engine and the UI are dumb Views
// subscribing to this exact graph.
// ══════════════════════════════════════════════════════════════

// ── WLES Semantic Roles (Twine Bridge) ──
// site      = W (World)    — settings, contexts, environments
// inverter  = L (Location) — named places, spatial anchors
// aphorist  = E (Entity)   — characters, objects, forces, concepts
// analyst   = S (State)    — measurable properties, conditions
// root      = genesis node — the origin point of any compilation
export type WLESCategory = 'site' | 'inverter' | 'aphorist' | 'analyst' | 'root'

// ── Ripples Ecosystem Pressure ──
export type RippleValence = 'DEFAULT' | 'OBSTACLE' | 'GOAL' | 'SHIFT'

// ── Markdown Block Types (Pretext Typography) ──
export type BlockFormat = 'h1' | 'h2' | 'quote' | 'list' | 'text' | 'hr'

// ══════════════════════════════════════════════════════════════
// THE WORLD NODE — every atom of thought in the system
// ══════════════════════════════════════════════════════════════
export interface WorldNode {
  // ── CORE IDENTITY ──
  id: string               // crypto.randomUUID()
  text: string             // Raw payload (editable via Shared Control Surface)

  // ── SEMANTIC TOPOLOGY (Twine Bridge) ──
  category: WLESCategory   // WLES Semantic Role
  edges: string[]          // Directed scene graph connections (node IDs)
  portals: string[]        // Transclusion links (Golden Egg CLUE_GRAPH keywords)

  // ── CHRONO-ECOLOGY (Ripples Bridge) ──
  valence: RippleValence   // Ecosystem pressure / alignment
  epoch: number            // Absolute timeline index
  simTime: number          // Physics time at creation

  // ── SPATIAL CARTOGRAPHY (Headless Voronoi / Golden Egg) ──
  spatial: {
    zoneKey?: string       // Architectural panel assignment (e.g., 'panel_4')
    x: number              // Voronoi / Grid X
    y: number              // Voronoi / Grid Y
    z: number              // Layer stack depth / wall verticality
  }

  // ── IMMERSION (Achilles v2) ──
  environment?: {
    isPhotosphere: boolean // Does navigating here trigger a 360° interior?
    assetUrl?: string      // HDRI/Equirectangular image path for the sphere
  }

  // ── TYPOGRAPHIC PHYSICS (Pretext) ──
  format: {
    blockType: BlockFormat // Markdown prefix struct
    metrics?: unknown      // Cached layout boundaries from Pretext prepare()
  }

  // ── PROVENANCE & ORPHANS (POML / BEES) ──
  metadata: {
    operator?: string      // The LLM op that birthed this ('FORK', 'PRIME', 'WT')
    parentIds: string[]    // Lineage for the Ripples branch tree
    evaluations?: Record<string, unknown> // Dark Matter / PRIME YAML evaluations
  }
}

// ══════════════════════════════════════════════════════════════
// WORLD GRAPH — the full topology container
// ══════════════════════════════════════════════════════════════
export interface WorldGraph {
  id: string               // Graph-level UUID
  name: string             // Human label for this world
  nodes: Map<string, WorldNode>
  rootId: string | null    // The genesis node
  epoch: number            // Current timeline position
  created: number          // Date.now()
}

// ══════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ══════════════════════════════════════════════════════════════

let _epoch = 0

/** Detect BlockFormat from markdown prefix */
export function detectBlockFormat(text: string): BlockFormat {
  const trimmed = text.trim()
  if (trimmed === '---' || trimmed === '***' || trimmed === '___') return 'hr'
  if (trimmed.startsWith('## ')) return 'h2'
  if (trimmed.startsWith('# ')) return 'h1'
  if (trimmed.startsWith('> ')) return 'quote'
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return 'list'
  return 'text'
}

/** Mint a fresh WorldNode with sane defaults */
export function createNode(
  text: string,
  category: WLESCategory = 'site',
  opts?: Partial<Pick<WorldNode, 'valence' | 'spatial' | 'environment' | 'metadata'>>
): WorldNode {
  return {
    id: crypto.randomUUID(),
    text,
    category,
    edges: [],
    portals: [],
    valence: opts?.valence ?? 'DEFAULT',
    epoch: _epoch++,
    simTime: Date.now(),
    spatial: {
      x: opts?.spatial?.x ?? 0,
      y: opts?.spatial?.y ?? 0,
      z: opts?.spatial?.z ?? 0,
      zoneKey: opts?.spatial?.zoneKey,
    },
    environment: opts?.environment,
    format: {
      blockType: detectBlockFormat(text),
    },
    metadata: {
      operator: opts?.metadata?.operator,
      parentIds: opts?.metadata?.parentIds ?? [],
      evaluations: opts?.metadata?.evaluations,
    },
  }
}

/** Create a fresh WorldGraph */
export function createGraph(name: string): WorldGraph {
  return {
    id: crypto.randomUUID(),
    name,
    nodes: new Map(),
    rootId: null,
    epoch: 0,
    created: Date.now(),
  }
}

/** Add a node to a graph and wire it */
export function addNode(graph: WorldGraph, node: WorldNode): WorldNode {
  graph.nodes.set(node.id, node)
  if (!graph.rootId) graph.rootId = node.id
  graph.epoch = Math.max(graph.epoch, node.epoch)
  return node
}

/** Connect two nodes with a directed edge */
export function connectNodes(
  graph: WorldGraph,
  fromId: string,
  toId: string
): boolean {
  const from = graph.nodes.get(fromId)
  const to = graph.nodes.get(toId)
  if (!from || !to) return false
  if (!from.edges.includes(toId)) from.edges.push(toId)
  return true
}

/** Get all nodes of a specific WLES category */
export function nodesByCategory(
  graph: WorldGraph,
  category: WLESCategory
): WorldNode[] {
  const result: WorldNode[] = []
  for (const node of graph.nodes.values()) {
    if (node.category === category) result.push(node)
  }
  return result
}

/** Serialize graph to plain JSON (Maps → objects) */
export function serializeGraph(graph: WorldGraph): string {
  const plain = {
    ...graph,
    nodes: Object.fromEntries(graph.nodes),
  }
  return JSON.stringify(plain, null, 2)
}

/** Deserialize graph from plain JSON */
export function deserializeGraph(json: string): WorldGraph {
  const raw = JSON.parse(json)
  return {
    ...raw,
    nodes: new Map(Object.entries(raw.nodes)),
  }
}
