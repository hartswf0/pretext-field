import {
    prepareWithSegments,
    layoutNextLine,
    type PreparedTextWithSegments,
    type LayoutCursor,
} from '@chenglou/pretext';

// --- Global DOM & Context ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;

const tryVibrate = (ms: number | number[]) => {
    try {
        if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { }
};

// --- Sonification Engine (Subtle & Algorithmic) ---
const SoundEngine = {
    ctx: null as AudioContext | null,
    masterGain: null as GainNode | null,
    reverb: null as ConvolverNode | null,
    reverbGain: null as GainNode | null,
    isScanning: false,
    lastPingTime: 0,
    // Pentatonic scale base frequencies for a calming feel
    notes: [440, 493.88, 554.37, 659.25, 739.99, 880],

    init() {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.reverb = this.ctx.createConvolver();
            let length = this.ctx.sampleRate * 5.0; // Long luxuriant reverb
            let impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
            let left = impulse.getChannelData(0);
            let right = impulse.getChannelData(1);

            for (let i = 0; i < length; i++) {
                let decay = Math.pow(1 - i / length, 4);
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            this.reverb.buffer = impulse;

            this.reverbGain = this.ctx.createGain();
            this.reverbGain.gain.value = 1.0;

            this.reverb.connect(this.reverbGain);
            this.reverbGain.connect(this.masterGain);

        } catch (e) { console.warn("Web Audio API not supported", e); }
    },

    // ASMR subtle filtered click tick
    ping(panValue = 0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        if (now - this.lastPingTime < 0.1) return;
        this.lastPingTime = now;

        const bufferSize = this.ctx.sampleRate * 0.05; // 50ms noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
             data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        // A bandpass to make it sound like a tight acoustic click
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400 + Math.random() * 200, now);
        filter.Q.value = 2.5;

        const gain = this.ctx.createGain();

        let pannerTarget = this.masterGain as AudioNode;
        if (this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = panValue;
            panner.connect(this.masterGain!);
            panner.connect(this.reverb!);
            pannerTarget = panner;
        }

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(pannerTarget);

        noise.start(now);
        noise.stop(now + 0.05);
    },

    // Calming objective guidance: a deep heartbeat pulse 
    beaconPing(panValue = 0, distRatio = 1) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        let pannerTarget = this.masterGain as AudioNode;
        if (this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = panValue;
            panner.connect(this.masterGain!);
            pannerTarget = panner; // Don't reverb the heartbeat as much so it sits under the mix
        }

        // Sub-bass 
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

        filter.type = 'lowpass';
        filter.frequency.value = 180;

        const maxVol = 0.5 * (1 - distRatio * 0.6);

        // Heartbeat double thud envelope
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(maxVol, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(maxVol * 0.15, now + 0.15);
        gain.gain.linearRampToValueAtTime(maxVol * 0.8, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(pannerTarget);

        osc.start(now);
        osc.stop(now + 0.9);
    },

    // ASMR bump thump for collisions
    bump() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.1);

        filter.type = 'lowpass';
        filter.frequency.value = 250;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + 0.2);
    },

    collect(indexOffset = 0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Warm cascading major 7th variant, lower and darker
        const baseFreq = 220 + (indexOffset * 5.5);
        const chord = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.875];

        chord.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            // Very mellow sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.value = 600;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2 / chord.length, now + 0.1 + (index * 0.2));
            gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain!);
            if (this.reverb) gain.connect(this.reverb);

            osc.start(now);
            osc.stop(now + 4.5);
        });
    },

    update(targetPan = 0) {
        if (this.isScanning) {
            if (Math.random() < 0.15) {
                this.ping(targetPan);
            }
        }
    },

    setScanning(isScanning: boolean) {
        this.isScanning = isScanning;
    }
};

// --- World Grid ---
const GRID_W = 400;
const GRID_H = 400;
const CELL_SIZE = 12;
const WORLD_W = GRID_W * CELL_SIZE;
const WORLD_H = GRID_H * CELL_SIZE;

let grid = new Array(GRID_W).fill(0).map(() => new Array(GRID_H).fill(null));

// LiDAR Map
const mapCanvas = document.createElement('canvas');
mapCanvas.width = WORLD_W;
mapCanvas.height = WORLD_H;
const mapCtx = mapCanvas.getContext('2d', { alpha: false })!;
mapCtx.fillStyle = '#050403';
mapCtx.fillRect(0, 0, WORLD_W, WORLD_H);

// Active Reveal Canvas (For text)
const textCanvas = document.createElement('canvas');
textCanvas.width = WORLD_W;
textCanvas.height = WORLD_H;
const textCtx = textCanvas.getContext('2d')!;

// --- State ---
let isRunning = false;
let frameCount = 0;
let lastBumpTime = 0;

const player = {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    vx: 0, vy: 0,
    speed: 4.5,
    radius: 4
};

const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };
const mouse = { x: 0, y: 0, isDown: false };

// Touch
let moveTouchId: number | null = null;
let aimTouchId: number | null = null;
const joystickOrigin = { x: 0, y: 0 };
const joystickCurrent = { x: 0, y: 0 };
let joystickActive = false;

let activeRays: {endX: number, endY: number}[] = [];
let radarAngle = 0;

// --- Poem System ---
const mindPoem = [
    "Mind in its purest play is like some bat",
    "That beats about in caverns all alone.",
    "Contriving by a kind of senseless wit",
    "Not to conclude against a wall of stone.",
    "It has no need to falter or explore;",
    "Darkly it knows what obstacles are there,",
    "And so may weave and flitter, dip and soar",
    "In perfect courses through the blackest air.",
    "And has this simile a like perfection?",
    "The mind is like a bat.",
    "Precisely. Save That in the very happiest intellection",
    "A graceful error may correct the cave."
];

let currentLineIndex = 0;
let targetNode: { x: number; y: number; text: string; prepared: PreparedTextWithSegments } | null = null;
const poemUI = document.getElementById('collected-poem')!;

const POEM_FONT = 'italic 400 24px "Cormorant Garamond", serif';

function placeNextTarget() {
    if (currentLineIndex >= mindPoem.length) {
        targetNode = null;
        return;
    }

    const text = mindPoem[currentLineIndex]!;
    const prepared = prepareWithSegments(text, POEM_FONT);

    // Pick a random location 500-800 distance away from the player
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
        attempts++;
        let angle = Math.random() * Math.PI * 2;
        let dist = 500 + Math.random() * 300;
        let nx = player.x + Math.cos(angle) * dist;
        let ny = player.y + Math.sin(angle) * dist;

        if (nx > 300 && nx < WORLD_W - 300 && ny > 300 && ny < WORLD_H - 300) {
            targetNode = { x: nx, y: ny, text, prepared };
            placed = true;
            
            // Render text onto the hidden textCanvas using Pretext layout
            renderTextNodeToCanvas(targetNode);
        }
    }
}

function renderTextNodeToCanvas(node: { x: number; y: number; text: string; prepared: PreparedTextWithSegments }) {
    textCtx.clearRect(0, 0, WORLD_W, WORLD_H); // Clear previous text
    textCtx.font = POEM_FONT;
    textCtx.fillStyle = 'rgba(224, 36, 195, 0.9)';
    textCtx.shadowColor = 'rgba(224, 36, 195, 0.6)';
    textCtx.shadowBlur = 12;
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';

    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
    // We constrain the width so it breaks naturally into physical chunks
    let y = node.y - 30; 
    let constraintWidth = 300; 

    while (true) {
        const line = layoutNextLine(node.prepared, cursor, constraintWidth);
        if (!line) break;
        
        textCtx.fillText(line.text, node.x, y);
        cursor = line.end;
        y += 32;
    }
}

// --- World Gen ---
function initWorld() {
    for (let i = 0; i < GRID_W; i++) {
        for (let j = 0; j < GRID_H; j++) {
            grid[i][j] = null;
        }
    }

    for (let i = 0; i < GRID_W; i++) {
        grid[i]![0] = grid[i]![GRID_H - 1] = { zone: 'BOUNDARY', color: '#ff0000', text: 'Perimeter.' };
        grid[0]![i] = grid[GRID_W - 1]![i] = { zone: 'BOUNDARY', color: '#ff0000', text: 'Perimeter.' };
    }

    // Generate maze scatter
    for (let k = 0; k < 600; k++) {
        let x = Math.floor(Math.random() * (GRID_W - 20)) + 10;
        let y = Math.floor(Math.random() * (GRID_H - 20)) + 10;
        let isHoriz = Math.random() > 0.5;
        let wallLength = Math.floor(Math.random() * 30) + 10;
        let thickness = Math.floor(Math.random() * 3) + 1;

        for (let l = 0; l < wallLength; l++) {
            for (let t = 0; t < thickness; t++) {
                let wx = isHoriz ? x + l : x + t;
                let wy = isHoriz ? y + t : y + l;

                if (wx >= 0 && wx < GRID_W && wy >= 0 && wy < GRID_H) {
                    let spawnDist = Math.hypot(wx * CELL_SIZE - player.x, wy * CELL_SIZE - player.y);
                    if (spawnDist > 150) {
                        grid[wx]![wy] = { zone: 'MAZE_WALL', color: '#ff0055', text: '"Not to conclude against a wall of stone."' };
                    }
                }
            }
        }
    }

    placeNextTarget();
}

// --- Input ---
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
});
window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (aimTouchId !== null) return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
    if (aimTouchId !== null) return;
    mouse.isDown = true;
    tryVibrate(15);
});
canvas.addEventListener('mouseup', () => mouse.isDown = false);

// Touch Implementation
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.clientX < window.innerWidth / 2 && moveTouchId === null) {
            moveTouchId = t.identifier;
            joystickOrigin.x = t.clientX;
            joystickOrigin.y = t.clientY;
            joystickCurrent.x = t.clientX;
            joystickCurrent.y = t.clientY;
            joystickActive = true;
        } else if (t.clientX >= window.innerWidth / 2 && aimTouchId === null) {
            aimTouchId = t.identifier;
            mouse.x = t.clientX;
            mouse.y = t.clientY;
            mouse.isDown = true;
            tryVibrate(15);
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.identifier === moveTouchId) {
            joystickCurrent.x = t.clientX;
            joystickCurrent.y = t.clientY;
        } else if (t.identifier === aimTouchId) {
            mouse.x = t.clientX;
            mouse.y = t.clientY;
        }
    }
}, { passive: false });

const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.identifier === moveTouchId) {
            moveTouchId = null;
            joystickActive = false;
        } else if (t.identifier === aimTouchId) {
            aimTouchId = null;
            mouse.isDown = false;
        }
    }
};
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

// --- Physics ---
function castRay(ox: number, oy: number, angle: number, maxDist: number) {
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
    let rayX = ox / CELL_SIZE;
    let rayY = oy / CELL_SIZE;
    let mapX = Math.floor(rayX);
    let mapY = Math.floor(rayY);
    let deltaDistX = Math.abs(1 / dirX);
    let deltaDistY = Math.abs(1 / dirY);
    let stepX, stepY;
    let sideDistX, sideDistY;

    if (dirX < 0) {
        stepX = -1;
        sideDistX = (rayX - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - rayX) * deltaDistX;
    }
    if (dirY < 0) {
        stepY = -1;
        sideDistY = (rayY - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - rayY) * deltaDistY;
    }

    let hit = false;
    let distance = 0;
    let hitData = null;

    while (!hit && distance < maxDist / CELL_SIZE) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            distance = sideDistX - deltaDistX;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            distance = sideDistY - deltaDistY;
        }

        if (mapX < 0 || mapX >= GRID_W || mapY < 0 || mapY >= GRID_H) break;

        if (grid[mapX]![mapY]) {
            hit = true;
            hitData = grid[mapX]![mapY];
        }
    }

    if (hit) {
        let exactX = rayX + dirX * distance;
        let exactY = rayY + dirY * distance;
        return {
            x: exactX * CELL_SIZE,
            y: exactY * CELL_SIZE,
            dist: distance * CELL_SIZE,
            data: hitData
        };
    }
    return null;
}

// --- Processing ---
function update() {
    let vx = 0, vy = 0;

    if (keys['w']) vy -= player.speed;
    if (keys['s']) vy += player.speed;
    if (keys['a']) vx -= player.speed;
    if (keys['d']) vx += player.speed;

    if (joystickActive) {
        let dx = joystickCurrent.x - joystickOrigin.x;
        let dy = joystickCurrent.y - joystickOrigin.y;
        let dist = Math.hypot(dx, dy);
        if (dist > 0) {
            let maxDist = 40;
            let strength = Math.min(dist, maxDist) / maxDist;
            vx += (dx / dist) * (player.speed * strength);
            vy += (dy / dist) * (player.speed * strength);
        }
    }

    if (vx !== 0 && vy !== 0 && !joystickActive) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * player.speed;
        vy = (vy / len) * player.speed;
    }

    const nextX = player.x + vx;
    const nextY = player.y + vy;
    let collided = false;

    const gridX = Math.floor(nextX / CELL_SIZE);
    const gridY = Math.floor(player.y / CELL_SIZE);
    if (gridX >= 0 && gridX < GRID_W && !grid[gridX]![gridY]) {
        player.x = nextX;
    } else if (vx !== 0) { collided = true; }

    const gridX2 = Math.floor(player.x / CELL_SIZE);
    const gridY2 = Math.floor(nextY / CELL_SIZE);
    if (gridY2 >= 0 && gridY2 < GRID_H && !grid[gridX2]![gridY2]) {
        player.y = nextY;
    } else if (vy !== 0) { collided = true; }

    if (collided) {
        let now = performance.now();
        if (now - lastBumpTime > 200) {
            tryVibrate(8);
            SoundEngine.bump();
            lastBumpTime = now;
        }
    }

    if (frameCount % 10 === 0) {
        document.getElementById('hud-pos')!.textContent = `${Math.floor(player.x)}, ${Math.floor(player.y)}`;
    }

    activeRays = [];
    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;
    const mouseAngle = Math.atan2(mouse.y - (player.y - camY), mouse.x - (player.x - camX));

    let panValue = 0;
    
    // Check target node
    if (targetNode) {
        let dx = targetNode.x - player.x;
        let dy = targetNode.y - player.y;
        let distToTarget = Math.hypot(dx, dy);

        // Very close & actively scanning
        if (distToTarget < 110 && mouse.isDown) {
            SoundEngine.collect(currentLineIndex);
            tryVibrate([30, 50, 30]);

            // Reveal in UI
            const newLine = document.createElement('div');
            newLine.className = 'poem-line';
            newLine.textContent = targetNode.text;
            poemUI.appendChild(newLine);
            
            // Advance sequential text
            currentLineIndex++;
            if (currentLineIndex >= mindPoem.length) {
                document.getElementById('hud-scan')!.textContent = "POEM COMPLETE.";
            }
            
            // Text clears from maze after collection, next is placed elsewhere
            placeNextTarget();
        }

        if (targetNode) {
            // Update panning telemetry for next active target
            panValue = Math.max(-1, Math.min(1, (targetNode.x - player.x) / 300));

            // Deep heartbeat guidance pulse ONLY when scanning
            if (mouse.isDown && frameCount % 110 === 0) {
                let distRatio = Math.min(1, distToTarget / 1500);
                SoundEngine.beaconPing(panValue, distRatio);
            }
        }
    }

    radarAngle += 0.05;
    for (let i = 0; i < 4; i++) {
        const rAngle = radarAngle + (i * (Math.PI / 2));
        const hit = castRay(player.x, player.y, rAngle, 800);
        if (hit) {
            mapCtx.fillStyle = (hit.data as any).color;
            mapCtx.globalAlpha = 0.15;
            mapCtx.fillRect(hit.x, hit.y, 2, 2);
            mapCtx.globalAlpha = 1.0;
        }
    }

    if (mouse.isDown) {
        SoundEngine.setScanning(true);
        SoundEngine.update(panValue);

        if (frameCount % 45 === 0) tryVibrate(5);

        const numRays = 80; // Higher fidelity rendering
        const coneSpread = Math.PI / 3.5;

        for (let i = 0; i < numRays; i++) {
            const angle = mouseAngle + (Math.random() - 0.5) * coneSpread;
            const hit = castRay(player.x, player.y, angle, 1200);

            if (hit) {
                activeRays.push({ endX: hit.x, endY: hit.y });
                if (Math.random() < 0.6) {
                    mapCtx.fillStyle = (hit.data as any).color;
                    mapCtx.globalAlpha = 0.4;
                    mapCtx.fillRect(hit.x + (Math.random() - 0.5) * 3, hit.y + (Math.random() - 0.5) * 3, 2, 2);
                    mapCtx.globalAlpha = 1.0;
                }
            } else {
                activeRays.push({
                    endX: player.x + Math.cos(angle) * 1200,
                    endY: player.y + Math.sin(angle) * 1200
                });
            }
        }

        if (activeRays.length > 0) {
            // Apply physical ray mask to textCanvas 
            mapCtx.save();
            mapCtx.beginPath();
            mapCtx.moveTo(player.x, player.y);
            let sortedRays = [...activeRays].sort((a, b) => {
                return Math.atan2(a.endY - player.y, a.endX - player.x) - Math.atan2(b.endY - player.y, b.endX - player.x);
            });
            for (let ray of sortedRays) {
                mapCtx.lineTo(ray.endX, ray.endY);
            }
            mapCtx.closePath();
            mapCtx.clip();
            mapCtx.globalAlpha = 0.1; // Gentle cumulative reveal
            mapCtx.drawImage(textCanvas, 0, 0);
            mapCtx.restore();
        }
    } else {
        SoundEngine.setScanning(false);
    }
}

// --- Render ---
function render() {
    ctx.fillStyle = '#050403';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;

    ctx.drawImage(mapCanvas, -camX, -camY);

    if (targetNode) {
        // Draw Sonar Pulse for objective
        ctx.save();
        let pulseTime = frameCount % 240; 
        let radius = pulseTime * 4; 
        let alpha = Math.max(0, 1 - (pulseTime / 240));

        ctx.beginPath();
        ctx.arc(targetNode.x - camX, targetNode.y - camY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 140, 0, ${alpha * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(targetNode.x - camX, targetNode.y - camY, 2 + Math.sin(frameCount * 0.05) * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 140, 0, ${alpha * 0.8})`;
        ctx.fill();
        ctx.restore();

        // Edge off-screen pointer
        let dx = targetNode.x - player.x;
        let dy = targetNode.y - player.y;
        let dist = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx);
        let screenRadius = Math.min(canvas.width, canvas.height) / 2;

        if (dist > screenRadius) {
            let indX = canvas.width / 2 + Math.cos(angle) * (screenRadius - 40);
            let indY = canvas.height / 2 + Math.sin(angle) * (screenRadius - 40);

            ctx.save();
            ctx.translate(indX, indY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-5, 6);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, -6);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 140, 0, ${0.2 + Math.sin(frameCount * 0.05) * 0.3})`; 
            ctx.fill();
            ctx.restore();
        }
    }

    if (activeRays.length > 0) {
        ctx.fillStyle = 'rgba(0, 255, 204, 0.015)';
        ctx.beginPath();
        ctx.moveTo(player.x - camX, player.y - camY);
        let sortedRays = [...activeRays].sort((a, b) => {
            return Math.atan2(a.endY - player.y, a.endX - player.x) - Math.atan2(b.endY - player.y, b.endX - player.x);
        });
        for (let ray of sortedRays) {
            ctx.lineTo(ray.endX - camX, ray.endY - camY);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 255, 204, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let ray of activeRays) {
            ctx.moveTo(player.x - camX, player.y - camY);
            ctx.lineTo(ray.endX - camX, ray.endY - camY);
        }
        ctx.stroke();
    }

    // Draw player
    ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
    ctx.beginPath();
    ctx.arc(player.x - camX, player.y - camY, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
    ctx.beginPath();
    ctx.arc(player.x - camX, player.y - camY, player.radius + 4 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
    ctx.stroke();

    if (joystickActive) {
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joystickOrigin.x, joystickOrigin.y, 40, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 140, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(joystickCurrent.x, joystickCurrent.y, 15, 0, Math.PI * 2);
        ctx.fill();
    }
}

function gameLoop() {
    if (!isRunning) return;
    frameCount++;
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// --- Init Boot ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.fonts.ready.then(() => {
    const loader = document.getElementById('font-loader');
    if (loader) loader.style.display = 'none';
    const btn = document.getElementById('boot-btn');
    if (btn) btn.style.display = 'inline-block';
});

document.getElementById('boot-btn')!.addEventListener('click', () => {
    SoundEngine.init();
    document.getElementById('boot-screen')!.style.opacity = '0';
    setTimeout(() => {
        document.getElementById('boot-screen')!.style.display = 'none';
    }, 300);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initWorld();
    isRunning = true;
    requestAnimationFrame(gameLoop);

    setTimeout(() => {
        const hint = document.getElementById('controls-hint');
        if (hint) hint.style.opacity = '0';
    }, 8000);
});
