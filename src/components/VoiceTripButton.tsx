"use client";

import { useEffect, useRef, useState } from "react";

const MAX_RECORDING_MS = 30_000;
const MIN_RECORDING_MS = 700;

type VoiceState = "idle" | "requesting" | "recording" | "transcribing" | "error";

interface VoiceTripButtonProps {
  disabled?: boolean;
  onRecordingStart?: () => void;
  onTranscript: (text: string) => void | Promise<void>;
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
  onRecordingStart,
  onTranscript,
}: VoiceTripButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedRef = useRef(0);
  const discardOnStopRef = useRef(false);
  const mountedRef = useRef(true);
  const transcriptionAbortRef = useRef<AbortController | null>(null);

  function releaseMicrophone() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardOnStopRef.current = true;
      transcriptionAbortRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    };
  }, []);

  async function transcribe(blob: Blob) {
    const controller = new AbortController();
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = controller;
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
        signal: controller.signal,
      });
      const data = (await response.json()) as { text?: string; message?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.message || "Could not transcribe that recording.");
      }
      await onTranscript(data.text);
      if (!mountedRef.current || controller.signal.aborted) return;
      setState("idle");
      setMessage("Transcript processed — check the route boxes.");
    } catch (error) {
      if (controller.signal.aborted || !mountedRef.current) return;
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

    discardOnStopRef.current = false;
    onRecordingStart?.();
    setState("requesting");
    setMessage("Waiting for microphone permission… Audio is sent for transcription and is not stored by this app.");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "OverconstrainedError") {
          throw error;
        }
        if (!mountedRef.current) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
        if (discardOnStopRef.current || !mountedRef.current) return;
        if (Date.now() - recordingStartedRef.current < MIN_RECORDING_MS) {
          setState("error");
          setMessage("That was too short. Hold the microphone and speak for at least a second.");
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setState("error");
          setMessage("The recording was empty. Please try again.");
          return;
        }
        void transcribe(blob);
      });
      recorder.addEventListener("error", () => {
        discardOnStopRef.current = true;
        releaseMicrophone();
        setState("error");
        setMessage("The browser could not record your microphone.");
      });
      recorder.start();
      recordingStartedRef.current = Date.now();
      setState("recording");
      setMessage("Listening… describe your trip, then press Stop.");
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch {
      releaseMicrophone();
      if (!mountedRef.current) return;
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
  const label = recording
    ? "Stop recording"
    : state === "requesting"
      ? "Opening microphone"
      : state === "transcribing"
        ? "Transcribing trip"
        : "Record trip by voice";

  return (
    <>
      <button
        type="button"
        onClick={recording ? stopRecording : () => void startRecording()}
        disabled={busy || (disabled && !recording)}
        aria-pressed={recording}
        aria-label={label}
        title={label}
        className={`absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-[2px] border bg-surface text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40 ${recording ? "border-stale text-stale" : "border-rule"}`}
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
      </button>
      {message && (
        <p className="mt-1 pr-12 text-xs text-ink-3" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </>
  );
}
