# Transit Bharat — 2-Minute Hackathon Video Script

**Target length:** 1:50–1:58  
**Hackathon rule:** Minute 1 = citizen demo. Minute 2 = how it was built + product choices.  
**Prototype framing:** Independent hackathon prototype. Delhi pilot. Static public transit network data where permitted; realtime vehicle positions and disruptions are synthetic unless explicitly approved.

---

## Before recording

Use **one pre-tested journey** that contains:

1. a short walk,
2. one bus leg,
3. one metro leg,
4. a transfer,
5. a visible bus moving on the map,
6. a scripted delay that triggers a better route.

Pick the final origin/destination only after the routing engine works reliably. Record the demo using the exact route labels and ETAs your deployed app returns.

**Do not improvise route numbers or ETAs in the video.** Every feature shown must work.

Recommended UI states to prepare before recording:

- Home search
- 3 route choices: Recommended / Fastest / Cheapest
- Route details
- Live/scheduled/demo provenance badges
- Moving synthetic bus
- GO mode
- Scripted disruption
- Reroute
- Architecture screen
- Codex contribution screen
- Scale-to-India screen

---

# Final Script

## 0:00–0:07 — Problem

### Screen
Open directly on Transit Bharat home. Do not show a title card first.

### Voice
> “Using an unfamiliar bus in an Indian city still requires local knowledge: Which stop? Is the bus actually coming? Where do I transfer? And when do I get off?”

---

## 0:07–0:17 — Search

### Screen
Enter the prepared Delhi origin and destination. Tap **Find route**.

### Voice
> “Transit Bharat turns that uncertainty into one guided public-transport journey.”

---

## 0:17–0:29 — Route choices

### Screen
Show three route cards.

Example structure:

- **Recommended** — 46 min · ₹35
- **Fastest** — 39 min · ₹55
- **Cheapest** — 53 min · ₹20

Each card visibly shows Walk → Bus → Metro → Walk.

### Voice
> “Instead of a list of disconnected buses and stations, I get complete door-to-door options across walking, buses and metro, with time, fare and transfers explained upfront.”

---

## 0:29–0:40 — Trustworthy realtime

### Screen
Open the recommended route. Zoom to the bus segment. Show a moving vehicle and a badge such as:

**DEMO LIVE · updated 12 sec ago**

Also show another vehicle/arrival as **SCHEDULED** or **STALE** if the UI supports it.

### Voice
> “And Transit Bharat never pretends every number is equally reliable. Every arrival tells me whether it is live, scheduled, stale, or synthetic demo data.”

---

## 0:40–0:52 — GO mode

### Screen
Tap **Start journey**.

Advance through 2–3 prepared states:

1. Walk to stop.
2. “Your bus is 2 stops away.”
3. “Get ready — your stop is next.”

### Voice
> “Once I start, the app becomes a transit navigator. It tells me only what I need to do now: where to walk, which vehicle is approaching, how many stops remain, and exactly when to get off.”

---

## 0:52–1:00 — Disruption / recovery

### Screen
Trigger the synthetic delay. Show:

**Bus delayed +11 min**  
**Better route found — arrive 9 min earlier**  
**Switch route**

Tap **Switch route**.

### Voice
> “If the journey breaks, it recovers it. This simulated delay would make me miss my connection, so Transit Bharat finds a better route before I am stranded.”

**Hard cut at 1:00.**

---

# Minute 2 — Why this is a serious public-service build

## 1:00–1:12 — Existing gap

### Screen
Show a clean comparison graphic:

**Today:** route data + live data + multiple operators → user must interpret it  
**Transit Bharat:** normalized data → one trustworthy guided journey

### Voice
> “The problem is not that Delhi has no digital transport. It already has route planning and live-bus products. The problem is trust and usability: recent users still report missing buses, incorrect ETAs and inaccurate locations.”

Do not show long app-store review screenshots. One short paraphrased evidence card is enough.

---

## 1:12–1:28 — Architecture

### Screen
Show:

**GTFS / transit data**  
+ **OpenStreetMap**  
→ **OpenTripPlanner / routing layer**  
→ **Transit Bharat API**  
→ **MapLibre web app**

Synthetic GTFS-Realtime feeds into the routing/realtime layer.

### Voice
> “The Delhi pilot uses standard transit architecture rather than hard-coded screens: GTFS-style transit data, OpenStreetMap streets, an OpenTripPlanner routing layer, MapLibre for maps, and a synthetic GTFS-Realtime feed for vehicles and disruptions.”

---

## 1:28–1:40 — Product choice that judges should remember

### Screen
Highlight the four provenance states:

- LIVE
- SCHEDULED
- STALE
- DEMO

### Voice
> “The key product decision is provenance. If a vehicle has fresh GPS data, say live. If only a timetable exists, say scheduled. If the feed is old, say stale. In this prototype, simulated data is visibly labeled demo.”

---

## 1:40–1:50 — Codex

### Screen
Show a concise build log with working artifacts, for example:

- GTFS ingestion/validation
- routing adapter
- realtime simulator
- GO state machine
- automated tests
- accessibility fixes

### Voice
> “Codex was used meaningfully across the build: feed ingestion and validation, the routing adapter, realtime simulation, the GO journey state machine, automated tests and accessibility fixes.”

Only say items you actually used Codex to build.

---

## 1:50–1:58 — National vision

### Screen
Delhi → standardized transit layer → multiple Indian cities.

Add a small text reference:

**Aug 11, 2026: Parliamentary committee recommends a National Bus Digital Grid**

### Voice
> “Delhi is the pilot. The same standards-based citizen layer can expand city by city — and it directly matches the emerging vision for a National Bus Digital Grid with interoperable public live tracking.”

### Final on-screen line
**Transit Bharat — know exactly how to get there.**

Stop. No long outro.

---

# Recording rules

- Keep total runtime below **2:00**; target 1:55.
- Record the deployed public URL, not localhost.
- Mobile viewport should be the primary demo.
- Zoom the browser enough that text is readable in the video.
- No feature may be shown unless it works.
- No government logo or design implying official endorsement.
- Put **Independent hackathon prototype** somewhere visible but unobtrusive.
- Put **Synthetic realtime data** visibly on the relevant realtime views.
- Do not claim Delhi GTFS schedules are current if the source snapshot is older.
- Keep mouse movement deliberate; cut loading/waiting time.
- Use subtitles if possible.

---

# One-sentence pitch

> **Transit Bharat is a trustworthy navigation layer for Indian public transport: plan a complete bus-and-metro journey, see where the bus is, know how fresh the information is, navigate every transfer, and recover automatically when the journey changes.**

---

# Evidence / references

- Build What Moves India — Builder Brief: https://buildwhatmovesindia.com/brief
- Build What Moves India — FAQ: https://buildwhatmovesindia.com/faq
- Delhi Open Transit Data — Documentation: https://otd.delhi.gov.in/documentation/
- One Delhi Google Play listing/reviews: https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi
- National Bus Digital Grid recommendation, PIB, 11 Aug 2026: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2297871
- GTFS overview: https://gtfs.org/documentation/overview/
- OpenTripPlanner data sources: https://docs.opentripplanner.org/en/latest/Data-Sources/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
