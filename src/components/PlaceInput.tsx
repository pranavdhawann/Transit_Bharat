"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PlaceResult } from "@/lib/types";

/** Minimum characters before we run a text search (matches searchPlaces). */
const MIN_QUERY = 2;
/** Keystroke settle time before hitting /api/places. */
const DEBOUNCE_MS = 160;

type ListKind = "suggestions" | "results";

export default function PlaceInput({
  id,
  label,
  placeholder,
  value,
  onSelect,
  iconColor = "bg-slate-400",
}: {
  id: string;
  label: string;
  placeholder: string;
  value: PlaceResult | null;
  onSelect: (p: PlaceResult | null) => void;
  iconColor?: string;
}) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [kind, setKind] = useState<ListKind>("suggestions");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Responses can land out of order; only the newest request may set state.
  const reqSeq = useRef(0);
  // Set when the rider types over an existing selection. That keystroke clears
  // the selection, and without this flag the sync effect below would read the
  // resulting null and wipe the half-typed text right out of the box.
  const typingRef = useRef(false);
  const listboxId = useId();

  // Keep the visible text in sync when a place is chosen programmatically
  // (e.g. suggestion chips) and clear it when the selection is dropped.
  useEffect(() => {
    if (typingRef.current) {
      typingRef.current = false;
      return;
    }
    setText(value ? value.name : "");
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchList = useCallback(async (q: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        results?: PlaceResult[];
        kind?: ListKind;
      };
      if (seq !== reqSeq.current) return; // a newer keystroke already won
      const list = data.results ?? [];
      setResults(list);
      setKind(data.kind ?? (q.trim() ? "results" : "suggestions"));
      setActiveIdx(list.length ? 0 : -1);
      setOpen(true);
    } catch {
      if (seq !== reqSeq.current) return;
      setResults([]);
      setActiveIdx(-1);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = q.trim();
      // An empty box asks for popular places; a single character is too
      // ambiguous to search on, so we keep the current list until there are two.
      if (trimmed.length > 0 && trimmed.length < MIN_QUERY) {
        setOpen(true);
        return;
      }
      debounceRef.current = setTimeout(() => void fetchList(q), DEBOUNCE_MS);
    },
    [fetchList],
  );

  function choose(p: PlaceResult) {
    onSelect(p);
    setText(p.name);
    setOpen(false);
    setActiveIdx(-1);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSelect(null);
    setText("");
    void fetchList("");
  }

  function openList() {
    void fetchList(text.trim().length >= MIN_QUERY ? text : "");
  }

  // Keep the highlighted option scrolled into view during keyboard use.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const node = listRef.current?.children[activeIdx];
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  const showEmptyState =
    open && !loading && results.length === 0 && text.trim().length >= MIN_QUERY;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${iconColor}`} />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined
          }
          autoComplete="off"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            // Only arm the flag when a selection actually exists to clear,
            // otherwise onSelect(null) is a no-op and the flag would leak into
            // the next genuine programmatic update (e.g. the swap button).
            if (value) typingRef.current = true;
            onSelect(null);
            scheduleSearch(next);
          }}
          onFocus={() => {
            // Always give the rider something to pick from on focus.
            if (results.length > 0) setOpen(true);
            else openList();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openList();
              return;
            }
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % Math.max(results.length, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
              e.preventDefault();
              choose(results[activeIdx]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            } else if (e.key === "Tab" && activeIdx >= 0 && results[activeIdx]) {
              choose(results[activeIdx]);
            }
          }}
        />
        {text.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${label}`}
            className="shrink-0 rounded-full px-1.5 text-lg leading-none text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            &times;
          </button>
        )}
      </div>

      {open && (results.length > 0 || showEmptyState) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.length > 0 && kind === "suggestions" && (
            <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Popular places
            </p>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-72 overflow-y-auto py-1"
          >
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(r)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${
                    i === activeIdx ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {r.detail ?? r.type}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {showEmptyState && (
            <p className="px-3 py-3 text-sm text-slate-500">
              No stop or landmark matches that. Try a nearby metro station, or a
              landmark like Connaught Place.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
