import { PROVENANCE_META } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";

export default function ProvenanceBadge({
  provenance,
  suffix,
  title,
  className = "",
}: {
  provenance: Provenance;
  suffix?: string;
  title?: string;
  className?: string;
}) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      title={title ?? meta.hint}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.className} ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`}
      />
      {meta.label}
      {suffix ? <span className="font-medium normal-case">· {suffix}</span> : null}
    </span>
  );
}
