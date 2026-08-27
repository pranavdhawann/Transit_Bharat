"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import JourneyTimeline from "@/components/JourneyTimeline";
import LangToggle from "@/components/LangToggle";
import MapView from "@/components/MapView";
import RouteCard from "@/components/RouteCard";
import { fmtAge } from "@/lib/format";
import { useNow, useVehicles } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import {
  loadScenario,
  saveScenario,
  scenarioQuery,
} from "@/lib/scenario-client";
import type { DisruptionNote } from "@/lib/explain";
import type { Journey, ScenarioState, Vehicle } from "@/lib/types";

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

  const fetchJourneys = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId,
          toId,
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
        <p className="text-slate-600">Pick a start and destination first.</p>
        <Link
          href="/"
          className="mt-3 inline-block font-medium text-blue-600 hover:underline"
        >
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          &larr; New search
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Route options</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* The disruption note below is bilingual, so the rider needs the
              switch on this page and not only on the home screen. */}
          <LangToggle />
          {scenario?.active ? (
            <>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                Demo disruption: bus {scenario.routeNumber} +{scenario.delayMinutes} min
              </span>
              <button
                onClick={() => void resetDemo()}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Reset demo
              </button>
            </>
          ) : (
            <button
              onClick={() => void triggerDisruption()}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Simulate delay (demo)
            </button>
          )}
        </div>
      </div>

      {note && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm leading-relaxed text-amber-900">
            {lang === "hi" ? note.hi : note.en}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {note.source === "openai"
              ? `Wording by ${note.model ?? "OpenAI"}${note.latencyMs !== null ? ` · ${note.latencyMs} ms` : ""}`
              : `Wording from the built-in template${note.fallbackReason ? ` · ${note.fallbackReason}` : ""}`}
            {" · times and fares from the deterministic planner"}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {!journeys && !error && (
        <p className="py-10 text-center text-sm text-slate-400">
          Planning your journey…
        </p>
      )}

      {journeys && journeys.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No route found between these places on the Delhi pilot network yet.
          Try one of the suggested demo journeys.
        </p>
      )}

      {betterAltExists && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Better route found — options without the delayed bus now arrive earlier.
        </p>
      )}

      <div className="space-y-3">
        {journeys?.map((j) => (
          <RouteCard
            key={j.id}
            journey={j}
            selected={j.id === selected?.id}
            onSelect={(id) => setSelectedId(id)}
          />
        ))}
      </div>

      {selected && (
        <section
          aria-labelledby="detail-heading"
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="detail-heading" className="text-lg font-semibold tracking-tight">
              Journey details
            </h2>
            <button
              onClick={startGo}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Start GO navigation &rarr;
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <MapView
              legs={selected.legs}
              vehicles={vehicles}
              highlightVehicleId={trackedVehicle?.id ?? null}
              className="h-64 w-full sm:h-80 lg:h-[26rem]"
            />
            <div>
              {trackedVehicle && <LiveStrip vehicle={trackedVehicle} />}
              <JourneyTimeline journey={selected} />
            </div>
          </div>
        </section>
      )}
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
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
      <span className="font-semibold">
        DEMO LIVE &middot; bus {vehicle.routeNumber}-{vehicle.id.split("-")[1]}
      </span>
      <span>updated {fmtAge(ageSec)}</span>
      <span className="text-violet-700">
        &middot; next stop: {vehicle.nextStopName}
        {vehicle.delayMinutes > 0 ? " · delayed +" + vehicle.delayMinutes + " min" : ""}
      </span>
      <span className="ml-auto text-[11px] uppercase tracking-wide text-violet-500">
        Synthetic data
      </span>
    </div>
  );
}
