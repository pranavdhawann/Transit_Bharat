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
 * GO headers keep it in the flow); the styling stays fixed so the control
 * looks and behaves identically everywhere.
 */
export default function LangToggle({ className = "" }: { className?: string }) {
  const [lang, setLang] = useLang();
  return (
    <div
      className={`flex overflow-hidden border border-rule ${className}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`type-micro px-2.5 py-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-saffron ${
            lang === l ? "bg-ink text-paper" : "bg-surface text-ink-3 hover:bg-paper"
          }`}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
