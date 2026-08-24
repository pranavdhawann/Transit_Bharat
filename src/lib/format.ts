export function fmtDurationMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtInr(value: number): string {
  return `₹${value}`;
}

export function fmtWalk(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const IST = "Asia/Kolkata";

export function fmtClockIST(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(d);
}

export function fmtAge(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)} sec ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}
