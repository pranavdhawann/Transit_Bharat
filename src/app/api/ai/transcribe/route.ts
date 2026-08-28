import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-transcribe";
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);

// A focused Delhi lexicon improves proper nouns without turning every station
// in the network into a suggestion the model may hallucinate.
const TRANSCRIPTION_KEYWORDS = [
  "BharaTransit",
  "Delhi Metro",
  "DTC",
  "Connaught Place",
  "Rajiv Chowk",
  "Munirka",
  "Kashmere Gate",
  "Hauz Khas",
  "Nehru Place",
  "Saket",
  "AIIMS",
  "IIT Delhi",
  "Lajpat Nagar",
  "Chandni Chowk",
  "New Delhi Railway Station",
  "India Gate",
  "Dwarka",
  "Noida",
  "मुनिरका",
  "मुनीरका",
  "कनॉट प्लेस",
  "कश्मीरी गेट",
  "हौज़ ख़ास",
  "नेहरू प्लेस",
  "साकेत",
  "व्हीलचेयर",
  "सीढ़ियां",
  "कम पैदल",
  "दिव्यांग",
];

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 6;
const rateBuckets = new Map<string, number[]>();

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

  const rateKey = request.headers.get("x-nf-client-connection-ip");
  if (rateKey && isRateLimited(rateKey)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many voice requests. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
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
  const mediaType = audio.type.split(";", 1)[0].toLowerCase();
  if (!SUPPORTED_AUDIO_TYPES.has(mediaType) || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      {
        error: "BAD_AUDIO",
        message:
          audio.size > MAX_AUDIO_BYTES
            ? "The recording is too large. Keep it under 4 MB."
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
    "A Delhi public-transport journey request spoken naturally in Hindi, English, or Hinglish. Transcribe the original language faithfully, including code-switching. Preserve place and station names, route numbers, times, wheelchair or step-free needs, walking difficulty, elderly travellers, strollers, and luggage.",
  );
  upstreamForm.append("languages[]", "hi");
  upstreamForm.append("languages[]", "en");
  for (const keyword of TRANSCRIPTION_KEYWORDS) {
    upstreamForm.append("keywords[]", keyword);
  }

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

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    rateBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  // Keep the serverless instance cache bounded.
  if (rateBuckets.size > 1_000) {
    for (const [bucketKey, timestamps] of rateBuckets) {
      if (timestamps.every((timestamp) => now - timestamp >= RATE_WINDOW_MS)) {
        rateBuckets.delete(bucketKey);
      }
      if (rateBuckets.size <= 800) break;
    }
  }
  return false;
}
