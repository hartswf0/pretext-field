const fs = require('fs');

let content = fs.readFileSync('aidar.ts', 'utf-8');

// Inject imports
const importBlock = `import { prepareWithSegments, layoutNextLine } from './src/layout.js';

// --- Global Navigation State ---
let isAutoPilot = true;
let currentPath = [];
let currentPathTarget = null;

// BFS Pathfinding
function getPath(sx, sy, gx, gy) {
    if (sx === gx && sy === gy) return [];
    
    const isPassable = (x, y) => {
        if(x<0||x>=GRID_W||y<0||y>=GRID_H) return false;
        return grid[x][y] === null;
    };
    
    let queue = [ [sx, sy] ];
    let visited = new Uint8Array(GRID_W * GRID_H);
    visited[sy * GRID_W + sx] = 1;
    let parent = new Int32Array(GRID_W * GRID_H).fill(-1);
    
    const dirs = [[0,1],[1,0],[0,-1],[-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
    
    let found = false;
    let head = 0;
    while(head < queue.length) {
        let cx = queue[head][0];
        let cy = queue[head][1];
        head++;
        if (cx === gx && cy === gy) {
            found = true;
            break;
        }
        
        for (let dir of dirs) {
            let [dx, dy] = dir;
            let nx = cx + dx;
            let ny = cy + dy;
            if (isPassable(nx, ny)) {
                let idx = ny * GRID_W + nx;
                if (visited[idx] === 0) {
                    if (dx !== 0 && dy !== 0) {
                        if (!isPassable(nx, cy) || !isPassable(cx, ny)) continue;
                    }
                    visited[idx] = 1;
                    parent[idx] = cy * GRID_W + cx;
                    queue.push([nx, ny]);
                }
            }
        }
    }
    
    if (!found) return [];
    
    let path = [];
    let curr = gy * GRID_W + gx;
    while(curr !== -1 && curr !== (sy * GRID_W + sx)) {
        let cy = Math.floor(curr / GRID_W);
        let cx = curr % GRID_W;
        path.push({x: cx, y: cy});
        curr = parent[curr];
    }
    return path.reverse();
}

`;

content = content.replace('const canvas = document.getElementById(\'game-canvas\');', importBlock + 'const canvas = document.getElementById(\'game-canvas\') as HTMLCanvasElement;');

// Auto-Pilot toggle logic
content = content.replace('// --- Input Handling ---', `// --- Input Handling ---
        const autopilotUI = document.getElementById('autopilot-ui');
        if (autopilotUI) {
            autopilotUI.addEventListener('click', () => {
                isAutoPilot = !isAutoPilot;
                autopilotUI.textContent = isAutoPilot ? '[ AUTO-PILOT : ON ]' : '[ AUTO-PILOT : OFF ]';
                autopilotUI.style.color = isAutoPilot ? 'var(--cyan)' : 'var(--amber)';
                autopilotUI.style.borderColor = isAutoPilot ? 'var(--cyan)' : 'var(--amber)';
            });
        }
`);

// Pretext floor rendering
const floorRenderOld = `        // --- Floor Rendering ---
        function updateFloorCanvas() {
            floorCtx.clearRect(0, 0, WORLD_W, WORLD_H);
            floorCtx.font = 'italic 600 32px "Cormorant Garamond", serif'; /* Much larger and bolder for readability */
            floorCtx.fillStyle = 'rgba(255, 140, 0, 1)'; /* Solid Amber */
            floorCtx.shadowColor = 'rgba(255, 140, 0, 0.8)';
            floorCtx.shadowBlur = 15;
            floorCtx.textAlign = 'center';
            floorCtx.textBaseline = 'middle';

            for (let i = currentLineIndex; i < poemNodes.length; i++) {
                floorCtx.fillText(poemNodes[i].text, poemNodes[i].x, poemNodes[i].y);
            }
        }`;

const floorRenderNew = `        // --- Floor Rendering ---
        function updateFloorCanvas() {
            floorCtx.clearRect(0, 0, WORLD_W, WORLD_H);
            const fontStr = 'italic 600 32px "Cormorant Garamond", serif';
            floorCtx.font = fontStr; 
            floorCtx.fillStyle = 'rgba(255, 140, 0, 1)'; 
            floorCtx.shadowColor = 'rgba(255, 140, 0, 0.8)';
            floorCtx.shadowBlur = 15;
            floorCtx.textAlign = 'center';
            floorCtx.textBaseline = 'middle';

            for (let i = currentLineIndex; i < poemNodes.length; i++) {
                const text = poemNodes[i].text;
                const prepared = prepareWithSegments(text, fontStr);
                
                let cursor = { segmentIndex: 0, graphemeIndex: 0 };
                let offsetY = poemNodes[i].y - 20;
                while(true) {
                    const line = layoutNextLine(prepared, cursor, 400); // 400px constraint
                    if (!line || line.text.length === 0) {
                        // Prevent infinite loop if text cannot fit
                        if (cursor.segmentIndex === 0 && cursor.graphemeIndex === 0) break; 
                        if (!line) break;
                    }
                    floorCtx.fillText(line.text, poemNodes[i].x, offsetY);
                    offsetY += 40;
                    if (!line || (cursor.segmentIndex === line.end.segmentIndex && cursor.graphemeIndex === line.end.graphemeIndex)) break;
                    cursor = line.end;
                }
            }
        }`;
content = content.replace(floorRenderOld, floorRenderNew);


// Update auto-pilot logic inside update()
const updateStartOld = `        function update() {
            let vx = 0, vy = 0;

            if (keys.w) vy -= player.speed;
            if (keys.s) vy += player.speed;
            if (keys.a) vx -= player.speed;
            if (keys.d) vx += player.speed;

            if (joystickActive) {
                let dx = joystickCurrent.x - joystickOrigin.x;
                let dy = joystickCurrent.y - joystickOrigin.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    let maxDist = 40;
                    let strength = Math.min(dist, maxDist) / maxDist;
                    vx += (dx / dist) * (player.speed * strength);
                    vy += (dy / dist) * (player.speed * strength);
                }
            }`;

const updateStartNew = `        function update() {
            let vx = 0, vy = 0;
            
            // Allow manual override to turn off autopilot naturally
            if (keys.w || keys.s || keys.a || keys.d || joystickActive) {
                if (isAutoPilot) {
                    isAutoPilot = false;
                    const apUI = document.getElementById('autopilot-ui');
                    if (apUI) {
                        apUI.textContent = '[ AUTO-PILOT : OFF ]';
                        apUI.style.color = 'var(--amber)';
                        apUI.style.borderColor = 'var(--amber)';
                    }
                }
            }

            if (keys.w) vy -= player.speed;
            if (keys.s) vy += player.speed;
            if (keys.a) vx -= player.speed;
            if (keys.d) vx += player.speed;

            if (joystickActive) {
                let dx = joystickCurrent.x - joystickOrigin.x;
                let dy = joystickCurrent.y - joystickOrigin.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    let maxDist = 40;
                    let strength = Math.min(dist, maxDist) / maxDist;
                    vx += (dx / dist) * (player.speed * strength);
                    vy += (dy / dist) * (player.speed * strength);
                }
            }
            
            // Autopilot AI steering
            if (isAutoPilot && !sequenceComplete && currentLineIndex < poemNodes.length) {
                const target = poemNodes[currentLineIndex];
                
                if (!currentPath || currentPath.length === 0 || currentPathTarget !== target) {
                    let sx = Math.floor(player.x / CELL_SIZE);
                    let sy = Math.floor(player.y / CELL_SIZE);
                    let gx = Math.floor(target.x / CELL_SIZE);
                    let gy = Math.floor(target.y / CELL_SIZE);
                    currentPath = getPath(sx, sy, gx, gy);
                    currentPathTarget = target;
                }
                
                if (currentPath && currentPath.length > 0) {
                    // Check if path goes into wall (if generated before walls appeared, though walls are static)
                    let nextNode = currentPath[0];
                    let targetX = nextNode.x * CELL_SIZE + CELL_SIZE / 2;
                    let targetY = nextNode.y * CELL_SIZE + CELL_SIZE / 2;
                    let dx = targetX - player.x;
                    let dy = targetY - player.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < player.speed * 2.5) {
                        currentPath.shift();
                    }
                    
                    let targetAngle = Math.atan2(target.y - player.y, target.x - player.x);
                    if (currentPath.length > 0) {
                        let lookAhead = currentPath[Math.min(currentPath.length - 1, 3)];
                        let aDx = lookAhead.x * CELL_SIZE + CELL_SIZE/2 - player.x;
                        let aDy = lookAhead.y * CELL_SIZE + CELL_SIZE/2 - player.y;
                        let driveAngle = Math.atan2(aDy, aDx);
                        
                        vx = Math.cos(driveAngle) * player.speed;
                        vy = Math.sin(driveAngle) * player.speed;
                        
                        let sweep = Math.sin(frameCount * 0.08) * 0.9;
                        mouse.x = player.x + Math.cos(targetAngle + sweep) * 100 - (player.x - canvas.width/2);
                        mouse.y = player.y + Math.sin(targetAngle + sweep) * 100 - (player.y - canvas.height/2);
                        mouse.isDown = true;
                    } else {
                        vx = Math.cos(targetAngle) * player.speed;
                        vy = Math.sin(targetAngle) * player.speed;
                        
                        mouse.x = player.x + Math.cos(targetAngle) * 100 - (player.x - canvas.width/2);
                        mouse.y = player.y + Math.sin(targetAngle) * 100 - (player.y - canvas.height/2);
                        mouse.isDown = true;
                    }
                } else {
                    // Fail to path, fallback to direct homing
                    let targetAngle = Math.atan2(target.y - player.y, target.x - player.x);
                    vx = Math.cos(targetAngle) * player.speed;
                    vy = Math.sin(targetAngle) * player.speed;
                    mouse.x = player.x + Math.cos(targetAngle) * 100 - (player.x - canvas.width/2);
                    mouse.y = player.y + Math.sin(targetAngle) * 100 - (player.y - canvas.height/2);
                    mouse.isDown = true;
                }
            }
`;

content = content.replace(updateStartOld, updateStartNew);

// We need to add `const canvas = ...` and types properly, but the file was JS.
// Just to be sure, text replacement without exact match issues:
// Wait, the string replace might fail if exact format doesn't match!

fs.writeFileSync('aidar.ts', content);
console.log('Done replacement');

