/**
 * Cognitive Cartography Engine — Universal Factory
 * 
 * Shared dual-mode (2D Leaflet + 3D raycaster) engine.
 * Each location imports this and passes its config + OSM data.
 */

import { prepareWithSegments, layoutWithLines } from '../../src/layout.js'

export interface MemoryNode {
  id: string; name: string; badge: string
  color: string; textColor: string
  lat: number; lng: number
  text: string; historicalText?: string
  isPhantom?: boolean
}

export interface StreetLore {
  text: string; historicalText: string; color: string
}

export interface CartographyConfig {
  title: string
  center: [number, number]
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }
  zoom: number
  gridSize: number
  memoryNodes: MemoryNode[]
  streetLore: Record<string, StreetLore>
  defaultLore: StreetLore
  temporalLabel: string
  accentColor: string
  waterZones?: { lat: number; lng: number; radius: number; name?: string }[]
  loreParagraphs?: Record<string, string[]>
  osmData: { highways: { name: string; type: string; coords: [number, number][] }[]; buildings: [number, number][][] }
}

export function createCartographyEngine(config: CartographyConfig) {
  const { bounds, gridSize: GS, memoryNodes, streetLore, defaultLore, osmData: geo, accentColor } = config
  const MW = GS, MH = GS

  // ═══ PROJECTION ═══
  function toGrid(lat: number, lng: number): [number, number] {
    const x = ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * MW
    const y = ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * MH
    return [Math.max(0, Math.min(MW - 1, Math.round(x))), Math.max(0, Math.min(MH - 1, Math.round(y)))]
  }
  function toLatLng(gx: number, gy: number): [number, number] {
    return [bounds.latMax - (gy / MH) * (bounds.latMax - bounds.latMin),
            bounds.lngMin + (gx / MW) * (bounds.lngMax - bounds.lngMin)]
  }

  // ═══ RASTERIZE ═══
  const rmap = new Array(MW * MH).fill(0)
  // Surface type grid: 0=ground, 1=road, 2=trail/path, 3=water
  const smap = new Uint8Array(MW * MH)
  const streetGrid: (string | null)[] = new Array(MW * MH).fill(null)

  function drawLine(x0: number, y0: number, x1: number, y1: number, w: number, val: number, streetName?: string) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1
    const hw = Math.floor(w / 2)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = Math.round(x0 + (x1 - x0) * t), cy = Math.round(y0 + (y1 - y0) * t)
      for (let dy = -hw; dy <= hw; dy++)
        for (let dx = -hw; dx <= hw; dx++) {
          const fx = cx + dx, fy = cy + dy
          if (fx >= 0 && fx < MW && fy >= 0 && fy < MH) {
            rmap[fy * MW + fx] = val
            if (streetName) streetGrid[fy * MW + fx] = streetName
          }
        }
    }
  }

  function fillPolygon(poly: [number, number][], val: number) {
    const pts = poly.map(p => toGrid(p[0], p[1]))
    let minY = MH, maxY = 0
    for (const [, gy] of pts) { minY = Math.min(minY, gy); maxY = Math.max(maxY, gy) }
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = []
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(Math.round(x0 + (y - y0) / (y1 - y0) * (x1 - x0)))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i < xs.length - 1; i += 2)
        for (let x = xs[i]; x <= xs[i + 1]; x++)
          if (x >= 0 && x < MW && y >= 0 && y < MH) rmap[y * MW + x] = val
    }
  }

  // Build the grid
  rmap.fill(0)
  for (const bldg of geo.buildings) {
    fillPolygon(bldg, 1)
    for (let i = 0; i < bldg.length - 1; i++) {
      const [ax, ay] = toGrid(bldg[i][0], bldg[i][1])
      const [bx, by] = toGrid(bldg[i + 1][0], bldg[i + 1][1])
      drawLine(ax, ay, bx, by, 2, 1)
    }
  }
  // Perimeter
  for (let i = 0; i < MW; i++) { rmap[i] = 1; rmap[(MH-1)*MW+i] = 1; rmap[MW+i] = 1; rmap[(MH-2)*MW+i] = 1 }
  for (let j = 0; j < MH; j++) { rmap[j*MW] = 1; rmap[j*MW+MW-1] = 1; rmap[j*MW+1] = 1; rmap[j*MW+MW-2] = 1 }
  // Roads clear + street names + surface types baked in
  for (const road of geo.highways) {
    const isTrail = road.type === 'footway' || road.type === 'path' || road.type === 'cycleway' || road.type === 'pedestrian' || road.type === 'steps'
    const surfaceType: number = isTrail ? 2 : 1
    for (let i = 0; i < road.coords.length - 1; i++) {
      const [ax, ay] = toGrid(road.coords[i][0], road.coords[i][1])
      const [bx, by] = toGrid(road.coords[i + 1][0], road.coords[i + 1][1])
      drawLine(ax, ay, bx, by, 3, 0, road.name || undefined)
      // Mark surface type along road
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2 + 1
      const hw = isTrail ? 1 : 1
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx2 = Math.round(ax + (bx - ax) * t), cy2 = Math.round(ay + (by - ay) * t)
        for (let dy = -hw; dy <= hw; dy++)
          for (let dx = -hw; dx <= hw; dx++) {
            const fx2 = cx2 + dx, fy2 = cy2 + dy
            if (fx2 >= 0 && fx2 < MW && fy2 >= 0 && fy2 < MH && rmap[fy2 * MW + fx2] === 0) {
              smap[fy2 * MW + fx2] = surfaceType
            }
          }
      }
    }
  }
  // Water zones — circular water bodies
  if (config.waterZones) {
    for (const wz of config.waterZones) {
      const [wcx, wcy] = toGrid(wz.lat, wz.lng)
      const wr = Math.round(wz.radius * MW / (bounds.lngMax - bounds.lngMin) * 0.00001 * 111000)
      const gridR = Math.max(3, Math.round(wz.radius / ((bounds.latMax - bounds.latMin) / MH * 111000)))
      for (let dy = -gridR; dy <= gridR; dy++)
        for (let dx = -gridR; dx <= gridR; dx++) {
          if (dx * dx + dy * dy <= gridR * gridR) {
            const fx2 = wcx + dx, fy2 = wcy + dy
            if (fx2 >= 2 && fx2 < MW - 2 && fy2 >= 2 && fy2 < MH - 2) {
              rmap[fy2 * MW + fx2] = 0 // walkable (or not — water could block)
              smap[fy2 * MW + fx2] = 3 // water
            }
          }
        }
    }
  }
  // Memory nodes walkable
  for (const n of memoryNodes) {
    const [gx, gy] = toGrid(n.lat, n.lng)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const fx = gx + dx, fy = gy + dy
        if (fx > 1 && fx < MW - 2 && fy > 1 && fy < MH - 2) rmap[fy * MW + fx] = 0
      }
  }

  // ═══ PLAYER ═══
  const [startX, startY] = toGrid(config.center[0], config.center[1])
  const player = { x: startX + 0.5, y: startY + 0.5, dirX: 0, dirY: -1, planeX: 0.66, planeY: 0, speed: 0.08, rotSpeed: 0.04 }

  // ═══ STATE ═══
  let viewMode: 'map' | 'lidar' = 'map'
  let temporalMode = false
  let showMinimap = true
  let time = 0
  const keys: Record<string, boolean> = {}

  // ═══ LEAFLET ═══
  const mapDiv = document.getElementById('map-container')!
  const L = (window as any).L
  const fieldMap = L.map(mapDiv, { zoomControl: false, attributionControl: false }).setView(config.center, config.zoom)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, className: 'map-tiles-dark' }).addTo(fieldMap)
  const modernGroup = L.layerGroup().addTo(fieldMap)
  const historyGroup = L.layerGroup()

  // Streets
  for (const road of geo.highways) {
    const lore = streetLore[road.name]
    const color = lore?.color || '#2B3A42'
    L.polyline(road.coords, { color, weight: 2, opacity: 0.6 }).addTo(modernGroup)
      .bindTooltip(road.name || road.type, { permanent: false })
  }
  // Buildings
  for (const bldg of geo.buildings) {
    L.polygon(bldg, { color: '#3F535E', fillColor: '#2B3A42', fillOpacity: 0.4, weight: 1, opacity: 0.5 }).addTo(modernGroup)
  }

  // Memory node markers
  const POPUP_FONT = '12px Courier New'
  function pretextPopup(node: MemoryNode): string {
    const text = temporalMode && node.historicalText ? node.historicalText : node.text
    let rendered = text
    try { const l = layoutWithLines(prepareWithSegments(text, POPUP_FONT), 240, 16); rendered = l.lines.map(l => l.text).join('<br>') } catch {}
    return `<div class="pretext-popup"><span class="zone-title" style="color:${node.textColor}">${node.badge}</span><div class="pretext-body">${rendered}</div><button class="enter-lidar" onclick="window.__enterLidar(${node.lat},${node.lng})">◉ ENTER LIDAR HERE</button></div>`
  }
  memoryNodes.forEach(node => {
    const cls = node.isPhantom ? 'phantom-marker' : 'memory-marker'
    const bg = node.isPhantom ? '' : `background-color:${node.color};`
    L.marker([node.lat, node.lng], { icon: L.divIcon({ className: '', html: `<div class="${cls}" style="${bg}"></div>`, iconSize: [20,20], iconAnchor: [10,10] }) })
      .bindPopup(() => pretextPopup(node), { maxWidth: 300 }).addTo(modernGroup)
    L.marker([node.lat, node.lng], { icon: L.divIcon({ className: '', html: `<div class="ghost-marker" style="background-color:${node.color};"></div>`, iconSize: [16,16], iconAnchor: [8,8] }) })
      .bindPopup(() => pretextPopup(node), { maxWidth: 300 }).addTo(historyGroup)
  })
  fieldMap.fitBounds([[bounds.latMin, bounds.lngMin], [bounds.latMax, bounds.lngMax]], { padding: [30, 30] })

  // ═══ CANVAS ═══
  const canvas = document.getElementById('lidar-canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  let cw = 0, ch = 0
  function resize() { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight }
  resize(); window.addEventListener('resize', () => { resize(); fieldMap.invalidateSize() })

  // ═══ MOUNTAIN LORE — Golden-Shield architecture ═══
  // Build zone-keyed corpus from config. Each node gets multi-paragraph prose. No ◈ repetition.
  const MOUNTAIN_LORE: Record<string, string[]> = {}
  const BUILDING_LORE: string[] = [
    'Residential. The paint is flaking. The mailbox is overflowing with circulars dated three months prior. Someone lives here. Someone always lives here. The steps are concrete. The railing is iron. The numbers on the door were applied by the builder and have never been replaced. The doorbell has not worked since the Carter administration. Visitors knock.',
    'A structure oriented toward the street. Four walls. A roof with three layers of shingle, each from a different decade. The purpose is containment. The windows face south. The door faces the street like all doors on this block face the street. A bicycle chain hangs from the porch rail. The chain is rusted to the rail. The bicycle was sold in 2003.',
    'Built in the last century. Repaired in this one. The foundation remembers what the surface has forgotten. There is a crawl space beneath the kitchen floor where the dirt is older than the town charter. The joists are hand-hewn. The nails are square. A field mouse has established a nest in the northeast corner. The nest is made of shredded newspaper.',
    'Windows reflect the sky. The sky does not notice. The building endures indifferently. In the back yard there is a clothesline strung between two T-shaped poles. The grass beneath it is worn to dirt. A ceramic gnome guards the garden border. The gnome is missing its fishing rod. The fishing rod was broken by a child in 1997.',
    'Address unknown. Occupant unknown. The building exists as pure geometry. Grid cell. Wall. Shadow. A single light burns on the second floor at unpredictable hours. The curtains are drawn. The property tax records list a holding company registered in Mineola. Its stated purpose is \"real estate management.\"',
    'The foundation dates to 1923. Fieldstone and Portland cement. The original owners were farming people who sold eggs from a roadside stand. The stand is gone. The eggs are gone. The road remains. The building remembers being closer to the water. In 1923, high tide reached the back fence. Now high tide stops 400 feet short.',
    'Clapboard siding. Some original, some vinyl replacement circa 1987. The color is described in the hardware store catalog as \"colonial blue\" but reads closer to a faded institutional gray. Three generations have called this address home without once repainting the shutters. The shutters are decorative. They do not close.',
    'This lot was subdivided in 1954 from a larger parcel. The deed references a stone wall that no longer exists and a white oak that fell in the nor\'easter of 1992. The current structure occupies 40% of the buildable area. The setback violations were grandfathered. The roof line is 2 inches below the zoning maximum.',
  ]
  MOUNTAIN_LORE['building'] = BUILDING_LORE

  // Populate from config memory nodes
  for (const n of memoryNodes) {
    MOUNTAIN_LORE[n.id] = [n.text]
    if (n.historicalText) MOUNTAIN_LORE[n.id + '_hist'] = [n.historicalText]
  }
  // Populate from street lore
  for (const [name, lore] of Object.entries(streetLore)) {
    const key = 'street_' + name.replace(/\s+/g, '_').toLowerCase()
    MOUNTAIN_LORE[key] = [name + ' — ' + lore.text]
    if (lore.historicalText) MOUNTAIN_LORE[key + '_hist'] = [name + ' — ' + lore.historicalText]
  }
  // Default lore
  MOUNTAIN_LORE['default_street'] = [defaultLore.text]
  MOUNTAIN_LORE['default_street_hist'] = [defaultLore.historicalText]

  // Override with external multi-paragraph corpus if provided
  if (config.loreParagraphs) {
    for (const [k, v] of Object.entries(config.loreParagraphs)) {
      if (v.length > 0) MOUNTAIN_LORE[k] = v
    }
  }

  // Pre-join into continuous prose per zone (like golden-shield's LORE_FULL)
  const LORE_FULL: Record<string, string> = {}
  for (const [k, v] of Object.entries(MOUNTAIN_LORE)) {
    LORE_FULL[k] = v.join(' ')
  }

  // ═══ PRETEXT CACHE — Golden-Shield architecture ═══
  // Three-axis cache: key|width|fontSize. Prepares at EXACT render size.
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

  // ═══ WALL TEXT RESOLVER — Returns a lore KEY, not inflated text ═══
  function getWallLoreKey(mx: number, my: number): { key: string; color: string; label: string } {
    // 1. Near memory node?
    const near = memoryNodes.find(n => { const [nx, ny] = toGrid(n.lat, n.lng); return Math.abs(mx - nx) < 8 && Math.abs(my - ny) < 8 })
    if (near) {
      const key = temporalMode && LORE_FULL[near.id + '_hist'] ? near.id + '_hist' : near.id
      return { key, color: near.textColor, label: near.badge || near.name }
    }
    // 2. Adjacent cell has a street name?
    for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const s = streetGrid[(my + (dy as number)) * MW + (mx + (dx as number))]
      if (s) {
        const sKey = 'street_' + s.replace(/\s+/g, '_').toLowerCase()
        const lore = streetLore[s] || defaultLore
        const key = temporalMode && LORE_FULL[sKey + '_hist'] ? sKey + '_hist' : sKey
        return { key, color: lore.color, label: s }
      }
    }
    // 3. Generic building
    return { key: 'building', color: '#4a5a6a', label: config.title }
  }

  // ═══ RAYCASTER ═══
  function renderLidar() {
    ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, cw, ch)
    const sky = ctx.createLinearGradient(0, 0, 0, ch / 2)
    sky.addColorStop(0, temporalMode ? '#1a150d' : '#060810')
    sky.addColorStop(1, temporalMode ? '#2a2015' : '#0c1018')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch / 2)
    // Ground base (will be overdrawn by floor casting)
    const gnd = ctx.createLinearGradient(0, ch / 2, 0, ch)
    gnd.addColorStop(0, temporalMode ? '#15120a' : '#0a0c06')
    gnd.addColorStop(1, temporalMode ? '#201a10' : '#141810')
    ctx.fillStyle = gnd; ctx.fillRect(0, ch / 2, cw, ch / 2)

    // ═══ FLOOR CASTING — roads, trails, water on the ground plane ═══
    const floorStripW = 4 // render every 4th column for performance
    const halfH = ch / 2
    for (let x = 0; x < cw; x += floorStripW) {
      const camX = 2 * x / cw - 1
      const rayDX = player.dirX + player.planeX * camX
      const rayDY = player.dirY + player.planeY * camX

      for (let y = Math.floor(halfH) + 1; y < ch; y += 2) {
        const rowDist = halfH / (y - halfH)
        if (rowDist > 20) continue // skip very distant floor

        const floorX = player.x + rowDist * rayDX
        const floorY = player.y + rowDist * rayDY
        const cellX = Math.floor(floorX)
        const cellY = Math.floor(floorY)

        if (cellX < 0 || cellX >= MW || cellY < 0 || cellY >= MH) continue
        const surface = smap[cellY * MW + cellX]
        if (surface === 0) continue // bare ground — keep gradient

        const fog = Math.max(0, 1 - rowDist / 18)
        if (fog < 0.05) continue

        let r = 0, g = 0, b = 0
        if (surface === 1) {
          // Road — dark gray asphalt
          r = 35; g = 38; b = 42
        } else if (surface === 2) {
          // Trail — warm brown earth
          r = 45; g = 35; b = 22
        } else if (surface === 3) {
          // Water — deep blue with shimmer
          const shimmer = Math.sin(floorX * 3 + floorY * 2 + time * 0.08) * 0.15
          r = 8; g = 20 + shimmer * 30 | 0; b = 55 + shimmer * 40 | 0
        }

        ctx.globalAlpha = fog * 0.7
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x, y, floorStripW, 2)
      }
    }
    ctx.globalAlpha = 1

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
      for (let s = 0; s < GS; s++) {
        if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0 } else { sdy += ddy; my += stepY; side = 1 }
        if (mx < 0 || mx >= MW || my < 0 || my >= MH) break
        if (rmap[my * MW + mx] === 1) { hit = true; break }
      }
      if (!hit) {
        if (curFace) { faces.push(curFace); curFace = null }
        continue
      }
      const dist = side === 0 ? (mx - player.x + (1 - stepX) / 2) / (rdx || 1e-10) : (my - player.y + (1 - stepY) / 2) / (rdy || 1e-10)
      const wallH = Math.min(ch * 2, ch / (dist || 0.01)), wallTop = (ch - wallH) / 2

      // Wall color — resolve lore key, not inflated text
      const wallInfo = getWallLoreKey(mx, my)
      const h = wallInfo.color
      let r = parseInt(h.slice(1,3),16)||43, g = parseInt(h.slice(3,5),16)||58, b = parseInt(h.slice(5,7),16)||66
      if (temporalMode) { r = Math.min(255, r + 40); g = Math.min(255, g + 20); b = Math.max(0, b - 10) }
      const fog = Math.max(0, 1 - dist / 20), shade = side === 0 ? fog : fog * 0.7
      ctx.fillStyle = `rgb(${Math.floor(r*shade)},${Math.floor(g*shade)},${Math.floor(b*shade)})`
      ctx.fillRect(i * stripW, wallTop, stripW, wallH)

      // Group face for text rendering
      if (dist < 14) {
        if (!curFace || curFace.mx !== mx || curFace.my !== my || curFace.side !== side) {
          if (curFace) faces.push(curFace)
          curFace = {
            mx, my, side, loreKey: wallInfo.key, color: wallInfo.color, label: wallInfo.label,
            startX: i * stripW, endX: i * stripW + stripW,
            top1: wallTop, bot1: wallTop + wallH,
            top2: wallTop, bot2: wallTop + wallH,
            dist, shade
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
    // Find center face (widest, closest to screen center)
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

      // Parse zone color
      const tc = face.color.replace('#', '')
      const cr = parseInt(tc.slice(0,2),16)||80, cg = parseInt(tc.slice(2,4),16)||100, cb = parseInt(tc.slice(4,6),16)||120

      // Font scales with distance: close = large readable, far = tiny texture
      const fontSize = isCenter
        ? Math.max(12, Math.min(18, faceH / 16))
        : Math.max(5, Math.min(12, faceH / 10))
      const lh = fontSize * 1.35
      const padding = isCenter ? Math.max(12, fontSize) : Math.max(3, fontSize * 0.4)

      // Golden-Shield architecture: prepare at EXACT render fontSize
      const textW = Math.max(10, faceW - padding * 2)
      const allLines = getWallLines(face.loreKey, textW, fontSize)
      if (!allLines.length) { ctx.restore(); continue }

      // Offset into text based on wall position — prevents every wall showing the same opening
      const faceHash = (face.mx * 7 + face.my * 3 + face.side * 13) % Math.max(1, allLines.length)
      const offsetLines: string[] = []
      for (let i = 0; i < allLines.length; i++) {
        offsetLines.push(allLines[(faceHash + i) % allLines.length]!)
      }

      if (isCenter && faceW > 60) {
        // ── CENTER FACE: Full contrast overlay + zone header + border ──
        ctx.globalAlpha = 0.94
        ctx.fillStyle = temporalMode ? '#0d0a06' : '#050508'
        ctx.fillRect(face.startX, inscribedTop, faceW, faceH)

        // Zone border frame
        ctx.fillStyle = face.color
        ctx.globalAlpha = 0.7
        ctx.fillRect(face.startX, inscribedTop, faceW, 2)
        ctx.fillRect(face.startX, inscribedBot - 2, faceW, 2)
        ctx.fillRect(face.startX, inscribedTop, 2, faceH)
        ctx.fillRect(face.endX - 2, inscribedTop, 2, faceH)

        // Zone header
        ctx.globalAlpha = 0.85
        ctx.font = 'bold 11px Courier New'
        ctx.fillStyle = face.color
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        const headerText = face.label || config.title
        ctx.fillText(headerText, face.startX + padding, inscribedTop + 6)

        // Body text — bright, readable
        ctx.font = `${fontSize}px Courier New`
        let ly = inscribedTop + 22
        let lineIdx = 0
        while (ly < inscribedBot - 4 && lineIdx < offsetLines.length) {
          const txt = offsetLines[lineIdx]!
          ctx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)
          ctx.fillStyle = '#e8e0d0'
          ctx.fillText(txt, face.startX + padding, ly)
          ly += lh
          lineIdx++
        }

        // Pretext badge
        ctx.font = 'bold 9px Courier New'
        ctx.fillStyle = '#0fa'
        ctx.globalAlpha = 0.4
        ctx.fillText(`PRETEXT · ${offsetLines.length} LINES`, face.startX + padding, inscribedBot - 12)

      } else {
        // ── PERIPHERAL WALLS: Text as shimmering material texture ──
        ctx.font = `${fontSize}px Courier New`
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        ctx.fillStyle = '#d4cfc0'

        let ly = inscribedTop + 2
        let lineIdx = 0
        while (ly < inscribedBot && lineIdx < offsetLines.length) {
          const txt = offsetLines[lineIdx]!
          ctx.globalAlpha = bright * (0.55 + 0.15 * Math.sin(lineIdx * 0.5 + time * 0.3))
          ctx.fillText(txt, face.startX + padding, ly)
          ly += lh
          lineIdx++
        }
      }

      // Zone edge accents
      ctx.globalAlpha = bright * 0.4
      ctx.fillStyle = face.color
      ctx.fillRect(face.startX, inscribedTop, 1, faceH)
      ctx.fillRect(face.endX - 1, inscribedTop, 1, faceH)

      ctx.restore()
    }

    // ═══ MINIMAP — Vector-rendered OSM polygons (matches Leaflet map) ═══
    if (showMinimap) {
      const ms = Math.min(220, Math.max(160, cw / 2.5)), mmx = cw - ms - 10, mmy = 10
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#080a0e'; ctx.fillRect(mmx - 2, mmy - 2, ms + 4, ms + 4)
      ctx.strokeStyle = accentColor + '55'; ctx.lineWidth = 1; ctx.strokeRect(mmx - 2, mmy - 2, ms + 4, ms + 4)

      // Coordinate transform: lat/lng → minimap pixel
      const toMM = (lat: number, lng: number): [number, number] => {
        const px = ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * ms
        const py = ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * ms
        return [mmx + px, mmy + py]
      }

      // Ground fill — dark base
      ctx.fillStyle = '#111418'
      ctx.fillRect(mmx, mmy, ms, ms)

      // ── Water zones (blue circles, drawn first) ──
      if (config.waterZones) {
        for (const wz of config.waterZones) {
          const [wx, wy] = toMM(wz.lat, wz.lng)
          const gridR = Math.max(3, Math.round(wz.radius / ((bounds.latMax - bounds.latMin) / ms * 111000)))
          ctx.fillStyle = '#0a2040'
          ctx.strokeStyle = '#1a4a80'
          ctx.lineWidth = 0.5
          ctx.beginPath(); ctx.arc(wx, wy, gridR, 0, Math.PI * 2)
          ctx.fill(); ctx.stroke()
          if (wz.name) {
            ctx.font = '6px Courier New'; ctx.fillStyle = '#3a7acc'
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(wz.name, wx, wy)
            ctx.textAlign = 'left'; ctx.textBaseline = 'top'
          }
        }
      }

      // ── Road + trail centerlines (under buildings) ──
      for (const road of geo.highways) {
        if (road.coords.length < 2) continue
        const isTrail = road.type === 'footway' || road.type === 'path' || road.type === 'cycleway' || road.type === 'pedestrian' || road.type === 'steps'
        const lore = streetLore[road.name]
        if (isTrail) {
          ctx.strokeStyle = '#4a3520'
          ctx.lineWidth = 0.6
          ctx.setLineDash([2, 2])
        } else {
          ctx.strokeStyle = lore?.color ? lore.color + '55' : '#2a3a4a'
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
        // Check if near a memory node for zone-coloring
        let bldgColor = '#1c2228'
        let bldgStroke = '#2a3a44'
        const cx = bldg.reduce((s: number, p: [number, number]) => s + p[1], 0) / bldg.length
        const cy = bldg.reduce((s: number, p: [number, number]) => s + p[0], 0) / bldg.length
        const nearNode = memoryNodes.find(n => Math.abs(cy - n.lat) < 0.002 && Math.abs(cx - n.lng) < 0.002)
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
      for (const n of memoryNodes) {
        const [nx, ny] = toMM(n.lat, n.lng)
        ctx.fillStyle = n.color; ctx.globalAlpha = 0.9
        ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = n.textColor + 'cc'
        ctx.fillText(n.name.substring(0, 14), nx + 5, ny - 3)
      }

      // ── Street name labels (on road midpoints) ──
      ctx.font = '7px Courier New'; ctx.fillStyle = '#4a6a7a55'
      const labeled = new Set<string>()
      for (const road of geo.highways) {
        if (!road.name || labeled.has(road.name) || road.coords.length < 2) continue
        labeled.add(road.name); const mid = Math.floor(road.coords.length / 2)
        const [lx, ly] = toMM(road.coords[mid][0], road.coords[mid][1])
        if (lx > mmx + 10 && lx < mmx + ms - 40 && ly > mmy + 5 && ly < mmy + ms - 5)
          ctx.fillText(road.name.replace(/ (Avenue|Street|Road|Drive|Place|Lane|Boulevard|Way|Trail|Court) /,' ').replace(/ (Northeast|Northwest|Southeast|Southwest)$/,'').substring(0, 16), lx, ly)
      }

      // ── Player position + direction ──
      const cs = ms / MW
      const px2 = mmx + player.x * cs, py2 = mmy + player.y * cs
      ctx.fillStyle = '#ff8c00'; ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(px2, py2, 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px2, py2)
      ctx.lineTo(px2 + player.dirX * 8, py2 + player.dirY * 8); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,140,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath()
      ctx.moveTo(px2, py2); ctx.lineTo(px2 + (player.dirX + player.planeX) * 14, py2 + (player.dirY + player.planeY) * 14)
      ctx.moveTo(px2, py2); ctx.lineTo(px2 + (player.dirX - player.planeX) * 14, py2 + (player.dirY - player.planeY) * 14)
      ctx.stroke(); ctx.globalAlpha = 1
    }

    // ═══ PRETEXT GROUND PANEL ═══
    const near = memoryNodes.find(n => { const [nx, ny] = toGrid(n.lat, n.lng); return Math.abs(player.x - nx) < 8 && Math.abs(player.y - ny) < 8 })
    if (near) {
      const pH = Math.min(100, ch * 0.15), pY = ch - pH - 50
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, pY, cw, pH)
      ctx.font = 'bold 10px Courier New'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = near.textColor; ctx.fillText('◉ ' + near.badge, 14, pY + 8)
      const loreKey = temporalMode && LORE_FULL[near.id + '_hist'] ? near.id + '_hist' : near.id
      const bl = getWallLines(loreKey, Math.min(cw - 28, 600), 11)
      if (bl.length) { ctx.font = '11px Courier New'; ctx.fillStyle = '#999'
        for (let li = 0; li < Math.min(bl.length, Math.floor((pH - 26) / 14)); li++) {
          const ln = bl[li]; if (ln?.trim()) ctx.fillText(ln, 14, pY + 24 + li * 14)
        }
      }
      ctx.font = '8px Courier New'; ctx.fillStyle = '#444'; ctx.textAlign = 'right'
      ctx.fillText('text: pretext layout engine', cw - 14, pY + pH - 10); ctx.textAlign = 'left'
    }

    // HUD
    const [plat, plng] = toLatLng(player.x, player.y)
    document.getElementById('hud-coords')!.innerText = `${plat.toFixed(4)}°N ${Math.abs(plng).toFixed(4)}°W`
    document.getElementById('hud-mode')!.innerText = temporalMode ? 'LIDAR · HISTORICAL' : 'LIDAR · MODERN'
    const angle = Math.atan2(player.dirX, -player.dirY)
    document.getElementById('hud-compass')!.innerText = ['N','NE','E','SE','S','SW','W','NW'][Math.round(((angle * 180 / Math.PI + 360) % 360) / 45) % 8]
    const hudZone = document.getElementById('hud-zone')!
    if (near) { hudZone.innerText = near.name; hudZone.style.color = near.textColor }
    else { hudZone.innerText = config.title; hudZone.style.color = accentColor }
  }

  // ═══ VIEW SWITCHING ═══
  const onViewSwitch: ((mode: 'map' | 'lidar') => void)[] = []
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
    for (const cb of onViewSwitch) cb(mode)
  }
  ;(window as any).__enterLidar = (lat: number, lng: number) => { const [gx, gy] = toGrid(lat, lng); player.x = gx + 0.5; player.y = gy + 0.5; switchView('lidar') }
  document.getElementById('view-toggle')!.addEventListener('click', () => switchView(viewMode === 'map' ? 'lidar' : 'map'))

  // ═══ MOVEMENT ═══
  function isWalkable(x: number, y: number) { const ix = Math.floor(x), iy = Math.floor(y); return ix >= 0 && ix < MW && iy >= 0 && iy < MH && rmap[iy * MW + ix] !== 1 }
  function updatePlayer() {
    const sp = player.speed, rs = player.rotSpeed
    if (keys['w'] || keys['arrowup']) { const nx = player.x + player.dirX * sp, ny = player.y + player.dirY * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
    if (keys['s'] || keys['arrowdown']) { const nx = player.x - player.dirX * sp, ny = player.y - player.dirY * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
    if (keys['a']) { const nx = player.x + player.dirY * sp, ny = player.y - player.dirX * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
    if (keys['d']) { const nx = player.x - player.dirY * sp, ny = player.y + player.dirX * sp; if (isWalkable(nx, player.y)) player.x = nx; if (isWalkable(player.x, ny)) player.y = ny }
    if (keys['arrowleft']||keys['q']) { const o=player.dirX;player.dirX=o*Math.cos(rs)-player.dirY*Math.sin(rs);player.dirY=o*Math.sin(rs)+player.dirY*Math.cos(rs);const p=player.planeX;player.planeX=p*Math.cos(rs)-player.planeY*Math.sin(rs);player.planeY=p*Math.sin(rs)+player.planeY*Math.cos(rs) }
    if (keys['arrowright']||keys['e']) { const o=player.dirX;player.dirX=o*Math.cos(-rs)-player.dirY*Math.sin(-rs);player.dirY=o*Math.sin(-rs)+player.dirY*Math.cos(-rs);const p=player.planeX;player.planeX=p*Math.cos(-rs)-player.planeY*Math.sin(-rs);player.planeY=p*Math.sin(-rs)+player.planeY*Math.cos(-rs) }
  }

  // ═══ INPUT ═══
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true
    if (e.key.toLowerCase() === 'v') switchView(viewMode === 'map' ? 'lidar' : 'map')
    if (e.key.toLowerCase() === 't') {
      temporalMode = !temporalMode; cache.clear()
      if (temporalMode) { fieldMap.removeLayer(modernGroup); fieldMap.addLayer(historyGroup) }
      else { fieldMap.removeLayer(historyGroup); fieldMap.addLayer(modernGroup) }
      const f = document.getElementById('temporal-flash')!
      f.innerText = temporalMode ? `◈ ${config.temporalLabel}` : '◉ MODERN VIEW'
      f.classList.add('visible'); setTimeout(() => f.classList.remove('visible'), 1500)
    }
    if (e.key.toLowerCase() === 'm') showMinimap = !showMinimap
    const idx = parseInt(e.key)
    if (idx >= 1 && idx <= memoryNodes.length) { const n = memoryNodes[idx - 1]; const [gx, gy] = toGrid(n.lat, n.lng); player.x = gx + 0.5; player.y = gy + 0.5 }
  })
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })
  let pointerLocked = false
  let pointerLockCooldown = 0
  canvas.addEventListener('click', () => {
    if (viewMode === 'lidar' && !pointerLocked && Date.now() > pointerLockCooldown) {
      canvas.requestPointerLock().catch(() => { /* browser throttle — ignore */ })
    }
  })
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas
    if (!pointerLocked) pointerLockCooldown = Date.now() + 1200 // 1.2s cooldown after exit
  })
  document.addEventListener('mousemove', e => {
    if (!pointerLocked) return; const r = -e.movementX * 0.002
    const o=player.dirX;player.dirX=o*Math.cos(r)-player.dirY*Math.sin(r);player.dirY=o*Math.sin(r)+player.dirY*Math.cos(r)
    const p=player.planeX;player.planeX=p*Math.cos(r)-player.planeY*Math.sin(r);player.planeY=p*Math.sin(r)+player.planeY*Math.cos(r)
  })

  // ═══ MOBILE TOUCH CONTROLS ═══
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  let joyDx = 0, joyDy = 0  // virtual joystick normalized [-1,1]
  let lookDx = 0             // look-drag rotation per frame

  if (isMobile) {
    // ── Create virtual joystick (bottom-left) ──
    const joyBase = document.createElement('div')
    joyBase.id = 'joy-base'
    Object.assign(joyBase.style, {
      position: 'fixed', bottom: '30px', left: '30px', width: '120px', height: '120px',
      borderRadius: '50%', border: `2px solid ${accentColor}44`,
      background: 'rgba(10,11,13,0.5)', zIndex: '30', touchAction: 'none',
      display: viewMode === 'lidar' ? 'block' : 'none'
    })
    const joyKnob = document.createElement('div')
    joyKnob.id = 'joy-knob'
    Object.assign(joyKnob.style, {
      position: 'absolute', top: '50%', left: '50%', width: '44px', height: '44px',
      marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%',
      background: `${accentColor}66`, border: `2px solid ${accentColor}aa`,
      transition: 'none'
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
          let dx = t.clientX - joyCenterX
          let dy = t.clientY - joyCenterY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > JOY_RADIUS) { dx = dx / dist * JOY_RADIUS; dy = dy / dist * JOY_RADIUS }
          joyDx = dx / JOY_RADIUS
          joyDy = dy / JOY_RADIUS
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

    // ── Look-drag on right half of screen ──
    let lookTouchId: number | null = null
    let lookLastX = 0

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        // Right half only (if joystick isn't already using this touch)
        if (t.clientX > window.innerWidth * 0.35 && t.identifier !== joyTouchId && lookTouchId === null) {
          lookTouchId = t.identifier
          lookLastX = t.clientX
          e.preventDefault()
        }
      }
    }, { passive: false })

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === lookTouchId) {
          lookDx = -(t.clientX - lookLastX) * 0.004
          lookLastX = t.clientX
          e.preventDefault()
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
    bar.id = 'mobile-action-bar'
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

    const btnView = mobileBtn('MAP', () => switchView(viewMode === 'map' ? 'lidar' : 'map'))
    const btnTime = mobileBtn('TIME', () => {
      temporalMode = !temporalMode; cache.clear()
      if (temporalMode) { fieldMap.removeLayer(modernGroup); fieldMap.addLayer(historyGroup) }
      else { fieldMap.removeLayer(historyGroup); fieldMap.addLayer(modernGroup) }
      const f = document.getElementById('temporal-flash')!
      f.innerText = temporalMode ? `◈ ${config.temporalLabel}` : '◉ MODERN VIEW'
      f.classList.add('visible'); setTimeout(() => f.classList.remove('visible'), 1500)
      btnTime.textContent = temporalMode ? '◈ NOW' : '◈ HIST'
    }, '#8B6B4A')
    const btnMini = mobileBtn('MAP+', () => { showMinimap = !showMinimap })
    bar.append(btnView, btnTime, btnMini)

    // Zone teleport buttons
    memoryNodes.forEach((n, i) => {
      const short = n.name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()
      const b = mobileBtn(short, () => {
        const [gx, gy] = toGrid(n.lat, n.lng); player.x = gx + 0.5; player.y = gy + 0.5
        if (viewMode === 'map') switchView('lidar')
      }, n.color)
      b.title = n.name
      bar.appendChild(b)
    })
    document.body.appendChild(bar)

    // Register mobile view-switch hook
    onViewSwitch.push((mode) => {
      joyBase.style.display = mode === 'lidar' ? 'block' : 'none'
      btnView.textContent = mode === 'map' ? '◉ 3D' : '◎ MAP'
    })
  }

  // Patch updatePlayer to include joystick input
  const origUpdatePlayer = updatePlayer
  function updatePlayerMobile() {
    origUpdatePlayer()
    if (!isMobile) return
    const sp = player.speed
    // Forward/backward from joystick Y
    if (Math.abs(joyDy) > 0.1) {
      const f = -joyDy  // up = forward
      const nx = player.x + player.dirX * sp * f
      const ny = player.y + player.dirY * sp * f
      if (isWalkable(nx, player.y)) player.x = nx
      if (isWalkable(player.x, ny)) player.y = ny
    }
    // Strafe from joystick X
    if (Math.abs(joyDx) > 0.1) {
      const nx = player.x - player.dirY * sp * joyDx
      const ny = player.y + player.dirX * sp * joyDx
      if (isWalkable(nx, player.y)) player.x = nx
      if (isWalkable(player.x, ny)) player.y = ny
    }
    // Look rotation from drag
    if (Math.abs(lookDx) > 0.001) {
      const r = lookDx
      const o = player.dirX
      player.dirX = o * Math.cos(r) - player.dirY * Math.sin(r)
      player.dirY = o * Math.sin(r) + player.dirY * Math.cos(r)
      const p = player.planeX
      player.planeX = p * Math.cos(r) - player.planeY * Math.sin(r)
      player.planeY = p * Math.sin(r) + player.planeY * Math.cos(r)
      lookDx = 0
    }
  }

  // ═══ GAME LOOP ═══
  function gameLoop() {
    time++
    if (viewMode === 'lidar') { updatePlayerMobile(); renderLidar() }
    requestAnimationFrame(gameLoop)
  }
  gameLoop()
}
