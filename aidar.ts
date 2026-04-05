import { prepareWithSegments, layoutNextLine } from './src/layout.js';

// --- Global Navigation State ---
let isAutoPilot = true;
let currentPath = [];
let currentPathTarget = null;

// A* Pathfinding with Clearance using a Binary Heap
function getPath(sx, sy, gx, gy, isGreedy = false) {
    if (sx === gx && sy === gy) return [];
    
    // Check if cell is strictly passable
    const isPassable = (x, y) => {
        if(x<0||x>=GRID_W||y<0||y>=GRID_H) return false;
        return grid[x][y] === null;
    };
    
    // Check 3x3 surrounding zone to ensure safe clearance for player radius
    const isSafe = (x, y) => {
        if (!isPassable(x, y)) return false;
        if (!isPassable(x+1, y) || !isPassable(x-1, y) || !isPassable(x, y+1) || !isPassable(x, y-1)) return false;
        if (!isPassable(x+1, y+1) || !isPassable(x-1, y-1) || !isPassable(x-1, y+1) || !isPassable(x+1, y-1)) return false;
        return true;
    };

    const octileDistance = (x1: any, y1: any, x2: any, y2: any) => {
        let dx = Math.abs(x1 - x2);
        let dy = Math.abs(y1 - y2);
        return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };

    class MinHeap {
        data: any[];
        constructor() { this.data = []; }
        push(val: any) {
            this.data.push(val);
            this.up(this.data.length - 1);
        }
        pop() {
            if (this.data.length === 0) return null;
            const top = this.data[0];
            const bottom = this.data.pop();
            if (this.data.length > 0) {
                this.data[0] = bottom;
                this.down(0);
            }
            return top;
        }
        up(i: any) {
            while (i > 0) {
                const p = Math.floor((i - 1) / 2);
                if (this.data[p].f <= this.data[i].f) break;
                const tmp = this.data[i]; this.data[i] = this.data[p]; this.data[p] = tmp;
                i = p;
            }
        }
        down(i: any) {
            const len = this.data.length;
            while (true) {
                let left = i * 2 + 1; let right = i * 2 + 2; let min = i;
                if (left < len && this.data[left].f < this.data[min].f) min = left;
                if (right < len && this.data[right].f < this.data[min].f) min = right;
                if (min === i) break;
                const tmp = this.data[i]; this.data[i] = this.data[min]; this.data[min] = tmp;
                i = min;
            }
        }
    }

    let openSet = new MinHeap();
    let gScore = new Float32Array(GRID_W * GRID_H).fill(Infinity);
    let parent = new Int32Array(GRID_W * GRID_H).fill(-1);
    
    let startIdx = sy * GRID_W + sx;
    gScore[startIdx] = 0;
    openSet.push({ x: sx, y: sy, f: octileDistance(sx, sy, gx, gy) });

    const dirs = [[0,1,1],[1,0,1],[0,-1,1],[-1,0,1], [1,1,1.414], [1,-1,1.414], [-1,1,1.414], [-1,-1,1.414]];

    let found = false;
    
    while(openSet.data.length > 0) {
        let curr = openSet.pop();
        let cx = curr.x;
        let cy = curr.y;
        
        if (cx === gx && cy === gy) {
            found = true;
            break;
        }
        
        let currIdx = cy * GRID_W + cx;
        
        for (let i = 0; i < dirs.length; i++) {
            let dx = dirs[i][0];
            let dy = dirs[i][1];
            let nx = cx + dx;
            let ny = cy + dy;
            
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            
            // To prevent corner cutting
            if (dx !== 0 && dy !== 0) {
                if (!isPassable(nx, cy) || !isPassable(cx, ny)) continue;
            }
            
            // Allow passable, but prefer clearance
            if (!isPassable(nx, ny)) continue;
            let isSafeNode = isSafe(nx, ny);
            
            // Heavily penalize moving closely to walls so the agent chooses safe open paths
            let penalty = isSafeNode ? 0 : 40; 
            
            let nIdx = ny * GRID_W + nx;
            let tentativeG = gScore[currIdx] + dirs[i][2] + penalty;
            
            if (tentativeG < gScore[nIdx]) {
                parent[nIdx] = currIdx;
                gScore[nIdx] = tentativeG;
                let priority = isGreedy ? octileDistance(nx, ny, gx, gy) : tentativeG + octileDistance(nx, ny, gx, gy);
                openSet.push({ x: nx, y: ny, f: priority });
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

// --- Engine Constants & Setup ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false });

        // Haptics Helper
        const tryVibrate = (ms) => {
            try {
                if (navigator.vibrate) navigator.vibrate(ms);
            } catch (e) { }
        };

        // Web Audio Sonification Engine
        const SoundEngine = {
            ctx: null,
            masterGain: null,
            reverb: null,
            reverbGain: null,
            delayNode: null,
            delayFeedback: null,
            isScanning: false,
            isComplete: false,
            lastPingTime: 0,
            lastBeatTime: 0,
            notes: [880, 987.77, 1108.73, 1318.51, 1479.98, 1760],

            init() {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioContext();

                    this.masterGain = this.ctx.createGain();
                    this.masterGain.gain.value = 0.5;
                    this.masterGain.connect(this.ctx.destination);

                    this.delayNode = this.ctx.createDelay(2.0);
                    this.delayNode.delayTime.value = 0.2;
                    this.delayFeedback = this.ctx.createGain();
                    this.delayFeedback.gain.value = 0.4;

                    this.delayNode.connect(this.delayFeedback);
                    this.delayFeedback.connect(this.delayNode);
                    this.delayNode.connect(this.masterGain);

                    this.reverb = this.ctx.createConvolver();
                    let length = this.ctx.sampleRate * 4.0;
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
                    this.reverbGain.gain.value = 1.2;

                    this.reverb.connect(this.reverbGain);
                    this.reverbGain.connect(this.masterGain);

                    this.delayFeedback.connect(this.reverb);

                } catch (e) { console.warn("Web Audio API not supported", e); }
            },

            ping(panValue = 0) {
                if (!this.ctx || this.isComplete) return;
                const now = this.ctx.currentTime;

                if (now - this.lastPingTime < 0.08) return;
                this.lastPingTime = now;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
                if (panner.pan) {
                    panner.pan.value = panValue;
                }

                osc.type = 'sine';
                const baseFreq = this.notes[Math.floor(Math.random() * this.notes.length)];
                const freq = baseFreq * (Math.random() > 0.8 ? 2 : 1);

                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.95, now + 0.05);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                osc.connect(gain);
                gain.connect(panner);

                panner.connect(this.masterGain);
                panner.connect(this.reverb);
                panner.connect(this.delayNode);

                osc.start(now);
                osc.stop(now + 0.15);
            },

            algorithmicBeat(distRatio) {
                if (!this.ctx || this.isComplete) return;
                const now = this.ctx.currentTime;

                const beatInterval = Math.max(0.08, 0.5 * distRatio);
                if (now - this.lastBeatTime < beatInterval) return;
                this.lastBeatTime = now;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(1200 - (distRatio * 800), now);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.05, now + 0.001);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now);
                osc.stop(now + 0.05);
            },

            beaconPing(panValue = 0, distRatio = 1, lineIndex = 0) {
                if (!this.ctx || this.isComplete) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();

                if (panner.pan) panner.pan.value = panValue;

                const baseNotes = [329.63, 369.99, 440.00, 493.88, 554.37];
                let note = baseNotes[lineIndex % baseNotes.length];
                if (lineIndex > 4) note *= 1.5;
                if (lineIndex > 8) note *= 1.25;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(note, now);
                osc.frequency.linearRampToValueAtTime(note + (Math.sin(now) * 2), now + 1);

                const maxVol = 0.35;
                const vol = maxVol * (1 - distRatio * 0.7);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(vol, now + 0.8);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

                osc.connect(gain);
                gain.connect(panner);
                panner.connect(this.masterGain);
                panner.connect(this.reverb);

                osc.start(now);
                osc.stop(now + 3.0);
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
                gain.connect(this.masterGain);
                gain.connect(this.reverb);

                osc.start(now);
                osc.stop(now + 0.35);
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
                    gain.connect(this.masterGain);
                    gain.connect(this.reverb);

                    osc.start(now);
                    osc.stop(now + 2.1);
                });
            },

            finale() {
                if (!this.ctx) return;
                this.isComplete = true;
                const now = this.ctx.currentTime;

                const root = 220;
                const majorNine = [root, root * 1.25, root * 1.5, root * 1.875, root * 2, root * 2.25];

                majorNine.forEach((freq, index) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();

                    if (panner.pan) panner.pan.value = (Math.random() - 0.5) * 0.8;

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq + (Math.random() * 2), now);

                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.15 / majorNine.length, now + 2.0 + (index * 0.8));
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 15.0);

                    osc.connect(gain);
                    gain.connect(panner);
                    panner.connect(this.masterGain);
                    panner.connect(this.reverb);

                    osc.start(now);
                    osc.stop(now + 16.0);
                });

                this.delayNode.delayTime.linearRampToValueAtTime(1.5, now + 4);
                this.delayFeedback.gain.linearRampToValueAtTime(0.7, now + 4);
            },

            update(targetPan = 0, closestObstacleDist = 0, objDistRatio = 1, targetIlluminated = false) {
                if (this.isScanning && !this.isComplete) {
                    if (this.ctx && this.delayNode) {
                        const now = this.ctx.currentTime;
                        const dynamicDelay = 0.05 + Math.min(1.0, closestObstacleDist / 1200) * 0.55;
                        this.delayNode.delayTime.setTargetAtTime(dynamicDelay, now, 0.1);
                    }

                    if (targetIlluminated) {
                        this.algorithmicBeat(objDistRatio);
                    }

                    if (Math.random() < 0.12) {
                        this.ping(targetPan);
                    }
                }
            },

            setScanning(isScanning) {
                this.isScanning = isScanning;
            }
        };

        // --- TTS Engine ---
        const TTSEngine = {
            voices: [],
            init() {
                if ('speechSynthesis' in window) {
                    const loadVoices = () => {
                        this.voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
                    };
                    loadVoices();
                    if (speechSynthesis.onvoiceschanged !== undefined) {
                        speechSynthesis.onvoiceschanged = loadVoices;
                    }
                }
            },
            speak(text, loopIndex) {
                if (!('speechSynthesis' in window) || this.voices.length === 0) return;
                speechSynthesis.cancel();
                let utterance = new SpeechSynthesisUtterance(text);
                
                let mode = loopIndex % 3;
                if (mode === 0) {
                    // American (Standard)
                    utterance.pitch = 0.8;
                    utterance.rate = 0.85;
                    utterance.voice = this.voices.find(v => v.lang === 'en-US') || this.voices[0];
                } else if (mode === 1) {
                    // British (Deeper, Slower)
                    utterance.pitch = 0.4;
                    utterance.rate = 0.70;
                    utterance.voice = this.voices.find(v => v.lang === 'en-GB') || this.voices[0];
                } else {
                    // Fast/Alien
                    utterance.pitch = 1.3;
                    utterance.rate = 1.20;
                    utterance.voice = this.voices.find(v => v.lang === 'en-AU' || v.lang === 'en-IE') || this.voices[this.voices.length - 1];
                }
                window.speechSynthesis.speak(utterance);
            }
        };

        // World Grid
        const GRID_W = 400;
        const GRID_H = 400;
        const CELL_SIZE = 12;
        const WORLD_W = GRID_W * CELL_SIZE;
        const WORLD_H = GRID_H * CELL_SIZE;

        let grid = new Array(GRID_W).fill(0).map(() => new Array(GRID_H).fill(null));

        // Persistent World Accumulator (The "LiDAR Map")
        const mapCanvas = document.createElement('canvas');
        mapCanvas.width = WORLD_W;
        mapCanvas.height = WORLD_H;
        const mapCtx = mapCanvas.getContext('2d', { alpha: false });
        mapCtx.fillStyle = '#050403';
        mapCtx.fillRect(0, 0, WORLD_W, WORLD_H);

        // High-Resolution Floor Text Canvas (Revealed by LiDAR)
        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = WORLD_W;
        floorCanvas.height = WORLD_H;
        const floorCtx = floorCanvas.getContext('2d');

        // State Variables
        let loopCount = 0;
        let isRunning = false;
        let frameCount = 0;
        let currentZone = '';
        let lastBumpTime = 0;
        let lastBeaconFrame = 0;
        let sequenceComplete = false;
        let isTargetIlluminated = false;

        const player = {
            x: WORLD_W / 2,
            y: WORLD_H / 2,
            vx: 0, vy: 0,
            speed: 5.5, /* Increased speed for better mobile traversal */
            radius: 4
        };

        const keys = { w: false, a: false, s: false, d: false };
        const mouse = { x: 0, y: 0, isDown: false };

        // Touch controls
        let moveTouchId = null;
        let aimTouchId = null;
        const joystickOrigin = { x: 0, y: 0 };
        const joystickCurrent = { x: 0, y: 0 };
        let joystickActive = false;

        let activeRays = [];
        const sparks = [];
        let radarAngle = 0;

        // Poem State
        let poemNodes = [];
        let currentLineIndex = 0;
        const poemUI = document.getElementById('collected-poem');
        const progressTextUI = document.getElementById('progress-text');
        const progressDotsUI = document.getElementById('progress-dots');

        // --- Floor Rendering ---
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
                        if (cursor.segmentIndex === 0 && cursor.graphemeIndex === 0) break;
                        if (!line) break;
                    }
                    floorCtx.fillText(line.text, poemNodes[i].x, offsetY);
                    offsetY += 40;
                    if (!line || (cursor.segmentIndex === line.end.segmentIndex && cursor.graphemeIndex === line.end.graphemeIndex)) break;
                    cursor = line.end;
                }
            }
        }

        // --- World Generation (Geometry & Path) ---
        function initWorld() {
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

            let currentX = player.x + 200;
            let currentY = player.y - 200;
            poemNodes.push({ x: currentX, y: currentY, text: mindPoem[0] });

            for (let i = 1; i < mindPoem.length; i++) {
                let placed = false;
                let attempts = 0;
                while (!placed && attempts < 1000) {
                    attempts++;
                    let angle = Math.random() * Math.PI * 2;
                    let dist = 500 + Math.random() * 300; /* Increased distance between fragments */
                    let nx = currentX + Math.cos(angle) * dist;
                    let ny = currentY + Math.sin(angle) * dist;

                    if (nx > 400 && nx < WORLD_W - 400 && ny > 400 && ny < WORLD_H - 400) {
                        let tooClose = false;
                        for (let node of poemNodes) {
                            if (Math.hypot(nx - node.x, ny - node.y) < 500) { /* Increased safe zone */
                                tooClose = true;
                                break;
                            }
                        }

                        if (!tooClose) {
                            currentX = nx;
                            currentY = ny;
                            poemNodes.push({ x: currentX, y: currentY, text: mindPoem[i] });
                            placed = true;
                        }
                    }
                }
            }

            updateFloorCanvas();

            // Populate Progress UI
            progressDotsUI.innerHTML = '';
            for (let i = 0; i < poemNodes.length; i++) {
                let dot = document.createElement('div');
                dot.className = 'progress-dot';
                progressDotsUI.appendChild(dot);
            }
            progressTextUI.textContent = `FRAGMENTS 0 / ${poemNodes.length}`;

            for (let i = 0; i < GRID_W; i++) {
                for (let j = 0; j < GRID_H; j++) {
                    grid[i][j] = null;
                }
            }

            for (let i = 0; i < GRID_W; i++) {
                grid[i][0] = grid[i][GRID_H - 1] = { zone: 'BOUNDARY', color: '#ff0000', text: 'Perimeter.' };
                grid[0][i] = grid[GRID_W - 1][i] = { zone: 'BOUNDARY', color: '#ff0000', text: 'Perimeter.' };
            }

            const isNearNode = (gx, gy) => {
                let px = gx * CELL_SIZE;
                let py = gy * CELL_SIZE;
                for (let node of poemNodes) {
                    // Use a wide rectangular bounding box instead of a circle,
                    // because sentences are wide. This prevents walls from slicing through text!
                    let dx = Math.abs(px - node.x);
                    let dy = Math.abs(py - node.y);
                    if (dx < 380 && dy < 150) {
                        return true;
                    }
                }
                return false;
            };

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
                            if (!isNearNode(wx, wy)) {
                                let spawnDist = Math.sqrt((wx * CELL_SIZE - player.x) ** 2 + (wy * CELL_SIZE - player.y) ** 2);
                                if (spawnDist > 100) {
                                    // Wall color changed to Deep Slate Cyan to create immense contrast with Amber text
                                    grid[wx][wy] = { zone: 'MAZE_WALL', color: '#16323c', text: 'Dense architectural formation.' };
                                }
                            }
                        }
                    }
                }
            }
        }

        function resetWorld() {
            loopCount++;
            poemNodes = [];
            currentLineIndex = 0;
            sequenceComplete = false;
            SoundEngine.isComplete = false;
            currentPath = null;
            
            poemUI.classList.remove('complete');
            poemUI.innerHTML = ''; 
            
            let modeName = loopCount % 3 === 0 ? 'A-STAR HEURISTIC' : loopCount % 3 === 1 ? 'GREEDY PATHING' : 'POTENTIAL FIELD DESCENT';
            document.getElementById('hud-scan').textContent = "AWAITING PHOTONIC RETURN...";
            document.getElementById('hud-zone').textContent = "MODE " + modeName;
            document.querySelectorAll('.hud, #progress-ui').forEach(el => el.style.opacity = '1');
            
            mapCtx.fillStyle = '#050403';
            mapCtx.fillRect(0, 0, WORLD_W, WORLD_H);
            
            initWorld();
        }

        // --- Input Handling ---
        const autopilotUI = document.getElementById('autopilot-ui');
        if (autopilotUI) {
            autopilotUI.addEventListener('click', () => {
                isAutoPilot = !isAutoPilot;
                autopilotUI.textContent = isAutoPilot ? '[ AUTO-PILOT : ON ]' : '[ AUTO-PILOT : OFF ]';
                autopilotUI.style.color = isAutoPilot ? 'var(--cyan)' : 'var(--amber)';
                autopilotUI.style.borderColor = isAutoPilot ? 'var(--cyan)' : 'var(--amber)';
            });
        }
        window.addEventListener('resize', resizeCanvas);
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

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
            if (!sequenceComplete) tryVibrate(15);
        });
        canvas.addEventListener('mouseup', () => mouse.isDown = false);

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
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
                    if (!sequenceComplete) tryVibrate(15);
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
                if (t.identifier === moveTouchId) {
                    joystickCurrent.x = t.clientX;
                    joystickCurrent.y = t.clientY;
                } else if (t.identifier === aimTouchId) {
                    mouse.x = t.clientX;
                    mouse.y = t.clientY;
                }
            }
        }, { passive: false });

        const handleTouchEnd = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                let t = e.changedTouches[i];
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

        // --- Raycasting (DDA Algorithm) ---
        function castRay(ox, oy, angle, maxDist) {
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

                if (grid[mapX][mapY]) {
                    hit = true;
                    hitData = grid[mapX][mapY];
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

        // --- Core Logic Update ---
        function update() {
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
                
                let mode = loopCount % 3;
                let targetAngle = Math.atan2(target.y - player.y, target.x - player.x);

                if (mode === 2) {
                    // Potential Field Navigation (Gradient Descent / RL-style continuous field)
                    // Attractive force to target
                    let forceX = Math.cos(targetAngle) * player.speed;
                    let forceY = Math.sin(targetAngle) * player.speed;
                    
                    // Repulsive force from walls using 8-directional probe
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                        let hit = castRay(player.x, player.y, a, 120);
                        if (hit && hit.dist > 0 && hit.dist < 60) {
                            let strength = (60 - hit.dist) / 60;
                            forceX -= Math.cos(a) * strength * player.speed * 2.5; 
                            forceY -= Math.sin(a) * strength * player.speed * 2.5;
                        }
                    }
                    
                    vx = forceX;
                    vy = forceY;
                    
                    let flen = Math.hypot(vx, vy);
                    if (flen > player.speed) {
                        vx = (vx / flen) * player.speed;
                        vy = (vy / flen) * player.speed;
                    }
                    
                    mouse.x = player.x + vx * 20 - (player.x - canvas.width/2);
                    mouse.y = player.y + vy * 20 - (player.y - canvas.height/2);
                    mouse.isDown = true;
                    currentPath = [];
                } else {
                    // A* (mode = 0) or Greedy (mode = 1) Navigation
                    if (!currentPath || currentPath.length === 0 || currentPathTarget !== target) {
                        let sx = Math.floor(player.x / CELL_SIZE);
                        let sy = Math.floor(player.y / CELL_SIZE);
                        let gx = Math.floor(target.x / CELL_SIZE);
                        let gy = Math.floor(target.y / CELL_SIZE);
                        currentPath = getPath(sx, sy, gx, gy, mode === 1);
                        currentPathTarget = target;
                    }
                    
                    if (currentPath && currentPath.length > 0) {
                        let nextNode = currentPath[0];
                        let targetX = nextNode.x * CELL_SIZE + CELL_SIZE / 2;
                        let targetY = nextNode.y * CELL_SIZE + CELL_SIZE / 2;
                        let dx = targetX - player.x;
                        let dy = targetY - player.y;
                        let dist = Math.hypot(dx, dy);
                        
                        if (dist < player.speed * 2.5) {
                            currentPath.shift();
                        }
                        
                        if (currentPath.length > 0) {
                            let lookAhead = currentPath[0];
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
                        // Fallback to direct homing
                        vx = Math.cos(targetAngle) * player.speed;
                        vy = Math.sin(targetAngle) * player.speed;
                        mouse.x = player.x + Math.cos(targetAngle) * 100 - (player.x - canvas.width/2);
                        mouse.y = player.y + Math.sin(targetAngle) * 100 - (player.y - canvas.height/2);
                        mouse.isDown = true;
                    }
                }
            }

            // Magnetic Pull toward objective for delightful mobile control
            if (!isAutoPilot && !sequenceComplete && currentLineIndex < poemNodes.length) {
                let target = poemNodes[currentLineIndex];
                let dx = target.x - player.x;
                let dy = target.y - player.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                // Expanded magnetic pull radius to 350px for a smoother mobile glide
                if (dist < 350) {
                    let pull = ((350 - dist) / 350) * 2.0; // Stronger, wider pull
                    vx += (dx / dist) * pull;
                    vy += (dy / dist) * pull;
                }
            }

            if (vx !== 0 && vy !== 0 && !joystickActive) {
                const len = Math.sqrt(vx * vx + vy * vy);
                vx = (vx / len) * player.speed;
                vy = (vy / len) * player.speed;
            }

            const nextX = player.x + vx;
            const nextY = player.y + vy;
            let collided = false;

            const gridX = Math.floor(nextX / CELL_SIZE);
            const gridY = Math.floor(player.y / CELL_SIZE);
            if (gridX >= 0 && gridX < GRID_W && !grid[gridX][gridY]) {
                player.x = nextX;
            } else if (vx !== 0) { collided = true; }

            const gridX2 = Math.floor(player.x / CELL_SIZE);
            const gridY2 = Math.floor(nextY / CELL_SIZE);
            if (gridY2 >= 0 && gridY2 < GRID_H && !grid[gridX2][gridY2]) {
                player.y = nextY;
            } else if (vy !== 0) { collided = true; }

            if (collided && !sequenceComplete) {
                if (isAutoPilot) currentPath = null; // force recalculation to escape local snags
                let now = performance.now();
                if (now - lastBumpTime > 200) {
                    tryVibrate(8);
                    SoundEngine.bump();
                    lastBumpTime = now;
                }
            }

            if (frameCount % 10 === 0 && !sequenceComplete) {
                document.getElementById('hud-pos').textContent = `${Math.floor(player.x)}, ${Math.floor(player.y)}`;
            }

            // Scanner & Guidance Logic
            activeRays = [];
            const camX = player.x - canvas.width / 2;
            const camY = player.y - canvas.height / 2;
            const mouseAngle = Math.atan2(mouse.y - (player.y - camY), mouse.x - (player.x - camX));

            let closestHitDist = 1200;
            let distToTarget = 1200;
            let panValue = 0;
            let target = null;
            isTargetIlluminated = false;

            // Check Collection & Progression State
            if (!sequenceComplete && currentLineIndex < poemNodes.length) {
                target = poemNodes[currentLineIndex];
                distToTarget = Math.sqrt((player.x - target.x) ** 2 + (player.y - target.y) ** 2);

                if (distToTarget < 160 && mouse.isDown) { // Increased radius for mobile leniency
                    TTSEngine.speak(target.text, loopCount);
                    SoundEngine.collect();
                    tryVibrate([30, 50, 30]);

                    const newLine = document.createElement('div');
                    newLine.className = 'poem-line';
                    newLine.textContent = target.text;
                    poemUI.appendChild(newLine);

                    // Update Progress UI
                    document.querySelectorAll('.progress-dot')[currentLineIndex].classList.add('active');
                    progressTextUI.textContent = `FRAGMENTS ${currentLineIndex + 1} / ${poemNodes.length}`;

                    currentLineIndex++;
                    updateFloorCanvas();

                    if (currentLineIndex >= poemNodes.length) {
                        sequenceComplete = true;
                        document.getElementById('hud-scan').textContent = "SEQUENCE COMPLETE.";
                        document.getElementById('hud-zone').textContent = "TRANSCENDENCE";

                        // Fade out HUD
                        document.querySelectorAll('.hud, #progress-ui').forEach(el => el.style.opacity = '0');

                        // Trigger Finale Sequence
                        poemUI.classList.add('complete');
                        SoundEngine.finale();
                        
                        setTimeout(() => {
                            resetWorld();
                        }, 13000);
                    }
                }

                if (!sequenceComplete) {
                    let dx = target.x - player.x;
                    panValue = Math.max(-1, Math.min(1, dx / 300));
                }
            }

            radarAngle += 0.05;
            if (!sequenceComplete) {
                for (let i = 0; i < 4; i++) {
                    const rAngle = radarAngle + (i * (Math.PI / 2));
                    const hit = castRay(player.x, player.y, rAngle, 800);
                    if (hit) {
                        mapCtx.fillStyle = hit.data.color;
                        mapCtx.globalAlpha = 0.2;
                        mapCtx.fillRect(hit.x, hit.y, 2, 2);
                        mapCtx.globalAlpha = 1.0;
                    }
                }
            }

            if (mouse.isDown && !sequenceComplete) {
                if (frameCount % 30 === 0) tryVibrate(5);

                const numRays = window.innerWidth < 768 ? 35 : 60;
                const coneSpread = Math.PI / 3.5;

                for (let i = 0; i < numRays; i++) {
                    const angle = mouseAngle + (Math.random() - 0.5) * coneSpread;
                    const hit = castRay(player.x, player.y, angle, 1200);

                    if (hit) {
                        activeRays.push({ endX: hit.x, endY: hit.y });
                        closestHitDist = Math.min(closestHitDist, hit.dist);

                        if (Math.random() < 0.6) {
                            mapCtx.fillStyle = hit.data.color;
                            mapCtx.globalAlpha = 0.5;
                            mapCtx.fillRect(hit.x + (Math.random() - 0.5) * 3, hit.y + (Math.random() - 0.5) * 3, 2.5, 2.5);
                            mapCtx.globalAlpha = 1.0;
                        }

                        if (Math.random() < 0.3) {
                            sparks.push({
                                x: hit.x,
                                y: hit.y,
                                vx: (Math.random() - 0.5) * 1.5,
                                vy: (Math.random() - 0.5) * 1.5,
                                life: 1.0,
                                color: hit.data.color
                            });
                        }

                        if (hit.data.zone !== currentZone && frameCount % 5 === 0) {
                            currentZone = hit.data.zone;
                            document.getElementById('hud-zone').textContent = currentZone;
                        }
                    } else {
                        activeRays.push({
                            endX: player.x + Math.cos(angle) * 1200,
                            endY: player.y + Math.sin(angle) * 1200
                        });
                    }
                }

                if (target) {
                    let targetAngle = Math.atan2(target.y - player.y, target.x - player.x);
                    let angleDiff = Math.atan2(Math.sin(targetAngle - mouseAngle), Math.cos(targetAngle - mouseAngle));

                    if (Math.abs(angleDiff) < coneSpread / 2) {
                        let directHit = castRay(player.x, player.y, targetAngle, distToTarget);
                        if (!directHit || directHit.dist >= distToTarget - CELL_SIZE) {
                            isTargetIlluminated = true;
                        }
                    }
                }

                if (isTargetIlluminated) {
                    document.getElementById('hud-scan').textContent = "TARGET LOCKED // ILLUMINATED";
                    if (frameCount - lastBeaconFrame > 45) {
                        let distRatio = Math.min(1, distToTarget / 1500);
                        SoundEngine.beaconPing(panValue, distRatio, currentLineIndex);
                        lastBeaconFrame = frameCount;
                    }
                } else if (currentLineIndex < poemNodes.length) {
                    document.getElementById('hud-scan').textContent = "SEEKING SIGNAL...";
                }

                SoundEngine.setScanning(true);
                let objDistRatio = Math.min(1, distToTarget / 1000);
                SoundEngine.update(panValue, closestHitDist, objDistRatio, isTargetIlluminated);

            } else {
                SoundEngine.setScanning(false);
            }
        }

        // --- Render Loop ---
        function render() {
            if (sequenceComplete) {
                ctx.fillStyle = 'rgba(5, 4, 3, 0.05)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = '#050403';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const camX = player.x - canvas.width / 2;
            const camY = player.y - canvas.height / 2;

            if (!sequenceComplete) {
                ctx.drawImage(mapCanvas, -camX, -camY);
            }

            if (!sequenceComplete && currentLineIndex < poemNodes.length) {
                let target = poemNodes[currentLineIndex];
                let hue = 30 + (currentLineIndex * 15);

                ctx.save();
                let pulseTime = frameCount % 150;
                let radius = pulseTime * 6;
                let alpha = Math.max(0, 1 - (pulseTime / 150));

                ctx.beginPath();
                ctx.arc(target.x - camX, target.y - camY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(target.x - camX, target.y - camY, 3 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
                ctx.fill();
                ctx.restore();

                let dx = target.x - player.x;
                let dy = target.y - player.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                let angle = Math.atan2(dy, dx);
                let screenRadius = Math.min(canvas.width, canvas.height) / 2;

                if (dist > screenRadius) {
                    let indX = canvas.width / 2 + Math.cos(angle) * (screenRadius - 40);
                    let indY = canvas.height / 2 + Math.sin(angle) * (screenRadius - 40);

                    ctx.save();
                    ctx.translate(indX, indY);
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.moveTo(16, 0);
                    ctx.lineTo(-8, 10);
                    ctx.lineTo(-3, 0);
                    ctx.lineTo(-8, -10);
                    ctx.closePath();
                    // Brighten chevron when pointing correctly
                    let chevronAlpha = isTargetIlluminated ? 0.9 : (0.3 + Math.sin(frameCount * 0.1) * 0.3);
                    ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${chevronAlpha})`;
                    ctx.fill();
                    ctx.restore();
                }
            }

            ctx.globalCompositeOperation = 'screen';
            for (let i = sparks.length - 1; i >= 0; i--) {
                let s = sparks[i];
                s.x += s.vx;
                s.y += s.vy;
                s.life -= 0.02;
                if (s.life <= 0) {
                    sparks.splice(i, 1);
                    continue;
                }
                ctx.fillStyle = s.color;
                ctx.globalAlpha = s.life;
                ctx.fillRect(s.x - camX, s.y - camY, 2.5, 2.5);
            }
            ctx.globalAlpha = 1.0;

            if (activeRays.length > 0 && !sequenceComplete) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(player.x - camX, player.y - camY);
                let sortedRays = [...activeRays].sort((a, b) => {
                    return Math.atan2(a.endY - player.y, a.endX - player.x) - Math.atan2(b.endY - player.y, b.endX - player.x);
                });
                for (let ray of sortedRays) {
                    ctx.lineTo(ray.endX - camX, ray.endY - camY);
                }
                ctx.closePath();

                ctx.clip();
                ctx.globalAlpha = 1.0;
                ctx.drawImage(floorCanvas, -camX, -camY);

                // Beam visually shifts color and intensifies when hitting the objective
                if (isTargetIlluminated) {
                    ctx.fillStyle = 'rgba(255, 140, 0, 0.12)';
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 204, 0.02)';
                }
                ctx.fill();
                ctx.restore();

                ctx.strokeStyle = isTargetIlluminated ? 'rgba(255, 140, 0, 0.15)' : 'rgba(0, 255, 204, 0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let ray of activeRays) {
                    ctx.moveTo(player.x - camX, player.y - camY);
                    ctx.lineTo(ray.endX - camX, ray.endY - camY);
                }
                ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';

            if (!sequenceComplete) {
                ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
                ctx.beginPath();
                ctx.arc(player.x - camX, player.y - camY, player.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
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
        }

        function gameLoop() {
            if (!isRunning) return;
            frameCount++;
            update();
            render();
            requestAnimationFrame(gameLoop);
        }

        // --- Boot Sequence ---
        document.fonts.ready.then(() => {
            const loader = document.getElementById('font-loader');
            if (loader) loader.style.display = 'none';
            const btn = document.getElementById('boot-btn');
            if (btn) btn.style.display = 'inline-block';
        });

        document.getElementById('boot-btn').addEventListener('click', () => {
            SoundEngine.init();
            TTSEngine.init();
            document.getElementById('boot-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('boot-screen').style.display = 'none';
            }, 300);

            resizeCanvas();
            initWorld();
            isRunning = true;
            requestAnimationFrame(gameLoop);

            setTimeout(() => {
                document.getElementById('controls-hint').style.opacity = '0';
            }, 8000);
        });

