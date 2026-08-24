"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PlaceResult } from "@/lib/types";

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
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Keep the visible text in sync when a place is chosen programmatically
  // (e.g. suggestion chips).
  useEffect(() => {
    if (value) {
      setText(value.name);
    }
  }, [value]);

  useEffect(() => {
    if (!value) setText("");
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

  async function runSearch(q: string) {
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: PlaceResult[] };
      setResults(data.results ?? []);
      setActiveIdx(data.results?.length ? 0 : -1);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }

  function choose(p: PlaceResult) {
    onSelect(p);
    setText(p.name);
    setOpen(false);
  }

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
          autoComplete="off"
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onSelect(null);
            void runSearch(e.target.value);
          }}
          onFocus={() => text.length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
              e.preventDefault();
              choose(results[activeIdx]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => choose(r)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${
                  i === activeIdx ? "bg-blue-50" : ""
                }`}
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 shrink-0 text-xs text-slate-400">
                  {r.detail ?? r.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
