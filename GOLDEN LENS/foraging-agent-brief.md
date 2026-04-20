# Research Brief for a Real-Text Foraging Agent

## Executive Summary

The agent should be designed as a **passage-hunting system**, not a topic summarizer. Its unit of value is not “a relevant book” but “a passage-bearing artifact”: a scan, field note, manual, oral-history segment, catalog record with stable metadata, or official page that yields concrete scene language, material vocabulary, operational detail, and historically grounded atmosphere. The discovery stack should therefore begin with repositories that combine stable provenance with either full text or strong item-level metadata: entity["organization","HathiTrust","digital library"], entity["organization","Internet Archive","digital library"], entity["organization","Open Library","book catalog"], the entity["organization","Library of Congress","US national library"], the entity["organization","National Archives and Records Administration","US federal archives"], the entity["organization","Smithsonian Institution","US museum network"], the entity["organization","Digital Public Library of America","digital library network"], entity["organization","WorldCat","library catalog"], entity["organization","The Portal to Texas History","UNT digital portal"], and the entity["organization","National Agricultural Library","USDA library"]. HathiTrust provides a very large digitized corpus and states that up to 40% of the collection is readable online; DPLA aggregates material from major partners including NARA, Smithsonian, HathiTrust, and the Portal to Texas History; WorldCat is built to locate holdings across thousands of libraries; the Smithsonian and NARA both expose large searchable online catalogs; the Portal to Texas History is explicitly oriented toward rare and primary source materials from or about Texas. citeturn7view6turn7view7turn7view10turn7view11turn7view8turn16view4turn16view5turn16view6

The five lore-sites already have strong seed anchors that can be used to bootstrap the agent. For the Shack, useful starting points include the entity["organization","Foxfire","appalachian heritage org"] corpus, entity["point_of_interest","NASCAR Hall of Fame","Charlotte, NC, US"]’s moonshine-history material, and entity["book","Ham Radio's Technical Culture","2006 history"] by entity["people","Kristen Haring","historian"]. For the Creek, the best initial anchors are entity["point_of_interest","George Washington's Mount Vernon","Mount Vernon, VA, US"], the Library of Congress’s Washington surveying notes, and entity["book","Opticks","1704 optics text"] by entity["people","Isaac Newton","physicist"]. For the Ridge, the key seeds are the U.S. Army heliograph history, entity["book","The Signal Corps, U.S.A. in the War of the Rebellion","1896 history"] by entity["people","J. Willard Brown","signal corps historian"], and Smithsonian heliograph records. For the Cave, start with entity["people","Stephen Bishop","mammoth cave guide"] at entity["point_of_interest","Mammoth Cave National Park","Mammoth Cave, KY, US"] and entity["book","Rambles in the Mammoth Cave, during the Year 1844","1845 travel narrative"] by entity["people","Alexander Clark Bullitt","writer"]. For the Puddle, the shortest route runs through National Park Service and Texas history resources on entity["point_of_interest","Spindletop","Beaumont, TX, US"], entity["organization","Lamar University","Beaumont, TX, US"], and the entity["organization","Texas State Historical Association","Austin, TX, US"]. citeturn7view4turn15view2turn15view0turn8view1turn15view1turn7view2turn16view0turn7view1turn7view13turn16view2turn19view0turn7view14turn7view16turn18view0

## Research Mission and Operating Model

The mission is to locate, extract, and rank **real primary texts and high-quality secondary sources** that make each lore-site feel excavated rather than invented. For every site, the agent should seek five kinds of payoff in parallel: factual bedrock, sensory vocabulary, artifact language, operational procedure, and mythic charge. The search order should be strict: primary sources and official archives first; museum, university press, and serious ethnographic secondary works second; high-quality journalism only when it adds scene detail, oral-history texture, or a bridge to harder-to-find primary records.

The operating model should follow a repeating cycle. First, the agent identifies **seed sources** that already sit on the site’s historical substrate. Second, it expands outward through subject headings, bibliographies, “related items,” contributor pages, and finding aids. Third, it mines each text for **three to five short, scene-usable passages**, each with a stable URL, locator, tag set, and generative score. Fourth, it ranks sources at both the passage level and the source level. Fifth, it produces a site synthesis that turns the retrieved material into recurring artifacts, verbs, atmospheres, tensions, and worldbuilding payoffs. The agent should not treat bibliographic discovery as success; success begins only after excerpt extraction.

The brief assumes two final object types: `SOURCE_CARD` and `SITE_SYNTHESIS`. The agent’s final deliverable should be a **JSON array** containing both object types, followed by a short executive summary written in plain English for human review.

## Prioritized Search Targets and Archives

### Cross-site discovery stack

The cross-site stack should begin with public-domain and official discovery systems that maximize **stable provenance plus text access**. HathiTrust is essential for early books, manuals, and nineteenth-century histories; it describes a 19+ million-item corpus and notes that reading, searching, downloading, and research access vary by rights status, with up to 40% available for anyone to read online. Open Library is useful as a catalog-plus-access layer on top of Internet Archive books and links outward to WorldCat. WorldCat should be used whenever a title is known but no digital scan is immediately visible, because it is explicitly designed to locate materials across thousands of libraries. citeturn7view6turn7view7turn9view1turn7view8

The second layer should be the Library of Congress ecosystem. The Library now hosts the upgraded Chronicling America platform, which it describes as the nation’s leading free resource for historical U.S. newspapers and reports as more than 23 million newspaper pages from all 50 states, the District of Columbia, Puerto Rico, and the U.S. Virgin Islands. The Library’s American Folklife Center adds speech recordings, oral histories, dialect materials, and folklife documentation that are especially valuable for the “speech,” “worldview,” and “environment” tags. Its Washington papers and exhibition materials also directly support the Creek site. citeturn9view2turn16view3turn7view2

The third layer should be institutional catalogs that expose artifacts, finding aids, and federal documentation rather than polished narratives. NARA’s catalog is the main portal to records held by the National Archives and includes archival descriptions, digitized records, OCR text, and authority records, with more than 95% of holdings described at the series level. The Smithsonian Collections Search Center exposes millions of records across history, technology, and material culture. DPLA is valuable as a federated discovery layer because it aggregates partner institutions including NARA, Smithsonian, HathiTrust, the Portal to Texas History, and regional digital libraries. citeturn16view4turn16view5turn7view10turn7view11

The fourth layer should be regional and domain-specific repositories. The Portal to Texas History is a direct fit for the Puddle site because it is explicitly a gateway to rare, historical, and primary source materials from or about Texas and supports guided, advanced, and proximity search. The National Agricultural Library’s manuscript search is useful for farm electrification, agricultural engineering, machinery, and rural-life records. For Appalachia and speech culture, the Special Collections Research Center at Appalachian State and Library of Congress folklife collections should be searched early rather than late. citeturn16view6turn11search10turn17view2turn7view12turn17view0

### Site-specific search order

**Shack** should start with Foxfire materials, Appalachian moonshine collections, moonshine-to-motorsport history, and technical radio culture. Foxfire began in 1966 as a student-created magazine preserving Southern Appalachian voices; its *Mountain Spirits* volume explicitly promises interviews with moonshiners, revenue agents, and hotrod haulers. Appalachian State frames moonshining in Appalachia as a long cultural practice, while the NASCAR Hall of Fame directly documents engine modification, weight handling, aerodynamics-by-trial-and-error, and clandestine vehicle adaptations among moonshine runners. Haring’s book adds the “radio shack” vocabulary and a documented account of solitary tinkering, two-way radios, and technical subculture. citeturn7view4turn15view2turn7view12turn15view0turn8view1

**Creek** should prioritize survey notes, optics texts, and instrument descriptions. Mount Vernon’s surveying history explains Washington’s backcountry fieldwork and provides concrete apparatus terms such as “circumferentor,” Jacob’s staff, tripod, survey chains, and bearings; the Library of Congress preserves his school copybook surveying notes; and Newton’s *Opticks* is available as a public-domain primary text through Project Gutenberg and HathiTrust. Mount Vernon’s object record for Washington’s surveyor’s compass is especially valuable because it describes the instrument in material detail down to silvered face, sight bars, staff adapter, and needle pin. citeturn15view1turn7view2turn16view0turn16view1turn10search3

**Ridge** should be built from heliograph, signaling-mirror, and military line-of-sight records. The Army states that the U.S. Army Signal Corps began experimenting with the heliograph around 1873 and used it extensively in the Southwest in 1886. The Smithsonian’s heliograph and signaling-mirror records give the object language needed for mirrors, flashes, ferrules, sighting devices, and long-distance signaling. Brown’s 1896 Signal Corps history is available in both HathiTrust and Internet Archive full view, making it ideal for extraction and bibliographic chasing. citeturn7view1turn7view13turn6search10turn16view2turn7view15

**Cave** should begin with Stephen Bishop, nineteenth-century Mammoth Cave guidebooks, and cave-collection finding aids. The National Park Service describes Bishop as an enslaved African American guide who arrived at Mammoth Cave in 1838, crossed Bottomless Pit, helped open major passages, and drew a map from memory in 1842 that was later published in Bullitt’s *Rambles*. Project Gutenberg and HathiTrust both provide access points for Bullitt’s 1845 text. Mammoth Cave National Park and Western Kentucky University special collections offer finding aids and collection leads for guide descriptions, tourism, archaeology, and cave operations. citeturn19view0turn7view14turn2search0turn12search12turn12search10

**Puddle** should combine petroleum history, regional newspaper coverage, farm engineering archives, and rural-life records. The National Park Service’s Big Thicket history traces oil and gas production in the region back to the late 1800s; Lamar University’s Spindletop Boomtown Museum emphasizes the January 10, 1901 Lucas Gusher as a turning point in the petroleum age; and the Texas State Historical Association’s Spindletop entry gives drilling, roughneck, gusher, and boomtown language. The Portal to Texas History should be used heavily for local newspapers and regional trade coverage, while the National Agricultural Library’s agricultural engineering and rural-life records can anchor the farm machinery, electrification, and chemically transformed landscape side of the site. citeturn7view3turn7view16turn18view0turn16view6turn17view2

## Exact Query Pack

The query pack below is written to be pasted directly into web search, repository search, or advanced catalog forms. When a catalog supports fielded search, use title/author/subject fields. When it does not, paste the query string as written and then apply filters for **English**, **book/manuscript/newspaper**, **public domain/full view**, and the relevant date window. For newspaper portals, search both exact titles and event/process language; for catalogs, search both known titles and apparatus terms. This approach matches the actual affordances exposed by HathiTrust, WorldCat, NARA, the Portal to Texas History, and related systems. citeturn7view7turn7view8turn16view4turn16view6turn11search10

### Web search queries

```text
SHACK
site:foxfire.org moonshine hotrod cars still interview Appalachia
site:collections.library.appstate.edu moonshine Appalachia oral history
site:nascarhall.com moonshine roots mechanic aerodynamics "Junior Johnson"
site:mitpress.mit.edu "Ham Radio's Technical Culture"
site:loc.gov Appalachia radio shack folklore oral history
site:loc.gov "Joseph S. Hall" Smoky Mountains speech customs beliefs

CREEK
site:mountvernon.org surveying George Washington circumferentor Jacob's staff
site:loc.gov "Surveying or Measuring of Land" "George Washington"
site:gutenberg.org "Opticks" Newton
site:hathitrust.org Newton Opticks 1721 full view
site:mountvernon.org surveyor's compass and staff George Washington
site:loc.gov George Washington survey field book backcountry

RIDGE
site:army.mil heliograph mirrors sunlight 1873 1886
site:americanhistory.si.edu heliograph signaling mirror
site:hathitrust.org "The Signal Corps, U.S.A. in the War of the Rebellion"
site:archive.org "The Signal Corps, U.S.A. in the War of the Rebellion"
site:loc.gov heliograph signal corps manual mirror
site:archives.gov signal corps heliograph field records

CAVE
site:nps.gov Stephen Bishop Mammoth Cave map memory 1842
site:gutenberg.org "Rambles in the Mammoth Cave"
site:hathitrust.org "Rambles in the Mammoth Cave"
site:nps.gov maca collections Mammoth Cave
site:archive.org "Mammoth cave of Kentucky" Hovey
site:site:wku.edu Mammoth Cave collections manuscripts folklore

PUDDLE
site:nps.gov "Big Thicket" oil gas industry
site:lamar.edu Spindletop Boomtown Lucas Gusher 1901
site:tshaonline.org Spindletop oilfield rotary bit roughnecks
site:texashistory.unt.edu Spindletop Beaumont oil boom newspaper
site:nal.usda.gov agricultural engineering farm power machinery electrification
site:nal.usda.gov rural life records farm population machinery
```

### Library catalog and repository queries

```text
SHACK
"Mountain Spirits" Dabney
"Foxfire" moonshine Appalachia
"Ham Radio's Technical Culture" Kristen Haring
moonshining Appalachia oral history
radio shack amateur radio technical hobby 1930s 1970s
bootlegger mechanics North Carolina Georgia oral histories

CREEK
"Opticks" Isaac Newton
George Washington surveying notes
surveying Virginia backcountry eighteenth century
circumferentor Jacob's staff survey chains
spirit level brass telescope surveyor frontier
George Washington professional surveys

RIDGE
"The Signal Corps, U.S.A. in the War of the Rebellion" J. Willard Brown
heliograph military signaling United States
solar telegraph mirror signaling mountains
line-of-sight signaling fog atmosphere signal corps
Apache campaign heliograph
signaling mirror nineteenth century

CAVE
"Rambles in the Mammoth Cave" Alexander Clark Bullitt
Stephen Bishop Mammoth Cave map
Mammoth Cave guide books nineteenth century
cave exploration lantern ropes echo
Mammoth Cave tourism guides Kentucky
Bottomless Pit Mammoth Cave guide

PUDDLE
Spindletop oilfield Beaumont January 10 1901
petroleum industry Texas boomtown newspapers
farm power and machinery agricultural engineering
tractor lubrication manual farm machinery
rural electrification farm engineering
oil runoff farm maintenance bulletin
```

### Bibliographic expansion queries

```text
GENERAL FOLLOW-ON QUERIES
[known title] bibliography
[known title] subject headings
[known author] related works
[artifact term] site:hathitrust.org
[artifact term] site:archive.org
[artifact term] site:loc.gov
[artifact term] site:archives.gov
[artifact term] site:americanhistory.si.edu
[place name] newspaper site:loc.gov
[place name] newspaper site:texashistory.unt.edu
```

## Selection, Exclusion, Tagging, and Scoring

### Selection rules

Select texts that contain **concrete nouns, observable actions, and recoverable procedures**. Passages should preferably do at least two of the following at once: name tools or materials; describe how something is done; register sound, smell, or tactile experience; expose a locally embedded worldview; or dramatize risk, misfire, pursuit, collapse, weather, or residue. The best passages show matter in action: mirrors being aimed, pipes erupting, engines being modified, chains being run, oil bubbling, ropes dropped, lantern light failing, or voices defining a thing in local terms.

Prioritize, in order:

1. Public-domain or official full-view primary texts.  
2. Official finding aids and object records with detailed metadata.  
3. High-quality historical and ethnographic secondary works that quote primary material or preserve oral testimony.  
4. High-quality journalism only when it contributes concrete detail or points to stronger primary material.

Pairing is important. Whenever possible, match **one primary text** with **one interpreter**: a field manual plus a museum object record, a travel narrative plus a park historian, an oral-history collection plus an ethnography, a catalog record plus a scholarly monograph.

### Exclusion rules

Exclude texts that are generic, derivative, or bibliographically weak. In practice, this means rejecting:

- SEO pages and listicles with no archival provenance.
- Inspirational or thematic essays that do not supply scene language.
- Purely summary-style encyclopedia entries unless they open a trail to a primary text.
- Secondary works that never identify sources, archives, dates, or named individuals.
- Reposted quotation pages without scan provenance.
- Crowdsourced summaries when an official or scan-backed version exists.
- Catalog-only records that provide no excerptable text, unless they are needed as wayfinding objects.

Any source that cannot produce at least **one** excerptable passage or **one** concrete archival lead should not receive a source-level score above 2.

### Tagging taxonomy

The required passage tags are below. Use **one to three primary tags** and **up to two secondary tags** per passage.

| Tag | Definition | What it captures | Example prompts the tag should answer |
|---|---|---|---|
| `artifact` | Named tools, materials, machines, components, or physical media | hubcap, ferrule, vacuum tube, still, survey chain, rotary bit | What object vocabulary does this source contribute? |
| `environment` | Weather, terrain, light, darkness, acoustics, atmosphere, landscape | ridge haze, creek glare, cave damp, mud sheen, low clouds | What place-sense does this source supply? |
| `technique` | Procedure, method, calibration, operation, maintenance, signaling, mapping | align mirror, run chain, cap gusher, tune engine, read returns | What can a character do because of this source? |
| `worldview` | Local interpretation, working assumptions, conceptual frame, belief structure | practical empiricism, backcountry caution, technical pride | How does the source teach people to interpret reality? |
| `speech` | Dialect, quoted talk, idiom, occupational language, oral-history voice | “whiskey tripper,” folk phrases, guide patter, local naming | What does this world sound like? |
| `danger` | Risk, emergency, illegality, bodily threat, environmental hazard | cave falls, law pursuit, blowouts, darkness, overheating | What can go wrong here? |
| `residue` | What remains after action: stain, soot, oil, memory, archive trace | spill, rust, old maps, leftover hardware, contaminated ground | What physical or cultural afterimage does the action leave? |

### Scoring rubric

Use the following rubric at the **passage level** and then roll it up to the **source level** by averaging the top three passages and adjusting for provenance.

| Score | Criteria |
|---|---|
| **5** | Directly reusable scene language. High sensory density plus clear apparatus or procedure. Strong provenance. A reader can immediately build a scene, dialogue beat, or object description from it. |
| **4** | Strong operational or material detail, but slightly less vivid or less versatile than a 5. Often excellent for artifact language or technique, even if not lyrical. |
| **3** | Trustworthy and useful for chronology, context, or bibliography, but only modestly excerptable. Good grounding source; limited scene power. |
| **2** | Useful mainly as a lead, metadata object, or background summary. Weak excerpt potential. Keep only if it points toward stronger material. |
| **1** | Redundant, generic, poorly evidenced, or too thin to justify continued attention. Reject from final ranked deck. |

For tie-breaking, prefer: **public-domain primary > official archive object/finding aid > scholarly secondary > journalism**. If two sources score the same, the one with better passage yield and more stable URLs ranks higher.

## Output Schema and Deliverables

The agent should return a **single JSON array** containing `SOURCE_CARD` and `SITE_SYNTHESIS` objects, followed by a short executive summary in prose. Every passage entry must include a **canonical URL** and a **short excerpt of 300 characters or fewer**.

### SOURCE_CARD example

| Field | Example value |
|---|---|
| `type` | `SOURCE_CARD` |
| `title` | `Rambles in the Mammoth Cave, during the Year 1844` |
| `author` | `Alexander Clark Bullitt` |
| `year` | `1845` |
| `language` | `English` |
| `source_type` | `primary / travel narrative / public domain` |
| `repository` | `Project Gutenberg` |
| `url` | `canonical item page URL` |
| `access_url` | `direct readable text or scan URL` |
| `site_mapping` | `["Cave"]` |
| `reliability_tier` | `A` |
| `why_it_matters` | `Early cave narrative with guide-language, route description, and scene-ready environmental detail.` |
| `artifact_words` | `["lantern","pit","vault","guide","map","passage"]` |
| `passages` | `[ {excerpt, locator, url, tags, generative_score}, ... ]` |
| `best_passage` | `{excerpt:"<=300 chars", locator:"chapter/page/line if available", url:"canonical passage URL"}` |
| `passage_function` | `["environment","speech","danger"]` |
| `generative_score` | `5` |
| `unlock_note` | `Unlocks how nineteenth-century cave exploration sounded, moved, and instructed visitors.` |

### SITE_SYNTHESIS example

| Field | Example value |
|---|---|
| `type` | `SITE_SYNTHESIS` |
| `site_name` | `Cave` |
| `best_sources` | `["Bullitt 1845","Stephen Bishop NPS","Hovey guidebook","Mammoth collections finding aid","Brown analog for signal return"]` |
| `recurring_artifacts` | `["lantern","rope","pit","map","guidebook","echo"]` |
| `recurring_verbs` | `["cross","descend","listen","measure","recall","trace"]` |
| `recurring_atmospheres` | `["gloom","reverberation","humidity","constriction","sudden opening"]` |
| `unresolved_tensions` | `["tourism vs danger","memory vs instrument","enslavement vs expertise"]` |
| `worldbuilding_payoff` | `Shows that cave knowledge emerges from return-signals, memory, and embodied guidance rather than full visibility.` |

### JSON skeleton

```json
[
  {
    "type": "SOURCE_CARD",
    "title": "string",
    "author": "string",
    "year": 0,
    "language": "English",
    "source_type": "primary|secondary|object_record|finding_aid|newspaper|manual|oral_history",
    "repository": "string",
    "url": "canonical item URL",
    "access_url": "readable text/scan URL",
    "site_mapping": ["Shack"],
    "reliability_tier": "A|B|C",
    "why_it_matters": "string",
    "artifact_words": ["string", "string"],
    "passages": [
      {
        "excerpt": "<=300 chars",
        "locator": "page/chapter/line/timecode if available",
        "url": "canonical passage URL or item URL",
        "tags": ["artifact", "technique"],
        "generative_score": 5
      }
    ],
    "best_passage": {
      "excerpt": "<=300 chars",
      "locator": "string",
      "url": "string"
    },
    "passage_function": ["artifact", "environment"],
    "generative_score": 5,
    "unlock_note": "one-sentence worldbuilding unlock"
  },
  {
    "type": "SITE_SYNTHESIS",
    "site_name": "Shack",
    "best_sources": ["title 1", "title 2", "title 3", "title 4", "title 5"],
    "recurring_artifacts": ["string"],
    "recurring_verbs": ["string"],
    "recurring_atmospheres": ["string"],
    "unresolved_tensions": ["string"],
    "worldbuilding_payoff": "string"
  }
]
```

### Required deliverables

The minimum acceptable output is:

- **10–20 candidate texts per site**.
- **3–5 extracted passages per text**.
- For every passage: **excerpt <=300 chars**, **canonical URL**, **locator**, **tags**, and **generative score**.
- For every source: one-sentence **unlock note** explaining what the source adds to the world.
- For every site: one `SITE_SYNTHESIS` object with the top five sources and distilled patterns.
- One short executive summary explaining the strongest discoveries, gaps, and next expansion routes.

## Timeline and Iteration Plan

The agent should work in **four waves**, with a hard stop after each wave so the corpus can be inspected, deduplicated, and re-queried.

**Wave one** is a seed pass. Pull three to five seed sources per site, confirm that each site has at least one viable primary text, one official archive/object record, and one secondary interpreter. The goal is to stabilize vocabulary and repository choice, not to exhaust the archive.

**Wave two** is a harvest pass. Expand from seed sources using bibliographies, subject headings, author pages, “similar items,” finding aids, and related collections until each site has a raw pool of 10–20 candidates. At this stage, the agent should aggressively separate **readable full text** from **catalog-only leads**.

**Wave three** is an extraction pass. For each source retained, extract three to five passages and score them. Sources that cannot yield at least one excerptable passage and one useful metadata trail should be downgraded or dropped.

**Wave four** is a ranking and synthesis pass. Compute source-level rankings from the top passage scores, then build the site-level syntheses. The final human-facing review should focus on gaps: missing speech texture, weak environmental language, insufficient technical procedure, or too little primary material.

If a site does not reach ten strong candidates, the agent should return a **gap memo** rather than padding the deck with weak material. The memo should say exactly what is missing and which repositories or subject headings should be hit next.

## Legal, Ethical, and Source-Priority Guidance

Source priority should remain strict. Prefer public-domain scans, official archive pages, museum object records, catalog records with stable identifiers, and official finding aids before relying on copyrighted modern summaries. This is more than a quality rule; it is also a legal and reproducibility rule. HathiTrust emphasizes that access depends on rights status and affiliation, Open Library distinguishes catalog metadata from hosted digitized books, and Library of Congress folklife collections can carry mixed rights and copying restrictions. In the Joseph S. Hall collection, for example, the Library explicitly notes that some rights remain protected while government-created materials are public domain. citeturn7view7turn9view1turn17view0

The agent should therefore follow four legal rules. First, always store the **canonical item URL** and, when different, the **reading or scan URL**. Second, never extract more than the minimum necessary: the brief requires excerpts of **300 characters or fewer**, which is a good operational ceiling. Third, if an item is catalog-only or behind a controlled-reading system, keep the metadata and note the access condition rather than trying to route around it. Fourth, when using non-public-domain secondary work, quote sparingly and prefer paraphrase outside the required short excerpts. Official rights statements should be preserved whenever a repository supplies them. citeturn16view4turn18view0turn9view1

The ethnographic rule is equally important: do not romanticize or flatten the sources. A figure like Stephen Bishop must be handled as both an expert cave guide and an enslaved African American man working within coercive conditions. Likewise, Appalachian oral-history and folklife archives should be used to recover speech, labor, and local interpretive frames without converting them into decorative “color.” The Joseph S. Hall materials are especially valuable here because they document speech, folktales, local history, customs, beliefs, songs, and field notes in detail. citeturn19view0turn17view0

A practical seed set for the first run is already clear. Start with Foxfire and *Mountain Spirits* for Shack context; the NASCAR Hall moonshine article and Haring for illicit mechanics plus radio-shack culture; Mount Vernon, the Library of Congress Washington notes, and *Opticks* for Creek; the Army heliograph article, Brown’s Signal Corps volume, and Smithsonian heliograph records for Ridge; Stephen Bishop and Bullitt’s *Rambles* for Cave; and Big Thicket, Lamar’s Spindletop museum, TSHA’s Spindletop entry, the Portal to Texas History, and National Agricultural Library engineering records for Puddle. These sources are all stable enough to anchor the first expansion pass. citeturn7view4turn15view2turn15view0turn8view1turn15view1turn7view2turn16view0turn7view1turn16view2turn7view13turn19view0turn7view14turn7view3turn7view16turn18view0turn16view6turn17view2