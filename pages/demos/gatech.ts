/**
 * GEORGIA TECH · Cognitive Cartography
 * Campus as cognitive grid. Buildings as knowledge containers.
 */
import { createCartographyEngine } from './cartography-engine.js'
import { GATECH_LORE } from './gatech-lore.js'
// @ts-ignore
import osmData from './gatech-geo.json'

createCartographyEngine({
  title: 'GEORGIA TECH',
  center: [33.7756, -84.3963],
  bounds: { latMin: 33.7700, latMax: 33.7830, lngMin: -84.4050, lngMax: -84.3880 },
  zoom: 16,
  gridSize: 128,
  accentColor: '#B3A369',
  temporalLabel: '1885 · GEORGIA SCHOOL OF TECHNOLOGY',

  memoryNodes: [
    { id: 'tech_tower', name: 'Tech Tower', badge: 'ORIGIN · LETTERMAN SHRINE',
      color: '#B3A369', textColor: '#C4B581', lat: 33.7731, lng: -84.3953,
      text: 'The tower with the letters. T-E-C-H. Four letters that have been stolen and returned more times than anyone can count. The building watches the campus from its hill like a clock face without hands.',
      historicalText: 'The Administration Building (Tech Tower) was completed in 1888, three years after the Georgia School of Technology was chartered. It is the oldest building on campus. The TECH letters were first installed in 1899.' },

    { id: 'student_center', name: 'The Student Center Vortex', badge: 'GRAVITY · SOCIAL CORE',
      color: '#FF8F00', textColor: '#FFB74D', lat: 33.7738, lng: -84.3985,
      text: 'The student center is a gravity well. All paths lead here eventually. The food court hum is a frequency that draws the hungry and the procrastinating equally. No one plans to be here. Everyone arrives.',
      historicalText: 'The site of the original campus athletic fields. Before Tech: this hillside was part of the Peters estate, a plantation whose enslaved workers cleared the forest that once covered all of Midtown.' },

    { id: 'clough', name: 'Clough Commons', badge: 'NEXUS · KNOWLEDGE BOX',
      color: '#42A5F5', textColor: '#90CAF9', lat: 33.7749, lng: -84.3964,
      text: 'A glass building full of people staring at screens. The screens stare back. Information flows in both directions. The building is transparent—you can see the knowledge being manufactured from outside.',
      historicalText: 'Clough Undergraduate Learning Commons opened in 2011 on a site that was previously an open green. The land beneath it has been continuously used for education since 1888.' },

    { id: 'crc', name: 'The Recreation Colosseum', badge: 'VELOCITY · BODY ENGINE',
      color: '#66BB6A', textColor: '#A5D6A7', lat: 33.7754, lng: -84.4032,
      text: 'The Campus Recreation Center is where minds go to temporarily forget they are minds. The pool is a rectangle of controlled drowning. The gym is a room where gravity is the opponent.',
      historicalText: 'This western edge of campus was the last to be developed. In the 1940s, these fields were used for military training during WWII when Tech became a naval training center.' },

    { id: 'binary_bridge', name: 'Binary Bridge', badge: 'THRESHOLD · 0/1 CROSSING',
      color: '#7E57C2', textColor: '#B39DDB', lat: 33.7756, lng: -84.3953,
      text: 'The pedestrian bridge is a binary gate. East campus: 0. West campus: 1. You cross and your state flips. The bridge itself is the instruction pointer. Below it: the interstate, a river of machines too fast to see.',
      historicalText: 'The bridge spans the Downtown Connector (I-75/I-85), which was carved through the campus in the 1960s, bisecting what had been a unified academic quad. The surgery was permanent.' },

    { id: 'bobby_dodd', name: 'Bobby Dodd Stadium', badge: 'ARENA · ACOUSTIC CRATER',
      color: '#F44336', textColor: '#EF9A9A', lat: 33.7722, lng: -84.3927,
      text: 'The stadium is a bowl that amplifies sound. On game days it generates a localized weather system. The concrete trembles at a frequency that migrates through the bedrock to dormitories a quarter mile away.',
      historicalText: 'Grant Field was built in 1913 and named for Hugh Inman Grant. Bobby Dodd coached here for 22 seasons. The original wooden bleachers seated 5,600. The site was a Civil War encampment before Tech existed.' },
  ],

  streetLore: {
    'Ferst Drive Northwest': { text: 'Ferst Drive is the campus artery. Buses pulse through it like blood cells. The road bends where the hill bends. The hill does not care about the road.', historicalText: 'Named for Robert Ferst, a Tech trustee and industrialist. The road follows the contour of a creek bed that was paved over in the 1920s campus expansion.', color: '#B3A369' },
    'Atlantic Drive Northwest': { text: 'Atlantic Drive connects the campus to the city. At the intersection with 10th Street, two worlds collide. Students cross against the light. Atlanta does not slow down.', historicalText: 'Named for the Atlantic Steel Company, whose mill occupied the land immediately east of campus from 1901 to 1998. The mill is now Atlantic Station.', color: '#78909C' },
    'Bobby Dodd Way Northwest': { text: 'The road named for a coach leads to a stadium named for a coach. The pavement is stained with game-day rituals. The yellow lines are just suggestions.', historicalText: 'Originally Grant Street, renamed for Alexander Robert "Bobby" Dodd (1908-1988), head coach and athletic director for 36 years.', color: '#F44336' },
    'Brittain Drive Northwest': { text: 'Brittain Drive curves past the dining hall like a question mark. The question is always the same: what\'s for lunch?', historicalText: 'Named for Marion Luther Brittain, Tech president 1922-1944. During his tenure Tech transitioned from a trade school to a research university.', color: '#8D6E63' },
    'Techwood Drive Northwest': { text: 'The western frontier. Beyond Techwood: the highway, the city, the noise. Inside Techwood: the illusion of a contained academic village.', historicalText: 'Techwood Homes (1936-2009) was America\'s first public housing project, built adjacent to the campus. Demolished for the 1996 Olympics. The name survives only in the road.', color: '#5C6BC0' },
    'Cherry Street Northwest': { text: 'Cherry Street is short and disorienting. It connects things that should not be connected. The buildings on either side lean toward each other conspiratorially.', historicalText: 'Named for the cherry trees that lined the original Peters estate entrance road. None survive.', color: '#EC407A' },
    'Fowler Street Northwest': { text: 'Fowler Street runs past the engineering buildings. The air smells of solder and ambition. The sidewalk cracks form circuit diagrams.', historicalText: 'Named for Edward Fowler, one of the original Georgia legislators who voted to establish a technological school in Atlanta in 1885.', color: '#B3A369' },
    '10th Street Northwest': { text: 'Tenth Street is the campus equator. North of it: freshman territory. South of it: the old campus, the serious buildings, the weight of history.', historicalText: 'Tenth Street marked the northern boundary of Atlanta\'s original 1847 city limits. Everything above was countryside until the railroads arrived.', color: '#78909C' },
    '5th Street Northwest': { text: '5th Street Bridge connects campus to the Midtown grid. The bridge is a declaration: the university does not end at its walls.', historicalText: 'The 5th Street corridor was once the primary approach to the Peters plantation. The bridge was built in 2007 to reconnect campus to development east of the Connector.', color: '#78909C' },
    'North Avenue Northwest': { text: 'North Avenue is the southern wall. Cross it and you leave the academic preserve and enter the commercial canyon of Midtown.', historicalText: 'North Avenue was the original southern boundary of the 1885 campus grant. Confederate breastworks were dug along this ridge during the 1864 Battle of Atlanta.', color: '#78909C' },
    'Centennial Olympic Park Drive Northwest': { text: 'The Olympic road. Named for the 1996 games that temporarily made Atlanta the center of the world. The road remembers the crowds.', historicalText: 'Built for the 1996 Olympics. The Aquatic Center on campus hosted swimming events. Before the Olympics: this was a neighborhood called Lightning. Before Lightning: Sherman\'s artillery positions.', color: '#FF9800' },
    'Downtown Connector': { text: 'The interstate below. A river of red taillights flowing south, white headlights flowing north. From the pedestrian bridge it looks like binary data streaming through a cable.', historicalText: 'I-75/I-85 was carved through Atlanta\'s urban fabric in the 1960s, destroying neighborhoods and bisecting the Tech campus. The scar has never healed. It was designed to.', color: '#F44336' },
    'Fourth Street Northwest': { text: 'Fourth Street is a threshold between the old campus grid and the newer research buildings. The architecture changes mid-block like a sentence that switches languages.', historicalText: 'This block contained faculty housing from the 1920s through the 1970s. The houses were demolished for the Bioengineering complex.', color: '#66BB6A' },
    'Dalney Street Northwest': { text: 'A short street that dead-ends into the physics building. Appropriate: all motion converges here on the fundamental.', historicalText: 'Named for an early campus administrator. The street\'s brevity reflects the narrow footprint of the original 1885 campus plan.', color: '#B3A369' },
  },

  defaultLore: {
    text: 'A campus building. Brick and glass. Inside: whiteboards covered in equations. The equations are trying to escape.',
    historicalText: 'Before Georgia Tech: the Peters plantation. Before Peters: Creek Nation hunting grounds. Before the Creek: Mississippian mound builders whose earthworks dot the Chattahoochee floodplain. The knowledge was always here. Only the containers changed.',
    color: '#5a5a4a',
  },

  loreParagraphs: GATECH_LORE,
  osmData: osmData as any,
})
