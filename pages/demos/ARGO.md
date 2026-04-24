# ARGO · Operative Cartography

**A spatial text environment where the world IS text, text IS world, and walking IS prompting.**

ARGO unifies four simultaneous views of a single world-graph into a single Pretext-powered interface. Every node in the graph has text, spatial coordinates, a category, edges to other nodes, and optional photosphere imagery. The Voronoi tessellation of these spatial coordinates produces the territory map that all four views share.

![ARGO Interface Architecture](../../.gemini/../pages/demos/ARGO.md)

---

## Architecture

### The World Graph

```
WorldNode {
  id:          string           // unique ID (e.g. "node_3a9f")
  text:        string           // node body — the "worldtext"
  category:    number           // WLES category (0–8: Water, Land, Energy, Structure, ...)
  epoch:       number           // creation epoch for temporal ordering
  spatial:     { x, y }         // 2D coordinates for Voronoi tessellation
  edges:       string[]         // IDs of connected nodes
  affinity?:   Record<id, pct>  // border-sharing percentages from Voronoi
  environment?: {               // photosphere data
    isPhotosphere: boolean
    image?: string              // equirectangular image URL
  }
}
```

The graph is the single source of truth. All views consume it. All operators mutate it. All snapshots serialize it.

### The Voronoi Tessellation

One `d3-delaunay.Delaunay.from(points).voronoi(bounds)` call produces the tessellation that feeds:

| View | What it gets from the Voronoi |
|---|---|
| **VORONOI** | Floor texture canvas with filled/stroked cells, Pretext text clipped per cell |
| **WALK** | LIDAR plan grid (which cells are walls), wall coloring by node category |
| **FLAT** | 2D cells drawn directly to canvas with fill, stroke, labels, Pretext body text |
| **SPHERE** | Equirectangular background map painted into 2048×1024 canvas |

### The Pretext Pipeline

Pretext's `prepare()` → `layoutWithLines()` is used in five places:

1. **Voronoi floor cells** — text laid out at cell width, clipped to cell polygon boundary
2. **Walk wall faces** — text laid out at face width, cached by `nodeId_fontSize_faceWidth`
3. **Sphere interior** — description body laid out at 1100px width with 52px line height
4. **Flat view cells** — text drawn into each cell's inscribed rectangle
5. **Node strip sidebar** — connected-node text in the inspector panel

### The Spatial Prompting Engine

Walking between territories triggers context-aware LLM generation:

```
Territory A → [cross boundary] → Territory B
                  ↓
         fireSpatialPrompt(B)
                  ↓
     Context = B.text + neighbors.text
                  ↓
        OpenAI chat completion
                  ↓
       B.text += generated extension
                  ↓
         State snapshot saved
```

Guards: 5s cooldown, 500ms dwell time, cascade depth limit (3), API rate limiter, budget tracking.

---

## Four Views

### 1. VORONOI (Three.js)

Bird's-eye 3D view. OrbitControls with smooth lerp animation.

- Voronoi floor: canvas texture with filled cells + Pretext text
- Node pillars: sphere core + torus ring + cylindrical hit mesh
- Edge lines: luminous connections between nodes
- Click to select, drag to rearrange, double-click to overview
- Right-click for context ring (inspect / enter sphere / focus)

### 2. WALK (Canvas 2D raycaster)

First-person perspective through the same LIDAR plan.

- DDA raycaster with 30-step max depth
- Wall faces colored by node category with Pretext text
- Center-facing wall gets: dark overlay + zone header + metadata + Pretext body
- Clean gradient ground with territory color tint
- Voronoi minimap in top-left corner
- WASD movement, mouse rotation, number keys for teleporting
- Spatial prompting boundary detector on territory crossing

### 3. FLAT (Canvas 2D overhead)

Overhead 2D map with pan (drag) and zoom (scroll).

- Same Voronoi cells drawn directly, no Three.js
- Click cell to select node, click again to enter sphere
- Arrow keys for camera pan
- Node labels at centroids with category colors

### 4. SPHERE (Three.js photosphere)

Equirectangular interior view.

- 2048×1024 interior canvas with:
  - Voronoi territory map as opaque background layer (no tiling)
  - Semi-transparent dark panel for text legibility
  - Title, category, description (via Pretext), connected nodes
- If node has photosphere image: real photo loads as texture
- If empty: Voronoi mosaic map wraps the sphere interior
- BackSide rendered sphere geometry at INTERIOR_RADIUS
- Fresnel rim glow shader

---

## State Management

### Ring Buffer (50 slots)

```
snapBuffer: Array<{ graph, timestamp, label }>
snapHead:   number    // current write position
snapCursor: number    // current playback position
```

- Auto-snapshot on: node creation, text edit, spatial prompt, drag, operator fire
- Ctrl+Z / Ctrl+Shift+Z for undo/redo
- `<` / `>` buttons in the timeline strip
- Each snapshot stores the full serialized graph

### Persistence (planned)

- `idbPersist()` → IndexedDB for session survival
- `idbRestore()` → rehydrate on reload
- Currently memory-resident

---

## Controls

| Key | Action |
|---|---|
| 1-9 | Teleport to node by index |
| G | Fire operator on selected node (all modes) |
| P | Toggle spatial prompting (walk mode) |
| H | Toggle grid overlay (voronoi mode) |
| Ctrl+Z | Undo state |
| Ctrl+Shift+Z | Redo state |
| ESC | Close panels |
| Double-click | Reset to full overview |
| Right-click | Context ring menu |
| WASD | Move (walk/flat) |
| Mouse | Orbit (voronoi), drag nodes, look (walk) |
| Scroll | Zoom |
| Click empty | Deselect node |

## Operators

| Operator | Verb | Effect |
|---|---|---|
| LINK | Connect | Add edge between active + target |
| SPLIT | Subdivide | Split node into two children |
| MERGE | Combine | Merge two nodes into one |
| GENERATE | Extend | LLM-generate new text for node |
| PHOTO | Capture | Set photosphere image |

---

## File Map

```
pages/demos/
├── golden-fleece-surface.html    # HTML shell, CSS, help overlay, control surface
├── golden-fleece-surface.ts      # TypeScript: all four views, operators, state, Pretext integration
├── golden-fleece.html            # Predecessor (ancestral genome)
├── golden-fleece.ts              # Predecessor source
└── ARGO.md                       # This spec (program.md — rehydration blueprint)
```

### Dependencies (loaded via CDN in HTML)

- **Three.js r168** — 3D rendering, OrbitControls
- **d3-delaunay** — Voronoi tessellation
- **Pretext** — `prepare()`, `layoutWithLines()`, `prepareWithSegments()` (imported from `../../src/layout.js`)
- **OpenAI API** — spatial prompting (user provides key)

### Key Functions

| Function | Purpose |
|---|---|
| `drawVoronoiFloor(hovered?, active?)` | Paint Voronoi canvas texture + Pretext cell text |
| `buildLidarPlan()` | Convert Voronoi → LIDAR grid for walk raycaster |
| `renderWalk()` | Per-frame DDA raycaster + wall Pretext text |
| `renderFlat()` | Per-frame overhead 2D Voronoi + labels |
| `enterPhotosphere(node)` | Build sphere interior canvas + Three.js sphere |
| `focusNode(node)` | Smooth camera lerp to node position |
| `fireRipple(node)` | BFS visual ripple through edge network |
| `fireSpatialPrompt(node)` | LLM generation triggered by walking |
| `snapSave(label)` | Save current graph to ring buffer |
| `snapRestore(cursor)` | Restore graph from ring buffer position |

---

## Design Principles

1. **Single source of truth**: One `WorldGraph`, one `d3-delaunay` tessellation, four views.
2. **World IS text**: Pretext renders directly into Voronoi cells, walls, and sphere interiors.
3. **Walking IS prompting**: Movement through space triggers cascading LLM generation.
4. **Non-destructive**: Every mutation is snapshotted into a 50-slot ring buffer.
5. **No alpha artifacts**: Sphere Voronoi painted opaque first, text on top. No compositing ghosting.
6. **Cached hot paths**: Wall text cached by `nodeId_fontSize_width`. Layout computed once per config.
7. **No per-pixel computation in walk**: Floor is a clean gradient, not a per-pixel d3 lookup.

---

## Rehydration

To rebuild this system from scratch:

1. Create an HTML shell with four canvases (Three.js renderer, walk, flat) and a help overlay
2. Initialize a `WorldGraph` with 12-16 seed nodes covering WLES categories
3. Compute `d3-delaunay` Voronoi from node spatial coordinates
4. Build the VORONOI floor as a canvas texture with Pretext text per cell
5. Build the WALK LIDAR plan by discretizing the Voronoi into a grid
6. Wire OrbitControls with smooth lerp, wide zoom range, gentle damping
7. Wire WASD + mouse for walk-mode DDA raycaster
8. Wire flat pan/zoom with the same Voronoi drawn to 2D canvas
9. Wire sphere view with equirectangular Voronoi background + Pretext text panel
10. Add operators: link, split, merge, generate, photo
11. Add ring buffer snapshots on every graph mutation
12. Add spatial prompting with boundary-crossing detection + LLM context
13. Add HMR accept for development

The `WorldGraph` serialization format is JSON. Any agent or system that can produce nodes with `{ id, text, category, spatial: {x,y}, edges }` can feed this engine.
