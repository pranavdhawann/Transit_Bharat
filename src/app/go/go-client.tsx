"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import ModeIcon from "@/components/ModeIcon";
import MapView from "@/components/MapView";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import RouteBar from "@/components/RouteBar";
import { fmtClockIST, fmtDurationMinutes, fmtWalk } from "@/lib/format";
import {
  positionAlongLeg,
  reanchorAtSpeedChange,
  simulationTime,
} from "@/lib/go-navigation";
import { journeyEndpointFor } from "@/lib/current-location";
import { useVehicles } from "@/lib/hooks";
import { enrichJourneyGeometry } from "@/lib/route-geometry-client";
import {
  loadScenario,
  saveScenario,
  scenarioQuery,
} from "@/lib/scenario-client";
import type { Journey, Leg, ScenarioState, Vehicle } from "@/lib/types";

interface Boundary {
  start: number;
  end: number;
  rideStart: number;
  leg: Leg;
}

const CONTROL =
  "rounded-[2px] border border-rule bg-surface px-3 py-2 type-micro text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";

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
          const matchesRequest = sel ? j?.id === sel : !fromId && !toId;
          if (!cancelled && j?.legs?.length && matchesRequest) {
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
              ...(params.get("maxTransfers") !== null
                ? { maxTransfers: Number(params.get("maxTransfers")) }
                : {}),
              ...(params.get("access")
                ? { accessibilityNeed: params.get("access") }
                : {}),
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
        <p className="text-ink-2">
          No journey selected. Plan a route first.
        </p>
        <Link href="/" className={`mt-3 inline-block ${CONTROL}`}>
          Back to search
        </Link>
      </div>
    );
  }

  if (!journey) {
    return (
      <p className="py-16 text-center text-sm text-ink-3">
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [trackedVehicleId, setTrackedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    if (journey.legs.every((leg) => leg.geometrySource)) return;
    const controller = new AbortController();
    void enrichJourneyGeometry(journey, controller.signal)
      .then((enriched) => {
        if (controller.signal.aborted || enriched === journey) return;
        setJourney(enriched);
        try {
          sessionStorage.setItem("bt:journey", JSON.stringify(enriched));
        } catch {
          // Navigation still works; only reload persistence is unavailable.
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [journey]);

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

  const simNow = simulationTime(anchor, Date.now(), speed);
  const clampedNow = Math.min(simNow, jEnd);

  const currentIdx = running
    ? boundaries.findIndex((b) => clampedNow >= b.start && clampedNow < b.end)
    : -1;
  const arrived = running && clampedNow >= jEnd;

  useEffect(() => {
    if (!running || arrived) return;
    const t = setInterval(() => forceTick((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [running, arrived]);
  const current = currentIdx >= 0 ? boundaries[currentIdx] : null;
  const travellerPosition = current
    ? {
        ...positionAlongLeg(
          current.leg,
          clampedNow,
          current.start,
          current.rideStart,
          current.end,
        ),
        label: "Your simulated position",
      }
    : arrived
      ? {
          lat: journey.legs[journey.legs.length - 1].to.lat,
          lon: journey.legs[journey.legs.length - 1].to.lon,
          label: "Destination",
        }
      : {
          lat: journey.legs[0].from.lat,
          lon: journey.legs[0].from.lon,
          label: "Journey start",
        };

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

  useEffect(() => {
    if (!current || current.leg.mode !== "BUS") {
      setTrackedVehicleId(null);
      return;
    }
    const leg = current.leg;
    if (
      trackedVehicleId &&
      vehicles.some(
        (vehicle) =>
          vehicle.id === trackedVehicleId &&
          vehicle.routeNumber === leg.routeNumber &&
          (!leg.headsign || vehicle.headsign === leg.headsign),
      )
    ) {
      return;
    }
    const sameDirection = vehicles.filter(
      (vehicle) =>
        vehicle.routeNumber === leg.routeNumber &&
        (!leg.headsign || vehicle.headsign === leg.headsign),
    );
    const pool = sameDirection.length
      ? sameDirection
      : vehicles.filter((vehicle) => vehicle.routeNumber === leg.routeNumber);
    let best: Vehicle | null = null;
    let bestD = Infinity;
    for (const v of pool) {
      const d = (v.lat - leg.from.lat) ** 2 + (v.lon - leg.from.lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    setTrackedVehicleId(best?.id ?? null);
  }, [current, trackedVehicleId, vehicles]);

  const trackedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === trackedVehicleId) ?? null,
    [trackedVehicleId, vehicles],
  );

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
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        tag === "A" ||
        tag === "SELECT" ||
        tag === "SUMMARY" ||
        target?.isContentEditable
      ) {
        return;
      }
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
    const routeNumber =
      current?.leg.mode === "BUS" ? current.leg.routeNumber : undefined;
    if (!routeNumber) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const triggerResponse = await fetch("/api/demo/disruption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          routeNumber,
          delayMinutes: 11,
        }),
      });
      const triggerData = (await triggerResponse.json()) as {
        scenario?: ScenarioState;
        message?: string;
      };
      if (!triggerResponse.ok || !triggerData.scenario?.active) {
        throw new Error(triggerData.message || "Could not start the delay demo.");
      }
      saveScenario(triggerData.scenario);
      const q = journey.query ?? {
        fromId: "",
        toId: "",
      };
      if (!(q.fromId || q.fromLocation) || !(q.toId || q.toLocation)) return;
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q, scenario: triggerData.scenario }),
      });
      const data = (await res.json()) as { journeys?: Journey[]; message?: string };
      if (!res.ok || !data.journeys) {
        throw new Error(data.message || "Could not recalculate the journey.");
      }
      const disrupted = data.journeys.find((j) => j.disrupted);
      if (!disrupted) {
        setActionMessage("The current route was not affected. Continue on this journey.");
        return;
      }
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
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Could not simulate the delay.",
      );
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
    const wallNow = Date.now();
    const nowSim = Math.min(simulationTime(anchor, wallNow, speed), jEnd);
    const altDepart = Date.parse(alt.departAt);
    setShiftMs(Math.max(0, Math.min(nowSim - altDepart, 20 * 60_000)));
    setAnchor({ wall: wallNow, sim: nowSim });
    setJourney(alt);
    setBanner(null);
    try {
      sessionStorage.setItem("bt:journey", JSON.stringify(alt));
    } catch {
      // Current GO session remains usable.
    }
    const next = new URLSearchParams(window.location.search);
    next.set("sel", alt.id);
    window.history.replaceState(null, "", `/go?${next.toString()}`);
  }

  function changeSpeed(nextSpeed: 1 | 30) {
    if (nextSpeed === speed) return;
    const wallNow = Date.now();
    setAnchor(reanchorAtSpeedChange(anchor, wallNow, speed));
    setSpeed(nextSpeed);
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
            className={CONTROL}
          >
            &larr; Exit GO
          </Link>
        </div>
        <span className="hatch type-micro border border-rule px-3 py-1 text-ink-2">
          Synthetic realtime data · DEMO
        </span>
      </div>

      {!running ? (
        <section className="space-y-4 border border-rule bg-surface p-6">
          <h1 className="type-display text-2xl">Ready to go?</h1>
          <JourneySummary journey={journey} />
          <button
            onClick={start}
            className="type-display w-full rounded-[2px] bg-ink px-6 py-4 text-lg text-paper hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
          >
            Start journey
          </button>
          <p className="text-center text-xs text-ink-3">
            Demo runs at 30&times; speed. Press Space or the Advance button to
            step through states.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden border border-rule bg-surface">
          {/* Instruction hero */}
          <div className="bg-ink px-5 py-6 text-paper sm:px-7">
            <p className="sr-only" role="status" aria-live="polite">
              {arrived
                ? "You have reached your destination."
                : current
                  ? `${current.leg.mode} from ${current.leg.from.name} to ${current.leg.to.name}`
                  : `Journey starts at ${fmtClockIST(journey.departAt)}`}
            </p>
            {arrived ? (
              <>
                <p className="type-micro text-saffron">
                  Arrived
                </p>
                <h1 className="type-display mt-1 text-2xl">
                  You have reached your destination.
                </h1>
              </>
            ) : current ? (
              <Instruction boundary={current} simNow={clampedNow} />
            ) : (
              <h1 className="type-display text-2xl">
                Your journey starts at {fmtClockIST(journey.departAt)}.
              </h1>
            )}
            <div
              className="mt-4 flex gap-1"
              role="progressbar"
              aria-valuenow={Math.round(arrived ? 100 : overallProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Journey progress"
            >
              {journey.legs.map((leg, i) => {
                const legStart = boundaries[i]?.start ?? jStart;
                const legEnd = boundaries[i]?.end ?? legStart;
                const filled = arrived || clampedNow >= legEnd;
                const active = !filled && clampedNow >= legStart;
                return (
                  <span
                    key={i}
                    style={{ flexGrow: Math.max(1, leg.durationMinutes) }}
                    className={`bt-animate h-1.5 flex-1 transition-colors ${
                      filled
                        ? "bg-paper"
                        : active
                          ? "bg-saffron"
                          : "bg-tick-empty"
                    }`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-paper">
              {fmtClockIST(new Date(clampedNow).toISOString())} simulated ·{" "}
              {Math.round(overallProgress)}% complete
            </p>
          </div>

          {/* Disruption */}
          {banner && banner.savedMin > 0 && (
            <div className="border-b border-stale bg-surface px-5 py-3 text-sm text-ink">
              <p className="font-semibold">
                Bus delayed +{banner.delayMin} min — you would miss your connection.
              </p>
              <p>
                Better route found — arrive {banner.savedMin} min earlier.
              </p>
              <button
                onClick={switchRoute}
                className="type-micro mt-2 rounded-[2px] border border-rule bg-ink px-4 py-2 text-paper hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
              >
                Switch route
              </button>
            </div>
          )}

          <MapView
            legs={journey.legs}
            vehicles={vehicles}
            highlightVehicleId={trackedVehicle?.id ?? null}
            focusLegIndex={currentIdx >= 0 ? currentIdx : arrived ? journey.legs.length - 1 : null}
            travellerPosition={travellerPosition}
            className="m-4 h-52 sm:h-64"
          />

          {/* Upcoming steps */}
          {!arrived && (
            <UpNext boundaries={boundaries} currentIndex={currentIdx} />
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-3">
            {arrived ? (
              <>
                <Link
                  href="/"
                  onClick={() => sessionStorage.removeItem("bt:journey")}
                  className={CONTROL}
                >
                  Plan another journey
                </Link>
                <button
                  onClick={restart}
                  className={CONTROL}
                >
                  Replay demo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={advance}
                  className={CONTROL}
                >
                  Advance &rarr;
                </button>
                <div className="flex overflow-hidden rounded-[2px] border border-rule" role="group" aria-label="Simulation speed">
                  {[1, 30].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s as 1 | 30)}
                      aria-pressed={speed === s}
                      className={`px-3 py-2 type-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-saffron ${
                        speed === s ? "bg-paper text-ink" : "bg-surface text-ink hover:bg-paper"
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
                    className={`ml-auto ${CONTROL} disabled:opacity-50`}
                  >
                    Simulate delay (demo)
                  </button>
                )}
                {actionMessage && (
                  <p className="w-full text-sm text-stale" role="status">
                    {actionMessage}
                  </p>
                )}
                {(journey.disrupted || banner) && (
                  <span className="type-micro ml-auto border border-stale bg-surface px-2 py-1 text-stale">
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
    <>
      <RouteBar legs={journey.legs} />
      <ul className="mt-4 space-y-2 text-sm">
        {journey.legs.map((leg, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule bg-surface text-ink-2">
              <ModeIcon mode={leg.mode} size={14} />
            </span>
            <span>
              {leg.mode === "WALK"
                ? `Walk ${fmtWalk(leg.walkingMeters ?? 0)} to ${leg.to.name}`
                : leg.mode === "AUTO"
                  ? `Auto · ${leg.from.name} → ${leg.to.name}`
                  : `${leg.routeNumber} ${leg.routeName} · ${leg.from.name} → ${leg.to.name}`}
            </span>
            <span className="ml-auto shrink-0 text-xs text-ink-3">
              ~{Math.round(leg.durationMinutes)} min
            </span>
          </li>
        ))}
      </ul>
    </>
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
        <p className="type-micro text-saffron">
          Now
        </p>
        <h1 className="type-display mt-1 text-2xl">
          Walk to {leg.to.name}
        </h1>
        <p className="mt-1 text-sm text-paper">
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
          <p className="type-micro text-saffron">
            Get ready
          </p>
          <h1 className="type-display mt-1 text-2xl">
            {leg.mode === "AUTO"
              ? "Wait for your auto"
              : `Wait for ${leg.mode === "BUS" ? "bus" : "metro"} ${leg.routeNumber}`}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-paper">
            Board at {leg.from.name} · arrives {fmtClockIST(new Date(boundary.rideStart).toISOString())}
            <ProvenanceBadge provenance={leg.provenance} suffix="arrival estimate" />
          </p>
        </>
      );
    }
    return (
      <>
        <p className="type-micro text-saffron">
          Approaching
        </p>
          <h1 className="type-display mt-1 text-2xl">
            Your {leg.mode === "AUTO" ? "auto" : leg.mode === "BUS" ? "bus" : "train"} is arriving
          </h1>
          <p className="mt-1 text-sm text-paper">
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
        <p className="type-micro text-saffron">
          Get ready
        </p>
        <h1 className="type-display mt-1 text-2xl">
          Next stop is yours: {leg.to.name}
        </h1>
        <p className="mt-1 text-sm text-paper">
          Move toward the door — get off at {leg.to.name}.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="type-micro text-saffron">
        On board
      </p>
      <h1 className="type-display mt-1 text-2xl">
        {leg.mode === "AUTO"
          ? "Ride your auto"
          : `Ride ${leg.mode === "BUS" ? "bus" : "metro"} ${leg.routeNumber}`}
        <span className="block text-base font-medium text-paper">
          {leg.from.name} &rarr; {leg.to.name}
        </span>
      </h1>
      <p className="mt-2 text-sm text-paper">
        {leg.mode === "AUTO"
          ? `Get off at ${leg.to.name}`
          : <>
              <span className="type-data text-4xl">{stopsRemaining}</span>{" "}
              stop{stopsRemaining === 1 ? "" : "s"} remaining · get off at {leg.to.name}
            </>}
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
    <div className="border-t border-rule px-5 py-3">
      <p className="type-micro text-ink-3">
        Then
      </p>
      <ul className="mt-1 space-y-1 text-sm text-ink-2">
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
