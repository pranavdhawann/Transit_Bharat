import Link from "next/link";
import { BUS_ROUTES, METRO_LINES, allStops } from "@/data/network";

export const metadata = {
  title: "How BharaTransit is built",
};

export default function AboutPage() {
  const totalMetroStations = METRO_LINES.reduce(
    (a, l) => a + l.stations.length,
    0,
  );
  const busCorridorStops = BUS_ROUTES.reduce((a, r) => a + r.stops.length, 0);
  const totalNodes = allStops().length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <p className="text-sm">
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          &larr; Back to BharaTransit
        </Link>
      </p>

      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          How this is built
        </h1>
        <p className="mt-2 text-slate-600">
          Standards-based transit architecture on open data - not hard-coded
          screens. Everything below is running code in this repository.
        </p>
      </section>

      <section aria-labelledby="stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <h2 id="stats" className="sr-only">
          Network statistics
        </h2>
        {[
          [String(METRO_LINES.length), "real metro lines"],
          [String(totalMetroStations), "metro stations"],
          [String(BUS_ROUTES.length), "bus corridors"],
          [String(busCorridorStops), "bus stop patterns"],
        ].map(([n, label]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-900">{n}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="pipeline">
        <h2 id="pipeline" className="text-lg font-semibold tracking-tight">
          Data pipeline (end-to-end)
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <strong>1 · Ingest.</strong>{" "}
            <code className="rounded bg-slate-100 px-1">scripts/ingest-gtfs.mjs</code>{" "}
            streams the official Delhi Open Transit Data GTFS snapshots
            (6,342 DTC stops / 78,515 trips / DMRC lines), validates columns,
            coordinate bounds and calendars.
          </li>
          <li>
            <strong>2 · Generate.</strong> The validator emits compact network
            files ({totalNodes} graph nodes here): real metro lines with ordered
            stations and representative bus corridors extracted as true
            stop-sequence segments between anchor terminals.
          </li>
          <li>
            <strong>3 · Route.</strong> A deterministic Dijkstra router over the
            stop graph produces door-to-door itineraries behind a normalized
            API - an OpenTripPlanner adapter can replace it without UI changes
            (OTP 2.x is GraphQL-only; documented).
          </li>
          <li>
            <strong>4 · Simulate realtime.</strong> A synthetic GTFS-RT-shaped
            vehicle feed interpolates DEMO buses along real corridors as a pure
            function of server time - deterministic for judging, honestly
            labeled everywhere it appears.
          </li>
          <li>
            <strong>5 · Guide.</strong> GO mode is a finite state machine over
            itinerary boundaries; disruptions trigger a scripted state machine
            (NORMAL → DELAYED → ALTERNATIVE) and one-tap reroute.
          </li>
        </ol>
      </section>

      <section aria-labelledby="arch">
        <h2 id="arch" className="text-lg font-semibold tracking-tight">
          Architecture
        </h2>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{`BharaTransit PWA (Next.js 15 · TypeScript · Tailwind · MapLibre)
        │
BharaTransit API (normalized schema - frontend never sees raw feeds)
 ├─ GET  /api/places              place index: real stops + landmarks, fuzzy
 ├─ POST /api/journeys            deterministic multimodal planner  ← OTP slot
 ├─ GET  /api/vehicles            synthetic vehicle positions (DEMO)
 ├─ POST /api/ai/preferences      LLM parses constraints ONLY (never routes)
 └─ POST /api/demo/disruption     scripted NORMAL→DELAYED→ALTERNATIVE
        │                    │
 GTFS-derived network   Synthetic realtime layer
 (validated snapshots)  (pure function of clock)`}</pre>
      </section>

      <section aria-labelledby="trust">
        <h2 id="trust" className="text-lg font-semibold tracking-tight">
          The trust model
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Every realtime-looking datum carries exactly one provenance state:
          {" "}<strong>LIVE</strong> (fresh approved feed),{" "}
          <strong>SCHEDULED</strong> (timetable only),{" "}
          <strong>STALE</strong> (update too old),{" "}
          <strong>DEMO</strong> (synthetic prototype data). In this prototype
          every vehicle is DEMO because hackathon rules prohibit unapproved
          live government integrations - the engine is real code ready for real
          feeds.
        </p>
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai" className="text-lg font-semibold tracking-tight">
          Where AI sits (and where it must not)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          An optional OpenAI model parses plain-language constraints (&quot;reach
          before 9:30, cannot walk much&quot;) into structured preferences via
          strict schema output. Without a key, a transparent heuristic parser is
          used and labeled as such. Routes, fares, ETAs and geometry are always
          produced by the deterministic planner - never hallucinated.
        </p>
      </section>

      <section aria-labelledby="honesty">
        <h2 id="honesty" className="text-lg font-semibold tracking-tight">
          Honesty
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Synthetic realtime data, visibly labeled on every view.</li>
          <li>
            Network derived from official snapshots (2023 vintage) - not current
            schedules; fares are estimates.
          </li>
          <li>
            Auto-rickshaw fallback (no PT + walk &gt; 15 min) uses simulated
            speeds and metered-rate fare estimates - labeled DEMO like all
            synthetic data.
          </li>
          <li>Independent hackathon prototype - no government affiliation.</li>
          <li>
            Full details: LIMITATIONS.md in the repository.
          </li>
        </ul>
      </section>
    </div>
  );
}
