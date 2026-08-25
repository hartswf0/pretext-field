from pathlib import Path
import re

p = Path('terminus-one-78.html')
s = p.read_text(encoding='utf-8')
original = s

# 1. HTML metadata: HTML does not interpret JS-style unicode escapes.
s = s.replace(
    '<title>TERMINUS ONE 78 \\u00b7 consequential relations</title>',
    '<title>TERMINUS ONE 78 · consequential relations</title>',
    1,
)
if '<meta name="mobile-web-app-capable" content="yes">' not in s:
    marker = '<meta name="apple-mobile-web-app-capable" content="yes">'
    assert marker in s
    s = s.replace(marker, '<meta name="mobile-web-app-capable" content="yes">\n' + marker, 1)

# 2. The old camera reticle is visually ambiguous beside Geonosis. Retire it in 78.
reticle_re = re.compile(r"function updateReticle\(\)\{.*?\n\}\nfunction updateGhost", re.S)
assert reticle_re.search(s)
s = reticle_re.sub(
    "function updateReticle(){\n  reticle.visible = false;\n}\nfunction updateGhost",
    s,
    count=1,
)

# 3. Replace browser-hostile global OpenSky request with a small authenticated
#    same-purpose Edge Function. The function itself queries ADSB.lol around the
#    plane (250nm) and returns a normalized max-120 record response.
traffic_re = re.compile(r"function tryLiveTraffic\(\)\{.*?\n\}\n/\* DESTINATIONS", re.S)
assert traffic_re.search(s)
traffic = r'''const TERMINUS_SKY_PROXY = 'https://lcxykqgddnekrimawpie.supabase.co/functions/v1/terminus-sky';
const TERMINUS_SKY_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeHlrcWdkZG5la3JpbWF3cGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODYzMjQsImV4cCI6MjEwMjE2MjMyNH0.niM6yUmQ00pqavAvlJcXRwAPDpYnuZjQ1g4cuSlexdI';
let trafficBusy = false;
function tryLiveTraffic(){
  if (LOCAL_FILE){
    if (liveFails === 0){
      liveFails = 1;
      boardLine('TRAFFIC · NO LIVE FEED · SERVE OVER HTTPS');
      state.trafficMode = 'NO SIGNAL';
    }
    return;
  }
  if (trafficBusy) return;
  trafficBusy = true;
  const ll = (typeof ws77CurrentLL === 'function') ? ws77CurrentLL()
    : (planes[0] && planes[0].active ? planeLonLat(planes[0]) : [-84.388, 33.749]);
  const url = TERMINUS_SKY_PROXY + '?lat=' + Number(ll[1]).toFixed(3) +
    '&lon=' + Number(ll[0]).toFixed(3);
  fetch(url, {
    cache:'no-store',
    headers:{
      'apikey': TERMINUS_SKY_ANON,
      'Authorization': 'Bearer ' + TERMINUS_SKY_ANON
    }
  })
    .then(function(res){ if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(function(j){
      const ac = j && Array.isArray(j.aircraft) ? j.aircraft : [];
      trafficList.length = 0;
      for (let i = 0; i < ac.length && trafficList.length < TRAFFIC_MAX; i++){
        const a = ac[i];
        const lon = Number(a.lon), lat = Number(a.lat), track = Number(a.track);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        trafficList.push({
          lon:lon, lat:lat,
          hd:(Number.isFinite(track) ? track - 90 : 0) * D2R,
          flight:String(a.flight || ''), hex:String(a.hex || ''),
          gs:Number(a.gs) || 0, alt:Number(a.alt) || 0
        });
      }
      liveFails = 0;
      state.trafficMode = trafficList.length ? 'LIVE ADSB.LOL' : 'LIVE · CLEAR';
      if (typeof WS77 !== 'undefined'){
        WS77.source.sky = 'ADSB.LOL';
        WS77.sky.state = 'live';
        WS77.sky.count = trafficList.length;
        WS77.sky.updated = Date.now();
      }
      boardLine('TRAFFIC · ADSB.LOL · ' + trafficList.length + ' LOCAL');
    })
    .catch(function(){
      liveFails++;
      state.trafficMode = 'NO SIGNAL';
      if (typeof WS77 !== 'undefined') WS77.sky.state = 'unavailable';
      if (liveFails === 1) boardLine('TRAFFIC · LIVE SOURCE UNAVAILABLE');
    })
    .finally(function(){ trafficBusy = false; });
}
/* DESTINATIONS'''
s = traffic_re.sub(lambda m: traffic, s, count=1)

# Live data must not be cleared by the zero-count simulation pass.
old = "if (state.trafficMode !== 'LIVE ADS-B') tickSimTraffic(performance.now()/1000);"
assert old in s
s = s.replace(old, "if (!String(state.trafficMode || '').startsWith('LIVE')) tickSimTraffic(performance.now()/1000);", 1)

# Source/provenance labels follow the actual adapter.
s = s.replace("sky: 'OPENSKY'", "sky: 'ADSB.LOL'", 1)
s = s.replace("provenance:'OPENSKY + DERIVED DISTANCE'", "provenance:'ADSB.LOL + DERIVED DISTANCE'", 1)
s = s.replace("object  · SKY   · the existing OpenSky trafficList", "object  · SKY   · local ADSB.lol traffic via browser-safe adapter", 1)

# 4. Three animation clocks were competing. The renderer owns 60 Hz; signal and
#    semiosis work are data clocks at 4 Hz. Keep the one initial RAF kick only.
old_ws = "  requestAnimationFrame(ws77Frame);\n}\n\nsetTimeout(function(){ ws77RefreshWeather(); ws77RefreshEarth(); }, 1200);"
assert old_ws in s
s = s.replace(
    old_ws,
    "  setTimeout(function(){ requestAnimationFrame(ws77Frame); }, 250);\n}\n\nsetTimeout(function(){ ws77RefreshWeather(); ws77RefreshEarth(); }, 1200);",
    1,
)
old_g78 = "  requestAnimationFrame(g78Frame);\n}\n\nboardLine('GEONOSIS · 78 · CONSEQUENCE FILTER ONLINE');"
assert old_g78 in s
s = s.replace(
    old_g78,
    "  setTimeout(function(){ requestAnimationFrame(g78Frame); }, 250);\n}\n\nboardLine('GEONOSIS · 78 · CONSEQUENCE FILTER ONLINE');",
    1,
)

# 5. Geonosis should be steady, not twitch at telemetry cadence.
s = s.replace("if (now - G78.relationStamp < 900) return;", "if (now - G78.relationStamp < 1800) return;", 1)
s = s.replace("G78.filter === 'CONSEQUENCE' ? 8 : 14", "G78.filter === 'CONSEQUENCE' ? 5 : 10")

# Rebuild GPU geometry only when the rounded relation graph actually changes.
geom_old = "  g78BuildRelationGeometry();\n  g78PaintReadout(agentLL);"
assert geom_old in s
geom_new = r'''  const renderSig = G78.agent + '|' + G78.filter + '|' + G78.relations.map(function(r){
    function q(ll){ return ll ? (Number(ll[0]).toFixed(1) + ',' + Number(ll[1]).toFixed(1)) : '-'; }
    return r.kind + ':' + r.text + ':' + q(r.from) + '>' + q(r.to);
  }).join('|');
  if (renderSig !== G78.renderSig){
    G78.renderSig = renderSig;
    g78BuildRelationGeometry();
  }
  g78PaintReadout(agentLL);'''
s = s.replace(geom_old, geom_new, 1)

# 6. Do not print legacy source name anywhere after the migration.
assert 'opensky-network.org/api/states/all' not in s
assert "provenance:'OPENSKY + DERIVED DISTANCE'" not in s
assert 'TERMINUS ONE 78 · consequential relations' in s
assert 'mobile-web-app-capable' in s
assert 'TERMINUS_SKY_PROXY' in s
assert 'reticle.visible = false' in s
assert 'setTimeout(function(){ requestAnimationFrame(ws77Frame); }, 250);' in s
assert 'setTimeout(function(){ requestAnimationFrame(g78Frame); }, 250);' in s
assert s != original

p.write_text(s, encoding='utf-8')
print('stabilized bytes', len(original), '->', len(s))
