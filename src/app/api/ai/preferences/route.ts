import { NextResponse } from "next/server";
import { extractPreferences } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/preferences  { text: string }
 *
 * Parses natural-language travel constraints into structured preferences.
 * The LLM (or heuristic fallback) only extracts constraints - journey
 * planning itself is always performed by the deterministic router.
 */
export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const text = (body.text ?? "").slice(0, 500).trim();
  if (text.length < 4) {
    return NextResponse.json(
      { error: "EMPTY_TEXT", message: "Describe your trip in a sentence." },
      { status: 400 },
    );
  }

  const result = await extractPreferences(text);
  return NextResponse.json(
    {
      ...result,
      disclosure:
        "AI parses preferences only. Routes, fares and times come from the deterministic planner.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
