# Data Sources

## Primary network data — REAL agency GTFS snapshots

The routing graph is **derived from actual Delhi transit open data**, not
hand-drawn approximations:

| Feed | Vintage | Contents used | Path in repo |
| --- | --- | --- | --- |
| DTC/DIMTS bus (official Delhi OTD feed) | Feb 2023 snapshot | 6,342 stops, 2,964 routes, 78,515 trips, 3.28M stop-times → validated, then 4 representative corridors extracted as true stop-sequence segments | `data/raw/` (local only, not redistributed) → generated subset `src/data/generated/bus-corridors.json` |
| DMRC metro (GTFS-style static) | community mirror verified against official counts | All lines incl. Yellow (37 st), Blue (50), Pink (38), Violet (30), Magenta (25), Red (29), Green (22)… | `src/data/generated/metro-lines.json` |

**Pipeline:** `node scripts/ingest-gtfs.mjs`
streams each feed once, validates columns / coordinate bounds / calendar
ranges, extracts canonical line patterns and anchor-to-anchor corridor
segments, and writes:

- `src/data/generated/metro-lines.json`
- `src/data/generated/bus-corridors.json`
- `data/gtfs-validation.json` — machine-readable validation report
  (row counts, calendar ranges, anchor matches, warnings)

### Provenance & acquisition notes

- The official portal `otd.delhi.gov.in` requires a terms-acceptance form per
  download and was returning 503 at build time. The bus feed was obtained from
  MobilityData's mirror of the same feed:
  `https://files.mobilitydatabase.org/mdb-1262/latest.zip` (Transitland
  `f-delhi~bus`; SHA-identical twin of `mdb-3139`). Manual fallback steps are
  documented in the validation report.
- Bus services in the snapshot end **2024-01-01**: it is a historical
  schedule. We use its *network geometry* (stops, sequences, corridors) as
  prototype inputs — never as current timetables.
- Raw feeds are **not redistributed** by this repository (Delhi OTD terms);
  only our heavily reduced derivative subsets live under
  `src/data/generated/`.

## What is simulated

- **Vehicle positions** (`/api/vehicles`): synthetic, deterministic function
  of server time, interpolated along the real corridors. Always labeled DEMO.
- **Itinerary durations/fares**: model estimates — effective speeds per mode,
  bus dwell ~36 s/stop, central-Delhi traffic factor 0.8 north of lat 28.60,
  board waits 2.5 min (bus) / 3.5 min (metro). Fares: flat ₹20 bus; metro
  distance slabs ₹10–₹60. Estimates, not quotes.
- **Disruption**: scripted state machine (NORMAL → DELAYED → ALTERNATIVE),
  deterministic so the recorded demo cannot fail.

## Map tiles & geometry attribution

- Rendering: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- Vector tiles: [OpenFreeMap](https://openfreemap.org/) (free, unlimited,
  no key; liberty primary style, positron automatic fallback). No SLA —
  acceptable for a prototype demo.
- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
  (ODbL), attributed in-app.

## AI feature data boundary

`/api/ai/preferences` uses an OpenAI model (Responses API, strict JSON schema)
when `OPENAI_API_KEY` is configured server-side; otherwise a transparent
keyword heuristic runs and is labeled `source: "heuristic"`. In both modes the
model/parser only extracts constraints (origin text, destination text,
walking preference, deadline) — **never routes, fares, ETAs or geometry**.

## Production path (documented, not yet wired)

| Source | URL | Notes |
| --- | --- | --- |
| Delhi OTD realtime VehiclePositions | https://otd.delhi.gov.in/data/realtime/ | Keyed access; prohibited without approval — the synthetic layer emits the same conceptual shape so the swap-in is code-only. |
| OpenTripPlanner 2 | https://docs.opentripplanner.org/ | v2.x is GraphQL-only; Docker images available; city-graph needs ~4-8 GB heap. Our `/api/journeys` response is the adapter boundary. |
| Bhashini (Indic language APIs) | https://bhashini.gov.in/ | Registered-key translation/TTS for full bilingual support beyond our built-in string dictionary. |

## Compliance

- Delhi OTD terms respected: no redistribution of raw downloads; source
  acknowledged here and in-app; no government branding or endorsement claims.
- No Aadhaar/PAN/OTP/payment/personal data anywhere.
