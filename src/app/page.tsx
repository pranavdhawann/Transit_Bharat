"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LangToggle from "@/components/LangToggle";
import PlaceInput from "@/components/PlaceInput";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import VoiceTripButton from "@/components/VoiceTripButton";
import { constraintsFor, type PreferencesResult } from "@/lib/ai";
import {
  currentLocationPlace,
  saveCurrentLocation,
  saveSelectedPlace,
} from "@/lib/current-location";
import { t, useLang } from "@/lib/i18n";
import { SUGGESTED_PAIRS } from "@/lib/places";
import type { PlaceResult } from "@/lib/types";

type PrefsResponse = PreferencesResult & { error?: string };

/** Rider-facing wording for each reason the model call did not happen. */
const FALLBACK_COPY: Record<string, string> = {
  no_api_key: "no OpenAI key configured",
  timeout: "OpenAI timed out",
  http_error: "OpenAI rejected the request",
  empty_response: "OpenAI returned nothing",
  invalid_json: "OpenAI returned unreadable output",
  network_error: "could not reach OpenAI",
};

const NEED_COPY: Record<string, string> = {
  WHEELCHAIR: "wheelchair access",
  HEAVY_LUGGAGE: "heavy luggage",
  WITH_CHILD: "travelling with a child",
  SENIOR: "senior traveller",
};

export default function HomePage() {
  const router = useRouter();
  const [lang] = useLang();
  const [from, setFrom] = useState<PlaceResult | null>(null);
  const [to, setTo] = useState<PlaceResult | null>(null);
  const [lessWalking, setLessWalking] = useState(false);
  const [maxTransfers, setMaxTransfers] = useState<number | null>(null);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlNote, setNlNote] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);

  function go(f: PlaceResult | null, t: PlaceResult | null) {
    if (!f || !t) return;
    const params = new URLSearchParams({ from: f.id, to: t.id });
    if (lessWalking) params.set("lessWalk", "1");
    if (maxTransfers !== null) params.set("maxTransfers", String(maxTransfers));
    router.push(`/plan?${params.toString()}`);
  }

  function clearLocationStatus() {
    setLocationBusy(false);
    setLocationMessage(null);
    setLocationError(false);
  }

  function selectFrom(place: PlaceResult | null) {
    if (place?.type === "address" && !saveSelectedPlace(place)) {
      setLocationError(true);
      setLocationMessage("This address could not be saved for route planning. Allow site storage and try again.");
      return;
    }
    setFrom(place);
    if (place?.type !== "current") clearLocationStatus();
  }

  function selectTo(place: PlaceResult | null) {
    if (place?.type === "address" && !saveSelectedPlace(place)) return;
    setTo(place);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError(true);
      setLocationMessage("Current location is not supported by this browser.");
      return;
    }
    setLocationBusy(true);
    setLocationError(false);
    setLocationMessage("Finding your current location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = currentLocationPlace(position.coords);
        if (!saveCurrentLocation(place)) {
          setLocationBusy(false);
          setLocationError(true);
          setLocationMessage(
            "Your browser blocked temporary location storage. Allow site storage and try again.",
          );
          return;
        }
        setFrom(place);
        setLocationBusy(false);
        setLocationMessage(place.detail ?? "Current location ready.");
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Allow it in your browser settings and try again."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Your current location is unavailable. Check location services and try again."
              : error.code === error.TIMEOUT
                ? "Finding your location timed out. Try again."
                : "Could not read your current location. Try again.";
        setLocationBusy(false);
        setLocationError(true);
        setLocationMessage(message);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function applyPair(fromId: string, toId: string) {
    void (async () => {
      const [fRes, tRes] = await Promise.all([
        fetch(`/api/places?id=${encodeURIComponent(fromId)}`),
        fetch(`/api/places?id=${encodeURIComponent(toId)}`),
      ]);
      const fData = (await fRes.json()) as { place: PlaceResult | null };
      const tData = (await tRes.json()) as { place: PlaceResult | null };
      setFrom(fData.place);
      setTo(tData.place);
      clearLocationStatus();
    })();
  }

  async function parseTrip() {
    if (nlText.trim().length < 4) return;
    setNlBusy(true);
    setNlNote(null);
    try {
      const res = await fetch("/api/ai/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlText }),
      });
      const prefs = (await res.json()) as PrefsResponse;

      async function resolve(q: string | null): Promise<PlaceResult | null> {
        if (!q) return null;
        const r = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        const d = (await r.json()) as { results: PlaceResult[] };
        return d.results[0] ?? null;
      }

      const [f, t] = await Promise.all([
        resolve(prefs.originText),
        resolve(prefs.destinationText),
      ]);
      if (f) {
        setFrom(f);
        clearLocationStatus();
      }
      if (t) setTo(t);

      // A stated access need becomes real routing constraints, not a label.
      const constraints = constraintsFor(prefs);
      if (constraints.lessWalking) setLessWalking(true);
      setMaxTransfers(constraints.maxTransfers);

      const parts: string[] = [];
      if (prefs.source === "openai") {
        parts.push(
          `parsed with ${prefs.model ?? "OpenAI"}${prefs.latencyMs !== null ? ` in ${prefs.latencyMs} ms` : ""}`,
        );
      } else {
        // Say WHY, every time. A silent fallback looks identical to success.
        const why = prefs.fallbackReason
          ? (FALLBACK_COPY[prefs.fallbackReason] ?? prefs.fallbackReason)
          : "heuristic mode";
        parts.push(`parsed locally — ${why}`);
      }
      if (!f && !t) parts.push("couldn't find those places — try the search boxes");
      else if (!f || !t) parts.push("fill in the missing box");
      if (prefs.accessibilityNeed) {
        parts.push(
          `${NEED_COPY[prefs.accessibilityNeed] ?? "access need"} — less walking${
            constraints.maxTransfers !== null
              ? `, max ${constraints.maxTransfers} change${constraints.maxTransfers === 1 ? "" : "s"}`
              : ""
          }`,
        );
      } else if (constraints.maxTransfers !== null) {
        parts.push(
          `max ${constraints.maxTransfers} change${constraints.maxTransfers === 1 ? "" : "s"}`,
        );
      }
      if (prefs.arriveByTime)
        parts.push(`deadline ${prefs.arriveByTime} noted (arrive-by coming soon)`);
      setNlNote(parts.join(" · "));
    } catch {
      setNlNote("Could not parse that — please use the search boxes.");
    } finally {
      setNlBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative border border-rule bg-surface p-5 sm:p-8">
        <LangToggle className="absolute right-4 top-4" />
        <h1 className="type-display text-3xl sm:text-5xl">
          {t(lang, "heroTitle1")} {t(lang, "heroTitle2")}.
        </h1>
        <p className="mt-2 max-w-2xl text-ink-3">{t(lang, "heroSub")}</p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            go(from, to);
          }}
        >
          <div className="relative">
            <PlaceInput
              id="from"
              label="From"
              placeholder="Start point — e.g. Munirka"
              value={from}
              onSelect={selectFrom}
              position="top"
              onUseCurrentLocation={useCurrentLocation}
              locationBusy={locationBusy}
              locationMessage={locationMessage}
              locationError={locationError}
            />
            <PlaceInput
              id="to"
              label="To"
              placeholder="Destination — e.g. Connaught Place"
              value={to}
              onSelect={selectTo}
              position="bottom"
            />
            <button
              type="button"
              aria-label="Swap start and destination"
              onClick={() => {
                setFrom(to);
                setTo(from);
                clearLocationStatus();
              }}
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-rule bg-surface text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-3">
              <input
                type="checkbox"
                checked={lessWalking}
                onChange={(e) => setLessWalking(e.target.checked)}
                className="h-4 w-4 rounded-[2px] border-rule accent-ink focus:ring-ink"
              />
              {t(lang, "lessWalking")}
            </label>
            <span className="rounded-[2px] bg-paper px-3 py-1 text-xs text-ink-3">
              {t(lang, "leaveNow")}
            </span>
          </div>

          <button
            type="submit"
            disabled={!from || !to}
            className="type-display mt-3 w-full rounded-[2px] bg-ink px-6 py-4 text-base text-paper transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {t(lang, "findRoute")}
          </button>
        </form>

        <div className="mt-5">
          <p className="type-micro text-ink-3">
            Try a demo journey
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_PAIRS.map((pair) => (
              <button
                key={pair.label}
                type="button"
                onClick={() => applyPair(pair.fromId, pair.toId)}
                className="rounded-[2px] border border-rule bg-paper px-3 py-1.5 text-sm text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-saffron"
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>

        <details className="group mt-5 border border-rule bg-paper p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:hidden">
            <span className="mr-2 inline-block h-2 w-2 bg-saffron align-middle" aria-hidden />
            Or just describe your trip <span className="font-normal text-ink-3">(beta)</span>
          </summary>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void parseTrip();
            }}
          >
            <textarea
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              rows={2}
              placeholder='e.g. "Need to reach Nehru Place from Munirka before 10 am, cannot walk much"'
              className="w-full resize-none border border-rule bg-surface px-3 py-2 text-sm outline-none focus:outline-2 focus:outline-offset-[-2px] focus:outline-saffron"
              aria-label="Describe your trip in plain language"
            />
            <VoiceTripButton
              disabled={nlBusy}
              onTranscript={(text) => {
                setNlText(text);
                setNlNote(null);
              }}
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={nlBusy || nlText.trim().length < 4}
                className="rounded-[2px] bg-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-40"
              >
                {nlBusy ? "Parsing…" : "Fill the boxes for me"}
              </button>
              {nlNote && (
                <p className="text-xs text-ink-3" role="status">{nlNote}</p>
              )}
            </div>
            <p className="text-[11px] text-ink-3">
              AI only extracts your constraints. Routes, fares and times are
              always computed by the deterministic planner.
            </p>
          </form>
        </details>
      </section>

      <section aria-labelledby="trust-heading" className="border border-rule bg-surface">
        <h2 id="trust-heading" className="type-micro border-b border-rule px-4 py-2 text-ink-3">
          Every arrival tells you how much to trust it
        </h2>
        <dl className="divide-y divide-rule sm:flex sm:divide-x sm:divide-y-0">
          {([
            ["LIVE", "Fresh GPS data, updated seconds ago."],
            ["SCHEDULED", "Timetable only — no live vehicle data exists."],
            ["STALE", "Last live update is too old to trust fully."],
            ["DEMO", "Synthetic hackathon data used in this prototype."],
          ] as const).map(([state, desc]) => (
            <div key={state} className="flex items-center gap-3 px-4 py-3 sm:flex-1 sm:flex-col sm:items-start">
              <dt><ProvenanceBadge provenance={state} /></dt>
              <dd className="text-xs text-ink-3">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
