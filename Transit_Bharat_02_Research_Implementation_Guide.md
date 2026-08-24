# Transit Bharat — Research, Product Strategy & Implementation Guide

## Executive recommendation

Build **Transit Bharat — Delhi Pilot**, not “all public transport in India” for the submission.

The winning prototype should make one problem extremely clear:

> **A person unfamiliar with Delhi public transport should be able to travel from door to destination without already knowing the bus system — and should always know whether the information being shown is live, scheduled, stale or simulated.**

The hackathon prototype should demonstrate a complete journey:

**Search → choose route → find the bus → start GO navigation → transfer → react to disruption → continue to destination.**

The national story is the scale argument, not the initial scope.

---

# 1. Why this is a real public-service problem

## Existing digital transport does not eliminate uncertainty

Delhi's One Delhi app already advertises:

- live bus tracking and ETA,
- route planning across bus and metro,
- digital tickets,
- station/parking information.

So Transit Bharat must **not** claim “Delhi has no transit app.”

The defensible gap is:

1. Current information can be difficult to trust.
2. Static schedules do not necessarily represent actual arrival.
3. A route result is not the same as active journey guidance.
4. Multiple modes/operators still need to feel like one continuous trip.
5. Most transit interfaces do not clearly communicate **data provenance/freshness**.

Recent One Delhi Google Play reviews in 2026 report issues including buses disappearing, routes returning “no bus available,” incorrect ETAs, missing real buses, inaccurate live positions and slow route calculations.

## Delhi's own data documentation supports the trust problem

Delhi Open Transit Data publishes GTFS-style bus data, but its documentation explicitly warns that the bus arrival/departure values in `stop_times.txt` are **rough estimates generated assuming constant travel speed**.

That means a good product should not present static schedule values as if they were precise realtime predictions.

---

# 2. Why the timing is unusually good

On **11 August 2026**, the Parliamentary Standing Committee on Transport, Tourism and Culture recommended a **National Bus Digital Grid**.

The recommendation includes:

- interoperability standards,
- a public live-tracking layer,
- unified booking across public and private operators,
- a citizen reporting channel,
- a GIS-based network atlas,
- punctuality and predictability metrics,
- hazard maps.

Transit Bharat should not claim to *be* that grid.

Pitch it as:

> **A citizen-facing experience that demonstrates what interoperable transport data could feel like if such a grid exists.**

That gives the project national relevance without overclaiming government partnership or adoption.

---

# 3. Product positioning

## Weak positioning

> “Citymapper for India.”

Useful shorthand internally, but weak as the final pitch because Indian cities already have journey planners.

## Strong positioning

> **“A trustworthy navigation layer for Indian public transport.”**

Or:

> **“Make an unfamiliar Indian bus usable without local knowledge.”**

## Product promise

A user should always be able to answer:

1. How do I get there?
2. Which stop do I walk to?
3. Which bus do I board?
4. Is that bus actually live?
5. How fresh is its location?
6. How many stops remain?
7. Where do I get off?
8. How do I make the transfer?
9. What happens if the journey is delayed?

---

# 4. Scope for the hackathon

## Must ship

### A. Search
- Origin
- Destination
- Leave now
- Optional: arrive by
- Optional: less walking

### B. Route results
Exactly 2–3 high-quality options:
- Recommended
- Fastest
- Cheapest

Each card:
- total time
- estimated fare
- walking distance
- number of transfers
- mode sequence
- realtime availability badge

### C. Full journey detail
A vertical journey timeline:
- walk
- bus
- transfer
- metro
- walk

Each transit leg should show:
- route name/number
- boarding stop
- alighting stop
- stops remaining
- expected departure
- provenance state

### D. Bus tracking
For the selected bus route:
- route line
- stops
- synthetic moving buses
- selected vehicle
- update age
- next stop

### E. GO mode
One instruction at a time:
- Walk to stop
- Bus approaching
- Board bus
- 5 stops remaining
- Get ready
- Get off here
- Walk to transfer
- Board metro
- Destination

### F. Scripted disruption
One deterministic demo event:
- selected bus becomes delayed,
- current itinerary becomes worse,
- alternate itinerary becomes better,
- user gets one-tap reroute.

### G. Provenance / trust model
Every realtime-looking datum gets one state:

| State | Meaning |
|---|---|
| `LIVE` | fresh approved realtime source |
| `SCHEDULED` | schedule only; no live vehicle |
| `STALE` | last live update is older than your freshness threshold |
| `DEMO` | synthetic/mock data used by the hackathon prototype |

For the submission, most vehicle data should be `DEMO`, because the hackathon prohibits unapproved connections to live government systems.

---

# 5. What NOT to build before submission

Cut these unless the core is already excellent:

- real ticket payments,
- Aadhaar/NCMC integration,
- UPI,
- login/accounts,
- admin dashboard,
- complaints,
- SOS,
- crowdsourcing,
- occupancy prediction,
- carbon score,
- rewards/gamification,
- full India rollout,
- 15 languages,
- native iOS/Android apps,
- generic chatbot.

The reviewers test the **citizen journey**, not an admin interface.

---

# 6. Data strategy

## 6.1 Delhi Open Transit Data — bus network

Official documentation:
https://otd.delhi.gov.in/documentation/

Static data:
https://otd.delhi.gov.in/data/static/

The published static bus dataset includes:
- `agency.txt`
- `calendar.txt`
- `stops.txt`
- `routes.txt`
- `trips.txt`
- `stop_times.txt`

The site currently reports roughly:
- 3,464 stops
- 543 routes
- 16,562 trips
- 378,324 stop-time rows

The page shows a **20 June 2024** update date for those static bus files, so do not describe them as current 2026 schedules.

### Critical warning
Delhi's documentation says its `stop_times` are rough estimates. Use them as network/schedule inputs for a prototype, but do not label them “live ETA.”

## 6.2 Delhi Metro / DMRC static data

Official page:
https://otd.delhi.gov.in/data/staticDMRC/

The page exposes GTFS-style DMRC static data. It currently shows an older snapshot date (**10 August 2023**).

Treat it as a prototype network snapshot.

## 6.3 Delhi realtime API

Official page:
https://otd.delhi.gov.in/data/realtime/

Delhi documents a GTFS-Realtime VehiclePositions endpoint for **authorized users with a private key**.

### For this hackathon
Do **not** use the live endpoint unless the hackathon organizers explicitly approve it.

The FAQ says:
- do not connect to live government systems unless an approved sandbox is provided;
- use mock/synthetic integrations.

Therefore:

**Use synthetic GTFS-Realtime data for the demo.**

## 6.4 Delhi data terms

Terms:
https://otd.delhi.gov.in/terms

Important points:
- the site requires agreement to its terms;
- use of content is subject to conditions;
- source acknowledgement is required when material is reproduced;
- third-party copyrighted material is excluded from general reproduction permission.

Before shipping:
1. read and accept the current terms,
2. clearly cite the Delhi Department of Transport as source,
3. do not copy website branding/assets,
4. keep a synthetic fallback dataset in case you decide not to redistribute a downloaded feed.

---

# 7. Open data / open-source stack

## 7.1 GTFS

Official:
https://gtfs.org/

GTFS Schedule represents:
- agencies
- stops
- routes
- trips
- stop times
- calendars
- transfers/fares/pathways where available

GTFS Realtime represents:
- trip updates
- service alerts
- vehicle positions

This is exactly the conceptual split Transit Bharat needs.

## 7.2 OpenStreetMap

Data/license:
https://www.openstreetmap.org/copyright

Use OSM for:
- walking streets,
- pedestrian connections,
- road geometry,
- station entrances where mapped,
- routing graph.

Attribution must be visible.

### OSM extracts

Geofabrik India:
https://download.geofabrik.de/asia/india.html

Northern Zone:
https://download.geofabrik.de/asia/india/northern-zone.html

The Northern Zone PBF is far smaller than the all-India PBF. For a Delhi-only graph, crop it further to a Delhi bounding polygon before building OTP if practical.

Tools that can crop PBF files:
- `osmium extract`
- `osmosis`

## 7.3 OpenTripPlanner (OTP)

Docs:
https://docs.opentripplanner.org/en/latest/

Data sources:
https://docs.opentripplanner.org/en/latest/Data-Sources/

OTP is a strong choice because it builds multimodal routing networks from:
- OpenStreetMap,
- GTFS,
- GTFS-Realtime.

Use OTP as a separate routing service.

### Architecture rule
Do **not** let the frontend depend directly on OTP's response schema.

Create your own backend adapter:

`Transit Bharat Web → /api/journeys → OTP adapter → OTP`

This lets you:
- normalize the response,
- add trust/provenance fields,
- replace OTP later,
- keep the UI stable.

## 7.4 MapLibre GL JS

Docs:
https://maplibre.org/maplibre-gl-js/docs/

Use for:
- interactive map,
- route polylines,
- stop markers,
- moving bus markers,
- selected-vehicle camera,
- GO-mode map state.

## 7.5 Map tiles

OpenFreeMap quick start:
https://openfreemap.org/quick_start/

It can be consumed from MapLibre and is convenient for a hackathon.

Do not assume `tile.openstreetmap.org` is a production tile CDN. OSM's tile servers have a usage policy and no SLA:
https://operations.osmfoundation.org/policies/tiles/

## 7.6 Geocoding

### Preferred hackathon approach
For the 5-day build, avoid making geocoding a critical dependency.

Create a **local place index** containing:
- all GTFS stops,
- metro stations,
- 20–50 demo landmarks,
- a few curated neighbourhood names.

Search locally with fuzzy matching.

This:
- avoids network latency,
- works offline,
- is deterministic for judging,
- avoids autocomplete API-policy problems.

### Optional Nominatim
Public Nominatim policy:
https://operations.osmfoundation.org/policies/nominatim/

If deliberately used:
- maximum 1 request/sec,
- send proper User-Agent/Referer,
- cache results,
- show attribution,
- **do not implement client-side autocomplete using the public API**.

For the submission, local search is safer.

---

# 8. Recommended technical architecture

```text
┌───────────────────────────────────────────┐
│           Transit Bharat PWA              │
│  Next.js + TypeScript + MapLibre          │
└───────────────────┬───────────────────────┘
                    │
             Transit Bharat API
                    │
        ┌───────────┼─────────────┐
        │           │             │
  Journey API   Vehicle API   Place Search
        │           │             │
        │     Synthetic GTFS-RT   │
        │                         │
        └───────────┬─────────────┘
                    │
            OpenTripPlanner
                    │
        ┌───────────┴────────────┐
        │                        │
     GTFS data             OpenStreetMap
  Bus + Metro feeds          street graph
```

Optional:

```text
Natural-language request
        │
   OpenAI model
        │
structured preferences
(arriveBy, maxWalk, modes)
        │
 deterministic router
```

The LLM should parse preferences or explain tradeoffs. It should **not invent routes**.

---

# 9. Suggested repository structure

```text
transit-bharat/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── public/
├── services/
│   ├── routing-adapter/
│   └── realtime-simulator/
├── data/
│   ├── gtfs-bus/
│   ├── gtfs-metro/
│   ├── synthetic/
│   └── places/
├── scripts/
│   ├── validate-gtfs.*
│   ├── normalize-feeds.*
│   ├── build-place-index.*
│   └── make-demo-scenario.*
├── tests/
├── BUILD_WITH_CODEX.md
├── DATA_SOURCES.md
├── LIMITATIONS.md
└── README.md
```

---

# 10. Internal API design

Keep the frontend API simple.

## `GET /api/places?q=...`

Response:

```json
{
  "results": [
    {
      "id": "place:aiims",
      "name": "AIIMS",
      "type": "station",
      "lat": 28.0,
      "lon": 77.0
    }
  ]
}
```

## `POST /api/journeys`

Input:

```json
{
  "from": {"lat": 0, "lon": 0},
  "to": {"lat": 0, "lon": 0},
  "departAt": "2026-08-26T08:30:00+05:30",
  "preferences": {
    "maxWalkingMeters": 1200,
    "preferredModes": ["WALK", "BUS", "SUBWAY"]
  }
}
```

Normalized response:

```json
{
  "journeys": [
    {
      "id": "j1",
      "label": "RECOMMENDED",
      "durationMinutes": 46,
      "fareInr": 35,
      "walkingMeters": 620,
      "transfers": 1,
      "legs": []
    }
  ]
}
```

## `GET /api/vehicles?routeId=...`

```json
{
  "vehicles": [
    {
      "id": "demo-bus-1",
      "routeId": "522",
      "lat": 0,
      "lon": 0,
      "nextStopId": "stop-x",
      "updatedAt": "...",
      "provenance": "DEMO"
    }
  ]
}
```

## `POST /api/demo/disruption`

Only enable in demo mode.

It advances a known scenario:
- on time → delayed → reroute available.

This should be deterministic so your recorded demo cannot fail.

---

# 11. Synthetic realtime implementation

## Goal

Create realistic-looking bus movement **without pretending it is government realtime data**.

## Easiest implementation

For each demo vehicle:

1. Choose a real route/trip from static transit data.
2. Generate/obtain a route polyline.
3. Assign:
   - start time,
   - average segment speed,
   - dwell time at stops.
4. Interpolate the vehicle position along the polyline using server time.
5. Emit a GTFS-Realtime-shaped `VehiclePosition` or your own internal equivalent.
6. Update every 5–15 seconds.
7. Always display `DEMO` in UI.

## Disruption state machine

```text
NORMAL
  ↓ trigger
DELAYED
  ↓ recompute journey
ALTERNATIVE_AVAILABLE
  ↓ user accepts
REROUTED
```

Keep it deterministic.

Do not make an LLM decide whether the bus is delayed.

---

# 12. GO mode implementation

Treat GO as a finite state machine.

Example:

```text
WALK_TO_STOP
WAIT_FOR_BUS
BUS_APPROACHING
ON_BUS
GET_READY
ALIGHT
WALK_TO_METRO
ENTER_METRO
ON_METRO
EXIT_METRO
WALK_TO_DESTINATION
ARRIVED
```

Each state has:

```ts
{
  title,
  instruction,
  mapFocus,
  progress,
  nextStateTrigger
}
```

For the hackathon demo, state changes can be based on:
- simulated time,
- “advance demo” trigger hidden behind a keyboard shortcut,
- current synthetic vehicle position.

Do not rely on browser geolocation for the recorded demo.

---

# 13. Trust/provenance engine

This is a feature worth implementing as real code.

Example:

```ts
function provenance(updatedAt, sourceType) {
  if (sourceType === "synthetic") return "DEMO";
  if (!updatedAt) return "SCHEDULED";

  const age = now - updatedAt;

  if (age < 30_000) return "LIVE";
  if (age < 120_000) return "DELAYED_FEED";
  return "STALE";
}
```

UI text should be explicit:

- **LIVE · 18 sec ago**
- **DELAYED FEED · 74 sec ago**
- **SCHEDULED · no live vehicle**
- **STALE · last update 5 min ago**
- **DEMO · synthetic hackathon data**

This is one of the strongest product differentiators.

---

# 14. Natural-language AI feature

Only implement after routing/GO mode works.

Example request:

> “I need to reach campus before 9:30 and my mother is with me, so avoid too much walking.”

Model output:

```json
{
  "arrivalDeadline": "09:30",
  "walkingPreference": "LOW",
  "preferredModes": ["BUS", "SUBWAY"],
  "explanationNeeded": true
}
```

Then the deterministic router handles the journey.

Good AI tasks:
- parse user constraints,
- explain why one route is recommended,
- translate disruption alerts into plain Hindi/English,
- summarize route tradeoffs.

Bad AI tasks:
- invent stops,
- invent fares,
- invent ETAs,
- generate unverified route geometry.

---

# 15. UX screens

## Screen 1 — Home

Primary:
**Where do you want to go?**

Inputs:
- From
- To

Action:
**Find my route**

Secondary:
- Leave now / arrive by
- Less walking

## Screen 2 — Results

Three cards maximum.

Each shows the mode sequence visually:
`Walk 4m → Bus 20m → Metro 12m → Walk 3m`

Use large mode labels; avoid dense maps first.

## Screen 3 — Journey detail

Vertical timeline + map.

The user should understand the journey even if the map fails to load.

## Screen 4 — GO

One action/instruction dominates the screen.

## Screen 5 — Bus route

- route
- direction
- stops
- vehicle markers
- freshness

---

# 16. Accessibility / India-specific design

Implement before decorative polish:

- mobile-first layout,
- large touch targets,
- English + Hindi for key actions if time permits,
- avoid color-only status meaning,
- show route number in text,
- show walking distance in meters,
- readable on low-end phones,
- reduce map animation when prefers-reduced-motion is enabled,
- cache critical route state locally if appropriate,
- no mandatory login,
- no unnecessary permissions.

If Hindi is incomplete, do not advertise full bilingual support.

---

# 17. Winning against the judging rubric

The official rubric is:

## Problem
Evidence:
- existing app already attempts the service,
- recent users still report trust failures,
- static schedules are explicitly approximate.

## Working build
Show:
- complete A→B journey,
- vehicle tracking,
- GO mode,
- reroute.

## Usability
Show:
- three choices only,
- one instruction at a time,
- provenance badges,
- no login.

## Product thinking
Explain:
- why static vs live vs stale matters,
- why you cut ticketing,
- why one city first,
- why AI only parses/explains.

## End-to-end thinking
Show:
- standardized transit feeds,
- routing engine,
- realtime layer,
- data normalization,
- national interoperability story.

## Honesty
Explicitly label:
- synthetic realtime,
- old/static feed snapshots,
- no government endorsement,
- dependencies.

---

# 18. How Codex should be used

Codex is mandatory.

Use it on meaningful engineering work and keep evidence.

Recommended Codex tasks:

1. Inspect the GTFS files and create a validator.
2. Build a feed-normalization script.
3. Generate the local place-search index.
4. Configure/adapter-test OpenTripPlanner.
5. Build MapLibre route/stop/vehicle layers.
6. Create the synthetic vehicle simulator.
7. Implement GO mode state machine.
8. Add journey-response normalization.
9. Generate unit/integration tests.
10. Run an accessibility review.
11. Identify loading/performance bottlenecks.
12. Produce edge-case tests for missing/stale vehicle data.

Track prompts/commits in:

`BUILD_WITH_CODEX.md`

Do not fabricate Codex involvement after the build.

---

# 19. Build order / fallback plan

## Tier 1 — absolute minimum
- polished search,
- deterministic demo itinerary,
- route line on map,
- journey timeline,
- synthetic moving bus,
- GO mode.

If OTP is blocking you, **ship this before losing a day**.

## Tier 2 — strong submission
- OTP multimodal routing,
- multiple route options,
- static Delhi bus + metro ingestion,
- provenance model,
- scripted disruption/reroute.

## Tier 3 — only if time remains
- natural language preferences,
- Hindi,
- richer local search,
- offline cache,
- performance optimization.

A beautiful complete Tier 2 is better than a broken Tier 3.

---

# 20. User testing

Test with at least 5 people if possible.

Task:

> “You are new to Delhi. Use this to get from the displayed origin to destination using public transport.”

Do not explain the UI.

Measure:
- did they find a route?
- did they know which stop to go to?
- did they identify which bus?
- did they understand `DEMO/LIVE/SCHEDULED/STALE`?
- did they know when to get off?
- did they understand the transfer?
- did they recover after the simulated delay?

Record only real results.

If 5/5 complete the journey, that is valuable submission evidence.

---

# 21. Production roadmap after the hackathon

Do not build now; use as vision.

## Phase 1
Delhi pilot:
- static multimodal data,
- synthetic realtime demo,
- guided journey.

## Phase 2
Approved operator integrations:
- GTFS-Realtime / operator feeds,
- service alerts,
- verified ETAs.

## Phase 3
Interoperability:
- more cities,
- data-normalization adapters,
- public/private operators,
- last-mile modes.

## Phase 4
Payments:
- ONDC/Beckn/NCMC-compatible ticketing where approved.

## Phase 5
National citizen layer:
- interoperable live tracking,
- predictability metrics,
- standardized journey guidance.

---

# 22. Sources and technical links

## Hackathon
- Official home: https://buildwhatmovesindia.com/
- Builder brief: https://buildwhatmovesindia.com/brief
- FAQ: https://buildwhatmovesindia.com/faq

## Delhi
- Open Transit Data documentation: https://otd.delhi.gov.in/documentation/
- Bus static data: https://otd.delhi.gov.in/data/static/
- DMRC static data: https://otd.delhi.gov.in/data/staticDMRC/
- Realtime API access page: https://otd.delhi.gov.in/data/realtime/
- OTD terms: https://otd.delhi.gov.in/terms
- One Delhi app: https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi

## Standards / open source
- GTFS: https://gtfs.org/
- GTFS overview: https://gtfs.org/documentation/overview/
- GTFS Realtime: https://gtfs.org/documentation/realtime/
- GTFS Realtime libraries: https://gtfs.org/resources/producing-data/
- OpenTripPlanner: https://www.opentripplanner.org/
- OTP docs: https://docs.opentripplanner.org/en/latest/
- OTP data sources: https://docs.opentripplanner.org/en/latest/Data-Sources/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- OpenStreetMap license/attribution: https://www.openstreetmap.org/copyright
- Geofabrik India extracts: https://download.geofabrik.de/asia/india.html
- Geofabrik Northern Zone: https://download.geofabrik.de/asia/india/northern-zone.html
- OpenFreeMap: https://openfreemap.org/quick_start/
- Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/

## Policy validation
- National Bus Digital Grid recommendation, 11 Aug 2026:
  https://www.pib.gov.in/PressReleasePage.aspx?PRID=2297871
