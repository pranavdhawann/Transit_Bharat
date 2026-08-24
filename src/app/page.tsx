"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PlaceInput from "@/components/PlaceInput";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import { t, useLang } from "@/lib/i18n";
import { SUGGESTED_PAIRS } from "@/lib/places";
import type { PlaceResult } from "@/lib/types";

interface PrefsResponse {
  originText: string | null;
  destinationText: string | null;
  walkingPreference: "LOW" | "MEDIUM" | "HIGH" | null;
  arriveByTime: string | null;
  source: "openai" | "heuristic";
  error?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [from, setFrom] = useState<PlaceResult | null>(null);
  const [to, setTo] = useState<PlaceResult | null>(null);
  const [lessWalking, setLessWalking] = useState(false);
  const [nlText, setNlText] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlNote, setNlNote] = useState<string | null>(null);

  function go(f: PlaceResult | null, t: PlaceResult | null) {
    if (!f || !t) return;
    const params = new URLSearchParams({ from: f.id, to: t.id });
    if (lessWalking) params.set("lessWalk", "1");
    router.push(`/plan?${params.toString()}`);
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
      if (f) setFrom(f);
      if (t) setTo(t);
      if (prefs.walkingPreference === "LOW") setLessWalking(true);

      const parts: string[] = [];
      if (!f && !t) parts.push("couldn't find those places — try the search boxes");
      else {
        if (prefs.source === "openai") parts.push("parsed with OpenAI");
        else parts.push("parsed locally (heuristic mode)");
        if (!f || !t) parts.push("fill in the missing box");
        if (prefs.arriveByTime)
          parts.push(`deadline ${prefs.arriveByTime} noted (arrive-by coming soon)`);
      }
      setNlNote(parts.join(" · "));
    } catch {
      setNlNote("Could not parse that — please use the search boxes.");
    } finally {
      setNlBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="absolute right-4 top-4 flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Language">
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`px-2.5 py-1 text-xs font-semibold ${
                lang === l ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {l === "en" ? "EN" : "हिं"}
            </button>
          ))}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
          {t(lang, "heroTitle1")}{" "}
          <span className="text-orange-600">{t(lang, "heroTitle2")}</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t(lang, "heroSub")}</p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            go(from, to);
          }}
        >
          <div className="relative space-y-2">
            <PlaceInput
              id="from"
              label="From"
              placeholder="Start point — e.g. Munirka"
              value={from}
              onSelect={setFrom}
              iconColor="bg-emerald-500"
            />
            <button
              type="button"
              aria-label="Swap start and destination"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 sm:flex"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            <PlaceInput
              id="to"
              label="To"
              placeholder="Destination — e.g. Connaught Place"
              value={to}
              onSelect={setTo}
              iconColor="bg-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={lessWalking}
                onChange={(e) => setLessWalking(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {t(lang, "lessWalking")}
            </label>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {t(lang, "leaveNow")}
            </span>
          </div>

          <button
            type="submit"
            disabled={!from || !to}
            className="mt-2 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {t(lang, "findRoute")}
          </button>
        </form>

        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Try a demo journey
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_PAIRS.map((pair) => (
              <button
                key={pair.label}
                type="button"
                onClick={() => applyPair(pair.fromId, pair.toId)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>

        <details className="group mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 open:bg-white">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:hidden">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" aria-hidden />
            Or just describe your trip <span className="font-normal text-slate-400">(beta)</span>
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
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              aria-label="Describe your trip in plain language"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={nlBusy || nlText.trim().length < 4}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                {nlBusy ? "Parsing…" : "Fill the boxes for me"}
              </button>
              {nlNote && (
                <p className="text-xs text-slate-500" role="status">{nlNote}</p>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              AI only extracts your constraints. Routes, fares and times are
              always computed by the deterministic planner.
            </p>
          </form>
        </details>
      </section>

      <section aria-labelledby="trust-heading" className="space-y-3">
        <h2 id="trust-heading" className="text-lg font-semibold tracking-tight">
          Every arrival tells you how much to trust it
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["LIVE", "Fresh GPS data, updated seconds ago."],
              ["SCHEDULED", "Timetable only — no live vehicle data exists."],
              ["STALE", "Last live update is too old to trust fully."],
              ["DEMO", "Synthetic hackathon data used in this prototype."],
            ] as const
          ).map(([state, desc]) => (
            <div
              key={state}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <ProvenanceBadge provenance={state} />
              <p className="mt-2 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
