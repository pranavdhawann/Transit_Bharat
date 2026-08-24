# Transit Bharat — Delhi Pilot

**A trustworthy navigation layer for Indian public transport.**
Know exactly how to get there: plan a complete door-to-door bus + metro
journey, see where your bus is, know how fresh the information is, navigate
every transfer — and recover automatically when the journey changes.

> Independent hackathon prototype for the **Build What Moves India** hackathon.
> Delhi pilot only. All realtime vehicle data in this prototype is **synthetic
> (DEMO)** and is labeled as such everywhere it appears.

---

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve production build
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests
```

No API keys are required. Map tiles come from OpenFreeMap; if tiles are
unreachable the app degrades gracefully and every journey remains fully
usable from the text timeline (by design).

## Try the demo journey

1. Open the app → tap the chip **Munirka → Connaught Place** (or search any
   stop/landmark on the pilot network).
2. **Find my route** → up to three options: *Recommended / Fastest / Cheapest*,
   with time, fare estimate, transfers, walking distance and a provenance badge.
3. Select a route → full vertical timeline + map with **moving synthetic buses**
   (`DEMO LIVE · updated N sec ago`).
4. **Start GO navigation** → one instruction at a time: walk to stop, bus
   approaching, board, stops remaining, get ready, get off, transfer, arrive.
   Demo runs at 30× speed; use **Advance** or Space to step states deterministically.
5. Press **Simulate delay (demo)** while waiting/riding the bus → the scripted
   disruption makes the current option worse, the app proposes a better route,
   one tap **Switch route** recovers the journey.

## Architecture

```text
Transit Bharat PWA (Next.js 15 · TypeScript strict · Tailwind v4 · MapLibre)
        │
Transit Bharat API  (Next.js route handlers - normalized schema)
 ├─ GET  /api/places?q=…&id=…      place index: REAL GTFS stops + landmarks, fuzzy
 ├─ POST /api/journeys             multimodal itinerary planning (normalized) ← OTP slot
 ├─ GET  /api/vehicles?route=…     synthetic vehicle positions (DEMO, smooth client anim)
 ├─ POST /api/ai/preferences       LLM parses constraints ONLY (never routes) · heuristic fallback
 └─ POST /api/demo/disruption      deterministic scripted delay trigger/reset
        │                                   │
GTFS ingestion pipeline               Synthetic realtime layer
(scripts/ingest-gtfs.mjs: validate →  (pure function of server clock)
 generate network subsets)
```

The network itself comes from **real agency data**: `scripts/ingest-gtfs.mjs`
streams the official Delhi OTD GTFS snapshots (6,342 DTC stops, 2,964 routes,
78k trips; DMRC lines), validates them and generates compact network files.
Open `/about` in the running app for a judge-friendly architecture page with
live stats. See [DATA_SOURCES.md](DATA_SOURCES.md).

Key modules:

| Module | Purpose |
| --- | --- |
| `scripts/ingest-gtfs.mjs` | Zero-dependency GTFS validation + network generation |
| `src/data/generated/*.json` | Real metro lines & bus corridors derived from agency data |
| `src/lib/graph.ts` | Deterministic multimodal router (Dijkstra, transfer/fare-aware profiles, semantic option labels + "why" reasons) |
| `src/lib/provenance.ts` | Trust engine: LIVE / SCHEDULED / STALE / DEMO classification |
| `src/lib/vehicles.ts` | Synthetic moving-bus simulator (pure function of server time) |
| `src/lib/scenario.ts` | Disruption state machine: NORMAL → DELAYED → ALTERNATIVE |
| `src/lib/ai.ts` | Natural-language constraint parsing (OpenAI Responses API; heuristic fallback) — constraints only, never routes |
| `src/app/go/go-client.tsx` | GO mode finite state machine |

## Product decisions baked into code

- **Provenance first.** Every realtime-looking datum carries exactly one of
  `LIVE / SCHEDULED / STALE / DEMO`. In this prototype all vehicles are DEMO
  because unapproved live government feeds are prohibited by the hackathon rules.
- **Real data, honest labels.** Network geometry from official snapshots
  (2023 vintage — disclosed); synthetic realtime visibly marked on every view.
- **Three choices max, labels that never lie.** FASTEST is only shown when a
  different option genuinely is fastest; every card carries deterministic
  "why" reasons.
- **One instruction at a time.** GO mode shows a single dominant instruction,
  runs at 1×/30× simulated speed, advances deterministically.
- **AI assists, never invents.** The LLM only extracts constraints from plain
  language; the router stays the single source of truth.
- **Bilingual beta.** EN/HI toggle covers key journey strings (partial, disclosed).
- **The timeline works without the map.** If tiles fail, the citizen can still
  follow the whole journey.

## Honest disclosures

See [LIMITATIONS.md](LIMITATIONS.md) and [DATA_SOURCES.md](DATA_SOURCES.md).
Summary: the network is a curated prototype inspired by real Delhi corridors;
schedules/fares are estimates; all vehicle movement is synthetic; no government
endorsement is implied; this is not an official DTC/DMRC product.

## Build log

See [BUILD_WITH_CODEX.md](BUILD_WITH_CODEX.md) for how coding-agent assistance
was used across feed ingestion, routing, simulation, GO state machine, tests
and accessibility passes.
