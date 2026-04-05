import { prepareWithSegments as prepare, layoutNextLine } from './src/layout.js';

        // -- A* Pathfinding AI (Bat-Like Meandering) --
        let isAutoPilot = true;
        let currentPath = [];
        let currentPathTarget = null;
        let pathFailCount = 0;
        let stuckTimer = 0;
        let lastStuckX = 0;
        let lastStuckY = 0;
        const AUTOPILOT_SPEED_MULT = 0.35; // Meditative but functional drift
        const EXPLORE_SPEED_MULT = 0.25; // Slower during exploration

        // Breathing cycle — global inhale/exhale rhythm
        let breathPhase = 0; // 0..2π, one full breath ≈ 8 seconds
        const BREATH_PERIOD = 480; // frames for one full cycle at 60fps

        // Bat-like weaving state
        let weavePhase = 0; // sinusoidal offset from path
        let weaveFreq = 0.02 + Math.random() * 0.015; // varies per session
        let weaveAmplitude = 1.2; // cells of lateral drift (gentle)
        let wanderPhase = false; // true = exploring before committing
        let wanderTimer = 0;
        const WANDER_DURATION = 120; // 2 seconds of meandering after collection

        // SLAM-like discovery state
        let targetDiscovered = false; // Has the sonar illuminated the current target?
        let exploreScanAngle = 0; // Rotating sonar sweep angle during exploration
        let exploreTarget: { x: number; y: number } | null = null; // Random frontier point
        
        class MinHeap {
            constructor() { this.heap = []; }
            parent(i) { return Math.floor((i - 1) / 2); }
            leftChild(i) { return 2 * i + 1; }
            rightChild(i) { return 2 * i + 2; }
            swap(i, j) { let temp = this.heap[i]; this.heap[i] = this.heap[j]; this.heap[j] = temp; }
            push(node) {
                this.heap.push(node);
                let current = this.heap.length - 1;
                while (current > 0 && this.heap[this.parent(current)].f > this.heap[current].f) {
                    this.swap(current, this.parent(current));
                    current = this.parent(current);
                }
            }
            pop() {
                if (this.heap.length === 0) return null;
                if (this.heap.length === 1) return this.heap.pop();
                let min = this.heap[0];
                this.heap[0] = this.heap.pop();
                let current = 0;
                while (this.leftChild(current) < this.heap.length) {
                    let minIndex = this.leftChild(current);
                    if (this.rightChild(current) < this.heap.length && this.heap[this.rightChild(current)].f < this.heap[minIndex].f) {
                        minIndex = this.rightChild(current);
                    }
                    if (this.heap[current].f <= this.heap[minIndex].f) break;
                    this.swap(current, minIndex);
                    current = minIndex;
                }
                return min;
            }
        }

        const octileDistance = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)) + (Math.SQRT2 - 1) * Math.min(Math.abs(dx), Math.abs(dy));

        function getPath(sx, sy, gx, gy) {
            if (sx === gx && sy === gy) return [];
            let isPassable = (x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H && !grid[x][y];
            let gScore = new Float32Array(GRID_W * GRID_H);
            gScore.fill(Infinity);
            let parent = new Int32Array(GRID_W * GRID_H);
            parent.fill(-1);
            let openSet = new MinHeap();
            const getIdx = (x, y) => y * GRID_W + x;
            
            let startIdx = getIdx(sx, sy);
            gScore[startIdx] = 0;
            openSet.push({ x: sx, y: sy, f: octileDistance(sx - gx, sy - gy) });
            
            const dx = [0, 1, 0, -1, 1, 1, -1, -1];
            const dy = [-1, 0, 1, 0, -1, 1, 1, -1];
            
            let iterations = 0;
            let bestNode = null;
            let bestH = Infinity;

            while (openSet.heap.length > 0 && iterations < 10000) {
                iterations++;
                let curr = openSet.pop();

                let h = octileDistance(curr.x - gx, curr.y - gy);
                if (h < bestH) { bestH = h; bestNode = curr; }

                if (curr.x === gx && curr.y === gy) {
                    bestNode = curr;
                    break;
                }
                let currIdx = getIdx(curr.x, curr.y);
                for (let i = 0; i < 8; i++) {
                    let nx = curr.x + dx[i];
                    let ny = curr.y + dy[i];
                    if (!isPassable(nx, ny)) continue;
                    let cost = (i < 4) ? 1 : Math.SQRT2;
                    let wallPenalty = 0;
                    for (let wx = -1; wx <= 1; wx++) {
                        for (let wy = -1; wy <= 1; wy++) {
                            let cx = nx + wx; let cy = ny + wy;
                            if (cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H && grid[cx][cy]) {
                                wallPenalty += 8;
                            }
                        }
                    }
                    let tentativeG = gScore[currIdx] + cost + wallPenalty;
                    let nIdx = getIdx(nx, ny);
                    if (tentativeG < gScore[nIdx]) {
                        parent[nIdx] = currIdx;
                        gScore[nIdx] = tentativeG;
                        openSet.push({ x: nx, y: ny, f: tentativeG + octileDistance(nx - gx, ny - gy) });
                    }
                }
            }
            if (!bestNode) return [];
            let path = [];
            let cIdx = getIdx(bestNode.x, bestNode.y);
            while (cIdx !== startIdx && cIdx !== -1) {
                let px = cIdx % GRID_W;
                let py = Math.floor(cIdx / GRID_W);
                path.push({ x: px, y: py });
                cIdx = parent[cIdx];
            }
            path.reverse();
            return path;
        }
        // --- Engine Constants & Setup ---
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        const CHARSET = "01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ01XYZ";

        const tryVibrate = (ms) => {
            try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
        };

        // Text-to-Speech Choral Harmonizer Engine
        const SpeechEngine = {
            synth: window.speechSynthesis,
            activeUtterances: [] as SpeechSynthesisUtterance[],
            activeDrones: [] as { osc: OscillatorNode, gain: GainNode }[],

            speak(text) {
                if (!this.synth) return;
                this.synth.cancel();
            },

            // Layered choral harmonization — like a round/canon
            speakChoral(text, lineIndex = 0) {
                if (!this.synth) return;
                this.synth.cancel();
                this.activeUtterances = [];

                let voices = this.synth.getVoices();
                // Try to find distinct voices for the choir
                let voicePool = voices.filter(v =>
                    v.lang.startsWith('en') && !v.name.includes('Compact')
                );
                if (voicePool.length === 0) voicePool = voices.slice(0, 4);

                // Choral layers: each a different musical register
                // Rate/pitch combos create harmonic intervals (root, third, fifth, octave)
                const choralLayers = [
                    { rate: 0.45, pitch: 0.70, volume: 0.90, delay: 0,    droneHz: 110 },   // Bass: root — very slow
                    { rate: 0.40, pitch: 0.50, volume: 0.30, delay: 3000, droneHz: 138.59 }, // Baritone: major third
                    { rate: 0.50, pitch: 1.00, volume: 0.22, delay: 6500, droneHz: 164.81 }, // Tenor: fifth
                    { rate: 0.38, pitch: 1.30, volume: 0.14, delay: 10000, droneHz: 220 },   // Soprano: octave — whisper
                ];

                // Shift harmony based on which line in the poem
                const harmonyShift = 1 + (lineIndex % 5) * 0.05;

                choralLayers.forEach((layer, i) => {
                    setTimeout(() => {
                        const u = new SpeechSynthesisUtterance(text);
                        // Rotate through available voices
                        if (voicePool.length > 0) {
                            u.voice = voicePool[i % voicePool.length];
                        }
                        u.rate = layer.rate;
                        u.pitch = Math.min(2, layer.pitch * harmonyShift);
                        u.volume = layer.volume;
                        this.synth.speak(u);
                        this.activeUtterances.push(u);

                        // Sympathetic drone underneath each voice
                        if (SoundEngine.ctx) {
                            this._startSympathyDrone(layer.droneHz * harmonyShift, layer.volume * 0.4, 6 + i * 1.5);
                        }
                    }, layer.delay);
                });
            },

            _startSympathyDrone(freq: number, vol: number, duration: number) {
                if (!SoundEngine.ctx) return;
                const ctx = SoundEngine.ctx;
                const now = ctx.currentTime;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                // Slow vibrato — the drone breathes
                const lfo = ctx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.value = 0.15 + Math.random() * 0.1;
                const lfoGain = ctx.createGain();
                lfoGain.gain.value = freq * 0.008; // subtle pitch wobble
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(now);

                // Slow swell and decay — not percussive
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(vol, now + duration * 0.3);
                gain.gain.setValueAtTime(vol, now + duration * 0.5);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

                if ((panner as StereoPannerNode).pan) {
                    (panner as StereoPannerNode).pan.value = (Math.random() - 0.5) * 0.7;
                }

                osc.connect(gain);
                gain.connect(panner);
                (panner as AudioNode).connect(SoundEngine.masterGain);
                if (SoundEngine.reverb) {
                    (panner as AudioNode).connect(SoundEngine.reverb);
                }

                osc.start(now);
                osc.stop(now + duration + 0.1);
                lfo.stop(now + duration + 0.1);

                this.activeDrones.push({ osc, gain });
            }
        };

        // Callback for sync between audio pings and visual rings
        window.onSonarPing = null;

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

                    if (this.ctx.state === 'suspended') this.ctx.resume();

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

            bootSound() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 1.5);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.6, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, now);
                filter.frequency.exponentialRampToValueAtTime(80, now + 1.5);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);
                gain.connect(this.reverb);

                osc.start(now);
                osc.stop(now + 2.5);
            },

            startAmbientDrone() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const root = 110; // Deep A2
                const intervals = [1, 1.5, 2.0, 2.25]; // Root, Fifth, Octave, Major 9th

                intervals.forEach((interval, i) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.value = root * interval;

                    // Slow LFO for frequency (chorus effect)
                    const lfo = this.ctx.createOscillator();
                    lfo.type = 'sine';
                    lfo.frequency.value = 0.05 + (i * 0.02);
                    const lfoGain = this.ctx.createGain();
                    lfoGain.gain.value = 1.5;
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);
                    lfo.start();

                    // Slow LFO for volume pulsing
                    gain.gain.value = 0;
                    gain.gain.linearRampToValueAtTime(0.06 / intervals.length, now + 5 + i * 3); // Fade in over several seconds

                    if (panner.pan) panner.pan.value = (Math.random() - 0.5) * 0.6;

                    osc.connect(gain);
                    gain.connect(panner);
                    panner.connect(this.reverb); // Bathe the drone in the cavern reverb

                    osc.start(now);
                });
            },

            ping(panValue = 0) {
                if (!this.ctx || this.isComplete) return;
                const now = this.ctx.currentTime;

                if (now - this.lastPingTime < 0.08) return;
                this.lastPingTime = now;

                // Visual Sync Callback
                if (window.onSonarPing) window.onSonarPing();

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
                if (panner.pan) panner.pan.value = panValue;

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

            step() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(60, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.1);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now);
                osc.stop(now + 0.15);
            },

            collect() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                // Lush, ethereal Lydian chord sequence
                const chord = [440, 554.37, 659.25, 830.61, 987.77];

                chord.forEach((freq, index) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();

                    if (panner.pan) panner.pan.value = (Math.random() - 0.5) * 0.6;

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);

                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.2 / chord.length, now + 0.2 + (index * 0.1)); // Slower, softer attack
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5); // Longer tail

                    osc.connect(gain);
                    gain.connect(panner);
                    panner.connect(this.masterGain);
                    panner.connect(this.reverb);

                    osc.start(now);
                    osc.stop(now + 3.6);
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

        // World Grid
        const GRID_W = 400;
        const GRID_H = 400;
        const CELL_SIZE = 12;
        const WORLD_W = GRID_W * CELL_SIZE;
        const WORLD_H = GRID_H * CELL_SIZE;

        let grid = new Array(GRID_W).fill(0).map(() => new Array(GRID_H).fill(null));

        // Persistent World Accumulator (All Physics is Text)
        const mapCanvas = document.createElement('canvas');
        mapCanvas.width = WORLD_W;
        mapCanvas.height = WORLD_H;
        const mapCtx = mapCanvas.getContext('2d', { alpha: false });
        mapCtx.fillStyle = '#050403';
        mapCtx.fillRect(0, 0, WORLD_W, WORLD_H);

        // High-Resolution Floor Text Canvas
        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = WORLD_W;
        floorCanvas.height = WORLD_H;
        const floorCtx = floorCanvas.getContext('2d');

        // State Variables
        let isRunning = false;
        let frameCount = 0;
        let currentZone = '';
        let lastBumpTime = 0;
        let lastBeaconFrame = 0;
        let sequenceComplete = false;
        let isTargetIlluminated = false;

        // Collection dwell gate
        let collectState = 'seeking'; // 'seeking' | 'reading' | 'cooldown'
        let dwellProgress = 0; // 0..1, fills over 2 seconds (120 frames)
        let cooldownTimer = 0; // frames remaining in cooldown
        const DWELL_FRAMES = 240; // 4 seconds at 60fps — meditative hold
        const COOLDOWN_FRAMES = 420; // 7 seconds — breathing pause between fragments
        const COLLECT_RANGE = 150; // tightened from 200

        // Speech sequencing
        let isSpeaking = false;

        // Onboarding state
        let onboardingPhase = 0; // 0=explore, 1=guided, 2+=normal
        let onboardingTimer = 0;
        let collectNotification = ''; // center-screen notification text
        let collectNotifyTimer = 0;

        const player = {
            x: WORLD_W / 2,
            y: WORLD_H / 2,
            vx: 0, vy: 0,
            speed: 6.0,
            radius: 4,
            distanceTraveled: 0
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
        let playerRings = []; // The expanding sonar ripples
        let targetVisibilityPolygon = []; // Target's constrained cavern boundaries
        let radarAngle = 0;

        // Poem State
        let poemNodes = [];
        let currentLineIndex = 0;
        const poemUI = document.getElementById('collected-poem');
        const progressTextUI = document.getElementById('progress-text');
        const progressDotsUI = document.getElementById('progress-dots');

        (window as any).onSonarPing = () => {
            playerRings.push({ radius: 0, speed: 12, life: 1.0 });
        };

        function updateFloorCanvas() {
            floorCtx.clearRect(0, 0, WORLD_W, WORLD_H);
            floorCtx.font = 'italic 600 36px "Cormorant Garamond", serif';
            floorCtx.shadowColor = 'rgba(255, 140, 0, 0.8)';
            floorCtx.shadowBlur = 15;
            floorCtx.textAlign = 'center';
            floorCtx.textBaseline = 'middle';

            // Only show the CURRENT target's floor text — sequential mystery
            if (currentLineIndex < poemNodes.length) {
                let node = poemNodes[currentLineIndex];
                // Pulse brightness during reading state
                let alpha = collectState === 'reading' ? 0.7 + Math.sin(frameCount * 0.15) * 0.3 : 1.0;
                floorCtx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
                let prepared = prepare(node.text, 'italic 600 36px "Cormorant Garamond", serif');
                let yOffset = node.y;
                let textWidthLimit = 350;
                
                let cursor = { segmentIndex: 0, graphemeIndex: 0 };
                let line;
                while ((line = layoutNextLine(prepared, cursor, textWidthLimit)) !== null) {
                    floorCtx.fillText(line.text, node.x, yOffset);
                    yOffset += 45; // custom line height
                    cursor = line.end;
                }
            }
        }

        function calcTargetVisibility() {
            targetVisibilityPolygon = [];
            if (currentLineIndex >= poemNodes.length) return;
            let target = poemNodes[currentLineIndex];
            for (let a = 0; a < Math.PI * 2; a += 0.05) {
                let hit = castRay(target.x, target.y, a, 800);
                if (hit) {
                    targetVisibilityPolygon.push({ x: hit.x, y: hit.y });
                } else {
                    targetVisibilityPolygon.push({ x: target.x + Math.cos(a) * 800, y: target.y + Math.sin(a) * 800 });
                }
            }
        }

        // --- World Generation ---
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
                    let dist = 900 + Math.random() * 500;
                    let nx = currentX + Math.cos(angle) * dist;
                    let ny = currentY + Math.sin(angle) * dist;

                    if (nx > 400 && nx < WORLD_W - 400 && ny > 400 && ny < WORLD_H - 400) {
                        let tooClose = false;
                        for (let node of poemNodes) {
                            if (Math.hypot(nx - node.x, ny - node.y) < 800) {
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
                grid[i][0] = grid[i][GRID_H - 1] = { zone: 'BOUNDARY', color: '#ff0000', text: 'ARCHIVAL LIMIT.' };
                grid[0][i] = grid[GRID_W - 1][i] = { zone: 'BOUNDARY', color: '#ff0000', text: 'ARCHIVAL LIMIT.' };
            }

            const isNearNode = (gx, gy) => {
                let px = gx * CELL_SIZE;
                let py = gy * CELL_SIZE;
                for (let node of poemNodes) {
                    let dx = Math.abs(px - node.x);
                    let dy = Math.abs(py - node.y);
                    if (dx < 600 && dy < 300) return true;
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
                                    grid[wx][wy] = { zone: 'CORRUPTED_BLOCK', color: '#00ffcc', text: 'Corrupted geometric data.' };
                                }
                            }
                        }
                    }
                }
            }

            calcTargetVisibility();
        }

        // --- Input Handling ---
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
            if (e.target.tagName === 'BUTTON') return;
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
            if (e.target.tagName === 'BUTTON') return;
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
            if (e.target.tagName === 'BUTTON') return;
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

            // Global breathing rhythm — modulates all movement
            breathPhase += (Math.PI * 2) / BREATH_PERIOD;
            if (breathPhase > Math.PI * 2) breathPhase -= Math.PI * 2;
            // breathDepth: 0.4 at exhale trough, 1.0 at inhale peak
            const breathDepth = 0.85 + 0.15 * Math.sin(breathPhase); // tighter band: 0.7–1.0

            // Onboarding timer
            onboardingTimer++;
            if (onboardingPhase === 0 && onboardingTimer > 300) { // 5 seconds
                onboardingPhase = 1; // start showing edge pointer
            }

            // Cooldown tick
            if (collectState === 'cooldown') {
                cooldownTimer--;
                if (cooldownTimer <= 0) {
                    collectState = 'seeking';
                    updateFloorCanvas();
                }
            }

            // Notification fade
            if (collectNotifyTimer > 0) collectNotifyTimer--;

            if (keys.w) vy -= player.speed;
            if (keys.s) vy += player.speed;
            if (keys.a) vx -= player.speed;
            if (keys.d) vx += player.speed;

            if (joystickActive) {
                let dx = joystickCurrent.x - joystickOrigin.x;
                let dy = joystickCurrent.y - joystickOrigin.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                // Dead zone: ignore small accidental touches
                if (dist > 15) {
                    let maxDist = 80;
                    let strength = Math.min(dist - 15, maxDist) / maxDist;
                    vx += (dx / dist) * (player.speed * strength);
                    vy += (dy / dist) * (player.speed * strength);
                }
            }

            if (keys.w || keys.s || keys.a || keys.d || joystickActive) {
                if (isAutoPilot) isAutoPilot = false;
            }

            if (isAutoPilot && !sequenceComplete && currentLineIndex < poemNodes.length) {
                let target = poemNodes[currentLineIndex];

                // === DIAGNOSTIC LOGGING ===
                if (frameCount % 120 === 0) {
                    let d = Math.hypot(target.x - player.x, target.y - player.y);
                    console.log(`[BAT] L:${currentLineIndex} state=${collectState} disc=${targetDiscovered} pathLen=${currentPath?.length} distTgt=${d.toFixed(0)} pos=(${player.x.toFixed(0)},${player.y.toFixed(0)})`);
                }

                // --- WANDER PHASE: brief drift after collection ---
                if (wanderPhase) {
                    wanderTimer--;
                    if (wanderTimer <= 0) {
                        wanderPhase = false;
                        exploreTarget = null;
                        currentPath = [];
                        currentPathTarget = null;
                        targetDiscovered = false; // Reset: must rediscover next fragment
                    } else {
                        // Pick random nearby point to meander toward
                        if (!exploreTarget || currentPath.length === 0) {
                            let sx = Math.floor(player.x / CELL_SIZE);
                            let sy = Math.floor(player.y / CELL_SIZE);
                            for (let attempt = 0; attempt < 15; attempt++) {
                                let angle = Math.random() * Math.PI * 2;
                                let dist = 8 + Math.random() * 15;
                                let rx = Math.floor(sx + Math.cos(angle) * dist);
                                let ry = Math.floor(sy + Math.sin(angle) * dist);
                                rx = Math.max(1, Math.min(GRID_W - 2, rx));
                                ry = Math.max(1, Math.min(GRID_H - 2, ry));
                                if (!grid[rx]?.[ry]) {
                                    let newPath = getPath(sx, sy, rx, ry);
                                    if (newPath.length > 0) {
                                        currentPath = newPath;
                                        exploreTarget = { x: rx, y: ry };
                                        break;
                                    }
                                }
                            }
                        }
                        // Follow wander path at a dreamy pace
                        if (currentPath && currentPath.length > 0) {
                            let nextNode = currentPath[0];
                            let targetX = nextNode.x * CELL_SIZE + CELL_SIZE / 2;
                            let targetY = nextNode.y * CELL_SIZE + CELL_SIZE / 2;
                            let dx = targetX - player.x;
                            let dy = targetY - player.y;
                            let dist = Math.hypot(dx, dy);
                            if (dist < CELL_SIZE) currentPath.shift();
                            if (currentPath.length > 0) {
                                let lookAhead = currentPath[0];
                                let aDx = lookAhead.x * CELL_SIZE + CELL_SIZE / 2 - player.x;
                                let aDy = lookAhead.y * CELL_SIZE + CELL_SIZE / 2 - player.y;
                                let driveAngle = Math.atan2(aDy, aDx);
                                let wanderSpeed = player.speed * 0.35 * breathDepth;
                                vx = Math.cos(driveAngle) * wanderSpeed;
                                vy = Math.sin(driveAngle) * wanderSpeed;
                            }
                        }
                    }
                }

                // === EXPLORATION vs NAVIGATION ===
                if (collectState !== 'reading' && !wanderPhase) {

                    if (!targetDiscovered) {
                        // ============ EXPLORATION MODE ============
                        // Bat doesn't know where the fragment is yet.
                        // Move toward random frontier points, sweeping sonar.

                        if (!exploreTarget || currentPath.length === 0) {
                            let sx = Math.floor(player.x / CELL_SIZE);
                            let sy = Math.floor(player.y / CELL_SIZE);
                            // Pick a distant random point to explore toward
                            for (let attempt = 0; attempt < 20; attempt++) {
                                let angle = Math.random() * Math.PI * 2;
                                let dist = 15 + Math.random() * 30;
                                let rx = Math.floor(sx + Math.cos(angle) * dist);
                                let ry = Math.floor(sy + Math.sin(angle) * dist);
                                rx = Math.max(2, Math.min(GRID_W - 3, rx));
                                ry = Math.max(2, Math.min(GRID_H - 3, ry));
                                if (!grid[rx]?.[ry]) {
                                    let newPath = getPath(sx, sy, rx, ry);
                                    if (newPath.length > 0) {
                                        currentPath = newPath;
                                        exploreTarget = { x: rx, y: ry };
                                        currentPathTarget = null;
                                        pathFailCount = 0;
                                        break;
                                    }
                                }
                            }
                        }

                        // Stuck detection during exploration
                        stuckTimer++;
                        if (stuckTimer >= 60) {
                            let moved = Math.hypot(player.x - lastStuckX, player.y - lastStuckY);
                            if (moved < CELL_SIZE * 3) {
                                exploreTarget = null;
                                currentPath = [];
                            }
                            lastStuckX = player.x;
                            lastStuckY = player.y;
                            stuckTimer = 0;
                        }

                        // Follow exploration path
                        if (currentPath && currentPath.length > 0) {
                            let nextNode = currentPath[0];
                            let targetX = nextNode.x * CELL_SIZE + CELL_SIZE / 2;
                            let targetY = nextNode.y * CELL_SIZE + CELL_SIZE / 2;
                            let dx = targetX - player.x;
                            let dy = targetY - player.y;
                            let dist = Math.hypot(dx, dy);
                            if (dist < CELL_SIZE) currentPath.shift();

                            if (currentPath.length > 0) {
                                let lookAhead = currentPath[0];
                                let aDx = lookAhead.x * CELL_SIZE + CELL_SIZE / 2 - player.x;
                                let aDy = lookAhead.y * CELL_SIZE + CELL_SIZE / 2 - player.y;
                                let driveAngle = Math.atan2(aDy, aDx);

                                // Gentle weaving during exploration
                                weavePhase += weaveFreq;
                                let lateralOffset = Math.sin(weavePhase) * weaveAmplitude * CELL_SIZE;
                                let perpAngle = driveAngle + Math.PI / 2;
                                let weaveX = Math.cos(perpAngle) * lateralOffset * 0.015;
                                let weaveY = Math.sin(perpAngle) * lateralOffset * 0.015;

                                let speed = player.speed * EXPLORE_SPEED_MULT * breathDepth;
                                vx = Math.cos(driveAngle) * speed + weaveX;
                                vy = Math.sin(driveAngle) * speed + weaveY;
                            }
                        }

                    } else {
                        // ============ NAVIGATION MODE ============
                        // Fragment discovered! A* toward it.

                        if (!currentPath || currentPath.length === 0 || (currentPathTarget !== target && currentPathTarget !== 'escape')) {
                            let sx = Math.floor(player.x / CELL_SIZE);
                            let sy = Math.floor(player.y / CELL_SIZE);
                            let gx = Math.floor(target.x / CELL_SIZE);
                            let gy = Math.floor(target.y / CELL_SIZE);
                            let newPath = getPath(sx, sy, gx, gy);
                            if (newPath.length === 0) {
                                pathFailCount++;
                                if (pathFailCount >= 3) {
                                    // Can't reach target, try random escapes
                                    for (let attempt = 0; attempt < 20; attempt++) {
                                        let rx = sx + Math.floor(Math.random() * 40 - 20);
                                        let ry = sy + Math.floor(Math.random() * 40 - 20);
                                        if (rx >= 0 && rx < GRID_W && ry >= 0 && ry < GRID_H && !grid[rx]?.[ry]) {
                                            currentPath = getPath(sx, sy, rx, ry);
                                            if (currentPath.length > 0) {
                                                currentPathTarget = 'escape';
                                                pathFailCount = 0;
                                                break;
                                            }
                                        }
                                    }
                                }
                            } else {
                                currentPath = newPath;
                                currentPathTarget = target;
                                pathFailCount = 0;
                            }
                        }

                        // Stuck detection during navigation
                        stuckTimer++;
                        if (stuckTimer >= 60) {
                            let moved = Math.hypot(player.x - lastStuckX, player.y - lastStuckY);
                            if (moved < CELL_SIZE * 3) {
                                let sx = Math.floor(player.x / CELL_SIZE);
                                let sy = Math.floor(player.y / CELL_SIZE);
                                let escaped = false;
                                for (let attempt = 0; attempt < 30; attempt++) {
                                    let angle = Math.random() * Math.PI * 2;
                                    let dist = 10 + Math.floor(Math.random() * 25);
                                    let rx = sx + Math.floor(Math.cos(angle) * dist);
                                    let ry = sy + Math.floor(Math.sin(angle) * dist);
                                    rx = Math.max(2, Math.min(GRID_W - 3, rx));
                                    ry = Math.max(2, Math.min(GRID_H - 3, ry));
                                    if (!grid[rx]?.[ry]) {
                                        let newPath = getPath(sx, sy, rx, ry);
                                        if (newPath.length > 0) {
                                            currentPath = newPath;
                                            currentPathTarget = 'escape';
                                            pathFailCount = 0;
                                            escaped = true;
                                            break;
                                        }
                                    }
                                }
                                // Last resort: direct teleport
                                if (!escaped) {
                                    for (let r = 1; r < 10; r++) {
                                        for (let a = 0; a < 8; a++) {
                                            let nx = sx + Math.round(Math.cos(a * Math.PI/4) * r);
                                            let ny = sy + Math.round(Math.sin(a * Math.PI/4) * r);
                                            if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !grid[nx]?.[ny]) {
                                                player.x = nx * CELL_SIZE + CELL_SIZE/2;
                                                player.y = ny * CELL_SIZE + CELL_SIZE/2;
                                                currentPath = [];
                                                currentPathTarget = null;
                                                break;
                                            }
                                        }
                                        if (!grid[Math.floor(player.x / CELL_SIZE)]?.[Math.floor(player.y / CELL_SIZE)]) break;
                                    }
                                }
                            }
                            lastStuckX = player.x;
                            lastStuckY = player.y;
                            stuckTimer = 0;
                        }

                        // Follow navigation path
                        if (currentPath && currentPath.length > 0) {
                            let nextNode = currentPath[0];
                            let targetX = nextNode.x * CELL_SIZE + CELL_SIZE / 2;
                            let targetY = nextNode.y * CELL_SIZE + CELL_SIZE / 2;
                            let dx = targetX - player.x;
                            let dy = targetY - player.y;
                            let dist = Math.hypot(dx, dy);
                            if (dist < CELL_SIZE) currentPath.shift();

                            if (currentPath.length > 0) {
                                let lookAhead = currentPath[0];
                                let aDx = lookAhead.x * CELL_SIZE + CELL_SIZE / 2 - player.x;
                                let aDy = lookAhead.y * CELL_SIZE + CELL_SIZE / 2 - player.y;
                                let driveAngle = Math.atan2(aDy, aDx);

                                weavePhase += weaveFreq;
                                let lateralOffset = Math.sin(weavePhase) * weaveAmplitude * CELL_SIZE;
                                let perpAngle = driveAngle + Math.PI / 2;
                                let weaveX = Math.cos(perpAngle) * lateralOffset * 0.02;
                                let weaveY = Math.sin(perpAngle) * lateralOffset * 0.02;

                                let speed = player.speed * AUTOPILOT_SPEED_MULT * breathDepth;
                                vx = Math.cos(driveAngle) * speed + weaveX;
                                vy = Math.sin(driveAngle) * speed + weaveY;
                            }
                        }
                    }
                }
                
                // === AUTO-AIM: depends on discovery state ===
                if (!targetDiscovered) {
                    // EXPLORATION: slow 360° sonar sweep to scan the environment
                    exploreScanAngle += 0.012; // ~30 seconds for full revolution
                    if (exploreScanAngle > Math.PI * 2) exploreScanAngle -= Math.PI * 2;
                    // Add movement-direction bias so scan tends forward
                    let moveAngle = Math.atan2(vy, vx);
                    let scanBias = moveAngle + exploreScanAngle;
                    mouse.x = (canvas as any).width / 2 + Math.cos(scanBias) * 200;
                    mouse.y = (canvas as any).height / 2 + Math.sin(scanBias) * 200;
                } else {
                    // NAVIGATION: aim toward discovered target
                    let aimAngle = Math.atan2(target.y - player.y, target.x - player.x);
                    let aimOsc = Math.sin(frameCount * 0.02) * 0.3;
                    mouse.x = (canvas as any).width / 2 + Math.cos(aimAngle + aimOsc) * 200;
                    mouse.y = (canvas as any).height / 2 + Math.sin(aimAngle + aimOsc) * 200;
                }
                mouse.isDown = true;
                
            } else if (!sequenceComplete && currentLineIndex < poemNodes.length) {
                let target = poemNodes[currentLineIndex];
                let dx = target.x - player.x;
                let dy = target.y - player.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 500 && collectState !== 'reading') {
                    let pull = Math.pow((500 - dist) / 500, 2) * 1.2;
                    vx += (dx / dist) * pull;
                    vy += (dy / dist) * pull;
                }
            }

            if (vx !== 0 && vy !== 0 && !joystickActive && !isAutoPilot) {
                const len = Math.sqrt(vx * vx + vy * vy);
                vx = (vx / len) * player.speed;
                vy = (vy / len) * player.speed;
            }

            if ((vx !== 0 || vy !== 0) && !sequenceComplete) {
                player.distanceTraveled += Math.sqrt(vx * vx + vy * vy);
                if (player.distanceTraveled > 45) {
                    SoundEngine.step();
                    player.distanceTraveled = 0;
                }
            }

            const nextX = player.x + vx;
            const nextY = player.y + vy;
            let collided = false;

            const gridX = Math.floor(nextX / CELL_SIZE);
            const gridY = Math.floor(player.y / CELL_SIZE);
            if (gridX >= 0 && gridX < GRID_W && !grid[gridX]?.[gridY]) {
                player.x = nextX;
            } else if (vx !== 0) { collided = true; }

            const gridX2 = Math.floor(player.x / CELL_SIZE);
            const gridY2 = Math.floor(nextY / CELL_SIZE);
            if (gridY2 >= 0 && gridY2 < GRID_H && !grid[gridX2]?.[gridY2]) {
                player.y = nextY;
            } else if (vy !== 0) { collided = true; }

            if (collided && !sequenceComplete) {
                let now = performance.now();
                if (now - lastBumpTime > 200) {
                    tryVibrate(8);
                    SoundEngine.bump();
                    lastBumpTime = now;
                }
            }

            if (frameCount % 10 === 0 && !sequenceComplete) {
                const hudPos = document.getElementById('hud-pos');
                if (hudPos) hudPos.textContent = `${Math.floor(player.x)}, ${Math.floor(player.y)}`;
            }

            // Update Expanding Player Rings
            for (let i = playerRings.length - 1; i >= 0; i--) {
                let r = playerRings[i];
                r.radius += r.speed;
                r.life -= 0.015;
                if (r.life <= 0) playerRings.splice(i, 1);
            }

            activeRays = [];
            const camX = player.x - (canvas as any).width / 2;
            const camY = player.y - (canvas as any).height / 2;
            const mouseAngle = Math.atan2(mouse.y - (player.y - camY), mouse.x - (player.x - camX));

            let closestHitDist = 1200;
            let distToTarget = 1200;
            let panValue = 0;
            let target = null;
            isTargetIlluminated = false;

            if (!sequenceComplete && currentLineIndex < poemNodes.length) {
                target = poemNodes[currentLineIndex];
                distToTarget = Math.sqrt((player.x - target.x) ** 2 + (player.y - target.y) ** 2);

                // --- COLLECTION DWELL GATE ---
                if (collectState === 'seeking' && distToTarget < COLLECT_RANGE && mouse.isDown && !isSpeaking) {
                    collectState = 'reading';
                    dwellProgress = 0;
                    // Show HUD prompt
                    const hudScan = document.getElementById('hud-scan');
                    if (hudScan) hudScan.textContent = 'HOLD TO DECRYPT...';
                }

                if (collectState === 'reading') {
                    if (distToTarget >= COLLECT_RANGE + 50 || !mouse.isDown) {
                        // Player moved away or released — reset
                        collectState = 'seeking';
                        dwellProgress = 0;
                    } else {
                        dwellProgress += 1 / DWELL_FRAMES;
                        // Pulse floor text during reading
                        if (frameCount % 4 === 0) updateFloorCanvas();

                        if (dwellProgress >= 1.0) {
                            // === COLLECT THE FRAGMENT ===
                            SoundEngine.collect();
                            // Choral harmonized speech — layered at musical intervals
                            isSpeaking = true;
                            SpeechEngine.speakChoral(target.text, currentLineIndex);
                            // The last choral layer ends ~10s out; track completion
                            let choralTimeout = 10000 + 15000; // last layer delay + generous speaking duration
                            setTimeout(() => { isSpeaking = false; }, choralTimeout);

                            tryVibrate([30, 50, 30, 50, 30]);

                            const newLine = document.createElement('div');
                            newLine.className = 'poem-line';
                            newLine.textContent = target.text;
                            if (poemUI) poemUI.appendChild(newLine);

                            const dots = document.querySelectorAll('.progress-dot');
                            if (dots[currentLineIndex]) (dots[currentLineIndex] as HTMLElement).classList.add('active');
                            if (progressTextUI) progressTextUI.textContent = `FRAGMENTS ${currentLineIndex + 1} / ${poemNodes.length}`;

                            // Permanently burn the collected fragment into the world map
                            mapCtx!.save();
                            let grad = mapCtx!.createRadialGradient(target.x, target.y, 0, target.x, target.y, 500);
                            grad.addColorStop(0, 'rgba(255, 140, 0, 0.15)');
                            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                            mapCtx!.fillStyle = grad;
                            mapCtx!.fillRect(target.x - 500, target.y - 500, 1000, 1000);

                            mapCtx!.font = 'italic 600 36px "Cormorant Garamond", serif';
                            mapCtx!.fillStyle = 'rgba(255, 140, 0, 0.5)';
                            mapCtx!.shadowColor = 'rgba(255, 140, 0, 0.8)';
                            mapCtx!.shadowBlur = 15;
                            mapCtx!.textAlign = 'center';
                            mapCtx!.textBaseline = 'middle';
                            mapCtx!.fillText(target.text, target.x, target.y);
                            mapCtx!.restore();

                            // Intense collection spark explosion
                            for (let s = 0; s < 40; s++) {
                                sparks.push({
                                    x: target.x, y: target.y,
                                    vx: (Math.random() - 0.5) * 15,
                                    vy: (Math.random() - 0.5) * 15,
                                    life: 1.8, color: 'rgba(255, 140, 0, 1)',
                                    char: CHARSET[Math.floor(Math.random() * CHARSET.length)]
                                });
                            }

                            // Onboarding notification
                            let remaining = poemNodes.length - currentLineIndex - 1;
                            if (remaining > 0) {
                                collectNotification = `FRAGMENT RECOVERED — ${remaining} REMAIN`;
                            } else {
                                collectNotification = 'FINAL FRAGMENT RECOVERED';
                            }
                            collectNotifyTimer = 180; // 3 seconds
                            if (onboardingPhase < 2) onboardingPhase = 2;

                            currentLineIndex++;
                            // Enter cooldown — breathing moment
                            collectState = 'cooldown';
                            cooldownTimer = COOLDOWN_FRAMES;
                            dwellProgress = 0;

                            updateFloorCanvas();
                            calcTargetVisibility();

                            // Enter wander phase — bat explores before committing to next
                            if (isAutoPilot && currentLineIndex < poemNodes.length) {
                                wanderPhase = true;
                                wanderTimer = WANDER_DURATION;
                                exploreTarget = null;
                            }
                            currentPath = [];
                            currentPathTarget = null;

                            if (currentLineIndex >= poemNodes.length) {
                                sequenceComplete = true;
                                const hudScan = document.getElementById('hud-scan');
                                if (hudScan) hudScan.textContent = 'SEQUENCE COMPLETE.';
                                const hudZone = document.getElementById('hud-zone');
                                if (hudZone) hudZone.textContent = 'TRANSCENDENCE';

                                document.querySelectorAll('.hud, #progress-ui, .controls-hint').forEach(el => (el as HTMLElement).style.opacity = '0');

                                if (poemUI) poemUI.classList.add('complete');
                                SoundEngine.finale();
                            }
                        }
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
                        // Render All Physics as Text (Accumulate on map)
                        mapCtx.globalAlpha = Math.random() * 0.4 + 0.1;
                        mapCtx.fillStyle = 'rgba(0, 100, 150, 0.4)';
                        mapCtx.font = "8px monospace";
                        const char = CHARSET[Math.floor(Math.random() * CHARSET.length)];
                        mapCtx.fillText(char, hit.x + (Math.random() - 0.5) * 10, hit.y + (Math.random() - 0.5) * 10);
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
                        activeRays.push({ endX: hit.x, endY: hit.y, dist: hit.dist });
                        closestHitDist = Math.min(closestHitDist, hit.dist);

                        // Physics as Text logic
                        if (Math.random() < 0.8) {
                            mapCtx.globalAlpha = Math.random() * 0.6 + 0.2;
                            mapCtx.fillStyle = hit.data.color;
                            mapCtx.font = "bold 10px monospace";
                            const char = CHARSET[Math.floor(Math.random() * CHARSET.length)];
                            mapCtx.fillText(char, hit.x + (Math.random() - 0.5) * 10, hit.y + (Math.random() - 0.5) * 10);
                            mapCtx.globalAlpha = 1.0;
                        }

                        // Wall Collisions for expanding player rings (Spawns shattering text sparks)
                        for (let r of playerRings) {
                            if (Math.abs(hit.dist - r.radius) < 15 && Math.random() < 0.1) {
                                sparks.push({
                                    x: hit.x, y: hit.y,
                                    vx: (Math.random() - 0.5) * 3,
                                    vy: (Math.random() - 0.5) * 3,
                                    life: 1.0, color: 'rgba(0, 255, 204, 0.8)',
                                    char: CHARSET[Math.floor(Math.random() * CHARSET.length)]
                                });
                            }
                        }

                        if (hit.data.zone !== currentZone && frameCount % 5 === 0) {
                            currentZone = hit.data.zone;
                            document.getElementById('hud-zone').textContent = currentZone;
                        }
                    } else {
                        activeRays.push({
                            endX: player.x + Math.cos(angle) * 1200,
                            endY: player.y + Math.sin(angle) * 1200,
                            dist: 1200
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
                            // SLAM: mark target as discovered on first sonar hit
                            if (!targetDiscovered) {
                                targetDiscovered = true;
                                // Clear exploration path, switch to A* navigation
                                exploreTarget = null;
                                currentPath = [];
                                currentPathTarget = null;
                            }
                        }
                    }
                }

                if (isTargetIlluminated) {
                    const hudScan = document.getElementById('hud-scan');
                    if (collectState === 'reading') {
                        if (hudScan) hudScan.textContent = `DECRYPTING... ${Math.floor(dwellProgress * 100)}%`;
                    } else if (collectState === 'cooldown') {
                        if (hudScan) hudScan.textContent = 'FRAGMENT ABSORBED';
                    } else {
                        if (hudScan) hudScan.textContent = distToTarget < COLLECT_RANGE ? 'HOLD TO DECRYPT' : 'DATA CLUSTER ILLUMINATED';
                    }
                    if (frameCount - lastBeaconFrame > 45) {
                        let distRatio = Math.min(1, distToTarget / 1500);
                        SoundEngine.beaconPing(panValue, distRatio, currentLineIndex);
                        lastBeaconFrame = frameCount;
                    }
                } else if (currentLineIndex < poemNodes.length) {
                    const hudScan = document.getElementById('hud-scan');
                    if (hudScan) hudScan.textContent = 'DECRYPTING CORRUPTED MATTER...';
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

                // --- A* PATH VISUALIZATION ---
                // Draw the autopilot's current navigation path
                if (isAutoPilot && currentPath && currentPath.length > 0) {
                    ctx.save();
                    let pathHue = wanderPhase ? 180 : 30; // cyan during wander, amber during navigation
                    
                    // Draw path as dotted trail
                    for (let i = 0; i < currentPath.length; i++) {
                        let node = currentPath[i];
                        let nx = node.x * CELL_SIZE + CELL_SIZE / 2 - camX;
                        let ny = node.y * CELL_SIZE + CELL_SIZE / 2 - camY;
                        
                        // Skip nodes far off-screen
                        if (nx < -50 || nx > (canvas as any).width + 50 || ny < -50 || ny > (canvas as any).height + 50) continue;
                        
                        // Trail alpha fades along path
                        let alpha = 0.15 + (1 - i / currentPath.length) * 0.25;
                        // Pulsing glow
                        alpha *= 0.7 + 0.3 * Math.sin(frameCount * 0.08 + i * 0.3);
                        
                        // Every 3rd node draws a small dot
                        if (i % 3 === 0) {
                            ctx.beginPath();
                            ctx.arc(nx, ny, 2, 0, Math.PI * 2);
                            ctx.fillStyle = `hsla(${pathHue}, 80%, 60%, ${alpha})`;
                            ctx.fill();
                        }
                        
                        // Connect dots with faint line
                        if (i > 0 && i % 3 === 0) {
                            let prev = currentPath[Math.max(0, i - 3)];
                            let px = prev.x * CELL_SIZE + CELL_SIZE / 2 - camX;
                            let py = prev.y * CELL_SIZE + CELL_SIZE / 2 - camY;
                            ctx.beginPath();
                            ctx.moveTo(px, py);
                            ctx.lineTo(nx, ny);
                            ctx.strokeStyle = `hsla(${pathHue}, 80%, 60%, ${alpha * 0.5})`;
                            ctx.lineWidth = 1;
                            ctx.setLineDash([3, 6]);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    }
                    
                    // Draw destination marker — pulsing ring at end of path
                    if (!wanderPhase && currentLineIndex < poemNodes.length) {
                        let dest = poemNodes[currentLineIndex];
                        let dx = dest.x - camX;
                        let dy = dest.y - camY;
                        let pulseR = 20 + Math.sin(frameCount * 0.05) * 8;
                        let destAlpha = 0.3 + Math.sin(frameCount * 0.08) * 0.15;
                        ctx.beginPath();
                        ctx.arc(dx, dy, pulseR, 0, Math.PI * 2);
                        ctx.strokeStyle = `hsla(${pathHue}, 90%, 65%, ${destAlpha})`;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                        
                        // Inner crosshair
                        ctx.beginPath();
                        ctx.moveTo(dx - 6, dy);
                        ctx.lineTo(dx + 6, dy);
                        ctx.moveTo(dx, dy - 6);
                        ctx.lineTo(dx, dy + 6);
                        ctx.strokeStyle = `hsla(${pathHue}, 90%, 65%, ${destAlpha * 0.7})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                    
                    ctx.restore();
                }
            }

            // Draw Sonar Pulse for the target objective, clipped by walls!
            if (!sequenceComplete && currentLineIndex < poemNodes.length && collectState !== 'cooldown') {
                let target = poemNodes[currentLineIndex];
                let hue = 30 + (currentLineIndex * 15);

                if (targetVisibilityPolygon.length > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(targetVisibilityPolygon[0].x - camX, targetVisibilityPolygon[0].y - camY);
                    for (let i = 1; i < targetVisibilityPolygon.length; i++) {
                        ctx.lineTo(targetVisibilityPolygon[i].x - camX, targetVisibilityPolygon[i].y - camY);
                    }
                    ctx.closePath();
                    ctx.clip();

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

                    // Draw dwell progress ring when in reading state
                    if (collectState === 'reading' && dwellProgress > 0) {
                        let ringRadius = 40;
                        let endAngle = -Math.PI / 2 + dwellProgress * Math.PI * 2;
                        ctx.beginPath();
                        ctx.arc(target.x - camX, target.y - camY, ringRadius, -Math.PI / 2, endAngle);
                        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.9)`;
                        ctx.lineWidth = 3;
                        ctx.stroke();

                        // Background ring
                        ctx.beginPath();
                        ctx.arc(target.x - camX, target.y - camY, ringRadius, 0, Math.PI * 2);
                        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.15)`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }

                    ctx.restore();
                }

                // Off-screen edge pointer — delayed by onboarding
                if (onboardingPhase >= 1) {
                    let dx = target.x - player.x;
                    let dy = target.y - player.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    let angle = Math.atan2(dy, dx);
                    let screenRadius = Math.min((canvas as any).width, (canvas as any).height) / 2;

                    if (dist > screenRadius) {
                        let indX = (canvas as any).width / 2 + Math.cos(angle) * (screenRadius - 40);
                        let indY = (canvas as any).height / 2 + Math.sin(angle) * (screenRadius - 40);

                        ctx.save();
                        ctx.translate(indX, indY);
                        ctx.rotate(angle);

                        let rippleOffset = (frameCount % 90) / 90;
                        for (let r = 0; r < 3; r++) {
                            let localOffset = (rippleOffset + (r / 3)) % 1;
                            let rRadius = 5 + (localOffset * 25);
                            let rAlpha = (1 - localOffset) * (isTargetIlluminated ? 0.9 : 0.3);

                            ctx.beginPath();
                            ctx.arc(0, 0, rRadius, -0.8, 0.8);
                            ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${rAlpha})`;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                        ctx.beginPath();
                        ctx.arc(0, 0, 3 + Math.sin(frameCount * 0.1) * 1.5, 0, Math.PI * 2);
                        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${isTargetIlluminated ? 1 : 0.5})`;
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }

            // Onboarding overlay
            if (onboardingPhase === 0 && !sequenceComplete) {
                let alpha = Math.max(0, 1 - onboardingTimer / 180);
                if (alpha > 0) {
                    ctx.save();
                    ctx.font = '14px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = `rgba(0, 255, 204, ${alpha * 0.7})`;
                    ctx.fillText('EXPLORE THE DARKNESS', (canvas as any).width / 2, (canvas as any).height / 2 - 60);
                    ctx.font = '10px monospace';
                    ctx.fillStyle = `rgba(255, 140, 0, ${alpha * 0.5})`;
                    ctx.fillText('SCAN TO REVEAL HIDDEN FRAGMENTS', (canvas as any).width / 2, (canvas as any).height / 2 - 40);
                    ctx.restore();
                }
            }

            // Collection notification
            if (collectNotifyTimer > 0 && collectNotification) {
                let alpha = Math.min(1, collectNotifyTimer / 60);
                ctx.save();
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255, 140, 0, ${alpha * 0.9})`;
                ctx.fillText(collectNotification, (canvas as any).width / 2, 50);
                ctx.restore();
            }

            // Draw active sparks (as shattering textual data)
            ctx.globalCompositeOperation = 'screen';
            ctx.font = 'bold 12px monospace';
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
                if (s.char) {
                    ctx.fillText(s.char, s.x - camX, s.y - camY);
                } else {
                    ctx.fillRect(s.x - camX, s.y - camY, 2.5, 2.5);
                }
            }
            ctx.globalAlpha = 1.0;

            // Draw the Player's Vision Cone, constrained strictly by physical walls
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

                ctx.clip(); // Mask applied: everything drawn inside is strictly what the player sees

                ctx.globalAlpha = 1.0;
                ctx.drawImage(floorCanvas, -camX, -camY); // Reveal objective text

                if (isTargetIlluminated) {
                    ctx.fillStyle = 'rgba(255, 140, 0, 0.12)';
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 204, 0.02)';
                }
                ctx.fill();

                // Draw Player Sonar Ripples bouncing strictly off walls
                for (let r of playerRings) {
                    ctx.beginPath();
                    ctx.arc(player.x - camX, player.y - camY, r.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(0, 255, 204, ${r.life * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                ctx.restore(); // Remove clip mask

                // Draw outer ray lines
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
                    ctx.strokeStyle = 'rgba(255, 140, 0, 0.15)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 6]);
                    ctx.beginPath();
                    ctx.arc(joystickOrigin.x, joystickOrigin.y, 40, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.fillStyle = 'rgba(255, 140, 0, 0.8)';
                    ctx.beginPath();
                    ctx.arc(joystickCurrent.x, joystickCurrent.y, 12, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255, 140, 0, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(joystickOrigin.x, joystickOrigin.y);
                    ctx.lineTo(joystickCurrent.x, joystickCurrent.y);
                    ctx.stroke();
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

        // --- Boot Sequence (Cinematic Typing Intro) ---
        const bootLines = [
            "ACCESSING ARCHIVED ENGRAMS...",
            "DECRYPTING NEURAL TOPOGRAPHY...",
            "ALL PHYSICS REDUCED TO SYNTAX.",
            "SEEKING MEMORY FRAGMENTS IN THE DARK..."
        ];

        document.fonts.ready.then(() => {
            const loader = document.getElementById('font-loader');
            if (loader) loader.style.display = 'none';

            const bootSub = document.getElementById('boot-text');
            let lineIdx = 0;
            let charIdx = 0;

            function typeLine() {
                if (lineIdx < bootLines.length) {
                    if (charIdx < bootLines[lineIdx].length) {
                        bootSub.innerHTML += bootLines[lineIdx].charAt(charIdx);
                        charIdx++;
                        setTimeout(typeLine, 35);
                    } else {
                        bootSub.innerHTML += '<br>';
                        lineIdx++;
                        charIdx = 0;
                        setTimeout(typeLine, 500);
                    }
                } else {
                    const btn = document.getElementById('boot-btn');
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                }
            }

            setTimeout(typeLine, 1000);
        });

        const launchSequence = (e) => {
            if (e) e.preventDefault();
            if (isRunning) return;

            SoundEngine.init();
            SoundEngine.bootSound();
            SoundEngine.startAmbientDrone(); // Launch the continuous background drone

            // Ensure browser loads voices array if not ready
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.onvoiceschanged = () => { };
            }
            SpeechEngine.speak("");

            const flash = document.getElementById('flash-overlay');
            flash.style.opacity = '1';

            setTimeout(() => {
                document.getElementById('boot-screen').style.display = 'none';
                resizeCanvas();
                initWorld();
                isRunning = true;
                requestAnimationFrame(gameLoop);

                flash.style.opacity = '0';
            }, 1000);

            setTimeout(() => {
                document.getElementById('controls-hint').style.opacity = '0';
            }, 8000);
        };

        const bootBtn = document.getElementById('boot-btn');
        bootBtn.addEventListener('click', launchSequence);
        bootBtn.addEventListener('touchstart', launchSequence, { passive: false });

