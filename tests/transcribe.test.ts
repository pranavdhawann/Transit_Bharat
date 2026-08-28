import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/ai/transcribe/route";

const savedKey = process.env.OPENAI_API_KEY;
const savedModel = process.env.OPENAI_TRANSCRIPTION_MODEL;
const savedFetch = globalThis.fetch;

function requestWith(file: File): Request {
  const form = new FormData();
  form.append("audio", file);
  return new Request("http://localhost/api/ai/transcribe", {
    method: "POST",
    body: form,
  });
}

afterEach(() => {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
  if (savedModel === undefined) delete process.env.OPENAI_TRANSCRIPTION_MODEL;
  else process.env.OPENAI_TRANSCRIPTION_MODEL = savedModel;
  vi.restoreAllMocks();
});

describe("voice trip transcription route", () => {
  it("keeps voice unavailable when no server key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await POST(
      requestWith(new File(["audio"], "trip.webm", { type: "audio/webm" })),
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends audio to OpenAI server-side and returns only the transcript", async () => {
    process.env.OPENAI_API_KEY = "test-key-not-a-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "Munirka to Connaught Place" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;

    const response = await POST(
      requestWith(new File(["audio"], "trip.webm", { type: "audio/webm" })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      text: "Munirka to Connaught Place",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer test-key-not-a-secret" });
    const upstream = init.body as FormData;
    expect(upstream.get("model")).toBe("gpt-transcribe");
    expect(upstream.getAll("languages[]")).toEqual(["hi", "en"]);
    expect(upstream.getAll("keywords[]")).toContain("Connaught Place");
    expect(String(upstream.get("prompt"))).toContain("Hinglish");
    expect(upstream.get("file")).toBeInstanceOf(File);
  });

  it("rejects non-audio uploads before calling OpenAI", async () => {
    process.env.OPENAI_API_KEY = "test-key-not-a-secret";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await POST(
      requestWith(new File(["not audio"], "notes.txt", { type: "text/plain" })),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
