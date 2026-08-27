# BharaTransit — Delhi Pilot

**Know exactly how to get there, and how much to trust what you're told.**

A door-to-door bus + metro + walk journey planner for Delhi, built on real
agency GTFS data, where every piece of realtime-looking information carries an
honest badge saying how fresh it is.

> Independent prototype for the **Build What Moves India** hackathon.
> Not affiliated with DTC, DMRC, or any government body. No endorsement implied.
> All vehicle movement here is **synthetic and labelled `DEMO`**.

```bash
npm install
npm run dev        # http://localhost:3000
```

No API key needed to run it. An optional `OPENAI_API_KEY` upgrades two
language features; without one the app states in the UI that it fell back.

---

## The problem

**Who.** A Delhi commuter making an ordinary trip that mixes a bus, the metro
and some walking — students, daily-wage and shift workers, anyone without a car.

**What's hard today.** Three questions have no reliable answer in one place:

1. *Which bus or metro do I actually take, door to door?* Official apps answer
   for one operator. Real journeys cross DTC and DMRC, and nobody stitches them.
2. *Where is my bus right now, and can I believe that number?* Arrival times
   appear with total confidence whether they come from a live GPS feed, a
   timetable, or a stale cache. The citizen cannot tell which.
3. *What do I do when it changes?* A delay means starting the whole search over.

**What we changed.** One search box over the whole network, three clearly
labelled options, a badge on every realtime-looking datum, turn-by-turn
guidance through each transfer, and one-tap recovery when a delay hits.

**Why it's better.** The current experience makes the citizen do the
integration work and gives them no way to calibrate trust. This does the
integration and is explicit about its own confidence — including when the
answer is "this is demo data".

## The citizen journey (what reviewers should try)

1. **Search.** Tap **Use current location** in the **From** box, or focus either
   box to browse popular places. Type `chandni`, `du north`, `saket`, or
   `लाजपत नगर`. 390 searchable places: 242 metro stations, 67 bus stops, 81
   landmarks, with Hindi aliases.
2. **Compare.** **Find my route** → up to three options labelled
   *Recommended / Fastest / Cheapest*, each with time, fare, transfers,
   walking distance, a trust badge, and deterministic "why" reasons.
3. **Follow.** Pick one → full text timeline plus a map with moving synthetic
   buses (`DEMO · updated N sec ago`).
4. **Navigate.** **Start GO navigation** → one instruction at a time through
   walk → board → stops remaining → get ready → alight → transfer → arrive.
   Runs at 1× or 30×; **Advance** or Space steps it deterministically.
5. **Recover.** **Simulate delay (demo)** → the bus option is marked delayed, a
   better alternative appears, and a plain-language sentence in English or
   Hindi explains the trade-off. One tap switches you across.

Also try: `wheelchair user going from saket to connaught place` in the
"describe your trip" box, and a trip like **IIT Delhi → Nehru Place** where an
auto-rickshaw covers the first mile to the metro.

## What makes it different

- **A trust model, not a confidence trick.** Every realtime-looking value
  carries exactly one of `LIVE / SCHEDULED / STALE / DEMO`. In this prototype
  every vehicle is `DEMO`, because connecting an unapproved live government
  feed is against the rules — so we say so, everywhere, rather than implying
  precision we do not have.
- **Labels that cannot lie.** *Fastest* only appears when a genuinely
  different option is fastest. Reasons are generated after selection, so
  comparative claims are true within the set actually shown.
- **Auto-rickshaw as first/last mile, not just fallback.** Where the network
  can't be reached on foot, an auto covers the gap to the nearest station
  instead of the whole trip. IIT Delhi → Nehru Place costs **₹60 combined
  versus ₹101 by auto alone**.
- **Stated access needs become real routing constraints.** "wheelchair",
  "with a toddler", "carrying heavy bags" map to a walking limit and an
  interchange cap the router actually enforces — not a label on a screen.
- **AI phrases, the planner decides.** The model extracts constraints and
  writes explanations. It never produces a time, fare, stop or route. Every
  number it emits is checked back against the planner's own figures, and
  discarded if it doesn't match.
- **The journey survives the map.** If tiles fail, the text timeline still
  carries the whole trip.

## Architecture

```text
PWA (Next.js 15 · TypeScript strict · Tailwind v4 · MapLibre)
        │
Normalized API (route handlers — the frontend never sees a raw feed)
 ├─ GET  /api/places              place index: real GTFS stops + landmarks, fuzzy + Hindi
 ├─ POST /api/journeys            multimodal planning (normalized)  ← OpenTripPlanner slot
 ├─ GET  /api/vehicles            synthetic vehicle positions (DEMO)
 ├─ POST /api/ai/preferences      constraints only, never routes
 ├─ POST /api/ai/disruption-note  plain-language delay explanation, EN + HI
 └─ POST /api/demo/disruption     scripted NORMAL → DELAYED → ALTERNATIVE
        │                                   │
GTFS ingestion pipeline              Synthetic realtime layer
(validate → generate subsets)        (pure function of the server clock)
```

| Module | Purpose |
| --- | --- |
| `scripts/ingest-gtfs.mjs` | Zero-dependency GTFS validation + network generation |
| `src/lib/graph.ts` | Deterministic Dijkstra router; cost profiles, semantic labels, auto first/last mile |
| `src/lib/provenance.ts` | Trust engine: LIVE / SCHEDULED / STALE / DEMO |
| `src/lib/vehicles.ts` | Vehicle simulator — pure function of server time |
| `src/lib/scenario.ts` | Disruption state machine, instance-independent |
| `src/lib/ai.ts` | Constraint parsing, with every fallback reason surfaced |
| `src/lib/explain.ts` | Bilingual delay explanation + hallucination guard |

`/about` in the running app is a judge-friendly page with live network stats.

## What works today vs what is mocked

**Real.** Stop coordinates, ordered stop sequences and metro line geometry from
official Delhi OTD GTFS snapshots (bus feed Feb 2023 vintage) and DMRC data.
The router, fare model, GO state machine, search and trust engine are all real
working code.

**Mocked, and labelled as such in the UI.** All vehicle positions. All delays.
Auto-rickshaw fares and speeds. Journey durations are deterministic estimates,
not predictions. There are no accounts, payments, OTPs or personal data
anywhere in this project.

Full detail, including every scope cut: **[LIMITATIONS.md](LIMITATIONS.md)**.

## Scaling this safely

- **Standards in, standards out.** Ingestion is plain GTFS, so any Indian city
  publishing a feed can be normalized by the same pipeline. National Bus
  Digital Grid-ready by construction.
- **The router is replaceable.** `/api/journeys` is a normalized boundary
  specifically so an OpenTripPlanner adapter can be dropped in without the UI
  changing.
- **The realtime layer is a seam, not a mock.** The synthetic feed emits the
  same conceptual shape as GTFS-Realtime VehiclePositions, so an approved live
  feed is a code swap — and the `LIVE / STALE` states already exist to describe it.
- **Trust degrades gracefully.** When a feed goes stale the badge changes
  rather than the number silently rotting. That property is what makes it safe
  to put in front of citizens at scale.
- **Language.** Bhashini would replace our built-in string dictionary for full
  Indic coverage.

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm test            # 53 tests
npm run build       # production build
```

Tests cover router validity and determinism, fare bands, label semantics,
walking-distance accounting, the auto first/last-mile rule, transfer caps,
place-index coverage, provenance classification, vehicle simulation,
scenario instance-independence and input validation, and the AI
hallucination guard.

> Do not run `npm run build` while `npm run dev` is running — both write to
> `.next/` and will corrupt each other.

## Deploying

See **[DEPLOY_NETLIFY.md](DEPLOY_NETLIFY.md)**.

## How this was built

See **[BUILD_WITH_CODEX.md](BUILD_WITH_CODEX.md)** for how coding-agent
assistance was used across ingestion, routing, simulation, the GO state
machine, tests and accessibility.
