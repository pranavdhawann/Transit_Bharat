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
| `--bt-ink-3` | `#606B76` | `#848E98` | tertiary text, micro-labels |
| `--bt-paper` | `#F5F3EF` | `#10151A` | page ground |
| `--bt-surface` | `#FFFFFF` | `#182029` | raised sheet |
| `--bt-rule` | `#D9D5CC` | `#2A343E` | hairlines |
| `--bt-saffron` | `#DA601A` | `#FF8A3D` | the one accent |

All values above are **computed, not eyeballed**, and verified against the
targets in section 9. Worst cases: `--bt-ink-3` clears 4.91 on paper and 5.44
on surface in light, 5.51 / 4.93 in dark; `--bt-saffron` clears 3.34 / 3.70 in
light as a focus ring. The first-draft values for `--bt-ink-3` (`#6B7783`) and
`--bt-saffron` (`#F26B1D`) failed at 4.13 and 2.75 and were rejected.

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
| `LIVE` | filled, pulsing dot | `--bt-live: #0C7946` / dark `#28A96A` | the only state that earns a fill |
| `SCHEDULED` | ink outline, **no fill, no hue** | `--bt-ink-2` | absence of live data = absence of colour |
| `STALE` | hollow dot, amber | `--bt-stale: #975A00` / dark `#E09A20` | colour draining out of LIVE |
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
identities. Each route colour ships as a light/dark `base` pair.

**`onBase` is computed, never authored.** For a given base, the label colour is
whichever of ink or paper has the higher contrast against it, and that winner
must clear **4.5:1**. Authoring `onBase` by hand was tried first and produced
four wrong pairings; deriving it removes the entire error class and makes the
test in section 10 meaningful rather than decorative.

**The keyline rule.** A bar must also be visible against the ground, which is a
separate constraint from label legibility. Any route colour whose base falls
below **3:1** against the ground in either theme gets a 1px `--bt-ink` keyline
around the bar. Exactly one line triggers this: `metro:yellow`, at 1.74:1
against paper. Darkening yellow until it cleared 3:1 would turn it to mustard
and destroy the line's identity — a keyline is what printed transit maps
actually do, and it preserves the colour.

Keyed by the `metro:<colour>` id in `metro-lines.json`. The data contains
exactly these ten lines — verified against the file — so the table is
exhaustive and no fallback hue is needed for metro. Ratios below are the
computed label contrast in each theme.

| Line id | `base` light | `base` dark | on L | on D | keyline |
|---|---|---|---|---|---|
| `metro:red` | `#C43129` | `#D87772` | paper 4.96 | ink 5.67 | — |
| `metro:yellow` | `#E8B300` | `#F0CD57` | ink 9.08 | ink 11.33 | **yes** |
| `metro:blue` | `#0B57A4` | `#5E90C3` | paper 6.50 | ink 5.22 | — |
| `metro:green` | `#1B793D` | `#69A77F` | paper 4.92 | ink 6.20 | — |
| `metro:violet` | `#5B2A86` | `#9B7CB5` | paper 8.94 | ink 4.96 | — |
| `metro:pink` | `#D65E92` | `#D789AB` | ink 4.90 | ink 6.72 | — |
| `metro:magenta` | `#A8206B` | `#C66C9D` | paper 6.14 | ink 5.03 | — |
| `metro:aqua` | `#087483` | `#5CA3AD` | paper 4.94 | ink 6.09 | — |
| `metro:orange` (Airport Express) | `#E06A16` | `#E19561` | ink 5.21 | ink 7.24 | — |
| `metro:rapid` | `#7F6359` | `#AB9891` | paper 4.95 | ink 6.37 | — |

Bus corridors draw from a separate five-hue set, deliberately lower-chroma than
the metro set so bus and metro are distinguishable as *classes* before you read
a label. All five clear 4.5:1 in both themes and none needs a keyline.

| Slot | `base` light | `base` dark | on L | on D |
|---|---|---|---|---|
| `bus:1` | `#4A5D73` | `#8894A3` | paper 6.10 | ink 5.68 |
| `bus:2` | `#7A5C3E` | `#A79380` | paper 5.53 | ink 5.95 |
| `bus:3` | `#3E6B5E` | `#809D95` | paper 5.46 | ink 5.99 |
| `bus:4` | `#6E4A63` | `#9F8898` | paper 6.71 | ink 5.38 |
| `bus:5` | `#5C6438` | `#93997C` | paper 5.68 | ink 5.91 |

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
system-ui, "Segoe UI", Roboto, sans-serif`. `font-display: swap`.

Both families load through `next/font/google`, which downloads and **self-hosts
them at build time**. There is therefore no runtime request to Google's servers
— an improvement on the original plan of a `<link>` to `fonts.googleapis.com`:
it removes a third-party runtime dependency, a privacy leak, and a render-block,
and it means the "fonts blocked" failure mode cannot occur in production. The
layout must still not depend on font metrics.

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
  4.5:1 via the computed `onBase` rule in section 3.3
- route bars, as graphical objects, clear **3:1** against the ground, or carry
  the keyline from section 3.3 when they cannot
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
   every documented pair clears its stated ratio in both themes, that each
   computed `onBase` clears 4.5:1, and that any base below 3:1 against the
   ground is flagged as needing a keyline. The palette is data, so this is a
   pure function test with no DOM. Every value in sections 3.1–3.3 was
   generated by this arithmetic before being written down, so the test is
   expected to pass on the authored palette rather than discover it.
3. **Provenance form test** asserting all four states differ by a non-colour
   attribute, so the section 3.2 guarantee cannot silently regress.

Manual verification before claiming done: both themes at 375px and 1280px on
all four screens, and a keyboard-only pass through plan into GO. The
"fonts blocked" case is no longer reachable now that `next/font` self-hosts
(section 4), so it is replaced by confirming no request to
`fonts.googleapis.com` or `fonts.gstatic.com` appears in the network log.

---

## 11. Out of scope

- restyling the MapLibre basemap (explicitly declined; overlays only)
- any change to routing, fares, the provenance engine's semantics, the AI
  endpoints, or the GTFS pipeline's behaviour
- new features, new screens, and full Hindi coverage beyond today's partial
  dictionary — `LIMITATIONS.md` continues to state the limit honestly
