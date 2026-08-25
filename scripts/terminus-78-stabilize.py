from pathlib import Path

p = Path('terminus-one-78.html')
s = p.read_text(encoding='utf-8')
original = s

# The edge adapter is authoritative for sky availability. Zero nearby aircraft
# means LIVE · CLEAR, not a dead source. The 4 Hz display loop only mirrors it.
old = """  if (typeof trafficList !== 'undefined'){
    const n = trafficList.length;
    WS77.sky.count = n;
    WS77.sky.updated = Date.now();
    WS77.sky.state = n ? 'live' : 'unavailable';
    ws77Set(ws77SkyEl, n ? ('SKY · ' + n + ' LIVE') : 'SKY · NO SIGNAL', n ? 'live' : 'unavailable');
  }
"""
assert old in s
new = """  if (typeof trafficList !== 'undefined'){
    const n = trafficList.length;
    WS77.sky.count = n;
    const liveSky = WS77.sky.state === 'live';
    ws77Set(ws77SkyEl,
      liveSky ? (n ? ('SKY · ' + n + ' LOCAL') : 'SKY · LIVE · CLEAR') : 'SKY · NO SIGNAL',
      liveSky ? 'live' : 'unavailable');
  }
"""
s = s.replace(old, new, 1)

# Finish provenance migration in the Geonosis state object.
s = s.replace("provenance: { earth:'USGS', wind:'OPEN-METEO', sky:'OPENSKY' }",
              "provenance: { earth:'USGS', wind:'OPEN-METEO', sky:'ADSB.LOL' }", 1)

# Clean the remaining HTML metadata escapes too. JS source strings deliberately
# keep their escapes; HTML attributes should contain actual punctuation.
s = s.replace('content="Watson Hartsoe \\u00b7 CONSEQUENCE WORKS"',
              'content="Watson Hartsoe · CONSEQUENCE WORKS"', 1)
s = s.replace('content="TERMINUS ONE \\u00b7 a departures board you can fly"',
              'content="TERMINUS ONE · a departures board you can fly"', 1)
s = s.replace('content="Scan to join from any phone \\u2014 two hands, one instrument."',
              'content="Scan to join from any phone — two hands, one instrument."', 1)

assert "sky:'OPENSKY'" not in s
assert "sky: 'OPENSKY'" not in s
assert 'opensky-network.org/api/states/all' not in s
assert 'SKY · LIVE · CLEAR' in s
assert "WS77.sky.updated = Date.now();" in s  # adapter success path, not display loop
assert s != original

p.write_text(s, encoding='utf-8')
print('finished sky-state stabilization')
