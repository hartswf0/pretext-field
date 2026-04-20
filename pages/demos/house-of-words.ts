import {
    prepareWithSegments,
    layoutNextLine,
    type LayoutCursor,
} from '../../src/layout.js';

// --- Global DOM & Context ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const minimap = document.getElementById('minimap') as HTMLCanvasElement;
const mCtx = minimap.getContext('2d')!;

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// --- Chat & UI ---
const chatLog = document.getElementById('chat-log')!;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;

function appendChat(msg: string, sender: 'user'|'agent') {
    const el = document.createElement('div');
    el.className = `chat-msg ${sender}`;
    el.innerText = msg;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const text = chatInput.value.trim();
        appendChat(text, 'user');
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'chat', message: text }));
        }
        chatInput.value = '';
    }
});

// --- Memory Palace State ---
const MAP_SIZE = 128;
let worldMap: number[][] = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(-1));
// -1: void, 0: floor, >0: wall associated with a room Idx

interface RoomData {
    id: string;
    idx: number;
    cx: number; cy: number;
    w: number; h: number;
    text: string[];
    pretextLines: string[];
    color: string;
}
let rooms: RoomData[] = [];
let currentRoomId = 'room_core';

const PRETEXT_FONT = "bold 16px 'JetBrains Mono', monospace";

function buildDynamicMap(graphData: any) {
    const { nodes, edges } = graphData;
    
    // Clear map
    for(let y=0; y<MAP_SIZE; y++) worldMap[y].fill(-1);
    rooms = [];
    
    const ROOM_SIZE = 9;
    const CORRIDOR_LEN = 11;

    // Use BFS to place rooms.
    const placed = new Set<string>();
    const nodePositions = new Map<string, {cx: number, cy: number}>();
    
    let idxCounter = 1;

    function placeRoom(id: string, name: string, textArr: string[], cx: number, cy: number) {
        placed.add(id);
        nodePositions.set(id, {cx, cy});
        
        let wallText = name.toUpperCase() + " |";
        if (textArr && textArr.length > 0) wallText += " " + textArr.join(" // ");
        
        // Wrap text
        const pretextLines = [];
        const preparedText = prepareWithSegments(wallText, PRETEXT_FONT);
        let cursor = { segmentIndex: 0, graphemeIndex: 0 };
        while (true) {
            const line = layoutNextLine(preparedText, cursor, 400); 
            if (!line) break;
            pretextLines.push(line.text);
            cursor = line.end;
        }

        const color = `hsl(${(idxCounter * 47) % 360}, 80%, 30%)`;

        const rm: RoomData = {
            id, idx: idxCounter, cx, cy, w: ROOM_SIZE, h: ROOM_SIZE,
            text: textArr, pretextLines, color
        };
        rooms.push(rm);
        
        const startX = cx - Math.floor(ROOM_SIZE/2);
        const startY = cy - Math.floor(ROOM_SIZE/2);

        // Draw boundaries
        for(let wy=startY; wy<startY+ROOM_SIZE; wy++) {
            for(let wx=startX; wx<startX+ROOM_SIZE; wx++) {
                if (wy >= 0 && wy < MAP_SIZE && wx >= 0 && wx < MAP_SIZE) {
                    if (wy === startY || wy === startY+ROOM_SIZE-1 || wx === startX || wx === startX+ROOM_SIZE-1) {
                        worldMap[wy][wx] = idxCounter; // Wall
                    } else {
                        worldMap[wy][wx] = 0; // Floor
                    }
                }
            }
        }
        idxCounter++;
    }

    // Place core
    const coreNode = nodes.find((n:any) => n.id === 'room_core');
    if (coreNode) placeRoom(coreNode.id, coreNode.name, coreNode.text, Math.floor(MAP_SIZE/2), Math.floor(MAP_SIZE/2));
    else placeRoom('room_core', 'CORE', [], Math.floor(MAP_SIZE/2), Math.floor(MAP_SIZE/2));

    // Simple BFS for edges
    const dirs = [[0,-1], [1,0], [0,1], [-1,0]]; // N,E,S,W
    let queue: {source: string, dirIndex: number}[] = [{ source: 'room_core', dirIndex: 0 }];

    // We keep expanding as long as edges exist
    let passes = 0;
    while(passes < 5) { // loop to catch forward refs
      for (const edge of edges) {
          if (placed.has(edge.source) && !placed.has(edge.target)) {
              const srcPos = nodePositions.get(edge.source)!;
              // pick generic dir (could be better, but keeps it simple)
              const d = dirs[placed.size % 4]; 
              const dist = ROOM_SIZE-1 + CORRIDOR_LEN;
              const nx = srcPos.cx + d[0] * dist;
              const ny = srcPos.cy + d[1] * dist;
              
              const targetNode = nodes.find((n:any) => n.id === edge.target);
              if (targetNode) {
                  placeRoom(targetNode.id, targetNode.name, targetNode.text, nx, ny);
                  
                  // Carve Corridor (Width 3)
                  let px = srcPos.cx;
                  let py = srcPos.cy;
                  while (px !== nx || py !== ny) {
                      if (py >= 0 && py < MAP_SIZE && px >= 0 && px < MAP_SIZE) {
                          // Make floor
                          worldMap[py][px] = 0;
                          // If horizontal corridor, pad Y. If vertical, pad X.
                          if (px !== nx) {
                              if (worldMap[py-1][px] === -1) worldMap[py-1][px] = 999; // generic corridor wall
                              if (worldMap[py+1][px] === -1) worldMap[py+1][px] = 999;
                              worldMap[py-1][px] = 0; worldMap[py+1][px] = 0;
                          } else {
                              if (worldMap[py][px-1] === -1) worldMap[py][px-1] = 999;
                              if (worldMap[py][px+1] === -1) worldMap[py][px+1] = 999;
                              worldMap[py][px-1] = 0; worldMap[py][px+1] = 0;
                          }
                      }
                      if (px < nx) px++; else if (px > nx) px--;
                      else if (py < ny) py++; else if (py > ny) py--;
                  }
              }
          }
      }
      passes++;
    }
}

// --- WebSocket connection ---
let ws: WebSocket;
function connectWS() {
    ws = new WebSocket('ws://localhost:3333');
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'graph_update') {
            buildDynamicMap(msg.data);
            console.log("Memory Graph Rebuilt.", rooms.length, "Rooms.");
        } else if (msg.type === 'chat_reply') {
            appendChat(msg.message, 'agent');
        }
    };
    ws.onclose = () => setTimeout(connectWS, 2000);
}


// --- RAYCASTER ENGINE ---
const player = {
    x: MAP_SIZE/2, y: MAP_SIZE/2,
    dirX: -1.0, dirY: 0.0,
    planeX: 0.0, planeY: 0.66,
    moveSpeed: 5.0, rotSpeed: 3.0
};

const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };
let isPointerLocked = false;
let lastTime = 0;
let frameCount = 0;

const RAY_STEP = 6;
const CHAR_HEIGHT = 16;

document.getElementById('boot-btn')!.addEventListener('click', async () => {
    document.getElementById('boot-screen')!.style.display = 'none';
    connectWS();
    requestAnimationFrame(gameLoop);
});

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
});

function applyCameraRotation(rot: number) {
    const oldDirX = player.dirX;
    player.dirX = player.dirX * Math.cos(rot) - player.dirY * Math.sin(rot);
    player.dirY = oldDirX * Math.sin(rot) + player.dirY * Math.cos(rot);
    const oldPlaneX = player.planeX;
    player.planeX = player.planeX * Math.cos(rot) - player.planeY * Math.sin(rot);
    player.planeY = oldPlaneX * Math.sin(rot) + player.planeY * Math.cos(rot);
}

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
});

window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) return; // ignore if chatting
    if (e.key.toLowerCase() === 'w') keys.w = true;
    if (e.key.toLowerCase() === 'a') keys.a = true;
    if (e.key.toLowerCase() === 's') keys.s = true;
    if (e.key.toLowerCase() === 'd') keys.d = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'w') keys.w = false;
    if (e.key.toLowerCase() === 'a') keys.a = false;
    if (e.key.toLowerCase() === 's') keys.s = false;
    if (e.key.toLowerCase() === 'd') keys.d = false;
});

window.addEventListener('mousedown', async (e) => {
    if (e.target === chatInput || chatLog.contains(e.target as Node)) return;
    if (!isPointerLocked) {
        try { await canvas.requestPointerLock(); } catch (err) { }
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isPointerLocked) return;
    applyCameraRotation(-e.movementX * 0.002);
});

function update(dt: number) {
    let moveX = 0, moveY = 0;
    if (keys.w) moveY += 1;
    if (keys.s) moveY -= 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    let moveStep = player.moveSpeed * dt;
    
    if (moveY !== 0) {
        if (worldMap[Math.floor(player.y)] && worldMap[Math.floor(player.y)][Math.floor(player.x + player.dirX * moveStep * moveY)] === 0) 
            player.x += player.dirX * moveStep * moveY;
        if (worldMap[Math.floor(player.y + player.dirY * moveStep * moveY)] && worldMap[Math.floor(player.y + player.dirY * moveStep * moveY)][Math.floor(player.x)] === 0) 
            player.y += player.dirY * moveStep * moveY;
    }
    if (moveX !== 0) {
        const rightX = player.dirY, rightY = -player.dirX;
        if (worldMap[Math.floor(player.y)] && worldMap[Math.floor(player.y)][Math.floor(player.x + rightX * moveStep * moveX)] === 0) 
            player.x += rightX * moveStep * moveX;
        if (worldMap[Math.floor(player.y + rightY * moveStep * moveX)] && worldMap[Math.floor(player.y + rightY * moveStep * moveX)][Math.floor(player.x)] === 0) 
            player.y += rightY * moveStep * moveX;
    }

    // Determine current room
    let closestRoom = null;
    let minDist = Infinity;
    for (const r of rooms) {
        const d = Math.hypot(player.x - r.cx, player.y - r.cy);
        if (d < minDist && d < 10) {
            minDist = d;
            closestRoom = r;
        }
    }

    if (closestRoom && closestRoom.id !== currentRoomId) {
        currentRoomId = closestRoom.id;
        document.getElementById('hud-zone')!.innerText = currentRoomId;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'location', roomId: currentRoomId }));
        }
    }
}

function getChar(x: number, y: number, z: number, mapX: number, mapY: number) {
    if (mapX < 0 || mapY < 0 || mapX >= MAP_SIZE || mapY >= MAP_SIZE) return ' ';
    const idx = worldMap[mapY][mapX];
    if (idx <= 0 || idx === 999) return ' '; // empty or corridor

    const room = rooms.find(r => r.idx === idx);
    if (!room || room.pretextLines.length === 0) return ' ';
    
    let u = Math.floor(Math.abs((x + y) * 10)); 
    let v = Math.floor((z + 0.5) * room.pretextLines.length);
    v = Math.max(0, Math.min(room.pretextLines.length - 1, v));
    
    let lineObj = room.pretextLines[v];
    if (!lineObj || lineObj.length === 0) return ' ';
    return lineObj[u % lineObj.length] || ' ';
}

function draw() {
    ctx.fillStyle = '#020101';
    ctx.fillRect(0, 0, width, height);

    ctx.font = `bold ${CHAR_HEIGHT}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let x = 0; x < width; x += RAY_STEP) {
        let cameraX = 2 * x / width - 1;
        let rayDirX = player.dirX + player.planeX * cameraX;
        let rayDirY = player.dirY + player.planeY * cameraX;

        let mapX = Math.floor(player.x), mapY = Math.floor(player.y);
        let deltaDistX = Math.abs(1 / rayDirX), deltaDistY = Math.abs(1 / rayDirY);
        let stepX = 0, stepY = 0, sideDistX = 0, sideDistY = 0, side = 0, hit = 0;

        if (rayDirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
        else { stepX = 1; sideDistX = (mapX + 1.0 - player.x) * deltaDistX; }
        if (rayDirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
        else { stepY = 1; sideDistY = (mapY + 1.0 - player.y) * deltaDistY; }

        let maxDepth = 40; let depth = 0;
        while (hit === 0 && depth < maxDepth) {
            if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
            else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
            if (mapX < 0 || mapX >= MAP_SIZE || mapY < 0 || mapY >= MAP_SIZE) { hit = 1; break; }
            if (worldMap[mapY][mapX] > 0 || worldMap[mapY][mapX] === -1) hit = 1; // wall or void
            depth++;
        }

        let perpWallDist = side === 0 ? (mapX - player.x + (1 - stepX) / 2) / rayDirX : (mapY - player.y + (1 - stepY) / 2) / rayDirY;
        let exactHitX = player.x + perpWallDist * rayDirX;
        let exactHitY = player.y + perpWallDist * rayDirY;

        let lineHeight = Math.floor(height / perpWallDist);
        let drawStart = Math.max(0, Math.floor(-lineHeight / 2 + height / 2));
        let drawEnd = Math.min(height, Math.floor(lineHeight / 2 + height / 2));

        let yOffset = drawStart % CHAR_HEIGHT;
        let fog = Math.max(0, 1.0 - (depth / maxDepth));
        
        let wallIdx = (mapX>=0 && mapY>=0 && mapX<MAP_SIZE && mapY<MAP_SIZE) ? worldMap[mapY][mapX] : -1;
        let cBase = (wallIdx === 999) ? `rgba(80, 80, 80, ${fog})` : `rgba(255, 140, 0, ${fog})`;
        if (wallIdx > 0 && wallIdx !== 999) {
            const rm = rooms.find(r => r.idx === wallIdx);
            if (rm) cBase = rm.color;
        }

        // Draw Walls
        for (let y = drawStart - yOffset; y < drawEnd; y += CHAR_HEIGHT) {
            let z = (y - height / 2) / lineHeight;
            ctx.fillStyle = cBase;
            ctx.fillText(getChar(exactHitX, exactHitY, z, mapX, mapY), x + RAY_STEP / 2, y);
        }

        // Floor / Ceiling
        for (let y = drawEnd; y < height; y += CHAR_HEIGHT * 1.5) {
            let currentDist = height / (2.0 * y - height);
            let weight = currentDist / perpWallDist;
            let floorX = weight * exactHitX + (1.0 - weight) * player.x;
            let floorY = weight * exactHitY + (1.0 - weight) * player.y;

            let cFog = Math.max(0, 1.0 - (currentDist / maxDepth));
            ctx.fillStyle = `rgba(0, 255, 200, ${cFog * 0.3})`;
            ctx.fillText('.', x + RAY_STEP / 2, y);

            let ceilY = height - y;
            ctx.fillStyle = `rgba(224, 36, 195, ${cFog * 0.2})`;
            ctx.fillText('+', x + RAY_STEP / 2, ceilY);
        }
    }

    drawMinimap();
}

function drawMinimap() {
    mCtx.clearRect(0, 0, minimap.width, minimap.height);
    const boxSize = 80;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    const scale = minimap.width / boxSize;

    mCtx.fillStyle = 'rgba(255, 140, 0, 0.2)';
    for (let y = py - boxSize/2; y < py + boxSize/2; y++) {
        for (let x = px - boxSize/2; x < px + boxSize/2; x++) {
            if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
                if (worldMap[y][x] > 0 || worldMap[y][x] === -1) {
                    mCtx.fillRect((x - (px - boxSize/2)) * scale, (y - (py - boxSize/2)) * scale, scale+0.5, scale+0.5);
                }
            }
        }
    }

    mCtx.fillStyle = '#fff';
    mCtx.beginPath(); mCtx.arc((boxSize/2) * scale, (boxSize/2) * scale, 3, 0, Math.PI * 2); mCtx.fill();
    
    mCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    mCtx.beginPath();
    mCtx.moveTo((boxSize/2) * scale, (boxSize/2) * scale);
    mCtx.lineTo((boxSize/2 + player.dirX * 3) * scale, (boxSize/2 + player.dirY * 3) * scale);
    mCtx.stroke();
}

function gameLoop(time: number) {
    if (!lastTime) lastTime = time;
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if (dt > 0.1) dt = 0.1;
    frameCount++;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}
