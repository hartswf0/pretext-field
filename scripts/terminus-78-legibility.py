from pathlib import Path

p = Path('terminus-one-78.html')
s = p.read_text(encoding='utf-8')
marker = 'TERMINUS ONE · 78.1 · LEGIBLE GEONOSIS CONTROLS'
assert marker not in s, 'legibility patch already present'
assert '</script>\n</body>' in s

patch = r'''

/* =====================================================================
   TERMINUS ONE · 78.1 · LEGIBLE GEONOSIS CONTROLS
   A control must change the picture, not only a hidden variable.
   VIEWPOINT chooses whose situation the map is organized around.
   MAP LAYERS chooses raw field versus consequential relations.
   ===================================================================== */
const g781Style = document.createElement('style');
g781Style.textContent = `
#g78controls{position:absolute;left:50%;top:calc(40px + env(safe-area-inset-top));
  transform:translateX(-50%);z-index:16;display:grid;grid-template-columns:1fr 1fr;
  width:min(570px,calc(100vw - 20px));gap:6px;pointer-events:auto}
#g78controls .gctl{min-width:0;padding:7px 10px 6px;border:1px solid rgba(241,238,228,.34);
  background:rgba(13,18,17,.92);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  cursor:pointer;user-select:none;box-shadow:0 0 0 1px rgba(0,0,0,.18) inset}
#g78controls .gctl:hover,#g78controls .gctl:focus{border-color:#ffd76e;outline:none}
#g78controls .gname{display:block;color:#aeb7b0;font-size:8px;font-weight:700;letter-spacing:.13em}
#g78controls .gvalue{display:block;margin-top:2px;color:#ffd76e;font-size:12px;font-weight:800;letter-spacing:.07em}
#g78controls .gwhy{display:block;margin-top:3px;color:#faf8f1;font-size:8px;font-weight:700;letter-spacing:.035em;opacity:.82}
#g78agent.gctl .gvalue{color:#9ad6a0}
#ws77bar{top:calc(96px + env(safe-area-inset-top))!important;opacity:.74;border-color:rgba(241,238,228,.12)!important}
#g78read{top:calc(120px + env(safe-area-inset-top))!important;max-width:min(760px,calc(100vw - 20px))!important}
#g78change{position:absolute;left:50%;top:calc(148px + env(safe-area-inset-top));transform:translateX(-50%);
  z-index:15;pointer-events:none;opacity:0;transition:opacity .18s ease;padding:5px 9px;
  border:1px solid rgba(154,214,160,.55);background:rgba(13,18,17,.94);color:#9ad6a0;
  font:800 10px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.07em;white-space:nowrap}
#g78change.on{opacity:1}
@media(max-width:520px){
  #g78controls{top:calc(38px + env(safe-area-inset-top));width:calc(100vw - 8px);gap:3px}
  #g78controls .gctl{padding:6px 7px 5px}
  #g78controls .gname{font-size:7px}.gvalue{font-size:10px!important}.gwhy{font-size:7px!important}
  #ws77bar{top:calc(91px + env(safe-area-inset-top))!important}
  #g78read{top:calc(113px + env(safe-area-inset-top))!important}
  #g78change{top:calc(136px + env(safe-area-inset-top));font-size:8px;max-width:calc(100vw - 12px);overflow:hidden;text-overflow:ellipsis}
}
`;
document.head.appendChild(g781Style);

const g78Controls = document.createElement('div');
g78Controls.id = 'g78controls';
g78Controls.setAttribute('aria-label', 'GEONOSIS MAP CONTROLS');
document.body.appendChild(g78Controls);
g78AgentEl.classList.add('gctl');
g78FilterEl.classList.add('gctl');
g78Controls.appendChild(g78AgentEl);
g78Controls.appendChild(g78FilterEl);
const g78ChangeEl = document.createElement('div');
g78ChangeEl.id = 'g78change';
document.body.appendChild(g78ChangeEl);
let g78ChangeTimer = 0;

const G78_VIEW_HELP = {
  PLANE:'WHAT MATTERS TO THE AIRCRAFT NOW',
  MAIL:'WHAT MATTERS TO THE LETTER',
  CITY:'WHAT MATTERS TO THE DESTINATION',
  WORLD:'WHAT IS HAPPENING ACROSS THE WORLD'
};
const G78_VIEW_NEXT = { PLANE:'MAIL', MAIL:'CITY', CITY:'WORLD', WORLD:'PLANE' };
function g781FilterName(){ return G78.filter === 'CONSEQUENCE' ? 'IMPORTANT ONLY' : 'ALL SIGNALS'; }
function g781FilterHelp(){ return G78.filter === 'CONSEQUENCE'
  ? 'HIDE RAW BACKGROUND · SHOW RELATIONS THAT MATTER'
  : 'SHOW RAW EARTH + SKY + DERIVED RELATIONS';
}
function g781Flash(text){
  g78ChangeEl.textContent = text;
  g78ChangeEl.classList.add('on');
  clearTimeout(g78ChangeTimer);
  g78ChangeTimer = setTimeout(function(){ g78ChangeEl.classList.remove('on'); }, 1800);
}

g78PaintControls = function(){
  const aboard = G78.agent === 'MAIL' && !drop ? ' · ABOARD' : '';
  g78AgentEl.innerHTML = '<span class="gname">VIEWPOINT · TAP TO CHANGE</span>' +
    '<span class="gvalue">' + G78.agent + aboard + '  →  ' + G78_VIEW_NEXT[G78.agent] + '</span>' +
    '<span class="gwhy">' + G78_VIEW_HELP[G78.agent] + '</span>';
  g78FilterEl.innerHTML = '<span class="gname">MAP LAYERS · TAP TO CHANGE</span>' +
    '<span class="gvalue">' + g781FilterName() + '</span>' +
    '<span class="gwhy">' + g781FilterHelp() + '</span>';
  g78CountEl.textContent = 'RELATIONS · ' + G78.relations.length + ' · TRACE ' + G78.traces.length;
  g78AgentEl.setAttribute('aria-label','VIEWPOINT ' + G78.agent + '. ' + G78_VIEW_HELP[G78.agent] + '. TAP TO CHANGE.');
  g78FilterEl.setAttribute('aria-label','MAP LAYERS ' + g781FilterName() + '. ' + g781FilterHelp() + '. TAP TO CHANGE.');
};

function g781ViewSpan(){
  if (G78.agent === 'WORLD') return 360;
  if (G78.agent === 'CITY') return 42;
  if (G78.agent === 'MAIL') return drop ? 28 : 52;
  return 58;
}
function g781ApplyView(announce){
  const ll = g78AgentLL();
  if (G78.agent === 'WORLD'){
    setMapWindow(0, 0, 360);
  } else if (ll){
    setMapWindow(ll[0], ll[1], g781ViewSpan());
  }
  /* the control owns the map briefly; do not let route autopan erase the lesson */
  manualMapUntil = performance.now() + 9000;
  /* snap halfway immediately, then let the normal map easing finish the move */
  mapWin.lon0 += (mapWinT.lon0 - mapWin.lon0) * 0.62;
  mapWin.lon1 += (mapWinT.lon1 - mapWin.lon1) * 0.62;
  mapWin.lat0 += (mapWinT.lat0 - mapWin.lat0) * 0.62;
  mapWin.lat1 += (mapWinT.lat1 - mapWin.lat1) * 0.62;
  G78.relationStamp = 0;
  G78.renderSig = '';
  g78Recompute();
  state.boardDirty = true;
  paintMovFrame();
  if (announce){
    g781Flash('VIEWPOINT · ' + G78.agent + ' · ' + G78_VIEW_HELP[G78.agent]);
  }
}
function g781ApplyFilter(){
  G78.relationStamp = 0;
  G78.renderSig = '';
  g78Recompute();
  state.boardDirty = true;
  paintMovFrame();
  g781Flash('MAP LAYERS · ' + g781FilterName() + ' · ' + g781FilterHelp());
}
/* original click handlers change state first; these make that state visible */
g78AgentEl.addEventListener('click', function(){ setTimeout(function(){ g781ApplyView(true); }, 0); });
g78FilterEl.addEventListener('click', function(){ setTimeout(g781ApplyFilter, 0); });
g78AgentEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') setTimeout(function(){ g781ApplyView(true); }, 0); });
g78FilterEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') setTimeout(g781ApplyFilter, 0); });
window.addEventListener('keydown', function(e){
  if (e.key.toLowerCase() === 'g') setTimeout(function(){ g781ApplyView(true); }, 0);
  if (e.key.toLowerCase() === 'k') setTimeout(g781ApplyFilter, 0);
});

/* a persistent 3D viewpoint mark: the chosen subject is never implicit */
const g781Focus = new THREE.Mesh(
  new THREE.RingGeometry(0.020, 0.030, 24),
  new THREE.MeshBasicMaterial({ color:0x9ad6a0, transparent:true, opacity:0.95,
    side:THREE.DoubleSide, depthWrite:false, depthTest:false })
);
g781Focus.name = 'GEONOSIS · CURRENT VIEWPOINT';
g781Focus.renderOrder = 29;
worldGroup.add(g781Focus);
function g781UpdateFocus3D(){
  if (G78.agent === 'WORLD' || morphT >= 0.18){ g781Focus.visible = false; return; }
  const ll = g78AgentLL();
  if (!ll){ g781Focus.visible = false; return; }
  const p = g78ThreeLL(ll, 1.048);
  g781Focus.position.copy(p);
  g781Focus.quaternion.setFromUnitVectors(g78Normal, p.clone().normalize());
  g781Focus.scale.setScalar(1 + 0.12*Math.sin(performance.now()/240));
  g781Focus.visible = true;
}
const g781WindBase = g78UpdateWindVector;
g78UpdateWindVector = function(){
  const r = g781WindBase();
  g781UpdateFocus3D();
  return r;
};

function g781DrawFocusOnMap(){
  const ll = g78AgentLL();
  if (G78.agent === 'WORLD' || !ll || !g78MapVisible(ll)) return;
  const q = g78MapProject(ll[0], ll[1]);
  const pulse = 1 + 0.12*Math.sin(performance.now()/230);
  mg.save();
  mg.strokeStyle = '#9ad6a0'; mg.lineWidth = 2.2; mg.globalAlpha = 0.96;
  mg.beginPath(); mg.arc(q[0], q[1], 10*pulse, 0, 6.2832); mg.stroke();
  mg.beginPath();
  mg.moveTo(q[0]-16, q[1]); mg.lineTo(q[0]-7, q[1]);
  mg.moveTo(q[0]+7, q[1]); mg.lineTo(q[0]+16, q[1]);
  mg.moveTo(q[0], q[1]-16); mg.lineTo(q[0], q[1]-7);
  mg.moveTo(q[0], q[1]+7); mg.lineTo(q[0], q[1]+16); mg.stroke();
  mg.fillStyle = 'rgba(13,18,17,.92)';
  const lab = 'VIEWPOINT · ' + G78.agent;
  mg.font = '800 10px ui-monospace,monospace';
  const tw = mg.measureText(lab).width;
  mg.fillRect(q[0]+13, q[1]-16, tw+8, 15);
  mg.fillStyle = '#9ad6a0'; mg.fillText(lab, q[0]+17, q[1]-5);
  mg.restore();
}
function g781DrawRouteContext(){
  if (G78.agent !== 'PLANE' && G78.agent !== 'MAIL') return;
  const a = g78AgentLL(), b = g78TargetLL();
  if (!a || !b) return;
  g78DrawMapArc(mg, a, b, '#faf8f1', 0.34, [3,6]);
}

/* The filter finally changes actual layers.
   IMPORTANT ONLY = derived consequential graph + viewpoint.
   ALL SIGNALS = raw USGS observations + live sky + derived graph. */
g78DrawMapRelations = function(){
  const ev = WS77 && Array.isArray(WS77.earth.events) ? WS77.earth.events : [];

  if (G78.filter === 'ALL'){
    for (let i = 0; i < ev.length; i++){
      const e = ev[i], ll = [e.lon, e.lat];
      if (!g78MapVisible(ll)) continue;
      const q = g78MapProject(ll[0], ll[1]);
      mg.fillStyle = e.mag >= 5 ? '#ffd76e' : '#e06a48';
      mg.globalAlpha = 0.82;
      mg.beginPath();
      mg.arc(q[0], q[1], 1.8 + Math.max(0, e.mag-2.5)*0.58, 0, 6.2832);
      mg.fill();
    }
    mg.globalAlpha = 1;
  }

  g781DrawRouteContext();
  for (let i = 0; i < G78.relations.length; i++){
    const r = G78.relations[i];
    if (r.kind === 'EVENT') continue;
    const col = r.kind === 'RELINK' ? '#9ad6a0' : (r.score >= 1 ? '#e06a48' : '#ffd76e');
    g78DrawMapArc(mg, r.from, r.to, col, G78.filter === 'CONSEQUENCE' ? 0.78 : 0.46,
      r.kind === 'RELINK' ? [5,4] : null);
    if (g78MapVisible(r.to)){
      const q = g78MapProject(r.to[0], r.to[1]);
      mg.save(); mg.translate(q[0], q[1]); mg.rotate(Math.PI/4);
      mg.strokeStyle = col; mg.globalAlpha = 0.92; mg.lineWidth = 1.5;
      mg.strokeRect(-4, -4, 8, 8); mg.restore();
    }
  }

  for (let i = 0; i < G78.traces.length; i++){
    const tr = G78.traces[i];
    if (!g78MapVisible(tr.ll)) continue;
    const q = g78MapProject(tr.ll[0], tr.ll[1]);
    mg.save(); mg.translate(q[0], q[1]); mg.rotate(Math.PI/4);
    mg.strokeStyle = '#faf8f1'; mg.globalAlpha = 0.48; mg.lineWidth = 1;
    mg.strokeRect(-2.5, -2.5, 5, 5); mg.restore();
  }
  g781DrawFocusOnMap();

  /* cover the old terse map caption with a sentence that explains the picture */
  mg.save();
  mg.fillStyle = 'rgba(13,18,17,.92)'; mg.fillRect(4, 4, 430, 34);
  mg.fillStyle = '#9ad6a0'; mg.font = '800 10px ui-monospace,monospace';
  mg.fillText('VIEW · ' + G78.agent + ' · ' + G78_VIEW_HELP[G78.agent], 9, 16);
  mg.fillStyle = '#ffd76e'; mg.font = '700 9px ui-monospace,monospace';
  mg.fillText('LAYERS · ' + g781FilterName() + ' · ' + G78.relations.length + ' RELATIONS' +
    (G78.filter === 'ALL' ? ' · RAW EARTH + SKY ON' : ' · RAW FIELD HIDDEN'), 9, 30);
  mg.restore();
  mg.globalAlpha = 1;
};

/* Base map draws live traffic. Temporarily remove it only while painting
   IMPORTANT ONLY so the layer switch has a visible, truthful effect. */
paintMovFrame = function(){
  let heldTraffic = null;
  if (G78.filter === 'CONSEQUENCE' && trafficList.length){
    heldTraffic = trafficList.splice(0, trafficList.length);
  }
  g78PaintMov77();
  if (heldTraffic) Array.prototype.push.apply(trafficList, heldTraffic);
  g78DrawMapRelations();
  movTex.needsUpdate = true;
};

g78PaintControls();
g781UpdateFocus3D();
'''

s = s.replace('</script>\n</body>', patch + '\n</script>\n</body>', 1)
p.write_text(s, encoding='utf-8')
print('patched', p, 'bytes', len(s))
