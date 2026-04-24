// ══════════════════════════════════════════════════════════════
// LAYER 3: HEADLESS VORONOI TOPOGRAPHY
//
// Pure spatial math. No DOM, no SVG, no D3 rendering.
// Reads WorldGraph, computes Voronoi-like layout positions,
// writes back to node.spatial.x/y/z.
//
// Uses force-directed placement with semantic gravity:
// - Nodes with more edges get more area
// - OBSTACLE valence repels neighbors
// - GOAL valence attracts neighbors
// - analyst (S) nodes with low evidence shrink their footprint
// ══════════════════════════════════════════════════════════════

import { type WorldGraph, type WorldNode } from './worldnode.js'

export interface LayoutConfig {
  width: number       // Total layout width
  height: number      // Total layout height
  padding: number     // Edge padding
  iterations: number  // Force simulation steps
  repulsion: number   // Node-node repulsion strength
  attraction: number  // Edge attraction strength
  gravity: number     // Center gravity
}

const DEFAULT_CONFIG: LayoutConfig = {
  width: 1000,
  height: 1000,
  padding: 50,
  iterations: 50,
  repulsion: 500,
  attraction: 0.1,
  gravity: 0.02,
}

/**
 * Assign spatial positions to all nodes in a WorldGraph
 * using force-directed layout with semantic weighting.
 * 
 * This is the headless Voronoi — no DOM touched.
 */
export function layoutGraph(
  graph: WorldGraph,
  config: Partial<LayoutConfig> = {},
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length === 0) return

  const cx = cfg.width / 2
  const cy = cfg.height / 2

  // ── INITIAL PLACEMENT ──
  // Root at center, others in a ring
  const root = graph.rootId ? graph.nodes.get(graph.rootId) : null
  if (root) {
    root.spatial.x = cx
    root.spatial.y = cy
    root.spatial.z = 0
  }

  const nonRoot = nodes.filter(n => n.id !== graph.rootId)
  const angleStep = (2 * Math.PI) / Math.max(nonRoot.length, 1)
  const radius = Math.min(cfg.width, cfg.height) * 0.35

  for (let i = 0; i < nonRoot.length; i++) {
    const n = nonRoot[i]!
    const angle = angleStep * i
    n.spatial.x = cx + Math.cos(angle) * radius
    n.spatial.y = cy + Math.sin(angle) * radius
    // Z-depth by category: roots low, analysts high
    n.spatial.z = categoryDepth(n)
  }

  // ── FORCE SIMULATION ──
  for (let iter = 0; iter < cfg.iterations; iter++) {
    const cooling = 1 - iter / cfg.iterations // Linear cooling

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const dx = b.spatial.x - a.spatial.x
        const dy = b.spatial.y - a.spatial.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)

        // Semantic weight: OBSTACLE nodes repel extra, GOAL attracts
        const aWeight = valenceWeight(a)
        const bWeight = valenceWeight(b)

        const force = (cfg.repulsion * aWeight * bWeight) / (dist * dist)
        const fx = (dx / dist) * force * cooling
        const fy = (dy / dist) * force * cooling

        a.spatial.x -= fx
        a.spatial.y -= fy
        b.spatial.x += fx
        b.spatial.y += fy
      }
    }

    // Attraction along edges
    for (const node of nodes) {
      for (const edgeId of node.edges) {
        const target = graph.nodes.get(edgeId)
        if (!target) continue
        const dx = target.spatial.x - node.spatial.x
        const dy = target.spatial.y - node.spatial.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) continue

        const force = cfg.attraction * dist * cooling
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        node.spatial.x += fx
        node.spatial.y += fy
        target.spatial.x -= fx * 0.5
        target.spatial.y -= fy * 0.5
      }
    }

    // Center gravity
    for (const node of nodes) {
      node.spatial.x += (cx - node.spatial.x) * cfg.gravity * cooling
      node.spatial.y += (cy - node.spatial.y) * cfg.gravity * cooling
    }

    // Bounds clamping
    for (const node of nodes) {
      node.spatial.x = Math.max(cfg.padding, Math.min(cfg.width - cfg.padding, node.spatial.x))
      node.spatial.y = Math.max(cfg.padding, Math.min(cfg.height - cfg.padding, node.spatial.y))
    }
  }
}

/** Semantic Z-depth by WLES category */
function categoryDepth(node: WorldNode): number {
  switch (node.category) {
    case 'root':     return 0
    case 'site':     return 1  // W — ground level
    case 'inverter': return 2  // L — room level
    case 'aphorist': return 3  // E — entity level
    case 'analyst':  return 4  // S — overhead/observation level
    default:         return 1
  }
}

/** Valence → force weight multiplier */
function valenceWeight(node: WorldNode): number {
  switch (node.valence) {
    case 'OBSTACLE': return 1.5  // Repels strongly
    case 'GOAL':     return 0.6  // Attracts (less repulsion)
    case 'SHIFT':    return 1.2  // Slightly restless
    default:         return 1.0
  }
}

/**
 * Assign panel zones to nodes based on their spatial quadrant.
 * Divides the layout into a grid of panels.
 */
export function assignZones(
  graph: WorldGraph,
  panelCount: number = 16,
  layoutWidth: number = 1000,
  layoutHeight: number = 1000,
): void {
  const cols = Math.ceil(Math.sqrt(panelCount))
  const rows = Math.ceil(panelCount / cols)
  const cellW = layoutWidth / cols
  const cellH = layoutHeight / rows

  for (const node of graph.nodes.values()) {
    const col = Math.min(Math.floor(node.spatial.x / cellW), cols - 1)
    const row = Math.min(Math.floor(node.spatial.y / cellH), rows - 1)
    const panelIdx = row * cols + col + 1
    node.spatial.zoneKey = `panel_${Math.min(panelIdx, panelCount)}`
  }
}
