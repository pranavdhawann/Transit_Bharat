"use client";

import { useLang } from "@/lib/i18n";

/**
 * EN / हिं switch, shared by every page that shows bilingual copy.
 *
 * It keeps no state of its own: `useLang` persists the choice and broadcasts a
 * window event, so flipping the language here also updates every other mounted
 * toggle and translated string - which is why /plan and /go can each render one
 * without threading a setter through their props.
 *
 * `className` is placement only (the home hero pins it to a corner, the plan and
 * GO headers keep it in the flow); the pill styling stays fixed so the control
 * looks and behaves identically everywhere.
 */
export default function LangToggle({ className = "" }: { className?: string }) {
  const [lang, setLang] = useLang();
  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-slate-200 ${className}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
            lang === l ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
