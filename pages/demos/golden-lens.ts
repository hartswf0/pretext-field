// ══════════════════════════════════════════════════════════════
// GOLDEN LENS × PRETEXT — Ported from orca-shield-18
//
// The original GOLDEN LENS isometric grid renderer with its
// scattered character field, zone coloring, relationship lines,
// and reader panel — now enhanced with Pretext:
//
//   1. READER PANEL: Pretext lays out lore text at the panel's
//      actual pixel width. No more padEnd(24) truncation.
//
//   2. COALESCENCE: Near the cursor, characters animate from
//      their scattered grid positions toward Pretext-typeset
//      positions. Text physically assembles into readable prose.
//
//   3. LIDAR MODE: First-person text raycaster from orca-shield.
//      Walls display Pretext-laid-out lore lines at close range.
//      WASD to move, SPACE to scan.
//
//   4. PARTICLES: Floating golden motes drift through the field.
// ══════════════════════════════════════════════════════════════

import {
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '../../src/layout.js'

// ═══════════════════════════════════════════════════════════
// LLM TEXT GENERATION ENGINE — Live Worldtext expansion
// Adapted from trout.html's cognitive engine.
// Press 'G' to generate new zone-specific lore from an LLM.
// Supports Ollama (local) and OpenAI-compatible endpoints.
// Generated text is appended to MOUNTAIN_LORE and re-prepared
// by Pretext, making walls expand live as you explore.
// ═══════════════════════════════════════════════════════════
let llmUrl = ''
let llmModel = ''
let llmKey = ''
let llmActive = false
let llmGenerating = false
let llmStatus = ''

const HAINT_SYSTEM = `You are the lore engine for HAINT PHYSICS — a worldtext about Southern Gothic optics, rural quantum mechanics, and Appalachian knowledge systems. Each zone is a lore-site where folk engineering meets formal physics.

VOICE RULES:
- Write in terse, concrete, material language. Name tools, materials, procedures.
- Each line should be a self-contained observation, fact, quote, or axiom.
- Use real vocabulary: apparatus terms, measurement units, historical names, archive references.
- Mix technical precision with poetic compression.
- Reference real sources when possible: Foxfire, Newton's Opticks, Signal Corps, Stephen Bishop, Spindletop.
- NEVER use: whispers, echoes, dance, weave, tapestry, shimmer, ancient wisdom, mystical.
- Output 5-8 lines, separated by newlines. Each line is one lore entry.`

async function llmGenerate(zone: string, existingSample: string): Promise<string[]> {
  if (!llmUrl || llmGenerating) return []
  llmGenerating = true
  llmStatus = 'GENERATING...'

  const zonePrompts: Record<string, string> = {
    shack: 'Generate new lore for THE SHACK: Grandpa\'s laboratory. Moonshine chemistry, vacuum tube electronics, ham radio, bootlegger mechanics, Foxfire oral tradition, amateur engineering.',
    creek: 'Generate new lore for THE CREEK: Refraction mechanics. Creek water optics, surveying instruments, Newton\'s prism experiments, mason jar lenses, Snell\'s law in nature.',
    ridge: 'Generate new lore for THE RIDGE: Reflection mechanics. Heliograph signaling, hubcap mirrors, fog optics, Signal Corps history, line-of-sight communication.',
    cave: 'Generate new lore for THE CAVE: LiDAR and darkness. Stephen Bishop at Mammoth Cave, echo navigation, pressure sensing, cave tourism, the nature of absolute dark.',
    puddle: 'Generate new lore for THE PUDDLE: Thin-film interference. Oil slick optics, Spindletop history, tractor oil chemistry, agricultural engineering, rainbow physics in mud.',
  }

  const prompt = `${zonePrompts[zone] || 'Generate new Haint Physics lore.'}\n\nHere is a sample of existing lore for this zone:\n${existingSample}\n\nGenerate 5-8 NEW, UNIQUE lines that extend this lore without repeating what exists. Each line should be a complete thought. Focus on: concrete nouns, observable actions, recoverable procedures, material vocabulary.`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (llmKey) headers['Authorization'] = `Bearer ${llmKey}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(llmUrl, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: HAINT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.85,
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    const lines = text.split('\n').map((l: string) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter((l: string) => l.length > 10)
    llmStatus = `+${lines.length} LINES`
    llmGenerating = false
    llmActive = true
    return lines
  } catch (e: any) {
    llmStatus = `ERROR: ${e.message}`
    llmGenerating = false
    return []
  }
}

function injectLore(zone: string, newLines: string[]): void {
  if (!MOUNTAIN_LORE[zone] || newLines.length === 0) return
  for (const line of newLines) {
    MOUNTAIN_LORE[zone]!.push(line)
  }
  // Rebuild LORE_FULL for this zone
  LORE_FULL[zone] = MOUNTAIN_LORE[zone]!.join(' ')
  // Clear Pretext caches so walls re-measure
  wallLineCache.clear()
}

// ── HOLLER DATA — Deep lore derived from the Haint Physics POML worldtext ──
// Each zone carries layers: world function, mythic charge, literary pairings,
// historical grounding, media bleed, axioms, epistemic conflict, sensory detail.
const MOUNTAIN_LORE: Record<string, string[]> = {
  shack: [
    // World function
    "Grandpa's Shack. Not a distillery, a lab.",
    "Old vacuum tubes humming with quantum potential.",
    "Edgar's empty dog house. No dog.",
    "A note scribbled on a napkin: 'Light bends, time breaks.'",
    "The prize-winning hound, gone into the photons.",
    "The shack is a threshold site where domestic ruin, moonshine infrastructure, and experimental physics overlap.",
    "It looks like a folk ruin but behaves like a temporal laboratory.",
    "A ruin that hums. A domestic space converted into an engine of disappearance.",
    "The shack is not haunted because it contains ghosts; it is haunted because it contains unfinished experiments.",
    // Apparatus & materials
    "Scavenged vacuum tubes from a 1940s radio set, wired in parallel across a pine workbench.",
    "Mason jars repurposed as resonance chambers. The liquor is gone. The glass still rings.",
    "A hand-drawn wiring diagram pinned to the wall beside a photo of Edgar as a pup.",
    "Copper wire wound around a bourbon bottle. The inductance is not accidental.",
    "The tubes glow amber when the temperature drops below 40°F. Nobody has turned them on.",
    // Mythic charge
    "What the city man calls a ruin, the old man calls a receiver.",
    "Time folds here. The clock on the wall reads 2:47 and has read 2:47 since 1974.",
    "There is a smell in the shack that combines old solder, moonshine vapor, and ozone.",
    "Grandpa said a photon could carry a dog across four counties if you knew the frequency.",
    "The shack breathes. Walls expand at dusk, contract at dawn. The nails pop and settle.",
    // Literary / intellectual
    "Burnt Norton: 'Time present and time past are both perhaps present in time future.'",
    "The rose-garden children Eliot heard — Grandpa heard them too, in the tube static.",
    "Ham Radio's Technical Culture: rural hobbyists building equipment that rivaled military labs.",
    "The Foxfire Book: how to build a split-rail fence, cure meat, and accidentally discover resonance.",
    // Media bleed
    "HIGH RIDGE HERALD: LOCAL SHACK FIRE REVEALS BIZARRE LABORATORY; NO MOONSHINE FOUND, JUST HUMMING TUBES.",
    "FRINGE PHYSICS ABSTRACT: Preliminary findings suggest scavenged vacuum tube assemblies may have generated localized temporal distortion.",
    "Biological subject 'Edgar' remains unaccounted for and may persist in a photonic state.",
    "Late-Night AM Broadcast: '...and if you're tuning in from the ridge, check the tubes. They're humming again tonight.'",
    // Epistemic conflict
    "The extension agent saw moonshine equipment. Grandpa saw a waveguide array.",
    "The insurance adjuster wrote 'fire damage.' Grandpa would have written 'phase transition.'",
    "Rural matter — hubcaps, mason jars, collar thumpers, tractor oil — can become scientific apparatus.",
    "Outsiders mistake operational knowledge for superstition because they do not know how to read the tools.",
    // Axioms
    "AXIOM A1: Light bends, time breaks.",
    "AXIOM A2: The local does not oppose the scientific; it houses it.",
    "AXIOM A3: Folk knowledge and formal physics are different dialects of the same encounter with reality.",
    // Sensory
    "Smell: solder flux, bourbon residue, wet pine, copper tarnish.",
    "Sound: tube hum at 60Hz, floor creak, distant AM static, wind through cracked windowpane.",
    "Touch: rough-hewn cedar shelving, warm glass, cold brass fittings.",
    "Light: amber glow from filaments, dust motes in late-afternoon shaft.",
    "The workbench holds three notebooks in Grandpa's hand. The equations get stranger after page forty.",
    // Real-text anchors: Foxfire, moonshine-to-motor, ham radio, Appalachian speech
    "FOXFIRE (1966): Student-created magazine preserving Southern Appalachian voices. Interviews with moonshiners, revenue agents, and hotrod haulers.",
    "Mountain Spirits: 'The still was not hidden because it was illegal. It was hidden because it was calibrated.'",
    "Junior Johnson ran white lightning on dirt roads at night. No headlights. He modified the engine with his own hands.",
    "NASCAR Hall of Fame: engine modification, weight handling, aerodynamics-by-trial-and-error, clandestine vehicle adaptation.",
    "The bootlegger's Ford had a reinforced chassis, a baffled fuel tank, and a transmission modified to shift under duress.",
    "Haring, Ham Radio's Technical Culture (2006): solitary tinkering, two-way radios, and technical subculture in the American shack.",
    "The radio shack is not metaphor. It is architecture. A shed, a workbench, a power supply, and a wire into the sky.",
    "Joseph S. Hall, Smoky Mountain speech: 'He run that ridge like a scalded dog.' Folktales, local history, customs, beliefs, songs.",
    "LOC Folklife Center: speech recordings, oral histories, dialect materials, folklife documentation.",
    "The still-man worked at night. He read temperature by touching the copper. He could tell proof by the bead on the surface.",
    "Appalachian State: moonshining as a long cultural practice — not crime, but craft. Not rebellion, but calibration.",
    "The worm — the copper coil submerged in cold creek water — is a condenser. It turns vapor back into liquid.",
    "Every batch was an experiment. Corn, sugar, yeast, water, heat, time. Vary one. Record what happens.",
    "The Mason jar is both container and instrument. Hold it to light. If it's clear, it's right. If it's cloudy, start again.",
    "Revenue agents never found the still Grandpa built inside the chimney. The smoke went up with the woodsmoke.",
    "The dashboard of a '40 Ford coupe: tachometer hand-wired to the distributor, oil pressure gauge from a surplus B-17.",
    "AM radio pulls in signals from 800 miles away after midnight. The ionosphere bends. The shack listens.",
    "Foxfire Book 6: hog dressing, log cabin building, bee hunting, spring lizards, wildplant foods, butter churns.",
    "The handwriting in Grandpa's third notebook shifts from English to mathematics around page forty-two.",
    "An equation involving h-bar appears next to a recipe for apple brandy. Both are precise.",
    "The vacuum tube is a controlled gate. Electrons flow through a near-vacuum. Heat is the key. Filament is the threshold.",
    "Every tube in the rack was scavenged: RCA 12AX7, GE 6L6, Sylvania 5U4. Each one tested, labeled, shelved.",
    "The antenna: 66 feet of copper wire, insulated at both ends, fed through a window. Half-wave dipole. Twenty meters.",
    "He could reach Knoxville, Memphis, sometimes Cincinnati. On a good night, the skip reached Havana.",
    "The still-man and the radio operator both work in the dark, translating invisible forces into measurable results.",
  ],
  creek: [
    // World function
    "The Bending Creek. Refraction mechanics.",
    "Mason Jar Prism: High-proof clear water.",
    "Hold it to the sun. See the ghost tracks.",
    "Light slows down in the medium.",
    "Bending the laser around the rock.",
    "Snell's Law applied to creek water.",
    "The creek is a natural optical bench. Water, liquor, glass, and sunlight collaborate to reveal tracks invisible to ordinary perception.",
    "The hound went into the photons. We just gotta bend 'em back.",
    "The creek is where invisible passage becomes legible.",
    "It is both evidence chamber and baptismal site for altered perception.",
    // Apparatus
    "A mason jar half-full of clear liquor, tilted at 42 degrees in the creek gravel.",
    "Sunlight enters the jar at the meniscus and splits into seven distinct ghost-tracks on the stone below.",
    "The refractive index of corn whiskey is 1.36 — slightly higher than water, slightly lower than glass.",
    "Each ghost-track corresponds to a different wavelength. The red one points upstream.",
    "The blue track leads to where Edgar's paw prints end in wet sand.",
    "Grandpa's trick: fill a jar to the brim, cap it, submerge half. The convex surface becomes a lens.",
    // Mythic charge
    "A baptismal creek where perception is what gets immersed and reborn.",
    "The water does not wash away evidence; it bends it into visibility.",
    "What the creek reveals is not the supernatural. It is the sub-visible.",
    "The outsider sees ripples. The local reads angular displacement.",
    // Literary
    "Emily Dickinson: 'A Light exists in Spring / Not present on the Year / At any other period.'",
    "The creek captures Dickinson's spring light — measured and sacred simultaneously.",
    "Newton's Opticks: prism experiments conducted with simple apparatus in rural settings.",
    "Newton would have recognized the mason jar. He used worse glass.",
    // Historical
    "Spirits of Just Men: clear liquor and backwoods distillation as refined material intelligence.",
    "The moonshiners were not chemists by training. They were chemists by iteration.",
    "Every batch taught them something about purity, temperature, and the behavior of light through clean liquid.",
    // Media bleed
    "HIGH RIDGE HERALD: CREEK WATER TESTS NORMAL, SAYS COUNTY LAB; OPTICAL ANOMALIES PERSIST.",
    "ACADEMIC: Observed refraction patterns in local waterways exceed predicted values for H2O at ambient temperature.",
    "AM BROADCAST: 'If you see blue tracks by the lower ford, follow them. But bring a jar.'",
    // Epistemic conflict
    "The city professor brought a spectrometer. Grandpa brought a jar of white lightning and a steady hand.",
    "They measured the same thing. Only one of them knew what it meant.",
    "Every phenomenon has two vocabularies: the haint-name and the field equation.",
    // Sensory
    "Smell: wet limestone, wild mint, trace alcohol vapor.",
    "Sound: water over gravel, kingfisher diving, jar glass ringing when tapped.",
    "Touch: cold water numbing the fingers, smooth creek stone, slippery jar surface.",
    "Light: prismatic fans on submerged rock, bending caustics, late-afternoon glare.",
    "The creek runs clearest in October. That is when the ghost-tracks are sharpest.",
    // Real-text anchors: Washington surveying, Newton's Opticks, Mount Vernon records
    "George Washington learned surveying at sixteen. His first instrument: a circumferentor — a brass compass on a Jacob's staff.",
    "Mount Vernon: 'Washington's surveying career began in 1747 when he was asked to help survey the lands of Thomas, Lord Fairfax.'",
    "The circumferentor: a sighting compass with two folding sight bars, a silvered face, a staff adapter, and a needle pin.",
    "Survey chains measured 66 feet. Each link was 7.92 inches. Four rods to a chain. Eighty chains to a mile.",
    "Washington's school copybook preserves his surveying notes: bearings, distances, timber stands, creek crossings.",
    "Newton, Opticks (1704): 'The Light which is least refrangible is most apt to be refracted by the Surfaces of the Medium.'",
    "Newton used worse glass than a mason jar. His prisms were bought from tradesmen. He wrote by candlelight.",
    "The refractive index changes with temperature. Cold creek water bends light differently than warm.",
    "LOC: Washington's survey field books describe the Virginia backcountry creek by creek, ridge by ridge.",
    "The spirit level measures what the eye cannot: perfect horizontal. Brass, glass, a captive bubble.",
    "Every surveyor's compass needle points to magnetic north, not true north. The difference is called declination.",
    "Declination varies by place and year. Washington knew the declination for Tidewater Virginia in 1748: 3 degrees west.",
    "The creek is not a boundary. It is a datum — a reference surface from which all other measurements descend.",
    "To survey a creek: wade in, set the staff, sight along the bars, read the bearing, record, advance.",
    "The Enlightenment did not happen only in Paris. It happened wherever someone measured the angle of light in water.",
  ],
  ridge: [
    // World function
    "The High Ridge. Reflection mechanics.",
    "The Rusty Hubcap. A perfect concave mirror.",
    "Polished rust focusing camp fire photons.",
    "Signal beam cutting through the haint fog.",
    "Angle of Incidence equals Angle of Reflection.",
    "The Eye of the Owl telescope.",
    "The ridge is a signaling site. What matters here is sending, focusing, and receiving.",
    "The rusted object becomes a precision mirror. Scrap becomes beam logic.",
    "Throw the light hard enough and the fog gives up its dead.",
    "The ridge is where folk haunting and beam science become indistinguishable.",
    "It is a place of line-of-sight warfare against obscurity.",
    // Apparatus
    "A 1967 Ford hubcap, chrome worn to a parabolic polish by decades of wind and rain.",
    "Focal length: 42 centimeters. Grandpa measured it with a yardstick and a candle flame.",
    "The hubcap catches a campfire from three hundred yards and throws it as a focused beam.",
    "On clear nights, the beam punches through the fog and reaches the church steeple in town.",
    "The fog does not absorb the beam. The fog scatters around it. That is information.",
    "A second hubcap, mounted on a cedar post, serves as a receiver.",
    "The signal is not electromagnetic. The signal is photonic.",
    // Mythic charge
    "Haint fog rolls in from the hollows at dusk. The locals know it is water vapor.",
    "The haints are condensation nuclei. The fog is their medium. The beam is the detector.",
    "What flickers in the fog is not a ghost. It is a reflected wavefront encountering turbulence.",
    "The ridge-folk have signaled each other with scrap mirrors since before electricity came.",
    // Literary
    "Walt Whitman: 'A noiseless patient spider, / I mark'd where on a little promontory it stood isolated.'",
    "The spider filament and the ridge beam are the same act: casting into emptiness, waiting for contact.",
    "The ridge-man is Whitman's spider, patient, casting photons into fog.",
    // Historical
    "Signs, Cures, and Witchery: Gerald Milnes documents Appalachian belief in haint lights as territorial markers.",
    "Night Comes to the Cumberlands: Caudill explains why industrial scrap defines the material culture of the ridge.",
    "The hubcap was not repurposed. It was promoted.",
    // Media bleed
    "HIGH RIDGE HERALD: MYSTERIOUS LIGHTS ON RIDGE EXPLAINED BY RETIRED PHYSICS TEACHER AS 'JUST CONCAVE MIRRORS.'",
    "HIGH RIDGE HERALD: (Editorial reply: 'If it's just mirrors, why do they only work on moonless nights?')",
    "AM BROADCAST: 'The hubcap on the high pine is still throwing. If you can see the flash, flash back.'",
    "ACADEMIC: Preliminary measurements of improvised parabolic reflectors in rural WV show focal precision within ±3mm.",
    // Epistemic conflict
    "The paranormal investigator brought an EMF detector. The ridge-man brought a hubcap and a lighter.",
    "Both were looking for the same thing: something that moves through fog.",
    "The investigator saw a haunting. The ridge-man saw physics with a personality.",
    // Sensory
    "Smell: woodsmoke, rust, damp pine needles, cold air with metallic edge.",
    "Sound: wind through bare branches, distant owl, campfire pop, hubcap vibration hum.",
    "Touch: cold chrome under calloused fingers, rough cedar post, gritty fog moisture.",
    "Light: focused campfire beam, scattered fog glow, star field above the treeline.",
    "At 4 AM the fog breaks and the Milky Way comes down to the ridgeline like a bridge.",
    // Real-text anchors: heliograph, Signal Corps, Smithsonian records
    "U.S. Army: 'The Signal Corps began experimenting with the heliograph around 1873 and used it extensively in the Southwest in 1886.'",
    "The heliograph: two mirrors, a sighting rod, a tripod, a shutter. Sunlight, aimed, becomes a telegraph.",
    "Brown, The Signal Corps, U.S.A. in the War of the Rebellion (1896): field manual for line-of-sight signaling.",
    "Smithsonian: heliograph record — ferrule, mirror housing, azimuth scale, sight bar, transport case.",
    "The Apache campaign: heliograph stations on every peak. Messages flashed across desert at the speed of light.",
    "Solar telegraph: no wire, no battery, no infrastructure. Only sun, mirror, and clear air.",
    "Signal mirror specification: 4.75-inch square, polished nickel, central sighting hole, lanyard ring.",
    "First rule of heliograph: if you can see them, you can signal them. Line of sight is line of communication.",
    "Second rule: fog defeats the heliograph. When light cannot travel, silence falls.",
    "The hubcap is a degraded heliograph. Same physics, same angle of incidence equals angle of reflection.",
    "At 1,200 yards, a signaling mirror produces a flash visible to the naked eye. At 30 miles, with a telescope.",
    "The cedar post is a poor man's tripod. The chrome hubcap is a scavenged mirror. The signal is the same.",
    "The ridge-man and the signal corpsman share a skill: reading landscape as optical infrastructure.",
    "Every ridge in Appalachia is a potential relay station. The mountains were built for line-of-sight.",
    "The WPA surveyors used heliographs in the 1930s. The ridges remembered.",
    "The flash of a mirror is a binary signal: light/no-light. It is the ancestor of the digital bit.",
    "The ridge is a natural high point. It is the best place to see and be seen.",
    "The hubcap's curvature is not perfect, but it is enough to focus the light of a campfire.",
    "The ridge-man's signal is a message to the valley. It says: I am here, I am watching, I am measuring.",
    "The ridge is a place of observation. It is where the world is seen from above.",
  ],
  cave: [
    // World function
    "The Dark Cave. LiDAR mechanics.",
    "Edgar's Collar Thumper. Click... Click...",
    "Measuring the speed of light return.",
    "Is it a squirrel? Or a quantum displacement?",
    "Inference in the dark.",
    "14 inches between the glowing eyes.",
    "The cave is the world's chamber of unknown returns.",
    "It teaches that reality in darkness must be inferred from echoes, intervals, and returns rather than direct vision.",
    "Fourteen inches between the eyes. Now tell me what kind of dark that is.",
    "The cave is the purest site of epistemology in the world.",
    "It asks whether the unknown is animal, machine, ghost, or displaced matter — and whether the distinction can hold.",
    // Apparatus
    "Edgar's collar emits a 433.92 MHz pulse every 4 seconds. The collar was found at the cave mouth.",
    "The collar thumper is a crude LiDAR: it sends a click, listens for the return, measures distance.",
    "At 340 m/s the return time from the back wall should be 0.12 seconds. It comes back in 0.09.",
    "The cave is shorter than it measures. Or the signal is traveling faster than sound.",
    "A pair of eyes reflect the flashlight beam at 14-inch separation. No known animal has that span.",
    "The beam enters the cave and does not come back straight. It returns at a 7-degree offset.",
    "The offset means a curved surface. The inner cave wall is not flat. It is parabolic.",
    // Mythic charge
    "Plato's cave, literalized. The prisoners watch shadows. The local measures their parallax.",
    "William Blake: 'Tyger Tyger, burning bright, / In the forests of the night.'",
    "The burning symmetry Blake saw was a pair of glowing eyes. The 'dread hand' was inference.",
    "The cave holds what cannot be named until it is measured.",
    "Darkness is not the absence of knowledge. It is knowledge in its hardest form: pure inference.",
    // Tracking & hunting
    "Southern hound tracking: the dog reads scent displacement the way the instrument reads pulse return.",
    "Edgar was the best tracker in three counties. He followed trails too faint for any instrument.",
    "If Edgar is in the cave, he is not hiding. He is displaced.",
    "The collar signal continues to emit from inside the cave, but the GPS coordinates resolve to a point sixteen feet underground.",
    "Sixteen feet below the cave floor there is no cavity on any survey map.",
    // Historical
    "Robert Buderi, The Invention That Changed the World: radar history is pulse emission, return timing, and hostile ambiguity.",
    "The cave operates the same logic as the Chain Home radar stations: send, wait, read the return, and decide what is hostile.",
    "The cave does not tell you what is inside it. It tells you what the inside does to your signal.",
    // Media bleed
    "HIGH RIDGE HERALD: MISSING HOUND 'EDGAR' REPORTED IN CAVE; SEARCH PARTY FINDS ONLY COLLAR AND 'UNUSUAL ECHOES.'",
    "HIGH RIDGE HERALD: PRIZE-WINNING HOUND 'EDGAR' MISSING FOR THIRD WEEK; OWNER CITES 'QUANTUM DISPLACEMENT.'",
    "ACADEMIC: Acoustic anomalies in karst formations may produce echo patterns inconsistent with measured cavity dimensions.",
    "AM BROADCAST: 'If you're near the cave tonight, listen. Don't go in. Just listen. Count the clicks.'",
    // Epistemic conflict
    "The search-and-rescue volunteer used a thermal camera. Grandpa used a stopwatch and his ears.",
    "The thermal camera showed nothing. The stopwatch showed impossible return times.",
    "The volunteer said the cave was empty. Grandpa said the cave was lying.",
    "What the City Slicker calls empty, the local calls opaque.",
    // Sensory
    "Smell: wet limestone, bat guano, iron seep, cold mineral air.",
    "Sound: dripping water (1.3 second interval), distant rumble, click-return-click, heartbeat in the silence.",
    "Touch: damp limestone under fingertips, cold still air, grit in every crease of skin.",
    "Light: flashlight cone, eye-shine at 14-inch span, absolute dark beyond the beam edge.",
    "The dark in the cave is not like nighttime dark. It has texture. It has weight. It presses.",
    // Real-text anchors: Stephen Bishop, Bullitt's Rambles, Mammoth Cave NPS
    "NPS: 'Stephen Bishop, an enslaved African American, arrived at Mammoth Cave in 1838. He crossed Bottomless Pit and helped open major passages.'",
    "Bishop drew a map of the cave from memory in 1842. It was published in Bullitt's Rambles and remained accurate for decades.",
    "Bullitt, Rambles in the Mammoth Cave (1845): 'The guide proceeded with a torch, and we followed in single file through a passage barely wide enough for one.'",
    "Bullitt: 'The darkness is absolute. When the guide extinguishes his torch, you cannot see your hand before your face.'",
    "Bullitt: 'The echo returns from three directions simultaneously. The ear replaces the eye as the primary instrument of navigation.'",
    "Hovey, The Mammoth Cave of Kentucky (1882): systematic survey, geology, measurements, diagrams.",
    "Stephen Bishop's vocabulary: 'Bottomless Pit' — it was not bottomless. He lowered a stone on a string. 105 feet.",
    "The guide's equipment: tallow candle, a length of rope, a ball of twine, chalk for marking walls.",
    "The candle lasted four hours. If it went out, you followed the twine back by touch alone.",
    "NPS: the cave maintains a constant 54°F year-round. Humidity: 95%. Wind: nearly zero.",
    "The blind cavefish of Mammoth Cave: eyes reduced to vestigial spots. It navigates by pressure wave.",
    "Stephen Bishop could name every formation, every turn, every pool. His map lived in his body.",
    "Cave tourism began in the 1810s. Visitors paid to be guided into darkness by men who knew the route by touch.",
    "Enslavement and expertise: Bishop was both the cave's greatest explorer and the property of its operator.",
    "The cave holds what cannot be seen. The guide holds what cannot be mapped. Knowledge flows upstream from the dark.",
    "WKU Special Collections: guide descriptions, tourism records, archaeological findings, cave operations.",
    "The cave is a space of absolute isolation. It is where the world ends and the interior begins.",
    "The echo is the cave's voice. It tells you the shape of the room before you see it.",
    "The cave is a natural laboratory. It is where the earth reveals its structure.",
    "The cave is a place of deep time. It is where the past is preserved in stone.",
  ],
  puddle: [
    // World function
    "The Oil Puddle. Thin-Film Interference.",
    "A rainbow on the mud. Diffraction.",
    "Smells like 1974 tractor oil.",
    "Constructive interference of wavelengths.",
    "The City Slicker sees magic. We see physics.",
    "Shattered Shine.",
    "The puddle is the smallest and most democratic cosmological instrument in the world.",
    "It turns industrial runoff into spectral revelation.",
    "Mud, oil, wavelength, beauty, contempt, and proof all occupy the same surface.",
    "The puddle is the world's thesis in miniature.",
    // Apparatus
    "A thin film of 10W-40 tractor oil, approximately 400 nanometers thick, floating on rainwater.",
    "At 400nm the film reinforces violet. At 700nm, red. The rainbow is not metaphor. It is measurement.",
    "The specific gravity of the oil determines the film thickness. The film thickness determines the spectrum.",
    "One puddle, three feet across, contains every wavelength of visible light.",
    "Grandpa ran the tractor until 1974. The oil has been seeping into this depression since.",
    "Fifty years of slow geological accumulation. Each layer a different viscosity. Each layer a different color.",
    // Mythic charge
    "The rainbow in the mud is what happens when grime meets coherent light.",
    "Beauty is not opposed to grime; grime is one of beauty's most faithful substrates.",
    "The Bifröst bridge is shattered and lying in a farm puddle in West Virginia.",
    "Oscar Wilde: 'We are all in the gutter, but some of us are looking at the stars.'",
    "The puddle IS the gutter AND the stars. The thin film is both.",
    // Literary
    "Elizabeth Bishop, 'The Fish': finding transcendence in oil sheen, rust, water, and lived material grime.",
    "Bishop saw the rainbow in the bilge oil. The puddle is the same vision, terrestrial.",
    "John Keats, Lamia: 'Do not all charms fly / At the mere touch of cold philosophy?'",
    "The puddle's answer to Keats: No. Philosophy makes the charm more precise, not less beautiful.",
    "Robert Frost, 'The Star-Splitter': a farmer burns his house to buy a telescope. Rural roughness meets cosmic curiosity.",
    "The puddle is a telescope that cost nothing. It reveals the electromagnetic spectrum in mud.",
    // Historical
    "Appalachia on Our Mind, Henry Shapiro: how outsiders invented the backward-mountain stereotype.",
    "The outsider looks at the puddle and sees neglect. The local looks and sees constructive interference.",
    "Every Farm a Factory, Deborah Fitzgerald: the industrialization of agriculture left oil in every low point.",
    "The tractor is gone but its chemical residue keeps performing physics in the rain.",
    // Media bleed
    "HIGH RIDGE HERALD: OP-ED: OIL RAINBOW IN MUD NOT A PORTAL, SAYS EXTENSION OFFICE.",
    "HIGH RIDGE HERALD: (Letter to editor: 'If it ain't a portal, how come the colors change when you walk around it?')",
    "ACADEMIC: Thin-film interference patterns in petroleum residue demonstrate wavelength-dependent constructive amplification.",
    "AM BROADCAST: 'The puddle by Grandpa's tractor shed is showing colors again. Go see it before it rains.'",
    // Epistemic conflict
    "The city tourist photographed the puddle for Instagram. Caption: 'Magical rainbow in rural WV! 🌈✨'",
    "Grandpa would have captioned it: 'Thin-film interference, 400-700nm, 10W-40 on standing water.'",
    "Both descriptions are correct. Only one knows why.",
    "Explanation is a mode of reverence. Understanding the spectrum does not diminish its beauty.",
    // Sensory
    "Smell: old motor oil, wet clay, iron-rich groundwater, diesel trace.",
    "Sound: rain hitting the film surface (softer than rain on plain water), frog chorus, distant tractor idle.",
    "Touch: slick oil film on fingers, cold mud between boots, gritty clay.",
    "Light: iridescence shifting with viewing angle, violet at steep angles, red at shallow, full spectrum at 45°.",
    "After a hard rain the puddle renews. The old film disperses. A new layer forms. The physics starts over.",
    // Cultural logic
    "AXIOM A4: Rural matter can become scientific apparatus.",
    "AXIOM A5: Outsiders mistake operational knowledge for superstition because they do not know how to read the tools.",
    "AXIOM A6: Every phenomenon has two vocabularies: the haint-name and the field equation.",
    "What the outsider calls a dirty puddle, the local calls a diffraction grating.",
    "Improvised apparatus reveals hidden orders of the world.",
    "Local vocabulary preserves observations formal science may later rename.",
    // Real-text anchors: Spindletop, Big Thicket, agricultural engineering, TSHA
    "Lamar University: 'January 10, 1901, the Lucas Gusher at Spindletop blew in — heralding the petroleum age.'",
    "The gusher rose 150 feet. It took nine days to cap. Six hundred thousand barrels soaked the prairie.",
    "TSHA: Spindletop — rotary bit, roughneck, derrickman, toolpusher, boomer. The vocabulary of extraction.",
    "Rotary drilling replaced cable-tool. The bit turns. Mud circulates. The hole goes deeper.",
    "NPS Big Thicket: 'Oil and gas production in the region dates to the late 1800s, preceding Spindletop.'",
    "The first Texas oil was not gushed. It seeped. It rose through limestone and pooled in low places.",
    "Portal to Texas History: newspapers covered the boom in real time. Headlines, casualties, fortunes.",
    "BEAUMONT ENTERPRISE, Jan 11 1901: 'OIL! OIL! OIL! — The Lucas Well Comes In — City Goes Wild.'",
    "NAL: agricultural engineering bulletins — farm power, machinery maintenance, tractor lubrication specs.",
    "USDA Bulletin 1329 (1924): Tractor Lubrication — viscosity tables, drain intervals, contamination thresholds.",
    "Rural electrification: before TVA, farms ran on kerosene and muscle. After, on tungsten and copper.",
    "The puddle on the farm road contains both tractor oil and geological seep. Two time scales in one sheen.",
    "10W-40: multi-viscosity motor oil. Thin at cold start (10W), thick at temperature (40). The puddle remembers both.",
    "Thin-film interference: light reflects from top and bottom of the oil film. Alignment = color. Cancellation = dark.",
    "At 400nm film thickness, violet. At 700nm, red. The rainbow is physics, not magic.",
    "The roughneck's hands were permanently stained. Crude oil enters the skin and does not come out.",
    "Farm bulletin: 'Drain used oil into a designated container. Do not pour on ground.' Nobody read the bulletin.",
    "The contaminated ground remembers every pour. The puddle is a memory device. The sheen is its reading head.",
  ],
}

const LORE_FULL: Record<string, string> = {
  shack: MOUNTAIN_LORE.shack!.join(' '),
  creek: MOUNTAIN_LORE.creek!.join(' '),
  ridge: MOUNTAIN_LORE.ridge!.join(' '),
  cave: MOUNTAIN_LORE.cave!.join(' '),
  puddle: MOUNTAIN_LORE.puddle!.join(' '),
}

// CSPR Evidence
const EVIDENCE: Record<string, { itemNo: string; entityClass: string; attributes: string; relationship: string; zone: string }> = {
  PRISM:    { itemNo: '101-A', entityClass: 'OPTICAL INSTRUMENT', attributes: 'Mason Jar, Clear Glass, 500ml capacity, Refraction Index 1.33.', relationship: 'Primary light-bending mechanism. Connected to Creek Zone optics.', zone: 'KITCHEN' },
  GLASSES:  { itemNo: '101-B', entityClass: 'PERSONAL EFFECTS', attributes: 'Wire-frame spectacles, +2.5 diopter, fingerprint residue on left lens.', relationship: 'Belonged to Grandpa. Last seen on the nightstand.', zone: 'DINING' },
  HUBCAP:   { itemNo: '104-A', entityClass: 'REFLECTIVE SURFACE', attributes: 'Chrome-plated steel, Concave curvature, Focal length: 42cm.', relationship: 'Repurposed as signal mirror. Angle of incidence = angle of reflection.', zone: 'DEN' },
  SHADOW:   { itemNo: '104-B', entityClass: 'OPTICAL ANOMALY', attributes: 'Dark zone, No light penetration, Dimensions: 14in × 6in × 8in.', relationship: 'Mysterious Blank. Light-absorbing void. Edgar-shaped silhouette.', zone: 'LIVING ROOM' },
  COLLAR:   { itemNo: '105-A', entityClass: 'TRACKING DEVICE', attributes: "Leather, Brass buckle, Radio tag frequency: 433.92 MHz.", relationship: "Edgar's collar. The 'Thumper' — LiDAR pulse emitter.", zone: 'LAUNDRY' },
}

// Zones (ported)
const ZONES: Record<string, { name: string; color: string; minR: number; maxR: number; flavor: string }> = {
  SHACK:  { name: 'THE SHACK',  color: '#daa520', minR: 0,  maxR: 4,  flavor: 'HOME BASE' },
  CREEK:  { name: 'THE CREEK',  color: '#4682b4', minR: 4,  maxR: 8,  flavor: 'REFRACTION ZONE' },
  RIDGE:  { name: 'THE RIDGE',  color: '#cd853f', minR: 8,  maxR: 13, flavor: 'REFLECTION ZONE' },
  PUDDLE: { name: 'THE PUDDLE', color: '#2f4f4f', minR: 13, maxR: 16, flavor: 'INTERFERENCE ZONE' },
  CAVE:   { name: 'THE CAVE',   color: '#4b0082', minR: 16, maxR: 99, flavor: 'LIDAR ZONE' },
}

function zoneForRadius(r: number) {
  if (r < ZONES.SHACK!.maxR) return ZONES.SHACK!
  if (r < ZONES.CREEK!.maxR) return ZONES.CREEK!
  if (r < ZONES.RIDGE!.maxR) return ZONES.RIDGE!
  if (r < ZONES.PUDDLE!.maxR) return ZONES.PUDDLE!
  return ZONES.CAVE!
}

function loreKeyForZone(zone: typeof ZONES[string]): string {
  if (zone === ZONES.SHACK) return 'shack'
  if (zone === ZONES.CREEK) return 'creek'
  if (zone === ZONES.RIDGE) return 'ridge'
  if (zone === ZONES.PUDDLE) return 'puddle'
  return 'cave'
}

// ── GRID STATE ──
const GRID_SIZE = 32
const CENTER = 16

interface CellState {
  x: number; y: number; r: number
  zone: typeof ZONES[string]
  text: string
  color: string
  height: number
}

const gridState: CellState[][] = []

function compileCell(x: number, y: number): CellState {
  const dx = x - CENTER, dy = y - CENTER
  const r = Math.sqrt(dx * dx + dy * dy)
  const zone = zoneForRadius(r)
  const key = loreKeyForZone(zone)
  const content = MOUNTAIN_LORE[key]!
  const text = content[Math.floor(Math.abs(x + y * 3)) % content.length]!
  const height = Math.sin(x / 2) + Math.cos(y / 2) * 2
  return { x, y, r, zone, text, color: zone.color, height }
}

for (let y = 0; y < GRID_SIZE; y++) {
  gridState[y] = []
  for (let x = 0; x < GRID_SIZE; x++) {
    gridState[y]![x] = compileCell(x, y)
  }
}

// ── SKY STARS (seeded once for persistent starfield) ──
interface SkyStart { x: number; y: number; size: number; brightness: number; speed: number; phase: number; color: string }
const skyStars: SkyStart[] = []
function seedStars(): void {
  skyStars.length = 0
  const starColors = ['#ffffff', '#ccd8ff', '#aabbff', '#ffeedd', '#ffddaa', '#ddeeff']
  const halfH = Math.floor(ch / 2)
  for (let i = 0; i < 220; i++) {
    skyStars.push({
      x: Math.random() * cw,
      y: Math.random() * halfH * 0.92,
      size: Math.random() < 0.15 ? 2 : 1,
      brightness: 0.2 + Math.random() * 0.8,
      speed: 0.3 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      color: starColors[Math.floor(Math.random() * starColors.length)]!,
    })
  }
}
seedStars()

// ── CLICKABLE HOT WORDS — hyperlinks in the worldtext ──
interface HotWordHit {
  x: number; y: number; w: number; h: number
  word: string; color: string; zone: string
}
let hotWordHits: HotWordHit[] = []
let hoveredHotWord: HotWordHit | null = null

// ═══ CLUE GRAPH — the investigation data structure ═══
interface ClueNode {
  word: string
  color: string
  zone: string          // home zone key
  connections: string[] // other ClueNode words this links to
  clue: string          // mystery-flavored description
  collected: boolean    // has the player clicked this?
}

const CLUE_GRAPH: Record<string, ClueNode> = {
  // ── SUBJECTS ──
  'Edgar':    { word: 'Edgar',    color: '#daa520', zone: 'shack', connections: ['collar', 'Grandpa', 'cave', 'hound', 'shadow'], clue: 'Prize hound. Missing 3 weeks. Collar signal: inside the cave. GPS: 16ft below the floor. That is not possible.', collected: false },
  'Grandpa':  { word: 'Grandpa',  color: '#daa520', zone: 'shack', connections: ['Edgar', 'glasses', 'prism', 'cave', 'flashlight', 'still'], clue: 'Last seen with flashlight and stopwatch. The thermal camera found nothing. The volunteer said the cave was empty. Grandpa said the cave was lying.', collected: false },
  'hound':    { word: 'hound',    color: '#daa520', zone: 'shack', connections: ['Edgar', 'collar', 'cave'], clue: 'Southern tracking hound. Best tracker in three counties. He followed trails too faint for any instrument.', collected: false },

  // ── SHACK (gold) ──
  'Foxfire':    { word: 'Foxfire',    color: '#daa520', zone: 'shack', connections: ['Grandpa', 'still', 'ham radio'], clue: 'Foxfire Book of Knowledge, Vol. 1-12. Oral tradition. How to build what the catalog won\'t sell you.', collected: false },
  'still':      { word: 'still',      color: '#daa520', zone: 'shack', connections: ['Grandpa', 'Foxfire', 'Junior Johnson'], clue: 'Copper still. 80-gallon capacity. Grandpa\'s secondary lab. Temperature control accurate to ±0.5°F.', collected: false },
  'ham radio':  { word: 'ham radio',  color: '#daa520', zone: 'shack', connections: ['antenna', 'vacuum tube', 'collar'], clue: 'Grandpa\'s rig. 40-meter band. He talked to people three states away. The collar frequency is close.', collected: false },
  'antenna':    { word: 'antenna',    color: '#daa520', zone: 'shack', connections: ['ham radio', 'Signal Corps', 'collar'], clue: 'Dipole antenna, 20ft, strung between two oaks. Homebrew. The design comes from a 1943 Army Signal manual.', collected: false },
  'vacuum tube':{ word: 'vacuum tube',color: '#daa520', zone: 'shack', connections: ['ham radio', 'Foxfire'], clue: '12AX7 preamp tube. Grandpa keeps spares in a mason jar. The same jar doubles as a lens.', collected: false },
  'bootlegger': { word: 'bootlegger', color: '#daa520', zone: 'shack', connections: ['Junior Johnson', 'still'], clue: 'Bootlegger mechanics: the car is the instrument. Outrun, don\'t outfight.', collected: false },
  'Junior Johnson': { word: 'Junior Johnson', color: '#daa520', zone: 'shack', connections: ['bootlegger', 'still'], clue: 'Race driver. Moonshine runner. "He could see curves before they happened." — Tom Wolfe', collected: false },
  'flashlight': { word: 'flashlight', color: '#daa520', zone: 'shack', connections: ['Grandpa', 'cave', 'beam'], clue: 'Standard 2-cell. 14-inch beam at 14-inch separation. The beam enters the cave and does not come back straight.', collected: false },

  // ── CREEK (blue) ──
  'prism':    { word: 'prism',    color: '#4682b4', zone: 'creek', connections: ['glasses', 'mason jar', 'Newton', 'refraction'], clue: 'Mason jar prism. Refraction index 1.33. Someone was bending light on purpose. Why?', collected: false },
  'glasses':  { word: 'glasses',  color: '#4682b4', zone: 'creek', connections: ['Grandpa', 'prism'], clue: 'Wire-frame spectacles, +2.5 diopter. Found on the workbench. Left lens: fingerprint residue.', collected: false },
  'mason jar':{ word: 'mason jar',color: '#4682b4', zone: 'creek', connections: ['prism', 'vacuum tube', 'refraction'], clue: 'Standard quart jar. Filled with creek water, it becomes a lens. Focal length depends on temperature.', collected: false },
  'refraction':{ word: 'refraction',color: '#4682b4', zone: 'creek', connections: ['prism', 'Snell', 'Newton'], clue: 'The bending of light when it passes through a boundary. Snell\'s law. The cave bends the signal too.', collected: false },
  'Snell':    { word: 'Snell',    color: '#4682b4', zone: 'creek', connections: ['refraction', 'Newton'], clue: 'Snell\'s Law: n₁ sin θ₁ = n₂ sin θ₂. The creek knows this already.', collected: false },
  'Newton':   { word: 'Newton',   color: '#4682b4', zone: 'creek', connections: ['Opticks', 'prism', 'Snell'], clue: 'Isaac Newton, 1704. Opticks. He put a prism in a dark room and broke sunlight into colors.', collected: false },
  'Opticks':  { word: 'Opticks',  color: '#4682b4', zone: 'creek', connections: ['Newton', 'prism'], clue: 'Newton\'s Opticks (1704). Book I: "Light is never known to follow crooked passages."', collected: false },
  'survey':   { word: 'survey',   color: '#4682b4', zone: 'creek', connections: ['Washington', 'circumferentor'], clue: 'Systematic survey. Geology, measurements, diagrams. The cave is on no survey map.', collected: false },
  'Washington':{ word: 'Washington',color: '#4682b4', zone: 'creek', connections: ['survey', 'circumferentor'], clue: 'George Washington, surveyor. He measured the Shenandoah before he led armies.', collected: false },
  'circumferentor':{ word: 'circumferentor',color: '#4682b4', zone: 'creek', connections: ['Washington', 'survey', 'declination'], clue: 'Surveyor\'s compass. Brass body, silvered ring. Measures bearing and declination.', collected: false },
  'declination':{ word: 'declination',color: '#4682b4', zone: 'creek', connections: ['circumferentor', 'survey'], clue: 'Magnetic declination. The difference between true north and magnetic north. It varies by location.', collected: false },

  // ── RIDGE (brown/orange) ──
  'hubcap':   { word: 'hubcap',   color: '#cd853f', zone: 'ridge', connections: ['mirror', 'beam', 'heliograph'], clue: 'Chrome hubcap. Focal length 42cm. Used as a signal mirror. Who was he signaling?', collected: false },
  'mirror':   { word: 'mirror',   color: '#cd853f', zone: 'ridge', connections: ['hubcap', 'heliograph', 'beam'], clue: 'Angle of incidence = angle of reflection. The ridge teaches this with every hubcap.', collected: false },
  'beam':     { word: 'beam',     color: '#cd853f', zone: 'ridge', connections: ['flashlight', 'hubcap', 'mirror', 'cave'], clue: 'The beam enters the cave and does not come back straight. Returns at a 7-degree offset. Curved wall.', collected: false },
  'fog':      { word: 'fog',      color: '#cd853f', zone: 'ridge', connections: ['mirror', 'Signal Corps'], clue: 'Mountain fog. Drops visibility to 20 feet. Sound carries farther than light.', collected: false },
  'heliograph':{ word: 'heliograph',color: '#cd853f', zone: 'ridge', connections: ['hubcap', 'mirror', 'Signal Corps', 'Smithsonian'], clue: 'Sun-based telegraph. 3-inch mirror can signal 30 miles. The Army used these in the Apache Wars.', collected: false },
  'Signal Corps':{ word: 'Signal Corps',color: '#cd853f', zone: 'ridge', connections: ['heliograph', 'antenna', 'ham radio'], clue: 'U.S. Army Signal Corps. Founded 1860. "Send, wait, read the return, and decide what is hostile."', collected: false },
  'Smithsonian':{ word: 'Smithsonian',color: '#cd853f', zone: 'ridge', connections: ['heliograph', 'Signal Corps'], clue: 'Smithsonian archives. Accession #1886-0032. Signal mirror, 4-inch, brass-mounted.', collected: false },
  'signal':    { word: 'signal',    color: '#cd853f', zone: 'ridge', connections: ['collar', 'heliograph', 'Signal Corps'], clue: 'The collar signal continues to emit from inside the cave. The GPS coordinates resolve to 16ft underground.', collected: false },

  // ── CAVE (purple) ──
  'collar':   { word: 'collar',   color: '#4b0082', zone: 'cave', connections: ['Edgar', 'pulse', 'LiDAR', 'signal', 'ham radio'], clue: 'Leather collar. Radio tag 433.92 MHz. They call it the Thumper. It sends a click every 4 seconds.', collected: false },
  'pulse':    { word: 'pulse',    color: '#4b0082', zone: 'cave', connections: ['collar', 'LiDAR', 'cave'], clue: 'The collar emits a 433.92 MHz pulse every 4 seconds. The cave operates the same logic: send, wait, read the return.', collected: false },
  'LiDAR':    { word: 'LiDAR',    color: '#4b0082', zone: 'cave', connections: ['collar', 'pulse', 'beam'], clue: 'Light Detection and Ranging. Grandpa\'s collar is a crude LiDAR: it sends a click, listens for the return, measures distance.', collected: false },
  'cave':     { word: 'cave',     color: '#4b0082', zone: 'cave', connections: ['Edgar', 'Grandpa', 'Stephen Bishop', 'collar', 'shadow', 'beam'], clue: 'The Dark Cave. The world\'s purest site of epistemology. It asks whether the unknown is animal, machine, ghost, or displaced matter.', collected: false },
  'shadow':   { word: 'shadow',   color: '#4b0082', zone: 'cave', connections: ['Edgar', 'cave'], clue: 'Dark zone. 14in × 6in × 8in. Edgar-shaped silhouette but no Edgar. Where does the shadow go?', collected: false },
  'Stephen Bishop':{ word: 'Stephen Bishop',color: '#4b0082', zone: 'cave', connections: ['Mammoth', 'Bullitt', 'Bottomless Pit', 'cave'], clue: 'An enslaved African American. Arrived at Mammoth Cave in 1838. Drew a map from memory in 1842.', collected: false },
  'Bullitt':  { word: 'Bullitt',  color: '#4b0082', zone: 'cave', connections: ['Stephen Bishop', 'Mammoth'], clue: 'Bullitt, "Rambles in the Mammoth Cave" (1845). "The darkness is a kind of light."', collected: false },
  'Mammoth':  { word: 'Mammoth',  color: '#4b0082', zone: 'cave', connections: ['Stephen Bishop', 'Bullitt', 'Bottomless Pit', 'cave'], clue: 'Mammoth Cave, Kentucky. 400+ miles mapped. The longest known cave system in the world.', collected: false },
  'Bottomless Pit':{ word: 'Bottomless Pit',color: '#4b0082', zone: 'cave', connections: ['Stephen Bishop', 'Mammoth'], clue: 'He lowered a stone on a string. 105 feet. The Mammoth Cave\'s vocabulary: not bottomless.', collected: false },
  'lantern':  { word: 'lantern',  color: '#4b0082', zone: 'cave', connections: ['cave', 'flashlight'], clue: 'Tallow candle, a length of rope, a ball of twine. Stephen Bishop\'s equipment.', collected: false },
  'guide':    { word: 'guide',    color: '#4b0082', zone: 'cave', connections: ['Stephen Bishop', 'Mammoth'], clue: 'When the guide extinguishes his torch, you cannot see your hand before your face.', collected: false },

  // ── PUDDLE (dark teal) ──
  'rainbow':  { word: 'rainbow',  color: '#2f4f4f', zone: 'puddle', connections: ['oil', 'interference', 'spectrum'], clue: 'Rainbow in a puddle. Thin-film interference. The same physics that makes oil beautiful.', collected: false },
  'oil':      { word: 'oil',      color: '#2f4f4f', zone: 'puddle', connections: ['rainbow', 'Spindletop', 'crude', 'interference'], clue: 'Oil in water. Tractor oil in a puddle. The rainbow is 200nm of destructive interference.', collected: false },
  'interference':{ word: 'interference',color: '#2f4f4f', zone: 'puddle', connections: ['rainbow', 'oil', 'spectrum'], clue: 'Constructive and destructive. When two waves cancel, you see dark. When they reinforce, you see color.', collected: false },
  'spectrum': { word: 'spectrum', color: '#2f4f4f', zone: 'puddle', connections: ['rainbow', 'Newton', 'interference'], clue: 'Newton\'s spectrum. Seven colors? Five? How many you see depends on what language you speak.', collected: false },
  'Spindletop':{ word: 'Spindletop',color: '#2f4f4f', zone: 'puddle', connections: ['oil', 'gusher', 'crude'], clue: 'Spindletop, 1901. Lucas Gusher. 100,000 barrels/day. Changed the century.', collected: false },
  'gusher':   { word: 'gusher',   color: '#2f4f4f', zone: 'puddle', connections: ['Spindletop', 'oil', 'rotary'], clue: 'The Lucas Gusher blew 150 feet high. Nine days before they capped it.', collected: false },
  'rotary':   { word: 'rotary',   color: '#2f4f4f', zone: 'puddle', connections: ['gusher', 'crude'], clue: 'Rotary drill bit. Captain Lucas\'s innovation. Before this, they pounded the earth with a cable.', collected: false },
  'crude':    { word: 'crude',    color: '#2f4f4f', zone: 'puddle', connections: ['oil', 'Spindletop', 'petroleum'], clue: 'Crude petroleum. Unrefined. The earth\'s own thin-film experiment, compressed over 300 million years.', collected: false },
  'petroleum':{ word: 'petroleum',color: '#2f4f4f', zone: 'puddle', connections: ['crude', 'oil'], clue: 'Petroleum: petra (rock) + oleum (oil). Rock-oil. The Romans named it.', collected: false },
  'roughneck':{ word: 'roughneck',color: '#2f4f4f', zone: 'puddle', connections: ['Spindletop', 'gusher'], clue: 'Derrick worker. Twelve-hour shifts. Hands black to the elbow. The original blue-collar engineer.', collected: false },
}

// Build HOT_WORDS lookup from CLUE_GRAPH for backward compat with render loop
const HOT_WORDS: Record<string, string> = {}
for (const [key, node] of Object.entries(CLUE_GRAPH)) {
  HOT_WORDS[key] = node.color
}
// Meta labels (not clue nodes, just visual markers)
HOT_WORDS['AXIOM'] = '#fff'; HOT_WORDS['HERALD'] = '#ff8c00'
HOT_WORDS['BROADCAST'] = '#0fa'; HOT_WORDS['ACADEMIC'] = '#0ff'
HOT_WORDS['NPS'] = '#0fa'; HOT_WORDS['LOC'] = '#0fa'
HOT_WORDS['TSHA'] = '#0fa'; HOT_WORDS['NAL'] = '#0fa'

// ═══ ACTIVE PURSUIT — which clue the player is currently following ═══
let activePursuit: ClueNode | null = null
let collectedClues: ClueNode[] = []

// Hot word click handler — the investigation mechanic
function onHotWordClick(hit: HotWordHit): void {
  const word = hit.word
  const lowerWord = word.toLowerCase()

  // Look up in CLUE_GRAPH (case-insensitive match)
  let node: ClueNode | null = null
  for (const [key, n] of Object.entries(CLUE_GRAPH)) {
    if (key.toLowerCase() === lowerWord || word === key) { node = n; break }
  }

  if (node) {
    // Mark collected
    if (!node.collected) {
      node.collected = true
      collectedClues.push(node)
    }
    // Set as active pursuit — this drives thread rendering
    activePursuit = node

    // Show clue panel
    showCluePanel(node)

    // ═══ ALWAYS NAVIGATE — every hot word is a hyperlink to its home zone ═══
    const zonePositions: Record<string, { x: number; y: number }> = {
      shack: { x: CENTER + 2, y: CENTER + 2 }, creek: { x: CENTER + 6, y: CENTER },
      ridge: { x: CENTER, y: CENTER + 10 }, cave: { x: CENTER + 14, y: CENTER + 14 },
      puddle: { x: CENTER - 5, y: CENTER + 13 },
    }
    const targetZone = node.zone // every node knows its home zone
    const targetPos = zonePositions[targetZone]
    if (targetPos && hit.zone !== targetZone) {
      // Only glide if we're not already in the word's home zone
      playerGlideTarget = { x: targetPos.x + 0.5, y: targetPos.y + 0.5 }
    }

    // Archive words → also trigger LLM
    const generativeWords = ['foxfire', 'newton', 'bishop', 'bullitt', 'spindletop', 'mammoth', 'heliograph', 'signal corps', 'circumferentor', 'washington', 'survey']
    for (const gw of generativeWords) {
      if (lowerWord.includes(gw) && llmUrl && !llmGenerating) {
        const sample = (MOUNTAIN_LORE[node.zone] || []).slice(-3).join('\n')
        llmGenerate(node.zone, sample).then(lines => {
          if (lines.length > 0) { injectLore(node.zone, lines); prepCache.clear() }
        })
        break
      }
    }
    return
  }

  // Fallback: flash in scanner output
  const out = document.getElementById('scanner-output')
  if (out) { out.innerText = `KEYWORD: ${word.toUpperCase()}`; out.style.color = hit.color }
}

// ═══ CLUE DISPLAY — shows clue text in the scanner output ═══
function showCluePanel(node: ClueNode): void {
  const connList = node.connections.map(c => {
    const cn = CLUE_GRAPH[c]
    return cn?.collected ? `✓${c}` : `○${c}`
  }).join(' · ')
  const out = document.getElementById('scanner-output')
  if (out) {
    out.innerText = `${node.word.toUpperCase()} → ${node.clue} [${connList}]`
    out.style.color = node.color
  }
}


// ── PARTICLES ──
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
const particles: Particle[] = []
function spawnParticle(): void {
  if (particles.length > 80) return
  particles.push({
    x: Math.random() * 2000 - 500,
    y: Math.random() * 1200 - 200,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.5 - 0.1,
    life: 0,
    maxLife: 200 + Math.random() * 300,
    size: 1 + Math.random() * 2,
  })
}

// ── CANVAS ──
const canvas = document.getElementById('viz-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const mmCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement
const mmCtx = mmCanvas.getContext('2d')!
const ptReaderCanvas = document.getElementById('pt-reader-canvas') as HTMLCanvasElement
const ptReaderCtx = ptReaderCanvas.getContext('2d')!

// LiDAR canvas
const lidarCanvas = document.getElementById('lidar-canvas') as HTMLCanvasElement
const lidarCtx = lidarCanvas.getContext('2d')!

let cw = 0, ch = 0, cx = 0, cy = 0
function resize(): void {
  canvas.width = canvas.parentElement!.offsetWidth
  canvas.height = canvas.parentElement!.offsetHeight
  lidarCanvas.width = canvas.width
  lidarCanvas.height = canvas.height
  cw = canvas.width; ch = canvas.height
  cx = cw / 2; cy = ch / 2
  seedStars()
}
resize()
window.addEventListener('resize', resize)

// ── STATE ──
let zoom = 1.2, panX = 0, panY = 0
let viewMode: 'TOPO' | 'ORBIT' = 'TOPO'
let engineMode: 'GRID' | 'LIDAR' = 'GRID'
let isDragging = false
let startX = 0, startY = 0, lastX = 0, lastY = 0
let mousePos: { x: number; y: number } | null = null
let hoverCell: (CellState & { sx: number; sy: number }) | null = null
let time = 0

// Config
let charSize = 10
let coalesceRadius = 120
let waveSpeed = 40
let showRelations = true

// LiDAR player
const player = { x: 4.5, y: 4.5, dirX: -1, dirY: 0, planeX: 0, planeY: 0.66 }
let playerGlideTarget: { x: number; y: number } | null = null // smooth movement target
const keys: Record<string, boolean> = {}

// ── LIDAR MAP ──
// A 17×24 hallway plan (ported from orca-shield-18)
const LIDAR_PLAN = [
  '########################',
  '#......#......#.......#',
  '#..1.......2......3...#',
  '#......#......#.......#',
  '####.#####.######.#####',
  '#......#......#.......#',
  '#..4.......5......1...#',
  '#......#......#.......#',
  '####.#####.######.#####',
  '#...........#.........#',
  '#.....2..........3....#',
  '#...........#.........#',
  '############.##########',
  '#...........#.........#',
  '#.....4.....#...5.....#',
  '#...........#.........#',
  '########################',
]
const LIDAR_H = LIDAR_PLAN.length
const LIDAR_W = LIDAR_PLAN[0]!.length
const WALL_LORE: Record<string, string> = {
  '1': 'shack', '2': 'creek', '3': 'ridge', '4': 'cave', '5': 'puddle',
}

// Pretext cache for wall text
const wallLineCache = new Map<string, string[]>()

// ── PRETEXT STATE ──
const prepCache = new Map<string, PreparedTextWithSegments>()
let currentFont = ''
let lastPtMs = 0

function ensureFont(): string {
  const f = `${charSize}px Courier New`
  if (f !== currentFont) { currentFont = f; prepCache.clear(); wallLineCache.clear() }
  return f
}

function getPrepared(key: string): PreparedTextWithSegments {
  ensureFont()
  if (!prepCache.has(key)) {
    prepCache.set(key, prepareWithSegments(LORE_FULL[key] || MOUNTAIN_LORE[key]?.join(' ') || '', currentFont))
  }
  return prepCache.get(key)!
}

// Get Pretext-wrapped lines for wall text, cached per key+width+fontSize
function getWallLines(key: string, width: number, fontSize?: number): string[] {
  const fs = fontSize || charSize
  const font = `${fs}px Courier New`
  const cacheKey = `${key}_${width}_${fs}`
  if (wallLineCache.has(cacheKey)) return wallLineCache.get(cacheKey)!
  // Prepare at the exact font size that will be rendered
  const text = LORE_FULL[key] || MOUNTAIN_LORE[key]?.join(' ') || ''
  const prepared = prepareWithSegments(text, font)
  const lh = Math.ceil(fs * 1.3)
  const result = layoutWithLines(prepared, Math.max(40, width), lh)
  const lines = result.lines.map(l => l.text)
  wallLineCache.set(cacheKey, lines)
  return lines
}

// ── COALESCENCE ──
interface TypesetChar { char: string; tx: number; ty: number }

function getTypesetPositions(zoneKey: string, blockX: number, blockY: number, blockW: number): TypesetChar[] {
  const prepared = getPrepared(zoneKey)
  const lh = Math.ceil(charSize * 1.3)
  const chars: TypesetChar[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let y = blockY
  for (let row = 0; row < 100; row++) {
    const line = layoutNextLine(prepared, cursor, blockW)
    if (!line) break
    for (let i = 0; i < line.text.length; i++) {
      chars.push({ char: line.text[i]!, tx: blockX + (i * charSize * 0.6), ty: y })
    }
    cursor = line.end
    y += lh
    if (cursor.segmentIndex >= prepared.segments.length) break
  }
  return chars
}

// ── MOUSE EVENTS (grid mode) ──
canvas.addEventListener('mousedown', e => { isDragging = false; startX = e.clientX; startY = e.clientY })
canvas.addEventListener('mousemove', e => {
  if (e.buttons === 1) {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) isDragging = true
    if (isDragging) { panX += e.clientX - lastX; panY += e.clientY - lastY }
  }
  lastX = e.clientX; lastY = e.clientY
  const rect = canvas.getBoundingClientRect()
  mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
})
canvas.addEventListener('mouseup', () => { isDragging = false })
canvas.addEventListener('wheel', e => { zoom = Math.min(Math.max(0.5, zoom - e.deltaY * 0.001), 3.0) })

// ── KEYBOARD ──
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true
  if (e.key === ' ' && engineMode === 'LIDAR') { e.preventDefault(); lidarScan() }
  if (e.key === 'Escape' && engineMode === 'LIDAR') {
    if (activePursuit) { activePursuit = null } // dismiss pursuit first
    else { setMode('GRID') }
  }
  // 'G' — generate new lore for current zone via LLM
  if (e.key === 'g' && engineMode === 'LIDAR' && !llmGenerating) {
    const pr = Math.sqrt((Math.floor(player.x) - CENTER) ** 2 + (Math.floor(player.y) - CENTER) ** 2)
    const zone = zoneForRadius(pr)
    const key = loreKeyForZone(zone)
    const sample = (MOUNTAIN_LORE[key] || []).slice(-5).join('\n')
    llmGenerate(key, sample).then(lines => {
      if (lines.length > 0) {
        injectLore(key, lines)
        // Also clear prep cache to force re-preparation
        prepCache.clear()
      }
    })
  }
})
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })

// LLM config from URL params (e.g. ?llm_url=http://localhost:11434/v1/chat/completions&llm_model=llama3)
{
  const params = new URLSearchParams(window.location.search)
  const url = params.get('llm_url')
  const model = params.get('llm_model')
  const key = params.get('llm_key')
  if (url) { llmUrl = url; llmModel = model || 'llama3'; llmKey = key || '' }
}

// ── LIDAR CANVAS CLICK + HOVER — clickable worldtext hyperlinks ──
function hotWordAt(mx: number, my: number): HotWordHit | null {
  for (let i = hotWordHits.length - 1; i >= 0; i--) {
    const h = hotWordHits[i]!
    if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) return h
  }
  return null
}

lidarCanvas.addEventListener('click', e => {
  if (engineMode !== 'LIDAR') return
  const rect = lidarCanvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left) * (lidarCanvas.width / rect.width)
  const my = (e.clientY - rect.top) * (lidarCanvas.height / rect.height)
  const hit = hotWordAt(mx, my)
  if (hit) { onHotWordClick(hit); e.stopPropagation() }
})

lidarCanvas.addEventListener('mousemove', e => {
  if (engineMode !== 'LIDAR') return
  const rect = lidarCanvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left) * (lidarCanvas.width / rect.width)
  const my = (e.clientY - rect.top) * (lidarCanvas.height / rect.height)
  hoveredHotWord = hotWordAt(mx, my)
  lidarCanvas.style.cursor = hoveredHotWord ? 'pointer' : 'crosshair'
})

// ══════════════════════════════════════════════════════════════
// RENDER: GRID MODE
// ══════════════════════════════════════════════════════════════
function renderGrid(): void {
  ctx.fillStyle = '#0b0a08'
  ctx.fillRect(0, 0, cw, ch)

  const topoScale = 30 * zoom
  let closest: (CellState & { sx: number; sy: number }) | null = null
  let minDist = 1000
  const projectedPoints: { x: number; y: number; sx: number; sy: number; cell: CellState }[] = []

  // Coalescence setup
  let coalesceZone: string | null = null
  let coalesceSX = 0, coalesceSY = 0
  let typesetChars: TypesetChar[] | null = null
  let typesetCharIdx = 0

  if (hoverCell && coalesceRadius > 0) {
    coalesceZone = loreKeyForZone(hoverCell.zone)
    coalesceSX = hoverCell.sx; coalesceSY = hoverCell.sy
    const blockW = coalesceRadius * 2
    const t0 = performance.now()
    typesetChars = getTypesetPositions(coalesceZone, coalesceSX - coalesceRadius, coalesceSY - coalesceRadius * 0.5, blockW)
    lastPtMs = performance.now() - t0
    typesetCharIdx = 0
  }

  // ── DRAW GRID ──
  ctx.font = `${charSize * zoom}px Courier New`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = gridState[y]![x]!
      const rx = x - CENTER, ry = y - CENTER

      // Z wave
      const z = cell.height + Math.sin((Math.sqrt(rx * rx + ry * ry) * 0.5) - time * (waveSpeed / 40)) * 1.5

      // Projection
      let sx: number, sy: number
      if (viewMode === 'TOPO') {
        sx = cx + panX + (rx - ry) * topoScale
        sy = cy + panY + (rx + ry) * (topoScale * 0.4) - (z * zoom * 10)
      } else {
        sx = cx + panX + (rx * topoScale * 1.2)
        sy = cy + panY + (ry * topoScale * 1.2)
      }

      projectedPoints.push({ x, y, sx, sy, cell })

      // Character cycling — show more of the text, not just charAt(0)
      const textIdx = Math.floor(time * 0.8 + x * 0.7 + y * 0.3) % cell.text.length
      const char = cell.text[textIdx] || '.'

      // Distance fade
      const dist = Math.abs(rx) + Math.abs(ry)
      let alpha = Math.max(0.1, 1 - dist / 20)
      let fillColor = cell.color

      // Flow highlight wave
      if (Math.sin(rx * 0.5 + time * (waveSpeed / 40) + ry * 0.5) > 0.8) {
        fillColor = '#fff'; alpha = 1
      }

      // Coalescence
      let drawX = sx, drawY = sy
      if (typesetChars && coalesceZone === loreKeyForZone(cell.zone) && typesetCharIdx < typesetChars.length) {
        const dToHover = Math.hypot(sx - coalesceSX, sy - coalesceSY)
        if (dToHover < coalesceRadius * zoom) {
          const tc = typesetChars[typesetCharIdx]!
          const t = Math.max(0, Math.min(1, 1 - dToHover / (coalesceRadius * zoom)))
          const ease = t * t * (3 - 2 * t)
          drawX = sx + (tc.tx - sx) * ease
          drawY = sy + (tc.ty - sy) * ease
          alpha = Math.max(alpha, 0.3 + 0.7 * ease)
          if (ease > 0.5) fillColor = '#fff'
          typesetCharIdx++
        }
      }

      ctx.globalAlpha = alpha
      ctx.fillStyle = fillColor
      ctx.fillText(char, drawX, drawY)

      // Interaction
      if (mousePos) {
        const d = Math.hypot(sx - mousePos.x, sy - mousePos.y)
        if (d < 30 * zoom && d < minDist) { minDist = d; closest = { ...cell, sx, sy } }
      }
    }
  }

  // ── PARTICLES ──
  if (Math.random() < 0.15) spawnParticle()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.x += p.vx; p.y += p.vy; p.life++
    if (p.life > p.maxLife) { particles.splice(i, 1); continue }
    const a = Math.sin(Math.PI * p.life / p.maxLife) * 0.5
    ctx.globalAlpha = a
    ctx.fillStyle = '#daa520'
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── RELATIONSHIP LINES ──
  if (closest && showRelations) {
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 1; ctx.lineWidth = 2
    ctx.beginPath()
    const ringSize = (15 * zoom) + Math.sin(time * 4) * 5
    ctx.arc(closest.sx, closest.sy, ringSize, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 1; ctx.globalAlpha = 0.3; ctx.strokeStyle = closest.zone.color
    ctx.beginPath()
    let relCount = 0
    for (const p of projectedPoints) {
      if (p.cell.zone === closest.zone && p.cell !== closest as any && relCount < 20) {
        const d = Math.hypot(p.sx - closest.sx, p.sy - closest.sy)
        if (d < 200 * zoom) {
          ctx.moveTo(closest.sx, closest.sy)
          const midX = (closest.sx + p.sx) / 2
          const midY = (closest.sy + p.sy) / 2 - (20 * Math.sin(time + p.x))
          ctx.quadraticCurveTo(midX, midY, p.sx, p.sy)
          relCount++
        }
      }
    }
    ctx.stroke()

    // Floating label
    const lx = closest.sx + 40 * zoom, ly = closest.sy - 40 * zoom
    ctx.fillStyle = closest.zone.color; ctx.globalAlpha = 1
    ctx.font = `bold ${12 * zoom}px Courier New`
    ctx.fillText(closest.zone.name, lx, ly)
    ctx.strokeStyle = closest.zone.color; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(closest.sx, closest.sy); ctx.lineTo(lx, ly); ctx.stroke()
  }

  ctx.globalAlpha = 1

  // ── UPDATE READER PANEL ──
  if (closest && closest !== hoverCell) {
    hoverCell = closest
    document.getElementById('zone-header')!.innerText = closest.zone.flavor
    document.getElementById('zone-header')!.style.color = closest.color
    document.getElementById('text-display')!.innerHTML = `> ${closest.zone.name}<br>"${closest.text}"`

    // Pretext reader panel — full zone lore
    const key = loreKeyForZone(closest.zone)
    const prepared = getPrepared(key)
    const panelW = 256
    const lh = Math.ceil(charSize * 1.3)
    const lines = layoutWithLines(prepared, panelW, lh)

    ptReaderCtx.clearRect(0, 0, ptReaderCanvas.width, ptReaderCanvas.height)
    ptReaderCtx.font = currentFont
    ptReaderCtx.fillStyle = closest.zone.color
    ptReaderCtx.textAlign = 'left'
    ptReaderCtx.textBaseline = 'top'
    for (let i = 0; i < lines.lines.length; i++) {
      ptReaderCtx.fillText(lines.lines[i]!.text, 4, 4 + i * lh)
    }
    document.getElementById('pretext-reader')!.classList.add('visible')
    document.getElementById('data-display')!.innerText = `${lines.lines.length} lines · ${key} · pretext ${lastPtMs.toFixed(1)}ms`
    document.getElementById('sb-zone')!.innerText = closest.zone.name
  }

  // ── MINIMAP ──
  mmCtx.fillStyle = '#111'; mmCtx.fillRect(0, 0, 100, 100)
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      mmCtx.fillStyle = gridState[y]![x]!.color
      mmCtx.globalAlpha = 0.4
      mmCtx.fillRect(x * 3.1, y * 3.1, 3, 3)
    }
  }
  if (closest) { mmCtx.fillStyle = '#fff'; mmCtx.globalAlpha = 1; mmCtx.fillRect(closest.x * 3.1, closest.y * 3.1, 4, 4) }
  mmCtx.globalAlpha = 1
}

// ══════════════════════════════════════════════════════════════
// RENDER: LIDAR MODE — Two-Layer Architecture
// Layer 1: Solid colored wall strips (ALL walls) → spatial depth
// Layer 2: Screen-aligned Pretext text (CENTER wall) → readable lore
// Layer 3: Hot words + tendrils → hyperlink world
// Layer 4: Particles, crosshair, ambient → habitable space
// ══════════════════════════════════════════════════════════════
let scanPulseTime = -1

interface RayHit {
  screenX: number
  perp: number
  drawStart: number
  drawEnd: number
  mapX: number
  mapY: number
  side: number
  wallX: number
  loreKey: string
  zone: typeof ZONES[string]
}

function renderLidar(): void {
  const ms = 0.06, rs = 0.05
  hotWordHits = [] // Clear hit boxes for this frame

  // Movement
  if (keys['a'] || keys['arrowleft']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(rs) - player.dirY * Math.sin(rs)
    player.dirY = od * Math.sin(rs) + player.dirY * Math.cos(rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(rs) - player.planeY * Math.sin(rs)
    player.planeY = op * Math.sin(rs) + player.planeY * Math.cos(rs)
  }
  if (keys['d'] || keys['arrowright']) {
    const od = player.dirX
    player.dirX = player.dirX * Math.cos(-rs) - player.dirY * Math.sin(-rs)
    player.dirY = od * Math.sin(-rs) + player.dirY * Math.cos(-rs)
    const op = player.planeX
    player.planeX = player.planeX * Math.cos(-rs) - player.planeY * Math.sin(-rs)
    player.planeY = op * Math.sin(-rs) + player.planeY * Math.cos(-rs)
  }
  if (keys['w'] || keys['arrowup']) {
    const nx = player.x + player.dirX * ms, ny = player.y + player.dirY * ms
    if (LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)] !== '#') player.x = nx
    if (LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)] !== '#') player.y = ny
  }
  if (keys['s'] || keys['arrowdown']) {
    const nx = player.x - player.dirX * ms, ny = player.y - player.dirY * ms
    if (LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)] !== '#') player.x = nx
    if (LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)] !== '#') player.y = ny
  }

  // Smooth glide toward clicked zone (calm, not snapping)
  if (playerGlideTarget) {
    // Any manual movement cancels glide
    if (keys['w'] || keys['s'] || keys['a'] || keys['d'] ||
        keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright']) {
      playerGlideTarget = null
    } else {
      const dx = playerGlideTarget.x - player.x
      const dy = playerGlideTarget.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.5) {
        playerGlideTarget = null
      } else {
        const ease = 0.02 // slow, contemplative drift
        const nx = player.x + dx * ease
        const ny = player.y + dy * ease
        // Collision-aware movement
        if (LIDAR_PLAN[Math.floor(player.y)]?.[Math.floor(nx)] !== '#') player.x = nx
        if (LIDAR_PLAN[Math.floor(ny)]?.[Math.floor(player.x)] !== '#') player.y = ny
        // Turn to face destination
        const targetAngle = Math.atan2(dy, dx)
        const currentAngle = Math.atan2(player.dirY, player.dirX)
        let angleDiff = targetAngle - currentAngle
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        const turnRate = 0.03
        if (Math.abs(angleDiff) > 0.05) {
          const turn = angleDiff * turnRate
          const c = Math.cos(turn), s = Math.sin(turn)
          const od = player.dirX
          player.dirX = od * c - player.dirY * s
          player.dirY = od * s + player.dirY * c
          const op = player.planeX
          player.planeX = op * c - player.planeY * s
          player.planeY = op * s + player.planeY * c
        }
      }
    }
  }

  lidarCtx.fillStyle = '#000'
  lidarCtx.fillRect(0, 0, cw, ch)

  // Sky with stars
  const gs = lidarCtx.createLinearGradient(0, 0, 0, ch / 2)
  gs.addColorStop(0, '#000510')
  gs.addColorStop(0.6, '#060318')
  gs.addColorStop(1, '#0a0520')
  lidarCtx.fillStyle = gs
  lidarCtx.fillRect(0, 0, cw, ch / 2)

  // Starfield (seeded once, twinkling)
  for (let i = 0; i < skyStars.length; i++) {
    const s = skyStars[i]!
    const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * s.speed + s.phase))
    lidarCtx.globalAlpha = s.brightness * twinkle
    lidarCtx.fillStyle = s.color
    lidarCtx.fillRect(s.x, s.y, s.size, s.size)
  }
  lidarCtx.globalAlpha = 1

  // Ground with texture
  const gg = lidarCtx.createLinearGradient(0, ch / 2, 0, ch)
  gg.addColorStop(0, '#0c0a1a')
  gg.addColorStop(0.3, '#080612')
  gg.addColorStop(1, '#020108')
  lidarCtx.fillStyle = gg
  lidarCtx.fillRect(0, ch / 2, cw, ch / 2)

  // Ground hash marks (perspective receding texture)
  lidarCtx.globalAlpha = 0.08
  lidarCtx.fillStyle = '#3a2820'
  for (let row = 0; row < 20; row++) {
    const yRatio = row / 20
    const gy = ch / 2 + yRatio * ch / 2
    const spacing = Math.max(8, 60 * (1 - yRatio))
    for (let gx = 0; gx < cw; gx += spacing) {
      const jitter = Math.sin(gx * 0.1 + row * 2.7) * 3
      lidarCtx.fillRect(gx + jitter, gy, 2 + yRatio * 3, 1)
    }
  }
  // Ground zone glow — subtle color from nearest zone
  const pMx = Math.floor(player.x), pMy = Math.floor(player.y)
  const pRow = LIDAR_PLAN[pMy]
  if (pRow) {
    const nearZone = zoneForRadius(Math.sqrt((pMx - CENTER) ** 2 + (pMy - CENTER) ** 2))
    const gzg = lidarCtx.createRadialGradient(cw / 2, ch, 0, cw / 2, ch, ch / 2)
    gzg.addColorStop(0, nearZone.color + '15')
    gzg.addColorStop(1, 'transparent')
    lidarCtx.globalAlpha = 0.3
    lidarCtx.fillStyle = gzg
    lidarCtx.fillRect(0, ch / 2, cw, ch / 2)
  }
  lidarCtx.globalAlpha = 1

  const pulseDt = time - scanPulseTime
  const pulseActive = pulseDt >= 0 && pulseDt < 3

  // ═══ PASS 1: Raycast every column ═══
  const hits: (RayHit | null)[] = []
  let centerHit: RayHit | null = null
  const centerCol = Math.floor(cw / 2)

  for (let x = 0; x < cw; x++) {
    const camX = 2 * x / cw - 1
    const rdx = player.dirX + player.planeX * camX
    const rdy = player.dirY + player.planeY * camX

    let mx = Math.floor(player.x), my = Math.floor(player.y)
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy)
    let sdx: number, sdy: number, sx: number, sy: number, side = 0

    if (rdx < 0) { sx = -1; sdx = (player.x - mx) * ddx }
    else { sx = 1; sdx = (mx + 1 - player.x) * ddx }
    if (rdy < 0) { sy = -1; sdy = (player.y - my) * ddy }
    else { sy = 1; sdy = (my + 1 - player.y) * ddy }

    let hit = false
    for (let d = 0; d < 30; d++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0 }
      else { sdy += ddy; my += sy; side = 1 }
      const tile = LIDAR_PLAN[my]?.[mx]
      if (tile && tile !== '.') { hit = true; break }
    }

    if (!hit) { hits.push(null); continue }

    let perp: number
    if (side === 0) perp = (mx - player.x + (1 - sx) / 2) / rdx
    else perp = (my - player.y + (1 - sy) / 2) / rdy
    if (perp < 0.01) perp = 0.01

    const lineH = Math.floor(ch / perp)
    const drawStart = Math.max(0, (ch - lineH) / 2)
    const drawEnd = Math.min(ch, (ch + lineH) / 2)

    let wallX: number
    if (side === 0) wallX = player.y + perp * rdy
    else wallX = player.x + perp * rdx
    wallX -= Math.floor(wallX)

    const wallChar = LIDAR_PLAN[my]?.[mx] || '#'
    const loreKey = WALL_LORE[wallChar] || 'cave'
    const zone = loreKey === 'shack' ? ZONES.SHACK! : loreKey === 'creek' ? ZONES.CREEK! :
      loreKey === 'ridge' ? ZONES.RIDGE! : loreKey === 'puddle' ? ZONES.PUDDLE! : ZONES.CAVE!

    const rh: RayHit = { screenX: x, perp, drawStart, drawEnd, mapX: mx, mapY: my, side, wallX, loreKey, zone }
    hits.push(rh)

    if (x === centerCol) centerHit = rh
  }

  // ═══ PASS 2: Group into wall faces ═══
  interface WallFace {
    startX: number; endX: number
    minDrawStart: number; maxDrawEnd: number
    avgPerp: number
    loreKey: string
    zone: typeof ZONES[string]
    side: number
    mapX: number; mapY: number
  }

  const faces: WallFace[] = []
  let curFace: WallFace | null = null

  for (let x = 0; x < cw; x++) {
    const h = hits[x]
    if (!h) {
      if (curFace) { faces.push(curFace); curFace = null }
      continue
    }
    if (curFace && h.mapX === curFace.mapX && h.mapY === curFace.mapY && h.side === curFace.side) {
      curFace.endX = x
      curFace.minDrawStart = Math.min(curFace.minDrawStart, h.drawStart)
      curFace.maxDrawEnd = Math.max(curFace.maxDrawEnd, h.drawEnd)
      curFace.avgPerp = (curFace.avgPerp + h.perp) / 2
    } else {
      if (curFace) faces.push(curFace)
      curFace = {
        startX: x, endX: x,
        minDrawStart: h.drawStart, maxDrawEnd: h.drawEnd,
        avgPerp: h.perp, loreKey: h.loreKey, zone: h.zone, side: h.side,
        mapX: h.mapX, mapY: h.mapY,
      }
    }
  }
  if (curFace) faces.push(curFace)

  // Find which face the crosshair is on
  let centerFace: WallFace | null = null
  for (const f of faces) {
    if (f.startX <= centerCol && f.endX >= centerCol) { centerFace = f; break }
  }

  // ═══ UNIFIED RENDERING: Every wall face is made of text ═══
  // Close = large readable text on black bg
  // Far = tiny text as texture over zone color
  // Center face = enhanced with hot-word highlighting

  for (const face of faces) {
    const faceW = face.endX - face.startX + 1
    const faceH = face.maxDrawEnd - face.minDrawStart
    if (faceW < 2 || faceH < 4) continue

    const isCenter = face === centerFace
    let bright = Math.max(0.1, 1 - face.avgPerp / 12) * (face.side === 1 ? 0.7 : 1)
    // Center face needs minimum brightness for readability
    if (isCenter) bright = Math.max(0.5, bright)

    if (pulseActive) {
      const pulseR = pulseDt * 8
      if (Math.abs(face.avgPerp - pulseR) < 1.5) bright = Math.min(1, bright + 0.6)
    }

    const hex = face.zone.color
    const cr = parseInt(hex.slice(1, 3), 16)
    const cg = parseInt(hex.slice(3, 5), 16)
    const cb = parseInt(hex.slice(5, 7), 16)

    // ── CLIP: center face uses INSCRIBED RECTANGLE (no mid-character cuts) ──
    // Peripheral faces use trapezoid clip (texture doesn't need perfect readability)
    lidarCtx.save()
    lidarCtx.beginPath()
    const lHit = hits[face.startX], rHit = hits[face.endX]

    // Compute inscribed rectangle: largest rect fully inside the trapezoid
    const inscribedTop = Math.max(lHit?.drawStart ?? face.minDrawStart, rHit?.drawStart ?? face.minDrawStart)
    const inscribedBot = Math.min(lHit?.drawEnd ?? face.maxDrawEnd, rHit?.drawEnd ?? face.maxDrawEnd)

    if (isCenter && faceW > 60) {
      // Rectangle clip — text never gets cut at perspective angles
      lidarCtx.rect(face.startX, inscribedTop, faceW, inscribedBot - inscribedTop)
    } else if (lHit && rHit) {
      // Trapezoid clip for peripheral faces
      lidarCtx.moveTo(face.startX, lHit.drawStart)
      lidarCtx.lineTo(face.endX + 1, rHit.drawStart)
      lidarCtx.lineTo(face.endX + 1, rHit.drawEnd)
      lidarCtx.lineTo(face.startX, lHit.drawEnd)
    } else {
      lidarCtx.rect(face.startX, face.minDrawStart, faceW, faceH)
    }
    lidarCtx.clip()

    // Background: dark zone-tinted base → brighter when closer
    const bgDarkness = Math.max(0.05, 0.3 - face.avgPerp * 0.02)
    lidarCtx.globalAlpha = 1
    lidarCtx.fillStyle = `rgb(${cr * bgDarkness | 0},${cg * bgDarkness | 0},${cb * bgDarkness | 0})`
    lidarCtx.fillRect(face.startX, face.minDrawStart, faceW, faceH)

    // Center face: use inscribed rect bounds for text area
    const textTop = isCenter ? inscribedTop : face.minDrawStart
    const textBot = isCenter ? inscribedBot : face.maxDrawEnd
    const textFaceH = textBot - textTop

    // Center face gets black overlay for max text contrast
    if (isCenter && faceW > 60) {
      lidarCtx.globalAlpha = 0.94
      lidarCtx.fillStyle = '#050508'
      lidarCtx.fillRect(face.startX, textTop, faceW, textFaceH)

      // Zone border frame
      lidarCtx.fillStyle = face.zone.color
      lidarCtx.globalAlpha = 0.7
      lidarCtx.fillRect(face.startX, textTop, faceW, 2)
      lidarCtx.fillRect(face.startX, textBot - 2, faceW, 2)
      lidarCtx.fillRect(face.startX, textTop, 2, textFaceH)
      lidarCtx.fillRect(face.endX - 1, textTop, 2, textFaceH)
    }

    // Font scales with distance: close = large readable, far = tiny texture
    const fontSize = isCenter
      ? Math.max(12, Math.min(18, textFaceH / 18))
      : Math.max(5, Math.min(14, faceH / 10))
    const lh = fontSize * 1.35
    const padding = isCenter ? Math.max(12, fontSize) : Math.max(3, fontSize * 0.4)

    // Get Pretext lines for this face width — measured at EXACT render font
    const textW = Math.max(10, faceW - padding * 2)
    const t0 = performance.now()
    const lines = getWallLines(face.loreKey, textW, fontSize)
    lastPtMs = performance.now() - t0

    // Render style
    lidarCtx.font = `${fontSize}px Courier New`
    lidarCtx.textAlign = 'left'
    lidarCtx.textBaseline = 'top'

    if (isCenter && faceW > 60) {
      // ── CENTER FACE: Enhanced with hot-word highlighting ──
      lidarCtx.shadowColor = face.zone.color
      lidarCtx.shadowBlur = 2

      // Zone header
      lidarCtx.globalAlpha = 0.85
      lidarCtx.font = 'bold 11px Courier New'
      lidarCtx.fillStyle = face.zone.color
      lidarCtx.fillText(`${face.zone.name} · ${face.zone.flavor}`, face.startX + padding, textTop + 6)

      lidarCtx.font = `${fontSize}px Courier New`
      let ly = textTop + 22
      let lineIdx = 0

      while (ly < textBot - 4 && lineIdx < lines.length) {
        const txt = lines[lineIdx]!
        lidarCtx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)

        // Hot-word scan — zone-aware: only outbound portals glow
        type Seg = { start: number; end: number; color: string; isPortal: boolean }
        const hotSegs: Seg[] = []
        const wallZone = face.loreKey // which zone this wall belongs to
        for (const [word, color] of Object.entries(HOT_WORDS)) {
            const node = CLUE_GRAPH[word]
            // Skip words from the same zone — they're not portals, they're local
            const isPortal = node ? node.zone !== wallZone : true // meta labels are always portals
            let idx = txt.toLowerCase().indexOf(word.toLowerCase())
            while (idx >= 0) {
              hotSegs.push({ start: idx, end: idx + word.length, color, isPortal })
              idx = txt.toLowerCase().indexOf(word.toLowerCase(), idx + word.length)
            }
          }
        hotSegs.sort((a, b) => a.start - b.start)

        let x = face.startX + padding
        if (hotSegs.length === 0) {
          lidarCtx.fillStyle = '#e8e0d0'
          lidarCtx.fillText(txt, x, ly)
        } else {
          let cur = 0
          for (const seg of hotSegs) {
            if (seg.start < cur) continue
            if (seg.start > cur) {
              const plain = txt.substring(cur, seg.start)
              lidarCtx.fillStyle = '#e8e0d0'
              lidarCtx.fillText(plain, x, ly)
              x += lidarCtx.measureText(plain).width
            }
            const hotText = txt.substring(seg.start, seg.end)
            const hotW = lidarCtx.measureText(hotText).width

            if (seg.isPortal) {
              // ═══ PORTAL: bright, glowing, underlined, clickable ═══
              lidarCtx.fillStyle = seg.color
              lidarCtx.shadowColor = seg.color
              lidarCtx.shadowBlur = 8
              lidarCtx.fillText(hotText, x, ly)
              // Double underline for portals
              lidarCtx.fillRect(x, ly + fontSize - 1, hotW, 1.5)
              // Record hit box — only portals are clickable
              hotWordHits.push({ x, y: ly, w: hotW, h: lh, word: hotText, color: seg.color, zone: face.loreKey })
            } else {
              // ═══ LOCAL: dim tint, no glow, no underline, not clickable ═══
              lidarCtx.fillStyle = seg.color
              lidarCtx.globalAlpha = 0.4
              lidarCtx.fillText(hotText, x, ly)
              lidarCtx.globalAlpha = 0.9 + 0.1 * Math.sin(lineIdx * 0.2 + time * 0.15)
            }

            lidarCtx.shadowBlur = 2
            lidarCtx.shadowColor = face.zone.color
            x += hotW
            cur = seg.end
          }
          if (cur < txt.length) {
            lidarCtx.fillStyle = '#e8e0d0'
            lidarCtx.fillText(txt.substring(cur), x, ly)
          }
        }

        ly += lh
        lineIdx++
        if (lineIdx > 200) break
      }

      lidarCtx.shadowBlur = 0

      // Pretext badge
      lidarCtx.font = 'bold 9px Courier New'
      lidarCtx.fillStyle = '#0fa'
      lidarCtx.globalAlpha = 0.4
      lidarCtx.fillText(`PRETEXT · ${lines.length} LINES`, face.startX + padding, textBot - 12)

      // Hover highlight on clickable hot words
      if (hoveredHotWord) {
        lidarCtx.globalAlpha = 0.3
        lidarCtx.strokeStyle = hoveredHotWord.color
        lidarCtx.lineWidth = 1.5
        lidarCtx.strokeRect(hoveredHotWord.x - 2, hoveredHotWord.y - 1, hoveredHotWord.w + 4, hoveredHotWord.h + 2)
        lidarCtx.globalAlpha = 0.08
        lidarCtx.fillStyle = hoveredHotWord.color
        lidarCtx.fillRect(hoveredHotWord.x - 2, hoveredHotWord.y - 1, hoveredHotWord.w + 4, hoveredHotWord.h + 2)
      }

      document.getElementById('sb-zone')!.innerText = face.zone.name

    } else {
      // ── PERIPHERAL WALLS: Text as material ──
      // Use bright readable text, not zone-colored (dark zones were invisible)
      lidarCtx.fillStyle = '#d4cfc0'

      let ly = face.minDrawStart + 2
      let lineIdx = 0
      while (ly < face.maxDrawEnd && lineIdx < lines.length) {
        const txt = lines[lineIdx]!
        lidarCtx.globalAlpha = bright * (0.55 + 0.15 * Math.sin(lineIdx * 0.5 + time * 0.3))
        lidarCtx.fillText(txt, face.startX + padding, ly)
        ly += lh
        lineIdx++
      }
    }

    // Zone edge accents
    lidarCtx.globalAlpha = bright * 0.4
    lidarCtx.fillStyle = face.zone.color
    lidarCtx.fillRect(face.startX, face.minDrawStart, 1, faceH)
    lidarCtx.fillRect(face.endX, face.minDrawStart, 1, faceH)

    lidarCtx.restore()
  }

  // ═══ LAYER 3: Investigation Tendrils ═══
  // When a clue is active, draw threads to all visible connected words
  if (activePursuit && hotWordHits.length > 0) {
    // Find the active word's hit box(es) on screen
    const activeHits = hotWordHits.filter(h => {
      const node = CLUE_GRAPH[h.word]
      return node === activePursuit
    })
    // Find all connected words' hit boxes on screen
    const connectedWords = new Set(activePursuit.connections)
    const targetHits = hotWordHits.filter(h => connectedWords.has(h.word))

    if (activeHits.length > 0 && targetHits.length > 0) {
      const ah = activeHits[0]! // primary source
      const ax = ah.x + ah.w / 2
      const ay = ah.y + ah.h / 2

      lidarCtx.lineWidth = 1.5
      let tCount = 0
      for (const th of targetHits) {
        if (tCount >= 12) break
        const tx = th.x + th.w / 2
        const ty = th.y + th.h / 2
        const cn = CLUE_GRAPH[th.word]
        const color = cn ? cn.color : activePursuit.color

        // Pulse alpha
        const pulse = 0.15 + 0.2 * Math.sin(time * 0.8 + tCount * 0.7)
        lidarCtx.globalAlpha = pulse
        lidarCtx.strokeStyle = color

        // Bezier thread
        const midX = (ax + tx) / 2
        const midY = Math.min(ay, ty) - 25 - 15 * Math.sin(time * 0.5 + tCount)

        lidarCtx.beginPath()
        lidarCtx.moveTo(ax, ay)
        lidarCtx.quadraticCurveTo(midX, midY, tx, ty)
        lidarCtx.stroke()

        // Glow dot at target
        lidarCtx.globalAlpha = pulse + 0.1
        lidarCtx.fillStyle = color
        lidarCtx.beginPath()
        lidarCtx.arc(tx, ty, 3, 0, Math.PI * 2)
        lidarCtx.fill()

        tCount++
      }
    }
    lidarCtx.globalAlpha = 1
  }
  // Fallback: zone-based tendrils when no pursuit is active
  else if (centerFace) {
    const cfx = (centerFace.startX + centerFace.endX) / 2
    const cfy = (centerFace.minDrawStart + centerFace.maxDrawEnd) / 2

    lidarCtx.lineWidth = 1.5
    lidarCtx.strokeStyle = centerFace.zone.color
    lidarCtx.globalAlpha = 0.25

    lidarCtx.beginPath()
    let threadCount = 0
    for (const f of faces) {
      if (f === centerFace) continue
      if (f.loreKey !== centerFace.loreKey) continue
      if (threadCount >= 8) break

      const fx = (f.startX + f.endX) / 2
      const fy = (f.minDrawStart + f.maxDrawEnd) / 2
      const midX = (cfx + fx) / 2
      const midY = Math.min(cfy, fy) - 30 - 20 * Math.sin(time * 0.7 + threadCount)

      lidarCtx.moveTo(cfx, cfy)
      lidarCtx.quadraticCurveTo(midX, midY, fx, fy)
      threadCount++
    }
    lidarCtx.stroke()
    lidarCtx.globalAlpha = 1
  }

  // ═══ LAYER 4: Particles, crosshair, ambient ═══

  // Floating particles in the corridor
  if (Math.random() < 0.1) spawnParticle()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.x += p.vx; p.y += p.vy; p.life++
    if (p.life > p.maxLife) { particles.splice(i, 1); continue }
    const a = Math.sin(Math.PI * p.life / p.maxLife) * 0.3
    lidarCtx.globalAlpha = a
    lidarCtx.fillStyle = '#daa520'
    lidarCtx.beginPath()
    lidarCtx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2)
    lidarCtx.fill()
  }

  lidarCtx.globalAlpha = 1

  // Crosshair
  lidarCtx.strokeStyle = '#fff'
  lidarCtx.lineWidth = 1
  lidarCtx.globalAlpha = 0.4
  lidarCtx.beginPath()
  lidarCtx.moveTo(cw / 2 - 10, ch / 2); lidarCtx.lineTo(cw / 2 + 10, ch / 2)
  lidarCtx.moveTo(cw / 2, ch / 2 - 10); lidarCtx.lineTo(cw / 2, ch / 2 + 10)
  lidarCtx.stroke()

  lidarCtx.globalAlpha = 1

  // Instructions
  lidarCtx.font = 'bold 11px Courier New'
  lidarCtx.textAlign = 'center'
  lidarCtx.textBaseline = 'bottom'
  lidarCtx.fillStyle = '#555'
  lidarCtx.fillText('WASD TO MOVE · SPACE TO SCAN · ESC TO EXIT', cw / 2, ch - 12)


  // ═══ MINIMAP with investigation web ═══
  const mmW = mmCanvas.width, mmH = mmCanvas.height
  mmCtx.fillStyle = '#000'; mmCtx.fillRect(0, 0, mmW, mmH)
  const mmScale = mmW / Math.max(LIDAR_W, LIDAR_H)

  // Floor plan
  for (let my2 = 0; my2 < LIDAR_H; my2++) {
    for (let mx2 = 0; mx2 < LIDAR_W; mx2++) {
      const t = LIDAR_PLAN[my2]![mx2]!
      if (t === '.') continue
      const wk = WALL_LORE[t]
      const wz = wk === 'shack' ? ZONES.SHACK! : wk === 'creek' ? ZONES.CREEK! :
        wk === 'ridge' ? ZONES.RIDGE! : wk === 'puddle' ? ZONES.PUDDLE! : t === '#' ? null : ZONES.CAVE!
      mmCtx.fillStyle = wz ? wz.color : '#333'
      mmCtx.globalAlpha = 0.3
      mmCtx.fillRect(mx2 * mmScale, my2 * mmScale, mmScale, mmScale)
    }
  }
  mmCtx.globalAlpha = 1

  // Zone center positions on minimap
  const mmZones: Record<string, { x: number; y: number }> = {
    shack: { x: (CENTER + 2) * mmScale, y: (CENTER + 2) * mmScale },
    creek: { x: (CENTER + 6) * mmScale, y: CENTER * mmScale },
    ridge: { x: CENTER * mmScale, y: (CENTER + 10) * mmScale },
    cave:  { x: (CENTER + 14) * mmScale, y: (CENTER + 14) * mmScale },
    puddle:{ x: (CENTER - 5) * mmScale, y: (CENTER + 13) * mmScale },
  }

  // Draw connection lines between clue nodes
  mmCtx.lineWidth = 0.5
  const drawnEdges = new Set<string>()
  for (const node of Object.values(CLUE_GRAPH)) {
    const from = mmZones[node.zone]
    if (!from) continue
    for (const conn of node.connections) {
      const cn = CLUE_GRAPH[conn]
      if (!cn) continue
      const edgeKey = [node.word, cn.word].sort().join('→')
      if (drawnEdges.has(edgeKey)) continue
      drawnEdges.add(edgeKey)

      // Only draw cross-zone connections (portals)
      if (cn.zone === node.zone) continue
      const to = mmZones[cn.zone]
      if (!to) continue

      // Spread endpoints slightly per node so lines don't all overlap
      const hashA = node.word.charCodeAt(0) % 7 - 3
      const hashB = cn.word.charCodeAt(0) % 7 - 3

      mmCtx.globalAlpha = (activePursuit && (activePursuit === node || activePursuit === cn)) ? 0.6 : 0.12
      mmCtx.strokeStyle = node.color
      mmCtx.beginPath()
      mmCtx.moveTo(from.x + hashA, from.y + hashA * 0.7)
      mmCtx.lineTo(to.x + hashB, to.y + hashB * 0.7)
      mmCtx.stroke()
    }
  }

  // Draw zone cluster dots
  mmCtx.globalAlpha = 1
  for (const [zone, pos] of Object.entries(mmZones)) {
    const zoneNodes = Object.values(CLUE_GRAPH).filter(n => n.zone === zone)
    const collected = zoneNodes.filter(n => n.collected).length
    const zoneColor = zone === 'shack' ? '#daa520' : zone === 'creek' ? '#4682b4' :
      zone === 'ridge' ? '#cd853f' : zone === 'cave' ? '#4b0082' : '#2f4f4f'

    // Zone dot — size based on number of nodes
    const r = 3 + Math.min(4, zoneNodes.length * 0.3)
    mmCtx.fillStyle = zoneColor
    mmCtx.globalAlpha = 0.6
    mmCtx.beginPath()
    mmCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    mmCtx.fill()

    // Collected ring
    if (collected > 0) {
      mmCtx.globalAlpha = 0.8
      mmCtx.strokeStyle = '#fff'
      mmCtx.lineWidth = 1
      mmCtx.beginPath()
      mmCtx.arc(pos.x, pos.y, r + 1, 0, Math.PI * 2 * (collected / zoneNodes.length))
      mmCtx.stroke()
    }

    // Zone label
    mmCtx.globalAlpha = 0.5
    mmCtx.font = 'bold 6px Courier New'
    mmCtx.fillStyle = '#fff'
    mmCtx.textAlign = 'center'
    mmCtx.textBaseline = 'top'
    mmCtx.fillText(zone.charAt(0).toUpperCase(), pos.x, pos.y + r + 2)
  }

  // Active pursuit — pulse the home zone
  if (activePursuit) {
    const ap = mmZones[activePursuit.zone]
    if (ap) {
      const pulse = 4 + 2 * Math.sin(time * 2)
      mmCtx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 2)
      mmCtx.strokeStyle = activePursuit.color
      mmCtx.lineWidth = 1.5
      mmCtx.beginPath()
      mmCtx.arc(ap.x, ap.y, pulse, 0, Math.PI * 2)
      mmCtx.stroke()
    }
  }

  // Player position + direction
  mmCtx.globalAlpha = 1
  mmCtx.fillStyle = '#0ff'
  mmCtx.fillRect(player.x * mmScale - 2, player.y * mmScale - 2, 4, 4)
  mmCtx.strokeStyle = '#0ff'; mmCtx.lineWidth = 1
  mmCtx.beginPath()
  mmCtx.moveTo(player.x * mmScale, player.y * mmScale)
  mmCtx.lineTo((player.x + player.dirX * 2) * mmScale, (player.y + player.dirY * 2) * mmScale)
  mmCtx.stroke()
}

function lidarScan(): void {
  scanPulseTime = time
  // Show scanner output with Pretext-laid-out text for the nearest wall
  const lookX = Math.floor(player.x + player.dirX * 1.5)
  const lookY = Math.floor(player.y + player.dirY * 1.5)
  const tile = LIDAR_PLAN[lookY]?.[lookX]
  if (tile && tile !== '.') {
    const loreKey = WALL_LORE[tile] || 'cave'
    const lines = getWallLines(loreKey, 400)
    const scannerEl = document.getElementById('scanner-output')!
    scannerEl.textContent = `[LIDAR SCAN · ${loreKey.toUpperCase()}]\n\n${lines.join('\n')}`
    scannerEl.classList.add('visible')
    setTimeout(() => scannerEl.classList.remove('visible'), 4000)
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════════════════════
function loop(): void {
  requestAnimationFrame(loop)
  time += 0.02

  if (engineMode === 'GRID') {
    renderGrid()
  } else {
    renderLidar()
  }

  // HUD
  document.getElementById('pretext-hud')!.innerText = `PRETEXT · ${lastPtMs.toFixed(1)}ms`
  document.getElementById('sb-layout')!.innerText = `${lastPtMs.toFixed(1)}ms`
  document.getElementById('sb-mode')!.innerText = engineMode === 'GRID' ? viewMode : 'LIDAR'

  if (engineMode === 'LIDAR') {
    document.getElementById('ui-coords')!.innerText = `POS: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`
    // LLM status indicator
    const llmEl = document.getElementById('sb-llm')
    if (llmEl) {
      if (llmGenerating) {
        llmEl.innerText = '⟳ GENERATING...'
        llmEl.style.color = '#ff9922'
      } else if (llmUrl) {
        llmEl.innerText = llmStatus || 'G = GENERATE'
        llmEl.style.color = llmActive ? '#0fa' : '#888'
      } else {
        llmEl.innerText = '?llm_url= TO ENABLE'
        llmEl.style.color = '#555'
      }
    }
  } else {
    const hc = hoverCell
    document.getElementById('ui-coords')!.innerText = hc ? `LOC: ${hc.x - 16}, ${hc.y - 16}` : 'LOC: —'
  }
}

// ══════════════════════════════════════════════════════════════
// MODE SWITCHING
// ══════════════════════════════════════════════════════════════
function setMode(mode: 'GRID' | 'LIDAR'): void {
  engineMode = mode
  const lidarLayer = document.getElementById('lidar-layer')!
  const gridControls = document.getElementById('grid-controls')!
  const readerPanel = document.getElementById('reader-panel')!
  const btnLidar = document.getElementById('btn-lidar')!

  if (mode === 'LIDAR') {
    lidarLayer.classList.add('active')
    gridControls.style.display = 'none'
    readerPanel.style.display = 'none'
    btnLidar.innerText = 'EXIT LIDAR'
    btnLidar.style.borderColor = '#0ff'
    btnLidar.style.color = '#0ff'
  } else {
    lidarLayer.classList.remove('active')
    gridControls.style.display = ''
    readerPanel.style.display = ''
    btnLidar.innerText = 'ENTER LIDAR'
    btnLidar.style.borderColor = ''
    btnLidar.style.color = ''
  }
}

// ══════════════════════════════════════════════════════════════
// CONTROLS
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-view')!.addEventListener('click', () => {
  viewMode = viewMode === 'TOPO' ? 'ORBIT' : 'TOPO'
  document.getElementById('btn-view')!.innerText = `VIEW: ${viewMode}`
})
document.getElementById('btn-recenter')!.addEventListener('click', () => { panX = 0; panY = 0; zoom = 1.2 })
document.getElementById('btn-size-up')!.addEventListener('click', () => { charSize = Math.min(24, charSize + 2); currentFont = '' })
document.getElementById('btn-size-dn')!.addEventListener('click', () => { charSize = Math.max(6, charSize - 2); currentFont = '' })
document.getElementById('btn-lidar')!.addEventListener('click', () => { setMode(engineMode === 'GRID' ? 'LIDAR' : 'GRID') })

// ── SHEET SYSTEM ──
let activeSheet: string | null = null

function openSheet(id: string): void {
  if (activeSheet === id) { closeSheets(); return }
  closeSheets(); activeSheet = id
  // Refresh dynamic sheets
  if (id === 'a') populateLoreSheet()
  if (id === 'b') populateCluesSheet()
  document.getElementById('sheet-backdrop')!.classList.add('on')
  document.getElementById(`sheet-${id}`)!.classList.add('on')
  document.getElementById(`tab-${id}`)!.classList.add('on')
}

function closeSheets(): void {
  activeSheet = null
  document.getElementById('sheet-backdrop')!.classList.remove('on')
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'))
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'))
}

for (const id of ['a', 'b', 'c', 'd']) {
  document.getElementById(`tab-${id}`)!.addEventListener('click', () => openSheet(id))
  document.getElementById(`close-${id}`)!.addEventListener('click', closeSheets)
}
document.getElementById('sheet-backdrop')!.addEventListener('click', closeSheets)

// Sheet A: Populate lore with Copy buttons per zone + Upload
const loreBody = document.getElementById('lore-body')!
function populateLoreSheet(): void {
  loreBody.innerHTML = ''
  for (const [key, texts] of Object.entries(MOUNTAIN_LORE)) {
    const zone = key === 'shack' ? ZONES.SHACK! : key === 'creek' ? ZONES.CREEK! :
      key === 'ridge' ? ZONES.RIDGE! : key === 'puddle' ? ZONES.PUDDLE! : ZONES.CAVE!
    const div = document.createElement('div')
    div.style.marginBottom = '16px'
    div.innerHTML =
      `<div style="display:flex; justify-content:space-between; align-items:center;">
        <div class="sh-label" style="color:${zone.color}">${zone.name} (${texts.length} lines)</div>
        <button class="sh-btn copy-zone-btn" data-zone="${key}" style="font-size:9px; padding:2px 8px;">COPY</button>
      </div>` +
      texts.slice(0, 20).map(t => `<div style="font-size:11px; color:#aaa; padding:3px 0; border-bottom:1px solid #1a1a1a;">${t}</div>`).join('') +
      (texts.length > 20 ? `<div style="font-size:10px; color:#555; padding:4px;">... +${texts.length - 20} more</div>` : '')
    loreBody.appendChild(div)
  }

  // Copy buttons
  loreBody.querySelectorAll('.copy-zone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoneKey = (btn as HTMLElement).dataset.zone!
      const text = (MOUNTAIN_LORE[zoneKey] || []).join('\n')
      navigator.clipboard.writeText(text).then(() => {
        (btn as HTMLElement).innerText = 'COPIED ✓'
        setTimeout(() => { (btn as HTMLElement).innerText = 'COPY' }, 1500)
      })
    })
  })

  // Upload area
  const uploadDiv = document.createElement('div')
  uploadDiv.style.marginTop = '16px'
  uploadDiv.innerHTML = `
    <div class="sh-label" style="color:#0fa;">UPLOAD LORE</div>
    <div style="font-size:10px; color:#666; margin-bottom:6px;">Paste text below. Each line becomes a lore entry.</div>
    <select id="upload-zone" style="background:#1a1a1a; color:#ccc; border:1px solid #333; padding:4px 8px; margin-bottom:6px; font-size:11px;">
      <option value="shack">THE SHACK</option>
      <option value="creek">THE CREEK</option>
      <option value="ridge">THE RIDGE</option>
      <option value="puddle">THE PUDDLE</option>
      <option value="cave">THE CAVE</option>
    </select>
    <textarea id="upload-text" style="width:100%; height:80px; background:#0a0a0a; color:#ccc; border:1px solid #333; padding:8px; font-family:Courier New; font-size:11px; resize:vertical;" placeholder="Paste lore lines here..."></textarea>
    <button class="sh-btn primary" id="btn-upload-lore" style="margin-top:6px;">INJECT INTO WALLS</button>
  `
  loreBody.appendChild(uploadDiv)

  // Upload handler
  document.getElementById('btn-upload-lore')!.addEventListener('click', () => {
    const zoneKey = (document.getElementById('upload-zone') as HTMLSelectElement).value
    const text = (document.getElementById('upload-text') as HTMLTextAreaElement).value.trim()
    if (!text) return
    const lines = text.split('\n').filter(l => l.trim().length > 5)
    if (lines.length > 0) {
      injectLore(zoneKey, lines)
      prepCache.clear();
      (document.getElementById('upload-text') as HTMLTextAreaElement).value = ''
      populateLoreSheet() // refresh counts
    }
  })

  // ═══ SCENE GRAPH — upload/export clue linkages ═══
  const graphDiv = document.createElement('div')
  graphDiv.style.marginTop = '20px'
  graphDiv.style.borderTop = '1px solid #333'
  graphDiv.style.paddingTop = '16px'
  graphDiv.innerHTML = `
    <div class="sh-label" style="color:#ff8c00;">⬡ SCENE GRAPH · HYPERPORTAL LINKAGES</div>
    <div style="font-size:10px; color:#666; margin-bottom:8px; line-height:1.4;">
      Export the current clue graph or upload new nodes. Each node becomes a clickable hyperportal on the walls.<br>
      Format: <code style="color:#0fa; font-size:9px;">[{"word":"lamp","zone":"cave","connections":["beam","flashlight"],"clue":"Oil lamp. 1842 vintage."}]</code>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <button class="sh-btn" id="btn-export-graph" style="font-size:9px; padding:3px 10px;">⬇ EXPORT GRAPH JSON</button>
      <button class="sh-btn" id="btn-copy-graph" style="font-size:9px; padding:3px 10px;">⎘ COPY TO CLIPBOARD</button>
      <span id="graph-status" style="font-size:9px; color:#555; line-height:24px;">${Object.keys(CLUE_GRAPH).length} nodes</span>
    </div>
    <textarea id="upload-graph" style="width:100%; height:100px; background:#0a0a0a; color:#ccc; border:1px solid #333; padding:8px; font-family:Courier New; font-size:10px; resize:vertical;" placeholder='[{"word":"lamp","zone":"cave","connections":["beam"],"clue":"Oil lamp."}]'></textarea>
    <button class="sh-btn primary" id="btn-upload-graph" style="margin-top:6px;">MERGE INTO SCENE GRAPH</button>
  `
  loreBody.appendChild(graphDiv)

  // Export handler
  document.getElementById('btn-export-graph')!.addEventListener('click', () => {
    const exported = Object.values(CLUE_GRAPH).map(n => ({
      word: n.word, zone: n.zone, connections: n.connections,
      clue: n.clue, collected: n.collected,
    }))
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `golden-lens-graph-${Date.now()}.json`
    link.href = URL.createObjectURL(blob); link.click()
  })

  // Copy handler
  document.getElementById('btn-copy-graph')!.addEventListener('click', () => {
    const exported = Object.values(CLUE_GRAPH).map(n => ({
      word: n.word, zone: n.zone, connections: n.connections, clue: n.clue,
    }))
    navigator.clipboard.writeText(JSON.stringify(exported, null, 2)).then(() => {
      const s = document.getElementById('graph-status')
      if (s) { s.innerText = 'COPIED ✓'; s.style.color = '#0fa'
        setTimeout(() => { s.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; s.style.color = '#555' }, 1500)
      }
    })
  })

  // Upload/merge handler
  document.getElementById('btn-upload-graph')!.addEventListener('click', () => {
    const raw = (document.getElementById('upload-graph') as HTMLTextAreaElement).value.trim()
    if (!raw) return
    const statusEl = document.getElementById('graph-status')
    try {
      const nodes = JSON.parse(raw) as { word: string; zone: string; connections: string[]; clue: string }[]
      if (!Array.isArray(nodes)) throw new Error('Expected array')

      const zoneColors: Record<string, string> = {
        shack: '#daa520', creek: '#4682b4', ridge: '#cd853f', cave: '#4b0082', puddle: '#2f4f4f',
      }
      let added = 0
      for (const n of nodes) {
        if (!n.word || !n.zone || !n.connections || !n.clue) continue
        const color = zoneColors[n.zone] || '#888'
        CLUE_GRAPH[n.word] = {
          word: n.word, color, zone: n.zone,
          connections: n.connections, clue: n.clue, collected: false,
        }
        HOT_WORDS[n.word] = color
        added++
      }

      // Clear caches so walls re-render with new keywords
      prepCache.clear()
      wallLineCache.clear()

      if (statusEl) {
        statusEl.innerText = `+${added} nodes merged (${Object.keys(CLUE_GRAPH).length} total)`
        statusEl.style.color = '#0fa'
        setTimeout(() => { statusEl.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; statusEl.style.color = '#555' }, 3000)
      }
      ;(document.getElementById('upload-graph') as HTMLTextAreaElement).value = ''
    } catch (e) {
      if (statusEl) {
        statusEl.innerText = `ERROR: ${(e as Error).message}`
        statusEl.style.color = '#f44'
        setTimeout(() => { statusEl.innerText = `${Object.keys(CLUE_GRAPH).length} nodes`; statusEl.style.color = '#555' }, 4000)
      }
    }
  })
}
populateLoreSheet()

// Sheet B: Collected Clues Journal (dynamic)
const csprBody = document.getElementById('cspr-body')!
function populateCluesSheet(): void {
  csprBody.innerHTML = ''
  if (collectedClues.length === 0) {
    csprBody.innerHTML = `<div style="color:#555; font-size:12px; padding:20px; text-align:center;">No clues collected yet.<br>Click glowing words on the walls to begin your investigation.</div>`
    return
  }

  // Summary header
  const total = Object.keys(CLUE_GRAPH).length
  const header = document.createElement('div')
  header.innerHTML = `<div style="color:#daa520; font-size:11px; letter-spacing:2px; margin-bottom:12px;">INVESTIGATION LOG · ${collectedClues.length}/${total} CLUES COLLECTED</div>`
  csprBody.appendChild(header)

  // Each collected clue
  for (const node of collectedClues) {
    const div = document.createElement('div')
    div.style.cssText = 'border-bottom:1px solid #1a1a1a; padding:8px 0;'
    const connections = node.connections.map(c => {
      const cn = CLUE_GRAPH[c]
      const color = cn ? cn.color : '#666'
      const mark = cn?.collected ? '✓' : '○'
      return `<span style="color:${color}; font-size:10px; margin-right:8px;">${mark} ${c}</span>`
    }).join('')
    div.innerHTML = `
      <div style="color:${node.color}; font-weight:bold; font-size:12px; text-transform:uppercase;">${node.word} <span style="color:#555; font-size:9px; font-weight:normal;">${node.zone.toUpperCase()}</span></div>
      <div style="color:#999; font-size:11px; line-height:1.4; margin:4px 0;">${node.clue}</div>
      <div style="margin-top:4px;">${connections}</div>
    `
    csprBody.appendChild(div)
  }
}

// Sheet C: Lens config
;(document.getElementById('range-size') as HTMLInputElement).addEventListener('input', function () { charSize = parseInt(this.value, 10); currentFont = '' })
;(document.getElementById('range-coalesce') as HTMLInputElement).addEventListener('input', function () { coalesceRadius = parseInt(this.value, 10) })
;(document.getElementById('range-speed') as HTMLInputElement).addEventListener('input', function () { waveSpeed = parseInt(this.value, 10) })
document.getElementById('btn-rel-on')!.addEventListener('click', () => { showRelations = true })
document.getElementById('btn-rel-off')!.addEventListener('click', () => { showRelations = false })

// Sheet D: Export
document.getElementById('btn-export-png')!.addEventListener('click', () => {
  const c = engineMode === 'GRID' ? canvas : lidarCanvas
  const link = document.createElement('a')
  link.download = `golden-lens-${Date.now()}.png`; link.href = c.toDataURL('image/png'); link.click()
})
document.getElementById('btn-export-lore')!.addEventListener('click', () => {
  const all = Object.entries(MOUNTAIN_LORE).map(([k, v]) => `=== ${k.toUpperCase()} ===\n${v.join('\n')}`).join('\n\n')
  const blob = new Blob([all], { type: 'text/plain' })
  const link = document.createElement('a')
  link.download = 'golden-lens-lore.txt'; link.href = URL.createObjectURL(blob); link.click()
})

// ── START ──
loop()
