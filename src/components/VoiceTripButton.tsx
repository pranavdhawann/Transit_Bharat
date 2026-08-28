"use client";

import { useEffect, useRef, useState } from "react";

const MAX_RECORDING_MS = 30_000;

type VoiceState = "idle" | "requesting" | "recording" | "transcribing" | "error";

interface VoiceTripButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}

function recordingFormat(): string | undefined {
  const formats = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];
  return formats.find((format) => MediaRecorder.isTypeSupported(format));
}

function extensionFor(type: string): string {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

export default function VoiceTripButton({
  disabled = false,
  onTranscript,
}: VoiceTripButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function releaseMicrophone() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    };
  }, []);

  async function transcribe(blob: Blob) {
    setState("transcribing");
    setMessage("Turning your voice into text…");
    const form = new FormData();
    form.append(
      "audio",
      blob,
      `trip.${extensionFor(blob.type)}`,
    );
    try {
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { text?: string; message?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.message || "Could not transcribe that recording.");
      }
      onTranscript(data.text);
      setState("idle");
      setMessage("Transcript ready — check it, then fill the boxes.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not transcribe that recording.",
      );
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setState("error");
      setMessage("Voice input is not supported by this browser.");
      return;
    }

    setState("requesting");
    setMessage("Waiting for microphone permission…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = recordingFormat();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        releaseMicrophone();
        recorderRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setState("error");
          setMessage("The recording was empty. Please try again.");
          return;
        }
        void transcribe(blob);
      });
      recorder.addEventListener("error", () => {
        releaseMicrophone();
        setState("error");
        setMessage("The browser could not record your microphone.");
      });
      recorder.start();
      setState("recording");
      setMessage("Listening… describe your trip, then press Stop.");
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch {
      releaseMicrophone();
      setState("error");
      setMessage("Microphone access was denied or is unavailable.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  const busy = state === "requesting" || state === "transcribing";
  const recording = state === "recording";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={recording ? stopRecording : () => void startRecording()}
        disabled={disabled || busy}
        aria-pressed={recording}
        className="inline-flex items-center gap-2 rounded-[2px] border border-rule bg-surface px-3 py-2 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
        </svg>
        {recording
          ? "Stop recording"
          : state === "requesting"
            ? "Opening microphone…"
            : state === "transcribing"
              ? "Transcribing…"
              : "Speak your trip"}
      </button>
      {message && (
        <p className="text-xs text-ink-3" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
