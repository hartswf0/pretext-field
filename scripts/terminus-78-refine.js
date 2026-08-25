/* =====================================================================
   TERMINUS ONE · 78 · GEONOSIS REFINEMENT
   Surface arcs, flat-map persistence, trace memory, and stricter provenance.
   ===================================================================== */
function g78ArcPoints(aLL, bLL, steps, radius){
  const A = g78LLVec(aLL), B = g78LLVec(bLL), pts = [];
  const n = steps || 18, r = radius || 1.033;
  for (let i = 0; i <= n; i++){
    const g = norm(slerp3(A, B, i/n));
    pts.push(v3(g).normalize().multiplyScalar(r));
  }
  return pts;
}

/* relations belong to the surface; straight chords falsely imply a different geometry */
g78BuildRelationGeometry = function(){
  g78DisposeGroup(g78RelationGroup);
  const rels = G78.relations.slice(0, G78.filter === 'CONSEQUENCE' ? 8 : 14);
  for (let i = 0; i < rels.length; i++){
    const r = rels[i];
    if (r.kind === 'EVENT') continue;
    const arc = g78ArcPoints(r.from, r.to, 16, 1.034);
    const geom = new THREE.BufferGeometry().setFromPoints(arc);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
      color:g78RelationColor(r.kind, r.score), transparent:true,
      opacity:0.28 + Math.min(0.58, r.score * 0.36), depthWrite:false, depthTest:false
    }));
    line.userData.g78 = r;
    line.renderOrder = 23;
    g78RelationGroup.add(line);

    const b = arc[arc.length-1];
    const end = new THREE.Mesh(
      new THREE.RingGeometry(0.004, 0.0065, 4),
      new THREE.MeshBasicMaterial({ color:g78RelationColor(r.kind, r.score), transparent:true,
        opacity:0.82, side:THREE.DoubleSide, depthWrite:false, depthTest:false })
    );
    end.position.copy(b);
    end.quaternion.setFromUnitVectors(g78Normal, b.clone().normalize());
    end.renderOrder = 24;
    g78RelationGroup.add(end);
  }
};

/* session memory follows the same spherical syntax */
g78RebuildTrace = function(){
  g78DisposeGroup(g78TraceGroup);
  for (let i = 0; i < G78.traces.length; i++){
    const tr = G78.traces[i];
    const p = g78ThreeLL(tr.ll, 1.036);
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

    if (i > 0){
      const arc = g78ArcPoints(G78.traces[i-1].ll, tr.ll, 8, 1.035);
      const ln = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arc),
        new THREE.LineBasicMaterial({ color:0xfaf8f1, transparent:true, opacity:0.20,
          depthWrite:false, depthTest:false })
      );
      ln.renderOrder = 22;
      g78TraceGroup.add(ln);
    }
  }
};

/* 77's weather sample follows the plane. Do not silently relocate it to CITY/WORLD. */
g78WindComposition = function(agentLL){
  if (!WS77 || WS77.weather.state !== 'live') return;
  if (G78.agent !== 'PLANE' && G78.agent !== 'MAIL') return;
  const xw = Math.abs(Number(WS77.force.crosswind) || 0);
  const score = Math.min(1.35, xw / 8.0);
  if (xw >= 1.5 || G78.filter === 'ALL'){
    G78.compositions.push({ score:score, key:'WIND:' + Math.round(xw*10),
      text:'WIND × ' + G78.agent + ' → CROSSWIND ' + xw.toFixed(1) + 'M/S',
      provenance:'OPEN-METEO AT PLANE + DERIVED VECTOR' });
  }
};
const g78UpdateWindVectorBase = g78UpdateWindVector;
g78UpdateWindVector = function(){
  if (G78.agent === 'CITY' || G78.agent === 'WORLD'){
    g78WindArrow.visible = false;
    return;
  }
  return g78UpdateWindVectorBase();
};

/* ---------- the relation graph survives UNFOLD onto the board ---------- */
function g78MapProject(lon, lat){
  const MW = 660, MH = 330;
  const dLon = mapWin.lon1 - mapWin.lon0, dLat = mapWin.lat1 - mapWin.lat0;
  const sc = Math.min(MW/dLon, MH/dLat);
  const ox = (MW - dLon*sc)/2, oy = (MH - dLat*sc)/2;
  return [ox + (lon - mapWin.lon0)*sc, oy + (mapWin.lat1 - lat)*sc];
}
function g78MapVisible(ll){
  return ll && ll[0] >= mapWin.lon0 && ll[0] <= mapWin.lon1 &&
    ll[1] >= mapWin.lat0 && ll[1] <= mapWin.lat1;
}
function g78DrawMapArc(g, aLL, bLL, col, alpha, dash){
  const A = g78LLVec(aLL), B = g78LLVec(bLL);
  g.save();
  g.strokeStyle = col;
  g.globalAlpha = alpha;
  g.lineWidth = 1.5;
  if (dash) g.setLineDash(dash);
  g.beginPath();
  let prevLL = null, pen = false;
  for (let i = 0; i <= 24; i++){
    const ll = lonlat(norm(slerp3(A, B, i/24)));
    const q = g78MapProject(ll[0], ll[1]);
    const breakLine = prevLL && Math.abs(ll[0] - prevLL[0]) > 180;
    if (!pen || breakLine){ g.moveTo(q[0], q[1]); pen = true; }
    else g.lineTo(q[0], q[1]);
    prevLL = ll;
  }
  g.stroke();
  g.restore();
}
function g78DrawMapRelations(){
  const ev = WS77 && Array.isArray(WS77.earth.events) ? WS77.earth.events : [];

  /* observation points: no false impact radii */
  for (let i = 0; i < ev.length; i++){
    const e = ev[i], ll = [e.lon, e.lat];
    if (!g78MapVisible(ll)) continue;
    const q = g78MapProject(ll[0], ll[1]);
    mg.fillStyle = e.mag >= 5 ? '#ffd76e' : '#e06a48';
    mg.globalAlpha = 0.85;
    mg.beginPath();
    mg.arc(q[0], q[1], 2.0 + Math.max(0, e.mag-2.5)*0.65, 0, 6.2832);
    mg.fill();
    mg.globalAlpha = 1;
  }

  /* derived consequential relations */
  for (let i = 0; i < G78.relations.length; i++){
    const r = G78.relations[i];
    if (r.kind === 'EVENT') continue;
    const col = r.kind === 'RELINK' ? '#9ad6a0' : (r.score >= 1 ? '#e06a48' : '#ffd76e');
    g78DrawMapArc(mg, r.from, r.to, col, 0.34 + Math.min(0.42, r.score*0.25),
      r.kind === 'RELINK' ? [5,4] : null);
    if (g78MapVisible(r.to)){
      const q = g78MapProject(r.to[0], r.to[1]);
      mg.save(); mg.translate(q[0], q[1]); mg.rotate(Math.PI/4);
      mg.strokeStyle = col; mg.globalAlpha = 0.88; mg.lineWidth = 1.3;
      mg.strokeRect(-3, -3, 6, 6); mg.restore();
    }
  }

  /* trace: where this session actually crossed a consequential relation */
  for (let i = 0; i < G78.traces.length; i++){
    const tr = G78.traces[i];
    if (!g78MapVisible(tr.ll)) continue;
    const q = g78MapProject(tr.ll[0], tr.ll[1]);
    mg.save(); mg.translate(q[0], q[1]); mg.rotate(Math.PI/4);
    mg.strokeStyle = '#faf8f1'; mg.globalAlpha = 0.70; mg.lineWidth = 1;
    mg.strokeRect(-2.5, -2.5, 5, 5); mg.restore();
  }

  mg.fillStyle = '#9ad6a0';
  mg.font = '700 10px ui-monospace,monospace';
  mg.fillText('GEONOSIS · ' + G78.agent + ' · ' + G78.relations.length + ' REL', 8, 14);
  mg.globalAlpha = 1;
}
const g78PaintMov77 = paintMovFrame;
paintMovFrame = function(){
  g78PaintMov77();
  g78DrawMapRelations();
  movTex.needsUpdate = true;
};

/* mobile keeps all source labels; the derived counter yields first */
const g78RefineStyle = document.createElement('style');
g78RefineStyle.textContent = `
@media(max-width:520px){
  #g78count{display:none!important}
  #ws77bar{max-width:calc(100vw - 8px)!important;font-size:7px!important;letter-spacing:.035em!important}
  #ws77bar span{padding:3px 4px!important}
}
`;
document.head.appendChild(g78RefineStyle);
