# BharaTransit Wayfinding Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default-Tailwind appearance of the app with a transit-signage design language, restructure `/plan` and `/go` as a mobile-first app rather than a centered marketing page, and rename the product from *Transit Bharat* to *BharaTransit*.

**Architecture:** Design values live as **typed data** in `src/lib/` so they can be unit-tested in the existing node-environment vitest setup, and are mirrored into CSS custom properties in `globals.css`. Tailwind v4's `@theme` maps those custom properties to utility names (`bg-paper`, `text-ink`), so light/dark switching happens entirely in the cascade with no `dark:` variants on any component. A `tests/design-rules.test.ts` ratchet enforces the negative rules with a shrinking allowlist, keeping the suite green at every commit while making migration progress visible.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.8, Tailwind CSS 4.3, MapLibre GL 5, vitest 3 (node environment, no DOM).

**Spec:** [`docs/superpowers/specs/2026-08-26-bharatransit-wayfinding-design.md`](../specs/2026-08-26-bharatransit-wayfinding-design.md) — read it alongside this plan; every task argues from a numbered section of it.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **The governing rule (§2):** colour is only ever one of four things — the ink scale, a route colour (from data), a provenance signal, or the single saffron accent.
- **Saffron (§3.1)** has exactly three permitted uses: the wordmark's shared **T**, the focus ring, and the active/current indicator in GO mode. Never a button fill, link colour, or background.
- **Shadows (§3.4):** zero `box-shadow` anywhere in the product.
- **Radius (§3.4):** `0` for sheets/cards/panels/map, `2px` for buttons/inputs/badges, `rounded-full` for dots and station bullets only.
- **Negative rules (§7):** no `shadow-*`; no `rounded-lg|xl|2xl|3xl`; no `blue-*|indigo-*|violet-*|sky-*`; no gradients except the provenance hatch; no emoji in UI copy.
- **Contrast (§9):** body text and Micro-scale labels clear **4.5:1**; focus ring clears **3:1**; route bars clear **3:1** against the ground or carry a keyline.
- **Provenance (§9):** all four states must be distinguishable **without colour**.
- **Motion (§9):** `prefers-reduced-motion` disables the LIVE pulse, sheet snap, and GO progress transition, via the `.bt-animate` hook.
- **Do not change:** routing, fares, provenance semantics, AI endpoints, GTFS pipeline behaviour, or the MapLibre basemap style URL (§11).
- **Opacity modifiers are banned on token colours.** Tailwind cannot reliably compute `bg-ink/50` when the theme value is a `var()`. Define an explicit token instead.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/contrast.ts` | sRGB relative luminance and contrast ratio. Pure, no deps. |
| `src/lib/tokens.ts` | Ink/ground/accent/provenance tokens as typed data. Single source of truth. |
| `src/lib/route-palette.ts` | Metro + bus base colours, computed `onBase`, keyline rule. |
| `src/lib/routebar.ts` | Pure segment maths for `RouteBar`. |
| `src/components/RouteBar.tsx` | The signature line-diagram component (§5.1). |
| `src/components/Wordmark.tsx` | `Bhara`**T**`ransit` lockup (§5.5). |
| `src/components/BottomSheet.tsx` | Three-snap-point sheet for `/plan` mobile (§6). |
| `tests/naming.test.ts` | Guards the rename. |
| `tests/contrast.test.ts` | Guards §3.1 / §3.2 ratios. |
| `tests/route-palette.test.ts` | Guards §3.3 ratios, `onBase`, keyline. |
| `tests/routebar.test.ts` | Guards segment maths. |
| `tests/provenance-form.test.ts` | Guards §3.2 non-colour distinguishability. |
| `tests/design-rules.test.ts` | The negative-rule ratchet (§7). |

**Modify:** `src/app/globals.css`, `layout.tsx`, `page.tsx`, `manifest.ts`, `icon.svg`, `plan/plan-client.tsx`, `go/go-client.tsx`, `about/page.tsx`; `src/components/{ProvenanceBadge,RouteCard,JourneyTimeline,PlaceInput,LangToggle,MapView}.tsx`; `src/lib/{provenance,i18n}.ts`; `src/data/network.ts`; `src/data/generated/metro-lines.json`; `scripts/ingest-gtfs.mjs`; `package.json`; the six markdown docs.

**Deliberately unchanged:** MapLibre source/layer ids (`tb-lines`, `tb-stop-dot`, …) are internal, never user-visible, and renaming them is churn with no benefit. The naming guard in Task 1 is written to ignore them.

---

## Task 1: Rename to BharaTransit

Implements spec §8. Done first so every later task writes the new name.

**Files:**
- Create: `tests/naming.test.ts`
- Modify: `package.json`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/about/page.tsx`, `src/app/globals.css`, `src/lib/i18n.ts`, `src/app/plan/plan-client.tsx`, `src/app/go/go-client.tsx`, `src/components/RouteCard.tsx`, `scripts/ingest-gtfs.mjs`, `README.md`, `SUBMISSION.md`, `LIMITATIONS.md`, `BUILD_WITH_CODEX.md`, `DEPLOY_NETLIFY.md`, `VIDEO_SCRIPT.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the `bt:` storage prefix and `.bt-animate` class name that Tasks 3, 12 and 13 rely on.

- [ ] **Step 1: Write the failing test**

Create `tests/naming.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const FILES = [...walk("src"), ...walk("scripts")].filter((f) =>
  /\.(ts|tsx|mjs|css|svg)$/.test(f),
);

function offenders(re: RegExp): string[] {
  return FILES.filter((f) => re.test(readFileSync(f, "utf8")));
}

describe("product naming", () => {
  it("never uses the old product name", () => {
    expect(offenders(/Transit\s+Bharat|transit-bharat/i)).toEqual([]);
  });

  it("uses the bt: storage prefix, never tb:", () => {
    expect(offenders(/\btb:/)).toEqual([]);
  });

  it("uses the .bt-animate class, never .tb-animate", () => {
    expect(offenders(/tb-animate/)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/naming.test.ts
```

Expected: all three fail, listing the files above.

- [ ] **Step 3: Apply the rename**

Replace, in the files listed under **Modify**:

- `Transit Bharat` → `BharaTransit`
- `transit-bharat` → `bharatransit` (the `name` field in `package.json`)
- `tb:lang` → `bt:lang`, `tb:journey` → `bt:journey`
- `tb-animate` → `bt-animate` (the `@media (prefers-reduced-motion)` block in `globals.css`, plus every `className` using it)

In `layout.tsx` the header wordmark currently reads `Transit <span className="text-orange-600">Bharat</span>`. Replace with plain text `BharaTransit` for now — Task 8 turns it into the real lockup.

Do **not** touch: MapLibre layer/source ids in `MapView.tsx`, or the `Transit_Bharat` directory name.

- [ ] **Step 4: Run the full suite**

```bash
npx vitest run
```

Expected: 56 passing (53 existing + 3 new).

- [ ] **Step 5: Check the submission word count**

Per spec §8, `SUBMISSION.md` §1 is tuned to a 250-word limit and the rename shifts it:

```bash
node -e "const m=require('fs').readFileSync('SUBMISSION.md','utf8').split('## 2.')[0];const b=m.split('> ').slice(1).join(' ');console.log(b.trim().split(/\s+/).length,'words')"
```

If the count exceeds 250, **stop and report to the user** rather than editing the paragraph — the spec reserves that call for them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "rename: Transit Bharat -> BharaTransit"
```

---

## Task 2: Contrast primitives and design tokens as data

Implements spec §3.1, §3.2. Everything downstream depends on these values being correct and testable.

**Files:**
- Create: `src/lib/contrast.ts`, `src/lib/tokens.ts`, `tests/contrast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `relativeLuminance(hex: string): number`
  - `contrastRatio(a: string, b: string): number`
  - `THEMES: Record<"light" | "dark", ThemeTokens>` where `ThemeTokens = { ink, ink2, ink3, paper, surface, rule, saffron, live, stale: string }`
  - Task 3 mirrors `THEMES` into CSS; Task 4 imports `contrastRatio`; Task 5 imports `THEMES`.

- [ ] **Step 1: Write the failing test**

Create `tests/contrast.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "@/lib/contrast";
import { THEMES } from "@/lib/tokens";

describe("contrast primitives", () => {
  it("computes known luminance endpoints", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("computes the canonical black-on-white ratio", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#C43129", "#F5F3EF")).toBeCloseTo(
      contrastRatio("#F5F3EF", "#C43129"),
      10,
    );
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("red")).toThrow();
    expect(() => relativeLuminance("#FFF")).toThrow();
  });
});

describe.each(["light", "dark"] as const)("%s theme tokens", (theme) => {
  const t = THEMES[theme];

  it("clears 4.5:1 for text on both grounds", () => {
    for (const ink of [t.ink, t.ink2, t.ink3]) {
      expect(contrastRatio(ink, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ink, t.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("clears 3:1 for the saffron focus ring on both grounds", () => {
    expect(contrastRatio(t.saffron, t.paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t.saffron, t.surface)).toBeGreaterThanOrEqual(3);
  });

  it("clears 4.5:1 for provenance signal colours", () => {
    for (const signal of [t.live, t.stale]) {
      expect(contrastRatio(signal, t.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(signal, t.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/contrast.test.ts
```

Expected: FAIL — cannot resolve `@/lib/contrast`.

- [ ] **Step 3: Implement `src/lib/contrast.ts`**

```ts
/**
 * WCAG 2.1 contrast arithmetic over 6-digit sRGB hex.
 *
 * Lives in src/lib rather than a test helper because the design tokens and the
 * route palette are both product data, and their contrast guarantees are a
 * product requirement (spec section 9) rather than a test convenience.
 */

function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return (
    0.2126 * channelToLinear((n >> 16) & 0xff) +
    0.7152 * channelToLinear((n >> 8) & 0xff) +
    0.0722 * channelToLinear(n & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Implement `src/lib/tokens.ts`**

```ts
/**
 * Design tokens (spec section 3.1, 3.2).
 *
 * Every value here was computed against the contrast targets in section 9
 * before being written down, and tests/contrast.test.ts re-derives those
 * guarantees on every run. globals.css mirrors this file; the drift guard in
 * tests/design-rules.test.ts keeps the two in step.
 */

export interface ThemeTokens {
  ink: string;
  ink2: string;
  ink3: string;
  paper: string;
  surface: string;
  rule: string;
  saffron: string;
  live: string;
  stale: string;
}

export const THEMES: Record<"light" | "dark", ThemeTokens> = {
  light: {
    ink: "#131A22",
    ink2: "#38434F",
    ink3: "#606B76",
    paper: "#F5F3EF",
    surface: "#FFFFFF",
    rule: "#D9D5CC",
    saffron: "#DA601A",
    live: "#0C7946",
    stale: "#975A00",
  },
  dark: {
    ink: "#EDEAE3",
    ink2: "#A8B0B8",
    ink3: "#848E98",
    paper: "#10151A",
    surface: "#182029",
    rule: "#2A343E",
    saffron: "#FF8A3D",
    live: "#28A96A",
    stale: "#E09A20",
  },
};
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npx vitest run tests/contrast.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contrast.ts src/lib/tokens.ts tests/contrast.test.ts
git commit -m "feat: add contrast primitives and verified design tokens"
```

---

## Task 3: Token layer, fonts and type roles in CSS

Implements spec §3.1, §3.4, §4. After this task the app looks wrong but every primitive exists.

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `THEMES` from Task 2 (mirrored by hand, guarded in Task 7).
- Produces: the utility names every later task uses — `bg-paper`, `bg-surface`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-rule`, `text-live`, `text-stale`, `bg-saffron`; and the type-role classes `.type-display`, `.type-data`, `.type-body`, `.type-micro`; and `.hatch`.

- [ ] **Step 1: Load the fonts in `layout.tsx`**

Add above `metadata`:

```tsx
import { Archivo, Noto_Sans_Devanagari } from "next/font/google";

// Archivo is a true variable font on Google Fonts (weight 100-900, width
// 62-125%), so one file gives us both the expanded Display voice and the
// condensed Data voice. next/font self-hosts it at build time, so there is no
// runtime request to Google.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

// Archivo has no Devanagari coverage; Hindi copy falls through to this.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-devanagari",
});
```

Then put both variables on `<html>`:

```tsx
<html lang="en" className={`${archivo.variable} ${devanagari.variable}`}>
```

- [ ] **Step 2: Verify the fonts resolve at build time**

```bash
npx next build
```

Expected: build succeeds. If `Noto_Sans_Devanagari` errors asking for an explicit `weight`, it is not being treated as variable — add `weight: ["400", "600", "700"]` and rebuild.

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

/* ---------------------------------------------------------------- tokens
   Mirrors src/lib/tokens.ts. Both files are checked against each other by
   tests/design-rules.test.ts, so edit them together. */
:root {
  --bt-ink: #131a22;
  --bt-ink-2: #38434f;
  --bt-ink-3: #606b76;
  --bt-paper: #f5f3ef;
  --bt-surface: #ffffff;
  --bt-rule: #d9d5cc;
  --bt-saffron: #da601a;
  --bt-live: #0c7946;
  --bt-stale: #975a00;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bt-ink: #edeae3;
    --bt-ink-2: #a8b0b8;
    --bt-ink-3: #848e98;
    --bt-paper: #10151a;
    --bt-surface: #182029;
    --bt-rule: #2a343e;
    --bt-saffron: #ff8a3d;
    --bt-live: #28a96a;
    --bt-stale: #e09a20;
  }
}

:root[data-theme="dark"] {
  --bt-ink: #edeae3;
  --bt-ink-2: #a8b0b8;
  --bt-ink-3: #848e98;
  --bt-paper: #10151a;
  --bt-surface: #182029;
  --bt-rule: #2a343e;
  --bt-saffron: #ff8a3d;
  --bt-live: #28a96a;
  --bt-stale: #e09a20;
}

/* Mapping the tokens through @theme means every colour utility flips with the
   cascade. No component needs a dark: variant. */
@theme {
  --font-sans: var(--font-archivo), var(--font-devanagari), ui-sans-serif,
    system-ui, "Segoe UI", Roboto, sans-serif;

  --color-ink: var(--bt-ink);
  --color-ink-2: var(--bt-ink-2);
  --color-ink-3: var(--bt-ink-3);
  --color-paper: var(--bt-paper);
  --color-surface: var(--bt-surface);
  --color-rule: var(--bt-rule);
  --color-saffron: var(--bt-saffron);
  --color-live: var(--bt-live);
  --color-stale: var(--bt-stale);

  --radius-none: 0;
  --radius-control: 2px;
}

html,
body {
  min-height: 100%;
}

body {
  background-color: var(--bt-paper);
  color: var(--bt-ink);
}

/* ------------------------------------------------------------ type roles
   Four voices, one variable family. The width axis is what separates the
   Display and Data voices; see spec section 4. */
.type-display {
  font-stretch: 118%;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  line-height: 1.05;
}

.type-data {
  font-stretch: 88%;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.type-body {
  font-stretch: 100%;
  font-weight: 400;
  line-height: 1.5;
}

.type-micro {
  font-stretch: 100%;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* --------------------------------------------------------------- hatch
   The "not real" treatment: DEMO provenance and walk segments. The single
   gradient the negative rules permit (spec section 7). */
.hatch {
  background-image: repeating-linear-gradient(
    45deg,
    color-mix(in srgb, var(--bt-ink) 14%, transparent) 0 3px,
    transparent 3px 6px
  );
}

/* MapLibre popup styling to match the design system */
.maplibregl-popup-content {
  border-radius: 2px !important;
  padding: 0.5rem 0.75rem !important;
  font-size: 0.8125rem;
  background: var(--bt-surface) !important;
  color: var(--bt-ink) !important;
  border: 1px solid var(--bt-rule) !important;
  box-shadow: none !important;
}
.maplibregl-popup-tip {
  border-width: 6px !important;
}

@media (prefers-reduced-motion: reduce) {
  .bt-animate {
    transition: none !important;
    animation: none !important;
  }
}
```

- [ ] **Step 4: Verify the utilities actually generate**

Tailwind v4 must accept `var()` values inside `@theme`. Prove it rather than assume it:

```bash
npx next build && grep -c "\-\-color-ink" .next/static/css/*.css
```

Expected: a non-zero count. Then start the dev server and confirm in the browser that `document.body` computes a `background-color` of `rgb(245, 243, 239)` in light and `rgb(16, 21, 26)` under an emulated dark scheme. If `@theme` rejects the `var()` indirection, fall back to declaring the utilities by hand with `@utility bg-paper { background-color: var(--bt-paper); }` and note the change in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add wayfinding token layer, Archivo/Devanagari fonts and type roles"
```

---

## Task 4: Route palette

Implements spec §3.3. This is the load-bearing colour data.

**Files:**
- Create: `src/lib/route-palette.ts`, `tests/route-palette.test.ts`
- Modify: `src/data/generated/metro-lines.json`, `src/data/network.ts:93`, `src/data/network.ts:107`, `scripts/ingest-gtfs.mjs`

**Interfaces:**
- Consumes: `contrastRatio` (Task 2), `THEMES` (Task 2).
- Produces:
  - `METRO_BASES: Record<string, { light: string; dark: string }>` keyed by `metro:<colour>` id
  - `BUS_BASES: { light: string; dark: string }[]` (5 slots)
  - `resolveOnBase(base: string, theme: "light" | "dark"): string`
  - `needsKeyline(base: string, theme: "light" | "dark"): boolean`
  - Tasks 6, 11, 13 and 15 consume `resolveOnBase` and `needsKeyline`.

- [ ] **Step 1: Write the failing test**

Create `tests/route-palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import {
  BUS_BASES,
  METRO_BASES,
  needsKeyline,
  resolveOnBase,
} from "@/lib/route-palette";
import { THEMES } from "@/lib/tokens";
import { METRO_LINES } from "@/data/network";

const THEME_NAMES = ["light", "dark"] as const;
const BANNED = ["#2563eb", "#0d9488", "#b45309", "#7c3aed", "#be185d"];

describe("route palette", () => {
  it("covers every metro line in the network data", () => {
    for (const line of METRO_LINES) {
      expect(METRO_BASES, `missing palette for ${line.id}`).toHaveProperty(
        line.id,
      );
    }
  });

  it("uses none of the banned framework default hues", () => {
    const all = [
      ...Object.values(METRO_BASES),
      ...BUS_BASES,
    ].flatMap((p) => [p.light.toLowerCase(), p.dark.toLowerCase()]);
    for (const banned of BANNED) expect(all).not.toContain(banned);
  });
});

describe.each(THEME_NAMES)("route palette in %s theme", (theme) => {
  const bases = [
    ...Object.entries(METRO_BASES).map(([id, p]) => [id, p[theme]] as const),
    ...BUS_BASES.map((p, i) => [`bus:${i + 1}`, p[theme]] as const),
  ];

  it("gives every base a label colour clearing 4.5:1", () => {
    for (const [id, base] of bases) {
      const onBase = resolveOnBase(base, theme);
      expect(contrastRatio(base, onBase), `${id} label`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("flags exactly the bases that fall below 3:1 against the ground", () => {
    const ground = THEMES[theme].paper;
    for (const [id, base] of bases) {
      const belowThreshold = contrastRatio(base, ground) < 3;
      expect(needsKeyline(base, theme), `${id} keyline`).toBe(belowThreshold);
    }
  });

  it("needs a keyline only for the yellow line", () => {
    const flagged = bases
      .filter(([, base]) => needsKeyline(base, theme))
      .map(([id]) => id);
    expect(flagged.every((id) => id === "metro:yellow")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/route-palette.test.ts
```

Expected: FAIL — cannot resolve `@/lib/route-palette`.

- [ ] **Step 3: Implement `src/lib/route-palette.ts`**

```ts
/**
 * Route colour palette (spec section 3.3).
 *
 * Route colour is the primary structural device in this design, which makes
 * this file load-bearing. It replaces the Material Design hues that shipped in
 * metro-lines.json and the Tailwind defaults that shipped in BUS_PALETTE.
 *
 * onBase is derived, never authored: hand-authoring it produced four wrong
 * pairings during design.
 */
import { contrastRatio } from "./contrast";
import { THEMES } from "./tokens";

export interface ColorPair {
  light: string;
  dark: string;
}

export type Theme = "light" | "dark";

export const METRO_BASES: Record<string, ColorPair> = {
  "metro:red": { light: "#C43129", dark: "#D87772" },
  "metro:yellow": { light: "#E8B300", dark: "#F0CD57" },
  "metro:blue": { light: "#0B57A4", dark: "#5E90C3" },
  "metro:green": { light: "#1B793D", dark: "#69A77F" },
  "metro:violet": { light: "#5B2A86", dark: "#9B7CB5" },
  "metro:pink": { light: "#D65E92", dark: "#D789AB" },
  "metro:magenta": { light: "#A8206B", dark: "#C66C9D" },
  "metro:aqua": { light: "#087483", dark: "#5CA3AD" },
  "metro:orange": { light: "#E06A16", dark: "#E19561" },
  "metro:rapid": { light: "#7F6359", dark: "#AB9891" },
};

/** Lower-chroma than the metro set, so bus reads as a different class. */
export const BUS_BASES: ColorPair[] = [
  { light: "#4A5D73", dark: "#8894A3" },
  { light: "#7A5C3E", dark: "#A79380" },
  { light: "#3E6B5E", dark: "#809D95" },
  { light: "#6E4A63", dark: "#9F8898" },
  { light: "#5C6438", dark: "#93997C" },
];

/** Whichever of ink or paper reads better on this bar. */
export function resolveOnBase(base: string, theme: Theme): string {
  const { ink, paper } = THEMES[theme];
  return contrastRatio(base, ink) >= contrastRatio(base, paper) ? ink : paper;
}

/**
 * A bar must be visible against the ground, which is separate from its label
 * being readable. Below 3:1 it gets an ink keyline rather than being darkened
 * until it clears — darkening yellow to clear 3:1 turns it to mustard and
 * destroys the line identity.
 */
export function needsKeyline(base: string, theme: Theme): boolean {
  return contrastRatio(base, THEMES[theme].paper) < 3;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run tests/route-palette.test.ts
```

Expected: PASS.

- [ ] **Step 5: Migrate the network data to the new light bases**

In `src/data/generated/metro-lines.json`, replace each line's `color` with its `light` value from `METRO_BASES`:

| id | old | new |
|---|---|---|
| `metro:red` | `#e53935` | `#C43129` |
| `metro:yellow` | `#f0c400` | `#E8B300` |
| `metro:blue` | `#1e88e5` | `#0B57A4` |
| `metro:green` | `#2e7d32` | `#1B793D` |
| `metro:violet` | `#6a1b9a` | `#5B2A86` |
| `metro:pink` | `#ec6aa8` | `#D65E92` |
| `metro:magenta` | `#c2185b` | `#A8206B` |
| `metro:aqua` | `#00acc1` | `#087483` |
| `metro:orange` | `#fb8c00` | `#E06A16` |
| `metro:rapid` | `#8d6e63` | `#7F6359` |

In `src/data/network.ts:93` replace `BUS_PALETTE`:

```ts
const BUS_PALETTE = BUS_BASES.map((p) => p.light);
```

with `import { BUS_BASES } from "@/lib/route-palette";` at the top. At `network.ts:107`, replace the `"#607d8b"` fallback with `BUS_BASES[0].light`.

In `scripts/ingest-gtfs.mjs`, update the colour values it emits so a re-ingest does not revert `metro-lines.json`.

- [ ] **Step 6: Run the full suite**

```bash
npx vitest run
```

Expected: all pass. The router tests exercise `network.ts`, so this also proves the data edit did not break parsing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/route-palette.ts tests/route-palette.test.ts src/data scripts/ingest-gtfs.mjs
git commit -m "feat: replace Material/Tailwind route hues with designed transit palette"
```

---

## Task 5: ProvenanceBadge v2

Implements spec §3.2, §5.2. The most-repeated element in the product.

**Files:**
- Create: `tests/provenance-form.test.ts`
- Modify: `src/lib/provenance.ts`, `src/components/ProvenanceBadge.tsx`

**Interfaces:**
- Consumes: the `.hatch` class and colour utilities (Task 3).
- Produces: `ProvenanceMeta` gains `form: "filled" | "outline" | "hollow" | "hatched"`. `ProvenanceBadge`'s public props are **unchanged** (`provenance`, `suffix`, `title`, `className`), so no call site changes.

- [ ] **Step 1: Write the failing test**

Create `tests/provenance-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PROVENANCE_META } from "@/lib/provenance";
import type { Provenance } from "@/lib/types";

const STATES: Provenance[] = ["LIVE", "SCHEDULED", "STALE", "DEMO"];

describe("provenance is distinguishable without colour", () => {
  it("gives every state a form", () => {
    for (const state of STATES) {
      expect(PROVENANCE_META[state].form).toBeDefined();
    }
  });

  it("gives every state a DIFFERENT form", () => {
    const forms = STATES.map((s) => PROVENANCE_META[s].form);
    expect(new Set(forms).size).toBe(STATES.length);
  });

  it("keeps the four states and their labels intact", () => {
    for (const state of STATES) {
      expect(PROVENANCE_META[state].label).toBe(state);
      expect(PROVENANCE_META[state].hint.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/provenance-form.test.ts
```

Expected: FAIL — `form` is undefined.

- [ ] **Step 3: Extend `PROVENANCE_META` in `src/lib/provenance.ts`**

Add `form` to the interface and replace the four entries' class names. Keep `label` and `hint` exactly as they are.

```ts
export type ProvenanceForm = "filled" | "outline" | "hollow" | "hatched";

export interface ProvenanceMeta {
  label: string;
  hint: string;
  /** Non-colour distinguisher. Spec section 3.2 — a hard accessibility requirement. */
  form: ProvenanceForm;
  className: string;
  dotClassName: string;
}

export const PROVENANCE_META: Record<Provenance, ProvenanceMeta> = {
  LIVE: {
    label: "LIVE",
    hint: "Fresh realtime vehicle data",
    form: "filled",
    className: "border-live bg-live text-paper",
    dotClassName: "bg-paper bt-animate animate-pulse",
  },
  SCHEDULED: {
    label: "SCHEDULED",
    hint: "Timetable only - no live vehicle data available",
    form: "outline",
    className: "border-ink-2 text-ink-2",
    dotClassName: "border border-ink-2 bg-transparent",
  },
  STALE: {
    label: "STALE",
    hint: "Last live update is too old to trust fully",
    form: "hollow",
    className: "border-stale text-stale",
    dotClassName: "border-2 border-stale bg-transparent",
  },
  DEMO: {
    label: "DEMO",
    hint: "Synthetic hackathon data - not real vehicle positions",
    form: "hatched",
    className: "border-ink-2 text-ink-2 hatch",
    dotClassName: "border border-ink-2 bg-transparent",
  },
};
```

- [ ] **Step 4: Update `ProvenanceBadge.tsx`**

Change only the wrapper classes — rectangular, Micro type, no pill:

```tsx
className={`type-micro inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 ${meta.className} ${className}`}
```

and the dot to `className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`}`. Remove `normal-case` from the suffix span and give it `class="lowercase tracking-normal"` so the suffix stays readable under the uppercase Micro role.

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npx vitest run tests/provenance-form.test.ts && npx vitest run
```

Expected: PASS, and the whole suite stays green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/provenance.ts src/components/ProvenanceBadge.tsx tests/provenance-form.test.ts
git commit -m "feat: redesign provenance badges with non-colour form distinctions"
```

---

## Task 6: RouteBar

Implements spec §5.1. The signature component.

**Files:**
- Create: `src/lib/routebar.ts`, `src/components/RouteBar.tsx`, `tests/routebar.test.ts`

**Interfaces:**
- Consumes: `Leg` from `@/lib/types`; `resolveOnBase`, `needsKeyline` (Task 4).
- Produces:
  - `routeBarSegments(legs: Leg[]): Segment[]` where `Segment = { kind: "transit" | "walk"; percent: number; color: string | null; label: string | null }`
  - `<RouteBar legs={...} />` — used by Task 11 (`RouteCard`) and Task 13 (`/go`).

- [ ] **Step 1: Write the failing test**

Create `tests/routebar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { routeBarSegments } from "@/lib/routebar";
import type { Leg } from "@/lib/types";

function leg(mode: Leg["mode"], durationMinutes: number, extra: Partial<Leg> = {}): Leg {
  return {
    mode,
    from: { id: "a", name: "A", lat: 0, lon: 0 },
    to: { id: "b", name: "B", lat: 0, lon: 0 },
    intermediateStops: [],
    departAt: new Date(0).toISOString(),
    arriveAt: new Date(0).toISOString(),
    durationMinutes,
    polyline: [],
    provenance: "DEMO",
    ...extra,
  };
}

describe("routeBarSegments", () => {
  it("returns one segment per leg", () => {
    const segments = routeBarSegments([leg("WALK", 5), leg("BUS", 20)]);
    expect(segments).toHaveLength(2);
  });

  it("sizes segments in proportion to duration", () => {
    const segments = routeBarSegments([leg("WALK", 10), leg("BUS", 30)]);
    expect(segments[0].percent).toBeCloseTo(25, 5);
    expect(segments[1].percent).toBeCloseTo(75, 5);
  });

  it("always totals 100 percent", () => {
    const segments = routeBarSegments([leg("WALK", 3), leg("BUS", 7), leg("SUBWAY", 11)]);
    const total = segments.reduce((a, s) => a + s.percent, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("marks walk legs as walk and gives them no colour", () => {
    const [segment] = routeBarSegments([leg("WALK", 5)]);
    expect(segment.kind).toBe("walk");
    expect(segment.color).toBeNull();
  });

  it("carries the leg route colour through for transit legs", () => {
    const [segment] = routeBarSegments([
      leg("SUBWAY", 20, { routeColor: "#0B57A4", routeNumber: "YEL" }),
    ]);
    expect(segment.kind).toBe("transit");
    expect(segment.color).toBe("#0B57A4");
  });

  it("omits the label on segments too narrow to hold one", () => {
    const [narrow, wide] = routeBarSegments([
      leg("BUS", 1, { routeNumber: "764" }),
      leg("SUBWAY", 99, { routeNumber: "YEL" }),
    ]);
    expect(narrow.label).toBeNull();
    expect(wide.label).toBe("YEL");
  });

  it("survives an empty journey without dividing by zero", () => {
    expect(routeBarSegments([])).toEqual([]);
  });

  it("survives zero-duration legs without producing NaN", () => {
    const segments = routeBarSegments([leg("WALK", 0), leg("BUS", 0)]);
    for (const s of segments) expect(Number.isFinite(s.percent)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/routebar.test.ts
```

Expected: FAIL — cannot resolve `@/lib/routebar`.

- [ ] **Step 3: Implement `src/lib/routebar.ts`**

```ts
/**
 * Segment maths for the RouteBar (spec section 5.1).
 *
 * Kept as a pure function so the proportions are unit-testable in the node
 * environment; the component is a thin renderer over this.
 */
import type { Leg } from "./types";

/** Below this share of the bar a label cannot be read, so it is dropped. */
const MIN_LABEL_PERCENT = 12;

export interface Segment {
  kind: "transit" | "walk";
  percent: number;
  color: string | null;
  label: string | null;
}

export function routeBarSegments(legs: Leg[]): Segment[] {
  if (legs.length === 0) return [];

  const durations = legs.map((l) => Math.max(0, l.durationMinutes));
  const total = durations.reduce((a, b) => a + b, 0);
  // An all-zero itinerary is degenerate but must not produce NaN widths.
  const shares =
    total > 0
      ? durations.map((d) => (d / total) * 100)
      : durations.map(() => 100 / legs.length);

  return legs.map((leg, i) => {
    const percent = shares[i];
    const isWalk = leg.mode === "WALK";
    const label = leg.routeNumber ?? null;
    return {
      kind: isWalk ? "walk" : "transit",
      percent,
      color: isWalk ? null : (leg.routeColor ?? null),
      label: !isWalk && label && percent >= MIN_LABEL_PERCENT ? label : null,
    };
  });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run tests/routebar.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implement `src/components/RouteBar.tsx`**

```tsx
"use client";

import { needsKeyline, resolveOnBase } from "@/lib/route-palette";
import { routeBarSegments } from "@/lib/routebar";
import type { Leg } from "@/lib/types";

/**
 * A journey rendered as a miniature line diagram: segment widths are leg
 * durations, fills are the real route colours. The shape of a trip is legible
 * before any text is read.
 *
 * Theme note: onBase and the keyline are resolved against the LIGHT theme
 * because leg.routeColor carries the light base from the network data. Dark
 * mode swaps the ground, not the route colour, and every light base already
 * clears 4.5:1 for its label (tests/route-palette.test.ts).
 */
export default function RouteBar({
  legs,
  className = "",
}: {
  legs: Leg[];
  className?: string;
}) {
  const segments = routeBarSegments(legs);
  if (segments.length === 0) return null;

  return (
    <div
      className={`flex h-6 w-full overflow-hidden ${className}`}
      role="img"
      aria-label={legs
        .map((l) =>
          l.mode === "WALK"
            ? `walk ${Math.round(l.durationMinutes)} minutes`
            : `${l.routeNumber ?? l.mode} ${Math.round(l.durationMinutes)} minutes`,
        )
        .join(", then ")}
    >
      {segments.map((segment, i) => {
        if (segment.kind === "walk") {
          return (
            <span
              key={i}
              className="hatch h-full border-r border-paper"
              style={{ width: `${segment.percent}%` }}
            />
          );
        }
        const base = segment.color ?? "#606B76";
        return (
          <span
            key={i}
            className="type-data flex h-full items-center justify-center overflow-hidden border-r border-paper text-[11px]"
            style={{
              width: `${segment.percent}%`,
              backgroundColor: base,
              color: resolveOnBase(base, "light"),
              boxShadow: needsKeyline(base, "light")
                ? "inset 0 0 0 1px var(--bt-ink)"
                : undefined,
            }}
          >
            {segment.label}
          </span>
        );
      })}
    </div>
  );
}
```

Note the `boxShadow` here is an `inset` keyline, not a drop shadow. Add `src/components/RouteBar.tsx` to the `SHADOW_EXEMPT` list in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routebar.ts src/components/RouteBar.tsx tests/routebar.test.ts
git commit -m "feat: add RouteBar line-diagram component"
```

---

## Task 7: The negative-rule ratchet

Implements spec §7, §10.1. Written as a vitest test rather than a standalone script so `npm test` enforces it with no extra wiring.

**Files:**
- Create: `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: `THEMES` (Task 2).
- Produces: the `ALLOWLIST` constant. **Every task from 8 onward removes its own files from this list as part of its definition of done.** Task 16 asserts the list is empty.

- [ ] **Step 1: Write the test with a full allowlist**

Create `tests/design-rules.test.ts`. Populate `ALLOWLIST` with every file that still violates the rules today — run the test once to get the list, then paste it in.

```ts
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
  "src/app/go/go-client.tsx",
  "src/app/about/page.tsx",
  "src/app/layout.tsx",
  "src/components/PlaceInput.tsx",
  "src/components/RouteCard.tsx",
  "src/components/JourneyTimeline.tsx",
  "src/components/LangToggle.tsx",
  "src/components/MapView.tsx",
];

/** RouteBar uses an inset keyline, which is not a drop shadow. */
const SHADOW_EXEMPT = ["src/components/RouteBar.tsx"];

const RULES: { name: string; pattern: RegExp; exempt?: string[] }[] = [
  { name: "no shadow utilities", pattern: /\bshadow-(sm|md|lg|xl|2xl|none|\[)/ },
  { name: "no box-shadow in CSS", pattern: /box-shadow\s*:/, exempt: SHADOW_EXEMPT },
  { name: "no large radii", pattern: /\brounded-(lg|xl|2xl|3xl)\b/ },
  { name: "no banned palette", pattern: /\b(bg|text|border|ring|from|to|via)-(blue|indigo|violet|sky)-\d{2,3}\b/ },
  { name: "no gradients", pattern: /(linear|radial)-gradient/, exempt: ["src/app/globals.css"] },
  { name: "no emoji", pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
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

describe.each(RULES)("design rule: $name", ({ pattern, exempt = [] }) => {
  it("is not violated outside the allowlist", () => {
    const offenders = FILES.filter(
      (f) =>
        !ALLOWLIST.includes(f) &&
        !exempt.includes(f) &&
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
```

- [ ] **Step 2: Run it and reconcile the allowlist**

```bash
npx vitest run tests/design-rules.test.ts
```

If any file outside the allowlist is reported, add it. If `allowlist hygiene` reports a missing file, remove it. Iterate until green. **Do not** relax a rule pattern to make it pass.

- [ ] **Step 3: Run the full suite**

```bash
npx vitest run
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add tests/design-rules.test.ts
git commit -m "test: add negative-rule ratchet with migration allowlist"
```

---

## Task 8: App shell, wordmark, favicon and manifest

Implements spec §5.5, §6 (shell).

**Files:**
- Create: `src/components/Wordmark.tsx`
- Modify: `src/app/layout.tsx`, `src/app/icon.svg`, `src/app/manifest.ts`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: type roles and colour utilities (Task 3).
- Produces: `<Wordmark />`, used by `layout.tsx` and `/go`.

- [ ] **Step 1: Create `src/components/Wordmark.tsx`**

```tsx
/**
 * BharaTransit lockup. The shared T is the join between the two words and the
 * one place saffron appears in the shell (spec section 3.1) — drawn tall, like
 * a platform pole.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`type-display text-[17px] tracking-tight ${className}`}>
      <span className="text-ink">Bhara</span>
      <span className="text-saffron">T</span>
      <span className="text-ink">ransit</span>
    </span>
  );
}
```

- [ ] **Step 2: Rewrite the shell in `layout.tsx`**

Replace the `<body>` contents. Keep the font variables from Task 3 on `<html>`, and keep every legal disclaimer in the DOM at all breakpoints.

```tsx
<body className="bg-paper type-body text-ink antialiased flex min-h-screen flex-col">
  <div aria-hidden className="h-[3px] bg-saffron" />
  <header className="border-b border-rule bg-surface">
    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
      <Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
        <Wordmark />
      </Link>
      <p className="type-micro text-ink-3">
        Delhi pilot ·{" "}
        <Link href="/about" className="underline hover:text-ink">
          How it&apos;s built
        </Link>
      </p>
    </div>
  </header>

  <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

  <footer className="border-t border-rule bg-surface">
    <details className="mx-auto max-w-6xl px-4 py-3 sm:open" open>
      <summary className="type-micro cursor-pointer text-ink-3 sm:hidden">
        Disclaimers and data sources
      </summary>
      <div className="space-y-1 py-2 text-xs text-ink-3">
        {/* keep the three existing paragraphs verbatim, swapping
            text-violet-700 on the DEMO word for text-ink-2 */}
      </div>
    </details>
  </footer>
</body>
```

Update `metadata.title` to `"BharaTransit — Delhi pilot"` and `viewport.themeColor` to `[{ media: "(prefers-color-scheme: light)", color: "#F5F3EF" }, { media: "(prefers-color-scheme: dark)", color: "#10151A" }]`.

- [ ] **Step 3: Redraw `src/app/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#131A22"/>
  <rect x="14" y="14" width="36" height="7" fill="#DA601A"/>
  <rect x="28.5" y="14" width="7" height="36" fill="#DA601A"/>
</svg>
```

- [ ] **Step 4: Update `manifest.ts`**

`name: "BharaTransit - Delhi pilot"`, `short_name: "BharaTransit"`, `background_color: "#F5F3EF"`, `theme_color: "#131A22"`.

- [ ] **Step 5: Remove `src/app/layout.tsx` from `ALLOWLIST`**

- [ ] **Step 6: Verify**

```bash
npx vitest run && npx next build
```

Expected: green, build succeeds. Then load `/` in both colour schemes and confirm the header, saffron rule and footer disclosure render, and the tab icon shows the T.

- [ ] **Step 7: Commit**

```bash
git add src/components/Wordmark.tsx src/app/layout.tsx src/app/icon.svg src/app/manifest.ts tests/design-rules.test.ts
git commit -m "feat: rebuild app shell with wordmark, saffron rule and dark-aware manifest"
```

---

## Task 9: PlaceInput restyle and the connected From/To control

Implements spec §5.4.

**Files:**
- Modify: `src/components/PlaceInput.tsx`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: colour utilities, type roles.
- Produces: `PlaceInput` gains `position?: "top" | "bottom" | "solo"` (default `"solo"`) so the home page can join two of them into one block. `iconColor` is **removed** — the bullet colour is now derived from `position`. Task 10 must pass `position` instead of `iconColor`.

- [ ] **Step 1: Change the props**

Replace `iconColor?: string` with `position?: "top" | "bottom" | "solo"`. Derive the bullet:

```tsx
const bullet =
  position === "top"
    ? "border-2 border-ink bg-transparent"
    : position === "bottom"
      ? "bg-ink"
      : "bg-ink-3";
```

An origin is a hollow bullet and a destination is filled — the metro-map convention, and it means the two fields differ without either carrying a hue.

- [ ] **Step 2: Restyle the field**

Replace the field wrapper class:

```tsx
className={`flex items-center gap-3 border-rule bg-surface px-3 py-3 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-saffron ${
  position === "top" ? "border-x border-t" : position === "bottom" ? "border" : "border"
}`}
```

Replace `placeholder:text-slate-400` with `placeholder:text-ink-3`, and the clear button's `text-slate-400 hover:text-slate-700 focus-visible:outline-blue-600` with `text-ink-3 hover:text-ink focus-visible:outline-saffron`.

- [ ] **Step 3: Restyle the dropdown**

On the dropdown container replace `rounded-xl border border-slate-200 bg-white shadow-lg` with `border border-rule bg-surface`. On the "Popular places" heading use `type-micro text-ink-3`. On the active option replace `bg-blue-50` with `bg-paper`, and add a `border-l-2 border-saffron` marker so the active row is identifiable without colour. Replace the detail span's `text-slate-400` with `text-ink-3` and give it `type-micro`.

- [ ] **Step 4: Remove `src/components/PlaceInput.tsx` from `ALLOWLIST`**

- [ ] **Step 5: Verify**

```bash
npx vitest run && npx next build
```

Expected: green. `page.tsx` still passes `iconColor`, which TypeScript now rejects — that is expected and is fixed in Task 10. If `next build` fails on that, proceed to Task 10 and verify at its end instead.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlaceInput.tsx tests/design-rules.test.ts
git commit -m "feat: restyle PlaceInput with metro-map bullets and joined positions"
```

---

## Task 10: Home page restructure

Implements spec §6 (`/`). Deletes the four-card grid — the canonical slop layout.

**Files:**
- Modify: `src/app/page.tsx`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: `PlaceInput` with `position` (Task 9), `ProvenanceBadge` (Task 5).
- Produces: nothing downstream.

- [ ] **Step 1: Rebuild the hero**

Replace the section wrapper `rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10` with `border border-rule bg-surface p-5 sm:p-8`. Set the headline to `type-display text-3xl sm:text-5xl` and drop the `text-orange-600` span — the second half of the headline is now plain ink, since saffron is reserved.

- [ ] **Step 2: Join the two inputs**

Replace the `relative space-y-2` wrapper and the absolutely-positioned swap button with:

```tsx
<div className="relative">
  <PlaceInput id="from" label="From" placeholder="Start point — e.g. Munirka"
    value={from} onSelect={setFrom} position="top" />
  <PlaceInput id="to" label="To" placeholder="Destination — e.g. Connaught Place"
    value={to} onSelect={setTo} position="bottom" />
  <button
    type="button"
    aria-label="Swap start and destination"
    onClick={() => { setFrom(to); setTo(from); }}
    className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-rule bg-surface text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
  >
    {/* keep the existing swap svg */}
  </button>
</div>
```

The button is no longer `hidden sm:flex`, so swapping works on mobile.

- [ ] **Step 3: Restyle the submit and the chips**

Submit becomes ink, not blue:

```tsx
className="type-display mt-3 w-full rounded-[2px] bg-ink px-6 py-4 text-base text-paper transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
```

Demo chips become square: replace `rounded-full border border-slate-200 bg-slate-50 ... hover:border-blue-300 hover:bg-blue-50` with `rounded-[2px] border border-rule bg-paper text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-saffron`. The "Try a demo journey" heading becomes `type-micro text-ink-3`.

- [ ] **Step 4: Replace the four-card trust grid with a legend strip**

Delete the `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` block entirely and replace with:

```tsx
<section aria-labelledby="trust-heading" className="border border-rule bg-surface">
  <h2 id="trust-heading" className="type-micro border-b border-rule px-4 py-2 text-ink-3">
    Every arrival tells you how much to trust it
  </h2>
  <dl className="divide-y divide-rule sm:flex sm:divide-x sm:divide-y-0">
    {([
      ["LIVE", "Fresh GPS data, updated seconds ago."],
      ["SCHEDULED", "Timetable only — no live vehicle data exists."],
      ["STALE", "Last live update is too old to trust fully."],
      ["DEMO", "Synthetic hackathon data used in this prototype."],
    ] as const).map(([state, desc]) => (
      <div key={state} className="flex items-center gap-3 px-4 py-3 sm:flex-1 sm:flex-col sm:items-start">
        <dt><ProvenanceBadge provenance={state} /></dt>
        <dd className="text-xs text-ink-3">{desc}</dd>
      </div>
    ))}
  </dl>
</section>
```

- [ ] **Step 5: Restyle the natural-language panel**

On the `<details>` replace `rounded-xl border border-slate-200 bg-slate-50 p-4 open:bg-white` with `border border-rule bg-paper p-4`. Replace the emerald dot with a `h-2 w-2 bg-saffron` square. The textarea loses `rounded-lg ... focus:border-blue-500 focus:ring-2 focus:ring-blue-100` and gains `border border-rule bg-surface focus:outline-2 focus:outline-offset-[-2px] focus:outline-saffron`. The submit button becomes `bg-ink text-paper rounded-[2px]`.

- [ ] **Step 6: Remove `src/app/page.tsx` from `ALLOWLIST`**

- [ ] **Step 7: Verify**

```bash
npx vitest run && npx next build
```

Expected: green and building — this also clears the `iconColor` type error from Task 9. Then load `/` at 375px and 1280px in both schemes; confirm the swap button works on mobile and the legend strip reads as one horizontal band on desktop.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx tests/design-rules.test.ts
git commit -m "feat: restructure home with joined From/To and trust legend strip"
```

---

## Task 11: RouteCard and JourneyTimeline

Implements spec §5.1 (adoption), §5.3.

**Files:**
- Modify: `src/components/RouteCard.tsx`, `src/components/JourneyTimeline.tsx`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: `RouteBar` (Task 6), `ProvenanceBadge` (Task 5), `resolveOnBase` (Task 4).
- Produces: no API change to either component.

- [ ] **Step 1: Rebuild `RouteCard`**

Replace `LABEL_STYLES` — labels are no longer four different hues:

```ts
const LABEL_STYLES: Record<string, string> = {
  RECOMMENDED: "bg-ink text-paper",
  FASTEST: "border border-ink text-ink",
  CHEAPEST: "border border-ink text-ink",
  ALTERNATIVE: "border border-rule text-ink-3",
};
```

Replace the button wrapper class:

```tsx
className={`bt-animate block w-full border-l-[3px] bg-surface p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
  selected
    ? "border-l-saffron border-y border-r border-y-ink border-r-ink"
    : "border-l-transparent border-y border-r border-rule hover:border-l-ink-3"
}`}
```

Set the duration and fare to `type-data` (`text-2xl` and `text-lg`), the transfer/walk summary to `type-micro text-ink-3`, and the trailing leg description to `text-xs text-ink-3`.

Replace the entire `journey.legs.map(...)` pill row with:

```tsx
<RouteBar legs={journey.legs} className="mt-3" />
```

Replace the delay chip's `border-red-200 bg-red-50 text-red-700` with `type-micro border border-stale text-stale`.

- [ ] **Step 2: Rebuild `JourneyTimeline`**

Replace the `accent` fallback `"#2563eb"` with `"#606B76"` and the walk accent `"#64748b"` with `"var(--bt-ink-3)"`. Replace the bullet span:

```tsx
<span
  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
  style={{
    backgroundColor: isTransit ? accent : "transparent",
    color: isTransit ? resolveOnBase(accent, "light") : "var(--bt-ink-2)",
    boxShadow: isTransit ? undefined : "inset 0 0 0 2px var(--bt-ink-3)",
  }}
>
```

Replace the connector `w-px flex-1 bg-slate-200` with `w-[3px] flex-1` and set its `backgroundColor` to the leg's `accent` so the spine carries the route colour. Replace every `text-slate-*` with the matching `text-ink-*`, and add `src/components/JourneyTimeline.tsx` to `SHADOW_EXEMPT` (its bullets use an inset ring).

- [ ] **Step 3: Remove both files from `ALLOWLIST`**

- [ ] **Step 4: Verify**

```bash
npx vitest run && npx next build
```

Then open `/plan?from=munirka&to=cp` (use a demo chip from `/` to get valid ids) and confirm the `RouteBar` proportions match the leg durations and the timeline spine takes the route colour.

- [ ] **Step 5: Commit**

```bash
git add src/components/RouteCard.tsx src/components/JourneyTimeline.tsx tests/design-rules.test.ts
git commit -m "feat: adopt RouteBar in cards and give the timeline a route-coloured spine"
```

---

## Task 12: Bottom sheet and the `/plan` layout

Implements spec §6 (`/plan`). The largest single piece of work.

**Files:**
- Create: `src/components/BottomSheet.tsx`
- Modify: `src/app/plan/plan-client.tsx`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: colour utilities, `.bt-animate`.
- Produces: `<BottomSheet snap={...} onSnapChange={...}>{children}</BottomSheet>` where `snap: "peek" | "half" | "full"`.

- [ ] **Step 1: Create `src/components/BottomSheet.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";

export type Snap = "peek" | "half" | "full";

const HEIGHTS: Record<Snap, string> = {
  peek: "6rem",
  half: "50vh",
  full: "calc(100vh - 3rem)",
};

/**
 * Mobile results sheet for /plan (spec section 6). Rendered only below the lg
 * breakpoint; the desktop layout uses a two-column grid instead.
 *
 * The content stays in the DOM at every snap point so the route list remains
 * reachable in DOM order for screen readers even at peek (spec section 9).
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
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Escape collapses rather than closes; the sheet has no closed state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && snap === "full") onSnapChange("half");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snap, onSnapChange]);

  const next: Record<Snap, Snap> = { peek: "half", half: "full", full: "peek" };

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className="bt-animate fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-rule bg-surface transition-[height] duration-200 lg:hidden"
      style={{ height: HEIGHTS[snap] }}
    >
      <button
        type="button"
        onClick={() => onSnapChange(next[snap])}
        aria-label={`Expand ${label}`}
        aria-expanded={snap !== "peek"}
        className="flex shrink-0 items-center justify-center py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-saffron"
      >
        <span aria-hidden className="h-1 w-10 bg-ink-3" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restructure `plan-client.tsx`**

Add `const [snap, setSnap] = useState<Snap>("half");`. Replace the outer `<div className="space-y-5">` with a layout that splits at `lg`:

```tsx
<div className="lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-5">
  {/* toolbar + notes + cards: full-width on mobile inside the sheet,
      left column on desktop */}
</div>
```

On mobile, render the map full-bleed (`fixed inset-x-0 top-12 bottom-0 lg:static`) and put the toolbar, notes, and `RouteCard` list inside `<BottomSheet snap={snap} onSnapChange={setSnap} label="Route options">`. On desktop render the same content in the left column and the map in the right column with `lg:sticky lg:top-16`.

Keep `MapView` mounted exactly once — render it in a single place and reposition it with classes, not by conditionally mounting two copies, or the MapLibre instance is destroyed and rebuilt on every breakpoint change.

- [ ] **Step 3: Restyle the toolbar and notices**

`&larr; New search` and `Reset demo` / `Simulate delay` become `rounded-[2px] border border-rule bg-surface px-3 py-2 type-micro text-ink hover:bg-paper focus-visible:outline-saffron`. `Start GO navigation` becomes `bg-ink text-paper type-display rounded-[2px]`. The disruption note's `border-amber-200 bg-amber-50 text-amber-900` becomes `border border-stale bg-surface text-ink`; the "better route found" notice's emerald becomes `border border-live text-ink`. `LiveStrip`'s violet becomes `border border-rule bg-paper text-ink-2` with a `hatch` background, matching the DEMO treatment.

- [ ] **Step 4: Remove `src/app/plan/plan-client.tsx` from `ALLOWLIST`**

- [ ] **Step 5: Verify**

```bash
npx vitest run && npx next build
```

Then at 375px: confirm the sheet snaps peek → half → full, the top result's `RouteBar` is visible at peek, Escape collapses from full, and the map is not remounted when rotating to 1280px (watch for a map flash and a fresh tile fetch in the network log).

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomSheet.tsx src/app/plan/plan-client.tsx tests/design-rules.test.ts
git commit -m "feat: make /plan map-first on mobile with a three-snap results sheet"
```

---

## Task 13: GO mode

Implements spec §6 (`/go`).

**Files:**
- Modify: `src/app/go/go-client.tsx`, `tests/design-rules.test.ts`

**Interfaces:**
- Consumes: `RouteBar` (Task 6), `Wordmark` (Task 8).
- Produces: nothing downstream.

- [ ] **Step 1: Replace the progress pill with a station-tick strip**

The current bar at `go-client.tsx:354-359` is a rounded pill. Replace with one tick per journey leg boundary:

```tsx
<div className="mt-4 flex gap-1" role="progressbar"
     aria-valuenow={Math.round(arrived ? 100 : overallProgress)}
     aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
  {journey.legs.map((_, i) => {
    const legShare = 100 / journey.legs.length;
    const filled = arrived || overallProgress >= (i + 1) * legShare;
    const active = !filled && overallProgress > i * legShare;
    return (
      <span key={i}
        className={`bt-animate h-1.5 flex-1 transition-colors ${
          filled ? "bg-paper" : active ? "bg-saffron" : "bg-paper/25"
        }`} />
    );
  })}
</div>
```

This is inside the dark instruction panel, so `bg-paper` is the light-on-dark fill. `bg-paper/25` is an opacity modifier on a token colour, which the global constraints ban — replace it with a literal `bg-white/20` **only if** the panel is a fixed dark surface; otherwise add a `--bt-tick-empty` token in Task 2's file and mirror it in `globals.css`. Prefer the token.

- [ ] **Step 2: Restyle the panels**

The instruction panel's `bg-slate-900 text-white` becomes `bg-ink text-paper` — which correctly inverts in dark mode. The "Ready to go?" start button's `bg-emerald-600 hover:bg-emerald-700` becomes `bg-ink text-paper type-display`. The `Synthetic realtime data · DEMO` chip's violet becomes `type-micro border border-rule hatch text-ink-2`. The eyebrow labels (`text-emerald-400`, `text-blue-300`, `text-amber-300`, `text-orange-300` in `Instruction`) all become `text-saffron` — this is GO's permitted saffron use as the current-state indicator.

Set stops-remaining to `type-data text-4xl`, and the instruction headline to `type-display text-2xl`.

- [ ] **Step 3: Add the RouteBar to the ready screen**

Inside `JourneySummary`, add `<RouteBar legs={journey.legs} />` above the step list so the trip shape is visible before starting.

- [ ] **Step 4: Restyle remaining controls**

`Exit GO`, `Advance`, `Switch route`, the speed group and the reset button all take `rounded-[2px] border border-rule bg-surface type-micro text-ink hover:bg-paper focus-visible:outline-saffron`. The red disruption banner's `border-red-200 bg-red-50 text-red-900` becomes `border-stale bg-surface text-ink`, and its action button `bg-red-700` becomes `bg-ink text-paper`.

- [ ] **Step 5: Remove `src/app/go/go-client.tsx` from `ALLOWLIST`**

- [ ] **Step 6: Verify**

```bash
npx vitest run && npx next build
```

Then run a full GO session at 30×: confirm ticks fill in order, the active tick is saffron, Space still advances, and the panel inverts correctly in dark mode.

- [ ] **Step 7: Commit**

```bash
git add src/app/go/go-client.tsx tests/design-rules.test.ts
git commit -m "feat: restyle GO mode with station-tick progress and saffron state indicator"
```

---

## Task 14: About page

Implements spec §6 (`/about`).

**Files:**
- Modify: `src/app/about/page.tsx`, `tests/design-rules.test.ts`

- [ ] **Step 1: Restyle as a spec sheet**

Update `metadata.title` to `"How BharaTransit is built"`. Replace the back link's `text-blue-600` with `text-ink underline hover:text-saffron`. Set `h1` to `type-display text-3xl sm:text-4xl` and every `h2` to `type-micro border-b border-rule pb-1 text-ink-3`.

Replace the stat grid's cards (`rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm`) with `border border-rule bg-surface p-3 text-center`, and set the numbers to `type-data text-3xl text-ink`.

Replace the architecture `<pre>` classes `rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100` with `border border-rule bg-ink p-4 text-paper`, and update the diagram's first two lines to say `BharaTransit PWA` and `BharaTransit API`.

Replace every remaining `text-slate-600` / `text-slate-700` with `text-ink-2`, and `bg-slate-100` on the inline `<code>` with `bg-paper border border-rule`.

- [ ] **Step 2: Remove `src/app/about/page.tsx` from `ALLOWLIST`**

- [ ] **Step 3: Verify**

```bash
npx vitest run && npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx tests/design-rules.test.ts
git commit -m "feat: restyle about page as a spec sheet"
```

---

## Task 15: Map overlays

Implements spec §6 (map overlays). The basemap style URL is **not** touched.

**Files:**
- Modify: `src/components/MapView.tsx`, `tests/design-rules.test.ts`

- [ ] **Step 1: Recolour the overlay layers**

In the `map.on("load", …)` block (`MapView.tsx:140-205`) change only `paint`:

- `tb-line-walk`: keep the dash, set `"line-color": "#606B76"` and `"line-width": 2` — walk is a hairline, not a peer of transit.
- `tb-line-transit`: keep `["get", "color"]`, raise `"line-width"` to 6, set `"line-opacity": 1`.
- `tb-stop-dot`: `"circle-color": "#F5F3EF"`, `"circle-stroke-color": "#131A22"`.
- `tb-vehicle-halo`: `"circle-color": "#DA601A"`, `"circle-opacity": 0.3`.
- `tb-vehicle-dot`: `"circle-color": "#F5F3EF"`, `"circle-stroke-color": "#DA601A"`.

At `MapView.tsx:27`, change the walk leg colour from `"#64748b"` to `"#606B76"` and the transit fallback from `"#2563eb"` to `"#606B76"`.

These are literal hex values rather than tokens because MapLibre paint properties are evaluated by the GL renderer and cannot read CSS custom properties. Note this in a comment so a later reader does not "fix" it.

- [ ] **Step 2: Remove `src/components/MapView.tsx` from `ALLOWLIST`**

- [ ] **Step 3: Verify**

```bash
npx vitest run && npx next build
```

Then load `/plan` and confirm the walk hairline, the saffron vehicle markers, and that the basemap is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx tests/design-rules.test.ts
git commit -m "feat: recolour map overlays to the wayfinding palette"
```

---

## Task 16: Close the ratchet and verify

Implements spec §10 (manual verification).

**Files:**
- Modify: `src/components/LangToggle.tsx`, `tests/design-rules.test.ts`, `package.json`

- [ ] **Step 1: Restyle `LangToggle`**

The last file on the allowlist. Replace the wrapper's `rounded-lg border border-slate-200` with `border border-rule`, and the buttons' `bg-slate-900 text-white` / `bg-white text-slate-500 hover:bg-slate-50` with `bg-ink text-paper` / `bg-surface text-ink-3 hover:bg-paper`, and `focus-visible:outline-blue-600` with `focus-visible:outline-saffron`. Add `type-micro`.

- [ ] **Step 2: Empty the allowlist**

Set `const ALLOWLIST: string[] = [];` and add a test that keeps it empty:

```ts
describe("migration is complete", () => {
  it("has an empty allowlist", () => {
    expect(ALLOWLIST).toEqual([]);
  });
});
```

- [ ] **Step 3: Run everything**

```bash
npx vitest run && npx tsc --noEmit && npx next build
```

Expected: all green. Report the actual counts, not a summary.

- [ ] **Step 4: Manual verification pass (spec §10)**

Check and record the result of each:

- [ ] `/`, `/plan`, `/go`, `/about` at 375px, light and dark
- [ ] the same four at 1280px, light and dark
- [ ] keyboard-only: tab from `/` through a search, into `/plan`, select a route, into `/go`, advance a step — every focused element must show a visible saffron ring
- [ ] no request to `fonts.googleapis.com` or `fonts.gstatic.com` in the network log
- [ ] `/plan` sheet snaps correctly and the map is not remounted across the `lg` breakpoint
- [ ] the yellow metro line's `RouteBar` segment shows its keyline

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete wayfinding migration and close the design-rule ratchet"
```

---

## Self-Review

**Spec coverage.** §1 → Tasks 8–15 (each tell is deleted by a named task). §2 → Global Constraints + Task 7 ratchet. §3.1 → Tasks 2, 3. §3.2 → Task 5. §3.3 → Task 4. §3.4 → Task 3 (tokens) + Task 7 (enforcement). §4 → Task 3. §5.1 → Task 6, adopted in 11 and 13. §5.2 → Task 5. §5.3 → Task 11. §5.4 → Tasks 9, 10. §5.5 → Task 8. §6 → Tasks 8 (shell), 10 (`/`), 12 (`/plan`), 13 (`/go`), 14 (`/about`), 15 (map). §7 → Task 7. §8 → Task 1. §9 → Tasks 2, 4 (automated), 16 (manual). §10 → Tasks 2, 4, 5, 6, 7, 16. §11 → Global Constraints. **No gaps.**

**Known open decision, deliberately surfaced rather than hidden:** Task 13 Step 1 needs an empty-tick colour inside the dark instruction panel and the obvious spelling (`bg-paper/25`) violates the opacity-modifier constraint. The step names the conflict and prefers adding a token. This is a real choice the implementer must make, not a placeholder.

**Type consistency.** `resolveOnBase(base, theme)` and `needsKeyline(base, theme)` are defined in Task 4 and used with the same signature in Tasks 6 and 11. `routeBarSegments(legs)` returns `Segment[]` in Task 6 and is consumed only there. `PROVENANCE_META[state].form` is added in Task 5 and read only by its test. `Snap` is defined in Task 12 and used in the same task. `PlaceInput`'s `iconColor` → `position` swap is flagged in Task 9 and resolved in Task 10, with the intermediate build failure called out explicitly.

**Ratchet integrity.** Allowlist entries added in Task 7 are removed in Tasks 8 (`layout`), 9 (`PlaceInput`), 10 (`page`), 11 (`RouteCard`, `JourneyTimeline`), 12 (`plan-client`), 13 (`go-client`), 14 (`about`), 15 (`MapView`), 16 (`LangToggle`). All ten are accounted for.
