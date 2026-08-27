# BharaTransit — wayfinding design system

**Date:** 2026-08-26
**Status:** approved, ready for implementation planning
**Scope:** complete visual revamp of all four screens + app shell, plus the
product rename from *Transit Bharat* to *BharaTransit*.

---

## 1. Why

The app works and its product thesis — honest provenance on every
realtime-looking datum — is sound. Its appearance undercuts it. The current UI
is the statistical average of a million Tailwind templates, and a trust product
that looks generic reads as untrustworthy.

Audited tells, with evidence:

| # | Tell | Evidence |
|---|---|---|
| 1 | One surface recipe everywhere: `bg-slate-50` → `bg-white` → `border-slate-200` → `shadow-sm` → `rounded-2xl/3xl` | every container, all four screens |
| 2 | `blue-600` primary | `page.tsx:207`, `plan-client.tsx:326`, every link and focus ring |
| 3 | Six saturated hues, no hierarchy | emerald / amber / violet / orange / red / blue on one screen |
| 4 | No typography and no tabular numerals | `globals.css` ships `ui-sans-serif, system-ui`; durations and fares jitter as they update |
| 5 | The canonical slop layout: hero → subhead → form → four-card feature grid | `page.tsx:229` trust section |
| 6 | Brand tokens declared, never used | `--color-saffron`, `--color-indiagreen` in `globals.css` |
| 7 | Marketing shell, not an app shell; no dark mode | `layout.tsx` centered `max-w-5xl` |

What must survive the revamp:

- the provenance engine and its single-badge discipline (`lib/provenance.ts`)
- route colour already flowing from data into the UI (`RouteCard.tsx:78`)
- the `ModeIcon` set, the bilingual toggle, `focus-visible` on every control,
  and the `prefers-reduced-motion` hook

---

## 2. The governing rule

Signage systems reserve saturated colour for exactly one job: **route
identity**. Structure is black, white and rule-lines.

> **Colour is only ever one of four things: the ink scale, a route colour
> (from data), a provenance signal, or the single saffron accent. Nothing else
> gets colour.**

This is the load-bearing constraint. It resolves tells 2, 3 and 6 at the root:
there is no room for a blue primary button, because the primary button is ink.
Saffron is demoted from decorative national colour to one accent with one job.

Every subsequent decision in this document is downstream of that rule. If a
future change needs a colour that is not one of those four things, the change
is wrong, not the rule.

---

## 3. Tokens

Defined once in `src/app/globals.css` under `@theme`, as CSS custom properties
with light values on `:root` and dark values under both
`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`.

### 3.1 Ink and ground

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bt-ink` | `#131A22` | `#EDEAE3` | body text, primary button fill |
| `--bt-ink-2` | `#38434F` | `#A8B0B8` | secondary text |
| `--bt-ink-3` | `#6B7783` | `#78838E` | tertiary text, micro-labels |
| `--bt-paper` | `#F5F3EF` | `#10151A` | page ground |
| `--bt-surface` | `#FFFFFF` | `#182029` | raised sheet |
| `--bt-rule` | `#D9D5CC` | `#2A343E` | hairlines |
| `--bt-saffron` | `#F26B1D` | `#FF8A3D` | the one accent |

`--bt-paper` is a warm off-white, deliberately not `slate-50`. It reads as
printed signage rather than a dashboard and is the cheapest single change that
signals "not the default".

Saffron's three permitted uses, exhaustively: the wordmark's shared **T**, the
focus ring, and the active/current indicator in GO mode. It is never a button
fill, never a link colour, never a background.

### 3.2 Provenance signals

Today `SCHEDULED` (amber) and `STALE` (orange) are near-indistinguishable and
violet `DEMO` clashes with everything. Each state now carries meaning in its
**form** as well as its hue, so it survives greyscale, colour-blindness and a
phone screen in sunlight.

| State | Treatment | Token | Rationale |
|---|---|---|---|
| `LIVE` | filled, pulsing dot | `--bt-live: #0E8A4F` / dark `#28A96A` | the only state that earns a fill |
| `SCHEDULED` | ink outline, **no fill, no hue** | `--bt-ink-2` | absence of live data = absence of colour |
| `STALE` | hollow dot, amber | `--bt-stale: #C77700` / dark `#E09A20` | colour draining out of LIVE |
| `DEMO` | **diagonal hatch**, ink text | `--bt-ink-2` on hatch | drafting convention for "not real" |

The hatch is a CSS `repeating-linear-gradient` at 45°, 3px stripe / 3px gap, at
14% opacity of `--bt-ink`, behind the label. It must remain legible against
both grounds; the label itself sits on a solid inset so contrast is unaffected.

Because every vehicle in this prototype is `DEMO`, this badge is the single
most-repeated element in the product and the one judges will scrutinise. A
hatch is unmistakable at a glance and honest in a way a violet pill is not.

The pulse on `LIVE` uses the existing `.bt-animate` class so
`prefers-reduced-motion` disables it.

### 3.3 Route palette

**This section exists because of a finding during design.** Route colour is now
the primary structural device, which makes the route palette load-bearing — but
it is currently inherited from framework defaults:

- the ten metro lines are named for DMRC colours but painted with Material
  Design hues (`#1e88e5` Blue 600, `#e53935` Red 600, `#2e7d32` Green 800,
  `#fb8c00` Orange 600, `#6a1b9a` Purple 800, `#c2185b` Pink 700,
  `#00acc1` Cyan 600, `#8d6e63` Brown 400, `#f0c400`, `#ec6aa8`)
- `BUS_PALETTE` at `src/data/network.ts:93` is
  `["#2563eb", "#0d9488", "#b45309", "#7c3aed", "#be185d"]` — Tailwind
  blue-600 / teal-600 / amber-700 / violet-600 / pink-700, the exact palette
  section 7 bans.

Both are replaced with a designed palette derived from the real DMRC line
identities. Each route colour ships as a **pair**: `base` for the rail/bar, and
`onBase` (ink or paper) chosen so label-on-colour clears **4.5:1**. Yellow is
the forcing case — at signage saturation it cannot carry white text, so its
`onBase` is ink.

Keyed by the `metro:<colour>` id in `metro-lines.json`. The data contains
exactly these ten lines — verified against the file — so the table is
exhaustive and no fallback hue is needed for metro.

| Line id | `base` light | `base` dark | `onBase` |
|---|---|---|---|
| `metro:red` | `#D0342C` | `#E8544B` | paper |
| `metro:yellow` | `#E8B300` | `#F5C518` | ink |
| `metro:blue` | `#0B57A4` | `#3E8FD6` | paper |
| `metro:green` | `#1B7A3E` | `#33A05C` | paper |
| `metro:violet` | `#5B2A86` | `#8E5FC0` | paper |
| `metro:pink` | `#D4568C` | `#E87FAA` | ink |
| `metro:magenta` | `#A8206B` | `#CE4A93` | paper |
| `metro:aqua` | `#0A8C9E` | `#2BB4C6` | paper |
| `metro:orange` (Airport Express) | `#E06A16` | `#F58A38` | ink |
| `metro:rapid` | `#8D6E63` | `#A98A7E` | paper |

Bus corridors draw from a separate five-hue set, deliberately lower-chroma than
the metro set so bus and metro are distinguishable as *classes* before you read
a label: `#4A5D73`, `#7A5C3E`, `#3E6B5E`, `#6E4A63`, `#5C6438` (dark-mode
variants lifted roughly 18% in lightness).

Data changes required: `metro-lines.json` colour values, `BUS_PALETTE`, and the
`#607d8b` fallback at `network.ts:107`. The `scripts/ingest-gtfs.mjs` generator
must emit the new values so a re-ingest does not revert them.

### 3.4 Geometry

| Token | Value | Applies to |
|---|---|---|
| `--bt-r-0` | `0` | sheets, cards, panels, map container |
| `--bt-r-1` | `2px` | buttons, inputs, badges |
| `--bt-r-full` | `9999px` | dots and station bullets only |

**Shadows: none.** Zero `box-shadow` anywhere in the product. Separation comes
from hairline rules and paper/surface contrast. This single deletion does more
to remove the generic look than any addition in this document.

Emphasis (selected route, active leg) is a **3px route-coloured left bar**, not
a ring.

---

## 4. Typography

**Archivo** (Latin) + **Noto Sans Devanagari** (Hindi), both from Google Fonts.

Archivo is served as a true variable font — verified: the CSS response carries
`font-weight: 100 900; font-stretch: 62% 125%` in a single woff2 per subset,
with `unicode-range` subsetting. One request buys the whole weight *and* width
range. Its subsets are latin / latin-ext / vietnamese only, hence the separate
Devanagari family for `lang="hi"` content.

| Role | Width | Weight | Case | Tracking | Notes |
|---|---|---|---|---|---|
| Display | 118 | 700 | UPPER | `-0.01em` | headlines, GO instructions |
| Data | 88 | 600 | — | `0` | **`tabular-nums`** — durations, fares, counts, clock times |
| Body | 100 | 400 | — | `0` | prose |
| Micro | 100 | 600 | UPPER | `+0.08em` | 11px captions, provenance labels, field labels |

The condensed tabular Data role is how departure boards set numbers; it fixes
the jitter in tell 4 and is the reason the width axis earns its place. One font
file, two distinct visual voices.

Fallback stack, in order: `Archivo, "Noto Sans Devanagari", ui-sans-serif,
system-ui, "Segoe UI", Roboto, sans-serif`. `font-display: swap`. If the font
request fails the layout must still hold — no metric-dependent positioning.

---

## 5. Components

### 5.1 `RouteBar` (new) — the signature element

Replaces the pill row in `RouteCard.tsx`. A single horizontal stacked bar:

- one segment per leg, **width proportional to that leg's duration**
- transit segments filled with the leg's `routeColor`
- walk segments filled with the diagonal hatch in `--bt-ink-3`
- route number set in Data type inside the segment where it fits, omitted
  below a minimum segment width rather than truncated
- interchange points marked with a 2px paper-coloured gap

It is a miniature line diagram, so the *shape* of a journey is readable before
any text. This is the component that makes the product look like transit rather
than like a SaaS list, and it is the highest-value single item in this spec.

### 5.2 `ProvenanceBadge` v2

Rectangular (`--bt-r-1`), Micro type, four treatments per section 3.2. Public
API is unchanged (`provenance`, `suffix`, `title`, `className`) so no call site
needs to change. `PROVENANCE_META` in `lib/provenance.ts` gains the form
treatment alongside the existing label and hint; its four keys and their
meanings are untouched.

### 5.3 `JourneyTimeline` v2

A true metro-map spine: thick route-coloured rail per leg; hollow bullets for
pass-through stops, filled for board/alight, double-ring for interchange. The
existing constraint holds and is reaffirmed — **the timeline must remain fully
understandable with the map absent or failed**.

### 5.4 Connected From/To control

The two `PlaceInput`s become one bordered block: two rows joined by a vertical
route line, with the swap button sitting *on* the line rather than floating at
the right edge. Removes the current absolutely-positioned swap button and its
`sm:`-only visibility, so swap works on mobile for the first time.

### 5.5 Wordmark and favicon

`Bhara` **T** `ransit`, the shared **T** set tall in saffron like a platform
pole. `icon.svg` becomes that T in an ink square, replacing the current bus
glyph. Both light and dark tab contexts must read.

---

## 6. Structure

The structural changes matter as much as the visual ones; a re-skinned
marketing shell still reads as generic.

**Shell (`layout.tsx`).** The centered `max-w-5xl` marketing frame becomes an
app frame: a 48px header with a 3px saffron top rule, and the footer collapsed
to a `<details>` disclosure on mobile while staying open on desktop. The legal
disclaimers stay in the DOM at all breakpoints — they are a hackathon
requirement, not decoration.

**`/` (`page.tsx`).** Headline flush-left, Display type, uppercase. The
connected From/To control per section 5.4. **The four-card trust grid becomes a
single horizontal legend strip** — a signage legend, not feature cards. This
deletes tell 5. The natural-language `<details>` stays but is restyled as an
inset panel rather than a bordered card.

**`/plan` (`plan-client.tsx`).** Mobile: the map fills the viewport and results
live in a **bottom sheet** with three snap points (peek at roughly 96px showing
the top result's `RouteBar`, half, full). Desktop at 1024px and above: list
left, map fixed right, no sheet. The sheet is the largest single piece of work
in the revamp.

**`/go` (`go-client.tsx`).** Already the strongest screen. Full-bleed
instruction panel; stops-remaining in oversized Data type; the rounded progress
pill becomes a **station-tick strip** — one tick per stop, filled as passed.

**`/about`.** Same content, restyled as a spec sheet: hairline rules, tabular
data, monospace architecture diagram.

**Map overlays (`MapView.tsx`).** Basemap style URL is explicitly **unchanged**
(`tiles.openfreemap.org/styles/liberty`, with the positron fallback). Overlay
paint only: walk legs become a dashed ink hairline instead of solid `#64748b`;
vehicle markers take the hatch treatment; the `#3b82f6` halo and `#1d4ed8`
stroke become saffron and ink.

---

## 7. Negative rules

Enforced by a grep check wired into the test script, so they cannot creep back:

- no `shadow-*` utilities, and no `box-shadow` in CSS
- no `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`
- no `blue-*`, `indigo-*`, `violet-*`, `sky-*` Tailwind palette utilities
- no `linear-gradient` / `radial-gradient` except the provenance hatch
- no emoji in UI copy

The MapLibre stylesheet and the vendored `maplibre-gl.css` are exempt; the
check scopes to `src/**` excluding `maplibre` imports.

---

## 8. Rename

*Transit Bharat* → **BharaTransit** (capital T on the shared letter).

Files: `package.json` (`name`, `description`), `src/app/layout.tsx`,
`src/app/manifest.ts`, `src/app/about/page.tsx`, `src/app/icon.svg`,
`scripts/ingest-gtfs.mjs`, and the docs `README.md`, `SUBMISSION.md`,
`LIMITATIONS.md`, `BUILD_WITH_CODEX.md`, `DEPLOY_NETLIFY.md`,
`VIDEO_SCRIPT.md`.

Identifiers: `tb:lang` → `bt:lang`, `tb:journey` → `bt:journey`,
`.tb-animate` → `.bt-animate`. Both sides of each key change together; the only
cost is a returning user's saved language preference, which is acceptable.

**Deliberately excluded, flagged for the user rather than done silently:**

1. The `Transit_Bharat` directory name — renaming a checked-out repo root is
   out of scope for a UI revamp.
2. The word-counted summary in `SUBMISSION.md` section 1 — it is tuned to a
   250-word limit and the rename shifts the count. The rename will be applied
   but the count must be re-verified by hand before submission.

---

## 9. Accessibility

Non-negotiable, and the revamp must not regress what already works:

- every interactive element keeps a visible `focus-visible` ring; the ring
  colour becomes saffron on a 2px offset, and must clear 3:1 against both
  `--bt-paper` and `--bt-surface`
- body text clears **4.5:1**; Micro-scale labels clear **4.5:1** (not the 3:1
  large-text allowance — they are small); route labels on route colour clear
  4.5:1 via the `onBase` pairing in section 3.3
- every provenance state is distinguishable **without colour** — this is what
  the form treatments in section 3.2 buy, and it is a hard requirement, not a
  nicety
- `prefers-reduced-motion` disables the LIVE pulse, the sheet snap animation
  and the GO progress transition, via the existing `.bt-animate` hook
- the bottom sheet is keyboard-operable and focus-trapped when full, and the
  route list remains reachable in DOM order when the sheet is at peek
- `lang` continues to switch to `hi-IN` so the Devanagari face is selected

---

## 10. Testing

The 53 existing tests pass and **none reference UI copy or class names** —
verified before writing this spec — so the revamp is test-safe. They must
continue to pass untouched.

Added checks:

1. **Negative-rule grep** (section 7) as a script in `package.json`, failing
   the run on any violation.
2. **Contrast unit test** over the token table and the route palette, asserting
   every documented pair clears its stated ratio in both themes. The palette is
   data, so this is a pure function test with no DOM.
3. **Provenance form test** asserting all four states differ by a non-colour
   attribute, so the section 3.2 guarantee cannot silently regress.

Manual verification before claiming done: both themes at 375px and 1280px on
all four screens, a keyboard-only pass through plan into GO, and the
font-failure case with Google Fonts blocked.

---

## 11. Out of scope

- restyling the MapLibre basemap (explicitly declined; overlays only)
- any change to routing, fares, the provenance engine's semantics, the AI
  endpoints, or the GTFS pipeline's behaviour
- new features, new screens, and full Hindi coverage beyond today's partial
  dictionary — `LIMITATIONS.md` continues to state the limit honestly
