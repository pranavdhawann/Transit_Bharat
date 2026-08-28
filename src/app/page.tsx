"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import LangToggle from "@/components/LangToggle";
import PlaceInput from "@/components/PlaceInput";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import VoiceTripButton from "@/components/VoiceTripButton";
import {
  ACCESSIBILITY_NEEDS,
  constraintsFor,
  heuristic,
  type AccessibilityNeed,
  type PreferencesResult,
} from "@/lib/ai";
import {
  currentLocationPlace,
  saveCurrentLocation,
  saveSelectedPlace,
} from "@/lib/current-location";
import { t, useLang } from "@/lib/i18n";
import { isWithinDelhiServiceArea } from "@/lib/service-area";
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
  STEP_FREE: "step-free travel",
  LIMITED_MOBILITY: "limited mobility",
  PREGNANT: "pregnancy",
};

const ACCESS_OPTIONS: Record<AccessibilityNeed, string> = {
  WHEELCHAIR: "Wheelchair user",
  STEP_FREE: "Step-free / no stairs",
  LIMITED_MOBILITY: "Difficulty walking",
  HEAVY_LUGGAGE: "Heavy luggage",
  WITH_CHILD: "Travelling with a stroller or child",
  SENIOR: "Travelling with an elderly person",
  PREGNANT: "Pregnancy",
};

export default function HomePage() {
  const router = useRouter();
  const [lang] = useLang();
  const [from, setFrom] = useState<PlaceResult | null>(null);
  const [to, setTo] = useState<PlaceResult | null>(null);
  const [lessWalking, setLessWalking] = useState(false);
  const [maxTransfers, setMaxTransfers] = useState<number | null>(null);
  const [accessibilityNeed, setAccessibilityNeed] =
    useState<AccessibilityNeed | null>(null);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlNote, setNlNote] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const parseSeqRef = useRef(0);
  const voiceStartRef = useRef<{ context: string; parseSeq: number } | null>(
    null,
  );
  const voiceContext = JSON.stringify([
    from?.id ?? null,
    to?.id ?? null,
    lessWalking,
    maxTransfers,
    accessibilityNeed,
    nlText,
  ]);

  function go(f: PlaceResult | null, t: PlaceResult | null) {
    if (!f || !t) return;
    if (f.id === t.id) {
      setTripError("Start and destination must be different places.");
      return;
    }
    setTripError(null);
    const params = new URLSearchParams({ from: f.id, to: t.id });
    if (lessWalking) params.set("lessWalk", "1");
    if (maxTransfers !== null) params.set("maxTransfers", String(maxTransfers));
    if (accessibilityNeed) params.set("access", accessibilityNeed);
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
    setTripError(null);
    if (place?.type !== "current") clearLocationStatus();
  }

  function selectTo(place: PlaceResult | null) {
    if (place?.type === "address" && !saveSelectedPlace(place)) {
      setTripError(
        "This address could not be saved for route planning. Allow site storage and try again.",
      );
      return;
    }
    setTo(place);
    setTripError(null);
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
        if (!isWithinDelhiServiceArea(place)) {
          setLocationBusy(false);
          setLocationError(true);
          setLocationMessage(
            "Your current location is outside the Delhi NCR pilot area.",
          );
          return;
        }
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

  async function parseTrip(text = nlText, useLocalParser = false) {
    if (text.trim().length < 4) {
      setNlNote("Describe a journey or travel need first.");
      return;
    }
    const seq = ++parseSeqRef.current;
    setNlBusy(true);
    setNlNote(null);
    try {
      let prefs: PrefsResponse;
      if (useLocalParser) {
        prefs = {
          ...heuristic(text),
          source: "heuristic",
          fallbackReason: null,
          fallbackDetail: null,
          model: null,
          latencyMs: null,
        };
      } else {
        const res = await fetch("/api/ai/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        prefs = (await res.json()) as PrefsResponse;
        if (
          !res.ok ||
          (prefs.source !== "openai" && prefs.source !== "heuristic")
        ) {
          throw new Error("invalid preferences response");
        }
      }

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
      if (seq !== parseSeqRef.current) return;
      if (f) {
        setFrom(f);
        clearLocationStatus();
      }
      if (t) setTo(t);

      // A stated access need becomes real routing constraints, not a label.
      const constraints = constraintsFor(prefs);
      if (prefs.accessibilityNeed) {
        setAccessibilityNeed(prefs.accessibilityNeed);
        setLessWalking(constraints.lessWalking);
        setMaxTransfers(constraints.maxTransfers);
      } else {
        if (prefs.walkingPreference !== null) {
          setLessWalking(prefs.walkingPreference === "LOW");
        }
        if (prefs.maxTransfers !== null) {
          setMaxTransfers(prefs.maxTransfers);
        }
      }

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
        parts.push(`arrival time ${prefs.arriveByTime} recognised · routes still leave now`);
      setNlNote(parts.join(" · "));
    } catch {
      if (seq === parseSeqRef.current) {
        setNlNote("Could not understand that. Edit the text or use the search boxes.");
      }
    } finally {
      if (seq === parseSeqRef.current) setNlBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative border border-rule bg-surface p-5 sm:p-8">
        <div className="mb-5 flex justify-end">
          <LangToggle />
        </div>
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

          <div className="border border-rule bg-paper p-3">
            <label htmlFor="trip-description" className="type-micro text-ink-3">
              Describe your trip or needs
            </label>
            <div className="relative mt-2">
              <textarea
                id="trip-description"
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                onKeyDown={(e) => {
                   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                     e.preventDefault();
                     if (nlBusy) return;
                     void parseTrip();
                  }
                }}
                rows={2}
                placeholder="English, Hindi or Hinglish"
                className="w-full resize-none border border-rule bg-surface px-3 py-2 pr-14 text-sm outline-none focus:outline-2 focus:outline-offset-[-2px] focus:outline-saffron"
              />
               <VoiceTripButton
                 disabled={nlBusy}
                 onRecordingStart={() => {
                   voiceStartRef.current = {
                     context: voiceContext,
                     parseSeq: parseSeqRef.current,
                   };
                 }}
                 onTranscript={(text) => {
                   if (
                     voiceStartRef.current?.parseSeq !== parseSeqRef.current ||
                     voiceStartRef.current.context !== voiceContext
                   ) {
                     setNlNote(
                       "Voice transcript was not applied because the trip changed while it was processing.",
                     );
                     return;
                   }
                   voiceStartRef.current = null;
                   setNlText(text);
                  setNlNote(null);
                  // Transcription already used the speech model. Constraint
                  // extraction is deterministic locally, avoiding a second
                  // paid model request for the same utterance.
                  return parseTrip(text, true);
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void parseTrip()}
                disabled={nlBusy || nlText.trim().length < 4}
                className="rounded-[2px] border border-rule bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nlBusy ? "Understanding…" : "Apply"}
              </button>
              <span className="text-[11px] text-ink-3">Ctrl + Enter</span>
            </div>
            {nlNote && (
              <p className="mt-2 text-xs text-ink-3" role="status">
                {nlNote}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-3">
              <input
                type="checkbox"
                checked={lessWalking}
                onChange={(e) => setLessWalking(e.target.checked)}
                className="h-4 w-4 rounded-[2px] border-rule accent-ink focus:ring-ink"
              />
              {t(lang, "lessWalking")}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-3">
              <span>Journey needs</span>
              <select
                value={accessibilityNeed ?? ""}
                onChange={(e) => {
                  const value = e.target.value as AccessibilityNeed | "";
                  setAccessibilityNeed(value || null);
                  if (value) {
                    setLessWalking(true);
                    setMaxTransfers((current) => current ?? 1);
                  } else {
                    setMaxTransfers(null);
                  }
                }}
                className="max-w-full rounded-[2px] border border-rule bg-surface px-2 py-1 text-sm text-ink"
              >
                <option value="">No specific access need</option>
                {ACCESSIBILITY_NEEDS.map((need) => (
                  <option key={need} value={need}>
                    {ACCESS_OPTIONS[need]}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto rounded-[2px] bg-paper px-3 py-1 text-xs text-ink-3">
              {t(lang, "leaveNow")}
            </span>
          </div>

          {tripError && (
            <p role="alert" className="text-sm text-stale">
              {tripError}
            </p>
          )}

          <button
            type="submit"
            disabled={!from || !to}
            className="type-display mt-3 w-full rounded-[2px] bg-ink px-6 py-4 text-base text-paper transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {t(lang, "findRoute")}
          </button>
        </form>

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
