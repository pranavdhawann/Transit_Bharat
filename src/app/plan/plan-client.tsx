"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import BottomSheet, { type Snap } from "@/components/BottomSheet";
import JourneyTimeline from "@/components/JourneyTimeline";
import LangToggle from "@/components/LangToggle";
import MapView from "@/components/MapView";
import RouteCard from "@/components/RouteCard";
import { fmtAge } from "@/lib/format";
import { journeyEndpointFor } from "@/lib/current-location";
import { useNow, useVehicles } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { enrichJourneyGeometry } from "@/lib/route-geometry-client";
import {
  loadScenario,
  saveScenario,
  scenarioQuery,
} from "@/lib/scenario-client";
import type { DisruptionNote } from "@/lib/explain";
import type { Journey, ScenarioState, Vehicle } from "@/lib/types";

/** The one control treatment on this page: 2px radius, rule border, ink label. */
const CONTROL =
  "rounded-[2px] border border-rule bg-surface px-3 py-2 type-micro text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";

export default function PlanClient() {
  const params = useSearchParams();
  const router = useRouter();
  const fromId = params.get("from") ?? "";
  const toId = params.get("to") ?? "";
  const lessWalking = params.get("lessWalk") === "1";
  const maxTransfersParam = params.get("maxTransfers");
  const maxTransfers =
    maxTransfersParam !== null && /^[0-4]$/.test(maxTransfersParam)
      ? Number(maxTransfersParam)
      : null;
  const [lang] = useLang();
  const selParam = params.get("sel");

  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(selParam);
  // Seeded from sessionStorage so the delay survives a reload or a trip
  // through GO mode; the server is stateless about it by design.
  const [scenario, setScenario] = useState<ScenarioState | null>(null);
  useEffect(() => {
    setScenario(loadScenario());
  }, []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<DisruptionNote | null>(null);
  // Mobile only: the sheet is a static column at lg and above.
  const [snap, setSnap] = useState<Snap>("half");

  const fetchJourneys = useCallback(async () => {
    setError(null);
    const fromEndpoint = journeyEndpointFor(fromId);
    const toEndpoint = journeyEndpointFor(toId);
    if (!fromEndpoint || !toEndpoint) {
      setJourneys([]);
      setError(
        "Your current location is no longer available. Go back and select it again.",
      );
      return;
    }
    try {
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
          lessWalking,
          ...(maxTransfers !== null ? { maxTransfers } : {}),
          scenario: loadScenario(),
        }),
      });
      if (!res.ok) throw new Error("planning failed");
      const data = (await res.json()) as {
        journeys: Journey[];
        scenario: ScenarioState;
      };
      setJourneys(data.journeys);
      setScenario(data.scenario);
      saveScenario(data.scenario);
      setSelectedId((cur) => cur ?? data.journeys[0]?.id ?? null);
    } catch {
      setError("Could not plan a route between these places.");
    }
  }, [fromId, toId, lessWalking, maxTransfers]);

  useEffect(() => {
    void fetchJourneys();
  }, [fetchJourneys]);

  const selected = useMemo(
    () => journeys?.find((j) => j.id === selectedId) ?? journeys?.[0] ?? null,
    [journeys, selectedId],
  );

  // Street-following shapes are additive: route cards render immediately,
  // then the selected map refines without blocking journey planning.
  useEffect(() => {
    if (!selected || selected.legs.every((leg) => leg.geometrySource)) return;
    const controller = new AbortController();
    void enrichJourneyGeometry(selected, controller.signal)
      .then((enriched) => {
        if (controller.signal.aborted || enriched === selected) return;
        setJourneys((current) =>
          current?.map((journey) =>
            journey.id === enriched.id ? enriched : journey,
          ) ?? current,
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected]);

  // Keep the URL shareable.
  useEffect(() => {
    if (selected && selected.id !== selParam) {
      const next = new URLSearchParams(params.toString());
      next.set("sel", selected.id);
      window.history.replaceState(null, "", "/plan?" + next.toString());
    }
  }, [selected, selParam, params]);

  const busRoutes = useMemo(() => {
    if (!selected) return null;
    const nums = [
      ...new Set(
        selected.legs
          .filter((l) => l.mode === "BUS")
          .map((l) => l.routeNumber ?? "")
          .filter(Boolean),
      ),
    ];
    return nums.length ? nums : null;
  }, [selected]);
  const vehicles = useVehicles(busRoutes, 4000, scenarioQuery(scenario));

  // Deterministically track the vehicle nearest the first boarding stop.
  const trackedVehicle = useMemo(() => {
    const busLeg = selected?.legs.find((l) => l.mode === "BUS");
    if (!busLeg || vehicles.length === 0) return null;
    const onRoute = vehicles.filter((v) => v.routeNumber === busLeg.routeNumber);
    const pool = onRoute.length ? onRoute : vehicles;
    let best: Vehicle | null = null;
    let bestD = Infinity;
    for (const v of pool) {
      const d = (v.lat - busLeg.from.lat) ** 2 + (v.lon - busLeg.from.lon) ** 2;
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }, [selected, vehicles]);

  async function triggerDisruption() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/disruption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger",
          delayMinutes: 11,
        }),
      });
      const data = (await res.json()) as { scenario: ScenarioState };
      saveScenario(data.scenario);
      setScenario(data.scenario);
      setSelectedId(null);
      await fetchJourneys();
    } finally {
      setBusy(false);
    }
  }

  async function resetDemo() {
    setBusy(true);
    try {
      await fetch("/api/demo/disruption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      saveScenario(null);
      setScenario(null);
      setSelectedId(null);
      await fetchJourneys();
    } finally {
      setBusy(false);
    }
  }

  function startGo() {
    if (!selected) return;
    try {
      sessionStorage.setItem("bt:journey", JSON.stringify(selected));
    } catch {
      // GO page falls back to re-planning via URL params.
    }
    const qs = new URLSearchParams({ sel: selected.id, from: fromId, to: toId });
    if (lessWalking) qs.set("lessWalk", "1");
    if (maxTransfers !== null) qs.set("maxTransfers", String(maxTransfers));
    router.push("/go?" + qs.toString());
  }

  // Plain-language explanation of the delay, phrased by the model from the
  // planner's own numbers. Never blocks the cards from rendering.
  useEffect(() => {
    const disrupted = journeys?.find((j) => j.disrupted);
    const alternative = journeys?.find((j) => !j.disrupted);
    if (!scenario?.active || !disrupted || !alternative) {
      setNote(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai/disruption-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disrupted,
            alternative,
            scenario: loadScenario(),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as DisruptionNote;
        if (!cancelled) setNote(data);
      } catch {
        // The cards already say everything essential; the note is additive.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [journeys, scenario]);

  if (!fromId || !toId) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-2">Pick a start and destination first.</p>
        <Link href="/" className={`mt-3 inline-block ${CONTROL}`}>
          Back to search
        </Link>
      </div>
    );
  }

  const betterAltExists =
    journeys !== null &&
    scenario?.active === true &&
    journeys.some((j) => !j.disrupted) &&
    journeys.some((j) => j.disrupted);

  return (
    <div className="space-y-4">
      {/* Toolbar. Spans the full width at both breakpoints, so it sits above
          the map on mobile instead of inside the sheet — at peek the sheet
          must open on the top result's RouteBar, not on the controls. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule pb-3">
        <Link href="/" className={CONTROL}>
          &larr; New search
        </Link>
        <h1 className="type-display text-lg">Route options</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* The disruption note below is bilingual, so the rider needs the
              switch on this page and not only on the home screen. */}
          <LangToggle />
          {scenario?.active ? (
            <>
              <span className="type-micro border border-stale px-2 py-1 text-stale">
                Demo delay · bus {scenario.routeNumber} +{scenario.delayMinutes} min
              </span>
              <button
                onClick={() => void resetDemo()}
                disabled={busy}
                className={`${CONTROL} disabled:opacity-50`}
              >
                Reset demo
              </button>
            </>
          ) : (
            <button
              onClick={() => void triggerDisruption()}
              disabled={busy}
              className={`${CONTROL} disabled:opacity-50`}
            >
              Simulate delay (demo)
            </button>
          )}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:gap-5">
        {/* Mobile: the three-snap sheet over the map. Desktop: the static
            left column. One subtree either way — the list is never
            duplicated in the DOM. */}
        <BottomSheet snap={snap} onSnapChange={setSnap} label="Route options">
          <div className="space-y-3">
            {journeys?.map((j) => (
              <RouteCard
                key={j.id}
                journey={j}
                selected={j.id === selected?.id}
                onSelect={(id) => setSelectedId(id)}
              />
            ))}

            {error && (
              <p className="border border-ink bg-surface p-4 text-sm text-ink">
                {error}
              </p>
            )}

            {!journeys && !error && (
              <p className="py-10 text-center text-sm text-ink-3">
                Planning your journey…
              </p>
            )}

            {journeys && journeys.length === 0 && (
              <p className="border border-rule bg-surface p-4 text-sm text-ink-2">
                No route found between these places on the Delhi pilot network
                yet. Try one of the suggested demo journeys.
              </p>
            )}

            {/* Notices sit under the list: the cards are the answer, and at
                peek nothing may push the top result's RouteBar out of view. */}
            {betterAltExists && (
              <p className="border border-live bg-surface p-3 text-sm font-medium text-ink">
                Better route found — options without the delayed bus now arrive
                earlier.
              </p>
            )}

            {note && (
              <div className="border border-stale bg-surface p-4">
                <p className="text-sm leading-relaxed text-ink">
                  {lang === "hi" ? note.hi : note.en}
                </p>
                <p className="mt-2 text-xs text-ink-3">
                  {note.source === "openai"
                    ? `Wording by ${note.model ?? "OpenAI"}${note.latencyMs !== null ? ` · ${note.latencyMs} ms` : ""}`
                    : `Wording from the built-in template${note.fallbackReason ? ` · ${note.fallbackReason}` : ""}`}
                  {" · times and fares from the deterministic planner"}
                </p>
              </div>
            )}

            {selected && (
              <section
                aria-labelledby="detail-heading"
                className="space-y-4 border border-rule bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="detail-heading" className="type-display text-base">
                    Journey details
                  </h2>
                  <button
                    onClick={startGo}
                    className="type-display rounded-[2px] bg-ink px-4 py-2 text-sm text-paper hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
                  >
                    Start GO navigation &rarr;
                  </button>
                </div>

                {trackedVehicle && <LiveStrip vehicle={trackedVehicle} />}
                <JourneyTimeline journey={selected} />
              </section>
            )}
          </div>
        </BottomSheet>

        {/* The single MapView JSX site. Full-bleed under the sheet on mobile,
            sticky right column on desktop — repositioned by classes only, so
            the MapLibre instance survives every breakpoint change. */}
        <div className="-mx-4 h-[calc(100vh-9rem)] min-h-[18rem] lg:sticky lg:top-16 lg:mx-0 lg:h-[calc(100vh-6rem)]">
          <MapView
            legs={selected?.legs ?? []}
            vehicles={vehicles}
            highlightVehicleId={trackedVehicle?.id ?? null}
            occludedBottomFraction={
              snap === "peek" ? 0.18 : snap === "half" ? 0.52 : 0.82
            }
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

function LiveStrip({ vehicle }: { vehicle: Vehicle }) {
  const now = useNow(1000);
  const ageSec = Math.max(
    0,
    Math.round((now - new Date(vehicle.updatedAt).getTime()) / 1000),
  );
  return (
    // `hatch` is the "not real" treatment shared with the DEMO provenance
    // badge and walk segments: synthetic data never looks like measured data.
    <div className="hatch flex flex-wrap items-center gap-x-2 gap-y-1 border border-rule bg-paper px-3 py-2 text-sm text-ink-2">
      <span className="type-micro text-ink">
        DEMO LIVE &middot; bus {vehicle.routeNumber}-{vehicle.id.split("-")[1]}
      </span>
      <span>updated {fmtAge(ageSec)}</span>
      <span>
        &middot; next stop: {vehicle.nextStopName}
        {vehicle.delayMinutes > 0 ? " · delayed +" + vehicle.delayMinutes + " min" : ""}
      </span>
      <span className="type-micro ml-auto text-ink-3">Synthetic data</span>
    </div>
  );
}
