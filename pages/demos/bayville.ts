/**
 * BAYVILLE · Cognitive Cartography — Real OSM + Pretext
 *
 * Single-source-of-truth architecture:
 * - Real OpenStreetMap building footprints + street geometry
 * - 2D: Leaflet tiles with SVG polygon overlays
 * - 3D: Raycaster grid rasterized from the SAME OSM polygons
 * - Pretext: Flows narrative text in popups and on raycaster walls
 */

import { prepareWithSegments, layoutWithLines } from '../../src/layout.js'
// @ts-ignore — JSON import
import osmData from './bayville-geo.json'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface Highway { name: string; type: string; coords: [number, number][] }
interface GeoData { highways: Highway[]; buildings: [number, number][][] }
const geo: GeoData = osmData as any

// ═══════════════════════════════════════════════════════════════
// MEMORY NODES — narrative anchors on the real map
// ═══════════════════════════════════════════════════════════════
interface MemoryNode {
  id: string; name: string; badge: string
  color: string; textColor: string
  lat: number; lng: number
  text: string; historicalText?: string
  isPhantom?: boolean
}

const MEMORY_NODES: MemoryNode[] = [
  { id:'origin', name:'The Great Cliff', badge:'ORIGIN · 90 MOUNTAIN',
    color:'#3F535E', textColor:'#6a8a9a', lat:40.9030, lng:-73.5606,
    text:'origin', historicalText:'origin_hist' },
  { id:'river', name:'The Metal River', badge:'ARTERIAL · BAYVILLE AVE',
    color:'#C97A2C', textColor:'#daa050', lat:40.9055, lng:-73.5580,
    text:'river', historicalText:'river_hist' },
  { id:'haven', name:'Safe Haven', badge:'DESTINATION · 11 EAST',
    color:'#3E6B48', textColor:'#5aaa6a', lat:40.9065, lng:-73.5553,
    text:'haven', historicalText:'haven_hist' },
  { id:'bramble', name:'The Forbidden Shortcut', badge:'1653 WRIGHT LINE',
    color:'#4a6a3a', textColor:'#6a9a5a', lat:40.9045, lng:-73.5585,
    text:'bramble', historicalText:'bramble_hist' },
  { id:'danger', name:'The Danger Radius', badge:'SPATIAL AVOIDANCE',
    color:'#8B4A4A', textColor:'#aa6a6a', lat:40.9060, lng:-73.5545,
    text:'danger', historicalText:'danger_hist' },
  { id:'phantom', name:'The Phantom Factory', badge:'INDUSTRIAL VOID',
    color:'#6a4a6a', textColor:'#aa6aaa', lat:40.9058, lng:-73.5590, isPhantom:true,
    text:'phantom', historicalText:'phantom_hist' },
]

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let viewMode: 'map' | 'lidar' = 'map'
let temporalMode = false
let showMinimap = true // always on by default
const keys: Record<string, boolean> = {}

// ═══════════════════════════════════════════════════════════════
// COORDINATE PROJECTION (shared between 2D SVG and 3D grid)
// ═══════════════════════════════════════════════════════════════
const BOUNDS = { latMin: 40.9018, latMax: 40.9078, lngMin: -73.5620, lngMax: -73.5520 }
const MW = 128, MH = 128 // higher res grid for real building detail

function toGrid(lat: number, lng: number): [number, number] {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * MW
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * MH
  return [Math.max(0, Math.min(MW - 1, Math.round(x))), Math.max(0, Math.min(MH - 1, Math.round(y)))]
}

function toLatLng(gx: number, gy: number): [number, number] {
  const lat = BOUNDS.latMax - (gy / MH) * (BOUNDS.latMax - BOUNDS.latMin)
  const lng = BOUNDS.lngMin + (gx / MW) * (BOUNDS.lngMax - BOUNDS.lngMin)
  return [lat, lng]
}

// ═══════════════════════════════════════════════════════════════
// RASTERIZE OSM → RAYCASTER GRID
// Inverted model: everything OPEN, buildings are walls.
// Roads are the natural space between buildings — wide and walkable.
// ═══════════════════════════════════════════════════════════════
const rmap: number[] = new Array(MW * MH).fill(0) // 0 = open/walkable
// Surface type grid: 0=ground, 1=road, 2=trail/path, 3=water
const smap = new Uint8Array(MW * MH)

/** Draw a line of given width into the grid */
function drawLine(x0: number, y0: number, x1: number, y1: number, w: number, val: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1
  const hw = Math.floor(w / 2)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const cx = Math.round(x0 + (x1 - x0) * t), cy = Math.round(y0 + (y1 - y0) * t)
    for (let dy = -hw; dy <= hw; dy++)
      for (let dx = -hw; dx <= hw; dx++) {
        const fx = cx + dx, fy = cy + dy
        if (fx >= 0 && fx < MW && fy >= 0 && fy < MH) rmap[fy * MW + fx] = val
      }
  }
}

/** Scanline polygon fill */
function fillPolygon(poly: [number, number][], val: number) {
  const gridPts = poly.map(p => toGrid(p[0], p[1]))
  let minY = MH, maxY = 0
  for (const [, gy] of gridPts) { minY = Math.min(minY, gy); maxY = Math.max(maxY, gy) }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = []
    for (let i = 0; i < gridPts.length - 1; i++) {
      const [x0, y0] = gridPts[i], [x1, y1] = gridPts[i + 1]
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        const x = x0 + (y - y0) / (y1 - y0) * (x1 - x0)
        xs.push(Math.round(x))
      }
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i < xs.length - 1; i += 2)
      for (let x = xs[i]; x <= xs[i + 1]; x++)
        if (x >= 0 && x < MW && y >= 0 && y < MH) rmap[y * MW + x] = val
  }
}

function rasterizeOSM() {
  // Start everything OPEN — you're walking on the ground
  rmap.fill(0)

  // 1. Buildings become walls — outlines + filled interiors
  for (const bldg of geo.buildings) {
    // Fill interior
    fillPolygon(bldg, 1)
    // Draw thick outline so walls have depth in the raycaster
    for (let i = 0; i < bldg.length - 1; i++) {
      const [ax, ay] = toGrid(bldg[i][0], bldg[i][1])
      const [bx, by] = toGrid(bldg[i + 1][0], bldg[i + 1][1])
      drawLine(ax, ay, bx, by, 2, 1)
    }
  }

  // 2. Perimeter wall — keep player inside the map bounds
  for (let i = 0; i < MW; i++) {
    rmap[i] = 1; rmap[(MH - 1) * MW + i] = 1                  // top + bottom
    rmap[1 * MW + i] = 1; rmap[(MH - 2) * MW + i] = 1         // second row
  }
  for (let j = 0; j < MH; j++) {
    rmap[j * MW] = 1; rmap[j * MW + MW - 1] = 1               // left + right
    rmap[j * MW + 1] = 1; rmap[j * MW + MW - 2] = 1           // second col
  }

  // 3. Ensure roads are clear + mark surface types (punch through any overlap)
  for (const road of geo.highways) {
    const isTrail = road.type === 'footway' || road.type === 'path' || road.type === 'cycleway' || road.type === 'pedestrian' || road.type === 'steps'
    const surfaceType: number = isTrail ? 2 : 1
    for (let i = 0; i < road.coords.length - 1; i++) {
      const [ax, ay] = toGrid(road.coords[i][0], road.coords[i][1])
      const [bx, by] = toGrid(road.coords[i + 1][0], road.coords[i + 1][1])
      // Roads punch open — wider than building outlines
      drawLine(ax, ay, bx, by, 3, 0)
      // Mark surface type
      const lineSteps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2 + 1
      for (let s = 0; s <= lineSteps; s++) {
        const t = s / lineSteps
        const cx2 = Math.round(ax + (bx - ax) * t), cy2 = Math.round(ay + (by - ay) * t)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const fx2 = cx2 + dx, fy2 = cy2 + dy
            if (fx2 >= 0 && fx2 < MW && fy2 >= 0 && fy2 < MH && rmap[fy2 * MW + fx2] === 0)
              smap[fy2 * MW + fx2] = surfaceType
          }
      }
    }
  }

  // 3.5 Water: Bayville is coastal — mark top rows as Long Island Sound
  for (let y = 0; y < Math.min(8, MH); y++)
    for (let x = 0; x < MW; x++)
      if (rmap[y * MW + x] === 0) smap[y * MW + x] = 3

  // 4. Memory nodes always walkable
  for (const node of MEMORY_NODES) {
    const [gx, gy] = toGrid(node.lat, node.lng)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const fx = gx + dx, fy = gy + dy
        if (fx > 1 && fx < MW - 2 && fy > 1 && fy < MH - 2) rmap[fy * MW + fx] = 0
      }
  }
}

rasterizeOSM()

// ═══════════════════════════════════════════════════════════════
// LEAFLET MAP + SVG OVERLAY
// ═══════════════════════════════════════════════════════════════
const mapDiv = document.getElementById('map-container')!
const L = (window as any).L

const fieldMap = L.map(mapDiv, { zoomControl: false, attributionControl: false })
  .setView([40.9050, -73.5570], 16)

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19, className: 'map-tiles-dark',
}).addTo(fieldMap)

const modernGroup = L.layerGroup().addTo(fieldMap)
const historyGroup = L.layerGroup()

// Draw REAL streets as SVG polylines on the map
for (const road of geo.highways) {
  const color = road.name === 'Bayville Avenue' ? '#C97A2C' :
                road.name === 'Shore Road' ? '#4a6a7a' :
                road.name === 'Godfrey Avenue' ? '#4a6a7a' : '#2B3A42'
  const weight = road.name === 'Bayville Avenue' ? 4 : 2
  L.polyline(road.coords, { color, weight, opacity: 0.6 }).addTo(modernGroup)
    .bindTooltip(road.name || road.type, { permanent: false, className: 'road-tooltip' })
}

// Draw REAL buildings as SVG polygons
for (const bldg of geo.buildings) {
  L.polygon(bldg, {
    color: '#3F535E', fillColor: '#2B3A42', fillOpacity: 0.4, weight: 1, opacity: 0.5,
  }).addTo(modernGroup)
}

// Walking route (the child's path)
L.polyline([
  [40.9030,-73.5606],[40.9040,-73.5598],[40.9050,-73.5594],
  [40.9055,-73.5580],[40.9054,-73.5565],[40.9053,-73.5550],
  [40.9060,-73.5552],[40.9065,-73.5553],
], { color: '#ff8c00', weight: 3, dashArray: '6,6', opacity: 0.8 }).addTo(modernGroup)

// Ghost route on history layer
L.polyline([
  [40.9025,-73.5610],[40.9035,-73.5598],[40.9040,-73.5590],
  [40.9045,-73.5585],[40.9050,-73.5575],[40.9055,-73.5565],[40.9060,-73.5555],
], { color: '#8B6B4A', weight: 2, dashArray: '3,5', opacity: 0.8 }).addTo(historyGroup)

// Wright estate perimeter
L.polygon([[40.9070,-73.5560],[40.9070,-73.5530],[40.9055,-73.5530],[40.9055,-73.5560]], {
  color: '#8B6B4A', fillColor: '#8B6B4A', fillOpacity: 0.1, weight: 1,
}).addTo(historyGroup)

// Memory node markers with pretext popups
const POPUP_FONT = '12px Courier New'
function pretextPopup(node: MemoryNode): string {
  // Node .text is now a lore key — resolve to actual prose
  const loreKey = temporalMode && LORE_FULL[node.id + '_hist'] ? node.id + '_hist' : node.id
  const text = LORE_FULL[loreKey] || node.text
  let rendered = text
  try { const p = prepareWithSegments(text, POPUP_FONT); const l = layoutWithLines(p, 240, 16); rendered = l.lines.map(l => l.text).join('<br>') } catch {}
  return `<div class="pretext-popup">
    <span class="zone-title" style="color:${node.textColor}">${node.badge}</span>
    <div class="pretext-body">${rendered}</div>
    <button class="enter-lidar" onclick="window.__enterLidar(${node.lat},${node.lng})">◉ ENTER LIDAR HERE</button>
  </div>`
}

MEMORY_NODES.forEach(node => {
  const cls = node.isPhantom ? 'phantom-marker' : 'memory-marker'
  const bg = node.isPhantom ? '' : `background-color:${node.color};`
  const icon = L.divIcon({ className: '', html: `<div class="${cls}" style="${bg}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })
  L.marker([node.lat, node.lng], { icon })
    .bindPopup(() => pretextPopup(node), { maxWidth: 300 })
    .addTo(modernGroup)
  // Also on history
  L.marker([node.lat, node.lng], { icon: L.divIcon({ className: '', html: `<div class="ghost-marker" style="background-color:${node.color};"></div>`, iconSize: [16,16], iconAnchor: [8,8] }) })
    .bindPopup(() => pretextPopup(node), { maxWidth: 300 })
    .addTo(historyGroup)
})

fieldMap.fitBounds([[40.9020,-73.5615],[40.9075,-73.5525]], { padding: [30, 30] })

// ═══════════════════════════════════════════════════════════════
// PLAYER
// ═══════════════════════════════════════════════════════════════
const [startX, startY] = toGrid(40.9030, -73.5606)
const player = { x: startX + 0.5, y: startY + 0.5, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0, speed: 0.08, rotSpeed: 0.04 }

// ═══════════════════════════════════════════════════════════════
// CANVAS
// ═══════════════════════════════════════════════════════════════
const canvas = document.getElementById('lidar-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
let cw = 0, ch = 0
function resize() { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight }
resize(); window.addEventListener('resize', () => { resize(); fieldMap.invalidateSize() })

// ═══════════════════════════════════════════════════════════════
// PRETEXT WALL TEXT CACHE
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MOUNTAIN LORE — Golden-Shield architecture: zone-keyed corpus
// Each zone has multi-paragraph continuous prose, not repeated sentences.
// ═══════════════════════════════════════════════════════════════
const MOUNTAIN_LORE: Record<string, string[]> = {
  origin: [
    'At four years old, shoe velocity is negligible. The paved driveway is not a gentle 8-degree slope — it is a treacherous, near-vertical cliff requiring extreme caution. The child\'s center of mass sits high. The surface coefficient of friction is uncertain. Free-body diagrams apply.',
    'Ninety Mountain Road. The house number is painted on the curb in fading white stencil. The driveway ascends at what an adult measures as 8 degrees but what the body knows as vertical. There is a crack in the second slab from the top where a dandelion has established a permanent colony.',
    'The garage door has four panels. The upper panels have small windows. One window has a spider web that has persisted through two winters. The web catches morning light at 7:14 AM in July. The spider is long dead. The architecture remains.',
    'From the bottom of the driveway, the house appears enormous. From the street, it appears ordinary. This discrepancy is the first lesson in perspective. The child does not know the word perspective. The child knows that the same house is two sizes.',
    'The mailbox is a black metal cylinder on a wooden post. The post leans 3 degrees toward the road. Inside the mailbox: a Penny Saver, a ConEd bill, a catalogue from a seed company in Vermont. These documents constitute the public-facing identity of the structure. The house itself says nothing.',
  ],
  origin_hist: [
    'This parcel sits within the original 1653 Wright family land grant. Peter Wright purchased this tract from the Matinecock people during the founding of Oyster Bay. The deed was filed in the Oyster Bay town records under Crown Patent.',
    'The Matinecock had occupied this headland for at least 4,000 years prior. Their settlement patterns followed the shellfish cycle. The land conveyed to Wright was not, in any meaningful sense, "empty" — it was a managed landscape of controlled burns, clam gardens, and seasonal camps.',
    'Wright\'s surveyor drew the boundary using a compass and chain. The line ran from a "great rock at the water\'s edge" to "ye old oak at the hill." Neither the rock nor the oak survives. The line persists as a property boundary.',
    'Between 1710 and 1820, the parcel changed hands six times. Each deed references the previous deed. The chain of title is unbroken. The chain of understanding is not.',
  ],
  river: [
    'To a 4-year-old, this local artery is an impassable, roaring river of giant steel machines. The crossing signal is a deity whose word must be obeyed absolutely. Green means live. Red means die. The child does not know the word "traffic." The child knows the word "danger."',
    'Bayville Avenue carries 4,200 vehicles per day. Each vehicle weighs between 3,000 and 6,000 pounds. To a 36-inch-tall human, each vehicle is a building moving at 35 miles per hour. The road is not a surface. It is an event.',
    'The crossing takes 14 seconds. The walk signal lasts 22 seconds. The margin of safety is 8 seconds. The child does not count. The child watches the orange hand. When the hand appears, the child\'s stomach drops. The hand is not a hand. It is a verdict.',
    'There is a storm drain at the southwest corner of the intersection. The grate is made of iron bars spaced 1.5 inches apart. Through the gaps: darkness, the sound of water, and the smell of a world beneath the world. Do not step on the grate. You will fall through. This is known.',
    'The yellow centerline is painted fresh every April. By August it has faded to a pale suggestion. By December it has become archaeological. The paint layer is the most recent stratum of a surface that has been continuously maintained since the colonial cart road was paved in 1924.',
  ],
  river_hist: [
    'Bayville Avenue follows the path of a colonial cart road connecting the Wright and Townsend farmsteads. The road was widened in 1924 for automobile traffic. The original ruts of the cart road are 14 inches below the current asphalt surface.',
    'In 1847, the road was known as "the Shore Road to Centre Island." The name changed when the hamlet of Bayville was incorporated. The hamlet took its name from the bay, which took its name from the Dutch word for inlet. The inlet took no name from anyone.',
  ],
  haven: [
    'The safe haven. This "epic journey" covers merely 0.15 miles. But to the child, arrival here was the completion of a great odyssey. The lawn is green and flat. There is a sprinkler that creates a temporary rainbow at 2:00 PM when the sun angle is correct.',
    'Eleven East Avenue. The house is white clapboard with green shutters. Each shutter has a decorative pine tree cutout that serves no structural purpose. The pine trees are approximately 8 inches tall. They cast shadows the size of playing cards.',
    'The front porch has three rockers. Each rocker has been repainted more times than anyone can remember. The outermost layer is forest green. Beneath that: white. Beneath that: a blue whose name has been discontinued by the manufacturer.',
    'The journey from 90 Mountain to 11 East passes through the Metal River, the Forbidden Shortcut, and the Danger Radius. Each segment has its own physics. Each segment has its own gods. Arrival is not guaranteed. Arrival is earned.',
  ],
  haven_hist: [
    'East Avenue marks the eastern boundary of the original Wright plantation. The road follows a surveyor\'s line established in 1671. The line was disputed three times between 1690 and 1740. Each dispute was settled by walking the boundary with neighbors and marking trees.',
  ],
  bramble: [
    'A bramble path thought to be inhabited by monsters. The thorns are alive. Every child knows you do not go this way. The path runs between two properties along a fence that has partially collapsed. The collapsed section has been colonized by blackberry canes thick as fingers.',
    'The monsters are not metaphorical. The child has heard sounds from the bramble path at dusk. The sounds have no clear animal source. They could be raccoons. They could be something else. The distinction is irrelevant because the path is forbidden in either case.',
    'In November, after the leaves fall, the bramble path becomes partially visible from the street. The fence posts lean at angles that suggest decades of frost heave. There is a rusted bicycle wheel wedged between two posts. The wheel has been there longer than the child has been alive.',
    'The bramble produces berries in August. The berries are edible. The child knows this. The child also knows that eating the berries requires entering the bramble. The cost-benefit analysis is performed annually. The berries are never picked.',
  ],
  bramble_hist: [
    'The child\'s "monster zone" is a deep-time echo of the 1653 surveyor\'s line drawn by Peter Wright. The bramble path runs along what was once the formal boundary of the land grant. The "monsters" are the ghosts of a legal fiction: the idea that land can be owned.',
  ],
  danger: [
    'A massive danger radius around a neighbor\'s loud dog. The dog is definitely a wolf. Its bark activates a primal fear circuit that bypasses all rational thought. The radius extends approximately 200 feet in all directions from the dog\'s yard. This radius is non-negotiable.',
    'The dog is a German Shepherd named Duke. Duke weighs 85 pounds. To the child, Duke weighs approximately 500 pounds and stands seven feet tall at the shoulder. Duke\'s teeth are the size of kitchen knives. This is not an exaggeration. This is perception.',
    'The avoidance protocol requires crossing to the opposite side of the street 150 feet before reaching Duke\'s property line, maintaining maximum distance while traversing the danger zone, and not re-crossing until 150 feet past the far border. Total deviation: 0.08 miles.',
    'Duke died in 1989. The danger radius persisted until 1993, when the family moved. Even after the family moved, the child — now 9 — would cross the street at that location out of residual habit. The body remembers what the mind has released.',
  ],
  danger_hist: [
    'The child\'s avoidance arc overlays the lost stone foundations of an early Wright family outbuilding, circa 1710. The outbuilding was likely a smoke house or storage shed. Its footprint is approximately 12 by 16 feet. The stones were removed in 1890 and reused in a sea wall.',
  ],
  phantom: [
    'A phantom industrial site. The Maximilion Arnold corset manufactory. No foundation remains. The coordinates shift depending on which archive is queried. The factory made corsets from 1878 to 1912. Thirty-four years of boned fabric, shaped to contain the female body.',
    'Arnold employed between 12 and 40 women, depending on the season and the source. The Bayville Historical Society says 12. The 1890 census says 23. A letter in the Oyster Bay archives mentions "upwards of 40 hands." The discrepancy has not been resolved.',
    'The factory building was wood-frame, two stories, with a loading dock facing the road. The second floor had large windows for light. The sewing machines were powered by a single steam engine connected by an overhead belt system. The belts were leather. The leather came from a tannery in Huntington.',
    'After the factory closed in 1912, the building was used as a storage facility, then a chicken coop, then allowed to collapse. By 1940, the last timbers had been removed for firewood. The site is now indistinguishable from the surrounding lots. The corsets outlived the factory.',
  ],
  phantom_hist: [
    'The Arnold Corset Works operated from 1878 to 1912. The factory\'s coordinates shift depending on which archive is queried. Sanborn maps place it 50 feet east of the current lot line. The tax assessor\'s records place it 50 feet west. The discrepancy is approximately one building wide.',
  ],
  building: [
    'Residential. The paint is flaking. The mailbox is overflowing with circulars dated three months prior. Someone lives here. Someone always lives here. The steps are concrete. The railing is iron. The numbers on the door were applied by the builder and have never been replaced. The doorbell has not worked since the Carter administration. Visitors knock.',
    'A structure oriented toward the street. Four walls. A roof with three layers of shingle, each from a different decade. The purpose is containment. The windows face south. The door faces the street like all doors on this block face the street. A bicycle chain hangs from the porch rail. The chain is rusted to the rail. The bicycle was sold in 2003.',
    'Built in the last century. Repaired in this one. The foundation remembers what the surface has forgotten. There is a crawl space beneath the kitchen floor where the dirt is older than the town charter. The joists are hand-hewn. The nails are square. A field mouse has established a nest in the northeast corner of the crawl space. The nest is made of shredded newspaper.',
    'Windows reflect the sky. The sky does not notice. The building endures indifferently. In the back yard there is a clothesline strung between two T-shaped poles. The grass beneath it is worn to dirt. A ceramic gnome guards the garden border. The gnome is missing its fishing rod. The fishing rod was broken by a child in 1997. The child does not remember.',
    'Address unknown. Occupant unknown. The building exists as pure geometry. Grid cell. Wall. Shadow. A single light burns on the second floor at unpredictable hours. The curtains are drawn. The property tax records list a holding company registered in Mineola. The holding company was incorporated in 1988. Its stated purpose is "real estate management."',
    'The foundation dates to 1923. Fieldstone and Portland cement. The original owners were farming people who sold eggs from a roadside stand. The stand is gone. The eggs are gone. The road remains. The building remembers being closer to the water. In 1923, high tide reached the back fence. Now high tide stops 400 feet short. The land did not move. The reference frame shifted.',
    'Clapboard siding. Some original, some vinyl replacement circa 1987. The color is described in the hardware store catalog as "colonial blue" but reads closer to a faded institutional gray. Three generations have called this address home without once repainting the shutters. The shutters are decorative. They do not close. They have never closed.',
    'This lot was subdivided in 1954 from a larger parcel. The deed references a stone wall that no longer exists and a white oak that fell in the nor\'easter of 1992. The current structure occupies 40% of the buildable area. The setback violations were grandfathered. The roof line is 2 inches below the zoning maximum. The 2 inches were not accidental.',
  ],
}

// Pre-join into continuous prose per zone (like golden-shield's LORE_FULL)
const LORE_FULL: Record<string, string> = {}
for (const [k, v] of Object.entries(MOUNTAIN_LORE)) {
  LORE_FULL[k] = v.join(' ')
}

// ═══════════════════════════════════════════════════════════════
// PRETEXT CACHE — Golden-Shield architecture
// Three-axis cache: key|width|fontSize. Prepares at EXACT render size.
// ═══════════════════════════════════════════════════════════════
const wallLineCache = new Map<string, string[]>()

function getWallLines(loreKey: string, width: number, fontSize?: number): string[] {
  const fs = fontSize || 13
  const font = `${fs}px Courier New`
  const cacheKey = `${loreKey}_${Math.round(width)}_${fs}`
  if (wallLineCache.has(cacheKey)) return wallLineCache.get(cacheKey)!
  const text = LORE_FULL[loreKey] || ''
  if (!text || width < 10) return []
  try {
    const prepared = prepareWithSegments(text, font)
    const lh = Math.ceil(fs * 1.3)
    const result = layoutWithLines(prepared, Math.max(40, Math.round(width)), lh)
    const lines = result.lines.map(l => l.text)
    wallLineCache.set(cacheKey, lines)
    return lines
  } catch { return [] }
}

let time = 0

// ═══════════════════════════════════════════════════════════════
// WALL TEXT RESOLVER — Returns a lore KEY, not inflated text
// ═══════════════════════════════════════════════════════════════
function getWallLoreKey(mx: number, my: number): { key: string; color: string; label: string } {
  // 1. Near memory node?
  const near = MEMORY_NODES.find(n => {
    const [nx, ny] = toGrid(n.lat, n.lng)
    return Math.abs(mx - nx) < 8 && Math.abs(my - ny) < 8
  })
  if (near) {
    const key = temporalMode && LORE_FULL[near.id + '_hist'] ? near.id + '_hist' : near.id
    return { key, color: near.textColor, label: near.badge }
  }
  // 2. Generic building — rotate through building lore
  return { key: 'building', color: '#6a7a8a', label: `BAYVILLE · ${mx},${my}` }
}

// ═══════════════════════════════════════════════════════════════
// SKY STARS — letters from the narrative drifting overhead
// ═══════════════════════════════════════════════════════════════
interface SkyStar { x: number; y: number; size: number; brightness: number; speed: number; phase: number; char: string }
const skyStars: SkyStar[] = []
function seedStars() {
  skyStars.length = 0
  const allText = MEMORY_NODES.map(n => n.text).join(' ').replace(/\s+/g, '')
  const chars = allText.length > 0 ? allText : 'BAYVILLECOGNITIVECARTOGRAPHY'
  for (let i = 0; i < 150; i++) {
    skyStars.push({
      x: Math.random() * cw,
      y: Math.random() * ch * 0.48,
      size: Math.random() < 0.15 ? 8 : 6,
      brightness: 0.15 + Math.random() * 0.5,
      speed: 0.3 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      char: chars[Math.floor(Math.random() * chars.length)]!,
    })
  }
}
seedStars()

// ═══════════════════════════════════════════════════════════════
// RAYCASTER RENDER
// ═══════════════════════════════════════════════════════════════
function renderLidar() {
  ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, cw, ch)

  // ═══ SKY — gradient + text stars ═══
  const sky = ctx.createLinearGradient(0, 0, 0, ch / 2)
  sky.addColorStop(0, temporalMode ? '#1a150d' : '#060810')
  sky.addColorStop(1, temporalMode ? '#2a2015' : '#0c1018')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch / 2)

  // Text stars
  ctx.font = '6px Courier New'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (const s of skyStars) {
    const twinkle = Math.sin(time * 0.02 * s.speed + s.phase)
    const alpha = s.brightness * (0.6 + 0.4 * twinkle)
    if (alpha < 0.05) continue
    ctx.globalAlpha = alpha
    ctx.fillStyle = temporalMode ? '#daa050' : '#aabbdd'
    ctx.font = `${s.size}px Courier New`
    ctx.fillText(s.char, s.x, s.y)
    s.x += Math.sin(time * 0.005 + s.phase) * 0.15
    if (s.x < -10) s.x = cw + 10
    if (s.x > cw + 10) s.x = -10
  }
  ctx.globalAlpha = 1

  // ═══ GROUND — zone-colored gradient ═══
  const gnd = ctx.createLinearGradient(0, ch / 2, 0, ch)
  gnd.addColorStop(0, temporalMode ? '#15120a' : '#0a0c06')
  gnd.addColorStop(1, temporalMode ? '#201a10' : '#141810')
  ctx.fillStyle = gnd; ctx.fillRect(0, ch / 2, cw, ch / 2)

  // ═══ FLOOR CASTING — roads, trails, water on the ground plane ═══
  const floorStripW = 4
  const halfH = ch / 2
  for (let x = 0; x < cw; x += floorStripW) {
    const camX = 2 * x / cw - 1
    const rayDX = player.dirX + player.planeX * camX
    const rayDY = player.dirY + player.planeY * camX

    for (let y = Math.floor(halfH) + 1; y < ch; y += 2) {
      const rowDist = halfH / (y - halfH)
      if (rowDist > 20) continue

      const floorX = player.x + rowDist * rayDX
      const floorY = player.y + rowDist * rayDY
      const cellX = Math.floor(floorX)
      const cellY = Math.floor(floorY)

      if (cellX < 0 || cellX >= MW || cellY < 0 || cellY >= MH) continue
      const surface = smap[cellY * MW + cellX]
      if (surface === 0) continue

      const fog = Math.max(0, 1 - rowDist / 18)
      if (fog < 0.05) continue

      let r = 0, g = 0, b = 0
      if (surface === 1) { r = 35; g = 38; b = 42 }
      else if (surface === 2) { r = 45; g = 35; b = 22 }
      else if (surface === 3) {
        const shimmer = Math.sin(floorX * 3 + floorY * 2 + time * 0.08) * 0.15
        r = 8; g = 20 + shimmer * 30 | 0; b = 55 + shimmer * 40 | 0
      }

      ctx.globalAlpha = fog * 0.7
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, floorStripW, 2)
    }
  }
  ctx.globalAlpha = 1

  // Ground-level zone glow
  const pNear = MEMORY_NODES.find(n => {
    const [nx, ny] = toGrid(n.lat, n.lng)
    return Math.abs(player.x - nx) < 12 && Math.abs(player.y - ny) < 12
  })
  if (pNear) {
    const gzg = ctx.createRadialGradient(cw / 2, ch, 0, cw / 2, ch, ch / 2)
    gzg.addColorStop(0, pNear.color + '30')
    gzg.addColorStop(0.5, pNear.color + '10')
    gzg.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.6; ctx.fillStyle = gzg; ctx.fillRect(0, ch / 2, cw, ch / 2)
    ctx.globalAlpha = 1
  }

  // ═══ RAYCASTING ═══
  const stripW = 2, numRays = Math.ceil(cw / stripW)
  const faces: any[] = []
  let curFace: any = null

  for (let i = 0; i < numRays; i++) {
    const camX = 2 * i / numRays - 1
    const rdx = player.dirX + player.planeX * camX, rdy = player.dirY + player.planeY * camX
    let mx = Math.floor(player.x), my = Math.floor(player.y)
    const ddx = Math.abs(1 / (rdx || 1e-10)), ddy = Math.abs(1 / (rdy || 1e-10))
    let stepX: number, stepY: number, sdx: number, sdy: number
    if (rdx < 0) { stepX = -1; sdx = (player.x - mx) * ddx } else { stepX = 1; sdx = (mx + 1 - player.x) * ddx }
    if (rdy < 0) { stepY = -1; sdy = (player.y - my) * ddy } else { stepY = 1; sdy = (my + 1 - player.y) * ddy }

    let side = 0, hit = false
    for (let s = 0; s < 128; s++) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0 } else { sdy += ddy; my += stepY; side = 1 }
      if (mx < 0 || mx >= MW || my < 0 || my >= MH) break
      if (rmap[my * MW + mx] === 1) { hit = true; break }
    }
    if (!hit) {
      if (curFace) { faces.push(curFace); curFace = null }
      continue
    }

    const dist = side === 0
      ? (mx - player.x + (1 - stepX) / 2) / (rdx || 1e-10)
      : (my - player.y + (1 - stepY) / 2) / (rdy || 1e-10)
    const wallH = Math.min(ch * 2, ch / (dist || 0.01))
    const wallTop = (ch - wallH) / 2

    // Wall base color — resolve lore key, not inflated text
    const wallInfo = getWallLoreKey(mx, my)
    const tc = wallInfo.color.replace('#', '')
    let r = parseInt(tc.slice(0,2),16)||43, g = parseInt(tc.slice(2,4),16)||58, b = parseInt(tc.slice(4,6),16)||66
    if (temporalMode) { r = Math.min(255, r + 40); g = Math.min(255, g + 20); b = Math.max(0, b - 10) }

    const fog = Math.max(0, 1 - dist / 20), shade = side === 0 ? fog : fog * 0.7
    ctx.fillStyle = `rgb(${Math.floor(r*shade)},${Math.floor(g*shade)},${Math.floor(b*shade)})`
    ctx.fillRect(i * stripW, wallTop, stripW, wallH)

    // ═══ FACE GROUPING — ALL walls get text ═══
    if (dist < 14) {
      if (!curFace || curFace.mx !== mx || curFace.my !== my || curFace.side !== side) {
        if (curFace) faces.push(curFace)
        curFace = {
          mx, my, side, loreKey: wallInfo.key, color: wallInfo.color, label: wallInfo.label,
          tc, shade, dist,
          startX: i * stripW, endX: i * stripW + stripW,
          top1: wallTop, bot1: wallTop + wallH, top2: wallTop, bot2: wallTop + wallH
        }
      } else {
        curFace.endX = i * stripW + stripW
        curFace.top2 = wallTop
        curFace.bot2 = wallTop + wallH
      }
    } else {
      if (curFace) { faces.push(curFace); curFace = null }
    }
  }
  if (curFace) faces.push(curFace)

  // ═══ PRETEXT WALL TEXT — Golden-Shield quality rendering ═══
  let centerFace: any = null
  let bestScore = -1
  for (const face of faces) {
    const fW = face.endX - face.startX
    const screenCenterDist = Math.abs((face.startX + face.endX) / 2 - cw / 2)
    const score = fW * 2 - screenCenterDist - face.dist * 20
    if (fW > 60 && score > bestScore) { bestScore = score; centerFace = face }
  }

  for (const face of faces) {
    const faceW = face.endX - face.startX
    if (faceW < 10) continue
    const inscribedTop = Math.max(face.top1, face.top2)
    const inscribedBot = Math.min(face.bot1, face.bot2)
    const faceH = inscribedBot - inscribedTop
    if (faceH < 20) continue

    const isCenter = face === centerFace
    const bright = Math.max(0.15, 1 - face.dist / 14) * (face.side === 1 ? 0.7 : 1)

    ctx.save()
    ctx.beginPath()
    ctx.rect(face.startX, inscribedTop, faceW, faceH)
    ctx.clip()

    const fontSize = isCenter
      ? Math.max(12, Math.min(18, faceH / 16))
      : Math.max(5, Math.min(12, faceH / 10))
    const lh = fontSize * 1.35
    const padding = isCenter ? Math.max(12, fontSize) : Math.max(3, fontSize * 0.4)

    const textW = Math.max(10, faceW - padding * 2)
    // Golden-Shield architecture: prepare at EXACT render fontSize
    const allLines = getWallLines(face.loreKey, textW, fontSize)
    if (!allLines.length) { ctx.restore(); continue }

    // Offset into text based on wall position — each face shows different lines
    const faceHash = (face.mx * 7 + face.my * 3 + face.side * 13) % Math.max(1, allLines.length)
    const offsetLines: string[] = []
    for (let li = 0; li < allLines.length; li++) {
      offsetLines.push(allLines[(faceHash + li) % allLines.length]!)
    }

    if (isCenter && faceW > 60) {
      // ── CENTER FACE: Contrast overlay + header + border ──
      ctx.globalAlpha = 0.94
      ctx.fillStyle = temporalMode ? '#0d0a06' : '#050508'
      ctx.fillRect(face.startX, inscribedTop, faceW, faceH)

      const borderColor = face.color
      ctx.fillStyle = borderColor; ctx.globalAlpha = 0.7
      ctx.fillRect(face.startX, inscribedTop, faceW, 2)
      ctx.fillRect(face.startX, inscribedBot - 2, faceW, 2)
      ctx.fillRect(face.startX, inscribedTop, 2, faceH)
      ctx.fillRect(face.endX - 2, inscribedTop, 2, faceH)

      ctx.globalAlpha = 0.85; ctx.font = 'bold 11px Courier New'
      ctx.fillStyle = borderColor; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(face.label, face.startX + padding, inscribedTop + 6)

      ctx.font = `${fontSize}px Courier New`
      let ly = inscribedTop + 22, lineIdx = 0
      while (ly < inscribedBot - 4 && lineIdx < offsetLines.length) {
        ctx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)
        ctx.fillStyle = '#e8e0d0'
        ctx.fillText(offsetLines[lineIdx]!, face.startX + padding, ly)
        ly += lh; lineIdx++
      }

      ctx.font = 'bold 9px Courier New'; ctx.fillStyle = '#0fa'; ctx.globalAlpha = 0.4
      ctx.fillText(`PRETEXT · ${offsetLines.length} LINES`, face.startX + padding, inscribedBot - 12)

    } else {
      // ── PERIPHERAL WALLS: Text as shimmering material ──
      ctx.font = `${fontSize}px Courier New`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = '#d4cfc0'
      let ly = inscribedTop + 2, lineIdx = 0
      while (ly < inscribedBot && lineIdx < offsetLines.length) {
        ctx.globalAlpha = bright * (0.55 + 0.15 * Math.sin(lineIdx * 0.5 + time * 0.3))
        ctx.fillText(offsetLines[lineIdx]!, face.startX + padding, ly)
        ly += lh; lineIdx++
      }
    }

    ctx.globalAlpha = bright * 0.4; ctx.fillStyle = face.color
    ctx.fillRect(face.startX, inscribedTop, 1, faceH)
    ctx.fillRect(face.endX - 1, inscribedTop, 1, faceH)
    ctx.restore()
  }

  // ═══ MINIMAP — Vector-rendered OSM polygons (matches Leaflet map) ═══
  if (showMinimap) {
    const ms = Math.min(220, Math.max(160, cw / 2.5)), mmx = cw - ms - 10, mmy = 10
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#080a0e'; ctx.fillRect(mmx - 2, mmy - 2, ms + 4, ms + 4)
    ctx.strokeStyle = 'rgba(200,155,94,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(mmx - 2, mmy - 2, ms + 4, ms + 4)

    // Coordinate transform: lat/lng → minimap pixel
    const toMM = (lat: number, lng: number): [number, number] => {
      const px = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * ms
      const py = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * ms
      return [mmx + px, mmy + py]
    }

    // Ground fill
    ctx.fillStyle = '#111418'
    ctx.fillRect(mmx, mmy, ms, ms)

    // ── Water: Long Island Sound at top ──
    const waterDepth = 8 / MH * ms // match the 8-row water zone
    ctx.fillStyle = '#0a2040'
    ctx.fillRect(mmx, mmy, ms, waterDepth)
    ctx.strokeStyle = '#1a4a80'; ctx.lineWidth = 0.5
    ctx.strokeRect(mmx, mmy, ms, waterDepth)
    ctx.font = '6px Courier New'; ctx.fillStyle = '#3a7acc'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('LONG ISLAND SOUND', mmx + ms / 2, mmy + waterDepth / 2)
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'

    // ── Road + trail centerlines (under buildings) ──
    for (const road of geo.highways) {
      if (road.coords.length < 2) continue
      const isTrail = road.type === 'footway' || road.type === 'path' || road.type === 'cycleway' || road.type === 'pedestrian' || road.type === 'steps'
      if (isTrail) {
        ctx.strokeStyle = '#4a3520'
        ctx.lineWidth = 0.6
        ctx.setLineDash([2, 2])
      } else {
        ctx.strokeStyle = '#2a3a4a'
        ctx.lineWidth = road.type === 'motorway' || road.type === 'trunk' ? 1.5 : 0.8
        ctx.setLineDash([])
      }
      ctx.beginPath()
      const [sx, sy] = toMM(road.coords[0][0], road.coords[0][1])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < road.coords.length; i++) {
        const [rx, ry] = toMM(road.coords[i][0], road.coords[i][1])
        ctx.lineTo(rx, ry)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])

    // ── Building polygons (filled + outlined) ──
    for (const bldg of geo.buildings) {
      if (bldg.length < 3) continue
      let bldgColor = '#1c2228'
      let bldgStroke = '#2a3a44'
      const cx = bldg.reduce((s: number, p: [number, number]) => s + p[1], 0) / bldg.length
      const cy = bldg.reduce((s: number, p: [number, number]) => s + p[0], 0) / bldg.length
      const nearNode = MEMORY_NODES.find(n => Math.abs(cy - n.lat) < 0.002 && Math.abs(cx - n.lng) < 0.002)
      if (nearNode) {
        const h = nearNode.color.replace('#', '')
        const nr = parseInt(h.slice(0,2),16), ng = parseInt(h.slice(2,4),16), nb = parseInt(h.slice(4,6),16)
        bldgColor = `rgb(${nr * 0.2 | 0},${ng * 0.2 | 0},${nb * 0.2 | 0})`
        bldgStroke = nearNode.color + '55'
      }
      ctx.fillStyle = bldgColor
      ctx.strokeStyle = bldgStroke
      ctx.lineWidth = 0.5
      ctx.beginPath()
      const [bx0, by0] = toMM(bldg[0][0], bldg[0][1])
      ctx.moveTo(bx0, by0)
      for (let i = 1; i < bldg.length; i++) {
        const [bx, by] = toMM(bldg[i][0], bldg[i][1])
        ctx.lineTo(bx, by)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // ── Memory node markers ──
    ctx.font = 'bold 8px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    for (const n of MEMORY_NODES) {
      const [nx, ny] = toMM(n.lat, n.lng)
      ctx.fillStyle = n.color; ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = n.textColor + 'cc'
      ctx.fillText(n.name.split(' ').slice(1).join(' ').substring(0, 12), nx + 5, ny - 3)
    }

    // ── Street name labels ──
    ctx.font = '7px Courier New'; ctx.fillStyle = '#4a6a7a55'
    const labeledNames = new Set<string>()
    for (const road of geo.highways) {
      if (!road.name || labeledNames.has(road.name) || road.coords.length < 2) continue
      labeledNames.add(road.name)
      const midIdx = Math.floor(road.coords.length / 2)
      const [lx, ly] = toMM(road.coords[midIdx][0], road.coords[midIdx][1])
      if (lx > mmx + 10 && lx < mmx + ms - 30 && ly > mmy + 5 && ly < mmy + ms - 5) {
        ctx.fillText(road.name.replace(' Avenue', ' Ave').replace(' Street', ' St').replace(' Road', ' Rd'), lx, ly)
      }
    }

    // ── Player dot + direction + FOV cone ──
    const cs = ms / MW
    const px2 = mmx + player.x * cs, py2 = mmy + player.y * cs
    ctx.fillStyle = '#ff8c00'; ctx.globalAlpha = 1
    ctx.beginPath(); ctx.arc(px2, py2, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 2; ctx.beginPath()
    ctx.moveTo(px2, py2); ctx.lineTo(px2 + player.dirX * 8, py2 + player.dirY * 8); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,140,0,0.15)'; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px2, py2); ctx.lineTo(px2 + (player.dirX + player.planeX) * 14, py2 + (player.dirY + player.planeY) * 14)
    ctx.moveTo(px2, py2); ctx.lineTo(px2 + (player.dirX - player.planeX) * 14, py2 + (player.dirY - player.planeY) * 14)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // ═══ PRETEXT GROUND PANEL — shows full narrative near memory nodes ═══
  const near = MEMORY_NODES.find(n => { const [nx, ny] = toGrid(n.lat, n.lng); return Math.abs(player.x - nx) < 8 && Math.abs(player.y - ny) < 8 })
  if (near) {
    const panelH = Math.min(100, ch * 0.15)
    const panelY = ch - panelH - 50
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, panelY, cw, panelH)
    ctx.strokeStyle = near.textColor + '40'; ctx.lineWidth = 1; ctx.strokeRect(0, panelY, cw, 1)

    // Badge line
    ctx.font = 'bold 10px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillStyle = near.textColor; ctx.fillText('◉ ' + near.badge, 14, panelY + 8)

    // Pretext-laid-out narrative body
    const loreKey = temporalMode && LORE_FULL[near.id + '_hist'] ? near.id + '_hist' : near.id
    const bodyLines = getWallLines(loreKey, Math.min(cw - 28, 600), 11)
    if (bodyLines.length) {
      ctx.font = '11px Courier New'; ctx.fillStyle = '#999'
      const maxLines = Math.min(bodyLines.length, Math.floor((panelH - 26) / 14))
      for (let li = 0; li < maxLines; li++) {
        const ln = bodyLines[li]
        if (ln?.trim()) ctx.fillText(ln, 14, panelY + 24 + li * 14)
      }
    }

    // Pretext attribution tag
    ctx.font = '8px Courier New'; ctx.fillStyle = '#444'; ctx.textAlign = 'right'
    ctx.fillText('text: pretext layout engine', cw - 14, panelY + panelH - 10)
    ctx.textAlign = 'left'
  }

  // HUD
  const [plat, plng] = toLatLng(player.x, player.y)
  document.getElementById('hud-coords')!.innerText = `${plat.toFixed(4)}°N ${Math.abs(plng).toFixed(4)}°W`
  document.getElementById('hud-mode')!.innerText = temporalMode ? 'LIDAR · 1653' : 'LIDAR · SUBJECTIVE'
  const angle = Math.atan2(player.dirX, -player.dirY)
  document.getElementById('hud-compass')!.innerText = ['N','NE','E','SE','S','SW','W','NW'][Math.round(((angle * 180 / Math.PI + 360) % 360) / 45) % 8]

  const hudZone = document.getElementById('hud-zone')!
  const infoText = document.getElementById('info-text')!
  if (near) {
    hudZone.innerText = near.name; hudZone.style.color = near.textColor
    const t = temporalMode && near.historicalText ? near.historicalText : near.text
    infoText.innerHTML = `<span class="zone-name" style="color:${near.textColor}">${near.badge}</span>${t}`
  } else { hudZone.innerText = 'BAYVILLE'; hudZone.style.color = '#4a6a7a' }
}

// ═══════════════════════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchView(mode: 'map' | 'lidar') {
  viewMode = mode
  document.getElementById('map-container')!.classList.toggle('hidden', mode === 'lidar')
  document.getElementById('lidar-canvas')!.classList.toggle('hidden', mode === 'map')
  document.getElementById('crosshair')!.classList.toggle('hidden', mode === 'map')
  document.getElementById('info-panel')!.classList.toggle('hidden', mode === 'map')
  document.getElementById('view-toggle')!.innerText = mode === 'map' ? '◉ ENTER LIDAR' : '◎ EXIT TO MAP'
  if (mode === 'map') { if (document.pointerLockElement) document.exitPointerLock(); fieldMap.invalidateSize(); fieldMap.panTo(toLatLng(player.x, player.y)) }
  const f = document.getElementById('temporal-flash')!
  f.innerText = mode === 'map' ? '◎ MAP VIEW' : '◉ LIDAR VIEW'; f.classList.add('visible')
  setTimeout(() => f.classList.remove('visible'), 1200)
}

;(window as any).__enterLidar = (lat: number, lng: number) => {
  const [gx, gy] = toGrid(lat, lng); player.x = gx + 0.5; player.y = gy + 0.5; switchView('lidar')
}
document.getElementById('view-toggle')!.addEventListener('click', () => switchView(viewMode === 'map' ? 'lidar' : 'map'))

// ═══════════════════════════════════════════════════════════════
// MOVEMENT
// ═══════════════════════════════════════════════════════════════
function isWalkable(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  return ix >= 0 && ix < MW && iy >= 0 && iy < MH && rmap[iy * MW + ix] !== 1
}

function updatePlayer() {
  const sp = player.speed, rs = player.rotSpeed
  if (keys['w'] || keys['arrowup']) { const nx = player.x + player.dirX * sp, ny = player.y + player.dirY * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
  if (keys['s'] || keys['arrowdown']) { const nx = player.x - player.dirX * sp, ny = player.y - player.dirY * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
  if (keys['a']) { const nx = player.x + player.dirY * sp, ny = player.y - player.dirX * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
  if (keys['d']) { const nx = player.x - player.dirY * sp, ny = player.y + player.dirX * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
  if (keys['arrowleft'] || keys['q']) { const o = player.dirX; player.dirX = o*Math.cos(rs)-player.dirY*Math.sin(rs); player.dirY = o*Math.sin(rs)+player.dirY*Math.cos(rs); const p = player.planeX; player.planeX = p*Math.cos(rs)-player.planeY*Math.sin(rs); player.planeY = p*Math.sin(rs)+player.planeY*Math.cos(rs) }
  if (keys['arrowright'] || keys['e']) { const o = player.dirX; player.dirX = o*Math.cos(-rs)-player.dirY*Math.sin(-rs); player.dirY = o*Math.sin(-rs)+player.dirY*Math.cos(-rs); const p = player.planeX; player.planeX = p*Math.cos(-rs)-player.planeY*Math.sin(-rs); player.planeY = p*Math.sin(-rs)+player.planeY*Math.cos(-rs) }
}

// ═══════════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════════
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true
  if (e.key.toLowerCase() === 'v') switchView(viewMode === 'map' ? 'lidar' : 'map')
  if (e.key.toLowerCase() === 't') {
    temporalMode = !temporalMode; wallTextCache.clear()
    if (temporalMode) { fieldMap.removeLayer(modernGroup); fieldMap.addLayer(historyGroup) }
    else { fieldMap.removeLayer(historyGroup); fieldMap.addLayer(modernGroup) }
    const f = document.getElementById('temporal-flash')!
    f.innerText = temporalMode ? '◈ 1653 · WRIGHT SURVEY' : '◉ SUBJECTIVE · AGE 4'
    f.classList.add('visible'); setTimeout(() => f.classList.remove('visible'), 1500)
  }
  if (e.key.toLowerCase() === 'm') showMinimap = !showMinimap
  const tp: Record<string,[number,number]> = { '1':toGrid(40.9030,-73.5606),'2':toGrid(40.9050,-73.5594),'3':toGrid(40.9055,-73.5580),'4':toGrid(40.9045,-73.5585),'5':toGrid(40.9065,-73.5553),'6':toGrid(40.9060,-73.5545) }
  if (tp[e.key]) { player.x = tp[e.key][0] + 0.5; player.y = tp[e.key][1] + 0.5 }
})
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })

let pointerLocked = false
let pointerLockCooldown = 0
canvas.addEventListener('click', () => {
  if (viewMode === 'lidar' && !pointerLocked && Date.now() > pointerLockCooldown) {
    canvas.requestPointerLock().catch(() => { /* browser throttle */ })
  }
})
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas
  if (!pointerLocked) pointerLockCooldown = Date.now() + 1200
})
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return; const r = -e.movementX * 0.002
  const o = player.dirX; player.dirX = o*Math.cos(r)-player.dirY*Math.sin(r); player.dirY = o*Math.sin(r)+player.dirY*Math.cos(r)
  const p = player.planeX; player.planeX = p*Math.cos(r)-player.planeY*Math.sin(r); player.planeY = p*Math.sin(r)+player.planeY*Math.cos(r)
})

// ═══════════════════════════════════════════════════════════════
// MOBILE TOUCH CONTROLS
// ═══════════════════════════════════════════════════════════════
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
let joyDx = 0, joyDy = 0
let lookDx = 0
const accentColor = '#C97A2C'

if (isMobile) {
  // ── Virtual joystick (bottom-left) ──
  const joyBase = document.createElement('div')
  Object.assign(joyBase.style, {
    position: 'fixed', bottom: '30px', left: '30px', width: '120px', height: '120px',
    borderRadius: '50%', border: `2px solid ${accentColor}44`,
    background: 'rgba(10,11,13,0.5)', zIndex: '30', touchAction: 'none',
    display: viewMode === 'lidar' ? 'block' : 'none'
  })
  const joyKnob = document.createElement('div')
  Object.assign(joyKnob.style, {
    position: 'absolute', top: '50%', left: '50%', width: '44px', height: '44px',
    marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%',
    background: `${accentColor}66`, border: `2px solid ${accentColor}aa`
  })
  joyBase.appendChild(joyKnob)
  document.body.appendChild(joyBase)

  let joyTouchId: number | null = null
  let joyCenterX = 0, joyCenterY = 0
  const JOY_RADIUS = 40

  joyBase.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault()
    const t = e.changedTouches[0]
    joyTouchId = t.identifier
    const rect = joyBase.getBoundingClientRect()
    joyCenterX = rect.left + rect.width / 2
    joyCenterY = rect.top + rect.height / 2
  }, { passive: false })

  window.addEventListener('touchmove', (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier === joyTouchId) {
        let dx = t.clientX - joyCenterX, dy = t.clientY - joyCenterY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > JOY_RADIUS) { dx = dx / dist * JOY_RADIUS; dy = dy / dist * JOY_RADIUS }
        joyDx = dx / JOY_RADIUS; joyDy = dy / JOY_RADIUS
        joyKnob.style.marginLeft = (dx - 22) + 'px'
        joyKnob.style.marginTop = (dy - 22) + 'px'
      }
    }
  }, { passive: false })

  const resetJoy = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId) {
        joyTouchId = null; joyDx = 0; joyDy = 0
        joyKnob.style.marginLeft = '-22px'; joyKnob.style.marginTop = '-22px'
      }
    }
  }
  window.addEventListener('touchend', resetJoy); window.addEventListener('touchcancel', resetJoy)

  // ── Look-drag on right half ──
  let lookTouchId: number | null = null
  let lookLastX = 0

  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.clientX > window.innerWidth * 0.35 && t.identifier !== joyTouchId && lookTouchId === null) {
        lookTouchId = t.identifier; lookLastX = t.clientX; e.preventDefault()
      }
    }
  }, { passive: false })

  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier === lookTouchId) {
        lookDx = -(t.clientX - lookLastX) * 0.004; lookLastX = t.clientX; e.preventDefault()
      }
    }
  }, { passive: false })

  const resetLook = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId) { lookTouchId = null; lookDx = 0 }
    }
  }
  canvas.addEventListener('touchend', resetLook); canvas.addEventListener('touchcancel', resetLook)

  // ── Mobile action bar (bottom-right) ──
  const bar = document.createElement('div')
  Object.assign(bar.style, {
    position: 'fixed', bottom: '30px', right: '16px', zIndex: '30',
    display: 'flex', flexDirection: 'column', gap: '10px',
  })

  function mobileBtn(label: string, onClick: () => void, color?: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    const c = color || accentColor
    Object.assign(b.style, {
      background: 'rgba(10,11,13,0.7)', border: `1px solid ${c}66`, borderRadius: '10px',
      padding: '10px 14px', fontFamily: 'Courier New, monospace', fontSize: '10px',
      fontWeight: 'bold', letterSpacing: '1px', color: c, cursor: 'pointer',
      minWidth: '52px', textAlign: 'center'
    })
    b.addEventListener('click', onClick)
    return b
  }

  const btnView = mobileBtn('◉ 3D', () => switchView(viewMode === 'map' ? 'lidar' : 'map'))
  const btnTime = mobileBtn('TIME', () => {
    temporalMode = !temporalMode; wallLineCache.clear()
    if (temporalMode) { fieldMap.removeLayer(modernGroup); fieldMap.addLayer(historyGroup) }
    else { fieldMap.removeLayer(historyGroup); fieldMap.addLayer(modernGroup) }
    const f = document.getElementById('temporal-flash')!
    f.innerText = temporalMode ? '◈ 1653 COLONIAL' : '◉ MODERN VIEW'
    f.classList.add('visible'); setTimeout(() => f.classList.remove('visible'), 1500)
  }, '#8B6B4A')
  const btnMini = mobileBtn('MAP+', () => { showMinimap = !showMinimap })
  bar.append(btnView, btnTime, btnMini)

  // Zone teleport buttons
  const zones: Array<{ name: string, lat: number, lng: number, color: string }> = [
    { name: 'SCH', lat: 40.9030, lng: -73.5606, color: '#4A90D9' },
    { name: 'BCH', lat: 40.9050, lng: -73.5594, color: '#E8C547' },
    { name: 'PIR', lat: 40.9055, lng: -73.5580, color: '#D4A574' },
    { name: 'HAR', lat: 40.9045, lng: -73.5585, color: '#6B8E23' },
    { name: 'CRK', lat: 40.9065, lng: -73.5553, color: '#20B2AA' },
    { name: 'MAR', lat: 40.9060, lng: -73.5545, color: '#8B4513' },
  ]
  zones.forEach(z => {
    const b = mobileBtn(z.name, () => {
      const [gx, gy] = toGrid(z.lat, z.lng); player.x = gx + 0.5; player.y = gy + 0.5
      if (viewMode === 'map') switchView('lidar')
    }, z.color)
    bar.appendChild(b)
  })
  document.body.appendChild(bar)

  // View switch toggles
  const origSwitch = switchView
  // @ts-ignore — extending the function
  switchView = (mode: 'map' | 'lidar') => {
    origSwitch(mode)
    joyBase.style.display = mode === 'lidar' ? 'block' : 'none'
    btnView.textContent = mode === 'map' ? '◉ 3D' : '◎ MAP'
  }
}

// ═══════════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════════
function gameLoop() {
  time++
  if (viewMode === 'lidar') {
    updatePlayer()
    // Apply mobile joystick + look
    if (isMobile) {
      const sp = player.speed
      if (Math.abs(joyDy) > 0.1) {
        const f = -joyDy
        const nx = player.x + player.dirX * sp * f, ny = player.y + player.dirY * sp * f
        if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny
      }
      if (Math.abs(joyDx) > 0.1) {
        const nx = player.x - player.dirY * sp * joyDx, ny = player.y + player.dirX * sp * joyDx
        if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny
      }
      if (Math.abs(lookDx) > 0.001) {
        const r = lookDx, o = player.dirX
        player.dirX = o*Math.cos(r)-player.dirY*Math.sin(r); player.dirY = o*Math.sin(r)+player.dirY*Math.cos(r)
        const p = player.planeX
        player.planeX = p*Math.cos(r)-player.planeY*Math.sin(r); player.planeY = p*Math.sin(r)+player.planeY*Math.cos(r)
        lookDx = 0
      }
    }
    renderLidar()
  }
  requestAnimationFrame(gameLoop)
}
gameLoop()
