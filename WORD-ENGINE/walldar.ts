import {
    prepareWithSegments,
    layoutNextLine,
    type PreparedTextWithSegments,
    type LayoutCursor,
} from '../src/layout.js';

// --- Global DOM & Context ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const minimap = document.getElementById('minimap') as HTMLCanvasElement;
const mCtx = minimap.getContext('2d')!;
const poemUI = document.getElementById('collected-poem')!;

const tryVibrate = (ms: number | number[]) => {
    try {
        if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { }
};

const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isMobile) {
    const mobileOverlay = document.getElementById('mobile-overlay');
    if (mobileOverlay) mobileOverlay.style.display = 'flex';
}

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// --- Pretext Integration ---
const TEXT_CORPUS = "Mind in its purest play is like some bat That beats about in caverns all alone. Contriving by a kind of senseless wit Not to conclude against a wall of stone. It has no need to falter or explore; Darkly it knows what obstacles are there, And so may weave and flitter, dip and soar In perfect courses through the blackest air. And has this simile a like perfection? The mind is like a bat. Precisely. Save That in the very happiest intellection A graceful error may correct the cave.";
const PRETEXT_FONT = "bold 16px 'JetBrains Mono', monospace";
const preparedText = prepareWithSegments(TEXT_CORPUS, PRETEXT_FONT);
let pretextLines: string[] = [];
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
while (true) {
    const line = layoutNextLine(preparedText, cursor, 350); 
    if (!line) break;
    pretextLines.push(line.text);
    cursor = line.end;
}
if (pretextLines.length === 0) pretextLines = ["NO DATA"];

const worldMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
const mapWidth = worldMap[0]!.length;
const mapHeight = worldMap.length;

const player = {
    x: 3.5, y: 3.5,
    dirX: -1.0, dirY: 0.0,
    planeX: 0.0, planeY: 0.66,
    moveSpeed: 4.0, rotSpeed: 3.0
};

const mindPoem = [
    "Mind in its purest play is like some bat",
    "That beats about in caverns all alone.",
    "Contriving by a kind of senseless wit",
    "Not to conclude against a wall of stone.",
    "It has no need to falter or explore;",
    "Darkly it knows what obstacles are there,"
];
const poemNodes: { x: number, y: number, text: string }[] = [];
let currentLineIndex = 0;

const projectiles: { x: number, y: number, z: number, vx: number, vy: number }[] = [];
const pulses: { x: number, y: number, z: number, age: number, maxAge: number, maxRadius: number }[] = [];

const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };
let isPointerLocked = false;
let lastTime = 0;
let frameCount = 0;

let moveTouchId: number | null = null;
let moveTouchStart = { x: 0, y: 0 };
let moveTouchCurrent = { x: 0, y: 0 };
let lookTouchId: number | null = null;
let lastLookTouch = { x: 0, y: 0 };
let lookTouchStartPos = { x: 0, y: 0 };
let lookTouchStartTime = 0;

const RAY_STEP = 8;
const CHAR_HEIGHT = 16;

// --- ADVANCED AUDIO SYSTEM ---
const SoundEngine = {
    ctx: null as AudioContext | null,
    masterGain: null as GainNode | null,
    reverb: null as ConvolverNode | null,
    reverbGain: null as GainNode | null,
    lastPingTime: 0,

    init() {
        try {
            const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioCtor();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.ctx.destination);

            this.reverb = this.ctx.createConvolver();
            let length = this.ctx.sampleRate * 3.0;
            let impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
            for (let i = 0; i < length; i++) {
                let decay = Math.pow(1 - i / length, 4);
                impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay;
                impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay;
            }
            this.reverb.buffer = impulse;

            this.reverbGain = this.ctx.createGain();
            this.reverbGain.gain.value = 1.0;

            this.reverb.connect(this.reverbGain);
            this.reverbGain.connect(this.masterGain);
        } catch (e) {
            console.warn("Audio Context init failed", e);
        }
    },

    getRelativePan(targetX: number, targetY: number) {
        let dx = targetX - player.x;
        let dy = targetY - player.y;
        let targetAngle = Math.atan2(dy, dx);
        let playerAngle = Math.atan2(player.dirY, player.dirX);
        let relAngle = targetAngle - playerAngle;
        while (relAngle > Math.PI) relAngle -= Math.PI * 2;
        while (relAngle < -Math.PI) relAngle += Math.PI * 2;
        return Math.sin(relAngle);
    },

    fire() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.15);
    },

    impact(x: number, y: number) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const panVal = this.getRelativePan(x, y);
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
        if (panner instanceof StereoPannerNode) panner.pan.value = panVal;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        gain.connect(panner);
        panner.connect(this.masterGain!);
        panner.connect(this.reverb!);

        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(60, now);
        osc1.frequency.exponentialRampToValueAtTime(20, now + 0.8);
        osc1.connect(gain);
        osc1.start(now);
        osc1.stop(now + 2.0);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.exponentialRampToValueAtTime(150, now + 1.5);
        osc2.connect(gain);
        osc2.start(now);
        osc2.stop(now + 2.0);
    },

    bump() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.35);
    },

    beaconPing(targetX: number, targetY: number, lineIndex: number, dist: number) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const panVal = this.getRelativePan(targetX, targetY);
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
        if (panner instanceof StereoPannerNode) panner.pan.value = panVal;

        const baseNotes = [277.18, 329.63, 369.99, 415.30, 493.88];
        let rootFreq = baseNotes[lineIndex % baseNotes.length];

        let closeness = Math.max(0, 1 - (dist / 20.0));
        let numHarmonics = 1 + Math.floor(closeness * 3.99);
        const harmonics = [1, 1.5, 1.25, 1.875];

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400 + (closeness * 2600);

        filter.connect(panner);
        panner.connect(this.masterGain!);
        panner.connect(this.reverb!);

        for (let i = 0; i < numHarmonics; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(rootFreq * harmonics[i], now);
            osc.detune.value = (Math.random() - 0.5) * 8;

            let peakVol = 0.2 / numHarmonics;
            if (i > 0) peakVol *= closeness;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(peakVol, now + 1.0);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

            osc.connect(gain);
            gain.connect(filter);
            osc.start(now);
            osc.stop(now + 4.0);
        }
    },

    collect() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const chord = [440, 554.37, 659.25, 830.61];
        chord.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2 / chord.length, now + 0.1 + (index * 0.05));
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
            osc.connect(gain);
            gain.connect(this.masterGain!);
            gain.connect(this.reverb!);
            osc.start(now);
            osc.stop(now + 2.1);
        });
    },

    footstep() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(60 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.05);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.06);
    }
};

// --- INITIALIZATION ---
function initWorld() {
    const emptySpots: { x: number, y: number }[] = [];
    for (let y = 1; y < mapHeight - 1; y++) {
        for (let x = 1; x < mapWidth - 1; x++) {
            if (worldMap[y][x] === 0) emptySpots.push({ x, y });
        }
    }

    for (let i = emptySpots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [emptySpots[i], emptySpots[j]] = [emptySpots[j], emptySpots[i]];
    }

    for (let i = 0; i < mindPoem.length; i++) {
        for (let spot of emptySpots) {
            let valid = true;
            for (let n of poemNodes) {
                if (Math.hypot(spot.x - n.x, spot.y - n.y) < 4) valid = false;
            }
            if (Math.hypot(spot.x - player.x, spot.y - player.y) < 4) valid = false;

            if (valid) {
                poemNodes.push({ x: spot.x, y: spot.y, text: mindPoem[i]! });
                break;
            }
        }
    }
}

document.getElementById('boot-btn')!.addEventListener('click', async () => {
    document.getElementById('boot-screen')!.style.display = 'none';
    SoundEngine.init();
    initWorld();

    try {
        if (!isMobile) await canvas.requestPointerLock();
    } catch (e) { }

    requestAnimationFrame(gameLoop);
    setTimeout(fireProjectile, 500);
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
    if (e.key.toLowerCase() === 'w') keys.w = true;
    if (e.key.toLowerCase() === 'a') keys.a = true;
    if (e.key.toLowerCase() === 's') keys.s = true;
    if (e.key.toLowerCase() === 'd') keys.d = true;
    if (e.code === 'Space' && (isPointerLocked || !isMobile)) {
        fireProjectile();
        document.getElementById('hud-scan')!.innerText = "PULSE EMITTED... TRACKING BOUNCEBACK";
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'w') keys.w = false;
    if (e.key.toLowerCase() === 'a') keys.a = false;
    if (e.key.toLowerCase() === 's') keys.s = false;
    if (e.key.toLowerCase() === 'd') keys.d = false;
});

window.addEventListener('mousedown', async (e) => {
    if (isMobile) return;
    if (!isPointerLocked) {
        try { await canvas.requestPointerLock(); } catch (err) { }
    } else {
        fireProjectile();
        document.getElementById('hud-scan')!.innerText = "PULSE EMITTED... TRACKING BOUNCEBACK";
    }
});

window.addEventListener('mousemove', (e) => {
    if (!isPointerLocked) return;
    applyCameraRotation(-e.movementX * 0.002);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (SoundEngine.ctx && SoundEngine.ctx.state === 'suspended') {
        SoundEngine.ctx.resume();
    }
    const mo = document.getElementById('mobile-overlay');
    if (mo) mo.style.opacity = '0';
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.clientX < width / 2) {
            if (moveTouchId === null) {
                moveTouchId = t.identifier;
                moveTouchStart = { x: t.clientX, y: t.clientY };
                moveTouchCurrent = { x: t.clientX, y: t.clientY };
            }
        } else {
            if (lookTouchId === null) {
                lookTouchId = t.identifier;
                lastLookTouch = { x: t.clientX, y: t.clientY };
                lookTouchStartPos = { x: t.clientX, y: t.clientY };
                lookTouchStartTime = Date.now();
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.identifier === moveTouchId) {
            moveTouchCurrent = { x: t.clientX, y: t.clientY };
        } else if (t.identifier === lookTouchId) {
            applyCameraRotation(-(t.clientX - lastLookTouch.x) * 0.006);
            lastLookTouch = { x: t.clientX, y: t.clientY };
        }
    }
}, { passive: false });

function handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]!;
        if (t.identifier === moveTouchId) {
            moveTouchId = null;
        } else if (t.identifier === lookTouchId) {
            lookTouchId = null;
            let totalDist = Math.hypot(t.clientX - lookTouchStartPos.x, t.clientY - lookTouchStartPos.y);
            if (Date.now() - lookTouchStartTime < 300 && totalDist < 15) {
                fireProjectile();
                document.getElementById('hud-scan')!.innerText = "PULSE EMITTED... TRACKING BOUNCEBACK";
            }
        }
    }
}
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

function fireProjectile() {
    SoundEngine.fire();
    tryVibrate(20);
    projectiles.push({
        x: player.x, y: player.y, z: 0,
        vx: player.dirX * 25.0, vy: player.dirY * 25.0
    });
}

// GAME UPDATE
let lastBumpTime = 0;
function update(dt: number) {
    let moveX = 0, moveY = 0;
    if (keys.w) moveY += 1;
    if (keys.s) moveY -= 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    if (moveTouchId !== null) {
        let dx = moveTouchCurrent.x - moveTouchStart.x;
        let dy = moveTouchCurrent.y - moveTouchStart.y;
        let dist = Math.hypot(dx, dy);
        let maxDist = 60;
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; dist = maxDist; }
        if (dist > 10) {
            let intensity = (dist - 10) / (maxDist - 10);
            moveX = (dx / dist) * intensity;
            moveY = (-dy / dist) * intensity;
        }
    }

    let moveStep = player.moveSpeed * dt;
    let collided = false;
    if (moveY !== 0) {
        if (worldMap[Math.floor(player.y)]![Math.floor(player.x + player.dirX * moveStep * moveY)] === 0) player.x += player.dirX * moveStep * moveY; else collided = true;
        if (worldMap[Math.floor(player.y + player.dirY * moveStep * moveY)]![Math.floor(player.x)] === 0) player.y += player.dirY * moveStep * moveY; else collided = true;
    }
    if (moveX !== 0) {
        const rightX = player.dirY, rightY = -player.dirX;
        if (worldMap[Math.floor(player.y)]![Math.floor(player.x + rightX * moveStep * moveX)] === 0) player.x += rightX * moveStep * moveX; else collided = true;
        if (worldMap[Math.floor(player.y + rightY * moveStep * moveX)]![Math.floor(player.x)] === 0) player.y += rightY * moveStep * moveX; else collided = true;
    }

    if (collided && performance.now() - lastBumpTime > 300) {
        SoundEngine.bump();
        tryVibrate([20, 20]);
        lastBumpTime = performance.now();
    } else if ((moveX !== 0 || moveY !== 0) && frameCount % 15 === 0) {
        tryVibrate(8);
        SoundEngine.footstep();
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        let mX = Math.floor(p.x), mY = Math.floor(p.y);

        if (mX < 0 || mX >= mapWidth || mY < 0 || mY >= mapHeight || worldMap[mY]![mX]! > 0) {
            SoundEngine.impact(p.x, p.y);
            tryVibrate(10);
            pulses.push({
                x: p.x, y: p.y, z: 0,
                age: 0, maxAge: 5.0,
                maxRadius: 30.0
            });
            projectiles.splice(i, 1);
        }
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i]!.age += dt;
        if (pulses[i]!.age >= pulses[i]!.maxAge) pulses.splice(i, 1);
    }

    if (currentLineIndex < poemNodes.length) {
        let target = poemNodes[currentLineIndex]!;
        let dist = Math.hypot(player.x - target.x, player.y - target.y);

        if (frameCount % 120 === 0) {
            SoundEngine.beaconPing(target.x, target.y, currentLineIndex, dist);
        }

        if (dist < 8.0) {
            let beatInterval = Math.max(15, Math.floor(dist * 8));
            if (frameCount % beatInterval === 0) {
                tryVibrate(15);
            }
        }

        if (dist < 1.5 && (projectiles.length > 0 || pulses.some(p => p.age < 0.5))) {
            SoundEngine.collect();
            tryVibrate([50, 50, 50, 50, 150]);

            const newLine = document.createElement('div');
            newLine.className = 'poem-line';
            newLine.textContent = target.text;
            poemUI.appendChild(newLine);

            currentLineIndex++;
            document.getElementById('hud-scan')!.innerText = "SIGNAL ACQUIRED. SEEKING NEXT NODE.";

            if (currentLineIndex >= poemNodes.length) {
                document.getElementById('hud-scan')!.innerText = "ALL SIGNALS ACQUIRED. RESONANCE COMPLETE.";
                document.getElementById('hud-zone')!.innerText = "TRANSCENDENCE";
                poemUI.classList.add('complete');
            }
        }
    }

    document.getElementById('hud-pos')!.innerText = `${player.x.toFixed(1)}, ${player.y.toFixed(1)}`;
}

function getIllumination(x: number, y: number, z: number) {
    let rLight = 0, gLight = 0, bLight = 0, totalLight = 0;

    let distToPlayer = Math.hypot(x - player.x, y - player.y);
    if (distToPlayer < 4.0) {
        let pLight = (4.0 - distToPlayer) * 0.15;
        rLight += pLight * 255;
        gLight += pLight * 200;
        bLight += pLight * 150;
        totalLight += pLight;
    }

    for (let p of projectiles) {
        let d = Math.hypot(x - p.x, y - p.y, z - p.z);
        if (d < 2.0) {
            let i = (2.0 - d) * 1.0;
            gLight += i * 255; bLight += i * 204; totalLight += i;
        }
    }

    for (let p of pulses) {
        let d = Math.hypot(x - p.x, y - p.y, z - p.z);
        let radius = (p.age / p.maxAge) * p.maxRadius;
        let distToWave = Math.abs(d - radius);
        let waveThick = 2.0;

        if (distToWave < waveThick) {
            let intensity = Math.pow(1.0 - (distToWave / waveThick), 2);
            let timeFade = Math.pow(1.0 - (p.age / p.maxAge), 1.0);
            let pulseStrength = intensity * timeFade * 1.5;
            rLight += pulseStrength * 255; gLight += pulseStrength * 140; totalLight += pulseStrength * 0.8;
        }

        if (d < radius) {
            let innerFade = Math.pow(1.0 - (p.age / p.maxAge), 1.2);
            let ambient = 0.15 * innerFade;
            rLight += ambient * 255; gLight += ambient * 140; totalLight += ambient * 0.5;
        }
    }

    rLight = Math.min(255, rLight);
    gLight = Math.min(255, gLight);
    bLight = Math.min(255, bLight);
    let alpha = Math.max(0.1, Math.min(1.0, totalLight));

    return `rgba(${Math.floor(rLight)}, ${Math.floor(gLight)}, ${Math.floor(bLight)}, ${alpha})`;
}

function getChar(globalWallX: number, z: number) {
    if (pretextLines.length === 0) return ' ';
    let uAbs = Math.floor(globalWallX * 12);
    let v = Math.floor((z + 0.5) * pretextLines.length);
    v = Math.max(0, Math.min(pretextLines.length - 1, v));
    
    let lineObj = pretextLines[v];
    if (!lineObj || lineObj.length === 0) return ' ';
    
    let len = lineObj.length;
    let u = ((uAbs % len) + len) % len;
    return lineObj[u] || ' ';
}

function draw() {
    ctx.fillStyle = '#020101';
    ctx.fillRect(0, 0, width, height);

    ctx.font = `bold ${CHAR_HEIGHT}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let target = currentLineIndex < poemNodes.length ? poemNodes[currentLineIndex] : null;

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
            if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) { hit = 1; break; }
            if (worldMap[mapY]![mapX]! > 0) hit = 1;
            depth++;
        }

        let perpWallDist = side === 0 ? (mapX - player.x + (1 - stepX) / 2) / rayDirX : (mapY - player.y + (1 - stepY) / 2) / rayDirY;
        let exactHitX = player.x + perpWallDist * rayDirX;
        let exactHitY = player.y + perpWallDist * rayDirY;

        let lineHeight = Math.floor(height / perpWallDist);
        let drawStart = Math.max(0, Math.floor(-lineHeight / 2 + height / 2));
        let drawEnd = Math.min(height, Math.floor(lineHeight / 2 + height / 2));

        let yOffset = drawStart % CHAR_HEIGHT;
        let globalWallX = side === 0 ? (rayDirX > 0 ? -exactHitY : exactHitY) : (rayDirY < 0 ? -exactHitX : exactHitX);

        for (let y = drawStart - yOffset; y < drawEnd; y += CHAR_HEIGHT) {
            let z = (y - height / 2) / lineHeight;
            let color = getIllumination(exactHitX, exactHitY, z);
            ctx.fillStyle = color;
            ctx.fillText(getChar(globalWallX, z), x + RAY_STEP / 2, y);
        }

        for (let y = drawEnd; y < height; y += CHAR_HEIGHT * 1.2) {
            let currentDist = height / (2.0 * y - height);
            let weight = currentDist / perpWallDist;
            let floorX = weight * exactHitX + (1.0 - weight) * player.x;
            let floorY = weight * exactHitY + (1.0 - weight) * player.y;

            let ceilY = height - y;
            let fMapX = Math.floor(floorX), fMapY = Math.floor(floorY);

            if (target && fMapX === target.x && fMapY === target.y) {
                let pulseAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.5;
                ctx.fillStyle = `rgba(224, 36, 195, ${pulseAlpha})`;
                ctx.fillText('♦', x + RAY_STEP / 2, y);
                ctx.fillText('♦', x + RAY_STEP / 2, ceilY);
                continue;
            }

            let color = getIllumination(floorX, floorY, 0.5);
            ctx.fillStyle = color;
            ctx.fillText('.', x + RAY_STEP / 2, y);

            let ceilColor = getIllumination(floorX, floorY, -0.5);
            ctx.fillStyle = ceilColor;
            ctx.fillText('+', x + RAY_STEP / 2, ceilY);
        }
    }

    drawMinimap();

    if (moveTouchId !== null) {
        ctx.beginPath();
        ctx.arc(moveTouchStart.x, moveTouchStart.y, 60, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(moveTouchCurrent.x, moveTouchCurrent.y, 25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 140, 0, 0.4)';
        ctx.fill();
    }
}

function drawMinimap() {
    mCtx.clearRect(0, 0, minimap.width, minimap.height);
    const scaleX = minimap.width / mapWidth;
    const scaleY = minimap.height / mapHeight;

    mCtx.fillStyle = 'rgba(255, 140, 0, 0.2)';
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            if (worldMap[y]![x]! > 0) mCtx.fillRect(x * scaleX, y * scaleY, scaleX - 1, scaleY - 1);
        }
    }

    if (currentLineIndex < poemNodes.length) {
        let t = poemNodes[currentLineIndex]!;
        mCtx.beginPath();
        mCtx.arc((t.x + 0.5) * scaleX, (t.y + 0.5) * scaleY, (3 + Math.sin(frameCount * 0.2) * 2), 0, Math.PI * 2);
        mCtx.fillStyle = 'rgba(224, 36, 195, 0.8)';
        mCtx.fill();
    }

    for (let p of pulses) {
        let r = (p.age / p.maxAge) * p.maxRadius * scaleX;
        let alpha = 1.0 - (p.age / p.maxAge);
        mCtx.beginPath();
        mCtx.arc(p.x * scaleX, p.y * scaleY, r, 0, Math.PI * 2);
        mCtx.strokeStyle = `rgba(255, 140, 0, ${alpha})`;
        mCtx.lineWidth = 2;
        mCtx.stroke();
    }

    mCtx.fillStyle = '#00ffcc';
    for (let p of projectiles) {
        mCtx.beginPath(); mCtx.arc(p.x * scaleX, p.y * scaleY, 2, 0, Math.PI * 2); mCtx.fill();
    }

    mCtx.fillStyle = '#fff';
    mCtx.beginPath(); mCtx.arc(player.x * scaleX, player.y * scaleY, 3, 0, Math.PI * 2); mCtx.fill();

    mCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    mCtx.beginPath();
    mCtx.moveTo(player.x * scaleX, player.y * scaleY);
    mCtx.lineTo((player.x + player.dirX * 3 + player.planeX * 3) * scaleX, (player.y + player.dirY * 3 + player.planeY * 3) * scaleY);
    mCtx.moveTo(player.x * scaleX, player.y * scaleY);
    mCtx.lineTo((player.x + player.dirX * 3 - player.planeX * 3) * scaleX, (player.y + player.dirY * 3 - player.planeY * 3) * scaleY);
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
