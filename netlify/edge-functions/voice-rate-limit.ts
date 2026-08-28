/**
 * Netlify applies this rule before the Next.js transcription route runs.
 * Returning undefined continues the request chain without reading the audio
 * body, so the paid upstream call remains in the existing server route.
 */
export default function voiceRateLimit(): undefined {
  return undefined;
}

export const config = {
  path: "/api/ai/transcribe",
  rateLimit: {
    windowLimit: 3,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
