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
  "src/app/plan/plan-client.tsx",
  "src/app/plan/page.tsx",
  "src/app/go/go-client.tsx",
  "src/app/go/page.tsx",
  "src/app/about/page.tsx",
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
];

/**
 * Pairing-aware theme-literal guard (spec section 7, Ruling 11).
 *
 * A flat regex for a literal "light"/"dark" argument cannot tell a
 * correct dual-resolution call site from the original bug (a single
 * hardcoded theme reused for both the light and dark CSS slots) — both
 * shapes contain the literals. Exempting the one file that legitimately
 * uses this pattern (RouteBar.tsx) made the guard inert: it had zero
 * remaining call sites to check, so it could never fail.
 *
 * Instead this exploits the structural difference between the two shapes,
 * per function name, independently:
 *
 *  (a) Count parity — the number of calls whose second argument is the
 *      literal "light" must equal the number whose second argument is
 *      "dark". The bug calls the same theme twice (or more) with no
 *      opposite-theme counterpart, so parity breaks.
 *  (b) First-argument disjointness — the set of first-argument source
 *      expressions used with "light" must be disjoint from the set used
 *      with "dark". This catches the subtler bug that (a) alone would
 *      miss: `resolveOnBase(lightBase, "light")` paired with
 *      `resolveOnBase(lightBase, "dark")` has perfect count parity but
 *      still feeds the light base into the dark slot.
 *
 * First arguments are compared as trimmed source text (e.g. "lightBase"
 * vs "darkBase") — this is a static, non-evaluating comparison of
 * identifiers, not a value comparison.
 */
type ThemeCall = { arg: string; theme: "light" | "dark" };

function extractThemeCalls(content: string, fnName: string): ThemeCall[] {
  const re = new RegExp(
    `\\b${fnName}\\(\\s*([^,]+?)\\s*,\\s*["'](light|dark)["']`,
    "g",
  );
  const calls: ThemeCall[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    calls.push({ arg: m[1].trim(), theme: m[2] as "light" | "dark" });
  }
  return calls;
}

/** Returns a violation message, or null if the calls are correctly paired. */
function pairingViolation(content: string, fnName: string): string | null {
  const calls = extractThemeCalls(content, fnName);
  if (calls.length === 0) return null;

  const lightArgs = calls.filter((c) => c.theme === "light").map((c) => c.arg);
  const darkArgs = calls.filter((c) => c.theme === "dark").map((c) => c.arg);

  if (lightArgs.length !== darkArgs.length) {
    return `${fnName}: light/dark call count mismatch (${lightArgs.length} light vs ${darkArgs.length} dark)`;
  }

  const darkSet = new Set(darkArgs);
  const overlap = [...new Set(lightArgs)].filter((a) => darkSet.has(a));
  if (overlap.length > 0) {
    return `${fnName}: same first argument (${overlap.join(", ")}) used for both "light" and "dark"`;
  }

  return null;
}

const THEME_PAIRED_FNS = ["resolveOnBase", "needsKeyline"] as const;

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

describe("design rule: paired theme literals in resolveOnBase/needsKeyline", () => {
  it("is not violated outside the allowlist", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (ALLOWLIST.includes(f)) continue;
      if (!THEME_LITERAL_SCOPE.test(f)) continue;
      const content = readFileSync(f, "utf8");
      for (const fn of THEME_PAIRED_FNS) {
        const violation = pairingViolation(content, fn);
        if (violation) offenders.push(`${f} — ${violation}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("theme-literal pairing rule self-test (falsifiability)", () => {
  it("fails on the original bug shape: one hardcoded theme, no opposite counterpart", () => {
    const buggy = `
      const style = {
        "--seg-fg": resolveOnBase(base, "light"),
        "--seg-fg-dark": resolveOnBase(base, "light"),
        "--seg-keyline": needsKeyline(base, "light") ? INK_KEYLINE : "none",
        "--seg-keyline-dark": needsKeyline(base, "light") ? INK_KEYLINE : "none",
      };
    `;
    expect(pairingViolation(buggy, "resolveOnBase")).toBe(
      'resolveOnBase: light/dark call count mismatch (2 light vs 0 dark)',
    );
    expect(pairingViolation(buggy, "needsKeyline")).toBe(
      'needsKeyline: light/dark call count mismatch (2 light vs 0 dark)',
    );
  });

  it("fails on the disjointness violation: matched counts but same first argument feeds both slots", () => {
    const buggy = `
      const style = {
        "--seg-fg": resolveOnBase(base, "light"),
        "--seg-fg-dark": resolveOnBase(base, "dark"),
      };
    `;
    expect(pairingViolation(buggy, "resolveOnBase")).toBe(
      'resolveOnBase: same first argument (base) used for both "light" and "dark"',
    );
  });

  it("passes on the correct paired shape (today's RouteBar.tsx)", () => {
    const correct = `
      const style = {
        "--seg-fg": resolveOnBase(lightBase, "light"),
        "--seg-fg-dark": resolveOnBase(darkBase, "dark"),
        "--seg-keyline": needsKeyline(lightBase, "light") ? INK_KEYLINE : "none",
        "--seg-keyline-dark": needsKeyline(darkBase, "dark") ? INK_KEYLINE : "none",
      };
    `;
    expect(pairingViolation(correct, "resolveOnBase")).toBeNull();
    expect(pairingViolation(correct, "needsKeyline")).toBeNull();
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
