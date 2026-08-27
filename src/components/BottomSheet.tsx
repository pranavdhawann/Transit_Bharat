"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type Snap = "peek" | "half" | "full";

/**
 * Snap heights (spec section 6).
 *
 * `peek` is a measured outcome, not the round 96px the spec says "roughly".
 * The binding requirement is that the top result's RouteBar is visible, and
 * the stack above that bar measures, from the sheet's top edge:
 *
 *   1px  sheet top border
 *  24px  drag-handle button (py-2.5 + the 4px grip; 24px also clears the
 *        WCAG 2.5.8 minimum target height)
 *   0px  scroll container (px-4 pb-4 — no top padding)
 *   1px  RouteCard top border
 *  16px  RouteCard p-4
 *  24.5px label chip row (11px text at the inherited 1.5 line-height + py-1)
 *  12px  mt-3
 *  32px  duration/fare/summary row (text-2xl carries a 32px line box)
 *  12px  mt-3
 *  24px  RouteBar h-6
 *  ----
 * 146.5px to the bottom of the bar (≈147.5px worst case, since the
 * baseline-aligned metrics row can round up a pixel on some font metrics).
 *
 * 6rem = 96px would cut the sheet off halfway through the duration row, so
 * peek is 148px: the smallest whole CSS pixel that clears 147.5px.
 */
const HEIGHTS: Record<Snap, string> = {
  peek: "148px",
  half: "50vh",
  full: "calc(100vh - 3rem)",
};

/** The cycle wraps, so `full` is followed by `peek`. */
const NEXT: Record<Snap, Snap> = { peek: "half", half: "full", full: "peek" };

/** Tailwind's `lg`. Above it this markup is a static column, not an overlay. */
const DESKTOP_QUERY = "(min-width: 64rem)";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Results sheet for /plan (spec section 6).
 *
 * Below `lg` it is a fixed three-snap bottom sheet over the full-bleed map.
 * At `lg` and above the same element becomes the static left column of the
 * two-column layout — one DOM subtree repositioned by classes rather than two
 * conditionally mounted copies, so the route list is never duplicated for a
 * screen reader and the map beside it is never remounted.
 *
 * The content stays in the DOM at every snap point so the route list remains
 * reachable in DOM order even at peek (spec section 9).
 */
export default function BottomSheet({
  snap,
  onSnapChange,
  label,
  children,
}: {
  snap: Snap;
  onSnapChange: (s: Snap) => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Only an overlay below `lg`; as the desktop column it must never trap.
  const [isOverlay, setIsOverlay] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsOverlay(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Escape collapses rather than closes; the sheet has no closed state. It is
  // also the escape hatch from the focus trap below, so it stays on `window`
  // and is never swallowed by the trap's Tab handling.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && snap === "full") onSnapChange("half");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snap, onSnapChange]);

  /**
   * Focus trap (spec section 9).
   *
   * Active ONLY at `full`, where the sheet covers the page and everything
   * behind it is inert to sighted users. At peek and half the sheet is a
   * partial overlay and the toolbar, the map and the rest of the page must
   * stay keyboard-reachable, so no trap runs there. Escape (above) always
   * leaves `full`, so the trap can never strand a keyboard user.
   */
  const trapped = isOverlay && snap === "full";
  useEffect(() => {
    if (!trapped) return;
    const el = ref.current;
    if (!el) return;
    const restoreTo = document.activeElement as HTMLElement | null;

    function focusable(sheet: HTMLDivElement): HTMLElement[] {
      return Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) =>
          n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement,
      );
    }

    // Entering full from a click on the grip leaves focus inside already.
    if (!el.contains(document.activeElement)) {
      (focusable(el)[0] ?? el).focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !el) return;
      const nodes = focusable(el);
      if (nodes.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Leaving full hands focus back where it came from.
      if (restoreTo && document.contains(restoreTo)) restoreTo.focus();
    };
  }, [trapped]);

  const nextSnap = NEXT[snap];
  // The name has to describe what the press will DO. Because the cycle wraps
  // peek → half → full → peek, the control collapses at full.
  const action = nextSnap === "peek" ? "Collapse" : "Expand";

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      tabIndex={-1}
      style={{ "--bt-sheet-h": HEIGHTS[snap] } as CSSProperties}
      className="bt-animate fixed inset-x-0 bottom-0 z-30 flex h-[var(--bt-sheet-h)] flex-col border-t border-rule bg-surface outline-none transition-[height] duration-200 lg:static lg:z-auto lg:h-auto lg:border-t-0 lg:bg-transparent"
    >
      <button
        type="button"
        onClick={() => onSnapChange(nextSnap)}
        aria-label={`${action} ${label}`}
        aria-expanded={snap !== "peek"}
        className="flex shrink-0 items-center justify-center py-2.5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-saffron lg:hidden"
      >
        <span aria-hidden className="h-1 w-10 bg-ink-3" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:overflow-visible lg:px-0 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
