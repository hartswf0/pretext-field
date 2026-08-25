/* =====================================================================
   TERMINUS ONE · 78 · GEONOSIS ENGINE

   77 asks what is happening where.
   78 asks what difference it makes here, for this agent, at this scale.

   GEOSIGN = difference × relation × agent/process × scale × consequence

   No datum is promoted merely because it exists.  Observations remain
   observations; derived relations are explicitly labeled as derived.
   ===================================================================== */
const G78_RAD = Math.PI / 180;
const G78_EARTH_KM = 6371;
const G78 = {
  version: 78,
  agent: 'PLANE',
  filter: 'CONSEQUENCE',
  agents: ['PLANE', 'MAIL', 'CITY', 'WORLD'],
  relations: [],
  compositions: [],
  traces: [],
  earthStamp: -1,
  relationStamp: 0,
  lastTraceKey: '',
  lastTraceAt: 0,
  provenance: { earth:'USGS', wind:'OPEN-METEO', sky:'OPENSKY' }
};
window.TERMINUS_GEONOSIS = G78;

/* ---------- persistent labeled controls; no hidden icon grammar ---------- */
ws77Bar.style.pointerEvents = 'auto';
const g78AgentEl = document.createElement('span');
const g78FilterEl = document.createElement('span');
const g78CountEl = document.createElement('span');
g78AgentEl.id = 'g78agent';
g78FilterEl.id = 'g78filter';
g78CountEl.id = 'g78count';
g78AgentEl.tabIndex = 0;
g78FilterEl.tabIndex = 0;
g78AgentEl.setAttribute('role', 'button');
g78FilterEl.setAttribute('role', 'button');
g78AgentEl.setAttribute('aria-label', 'CHANGE GEONOSIS AGENT');
g78FilterEl.setAttribute('aria-label', 'CHANGE GEONOSIS FILTER');
g78AgentEl.style.pointerEvents = 'auto';
g78FilterEl.style.pointerEvents = 'auto';
g78AgentEl.style.cursor = 'pointer';
g78FilterEl.style.cursor = 'pointer';
g78AgentEl.style.color = '#faf8f1';
g78FilterEl.style.color = '#ffd76e';
g78CountEl.style.color = '#9ad6a0';
ws77Bar.insertBefore(g78CountEl, ws77Bar.firstChild);
ws77Bar.insertBefore(g78FilterEl, ws77Bar.firstChild);
ws77Bar.insertBefore(g78AgentEl, ws77Bar.firstChild);

const g78Style = document.createElement('style');
g78Style.textContent = `
#g78read{position:absolute;left:50%;top:calc(72px + env(safe-area-inset-top));
  transform:translateX(-50%);z-index:14;max-width:calc(100vw - 24px);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;
  padding:4px 7px;border:1px solid rgba(255,215,110,.22);
  background:rgba(13,18,17,.70);color:#ffd76e;
  font:700 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  letter-spacing:.09em;backdrop-filter:blur(3px)}
@media(max-width:520px){#g78read{top:calc(65px + env(safe-area-inset-top));font-size:8px;letter-spacing:.05em}}
#g78agent:focus,#g78filter:focus{outline:1px solid #ffd76e;outline-offset:-2px}
`;
document.head.appendChild(g78Style);
const g78ReadEl = document.createElement('div');
g78ReadEl.id = 'g78read';
g78ReadEl.setAttribute('role', 'status');
g78ReadEl.textContent = 'GEONOSIS · ACQUIRING RELATIONS';
document.body.appendChild(g78ReadEl);

function g78PaintControls(){
  g78AgentEl.textContent = 'AGENT · ' + G78.agent;
  g78FilterEl.textContent = 'FILTER · ' + G78.filter;
  g78CountEl.textContent = 'REL · ' + G78.relations.length + ' · TRACE ' + G78.traces.length;
}
function g78CycleAgent(){
  const i = G78.agents.indexOf(G78.agent);
  G78.agent = G78.agents[(i + 1) % G78.agents.length];
  G78.relationStamp = 0;
  boardLine('GEONOSIS · AGENT ' + G78.agent);
  g78PaintControls();
}
function g78CycleFilter(){
  G78.filter = G78.filter === 'CONSEQUENCE' ? 'ALL' : 'CONSEQUENCE';
  G78.relationStamp = 0;
  boardLine('GEONOSIS · FILTER ' + G78.filter);
  g78PaintControls();
}
g78AgentEl.addEventListener('click', g78CycleAgent);
g78FilterEl.addEventListener('click', g78CycleFilter);
g78AgentEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); g78CycleAgent(); }});
g78FilterEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); g78CycleFilter(); }});
window.addEventListener('keydown', function(e){
  if (e.key.toLowerCase() === 'g') g78CycleAgent();
  if (e.key.toLowerCase() === 'k') g78CycleFilter();
});
g78PaintControls();

/* ---------- geography helpers ---------- */
function g78LLVec(ll){ return fromLonLat(Number(ll[0]), Number(ll[1])); }
function g78Km(a, b){
  if (!a || !b) return Infinity;
  const av = g78LLVec(a), bv = g78LLVec(b);
  return Math.acos(Math.max(-1, Math.min(1, dot(av, bv)))) * G78_EARTH_KM;
}
function g78ThreeLL(ll, r){ return v3(g78LLVec(ll)).normalize().multiplyScalar(r || 1.026); }
function g78TargetIdx(){
  if (state.letter){
    return state.letter.phase === 'carried' ? state.letter.toIdx : state.letter.fromIdx;
  }
  return state.dest >= 0 ? state.dest : -1;
}
function g78TargetLL(){
  const i = g78TargetIdx();
  return i >= 0 && CITIES[i] ? [CITIES[i][1], CITIES[i][2]] : null;
}
function g78AgentLL(){
  const hero = planes[0];
  if (G78.agent === 'PLANE'){
    if (hero && hero.active && hero.geo) return lonlat(hero.geo);
    return state.focusLL || g78TargetLL() || [-84.388, 33.749];
  }
  if (G78.agent === 'MAIL'){
    if (state.dropLL) return [state.dropLL[0], state.dropLL[1]];
    if (hero && hero.active && hero.geo) return lonlat(hero.geo);
    return state.focusLL || g78TargetLL() || [-84.388, 33.749];
  }
  if (G78.agent === 'CITY') return g78TargetLL() || state.focusLL || [-84.388, 33.749];
  return state.focusLL || (hero && hero.active && hero.geo ? lonlat(hero.geo) : [0, 0]);
}
function g78Route(){
  const a = g78AgentLL(), b = g78TargetLL();
  if (!a || !b || G78.agent === 'WORLD' || G78.agent === 'CITY') return [];
  const A = g78LLVec(a), B = g78LLVec(b), out = [];
  for (let i = 0; i <= 28; i++){
    const u = i / 28;
    out.push(lonlat(norm(slerp3(A, B, u))));
  }
  return out;
}
function g78NearestRoute(ll, route){
  let best = { km:Infinity, ll:null };
  for (let i = 0; i < route.length; i++){
    const d = g78Km(ll, route[i]);
    if (d < best.km) best = { km:d, ll:route[i] };
  }
  return best;
}
function g78NearestAirport(ll, skipCode){
  let best = { km:Infinity, code:'', ll:null };
  for (let i = 0; i < AIRPORTS.length; i++){
    if (skipCode && AIRPORTS[i][2] === skipCode) continue;
    const p = [AIRPORTS[i][0], AIRPORTS[i][1]];
    const d = g78Km(ll, p);
    if (d < best.km) best = { km:d, code:AIRPORTS[i][2], ll:p };
  }
  return best;
}
function g78NearestTraffic(ll){
  let best = { km:Infinity, tr:null };
  if (typeof trafficList === 'undefined') return best;
  for (let i = 0; i < trafficList.length; i++){
    const tr = trafficList[i];
    if (!Number.isFinite(tr.lon) || !Number.isFinite(tr.lat)) continue;
    const d = g78Km(ll, [tr.lon, tr.lat]);
    if (d < best.km) best = { km:d, tr:tr };
  }
  return best;
}
function g78Clamp01(v){ return Math.max(0, Math.min(1, v)); }

/* ---------- observed Earth points: epicenters are points, not impact radii ---------- */
const g78EarthGroup = new THREE.Group();
g78EarthGroup.name = 'GEONOSIS · EARTH · OBSERVED EPICENTERS';
worldGroup.add(g78EarthGroup);
const g78Normal = new THREE.Vector3(0, 0, 1);
function g78DisposeGroup(group){
  while (group.children.length){
    const o = group.children.pop();
    o.traverse(function(x){
      if (x.geometry) x.geometry.dispose();
      if (x.material){
        if (Array.isArray(x.material)) x.material.forEach(function(m){ m.dispose(); });
        else x.material.dispose();
      }
    });
  }
}
function g78BuildEarth(){
  if (!WS77 || WS77.earth.updated === G78.earthStamp) return;
  G78.earthStamp = WS77.earth.updated;
  g78DisposeGroup(g78EarthGroup);
  const ev = Array.isArray(WS77.earth.events) ? WS77.earth.events : [];
  for (let i = 0; i < ev.length; i++){
    const e = ev[i];
    const gv = g78ThreeLL([e.lon, e.lat], 1.023).normalize();
    const size = 0.0055 + Math.max(0, e.mag - 2.5) * 0.0015;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(size, 12),
      new THREE.MeshBasicMaterial({
        color:e.mag >= 5 ? 0xffd76e : 0xe06a48,
        transparent:true, opacity:0.82, side:THREE.DoubleSide,
        depthWrite:false, depthTest:false
      })
    );
    m.position.copy(gv).multiplyScalar(1.023);
    m.quaternion.setFromUnitVectors(g78Normal, gv);
    m.userData.g78 = { kind:'OBSERVATION', source:'USGS', mag:e.mag, time:e.time, place:e.place };
    m.renderOrder = 24;
    g78EarthGroup.add(m);
  }
}

/* ---------- consequential relation graph ---------- */
const g78RelationGroup = new THREE.Group();
g78RelationGroup.name = 'GEONOSIS · CONSEQUENTIAL RELATIONS';
worldGroup.add(g78RelationGroup);
const g78TraceGroup = new THREE.Group();
g78TraceGroup.name = 'GEONOSIS · TRACE';
worldGroup.add(g78TraceGroup);
let g78TraceLine = null;

function g78AddRelation(r){
  if (!r || !r.from || !r.to || !Number.isFinite(r.score)) return;
  G78.relations.push(r);
}
function g78RelationColor(kind, score){
  if (kind === 'RELINK') return 0x9ad6a0;
  if (kind === 'WIND') return 0xffd76e;
  if (score >= 1.0) return 0xe06a48;
  return 0xffd76e;
}
function g78BuildRelationGeometry(){
  g78DisposeGroup(g78RelationGroup);
  const rels = G78.relations.slice(0, G78.filter === 'CONSEQUENCE' ? 8 : 14);
  for (let i = 0; i < rels.length; i++){
    const r = rels[i];
    if (r.kind === 'EVENT') continue;
    const a = g78ThreeLL(r.from, 1.032), b = g78ThreeLL(r.to, 1.034);
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
      color:g78RelationColor(r.kind, r.score), transparent:true,
      opacity:0.30 + Math.min(0.55, r.score * 0.35), depthWrite:false, depthTest:false
    }));
    line.userData.g78 = r;
    line.renderOrder = 23;
    g78RelationGroup.add(line);
    const end = new THREE.Mesh(
      new THREE.RingGeometry(0.004, 0.0065, 4),
      new THREE.MeshBasicMaterial({ color:g78RelationColor(r.kind, r.score), transparent:true,
        opacity:0.8, side:THREE.DoubleSide, depthWrite:false, depthTest:false })
    );
    const n = b.clone().normalize();
    end.position.copy(b);
    end.quaternion.setFromUnitVectors(g78Normal, n);
    end.renderOrder = 24;
    g78RelationGroup.add(end);
  }
}

function g78EarthRelations(agentLL, targetLL, route){
  const ev = WS77 && Array.isArray(WS77.earth.events) ? WS77.earth.events : [];
  for (let i = 0; i < ev.length; i++){
    const e = ev[i], q = [e.lon, e.lat];
    const magN = g78Clamp01((e.mag - 3.2) / 3.0);
    const dAgent = g78Km(q, agentLL);
    const dTarget = targetLL ? g78Km(q, targetLL) : Infinity;
    const nr = route.length ? g78NearestRoute(q, route) : {km:Infinity,ll:null};

    if (G78.agent === 'WORLD'){
      if (e.mag >= 4.5){
        g78AddRelation({ kind:'EVENT', source:'USGS', score:0.65 + magN * 0.55,
          from:q, to:q, text:'EARTH × WORLD → EVENT M' + e.mag.toFixed(1),
          consequence:'OBSERVE', scaleKm:0, provenance:'USGS OBSERVATION' });
      }
    } else {
      if (nr.ll && nr.km < 900 && e.mag >= 3.5){
        const score = 0.42 + (1 - nr.km/900) * 0.50 + magN * 0.34;
        g78AddRelation({ kind:'ROUTE', source:'USGS', score:score, from:q, to:nr.ll,
          text:'EARTH × ROUTE → WATCH ' + Math.round(nr.km) + 'KM',
          consequence:'WATCH', scaleKm:nr.km, provenance:'USGS + DERIVED DISTANCE' });
      }
      if (dAgent < 550 && e.mag >= 3.5){
        const score = 0.46 + (1 - dAgent/550) * 0.52 + magN * 0.32;
        g78AddRelation({ kind:'AGENT', source:'USGS', score:score, from:q, to:agentLL,
          text:'EARTH × ' + G78.agent + ' → NEAR ' + Math.round(dAgent) + 'KM',
          consequence:'NEAR', scaleKm:dAgent, provenance:'USGS + DERIVED DISTANCE' });
      }
      if (targetLL && dTarget < 650 && e.mag >= 4.0){
        const score = 0.54 + (1 - dTarget/650) * 0.56 + magN * 0.34;
        g78AddRelation({ kind:'DEST', source:'USGS', score:score, from:q, to:targetLL,
          text:'EARTH × DEST → WATCH ' + Math.round(dTarget) + 'KM',
          consequence:'WATCH', scaleKm:dTarget, provenance:'USGS + DERIVED DISTANCE' });
      }
    }

    if (e.mag >= 4.5){
      const apt = g78NearestAirport(q);
      if (apt.ll && apt.km < 300){
        const score = 0.48 + (1 - apt.km/300) * 0.48 + magN * 0.30;
        g78AddRelation({ kind:'ACCESS', source:'USGS', score:score, from:q, to:apt.ll,
          text:'EARTH × AIRPORT ' + apt.code + ' → WATCH ' + Math.round(apt.km) + 'KM',
          consequence:'WATCH', scaleKm:apt.km, provenance:'USGS + DERIVED DISTANCE' });
      }
    }
  }
}

function g78WindComposition(agentLL){
  if (!WS77 || WS77.weather.state !== 'live') return;
  const xw = Math.abs(Number(WS77.force.crosswind) || 0);
  const label = G78.agent === 'MAIL' ? 'MAIL' : (G78.agent === 'CITY' ? 'CITY' : 'HDG');
  const score = Math.min(1.35, xw / 8.0);
  if (xw >= 1.5 || G78.filter === 'ALL'){
    G78.compositions.push({ score:score, key:'WIND:' + Math.round(xw*10),
      text:'WIND × ' + label + ' → CROSSWIND ' + xw.toFixed(1) + 'M/S',
      provenance:'OPEN-METEO + DERIVED VECTOR' });
  }
}
function g78SkyComposition(agentLL){
  if (typeof trafficList === 'undefined' || !trafficList.length || G78.agent === 'WORLD') return;
  const n = g78NearestTraffic(agentLL);
  if (!n.tr) return;
  const score = Math.max(0, 1.05 - n.km/320);
  if (n.km < 320 || G78.filter === 'ALL'){
    G78.compositions.push({ score:score, key:'SKY:' + Math.round(n.km/10),
      text:'SKY × ' + G78.agent + ' → TRAFFIC ' + Math.round(n.km) + 'KM',
      provenance:'OPENSKY + DERIVED DISTANCE' });
  }
}
function g78RelinkCandidate(targetLL){
  if (!targetLL) return;
  const watch = G78.relations.filter(function(r){ return r.kind === 'DEST' && r.score >= 0.95; })[0];
  if (!watch) return;
  const primary = g78NearestAirport(targetLL);
  const alt = g78NearestAirport(targetLL, primary.code);
  if (!alt.ll || alt.km > 900) return;
  g78AddRelation({ kind:'RELINK', source:'DERIVED', score:0.78, from:targetLL, to:alt.ll,
    text:'ACCESS × DEST → ALT CANDIDATE ' + alt.code,
    consequence:'RELINK CANDIDATE', scaleKm:alt.km,
    provenance:'DERIVED CANDIDATE · NOT A CLOSURE CLAIM' });
}

function g78Recompute(){
  const now = performance.now();
  if (now - G78.relationStamp < 900) return;
  G78.relationStamp = now;
  const agentLL = g78AgentLL();
  const targetLL = g78TargetLL();
  const route = g78Route();
  G78.relations.length = 0;
  G78.compositions.length = 0;

  g78EarthRelations(agentLL, targetLL, route);
  g78RelinkCandidate(targetLL);

  G78.relations.sort(function(a,b){ return b.score - a.score; });
  if (G78.filter === 'CONSEQUENCE'){
    G78.relations = G78.relations.filter(function(r){ return r.score >= 0.70; });
  }
  G78.relations = G78.relations.slice(0, G78.filter === 'CONSEQUENCE' ? 8 : 14);

  for (let i = 0; i < G78.relations.length; i++){
    const r = G78.relations[i];
    G78.compositions.push({ score:r.score, key:r.kind + ':' + r.text, text:r.text, provenance:r.provenance });
  }
  g78WindComposition(agentLL);
  g78SkyComposition(agentLL);
  G78.compositions.sort(function(a,b){ return b.score - a.score; });
  g78BuildRelationGeometry();
  g78PaintReadout(agentLL);
  g78MaybeTrace(agentLL);
  g78PaintControls();
}

/* ---------- trace: where a relation became consequential for this session ---------- */
function g78RebuildTrace(){
  g78DisposeGroup(g78TraceGroup);
  const pts = [];
  for (let i = 0; i < G78.traces.length; i++){
    const tr = G78.traces[i];
    const p = g78ThreeLL(tr.ll, 1.036);
    pts.push(p);
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.0045, 0.0075, 4),
      new THREE.MeshBasicMaterial({ color:0xfaf8f1, transparent:true, opacity:0.72,
        side:THREE.DoubleSide, depthWrite:false, depthTest:false })
    );
    m.position.copy(p);
    m.quaternion.setFromUnitVectors(g78Normal, p.clone().normalize());
    m.userData.g78 = tr;
    m.renderOrder = 25;
    g78TraceGroup.add(m);
  }
  if (pts.length > 1){
    g78TraceLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color:0xfaf8f1, transparent:true, opacity:0.22,
        depthWrite:false, depthTest:false })
    );
    g78TraceLine.renderOrder = 22;
    g78TraceGroup.add(g78TraceLine);
  }
}
function g78MaybeTrace(agentLL){
  const top = G78.compositions[0];
  if (!top || top.score < 0.70) return;
  const now = Date.now();
  if (top.key === G78.lastTraceKey || now - G78.lastTraceAt < 5000) return;
  G78.lastTraceKey = top.key;
  G78.lastTraceAt = now;
  G78.traces.push({ ll:[agentLL[0], agentLL[1]], time:now, agent:G78.agent, text:top.text, provenance:top.provenance });
  while (G78.traces.length > 24) G78.traces.shift();
  g78RebuildTrace();
  boardLine('GEOSIGN · ' + top.text.slice(0, 25));
}

/* ---------- a local measured wind vector, not a decorative weather field ---------- */
const g78WindArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 0.16, 0xffd76e, 0.035, 0.018);
g78WindArrow.name = 'GEONOSIS · LOCAL WIND VECTOR · OPEN-METEO';
g78WindArrow.line.material.transparent = true;
g78WindArrow.line.material.opacity = 0.58;
g78WindArrow.line.material.depthTest = false;
g78WindArrow.cone.material.transparent = true;
g78WindArrow.cone.material.opacity = 0.72;
g78WindArrow.cone.material.depthTest = false;
worldGroup.add(g78WindArrow);
function g78UpdateWindVector(){
  if (!WS77 || WS77.weather.state !== 'live' || G78.agent === 'WORLD'){
    g78WindArrow.visible = false; return;
  }
  const ll = g78AgentLL();
  const geo = g78LLVec(ll);
  const F = frameAt(geo);
  const windTo = (WS77.weather.direction + 180) * G78_RAD;
  const c = Math.cos(windTo), s = Math.sin(windTo);
  const fwd = norm([
    F.n[0]*c + F.e[0]*s,
    F.n[1]*c + F.e[1]*s,
    F.n[2]*c + F.e[2]*s
  ]);
  const ds = 0.12;
  const g2 = norm([
    geo[0]*Math.cos(ds) + fwd[0]*Math.sin(ds),
    geo[1]*Math.cos(ds) + fwd[1]*Math.sin(ds),
    geo[2]*Math.cos(ds) + fwd[2]*Math.sin(ds)
  ]);
  const a = v3(geo).normalize().multiplyScalar(1.055);
  const b = v3(g2).normalize().multiplyScalar(1.055);
  const d = b.clone().sub(a);
  if (d.lengthSq() < 1e-7){ g78WindArrow.visible = false; return; }
  g78WindArrow.position.copy(a);
  g78WindArrow.setDirection(d.normalize());
  g78WindArrow.setLength(0.10 + Math.min(0.18, WS77.weather.speed * 0.006), 0.035, 0.018);
  g78WindArrow.visible = morphT < 0.18;
}

function g78PaintReadout(){
  if (!G78.compositions.length){
    g78ReadEl.textContent = 'GEONOSIS · ' + G78.agent + ' · NO CONSEQUENTIAL RELATION';
    return;
  }
  const shown = G78.compositions.slice(0, 2).map(function(c){ return c.text; });
  g78ReadEl.textContent = 'GEONOSIS · ' + shown.join('   ·   ');
  g78ReadEl.title = G78.compositions.slice(0, 4).map(function(c){ return c.text + ' [' + c.provenance + ']'; }).join('\n');
}

/* ---------- board integration: one native line, not a second dashboard ---------- */
const g78PaintBoard77 = paintBoard;
paintBoard = function(){
  g78PaintBoard77();
  const g = bg;
  g.save();
  g.textAlign = 'right';
  g.fillStyle = '#9ad6a0';
  g.font = '700 12px ui-monospace,monospace';
  g.fillText('G78 · ' + G78.agent + ' · ' + G78.relations.length + ' REL · ' + G78.filter, 996, 162);
  g.restore();
  boardTex.needsUpdate = true;
};

/* ---------- frame: 77 remains the chassis; 78 decides salience ---------- */
function g78Frame(now){
  /* retire 77's ambiguous earthquake radii; keep its USGS acquisition intact */
  if (typeof ws77EarthGroup !== 'undefined') ws77EarthGroup.visible = false;
  g78BuildEarth();
  const ev = WS77 && Array.isArray(WS77.earth.events) ? WS77.earth.events : [];
  for (let i = 0; i < g78EarthGroup.children.length; i++){
    const m = g78EarthGroup.children[i], e = ev[i];
    if (!e) continue;
    const ageH = Math.max(0, (Date.now() - e.time) / 3600000);
    m.material.opacity = 0.30 + 0.60 * Math.max(0.15, 1 - ageH/30);
  }
  g78EarthGroup.visible = morphT < 0.18;
  g78RelationGroup.visible = morphT < 0.18;
  g78TraceGroup.visible = morphT < 0.18;
  g78UpdateWindVector();
  g78Recompute();
  requestAnimationFrame(g78Frame);
}

boardLine('GEONOSIS · 78 · CONSEQUENCE FILTER ONLINE');
requestAnimationFrame(g78Frame);
