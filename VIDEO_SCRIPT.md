# Video script — 2:00 hard limit

Rules: **max 2:00**, no grace. Minute one = demo as a citizen. Minute two =
how you built it and why. Record against the **deployed URL**, not localhost —
the URL should be visible in the address bar.

**Before you record**

- Reset the demo: open the deployed site in a **fresh incognito window**
  (clears the sessionStorage delay and the language choice).
- Set browser zoom so text is readable in a 1080p recording.
- Have the trip **Munirka → Connaught Place** ready as your main thread.
- Do a full silent dry run first. If the map or the delay misbehaves, you want
  to find that now, not at 1:58.

Word counts below assume ~150 wpm. Trim adjectives before you trim content.

---

## 0:00–0:12 · The problem (~30 words)

> **On screen:** the home page, nothing typed yet.

"I'm in Delhi and I need to get from Munirka to Connaught Place. Bus, metro,
walking — three different apps. And none of them tell me whether the arrival
time I'm looking at is real."

---

## 0:12–0:35 · Search and compare (~55 words)

> **On screen:** tap **From** → suggestions appear before typing. Type
> `munirka`, pick it. Type `connaught`, pick it. Tap **Find my route**.

"One box for the whole network — buses, metro, landmarks, in English or Hindi.
Suggestions before I even type."

> **On screen:** the two route cards.

"Three clear options. Time, fare, transfers, walking. And this badge on every
one — **DEMO**. That's the point of the whole project: this app never shows me
a number without telling me how much to trust it. Live GPS, timetable, stale,
or demo data like here."

---

## 0:35–0:52 · Follow the journey (~40 words)

> **On screen:** tap the recommended card, show the timeline and moving buses.
> Then tap **Start GO navigation** and advance two or three steps.

"Pick one and I get the full journey as text and map, with buses moving in
real time — synthetic, and labelled as such. GO mode gives me one instruction
at a time. Walk here. Board. Three stops left. Get off. Change."

---

## 0:52–1:10 · The recovery moment (~45 words)

> **On screen:** go back, tap **Simulate delay (demo)**. Let the banner appear.
> Then tap the **हिं** toggle so the sentence flips to Hindi.

"Now the bus is delayed. Most apps make you start over. This one marks the
affected option, finds a better one, and explains the trade-off in plain
language — in English or Hindi. One tap and I'm switched across."

---

## 1:10–1:22 · The bit judges remember (~30 words)

> **On screen:** type into the "describe your trip" box:
> `wheelchair user going from saket to connaught place`

"And if I tell it I use a wheelchair, that's not a label — it becomes real
routing constraints. Less walking, at most one interchange, enforced by the
planner."

---

## 1:22–1:40 · How it's built (~45 words)

> **On screen:** the `/about` page.

"Real Delhi open-transit GTFS — six thousand bus stops, DMRC lines — validated
by a pipeline into a routing graph. A deterministic Dijkstra router does all
the planning. Codex wrote the ingestion, the router, the state machines and
fifty-three tests alongside me."

---

## 1:40–1:56 · Why those choices (~40 words)

> **On screen:** back on the delay banner, point at the source line under it.

"The model only handles language — parsing what I typed, phrasing that
explanation. It never invents a time or a fare, and every number it writes is
checked against the planner's own figures. A hallucinated departure time is
someone missing their last bus."

---

## 1:56–2:00 · Close (~12 words)

"Real network data. Honest labels. One journey, end to end. Thank you."

---

## If you are over time

Cut in this order — the first two lose the least:

1. The GO-mode segment (0:35–0:52) down to a single step.
2. The `/about` visit; say the same sentence over the delay screen instead.
3. The wheelchair demo — but say the sentence anyway, it is one of your
   strongest differentiators.

**Never cut:** the provenance badge explanation (0:12–0:35) or the honesty
line at 1:40. Those are two of the six judging criteria.

## Things to say exactly once, and get right

- "**Synthetic**" or "**demo data**" out loud, at least once, early. Honesty is
  a scored criterion and reviewers are listening for it.
- "**Codex**" by name, in the build section. Meaningful Codex use is a rule.
- Do **not** say "official", "government app", or "DTC app". Say
  "**independent prototype**" if you need a framing word.
