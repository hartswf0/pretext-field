### OUTPUT_A — WORLD_GENOME (YAML)
```yaml
title: The Arithmetic Canvas
seed: "A hyper-fluid spatial realm where living semantic documents are fossilized into mathematically dead geometric blocks, colliding at 120fps across an infinite, vibe-coded grid."

world_type:
  primary_mode: "cinematic environment"
  embodiment_mode: "floating observer"
  world_continuity: "screen implies larger navigable world"
  simulation_feel: "polished demo"

terrain_logic:
  biome: "canal city"
  ground_readability: "wet corridor"
  verticality: "multi-tier basin"
  traversal_affordances: "bridge"
  landmark_system: "glowing portal"
  horizon_behavior: "architectural vanishing line"

camera_embodiment:
  viewpoint: "gliding overview"
  framing_logic: "navigation frame"
  lens_bias: "24mm"
  camera_height: "aerial glide"
  motion_signature: "fly"
  body_cues: "none"

control_grammar:
  control_schema: "left stick + right camera"
  UI_presence: "research-demo UI"
  interaction_model: "move + steer"
  promptability: "single-frame screenshot"

worldmodel_bias:
  sample_style: "interactive environment demo"
  continuity_strength: 95
  controllability_strength: 90
  environmental_coherence: 85
  novelty_band: "speculative-real"

optical_logic:
  illumination_mode: "clean cinematic simulation"
  exposure_behavior: "clean readable mids"
  color_logic: "slightly game-saturated"
  atmosphere_stack: "clear air"
  texture_bias: "synthetic simulation smoothness"

subject_logic:
  player_body: "none"
  world_entities: "floating rocks"
  scale_relation: "human vs monumental landscape"

scene_classes:
  - "hero frame of strange but navigable terrain"
  - "UI-overlaid explorable world screenshot"
  - "movement strip showing small world transition"

forbidden_failures:
  - "pure concept art with no traversal logic"
  - "chaotic montage with no stable world"
  - "hyper-detailed cinematic clutter"
  - "no landmark anchor"
  - "camera too abstract to imply controllability"
  - "environment not readable as explorable"

tagline: "#worldmodel-grammar #playable-image #traversal-frame #synthetic-terrain #explorable-cinema"
ttl: 1
```

### OUTPUT_B — WORLDTEXT
```text
world The_Arithmetic_Canvas {

  meta {
    genre: "speculative-real"
    description: "A spatialized, hyper-performant environment where the traditional Document Object Model has fractured into a 120fps collision-based physical simulation of text and geometry."
  }

  locations {
    location The_Semantic_Ruins { }
    location The_Broad_Phase_Grid { }
    location The_Ghost_Tree_Subsurface { }
    location The_Nastaliq_Descent { }
  }

  entities {
    entity SpatialCursor : avatar {
      traits: ["120fps-fluidity", "rigid-body-mass"]
      location: The_Broad_Phase_Grid
    }
    entity FossilizedTextBlock : obstacle {
      traits: ["mathematically-dead", "cached-width", "O(1)-complexity"]
      location: The_Broad_Phase_Grid
    }
    entity InteractiveOrb : trigger {
      traits: ["vibe-coded", "glassmorphism"]
      location: The_Broad_Phase_Grid
    }
    entity HarfBuzzOracle : landmark {
      traits: ["complex-ligature-shaper", "ancient-monolith"]
      location: The_Nastaliq_Descent
    }
  }

  relations {
    rel [occludes](The_Broad_Phase_Grid -> The_Ghost_Tree_Subsurface)
    rel [shapes](HarfBuzzOracle -> FossilizedTextBlock)
  }

  states {
    state SpatialCursor.velocity = 120
    state FossilizedTextBlock.mutability = false
  }

  rules {
    rule Collision_Resolution {
      if:
        - SpatialCursor intersects FossilizedTextBlock
      then:
        - event Kinematic_Reflow
    }
  }

  events {
    event Kinematic_Reflow {
      actors: [SpatialCursor, FossilizedTextBlock]
      effects: [FossilizedTextBlock.position = "parted like water", The_Broad_Phase_Grid.hash_state = updated]
    }
  }

  timeline {
    time The_Post_DOM_Era
  }
}
```

### OUTPUT_C — WORLDMODEL_IMAGE_PROMPTS

#### HERO_WORLD_FRAME
A wide, cinematic yet traversable overview of a hyper-modern digital landscape. The terrain consists of a massive, illuminated grid (The Broad-Phase Grid) suspended over a dark, abyssal void. Giant, fossilized blocks of text act as rigid, geometric walls forming a canyon-like maze. In the center, a perfectly smooth, glowing glassmorphism orb floats above the path, forcing the text blocks to physically part and warp around its gravitational presence. Blue dusk lighting with clean, readable midtones. The composition implies a playable, physics-aware 3D world model. 24mm lens, synthetic simulation smoothness.

#### PLAYABLE_SCREENSHOT
A generated gameplay screenshot of a spatial computing environment. The camera looks down a pristine, multi-tiered basin made of translucent UI panels. A user's semi-transparent avatar hand reaches out to touch a volumetric paragraph of text. As the hand approaches, the individual words—rendered as mathematically dead bounding boxes—physically shatter and slide out of the way along an invisible $X,Y$ collision grid. Balanced gameplay clarity, showing clear UI-safe zones, looking like a high-fidelity interactive WebXR demo running at 120fps.

#### FIRST_PERSON_VIEW
First-person embodied perspective navigating the "Ghost Tree Subsurface." The player's hands are visible at the bottom of the frame, manipulating glowing tethers that connect the physical, floating 3D text above to an underground labyrinth of hidden semantic roots (the accessibility tree). The ground is a clear glass floor, showing a complex network of glowing data lines routing beneath the surface. The image feels instantly controllable, a synthetic field recording of a developer debugging a spatial UI.

#### THIRD_PERSON_TRAVERSAL
Third-person chase camera view. A sleek, anonymous drone-like avatar glides rapidly down a wide, digital canal route. On either side, towering monuments of calligraphic Arabic and Nasta'liq ligatures form complex, sloping architectural arches. The avatar moves fluidly through the center, leaving a wake of distorted, recalculating geometric space behind it. The camera height is elevated for an aerial glide, preserving world continuity and spatial legibility. Soft game-saturated color grading.

#### MOVEMENT_STRIP
A horizontal strip of 5 sequential frames demonstrating physical text reflow. Frame 1: An interactive cursor approaches a solid wall of perfectly justified text. Frame 2: The cursor breaches the bounding box of the text; the words begin to act as rigid-body physics objects. Frame 3: The text parts completely, forming a perfect circular void around the cursor. Frame 4: The cursor moves forward through the newly created tunnel. Frame 5: The text snaps back into its rigid, mathematically cached layout behind the cursor. Strict environmental coherence and geometry preservation across all frames.

#### UI_OVERLAY_VARIANT
A playable environment demo screenshot. The camera floats over a complex 3D text layout. A subtle, translucent debugging grid overlays the screen, showing the $O(N)$ spatial hashing cells dividing the environment. Bounding boxes around the text are highlighted in wireframe neon. In the bottom right corner, a minimalist telemetry UI displays "120 FPS" and "Layout Reflow: 0.00ms". The world behind the UI is sharply rendered, emphasizing traversable affordances through the floating typographic architecture.

### OUTPUT_D — CONTROL_AND_CAMERA_GRAMMAR
- **viewpoint mode:** Gliding, omni-directional aerial observer, capable of seamlessly swooping into first-person when interacting with micro-typography.
- **locomotion mode:** Extremely fluid, frictionless 120fps 6-Degrees-of-Freedom (6DOF) flying, matching the zero-latency ideal of pure arithmetic layout.
- **camera relation:** Rigidly tethered to the focal point of interaction, with zero input lag to emphasize the $O(1)$ computation speed of the environment.
- **input grammar:** Spatial hand tracking (pinch and pull) translated to dual-analog stick equivalents for continuous movement and lateral strafing.
- **stable across frames:** The overarching architectural grid, the cached bounding boxes of the text monuments, and the global lighting state.
- **variable across frames:** The exact positional alignment of text blocks as they are dynamically repelled by the avatar's collision radius; localized glassmorphism blur effects.
- **continuity preservation:** The 3D grid must remain perfectly stable and uniformly spaced; spatial hashing debug lines must map perfectly to the movement of physics objects to maintain the illusion of a mathematically deterministic environment.

### OUTPUT_E — FINAL HERO PROMPT
A polished gameplay screenshot of a hyper-performant spatial computing world model. The camera glides seamlessly through an infinite, illuminated 3D grid where typography is treated as rigid physical architecture. Massive blocks of fossilized text act as canyon walls, resting on a perfectly flat, translucent glass floor that reveals a glowing, hidden labyrinth of "Ghost Tree" accessibility nodes beneath. In the center of the path, a perfectly smooth, vibe-coded glass orb is colliding with a paragraph of text, causing the letters to shatter and fluidly part like water around its geometric mass. The lighting is a crisp, cinematic simulation of blue dusk, casting accurate ray-traced shadows from the floating letters onto the grid. The framing privileges navigable space and stable environmental logic, reading exactly like a 120fps explorable WebXR simulation rather than static concept art.
-synthetic-terrain-explorable-cinema-

### QUICKCHECK
- world readable: YES
- traversal implied: YES
- landmark system clear: YES
- embodied viewpoint clear: YES
- world continuity preserved: YES
- prompts usable: YES