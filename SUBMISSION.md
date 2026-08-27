# Submission pack

Deadline: **28 August 2026, 8:00 PM IST.** No grace period. Submit hours early.

---

## 1. Project summary (233 words — limit is 250)

Paste this into the summary field as-is.

> A Delhi commuter making an ordinary trip cannot reliably answer three
> questions: which bus or metro do I take door to door, where is my bus right
> now, and what do I do when it changes? Official apps cover one operator each,
> so the citizen stitches DTC and DMRC together themselves. Worse, arrival
> times are shown with identical confidence whether they come from live GPS, a
> timetable, or a stale cache.
>
> Transit Bharat plans complete bus + metro + walk journeys on a network built
> from official Delhi Open Transit Data GTFS snapshots and DMRC lines. Search
> any stop, station or landmark — in English or Hindi — and get up to three
> labelled options with fares, transfers and walking distance. GO mode guides
> you one instruction at a time through every transfer. When a delay hits, the
> app finds a better route and explains the trade-off in plain language.
>
> The differentiator is trust. Every realtime-looking value carries exactly one
> honest badge: LIVE, SCHEDULED, STALE or DEMO. Because hackathon rules
> prohibit unapproved government feeds, all vehicle movement here is synthetic
> and labelled DEMO everywhere it appears.
>
> Stated access needs become real routing constraints, and an auto-rickshaw
> covers the first mile where the network cannot be reached on foot — half the
> fare of taking one the whole way.
>
> Ingestion is standards-based GTFS, so any Indian city publishing a feed uses
> the same pipeline.

**Count check before pasting:** paste into any word counter. If the field
rejects it, cut the final paragraph first (it costs 21 words).

---

## 2. Submission checklist

| Item | Requirement | Status |
| --- | --- | --- |
| Live public link | Opens in a browser, **no access request** | ☐ |
| Video | ≤ 2:00, citizen demo then build explanation | ☐ |
| Summary | < 250 words | ✅ above |
| Partner email | Registered email, or blank if solo | ☐ |
| Same email everywhere | Used at registration and submission | ☐ |

Mock login credentials: **not applicable** — Transit Bharat needs no account.
Say exactly that in the field rather than leaving it blank.

---

## 3. Pre-submission verification

Do all of this in a **fresh incognito window** against the deployed URL. Your
own logged-in browser will hide the exact failure a reviewer hits first.

- [ ] The URL loads with no login wall and no Netlify password prompt
- [ ] Home: focus **From** → popular places appear before typing
- [ ] Search `chandni`, `du north`, `लाजपत नगर` → all return results
- [ ] **Munirka → Connaught Place** → cards show time, fare, transfers, a
      **non-zero** walking distance, and a provenance badge
- [ ] The map draws tiles **and the coloured route line**
- [ ] **Start GO navigation** → step through to 100%, no console error
- [ ] **Simulate delay (demo)** → option marked delayed, alternative appears,
      explanation banner shows
- [ ] **Reload the page** → the delay is still applied
- [ ] **हिं** toggle → the explanation flips to Hindi
- [ ] `wheelchair user going from saket to connaught place` → less walking
      applied, access need acknowledged
- [ ] `/about` renders live network statistics
- [ ] Open the whole thing **on a phone** — that is what most reviewers use
- [ ] Throttle to Slow 3G in DevTools once; confirm it is still usable

Then the submission form itself:

- [ ] Video plays from the link **in incognito** (this is the most common
      failure — check YouTube visibility is Unlisted, not Private)
- [ ] Every link in the form opens without requesting access
- [ ] Both teammates submitted each other's registered email

---

## 4. Answering the judging criteria

Reviewers score six things. Where each is evidenced:

| Criterion | Where it shows |
| --- | --- |
| **Problem** | Video 0:00–0:12; README "The problem" |
| **Working build** | The full journey runs end to end, deployed |
| **Usability** | Suggestions before typing, one search box, one instruction at a time, EN/HI, mobile-first |
| **Product thinking** | Three options max, labels that cannot lie, auto as first mile not whole trip, access needs as constraints |
| **End-to-end thinking** | GTFS pipeline, normalized API with an OTP swap point, realtime seam, scaling section in README |
| **Honesty** | Provenance badge on every view, LIMITATIONS.md, `/about` honesty section, AI fallback reasons shown on screen |

## 5. If asked "where is the AI?"

Say this, in this order:

1. Two features use an OpenAI model: parsing plain-language constraints, and
   phrasing the delay explanation in English and Hindi.
2. It is deliberately bounded — the model handles **language**, the
   deterministic planner owns **every fact**.
3. Every number the model writes is verified against the planner's figures and
   discarded if it doesn't match.
4. That boundary is a safety decision, not a limitation. A hallucinated
   departure time is a citizen missing their last bus.

## 6. Stage 2 (if shortlisted)

The 250 get a week of mentorship and **resubmit by 7 September 2026** in the
same format, using the same email. Highest-value work for that week, in order:

1. Ingest more of the bus feed so fewer areas are auto-only.
2. Honour "arrive by" — currently parsed but not planned against.
3. Complete the Hindi interface (Bhashini).
4. Wire the OpenTripPlanner adapter at the existing boundary.
