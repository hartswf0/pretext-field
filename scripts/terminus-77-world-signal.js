/* =====================================================================
   TERMINUS ONE · 77 · WORLD SIGNAL FIELD
   76 remains the chassis. 77 lets public world signals push back on it.

   object  · SKY   · the existing OpenSky trafficList
   field   · WIND  · Open-Meteo current conditions at the hero plane
   event   · EARTH · USGS M2.5+ events in the past day

   Network failure is non-fatal and is never replaced with invented live
   data. New effects are bounded and the original flight model remains the
   authority underneath the signal perturbation.
   ===================================================================== */
const WS77_RAD = Math.PI / 180;
const WS77 = {
  weather: {
    state: 'acquiring', updated: 0, speed: 0, direction: 0, gust: 0,
    cloud: 0, precipitation: 0, lat: null, lon: null, error: ''
  },
  earth: { state: 'acquiring', updated: 0, events: [], error: '' },
  sky: { state: 'acquiring', updated: 0, count: 0 },
  force: { crosswind: 0, turnBias: 0 },
  source: {
    weather: 'OPEN-METEO',
    earth: 'USGS',
    sky: 'OPENSKY'
  }
};
window.TERMINUS_WORLD_SIGNAL = WS77;

/* one persistent, labeled readout; no new menu and no unlabeled iconography */
const ws77Style = document.createElement('style');
ws77Style.textContent = `
#ws77bar{position:absolute;left:50%;top:calc(48px + env(safe-area-inset-top));
  transform:translateX(-50%);z-index:14;display:flex;align-items:center;
  max-width:calc(100vw - 20px);overflow:hidden;pointer-events:none;
  border:1px solid rgba(241,238,228,.22);background:rgba(13,18,17,.78);
  color:#aeb7b0;font:700 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  letter-spacing:.10em;white-space:nowrap;backdrop-filter:blur(3px)}
#ws77bar span{display:block;padding:5px 7px;border-right:1px solid rgba(241,238,228,.14)}
#ws77bar span:last-child{border-right:0}
#ws77bar .live{color:#ffd76e}
#ws77bar .down{color:#a8462a}
@media(max-width:520px){#ws77bar{top:calc(45px + env(safe-area-inset-top));font-size:8px;letter-spacing:.06em}
  #ws77bar span{padding:4px 5px}}
`;
document.head.appendChild(ws77Style);
const ws77Bar = document.createElement('div');
ws77Bar.id = 'ws77bar';
ws77Bar.setAttribute('role', 'status');
ws77Bar.setAttribute('aria-label', 'WORLD SIGNAL STATUS');
ws77Bar.innerHTML = '<span id="ws77wind">WIND · ACQUIRING</span>' +
  '<span id="ws77earth">EARTH · ACQUIRING</span>' +
  '<span id="ws77sky">SKY · ACQUIRING</span>';
document.body.appendChild(ws77Bar);
const ws77WindEl = document.getElementById('ws77wind');
const ws77EarthEl = document.getElementById('ws77earth');
const ws77SkyEl = document.getElementById('ws77sky');

function ws77Set(el, text, status){
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('live', status === 'live');
  el.classList.toggle('down', status === 'unavailable');
}
function ws77WrapPi(v){
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}
function ws77CurrentLL(){
  const hero = planes[0];
  if (hero && hero.active && hero.geo) return lonlat(hero.geo);
  if (state.focusLL && state.focusLL.length >= 2) return [state.focusLL[0], state.focusLL[1]];
  return [-84.388, 33.749];
}
async function ws77FetchJSON(url, timeoutMs){
  const ctl = new AbortController();
  const timer = setTimeout(function(){ ctl.abort(); }, timeoutMs || 8000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* WEATHER · sampled at the position the instrument is actually attending to */
let ws77WeatherBusy = false;
async function ws77RefreshWeather(){
  if (ws77WeatherBusy) return;
  ws77WeatherBusy = true;
  const ll = ws77CurrentLL();
  const lon = Number(ll[0]), lat = Number(ll[1]);
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(3) +
    '&longitude=' + lon.toFixed(3) +
    '&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation' +
    '&wind_speed_unit=ms&timezone=UTC';
  try {
    const j = await ws77FetchJSON(url, 9000);
    if (!j || !j.current) throw new Error('NO CURRENT FIELD');
    const c = j.current;
    const w = WS77.weather;
    w.state = 'live';
    w.updated = Date.now();
    w.speed = Number(c.wind_speed_10m) || 0;
    w.direction = Number(c.wind_direction_10m) || 0;
    w.gust = Number(c.wind_gusts_10m) || w.speed;
    w.cloud = Number(c.cloud_cover) || 0;
    w.precipitation = Number(c.precipitation) || 0;
    w.lat = lat; w.lon = lon; w.error = '';
    ws77Set(ws77WindEl,
      'WIND · ' + String(Math.round(w.direction)).padStart(3, '0') + '° · ' +
      w.speed.toFixed(1) + 'M/S', 'live');
    boardLine('WIND · OPEN-METEO · ' + w.speed.toFixed(1) + 'M/S · ' +
      String(Math.round(w.direction)).padStart(3, '0') + '°');
  } catch (err) {
    const w = WS77.weather;
    w.state = 'unavailable'; w.error = String(err && err.message || err);
    ws77Set(ws77WindEl, 'WIND · UNAVAILABLE', 'unavailable');
  } finally {
    ws77WeatherBusy = false;
  }
}

/* EARTH · recent M2.5+ events become small pulses on the spherical world */
const ws77EarthGroup = new THREE.Group();
ws77EarthGroup.name = 'WORLD SIGNAL · EARTH · USGS';
worldGroup.add(ws77EarthGroup);
const ws77Normal = new THREE.Vector3(0, 0, 1);
function ws77ClearEarth(){
  while (ws77EarthGroup.children.length){
    const o = ws77EarthGroup.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
}
function ws77BuildEarth(events){
  ws77ClearEarth();
  for (let i = 0; i < events.length; i++){
    const e = events[i];
    const gv = v3(fromLonLat(e.lon, e.lat)).normalize();
    const size = 0.010 + Math.min(0.016, Math.max(0, e.mag - 2.5) * 0.004);
    const mat = new THREE.MeshBasicMaterial({
      color: e.mag >= 5 ? 0xffd76e : 0xa8462a,
      transparent: true, opacity: 0.62, side: THREE.DoubleSide,
      depthWrite: false, depthTest: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(size, size * 1.42, 24), mat);
    ring.position.copy(gv).multiplyScalar(1.018);
    ring.quaternion.setFromUnitVectors(ws77Normal, gv);
    ring.userData.ws77 = { mag:e.mag, time:e.time, phase:i * 0.73, place:e.place };
    ring.renderOrder = 20;
    ws77EarthGroup.add(ring);
  }
}
let ws77EarthBusy = false;
async function ws77RefreshEarth(){
  if (ws77EarthBusy) return;
  ws77EarthBusy = true;
  try {
    const j = await ws77FetchJSON(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', 9000);
    const fs = j && Array.isArray(j.features) ? j.features : [];
    const events = fs.map(function(f){
      const c = f && f.geometry && f.geometry.coordinates || [];
      const p = f && f.properties || {};
      return { id:f.id || '', lon:Number(c[0]), lat:Number(c[1]), depth:Number(c[2]) || 0,
        mag:Number(p.mag) || 0, time:Number(p.time) || 0, place:String(p.place || 'UNNAMED') };
    }).filter(function(e){ return Number.isFinite(e.lon) && Number.isFinite(e.lat); })
      .sort(function(a,b){ return (b.mag - a.mag) || (b.time - a.time); })
      .slice(0, 18);
    WS77.earth.state = 'live'; WS77.earth.updated = Date.now();
    WS77.earth.events = events; WS77.earth.error = '';
    ws77BuildEarth(events);
    const maxMag = events.length ? Math.max.apply(null, events.map(function(e){ return e.mag; })) : 0;
    ws77Set(ws77EarthEl,
      'EARTH · ' + events.length + (events.length ? ' · M' + maxMag.toFixed(1) : ''), 'live');
    boardLine('EARTH · USGS · ' + events.length + ' M2.5+ / 24H');
  } catch (err) {
    WS77.earth.state = 'unavailable';
    WS77.earth.error = String(err && err.message || err);
    ws77Set(ws77EarthEl, 'EARTH · UNAVAILABLE', 'unavailable');
    ws77ClearEarth();
  } finally {
    ws77EarthBusy = false;
  }
}

/* WIND FORCE · 76 remains authoritative; 77 adds only a bounded crosswind bias */
const ws77Step76 = stepGeodesic;
stepGeodesic = function(p, turn, dt){
  if (p === planes[0] && WS77.weather.state === 'live' && p && p.geo){
    const w = WS77.weather;
    const windTo = (w.direction + 180) * WS77_RAD;
    const relative = ws77WrapPi(windTo - (p.hdg || 0));
    const cross = Math.sin(relative) * w.speed;
    const gust = Math.max(w.speed, w.gust || 0);
    const authority = 0.08 + Math.min(0.10, gust / 180);
    const bias = THREE.MathUtils.clamp(cross / 18, -1, 1) * authority;
    WS77.force.crosswind = cross;
    WS77.force.turnBias = bias;
    turn += bias;
  } else {
    WS77.force.crosswind *= 0.96;
    WS77.force.turnBias *= 0.96;
  }
  return ws77Step76(p, turn, dt);
};

/* WORLD RESPONSE · cloud cover changes the light; quake rings breathe with age/magnitude */
function ws77Frame(now){
  const w = WS77.weather;
  if (w.state === 'live'){
    const cloud01 = THREE.MathUtils.clamp(w.cloud / 100, 0, 1);
    const hemiTarget = 0.60 - cloud01 * 0.16;
    const keyTarget = 0.90 - cloud01 * 0.22;
    hemi.intensity += (hemiTarget - hemi.intensity) * 0.012;
    keyL.intensity += (keyTarget - keyL.intensity) * 0.012;
  }
  ws77EarthGroup.visible = morphT < 0.18;
  const t = now * 0.001;
  for (let i = 0; i < ws77EarthGroup.children.length; i++){
    const ring = ws77EarthGroup.children[i];
    const d = ring.userData.ws77;
    const ageH = Math.max(0, (Date.now() - d.time) / 3600000);
    const life = Math.max(0.15, 1 - ageH / 30);
    const wave = 0.5 + 0.5 * Math.sin(t * (1.35 + d.mag * 0.08) + d.phase);
    const s = 1 + wave * (0.45 + Math.min(0.9, d.mag * 0.10));
    ring.scale.setScalar(s);
    ring.material.opacity = (0.20 + wave * 0.42) * life;
  }
  if (typeof trafficList !== 'undefined'){
    const n = trafficList.length;
    WS77.sky.count = n;
    WS77.sky.updated = Date.now();
    WS77.sky.state = n ? 'live' : 'unavailable';
    ws77Set(ws77SkyEl, n ? ('SKY · ' + n + ' LIVE') : 'SKY · NO SIGNAL', n ? 'live' : 'unavailable');
  }
  requestAnimationFrame(ws77Frame);
}

setTimeout(function(){ ws77RefreshWeather(); ws77RefreshEarth(); }, 1200);
setInterval(ws77RefreshWeather, 60000);
setInterval(ws77RefreshEarth, 300000);
requestAnimationFrame(ws77Frame);
