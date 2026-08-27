"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import LangToggle from "@/components/LangToggle";
import ModeIcon from "@/components/ModeIcon";
import MapView from "@/components/MapView";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { fmtClockIST, fmtDurationMinutes, fmtWalk } from "@/lib/format";
import { journeyEndpointFor } from "@/lib/current-location";
import { useVehicles } from "@/lib/hooks";
import { loadScenario, scenarioQuery } from "@/lib/scenario-client";
import type { Journey, Leg, Vehicle } from "@/lib/types";

interface Boundary {
  start: number;
  end: number;
  rideStart: number;
  leg: Leg;
}

export default function GoClient() {
  const params = useSearchParams();
  const sel = params.get("sel");
  const fromId = params.get("from");
  const toId = params.get("to");

  const [journey, setJourney] = useState<Journey | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer the journey handed over from the plan page.
      try {
        const raw = sessionStorage.getItem("bt:journey");
        if (raw) {
          const j = JSON.parse(raw) as Journey;
          if (!cancelled && j?.legs?.length) {
            setJourney(j);
            return;
          }
        }
      } catch {
        // fall through to re-planning
      }
      if (fromId && toId) {
        try {
          const fromEndpoint = journeyEndpointFor(fromId);
          const toEndpoint = journeyEndpointFor(toId);
          if (!fromEndpoint || !toEndpoint) throw new Error("location missing");
          const res = await fetch("/api/journeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(fromEndpoint.location
                ? { fromLocation: fromEndpoint.location }
                : { fromId: fromEndpoint.id }),
              ...(toEndpoint.location
                ? { toLocation: toEndpoint.location }
                : { toId: toEndpoint.id }),
              lessWalking: params.get("lessWalk") === "1",
              scenario: loadScenario(),
            }),
          });
          if (!res.ok) throw new Error("planning failed");
          const data = (await res.json()) as { journeys: Journey[] };
          const pick =
            data.journeys.find((j) => j.id === sel) ?? data.journeys[0];
          if (!cancelled && pick) setJourney(pick);
          else if (!cancelled) setMissing(true);
        } catch {
          if (!cancelled) setMissing(true);
        }
      } else if (!cancelled) {
        setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromId, toId, sel, params]);

  if (missing) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-600">
          No journey selected. Plan a route first.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block font-medium text-blue-600 hover:underline"
        >
          Back to search
        </Link>
      </div>
    );
  }

  if (!journey) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        Preparing navigation…
      </p>
    );
  }

  return <GoNavigator initialJourney={journey} />;
}

function GoNavigator({ initialJourney }: { initialJourney: Journey }) {
  const [journey, setJourney] = useState<Journey>(initialJourney);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<1 | 30>(30);
  /** sim epoch ms at anchor.wall */
  const [anchor, setAnchor] = useState(() => ({
    wall: Date.now(),
    sim: Date.parse(initialJourney.departAt),
  }));
  /** Shift applied when switching to an itinerary that departs later. */
  const [shiftMs, setShiftMs] = useState(0);
  const [, forceTick] = useState(0);
  const [banner, setBanner] = useState<{
    altJourney: Journey;
    savedMin: number;
    delayMin: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const boundaries = useMemo<Boundary[]>(
    () =>
      journey.legs.map((leg) => {
        const start = Date.parse(leg.departAt) + shiftMs;
        const end = Date.parse(leg.arriveAt) + shiftMs;
        const rideStart = start + (leg.waitMinutes ?? 0) * 60_000;
        return { start, end, rideStart, leg };
      }),
    [journey, shiftMs],
  );

  const jStart = boundaries[0]?.start ?? Date.now();
  const jEnd = boundaries[boundaries.length - 1]?.end ?? jStart;

  const simNow = anchor.sim + (Date.now() - anchor.wall) * speed;
  const clampedNow = Math.min(simNow, jEnd);

  const currentIdx = running
    ? boundaries.findIndex((b) => clampedNow >= b.start && clampedNow < b.end)
    : -1;
  const arrived = running && clampedNow >= jEnd;
  const current = currentIdx >= 0 ? boundaries[currentIdx] : null;

  const busRoutes = useMemo(() => {
    const nums = [
      ...new Set(
        journey.legs
          .filter((l) => l.mode === "BUS")
          .map((l) => l.routeNumber ?? "")
          .filter(Boolean),
      ),
    ];
    return nums.length ? nums : null;
  }, [journey]);
  const vehicles = useVehicles(
    running && !arrived ? busRoutes : null,
    4000,
    scenarioQuery(loadScenario()),
  );

  const trackedVehicle = useMemo(() => {
    if (!current || current.leg.mode !== "BUS") return null;
    const leg = current.leg;
    const pool = vehicles.filter(
      (v) => v.routeNumber === leg.routeNumber,
    );
    let best: Vehicle | null = null;
    let bestD = Infinity;
    for (const v of pool.length ? pool : vehicles) {
      const d = (v.lat - leg.from.lat) ** 2 + (v.lon - leg.from.lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }, [current, vehicles]);

  const start = () => {
    setAnchor({ wall: Date.now(), sim: Date.parse(journey.departAt) });
    setShiftMs(0);
    setBanner(null);
    setRunning(true);
  };

  const restart = useCallback(() => {
    setAnchor({ wall: Date.now(), sim: Date.parse(journey.departAt) });
    setShiftMs(0);
    setBanner(null);
    setRunning(true);
  }, [journey]);

  /** Jump simulated time to the next instruction boundary. */
  const advance = useCallback(() => {
    if (!running || arrived) return;
    const points = boundaries
      .flatMap((b) => [b.start, b.rideStart > b.start ? b.rideStart : -1, b.end])
      .filter((p) => p > clampedNow + 500)
      .sort((a, b) => a - b);
    const next = points[0];
    if (next === undefined) {
      setAnchor({ wall: Date.now(), sim: jEnd });
      return;
    }
    setAnchor({ wall: Date.now(), sim: next });
  }, [running, arrived, boundaries, clampedNow, jEnd]);

  // Keyboard shortcuts: Space = advance, R = restart.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      } else if (e.key.toLowerCase() === "r") {
        restart();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, restart]);

  async function simulateDelay() {
    setBusy(true);
    try {
      await fetch("/api/demo/disruption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", delayMinutes: 11 }),
      });
      const q = journey.query ?? {
        fromId: "",
        toId: "",
      };
      if (!(q.fromId || q.fromLocation) || !(q.toId || q.toLocation)) return;
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, scenario: loadScenario() }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { journeys: Journey[] };
      const disrupted = data.journeys.find((j) => j.disrupted) ?? journey;
      const alt = data.journeys
        .filter((j) => !j.disrupted)
        .sort((a, b) => Date.parse(a.arriveAt) - Date.parse(b.arriveAt))[0];
      const delayMin =
        disrupted.legs.find((l) => typeof l.delayMinutes === "number")
          ?.delayMinutes ?? 11;
      const savedMin = alt
        ? Math.round(
            (Date.parse(disrupted.arriveAt) - Date.parse(alt.arriveAt)) / 60000,
          )
        : 0;
      if (alt && savedMin > 0) {
        setBanner({ altJourney: alt, savedMin, delayMin });
      } else {
        setBanner({ altJourney: journey, savedMin: 0, delayMin });
      }
    } finally {
      setBusy(false);
    }
  }

  function switchRoute() {
    if (!banner || banner.savedMin <= 0) {
      setBanner(null);
      return;
    }
    const alt = banner.altJourney;
    const nowSim = anchor.sim + (Date.now() - anchor.wall);
    const altDepart = Date.parse(alt.departAt);
    setShiftMs(Math.max(0, Math.min(nowSim - altDepart, 20 * 60_000)));
    setJourney(alt);
    setBanner(null);
  }

  const overallProgress = Math.min(
    100,
    Math.max(0, ((clampedNow - jStart) / (jEnd - jStart)) * 100),
  );

  const showDelayButton =
    running &&
    !arrived &&
    !banner &&
    current?.leg.mode === "BUS" &&
    !journey.disrupted;

  // ---------------------------------------------------------------- render

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            &larr; Exit GO
          </Link>
          {/* Riders often land straight in GO from a shared link, so the
              language switch has to be reachable here too. */}
          <LangToggle />
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          Synthetic realtime data · DEMO
        </span>
      </div>

      {!running ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Ready to go?</h1>
          <JourneySummary journey={journey} />
          <button
            onClick={start}
            className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Start journey
          </button>
          <p className="text-center text-xs text-slate-400">
            Demo runs at 30&times; speed. Press Space or the Advance button to
            step through states.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Instruction hero */}
          <div className="bg-slate-900 px-5 py-6 text-white sm:px-7">
            {arrived ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Arrived
                </p>
                <h1 className="mt-1 text-2xl font-bold leading-tight">
                  You have reached your destination.
                </h1>
              </>
            ) : current ? (
              <Instruction boundary={current} simNow={clampedNow} />
            ) : (
              <h1 className="text-xl font-semibold">
                Your journey starts at {fmtClockIST(journey.departAt)}.
              </h1>
            )}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="bt-animate h-full rounded-full bg-emerald-400"
                style={{ width: `${arrived ? 100 : overallProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {fmtClockIST(new Date(clampedNow).toISOString())} simulated ·{" "}
              {Math.round(overallProgress)}% complete
            </p>
          </div>

          {/* Disruption */}
          {banner && banner.savedMin > 0 && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900">
              <p className="font-semibold">
                Bus delayed +{banner.delayMin} min — you would miss your connection.
              </p>
              <p>
                Better route found — arrive {banner.savedMin} min earlier.
              </p>
              <button
                onClick={switchRoute}
                className="mt-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Switch route
              </button>
            </div>
          )}

          <MapView
            legs={journey.legs}
            vehicles={vehicles}
            highlightVehicleId={trackedVehicle?.id ?? null}
            className="m-4 h-40 sm:h-52"
          />

          {/* Upcoming steps */}
          {!arrived && (
            <UpNext boundaries={boundaries} currentIndex={currentIdx} />
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
            {arrived ? (
              <>
                <Link
                  href="/"
                  onClick={() => sessionStorage.removeItem("bt:journey")}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Plan another journey
                </Link>
                <button
                  onClick={restart}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Replay demo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={advance}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Advance &rarr;
                </button>
                <div className="flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="Simulation speed">
                  {[1, 30].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s as 1 | 30)}
                      aria-pressed={speed === s}
                      className={`px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
                        speed === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {s}&times;
                    </button>
                  ))}
                </div>
                {showDelayButton && (
                  <button
                    onClick={() => void simulateDelay()}
                    disabled={busy}
                    className="ml-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-600"
                  >
                    Simulate delay (demo)
                  </button>
                )}
                {(journey.disrupted || banner) && (
                  <span className="ml-auto rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                    Delayed +{journey.legs.find((l) => l.delayMinutes)?.delayMinutes ?? banner?.delayMin} min
                  </span>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------ subcomponents

function JourneySummary({ journey }: { journey: Journey }) {
  return (
    <ul className="space-y-2 text-sm">
      {journey.legs.map((leg, i) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
            style={{
              backgroundColor:
                leg.mode === "WALK" ? "#64748b" : (leg.routeColor ?? "#2563eb"),
            }}
          >
            <ModeIcon mode={leg.mode} size={14} />
          </span>
          <span>
            {leg.mode === "WALK"
              ? `Walk ${fmtWalk(leg.walkingMeters ?? 0)} to ${leg.to.name}`
              : leg.mode === "AUTO"
                ? `Auto · ${leg.from.name} → ${leg.to.name}`
                : `${leg.routeNumber} ${leg.routeName} · ${leg.from.name} → ${leg.to.name}`}
          </span>
          <span className="ml-auto shrink-0 text-xs text-slate-400">
            ~{Math.round(leg.durationMinutes)} min
          </span>
        </li>
      ))}
    </ul>
  );
}

function Instruction({
  boundary,
  simNow,
}: {
  boundary: Boundary;
  simNow: number;
}) {
  const { leg } = boundary;

  if (leg.mode === "WALK") {
    const frac = Math.min(
      1,
      Math.max(0, (simNow - boundary.start) / (boundary.end - boundary.start)),
    );
    const remaining = Math.max(1, Math.ceil((1 - frac) * leg.durationMinutes));
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Now
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">
          Walk to {leg.to.name}
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          {fmtWalk(leg.walkingMeters ?? 0)} · about {remaining} min left
        </p>
      </>
    );
  }

  if (simNow < boundary.rideStart) {
    const untilBoard = Math.ceil((boundary.rideStart - simNow) / 60000);
    if (untilBoard > 2) {
      return (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
            Get ready
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            {leg.mode === "AUTO"
              ? "Wait for your auto"
              : `Wait for ${leg.mode === "BUS" ? "bus" : "metro"} ${leg.routeNumber}`}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            Board at {leg.from.name} · arrives {fmtClockIST(new Date(boundary.rideStart).toISOString())}
            <ProvenanceBadge provenance="DEMO" suffix="live position" />
          </p>
        </>
      );
    }
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Approaching
        </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            Your {leg.mode === "AUTO" ? "auto" : leg.mode === "BUS" ? "bus" : "train"} is arriving
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Stand at {leg.from.name}
            {leg.headsign ? ` — board toward ${leg.headsign}.` : "."}
          </p>
      </>
    );
  }

  const stopsTotal = leg.intermediateStops.length + 1;
  const rideFrac = Math.min(
    1,
    Math.max(0, (simNow - boundary.rideStart) / (boundary.end - boundary.rideStart)),
  );
  const stopsRemaining = Math.max(
    1,
    Math.ceil(stopsTotal * (1 - rideFrac)),
  );

  if (stopsRemaining <= 1 && leg.mode !== "AUTO") {
    return (
      <>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-300">
          Get ready
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">
          Next stop is yours: {leg.to.name}
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Move toward the door — get off at {leg.to.name}.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
        On board
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight">
        {leg.mode === "AUTO"
          ? "Ride your auto"
          : `Ride ${leg.mode === "BUS" ? "bus" : "metro"} ${leg.routeNumber}`}
        <span className="block text-base font-medium text-slate-300">
          {leg.from.name} &rarr; {leg.to.name}
        </span>
      </h1>
      <p className="mt-1 text-sm text-slate-300">
        {leg.mode === "AUTO"
          ? `Get off at ${leg.to.name}`
          : `${stopsRemaining} stop${stopsRemaining === 1 ? "" : "s"} remaining · get off at ${leg.to.name}`}
      </p>
    </>
  );
}

function UpNext({
  boundaries,
  currentIndex,
}: {
  boundaries: Boundary[];
  currentIndex: number;
}) {
  const upcoming = boundaries.slice(currentIndex + 1, currentIndex + 3);
  if (!upcoming.length) return null;
  return (
    <div className="border-t border-slate-100 px-5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Then
      </p>
      <ul className="mt-1 space-y-1 text-sm text-slate-500">
        {upcoming.map((b, i) => (
          <li key={i}>
            {b.leg.mode === "WALK"
              ? `Walk to ${b.leg.to.name}`
              : b.leg.mode === "AUTO"
                ? `Auto from ${b.leg.from.name}`
                : `${b.leg.routeNumber} from ${b.leg.from.name}`}{" "}
            · {fmtDurationMinutes(b.leg.durationMinutes)}
          </li>
        ))}
      </ul>
    </div>
  );
}
