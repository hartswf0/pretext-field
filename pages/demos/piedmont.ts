/**
 * PIEDMONT PARK · Cognitive Cartography
 * Atlanta's central park through the lens of spatial memory.
 */
import { createCartographyEngine } from './cartography-engine.js'
import { PIEDMONT_LORE } from './piedmont-lore.js'
// @ts-ignore
import osmData from './piedmont-geo.json'

createCartographyEngine({
  title: 'PIEDMONT PARK',
  center: [33.7870, -84.3730],
  bounds: { latMin: 33.7800, latMax: 33.7950, lngMin: -84.3810, lngMax: -84.3620 },
  zoom: 15,
  gridSize: 128,
  accentColor: '#4CAF50',
  temporalLabel: '1895 · GENTLEMEN\'S DRIVING CLUB',

  waterZones: [
    { lat: 33.7845, lng: -84.3720, radius: 80, name: 'Clara Meer' },
  ],

  memoryNodes: [
    { id: 'lake', name: 'Lake Clara Meer', badge: 'ANCHOR · REFLECTED CITY',
      color: '#2196F3', textColor: '#64B5F6', lat: 33.7845, lng: -84.3720,
      text: 'The lake reflects the Midtown skyline upside down. To a child sitting on the shore, the reflected city is the real one. The buildings grow downward into dark water. Fish swim between skyscrapers.',
      historicalText: 'Lake Clara Meer was constructed in 1895 as part of the Cotton States and International Exposition. The name means "Clear Lake" in Dutch. Before this, the land was a wooded hillside belonging to Benjamin Walker\'s plantation.' },

    { id: 'meadow', name: 'The Active Oval', badge: 'SPATIAL · VELOCITY FIELD',
      color: '#4CAF50', textColor: '#81C784', lat: 33.7885, lng: -84.3740,
      text: 'An enormous green oval where bodies move at different speeds. Dogs achieve escape velocity. Frisbees bend spacetime. The child stands still in the center as the world spins around them. The grass stains are permanent.',
      historicalText: 'This meadow hosted the Negro Building during the 1895 Exposition—the only pavilion where Black Americans could exhibit their achievements. Booker T. Washington delivered his Atlanta Compromise speech nearby.' },

    { id: 'beltline', name: 'The BeltLine Threshold', badge: 'BOUNDARY · STEEL SPINE',
      color: '#FF9800', textColor: '#FFB74D', lat: 33.7870, lng: -84.3655,
      text: 'The BeltLine trail is a seam in the city. On one side: trees, silence, green. On the other: concrete, traffic, the hum of commerce. You cross it and the air changes temperature. The transition is instantaneous.',
      historicalText: 'The BeltLine follows the route of the old Atlanta & Charlotte Air Line Railway, later the Southern Railway corridor. The tracks carried cotton, passengers, and cargo from 1871 until abandonment in the 1960s.' },

    { id: 'garden', name: 'The Botanical Labyrinth', badge: 'ENCLOSURE · GREEN WALLS',
      color: '#8BC34A', textColor: '#AED581', lat: 33.7900, lng: -84.3715,
      text: 'The botanical garden is a labyrinth of curated nature. Every plant is labeled. Every path is deliberate. But the toddler sees only the tunnel of green overhead, the way sunlight filters through leaves like stained glass.',
      historicalText: 'The Atlanta Botanical Garden was established in 1976 on 30 acres of Piedmont Park land. Before the park, this hillside was part of the Walker plantation, worked by enslaved people from the 1830s.' },

    { id: 'bridge', name: 'The Stone Bridge', badge: 'CROSSING · TIME GATE',
      color: '#795548', textColor: '#A1887F', lat: 33.7855, lng: -84.3745,
      text: 'The stone bridge over the ravine is a time gate. Cross it walking south: you enter the modern city. Cross it walking north: you enter the forest. The bridge itself exists in neither time. It is the threshold.',
      historicalText: 'The original stone bridges were built for the 1895 Cotton States Exposition by convict laborers. The stones were quarried from Stone Mountain, 16 miles east—the same granite where the Confederate memorial would be carved in 1916.' },

    { id: 'dogpark', name: 'The Chaos Perimeter', badge: 'DANGER · ACOUSTIC WALL',
      color: '#F44336', textColor: '#EF9A9A', lat: 33.7863, lng: -84.3770, isPhantom: true,
      text: 'The dog park is contained chaos. A fence separates two realities: one where gravity works normally, and one where large animals defy physics. The barking forms a wall of sound. The child presses their face against the chain-link.',
      historicalText: 'This corner of the park was the site of the 1895 Exposition\'s Midway, where spectacles and sideshows entertained the crowds. The echoes of barkers and organ grinders have been replaced by barking dogs.' },
  ],

  streetLore: {
    'Atlanta BeltLine Eastside Trail': { text: 'The spine of the new Atlanta. A rail corridor reborn as pedestrian artery. Every surface is tagged, muraled, narrated. The concrete remembers the trains.', historicalText: 'Southern Railway right-of-way, 1871-1960s. Cotton and coal rolled through here. The rail bed still undulates with the memory of freight.', color: '#FF9800' },
    'Atlanta Beltline Eastside Trail': { text: 'The spine of the new Atlanta. A rail corridor reborn as pedestrian artery. Every surface is tagged, muraled, narrated.', historicalText: 'Southern Railway right-of-way. The rail bed still undulates with the memory of freight.', color: '#FF9800' },
    '10th Street Northeast': { text: 'The northern boundary. Beyond this: Midtown\'s glass towers. The park ends abruptly. Trees yield to asphalt in a single step.', historicalText: 'Tenth Street was the original wagon road connecting Decatur to Marietta. Before the park, farmsteads lined both sides.', color: '#78909C' },
    '14th Street Northeast': { text: 'Fourteenth Street slices east-west, a river of traffic dividing the park from the residential grid to the north.', historicalText: 'The northern edge of the 1895 Exposition grounds. Trolley lines ran here bringing thousands of visitors daily.', color: '#78909C' },
    'Piedmont Avenue Northeast': { text: 'The western wall. High-rises stare down into the park like witnesses. Their windows catch the sunset and throw it back.', historicalText: 'Named for the Piedmont plateau itself. This road predates the park—it was a colonial-era track connecting settlements along the Chattahoochee ridge.', color: '#5C6BC0' },
    'Monroe Drive Northeast': { text: 'Monroe Drive curves along the park\'s eastern edge, separating green from grid. The curb is a geological boundary.', historicalText: 'Named for President James Monroe. The road follows the contour of a creek bed that was channeled underground during the 1895 Exposition construction.', color: '#5C6BC0' },
    'Charles Allen Drive Northeast': { text: 'A quiet residential street bordering the park. The houses face the trees. The trees do not face back.', historicalText: 'Charles Allen was an Atlanta alderman who advocated for the park\'s establishment in the 1880s against significant developer opposition.', color: '#66BB6A' },
    'Park Drive Northeast': { text: 'The road that orbits the park like a satellite. Cars circle endlessly. The park at the center does not move.', historicalText: 'Originally a carriage drive for the 1895 Exposition, designed to showcase the Olmsted-influenced landscape to riders at a leisurely pace.', color: '#66BB6A' },
    'Active Oval': { text: 'Not a street—a clearing. An invitation to run, to fall, to stain your knees green. The geometry is permission.', historicalText: 'The parade ground of the 1895 Cotton States Exposition, where 800,000 visitors gathered over three months.', color: '#4CAF50' },
    'Entrance Road': { text: 'The mouth of the park. Beyond the gate: another world. The noise drops. The canopy closes. You are inside.', historicalText: 'The original Exposition entrance, designed to funnel visitors from the streetcar terminal into the fairgrounds.', color: '#8BC34A' },
  },

  defaultLore: {
    text: 'A structure at the park\'s edge. The trees lean toward it. The building pretends not to notice.',
    historicalText: 'Before the park: Walker plantation land. Before the plantation: Creek Nation territory. Before the Creek: 10,000 years of continuous habitation along the Chattahoochee watershed.',
    color: '#4a5a4a',
  },

  loreParagraphs: PIEDMONT_LORE,
  osmData: osmData as any,
})
