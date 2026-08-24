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
}

export interface PreferencesResult extends TripPreferences {
  source: "openai" | "heuristic";
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "originText",
    "destinationText",
    "walkingPreference",
    "arriveByTime",
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
  },
} as const;

const SYSTEM_PROMPT = `You extract public-transport preferences for an Indian city journey planner.
Extract ONLY what the user explicitly says. Delhi-area spellings vary (e.g. "CP", "Connaught Place").
Never invent places that were not mentioned. Reply via the structured format only.`;

async function extractWithOpenAI(text: string): Promise<TripPreferences | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
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
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      output?: Array<{
        content?: Array<{ type: string; text?: string }>;
      }>;
    };
    const msg = data.output?.find((o) => o.content?.some((c) => c.type === "output_text"));
    const raw = msg?.content?.find((c) => c.type === "output_text")?.text;
    if (!raw) return null;
    const p = JSON.parse(raw) as TripPreferences;
    return {
      originText: p.originText ?? null,
      destinationText: p.destinationText ?? null,
      walkingPreference: p.walkingPreference ?? null,
      arriveByTime: /^\d{1,2}:\d{2}$/.test(p.arriveByTime ?? "")
        ? p.arriveByTime
        : null,
    };
  } catch {
    return null;
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

  const walkingPreference =
    /less walk|minimal walk|avoid walk|no walk|cannot walk|can't walk|senior|pregnan/.test(
      t,
    )
      ? ("LOW" as const)
      : null;

  return { originText, destinationText, walkingPreference, arriveByTime };
}

export async function extractPreferences(
  text: string,
): Promise<PreferencesResult> {
  const viaAi = await extractWithOpenAI(text);
  if (viaAi) return { ...viaAi, source: "openai" };
  return { ...heuristic(text), source: "heuristic" };
}
