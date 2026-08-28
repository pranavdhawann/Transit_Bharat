import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-transcribe";

type TranscriptionResponse = { text?: unknown };

/**
 * POST /api/ai/transcribe  multipart/form-data { audio: File }
 *
 * Audio stays behind this server boundary so OPENAI_API_KEY is never exposed
 * to the browser. The returned transcript feeds the existing preference
 * parser; it does not plan or modify a journey itself.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "VOICE_UNAVAILABLE", message: "Voice input is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "BAD_AUDIO", message: "Send a recorded audio clip." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "BAD_AUDIO", message: "The recording was empty." },
      { status: 400 },
    );
  }
  if (!audio.type.startsWith("audio/") || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: "BAD_AUDIO",
        message:
          audio.size > MAX_AUDIO_BYTES
            ? "The recording is too large. Keep it under 10 MB."
            : "That recording format is not supported.",
      },
      { status: 400 },
    );
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, audio.name || "trip.webm");
  upstreamForm.append(
    "model",
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_MODEL,
  );
  upstreamForm.append(
    "prompt",
    "A public transport trip description in India. Preserve place names, times, accessibility needs, Hindi, and Hinglish.",
  );

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json(
      { error: "TRANSCRIPTION_FAILED", message: "Voice transcription is temporarily unavailable." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "TRANSCRIPTION_FAILED", message: "Voice transcription is temporarily unavailable." },
      { status: 502 },
    );
  }

  let data: TranscriptionResponse;
  try {
    data = (await response.json()) as TranscriptionResponse;
  } catch {
    data = {};
  }
  const text = typeof data.text === "string" ? data.text.trim().slice(0, 500) : "";
  if (!text) {
    return NextResponse.json(
      { error: "NO_SPEECH", message: "No speech was detected. Please try again." },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { text },
    { headers: { "Cache-Control": "no-store" } },
  );
}
