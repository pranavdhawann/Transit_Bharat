# BUILD_WITH_CODEX.md

How coding-agent assistance was used to build BharaTransit.

**Tooling truth:** this repository was built in a single working session on
23 Aug 2026 using the **opencode CLI coding agent** (Codex-style terminal
agent, model `x-preview-f-free`) driving PowerShell on Windows 11. Every
module below was generated, reviewed and verified through that agent
workflow — nothing on this list is fabricated after the fact. Where this file
says "agent", read "opencode coding agent used in place of Codex".

## Modules built with agent assistance

| # | Module / concern | What the agent did | Verified by |
| --- | --- | --- | --- |
| 1 | Repo scaffold | Next.js 15 + TypeScript strict + Tailwind v4 + MapLibre project layout; configs; scripts | `npm run build` green |
| 2 | Curated network data (`src/data/network.ts`) | Modeled Delhi metro subsets (Yellow/Magenta/Violet) + two bus corridors with approximate real coordinates, fare slabs, demo constants | unit tests + manual map inspection |
| 3 | Local place index & fuzzy search (`src/lib/places.ts`) | Unified stop/landmark index, normalized fuzzy scoring incl. Hindi aliases, deterministic ordering | search API smoke tests |
| 4 | Deterministic router (`src/lib/graph.ts`) | Dijkstra over state `(stop, lastRoute)` with board/transfer penalties, three cost profiles (Recommended/Fastest/Cheapest), leg merging, delay injection, diversity fallback banning | router unit tests |
| 5 | Provenance engine (`src/lib/provenance.ts`) | LIVE/SCHEDULED/STALE/DEMO classification + UI metadata | provenance unit tests |
| 6 | Synthetic vehicle simulator (`src/lib/vehicles.ts`) | Ping-pong interpolation along corridors as pure function of time; per-vehicle offsets; next-stop computation; delay offsetting | vehicles unit tests |
| 7 | Disruption scenario (`src/lib/scenario.ts` + `/api/demo/disruption`) | Deterministic NORMAL→DELAYED→ALTERNATIVE machine, in-memory store, auto-expiry | API smoke test |
| 8 | Normalized journeys API (`/api/journeys`, `/api/vehicles`, `/api/places`) | Adapter boundary so OTP can replace the internal router without UI changes; no-store caching; disclosure fields | `npm run typecheck` |
| 9 | Map layer (`src/components/MapView.tsx`) | MapLibre init via dynamic import, GeoJSON line/stop/vehicle layers, popups, fit-bounds, offline-tile fallback notice, reduced-motion handling | build + dev render |
| 10 | GO mode state machine (`src/app/go/go-client.tsx`) | Boundary-derived FSM: walk → wait → approaching → board → stops remaining → get ready → alight → transfer → arrive; simulated clock at 1×/30×; Advance jump; keyboard shortcuts; scripted-delay banner with Switch-route rebasing | manual walkthrough |
| 11 | Search & results UX (`src/app/page.tsx`, `src/app/plan/*`, RouteCard, JourneyTimeline) | Accessible combobox autocomplete, suggestion chips, ≤3 option cards with mode-sequence chips and provenance badges, vertical timeline usable without map | manual walkthrough |
| 12 | Accessibility pass | Focus-visible rings, aria roles on combobox/listbox/options, no color-only status, large touch targets, reduced-motion CSS + JS checks | code review checklist |
| 13 | Unit tests (`tests/*.test.ts`) | Vitest coverage for provenance classification, router validity/determinism/disruption behavior, vehicle simulation monotonicity | `npm test` green |

## Session 2 — critical review + research-driven upgrade (23 Aug 2026)

After the first working build, a self-review + three parallel research
subagents (hackathon judging intel; current OSS/API landscape; live attempt to
acquire official Delhi GTFS) drove these agent-built improvements:

| # | Module / concern | What the agent did | Verified by |
| --- | --- | --- | --- |
| 14 | Router fare bug | Metro slab was charged per-edge (₹100 fares); now continuous metro chains are slotted once, buses flat per boarding, search-time proxy ₹3/km | new unit tests + smoke |
| 15 | Label honesty | FASTEST/CHEAPEST cards only appear when a *different* option truly holds the title; every card gets deterministic "why" reasons | label-semantics test |
| 16 | **Real GTFS ingestion** (`scripts/ingest-gtfs.mjs`) | Zero-dep streaming validator + generator over official snapshots: 10 real DMRC lines, 4 true DTC corridors (e.g. 620UP Munirka→Regal, 25 stops) replacing hand-curated coords | `data/gtfs-validation.json` + full test suite on real network |
| 17 | AI constraint parsing (`src/lib/ai.ts`, `/api/ai/preferences`) | OpenAI Responses API w/ strict JSON schema (gpt-5-mini, minimal reasoning) when key present; transparent labeled heuristic otherwise; assistive-only boundary enforced by design | `tests/ai.test.ts` + live smoke |
| 18 | Smooth vehicle animation (`MapView`) | rAF smoothstep interpolation between poll snapshots per current MapLibre guidance; `prefers-reduced-motion` honored; positron style fallback on tile failure | build + dev render |
| 19 | `/about` architecture page | Judge-facing end-to-end story with live network stats from generated data | manual render |
| 20 | Bilingual beta (`src/lib/i18n.ts`) | EN/हिं toggle for key journey strings; partial support disclosed honestly | manual render |
| 21 | PWA basics | manifest route, SVG icon, theme color | build output |

Research subagent findings that shaped decisions: judging criteria emphasize
end-to-end thinking + honesty; "built with Codex OR powered by an OpenAI
model" makes in-product AI use valuable; prior winners used source-aware
confidence labels (our provenance badges) and assistive-not-chatbot AI;
OpenFreeMap remains the safest free tile source; MapLibre 5.x pinned
deliberately (v6 is ESM-only/WebGL2 - migration noted, not needed).

## Verification performed

```bash
npm install
npm run typecheck   # tsc --noEmit - clean
npm test            # vitest - 22/22 green (provenance, router, vehicles, ai)
npm run build       # production build - clean
node scripts/ingest-gtfs.mjs   # validation report regenerated
```

## What was NOT done by the agent

- Product strategy, hackathon research docs and video script came from the
  pre-existing planning documents (since consolidated away),
  authored before the build sessions.
- Final recorded demo, deployment and user testing remain human tasks.
