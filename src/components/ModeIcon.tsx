import type { Mode } from "@/lib/types";

const LABEL: Record<Mode, string> = {
  WALK: "Walk",
  BUS: "Bus",
  SUBWAY: "Metro",
};

export function modeLabel(mode: Mode): string {
  return LABEL[mode];
}

export default function ModeIcon({
  mode,
  color,
  size = 16,
  className = "",
}: {
  mode: Mode;
  color?: string;
  size?: number;
  className?: string;
}) {
  const stroke = color ?? "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {mode === "WALK" && (
        <>
          <circle cx="13" cy="4.5" r="2" />
          <path d="M10 21l2-6-2-3 3-4 3 3h3" />
          <path d="M12 12l-3 2-1 7" />
        </>
      )}
      {mode === "BUS" && (
        <>
          <rect x="4" y="3" width="16" height="14" rx="2" />
          <path d="M4 11h16" />
          <path d="M8 21v-2M16 21v-2" />
          <circle cx="8.5" cy="15.5" r="0.75" fill={stroke} />
          <circle cx="15.5" cy="15.5" r="0.75" fill={stroke} />
        </>
      )}
      {mode === "SUBWAY" && (
        <>
          <rect x="5" y="3" width="14" height="13" rx="3" />
          <path d="M5 11h14" />
          <path d="M9 20l-2 2M15 20l2 2" />
          <circle cx="8.5" cy="13.5" r="0.75" fill={stroke} />
          <circle cx="15.5" cy="13.5" r="0.75" fill={stroke} />
        </>
      )}
    </svg>
  );
}
