from pathlib import Path

p = Path('terminus-one-78.html')
s = p.read_text(encoding='utf-8')
marker = '/* =====================================================================\n   TERMINUS ONE · 78.2 · PERCEPTUAL MODES'
if marker in s:
    print('78.2 already present')
    raise SystemExit(0)
insert = r'''

/* =====================================================================
   TERMINUS ONE · 78.2 · PERCEPTUAL MODES
   A selected mode must visibly recompose the world.

   VIEWPOINT is direct selection, not a hidden cycle:
   PLANE = local aircraft field
   MAIL  = full origin/current -> destination corridor
   CITY  = destination field
   WORLD = whole Earth

   LAYERS is direct selection:
   IMPORTANT = consequential graph only
   ALL       = raw observations + consequential graph
   ===================================================================== */

/* retire the cycle cards; direct choices replace them */
if (typeof g78Controls !== 'undefined') g78Controls.style.display = 'none';

const g782Style = document.createElement('style');
g782Style.textContent = `
#g782controls{position:absolute;left:50%;top:calc(38px + env(safe-area-inset-top));
  transform:translateX(-50%);z-index:18;width:min(680px,calc(100vw - 16px));
  display:grid;gap:4px;pointer-events:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
#g782controls .row{display:grid;grid-template-columns:84px 1fr;gap:5px;align-items:stretch}
#g782controls .label{display:flex;align-items:center;padding:0 7px;border:1px solid rgba(241,238,228,.18);
  background:rgba(13,18,17,.90);color:#aeb7b0;font-size:8px;font-weight:800;letter-spacing:.11em}
#g782controls .choices{display:grid;gap:3px}
#g782view .choices{grid-template-columns:repeat(4,1fr)}
#g782layers .choices{grid-template-columns:1fr 1fr}
#g782controls button{appearance:none;border:1px solid rgba(241,238,228,.24);background:rgba(13,18,17,.91);
  color:#aeb7b0;padding:6px 7px;margin:0;font:800 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  letter-spacing:.07em;cursor:pointer;min-width:0;white-space:nowrap}
#g782controls button:hover,#g782controls button:focus{border-color:#ffd76e;outline:none;color:#faf8f1}
#g782view button.active{background:#9ad6a0;color:#101514;border-color:#9ad6a0}
#g782layers button.active{background:#ffd76e;color:#101514;border-color:#ffd76e}
#g782explain{padding:4px 7px;border:1px solid rgba(154,214,160,.22);background:rgba(13,18,17,.82);
  color:#9ad6a0;font-size:8px;font-weight:800;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ws77bar{top:calc(121px + env(safe-area-inset-top))!important;opacity:.64!important}
#g78read{top:calc(143px + env(safe-area-inset-top))!important}
#g78change{display:none!important}
@media(max-width:520px){
 #g782controls{top:calc(36px + env(safe-area-inset-top));width:calc(100vw - 6px);gap:2px}
 #g782controls .row{grid-template-columns:58px 1fr;gap:2px}
 #g782controls .label{font-size:6.5px;padding:0 4px;letter-spacing:.07em}
 #g782controls .choices{gap:2px}
 #g782controls button{font-size:7px;padding:5px 2px;letter-spacing:.035em}
 #g782explain{font-size:6.7px;padding:3px 5px}
 #ws77bar{top:calc(110px + env(safe-area-inset-top))!important}
 #g78read{top:calc(131px + env(safe-area-inset-top))!important}
}
`;
document.head.appendChild(g782Style);

const g782Ctl = document.createElement('div');
g782Ctl.id = 'g782controls';
g782Ctl.innerHTML = `
  <div class="row" id="g782view"><div class="label">VIEWPOINT</div><div class="choices">
    <button type="button" data-agent="PLANE">PLANE</button>
    <button type="button" data-agent="MAIL">MAIL</button>
    <button type="button" data-agent="CITY">CITY</button>
    <button type="button" data-agent="WORLD">WORLD</button>
  </div></div>
  <div class="row" id="g782layers"><div class="label">MAP LAYERS</div><div class="choices">
    <button type="button" data-filter="CONSEQUENCE">IMPORTANT</button>
    <button type="button" data-filter="ALL">ALL SIGNALS</button>
  </div></div>
  <div id="g782explain">SELECT A VIEWPOINT · THE MAP WILL RECOMPOSE</div>`;
document.body.appendChild(g782Ctl);
const g782Explain = document.getElementById('g782explain');
const G782_HELP = {
  PLANE:'PLANE · LOCAL FIELD AROUND THE AIRCRAFT',
  MAIL:'MAIL · FULL LETTER CORRIDOR TO DESTINATION',
  CITY:'CITY · DESTINATION FIELD',
  WORLD:'WORLD · WHOLE-EARTH FIELD'
};

function g782Midpoint(a,b){
  if (!a || !b) return a || b || [0,0];
  const A=g78LLVec(a), B=g78LLVec(b);
  return lonlat(norm(slerp3(A,B,0.5)));
}
function g782SetWindowNow(lon,lat,span){
  setMapWindow(lon,lat,span);
  /* no subtle easing: selection is an explicit command */
  mapWin.lon0 = mapWinT.lon0; mapWin.lon1 = mapWinT.lon1;
  mapWin.lat0 = mapWinT.lat0; mapWin.lat1 = mapWinT.lat1;
  manualMapUntil = performance.now() + 12000;
}
function g782ApplyView(agent, announce){
  G78.agent = agent;
  const hero = planes[0];
  const planeLL = hero && hero.active && hero.geo ? lonlat(hero.geo) : (state.focusLL || g78TargetLL() || [0,0]);
  const mailLL = state.dropLL ? [state.dropLL[0],state.dropLL[1]] : planeLL;
  const destLL = g78TargetLL();

  if (agent === 'PLANE'){
    focusSubject = 'plane'; followWorld = true;
    g782SetWindowNow(planeLL[0], planeLL[1], 36);
  } else if (agent === 'MAIL'){
    focusSubject = 'mail'; followWorld = !!drop;
    if (destLL){
      const mid = g782Midpoint(mailLL,destLL);
      const dist = g78Km(mailLL,destLL);
      const span = Math.max(38, Math.min(155, dist/111*1.40));
      g782SetWindowNow(mid[0],mid[1],span);
    } else g782SetWindowNow(mailLL[0],mailLL[1],42);
  } else if (agent === 'CITY'){
    followWorld = false;
    const c = destLL || state.focusLL || planeLL;
    g782SetWindowNow(c[0],c[1],24);
  } else {
    followWorld = false;
    g782SetWindowNow(0,0,360);
  }

  G78.relationStamp=0; G78.renderSig='';
  g78Recompute();
  state.boardDirty=true;
  g782OrientWorld();
  paintMovFrame();
  g782PaintControls();
  if (announce) g782Explain.textContent = G782_HELP[agent] + ' · MAP RECENTERED';
}
function g782ApplyFilter(filter, announce){
  G78.filter = filter;
  G78.relationStamp=0; G78.renderSig='';
  g78Recompute();
  state.boardDirty=true;
  paintMovFrame();
  g782PaintControls();
  if (announce) g782Explain.textContent = filter === 'ALL'
    ? 'ALL SIGNALS · RAW EARTHQUAKES + LIVE AIRCRAFT + DERIVED RELATIONS'
    : 'IMPORTANT · RAW FIELD HIDDEN · ONLY CONSEQUENTIAL RELATIONS';
}
function g782PaintControls(){
  g782Ctl.querySelectorAll('[data-agent]').forEach(function(b){
    const on=b.dataset.agent===G78.agent; b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
  g782Ctl.querySelectorAll('[data-filter]').forEach(function(b){
    const on=b.dataset.filter===G78.filter; b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
}
g782Ctl.querySelectorAll('[data-agent]').forEach(function(b){ b.addEventListener('click',function(){g782ApplyView(b.dataset.agent,true);}); });
g782Ctl.querySelectorAll('[data-filter]').forEach(function(b){ b.addEventListener('click',function(){g782ApplyFilter(b.dataset.filter,true);}); });
g782PaintControls();

/* orient the 3D world to the selected subject so VIEWPOINT changes the sculpture too */
function g782OrientWorld(){
  if (G78.agent === 'WORLD'){
    worldGroup.quaternion.slerp(new THREE.Quaternion(),0.72);
    return;
  }
  const ll = G78.agent === 'CITY' ? (g78TargetLL() || g78AgentLL()) : g78AgentLL();
  if (!ll) return;
  const g = fromLonLat(ll[0],ll[1]);
  const src = new THREE.Vector3(g[0],g[2],-g[1]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(src,FRONT);
  worldGroup.quaternion.slerp(q,0.88);
}

/* make the persistent 3D focus mark large enough to read as a selected subject */
if (typeof g781Focus !== 'undefined') g781Focus.scale.setScalar(2.35);

function g782DrawTri(ctx,x,y,ang,r,fill,stroke){
  ctx.save();ctx.translate(x,y);ctx.rotate(ang||0);ctx.beginPath();
  ctx.moveTo(r,0);ctx.lineTo(-r*.72,-r*.58);ctx.lineTo(-r*.35,0);ctx.lineTo(-r*.72,r*.58);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
}
function g782DrawLens(){
  const W=660,H=330;
  mg.save();
  /* viewpoint border: the whole map advertises the selected interpretive frame */
  mg.strokeStyle='#9ad6a0';mg.lineWidth=4;mg.globalAlpha=.9;mg.strokeRect(2,2,W-4,H-4);
  mg.globalAlpha=1;

  const ll=g78AgentLL();
  const dest=g78TargetLL();
  if (G78.agent==='PLANE' && ll && g78MapVisible(ll)){
    const q=g78MapProject(ll[0],ll[1]);
    mg.strokeStyle='#9ad6a0';mg.lineWidth=3;mg.beginPath();mg.arc(q[0],q[1],18,0,Math.PI*2);mg.stroke();
    mg.fillStyle='#9ad6a0';mg.font='800 12px ui-monospace,monospace';mg.fillText('PLANE · LOCAL FIELD',q[0]+23,q[1]+4);
  } else if (G78.agent==='MAIL'){
    if (ll && dest){
      g78DrawMapArc(mg,ll,dest,'#faf8f1',.86,[8,5]);
      const mid=g782Midpoint(ll,dest); if(g78MapVisible(mid)){
        const q=g78MapProject(mid[0],mid[1]);
        mg.fillStyle='rgba(13,18,17,.92)';mg.fillRect(q[0]-76,q[1]-10,152,20);
        mg.fillStyle='#faf8f1';mg.font='800 11px ui-monospace,monospace';mg.textAlign='center';mg.fillText('MAIL CORRIDOR',q[0],q[1]+4);mg.textAlign='left';
      }
    }
  } else if (G78.agent==='CITY' && dest && g78MapVisible(dest)){
    const q=g78MapProject(dest[0],dest[1]);
    mg.strokeStyle='#ffd76e';mg.lineWidth=3;
    [14,25,38].forEach(function(r){mg.globalAlpha=1-r/60;mg.beginPath();mg.arc(q[0],q[1],r,0,Math.PI*2);mg.stroke();});
    mg.globalAlpha=1;mg.fillStyle='#ffd76e';mg.font='800 12px ui-monospace,monospace';mg.fillText('CITY · DESTINATION FIELD',q[0]+44,q[1]+4);
  } else if (G78.agent==='WORLD'){
    mg.fillStyle='rgba(13,18,17,.78)';mg.fillRect(10,H-31,190,21);
    mg.fillStyle='#9ad6a0';mg.font='800 11px ui-monospace,monospace';mg.fillText('WORLD · WHOLE EARTH',17,H-17);
  }

  /* make the two layer regimes unmistakable */
  if (G78.filter==='CONSEQUENCE'){
    mg.fillStyle='rgba(13,18,17,.78)';mg.fillRect(W-226,H-31,216,21);
    mg.fillStyle='#ffd76e';mg.font='800 10px ui-monospace,monospace';mg.fillText('IMPORTANT · RAW FIELD OFF',W-218,H-17);
  } else {
    const ev=WS77&&Array.isArray(WS77.earth.events)?WS77.earth.events:[];
    let shownE=0;
    for(let i=0;i<ev.length;i++){
      const e=ev[i],p=[e.lon,e.lat]; if(!g78MapVisible(p))continue;
      const q=g78MapProject(p[0],p[1]); const r=4+Math.max(0,e.mag-2.5)*1.2;
      mg.strokeStyle=e.mag>=5?'#ffd76e':'#e06a48';mg.lineWidth=2;mg.globalAlpha=.92;
      mg.beginPath();mg.arc(q[0],q[1],r,0,Math.PI*2);mg.stroke();shownE++;
    }
    let shownA=0;
    if(typeof trafficList!=='undefined'){
      for(let i=0;i<trafficList.length && shownA<18;i++){
        const tr=trafficList[i],p=[tr.lon,tr.lat]; if(!Number.isFinite(tr.lon)||!Number.isFinite(tr.lat)||!g78MapVisible(p))continue;
        const q=g78MapProject(p[0],p[1]); g782DrawTri(mg,q[0],q[1],((Number(tr.heading)||0)-90)*G78_RAD,5,'#faf8f1','#ffd76e'); shownA++;
      }
    }
    mg.globalAlpha=1;mg.fillStyle='rgba(13,18,17,.86)';mg.fillRect(W-250,H-31,240,21);
    mg.fillStyle='#ffd76e';mg.font='800 10px ui-monospace,monospace';mg.fillText('ALL SIGNALS · EARTH '+shownE+' · SKY '+shownA,W-242,H-17);
  }
  mg.restore();
}

/* add the perceptual regime after every existing map pass */
const g782PaintMovBase=paintMovFrame;
paintMovFrame=function(){ g782PaintMovBase(); g782DrawLens(); movTex.needsUpdate=true; };

/* 3D raw observations obey the same layer switch, and viewpoint selection re-orients world */
const g782WindBase=g78UpdateWindVector;
g78UpdateWindVector=function(){
  const r=g782WindBase();
  if(typeof g78EarthGroup!=='undefined') g78EarthGroup.visible=(G78.filter==='ALL' && morphT<0.18);
  return r;
};

/* direct keyboard choices mirror the visible controls */
window.addEventListener('keydown',function(e){
  const k=e.key.toLowerCase();
  if(k==='1')g782ApplyView('PLANE',true);
  else if(k==='2')g782ApplyView('MAIL',true);
  else if(k==='3')g782ApplyView('CITY',true);
  else if(k==='4')g782ApplyView('WORLD',true);
  else if(k==='i')g782ApplyFilter('CONSEQUENCE',true);
  else if(k==='a')g782ApplyFilter('ALL',true);
});

g782Explain.textContent=G782_HELP[G78.agent]+' · '+(G78.filter==='ALL'?'RAW SIGNALS VISIBLE':'RAW SIGNALS HIDDEN');
setTimeout(function(){g782ApplyView(G78.agent,false);g782ApplyFilter(G78.filter,false);},500);
'''
needle = '\n</script>\n</body>'
pos = s.rfind(needle)
if pos < 0:
    raise SystemExit('closing script not found')
s = s[:pos] + insert + s[pos:]
p.write_text(s, encoding='utf-8')
print('patched', p, 'bytes', len(s))
