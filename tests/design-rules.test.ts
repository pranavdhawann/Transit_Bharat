import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/tokens";

/**
 * Files not yet migrated to the wayfinding system (spec section 7).
 * This list may only ever shrink. When it is empty, delete it and the
 * filter below.
 */
const ALLOWLIST: string[] = [
  "src/app/page.tsx",
  "src/app/plan/plan-client.tsx",
  "src/app/plan/page.tsx",
  "src/app/go/go-client.tsx",
  "src/app/go/page.tsx",
  "src/app/about/page.tsx",
  "src/app/layout.tsx",
  "src/components/PlaceInput.tsx",
  "src/components/RouteCard.tsx",
  "src/components/JourneyTimeline.tsx",
  "src/components/LangToggle.tsx",
  "src/components/MapView.tsx",
];

/**
 * RouteBar and JourneyTimeline use an INSET box-shadow as a keyline/ring,
 * which is not a drop shadow: RouteBar's `inset 0 0 0 1px var(--bt-ink)`
 * keeps segment widths proportional (a border would change box size), and
 * JourneyTimeline uses an inset ring for hollow station bullets.
 *
 * globals.css is exempt for the same reason: `.route-seg` applies
 * RouteBar's keyline via `box-shadow: var(--seg-keyline, none)` (the CSS
 * half of the same mechanism, not a drop shadow), and the MapLibre popup
 * override `box-shadow: none !important;` explicitly zeroes a third-party
 * shadow rather than adding one.
 */
const SHADOW_EXEMPT = [
  "src/components/RouteBar.tsx",
  "src/components/JourneyTimeline.tsx",
  "src/app/globals.css",
];

/**
 * RouteBar computes BOTH the light and dark resolution of each segment's
 * colour up front and hands both to the CSS cascade via custom properties
 * (see the file's own doc comment and `.route-seg` in globals.css) — the
 * literal "light"/"dark" arguments are correctly paired with the
 * light/dark CSS variable slot they feed, not a single hardcoded theme
 * reused everywhere (the original bug this rule guards against). A
 * text-pattern rule cannot distinguish that correct pairing from the bug
 * it is meant to catch, so this one file is exempted by name; any other
 * file introducing a literal here is a real regression candidate.
 */
const THEME_LITERAL_EXEMPT = ["src/components/RouteBar.tsx"];

/**
 * `src/lib/route-palette.ts` and the test files legitimately pass literal
 * "light"/"dark" strings to resolveOnBase/needsKeyline (they are the
 * implementation and its tests, not components rendering per-theme).
 */
const THEME_LITERAL_SCOPE = /^(src\/components\/|src\/app\/)/;

const RULES: { name: string; pattern: RegExp; exempt?: string[]; scope?: RegExp }[] = [
  { name: "no shadow utilities", pattern: /\bshadow-(sm|md|lg|xl|2xl|none|\[)/ },
  { name: "no box-shadow in CSS", pattern: /box-shadow\s*:/, exempt: SHADOW_EXEMPT },
  { name: "no large radii", pattern: /\brounded-(lg|xl|2xl|3xl)\b/ },
  {
    name: "no banned palette",
    pattern:
      /\b(bg|text|border|ring|from|to|via)-(blue|indigo|violet|sky|slate|gray|grey|zinc|neutral|stone)-\d{2,3}\b/,
  },
  { name: "no gradients", pattern: /(linear|radial)-gradient/, exempt: ["src/app/globals.css"] },
  { name: "no emoji", pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
  {
    name: "no hardcoded theme literal in resolveOnBase/needsKeyline",
    pattern: /\b(resolveOnBase|needsKeyline)\(\s*[^,]+,\s*["'](light|dark)["']/,
    exempt: THEME_LITERAL_EXEMPT,
    scope: THEME_LITERAL_SCOPE,
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.split("\\").join("/"));
  }
  return out;
}

const FILES = walk("src").filter((f) => /\.(ts|tsx|css)$/.test(f));

describe.each(RULES)("design rule: $name", ({ pattern, exempt = [], scope }) => {
  it("is not violated outside the allowlist", () => {
    const offenders = FILES.filter(
      (f) =>
        !ALLOWLIST.includes(f) &&
        !exempt.includes(f) &&
        (!scope || scope.test(f)) &&
        pattern.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("allowlist hygiene", () => {
  it("lists only files that still exist", () => {
    const missing = ALLOWLIST.filter((f) => !FILES.includes(f));
    expect(missing).toEqual([]);
  });
});

describe("token drift", () => {
  it("mirrors every token from tokens.ts into globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    for (const theme of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(THEMES[theme])) {
        expect(css, `${theme}.${name} (${value}) missing from globals.css`)
          .toContain(value.toLowerCase());
      }
    }
  });
});
