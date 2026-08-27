/**
 * Natural-language trip preference extraction.
 *
 * Product rule (enforced by design): the LLM only PARSES user constraints -
 * it never invents stops, fares, ETAs or route geometry. The deterministic
 * router stays the single source of truth for journeys.
 *
 * Two backends:
 *  - OpenAI Responses API with strict JSON-schema output (used when
 *    OPENAI_API_KEY is set on the server).
 *  - A transparent keyword heuristic otherwise, always labeled `heuristic`.
 *
 * Every fallback carries a MACHINE-READABLE REASON. A silent fallback is worse
 * than no AI at all: a wrong model id, an expired key and an unset key would
 * otherwise look identical from the outside, and the app would appear to work
 * while the OpenAI path never fired once.
 */
import type { PlaceResult } from "./types";

export interface TripPreferences {
  /** Free-text origin as spoken by the user, if any. */
  originText: string | null;
  /** Free-text destination as spoken by the user, if any. */
  destinationText: string | null;
  /** LOW = avoid walking, HIGH = happy to walk. */
  walkingPreference: "LOW" | "MEDIUM" | "HIGH" | null;
  /** HH:MM IST if the user named a deadline. */
  arriveByTime: string | null;
  /**
   * Maximum interchanges the rider is willing to make. Honoured by the router
   * (see planJourneys), not decoration.
   */
  maxTransfers: number | null;
  /**
   * A stated access need. Mapped to concrete routing constraints - it never
   * changes what the router reports, only what it is asked for.
   */
  accessibilityNeed:
    | "WHEELCHAIR"
    | "HEAVY_LUGGAGE"
    | "WITH_CHILD"
    | "SENIOR"
    | null;
}

/** Why we did not use the model. Surfaced to the client on purpose. */
export type FallbackReason =
  | "no_api_key"
  | "timeout"
  | "http_error"
  | "empty_response"
  | "invalid_json"
  | "network_error";

export interface PreferencesResult extends TripPreferences {
  source: "openai" | "heuristic";
  /** null when source === "openai". */
  fallbackReason: FallbackReason | null;
  /** Human-readable detail for the failure, e.g. "HTTP 401". Never a secret. */
  fallbackDetail: string | null;
  /** Which model answered, so a demo can prove the call really happened. */
  model: string | null;
  /** Round-trip milliseconds for the model call, when one was made. */
  latencyMs: number | null;
}

/**
 * Generous on purpose: a reasoning model behind a cold serverless function can
 * take a while, and timing out into the heuristic mid-demo is the exact
 * failure this module exists to make visible.
 */
const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_MODEL = "gpt-5-mini";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "originText",
    "destinationText",
    "walkingPreference",
    "arriveByTime",
    "maxTransfers",
    "accessibilityNeed",
  ],
  properties: {
    originText: { type: ["string", "null"], description: "Origin area/stop mentioned by the user, or null." },
    destinationText: { type: ["string", "null"], description: "Destination area/stop mentioned by the user, or null." },
    walkingPreference: {
      type: ["string", "null"],
      enum: ["LOW", "MEDIUM", "HIGH", null],
      description: "LOW means the user wants minimal walking.",
    },
    arriveByTime: {
      type: ["string", "null"],
      description: "Arrival deadline as HH:MM 24h if mentioned, else null.",
    },
    maxTransfers: {
      type: ["integer", "null"],
      description:
        "Maximum interchanges the user will accept, if they said so (e.g. 'direct bus only' is 0). Else null.",
    },
    accessibilityNeed: {
      type: ["string", "null"],
      enum: ["WHEELCHAIR", "HEAVY_LUGGAGE", "WITH_CHILD", "SENIOR", null],
      description:
        "A stated access need: a wheelchair user, heavy bags, travelling with a small child, or an elderly traveller. Null unless the user says so.",
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract public-transport preferences for an Indian city journey planner.
Extract ONLY what the user explicitly says. Delhi-area spellings vary (e.g. "CP", "Connaught Place").
Users may write in English, Hindi, or a mix of both (Hinglish); handle all three.
An access need is only set when the user states it ("wheelchair", "with a toddler", "carrying heavy bags", "elderly parent").
Never invent places that were not mentioned. Reply via the structured format only.`;

type ExtractOutcome =
  | { ok: true; prefs: TripPreferences; model: string; latencyMs: number }
  | { ok: false; reason: FallbackReason; detail: string | null };

async function extractWithOpenAI(text: string): Promise<ExtractOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key", detail: null };
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const startedAt = Date.now();

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
          { role: "user", content: [{ type: "input_text", text }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "trip_preferences",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      reason: isAbort ? "timeout" : "network_error",
      detail: isAbort ? `no response in ${REQUEST_TIMEOUT_MS} ms` : "request failed",
    };
  }

  if (!res.ok) {
    // Take the machine-readable error code, never the message: a message can
    // echo request content back at us. The code is what tells the operator
    // whether to add billing (insufficient_quota) or simply retry
    // (rate_limit_exceeded) - two very different fixes behind one 429.
    let code: string | null = null;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; type?: string };
      };
      code = body.error?.code ?? body.error?.type ?? null;
    } catch {
      code = null;
    }
    return {
      ok: false,
      reason: "http_error",
      detail: code ? `HTTP ${res.status} (${code})` : `HTTP ${res.status}`,
    };
  }

  let raw: string | undefined;
  try {
    const data = (await res.json()) as {
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const msg = data.output?.find((o) =>
      o.content?.some((c) => c.type === "output_text"),
    );
    raw = msg?.content?.find((c) => c.type === "output_text")?.text;
  } catch {
    return { ok: false, reason: "invalid_json", detail: "response was not JSON" };
  }
  if (!raw) {
    return { ok: false, reason: "empty_response", detail: "no output_text" };
  }

  try {
    const p = JSON.parse(raw) as Partial<TripPreferences>;
    return {
      ok: true,
      model,
      latencyMs: Date.now() - startedAt,
      prefs: {
        originText: p.originText ?? null,
        destinationText: p.destinationText ?? null,
        walkingPreference: p.walkingPreference ?? null,
        arriveByTime: /^\d{1,2}:\d{2}$/.test(p.arriveByTime ?? "")
          ? (p.arriveByTime as string)
          : null,
        maxTransfers:
          typeof p.maxTransfers === "number" &&
          Number.isFinite(p.maxTransfers) &&
          p.maxTransfers >= 0
            ? Math.min(4, Math.round(p.maxTransfers))
            : null,
        accessibilityNeed: p.accessibilityNeed ?? null,
      },
    };
  } catch {
    return { ok: false, reason: "invalid_json", detail: "model output was not JSON" };
  }
}

/** Transparent keyword fallback - deterministic and inspectable. */
export function heuristic(text: string): TripPreferences {
  const t = text.toLowerCase();

  // Cut time/deadline clauses out of the primary place-extraction text.
  const placesPart = t.split(/\b(?:before|by|till|until|around)\b/)[0];
  const leadVerb = /^(?:reach|towards|going to|head(?:ing)? to)\s+/;

  let originText: string | null = null;
  let destinationText: string | null = null;

  const fromTo = placesPart.match(/\bfrom\s+(.+?)\s+\bto\b\s+(.+)$/);
  const toFrom = placesPart.match(/\bto\s+(.+?)\s+\bfrom\b\s+(.+)$/);
  if (fromTo) {
    originText = fromTo[1].trim();
    destinationText = fromTo[2].trim();
  } else if (toFrom) {
    destinationText = toFrom[1].replace(leadVerb, "").trim();
    originText = toFrom[2].trim();
  } else {
    const dest =
      placesPart.match(/\b(?:to|towards)\s+(.+)$/)?.[1] ??
      placesPart.match(/\breach\s+(.+)$/)?.[1] ??
      null;
    if (dest) {
      const parts = dest.split(/\bfrom\b/);
      destinationText = parts[0].replace(leadVerb, "").trim() || null;
      if (parts.length > 1) originText = parts[1].trim() || null;
    }
  }

  // Origin may live after a time clause ("by 10 am from munirka").
  if (!originText) {
    originText = t.match(/\bfrom\s+([^,.!?]+)$/)?.[1]?.trim() ?? null;
  }

  const timeMatch = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/);
  let arriveByTime: string | null = null;
  if (timeMatch && /(before|by|till|until)/.test(t)) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const pm = /p\.?m\.?/.test(timeMatch[3] ?? "");
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      arriveByTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  const accessibilityNeed = detectAccessNeed(t);

  const walkingPreference =
    /less walk|minimal walk|avoid walk|no walk|cannot walk|can't walk|senior|pregnan/.test(
      t,
    ) || accessibilityNeed !== null
      ? ("LOW" as const)
      : null;

  // "direct", "no changes", "without changing" all mean zero interchanges.
  const maxTransfers = /\bdirect\b|no change|without chang|one bus|single bus|seedha/.test(t)
    ? 0
    : /one change|single change|at most one/.test(t)
      ? 1
      : null;

  return {
    originText,
    destinationText,
    walkingPreference,
    arriveByTime,
    maxTransfers,
    accessibilityNeed,
  };
}

/** Keyword detection for stated access needs, English and common Hindi. */
function detectAccessNeed(t: string): TripPreferences["accessibilityNeed"] {
  if (/wheelchair|wheel chair|व्हीलचेयर|divyang|disabled/.test(t)) return "WHEELCHAIR";
  if (/luggage|suitcase|heavy bag|saman|सामान|trolley/.test(t)) return "HEAVY_LUGGAGE";
  if (/toddler|infant|baby|small child|pram|stroller|बच्च/.test(t)) return "WITH_CHILD";
  if (/senior|elderly|old (?:mother|father|parent)|बुज़ुर्ग|budhe/.test(t)) return "SENIOR";
  return null;
}

/**
 * Concrete routing constraints implied by a stated access need. Kept beside
 * the parser so the mapping is auditable rather than buried in a component.
 */
export function constraintsFor(prefs: TripPreferences): {
  lessWalking: boolean;
  maxTransfers: number | null;
} {
  const lessWalking =
    prefs.walkingPreference === "LOW" || prefs.accessibilityNeed !== null;
  // A wheelchair user, someone with heavy bags or a small child pays a far
  // higher price per interchange than an average rider.
  const needCap =
    prefs.accessibilityNeed === "WHEELCHAIR" ||
    prefs.accessibilityNeed === "HEAVY_LUGGAGE" ||
    prefs.accessibilityNeed === "WITH_CHILD"
      ? 1
      : null;
  const maxTransfers =
    prefs.maxTransfers !== null && needCap !== null
      ? Math.min(prefs.maxTransfers, needCap)
      : (prefs.maxTransfers ?? needCap);
  return { lessWalking, maxTransfers };
}

export async function extractPreferences(
  text: string,
): Promise<PreferencesResult> {
  const outcome = await extractWithOpenAI(text);
  if (outcome.ok) {
    return {
      ...outcome.prefs,
      source: "openai",
      fallbackReason: null,
      fallbackDetail: null,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
    };
  }
  return {
    ...heuristic(text),
    source: "heuristic",
    fallbackReason: outcome.reason,
    fallbackDetail: outcome.detail,
    model: null,
    latencyMs: null,
  };
}

export type { PlaceResult };
