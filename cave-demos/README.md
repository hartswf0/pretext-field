# The Cave — Pretext Immersive Demo Suite

Immersive typographic environments and consciousness experiments built on [Pretext](https://github.com/chenglou/pretext)'s real-time text layout engine.

These 11 interactive demos push text out of static rectangles and into spatial, interactive, and perceptual architectures — 3D raycasted caves, echolocation systems, lunar crescents, and dissolving disciplinary boundaries — all rendered at 60 FPS with zero DOM measurement in the render loop.

## What is Pretext?

[Pretext](https://www.npmjs.com/package/@chenglou/pretext) is a pure JavaScript/TypeScript library for multiline text measurement and layout. It replaces expensive DOM operations like `getBoundingClientRect()` and `offsetHeight` with a two-phase pipeline:

1. **`prepare(text, font)`** — one-time text analysis: segment, normalize, measure via canvas, return an opaque handle
2. **`layout(prepared, width, lineHeight)`** — pure arithmetic over cached widths. No DOM, no canvas, no strings. Runs in ~0.09ms for 500 texts.

The result is text layout that can run inside `requestAnimationFrame` without triggering browser reflow — enabling the kind of interactive typography these demos explore.

### Key APIs used by the demos

| API | Purpose | Used by |
|-----|---------|---------|
| `layoutNextLine(prepared, cursor, width)` | Route text one line at a time with **variable widths** per line | ORCA LiDAR, Bat Echo, Bat, Wordar, Power of a Moon, Cartesian Breach, Breach V2 |
| `layoutWithLines(prepared, width, lineHeight)` | Get all lines at a fixed width in one call | Spotlight, Lantern, Cultural Brain |
| `prepareWithSegments(text, font)` | Rich preparation that returns segment data for manual layout | All 10 Pretext-powered demos |
| `walkLineRanges(prepared, width, onLine)` | Line widths/cursors without building strings — for shrinkwrap | (available; used in other Pretext demos) |

## The demos

### Echolocation & Raycasting

**[ORCA // Pretext LiDAR](demos/orca-lidar.html)** — Top-down 2D exploration engine. Move through a tile-based cave with WASD, aim with the mouse, fire light pulses with SPACE. Pulses bounce off walls (up to 4 reflections) and create radial light splashes. Text from the Culture–Mind–Brain corpus is rendered only where light falls — each line flowed into the exact illuminated width via `layoutNextLine()`. The cave is divided into named disciplinary zones (The Gage Matrix, The Somatic Ward, The Uncanny Breach, The Extended Mind) with collectible evidence artifacts.

**[ORCA // Voabar](demos/voabar.html)** — Self-contained first-person 3D raycasted text environment with spatial audio, CRT post-processing, and a collectible poem system. A complete Wolfenstein-style engine in a single HTML file — no Pretext dependency. Navigate using WASD + mouse, collect scattered fragments of Richard Wilbur's "Mind" poem. Includes procedural reverb, doppler-like panning, and VHS noise overlays.

**[ECHO // WORDAR](demos/wordar.html)** — First-person 3D raycaster where Wilbur's "Mind" is physically typeset onto the maze walls. Pretext's `layoutNextLine()` pre-wraps the poem into lines that tile across wall surfaces as ASCII characters. A full spatial audio engine with reverb generates crystalline pings that shift in timbre and harmonic complexity based on your proximity to poem nodes. Fire projectiles (SPACE / click) to create expanding sonar pulses that illuminate the text.

**[Bat Echo](demos/bat-echo.html)** — Echolocate through a procedurally generated cave maze to find all 12 lines of "Mind" scattered as individual fragments. Hold click for a continuous echolocation cone; press SPACE for bouncing pulses. Each fragment's text flows into the available room width at its location using `layoutNextLine()`. Found fragments persist as dim glows. Find all 12 to assemble the complete poem.

**[ECHO // BAT](demos/bat.html)** — Top-down generative echolocation experience across a massive procedural cave (400×400 grid). Hold the mouse to cast scanning rays that gradually paint a persistent LiDAR map of the cave structure. Poem fragments are placed at random distances and revealed by scanning. Features a deeply calming audio system: ASMR-filtered clicks for scanning, sub-bass heartbeat guidance pulses, and warm cascading collection chords with 5-second reverb tails.

### Consciousness Modes

**[Spotlight Consciousness](demos/spotlight.html)** — A focused reading mode implementing the "spotlight" theory of attention. Mouse position drives a tunnel-vision effect: lines near the cursor are bright and sharp, lines farther away dim to near-invisibility. Text is laid out with `layoutWithLines()` at an adjustable column width (via slider). A "Deep Focus" toggle narrows the spotlight to a single line. Based on Geertz's preface on the relationship between anthropology and philosophy.

**[Lantern Consciousness](demos/lantern.html)** — The complement to Spotlight: an open, associational reading mode inspired by Alison Gopnik's "lantern consciousness" — the wide, diffuse awareness of a child. The same Geertz text is laid out via `layoutWithLines()`, but floating marginalia (associative thoughts, creative leaps, cross-references) appear alongside each paragraph as you scroll. A "Let Mind Wander" toggle activates ambient particles and reveals all marginalia simultaneously, simulating mind-wandering during reading.

### Culture · Mind · Brain

**[Extended Cultural Brain Synthesis](demos/cultural-brain.html)** — A cybernetic wiring diagram connecting hyperstition manifesto fragments with Geertz's anthropological texts. Two text registers (monospace manifesto, serif Geertz) are laid out side-by-side using `layoutWithLines()` and flow automatically into multiple columns. Keywords like "culture," "brain," "somatic," and "Cartesian" are highlighted and connected by SVG bezier curves — a literal visualization of the conceptual wiring between disciplines. Column width and gap are adjustable.

**[The Cartesian Breach](demos/cartesian-breach.html)** — Three discipline containers (Anthropology, Psychology, Neurology) hold different Geertz passages, each laid out via `layoutNextLine()`. Walls between containers have integrity (0–1). Drag the "Gage spike" cursor across a wall to erode it. As integrity drops below 0.5, adjacent containers merge — their texts concatenate and Pretext reflows the combined text across the unified region in real-time. At 0% integrity, all three merge into a single "CULTURE · MIND · BRAIN" field. A live-action demonstration of dissolving the Cartesian mind-body boundary.

**[The Cartesian Breach V2](demos/cartesian-breach-v2.html)** — Extends the breach concept to a 2×2 grid: Anthropology, Psychology, Neurology, and Sociology. A vertical and horizontal cross-wall can be independently eroded. Breaching the vertical wall merges columns horizontally (Anthropology ↔ Psychology, Neurology ↔ Sociology). Breaching the horizontal wall merges rows vertically (Anthropology ↕ Neurology, Psychology ↕ Sociology). Both breached: a unified four-discipline field.

### Celestial

**[Power of a Moon](demos/power-of-a-moon.html)** — A luminous moon sits in a parallax star field. Five narrative "epochs" from a lunar science-fiction chronicle orbit as floating text fragments. Click the moon to cycle through all 8 phases (New → Waxing Crescent → Full → Waning → New). Text from the active epoch flows *into the illuminated crescent shape* using `layoutNextLine()` — each line's available width is computed from the chord length of the circular cross-section at that Y position, masked to only the lit portion. The arc layout updates in real-time as the phase changes.

## The source text

The demos draw primarily from two bodies of text:

- **Clifford Geertz** — "Culture, Mind, Brain" and the preface to *Available Light*. Geertz's anthropological writing on the dissolution of disciplinary boundaries, the relationship between culture and cognition, and the impossibility of a context-independent mind.
- **Richard Wilbur** — "Mind" (1956). A 12-line poem comparing the mind to a bat navigating a cave by echolocation: *"Mind in its purest play is like some bat / That beats about in caverns all alone."* The poem's final line — *"A graceful error may correct the cave"* — gives the demo suite its name.

Additional texts include a hyperstition manifesto on embodied cultural neuroscience, Antonio Damasio's somatic marker hypothesis, and an original lunar science-fiction chronicle.

## Getting started

### Prerequisites

- Node.js 18+ (no Bun required)

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see the landing page with all 11 demos.

### Production build

```bash
npm run build
```

The `dist/` folder is a fully self-contained static site (HTML + bundled JS). Pretext's layout engine is bundled as a shared ~28 KB chunk (9 KB gzipped). No runtime dependencies — deploy anywhere.

### Deploy

The built `dist/` folder works on any static host:

- **GitHub Pages** — push `dist/` to a `gh-pages` branch
- **Vercel / Netlify** — point at the repo, set build command to `npm run build`, output directory to `dist`
- **Any web server** — just serve the folder

## Architecture

```
cave-demos/
├── index.html              Root landing page
├── package.json            @chenglou/pretext + Vite
├── vite.config.ts          Multi-page auto-discovery
├── tsconfig.json           Browser-only TypeScript
└── demos/
    ├── orca-lidar.html/.ts     2D pulse-bounce LiDAR engine
    ├── voabar.html             Self-contained 3D raycaster (no Pretext)
    ├── wordar.html/.ts         3D raycaster with text-on-walls
    ├── bat-echo.html/.ts       Echolocation poem discovery
    ├── bat.html/.ts            Generative top-down scanner
    ├── spotlight.html/.ts      Focused attention reading mode
    ├── lantern.html/.ts        Diffuse attention reading mode
    ├── cultural-brain.html/.ts Cybernetic keyword wiring
    ├── cartesian-breach.html/.ts    3-panel wall-erosion demo
    ├── cartesian-breach-v2.html/.ts 4-panel 2×2 grid variant
    └── power-of-a-moon.html/.ts    Lunar arc text layout
```

Every demo except Voabar imports from `@chenglou/pretext`. The Vite config auto-discovers all `demos/*.html` files as entry points — add a new `.html` + `.ts` pair to `demos/` and it appears automatically.

## Controls

Most demos use keyboard + mouse on desktop and touch on mobile:

| Input | Action |
|-------|--------|
| **WASD** | Move (raycasting/exploration demos) |
| **Mouse** | Aim / look direction |
| **Click / Hold** | Scan / echolocate |
| **SPACE** | Fire pulse / sonar projectile |
| **Touch (left half)** | Virtual joystick movement |
| **Touch (right half)** | Aim + scan |

Spotlight and Lantern use mouse hover and scroll. The Cartesian Breach demos use click-and-drag. Power of a Moon uses click to cycle phases.

## Credits

- **[Pretext](https://github.com/chenglou/pretext)** by Cheng Lou — the layout engine powering all of this
- **Sebastian Markbåge** — original [text-layout](https://github.com/chenglou/text-layout) prototype
- **Clifford Geertz** — source texts from *Available Light* and "Culture, Mind, Brain"
- **Richard Wilbur** — "Mind" (1956)
- **Antonio Damasio** — somatic marker hypothesis referenced in the breach demos

## License

This demo suite is provided as-is for educational and experimental purposes. The underlying Pretext library is published on npm as `@chenglou/pretext`.
