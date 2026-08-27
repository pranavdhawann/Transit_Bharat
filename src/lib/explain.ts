/**
 * Plain-language disruption explanation, English and Hindi.
 *
 * The hard rule from src/lib/ai.ts holds here too, and matters more: the model
 * receives ALREADY-COMPUTED facts and may only phrase them. It is never given
 * the network, never asked what to do, and never allowed to produce a number
 * the router did not calculate. Every figure in the output is checked back
 * against the input before we show it.
 *
 * A hallucinated departure time is somebody missing their last bus, so the
 * deterministic template below is the floor, not a degraded mode: if the model
 * is unavailable, slow, or says anything we cannot verify, the rider gets the
 * template and the response says so.
 */
import type { Journey } from "./types";

export interface DisruptionFacts {
  routeNumber: string;
  delayMinutes: number;
  /** Minutes saved by switching to the alternative. Always >= 0. */
  minutesSaved: number;
  /** Fare difference in INR; positive means the alternative costs more. */
  fareDeltaInr: number;
  /** Human-readable description of the alternative, e.g. "Metro via Hauz Khas". */
  alternativeVia: string;
  /** Mode and interchange kept separately so Hindi copy is not a bolted-on
   *  English fragment. */
  alternativeMode: "METRO" | "BUS" | "AUTO";
  alternativeInterchange: string | null;
  alternativeDurationMinutes: number;
}

export interface DisruptionNote {
  en: string;
  hi: string;
  source: "openai" | "template";
  fallbackReason: string | null;
  model: string | null;
  latencyMs: number | null;
}

const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_MODEL = "gpt-5-mini";

/** Facts a rider needs, derived entirely from the router's own output. */
export function factsFrom(
  disrupted: Journey,
  alternative: Journey,
  routeNumber: string,
  delayMinutes: number,
): DisruptionFacts {
  const minutesSaved = Math.max(
    0,
    Math.round(disrupted.durationMinutes - alternative.durationMinutes),
  );
  const via = describeVia(alternative);
  return {
    routeNumber,
    delayMinutes,
    minutesSaved,
    fareDeltaInr: alternative.fareInr - disrupted.fareInr,
    alternativeVia: via.text,
    alternativeMode: via.mode,
    alternativeInterchange: via.interchange,
    alternativeDurationMinutes: Math.round(alternative.durationMinutes),
  };
}

function describeVia(j: Journey): {
  text: string;
  mode: DisruptionFacts["alternativeMode"];
  interchange: string | null;
} {
  const transit = j.legs.filter((l) => l.mode === "BUS" || l.mode === "SUBWAY");
  if (transit.length === 0) {
    return { text: "an auto-rickshaw", mode: "AUTO", interchange: null };
  }
  const names = transit.map((l) => l.routeName ?? l.routeNumber ?? l.mode);
  const interchange = transit.length > 1 ? transit[0].to.name : null;
  const mode = transit.some((l) => l.mode === "SUBWAY") ? "METRO" : "BUS";
  const label = mode === "METRO" ? "Metro" : "Bus";
  return {
    text: interchange
      ? `${label} ${names.join(" then ")} via ${interchange}`
      : `${label} ${names[0]}`,
    mode,
    interchange,
  };
}

/** Hindi noun phrase for the alternative, built from parts rather than
 *  splicing an English sentence into Devanagari. */
function viaHindi(f: DisruptionFacts): string {
  const mode =
    f.alternativeMode === "METRO"
      ? "मेट्रो"
      : f.alternativeMode === "BUS"
        ? "बस"
        : "ऑटो";
  return f.alternativeInterchange
    ? `${f.alternativeInterchange} होते हुए ${mode}`
    : mode;
}

/** Deterministic bilingual copy. Always correct, never surprising. */
export function templateNote(f: DisruptionFacts): { en: string; hi: string } {
  const en =
    f.minutesSaved > 0
      ? `Bus ${f.routeNumber} is running about ${f.delayMinutes} minutes late. ${f.alternativeVia} now gets you there roughly ${f.minutesSaved} minutes sooner.`
      : `Bus ${f.routeNumber} is running about ${f.delayMinutes} minutes late. ${f.alternativeVia} is the steadier option right now.`;
  const via = viaHindi(f);
  const hi =
    f.minutesSaved > 0
      ? `बस ${f.routeNumber} लगभग ${f.delayMinutes} मिनट देरी से चल रही है। ${via} से आप करीब ${f.minutesSaved} मिनट पहले पहुँच सकते हैं।`
      : `बस ${f.routeNumber} लगभग ${f.delayMinutes} मिनट देरी से चल रही है। अभी ${via} बेहतर विकल्प है।`;
  return { en, hi };
}

const SYSTEM_PROMPT = `You write one short sentence for a Delhi public-transport app when a bus is delayed.
You are given already-computed facts. Use ONLY those numbers. Never invent times, fares, stops or routes.

Style:
- Speak to the commuter, the way a helpful person at the bus stop would.
- Calm and concrete. No marketing tone, no emoji, no exclamation marks.
- Two short clauses at most. Under 28 words. Lead with what changed, then what to do.
- Never write an internal code word such as METRO, BUS or AUTO in capitals. Say
  "the metro", "a bus", "an auto".
- Mention the extra fare only if it is more than zero, and keep it brief.

Hindi:
- Natural everyday Hindi in Devanagari, not a word-for-word translation.
- Only station names, line names and route numbers stay in their original form.
  Everything else must be Hindi.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["en", "hi"],
  properties: {
    en: { type: "string", description: "The sentence in English." },
    hi: { type: "string", description: "The same sentence in natural Hindi, Devanagari script." },
  },
} as const;

/**
 * A readable brief rather than raw JSON. Handing the model our internal enum
 * (alternativeMode: "METRO") got it echoed back verbatim in both languages.
 */
function factSheet(f: DisruptionFacts): string {
  const lines = [
    `Delayed service: bus ${f.routeNumber}, running ${f.delayMinutes} minutes late.`,
    `Better option: ${f.alternativeVia}.`,
    `That option takes ${f.alternativeDurationMinutes} minutes.`,
  ];
  if (f.minutesSaved > 0) {
    lines.push(`It arrives about ${f.minutesSaved} minutes sooner.`);
  }
  if (f.fareDeltaInr > 0) {
    lines.push(`It costs ${f.fareDeltaInr} rupees more.`);
  } else if (f.fareDeltaInr < 0) {
    lines.push(`It costs ${Math.abs(f.fareDeltaInr)} rupees less.`);
  }
  return lines.join("\n");
}

/** Internal enum values must never surface in rider-facing copy. */
function leaksEnum(text: string): boolean {
  return /\b(METRO|BUS|AUTO|SUBWAY|WALK)\b/.test(text);
}

/**
 * Guard against the model inventing a number. Any digit in the output must be
 * one we supplied; anything else and we fall back to the template.
 */
export function numbersAreGrounded(text: string, f: DisruptionFacts): boolean {
  const allowed = new Set(
    [
      f.delayMinutes,
      f.minutesSaved,
      f.alternativeDurationMinutes,
      Math.abs(f.fareDeltaInr),
    ].map(String),
  );
  // Route numbers such as "620U" carry digits that are legitimately present.
  const withoutRoute = text.split(f.routeNumber).join(" ");
  const digits = withoutRoute.match(/\d+/g) ?? [];
  return digits.every((d) => allowed.has(d));
}

export async function explainDisruption(
  f: DisruptionFacts,
): Promise<DisruptionNote> {
  const template = templateNote(f);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ...template, source: "template", fallbackReason: "no_api_key", model: null, latencyMs: null };
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const startedAt = Date.now();
  const fail = (reason: string): DisruptionNote => ({
    ...template,
    source: "template",
    fallbackReason: reason,
    model: null,
    latencyMs: null,
  });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "minimal" },
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: factSheet(f) }] },
        ],
        text: {
          format: { type: "json_schema", name: "disruption_note", strict: true, schema: SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return fail(isAbort ? "timeout" : "network_error");
  }

  if (!res.ok) return fail(`HTTP ${res.status}`);

  let parsed: { en?: string; hi?: string };
  try {
    const data = (await res.json()) as {
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const raw = data.output
      ?.find((o) => o.content?.some((c) => c.type === "output_text"))
      ?.content?.find((c) => c.type === "output_text")?.text;
    if (!raw) return fail("empty_response");
    parsed = JSON.parse(raw) as { en?: string; hi?: string };
  } catch {
    return fail("invalid_json");
  }

  const en = (parsed.en ?? "").trim();
  const hi = (parsed.hi ?? "").trim();
  if (!en || !hi) return fail("incomplete_output");
  if (en.length > 240 || hi.length > 240) return fail("output_too_long");
  if (!numbersAreGrounded(en, f) || !numbersAreGrounded(hi, f)) {
    // The model produced a figure we did not give it. Never show that.
    return fail("ungrounded_number");
  }
  if (leaksEnum(en) || leaksEnum(hi)) return fail("leaked_enum");

  return {
    en,
    hi,
    source: "openai",
    fallbackReason: null,
    model,
    latencyMs: Date.now() - startedAt,
  };
}
