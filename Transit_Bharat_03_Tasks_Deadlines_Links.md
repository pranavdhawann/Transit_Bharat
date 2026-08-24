# Transit Bharat — Things To Do, Deadlines & Links

**Today:** Sunday, 23 August 2026  
**Official submission deadline:** **Friday, 28 August 2026 — 8:00 PM IST**  
**US Eastern equivalent:** **Friday, 28 August 2026 — 10:30 AM EDT**  
**No grace period.**

Official rule: the prototype must be public in a browser, the video must be **≤2 minutes**, the summary must be **<250 words**, and Codex must be meaningfully involved.

---

# 0. Non-negotiables

- [ ] Build **Delhi pilot only** for the submission.
- [ ] Main journey works from start to finish.
- [ ] Public browser URL opens without requesting access.
- [ ] No dependency on an unapproved live government system.
- [ ] Realtime/demo vehicle data is visibly labeled synthetic.
- [ ] No real Aadhaar/PAN/OTP/payment/personal data.
- [ ] No official government logo/branding implying endorsement.
- [ ] Every feature shown in video actually works.
- [ ] Codex involvement is documented truthfully.
- [ ] Project summary stays under 250 words.
- [ ] Video stays under 2:00.
- [ ] All submission links tested in incognito/private browsing.
- [ ] Submit several hours before the official cutoff.

---

# 1. Deadline calendar

## Sunday, Aug 23 — Product lock + skeleton

**Outcome by end of day:** No more idea changes.

- [ ] Create repo.
- [ ] Write one-sentence problem statement.
- [ ] Write `LIMITATIONS.md`.
- [ ] Write `DATA_SOURCES.md`.
- [ ] Create `BUILD_WITH_CODEX.md`.
- [ ] Download/review Delhi static bus data.
- [ ] Download/review DMRC static data.
- [ ] Review Delhi OTD terms.
- [ ] Set up Next.js + TypeScript + Tailwind.
- [ ] Set up MapLibre.
- [ ] Create home/search screen.
- [ ] Create static route-results UI using mock JSON.
- [ ] Decide exact provenance labels:
  - `LIVE`
  - `SCHEDULED`
  - `STALE`
  - `DEMO`
- [ ] Decide personal cutoff: **Aug 28, 6:00 AM EDT / 3:30 PM IST** or earlier.

### Stop condition
If you are still redesigning the concept tonight, stop. The concept is locked.

---

## Monday, Aug 24 — Data + routing

**Outcome:** Search returns a real/credible multimodal itinerary.

- [ ] Parse bus GTFS-style data.
- [ ] Parse DMRC GTFS-style data.
- [ ] Build local place index from stops/stations + curated landmarks.
- [ ] Download/crop OSM data for Delhi/Northern Zone.
- [ ] Set up OpenTripPlanner.
- [ ] Build routing-adapter endpoint.
- [ ] Normalize OTP response into Transit Bharat journey schema.
- [ ] Render route polyline.
- [ ] Render boarding/alighting stops.
- [ ] Show at least two route options.
- [ ] Add automated test for one known demo journey.

### Hard fallback at end of day
If OTP is not reliably routing:
- [ ] Freeze one deterministic journey using real stop coordinates/network data.
- [ ] Continue building the citizen experience.
- [ ] Do not lose Aug 25 fighting infrastructure.

---

## Tuesday, Aug 25 — Bus tracking + journey detail

**Outcome:** The app visibly answers “where is my bus?”

- [ ] Choose final demo journey.
- [ ] Build synthetic bus-position generator.
- [ ] Render moving buses on route.
- [ ] Add vehicle selection.
- [ ] Show next stop.
- [ ] Show last update timestamp.
- [ ] Implement `DEMO` provenance.
- [ ] Implement `SCHEDULED` state when no vehicle exists.
- [ ] Implement `STALE` visual state.
- [ ] Build complete vertical journey timeline.
- [ ] Add fare estimate only if defensible; otherwise label mock/estimated.
- [ ] Mobile test at 360–390 px width.

### Demo checkpoint
You should be able to screen-record:
**search → route → moving bus**.

---

## Wednesday, Aug 26 — GO mode + disruption

**Outcome:** The product becomes a journey companion, not a map app.

- [ ] Implement GO finite-state machine.
- [ ] State: walk to stop.
- [ ] State: bus approaching.
- [ ] State: on bus.
- [ ] State: stops remaining.
- [ ] State: get ready.
- [ ] State: get off.
- [ ] State: transfer/walk to metro.
- [ ] State: metro leg.
- [ ] State: arrive.
- [ ] Implement deterministic demo-delay trigger.
- [ ] Recompute/select alternative journey.
- [ ] Add **Switch route** action.
- [ ] Make the reroute work every time.
- [ ] Add a reset-demo action for repeated judging/testing.

### Demo checkpoint
You should now be able to record the entire **first minute** of the submission video.

---

## Thursday, Aug 27 — Polish + tests + video rehearsal

**Outcome:** Submission-quality product.

### Product
- [ ] Remove broken/unused controls.
- [ ] Add `Independent hackathon prototype`.
- [ ] Add `Synthetic realtime data` disclosure.
- [ ] Add OSM attribution.
- [ ] Add Delhi data acknowledgement where appropriate.
- [ ] Add loading/empty/error states.
- [ ] Test low-width mobile UI.
- [ ] Test keyboard/focus basics.
- [ ] Test reduced-motion behavior if animations are used.
- [ ] Improve perceived performance.
- [ ] Add Hindi only if the English journey is already excellent.

### User test
- [ ] Test with 5 people if possible.
- [ ] Give no instructions other than the travel task.
- [ ] Record completion/failure.
- [ ] Fix the top 3 points of confusion.

### Codex evidence
- [ ] Update `BUILD_WITH_CODEX.md`.
- [ ] Record concrete modules Codex helped create.
- [ ] Keep examples/commits/prompts available if asked.
- [ ] Do not overstate involvement.

### Video
- [ ] Lock final demo journey.
- [ ] Lock exact spoken script.
- [ ] Rehearse at <1:55.
- [ ] Prepare architecture visual.
- [ ] Prepare provenance visual.
- [ ] Prepare National Bus Digital Grid scale visual.

---

## Friday, Aug 28 — Submission day

### Official deadline
**8:00 PM IST / 10:30 AM EDT**

### Recommended freeze
**6:00 AM EDT / 3:30 PM IST** — stop feature work.

### Final technical checks
- [ ] Production deployment succeeds.
- [ ] Public URL loads while logged out.
- [ ] Test on Chrome.
- [ ] Test on Safari/mobile if available.
- [ ] Search works.
- [ ] Demo route works.
- [ ] Moving bus works.
- [ ] GO mode works.
- [ ] Delay trigger works.
- [ ] Reroute works.
- [ ] Reset works.
- [ ] No console-breaking errors.
- [ ] No secret/API key is exposed in frontend/repo.
- [ ] No unapproved live-government endpoint is called.

### Record video
- [ ] Record final deployed build.
- [ ] First minute = citizen demo.
- [ ] Second minute = architecture/product/Codex/scale.
- [ ] Runtime <2:00.
- [ ] Upload video to a public link.
- [ ] Test the video link in incognito.

### Project summary
- [ ] <250 words.
- [ ] Clearly defines user/problem.
- [ ] Explains why better.
- [ ] Says Delhi pilot.
- [ ] Discloses synthetic realtime.
- [ ] Mentions standards-based scale.
- [ ] Mentions meaningful Codex use.

### Submission
- [ ] Open official form.
- [ ] Use the same registered email consistently.
- [ ] Add partner's registered email if team of two.
- [ ] Add public prototype link.
- [ ] Add video link.
- [ ] Add project summary.
- [ ] Add mock credentials only if login exists.
- [ ] Submit.
- [ ] Save confirmation screenshot/email.

**Target actual submission:** no later than **8:30 AM EDT / 6:00 PM IST**.

---

# 2. If shortlisted

## Aug 28–Sep 1
Stage 1 review period.

- [ ] Do not break the public deployment.
- [ ] Monitor uptime.
- [ ] Keep repo/build reproducible.

## Sep 7
Top 250 resubmit improved build after mentorship.

If selected:
- [ ] Prioritize mentor feedback.
- [ ] Replace synthetic components only where approved/valuable.
- [ ] Expand testing.
- [ ] Strengthen accessibility.
- [ ] Strengthen national data-normalization story.
- [ ] Do not add random features.

## Sep 8–12
Top 10 finalist decisions are expected in this window.

## Sep 12
Finalists present in Bengaluru; winners announced same day.

---

# 3. Build priority if time slips

Do in this exact order:

1. [ ] Search → route works
2. [ ] Route result is easy to understand
3. [ ] Route line/stops render
4. [ ] Synthetic bus moves
5. [ ] Journey detail works
6. [ ] GO mode works
7. [ ] Delay/reroute works
8. [ ] Provenance labels work
9. [ ] Mobile polish
10. [ ] User testing
11. [ ] Video
12. [ ] Hindi
13. [ ] AI natural-language preferences

Do **not** sacrifice 1–8 for 12–13.

---

# 4. Suggested issue board

## P0 — submission blockers
- [ ] Public deployment
- [ ] Search
- [ ] Demo itinerary
- [ ] Journey detail
- [ ] Bus animation
- [ ] GO state machine
- [ ] Disruption/reroute
- [ ] Demo-data disclosure
- [ ] Video
- [ ] Summary
- [ ] Submission

## P1 — high impact
- [ ] Multiple route options
- [ ] OTP integration
- [ ] Local place search
- [ ] Trust/provenance engine
- [ ] Mobile accessibility
- [ ] User testing
- [ ] Error/loading states

## P2 — only if ahead
- [ ] Hindi
- [ ] Natural-language travel constraints
- [ ] Offline caching
- [ ] richer bus-route search

## Won't do for Aug 28
- [ ] real ticketing
- [ ] payments
- [ ] NCMC
- [ ] nationwide data ingestion
- [ ] accounts
- [ ] crowding
- [ ] complaints
- [ ] safety scoring
- [ ] native app

---

# 5. Important links

## Hackathon
- Official site: https://buildwhatmovesindia.com/
- Builder brief: https://buildwhatmovesindia.com/brief
- FAQ: https://buildwhatmovesindia.com/faq
- Submission/application short link surfaced from official site: https://forms.gle/szFiESzejRUmfbow5

## Delhi transit data
- Documentation: https://otd.delhi.gov.in/documentation/
- Bus static data: https://otd.delhi.gov.in/data/static/
- DMRC static data: https://otd.delhi.gov.in/data/staticDMRC/
- Realtime access page: https://otd.delhi.gov.in/data/realtime/
- Terms & Conditions: https://otd.delhi.gov.in/terms
- One Delhi app: https://play.google.com/store/apps/details?id=com.delhitransport.onedelhi

## Transit standards
- GTFS home: https://gtfs.org/
- GTFS overview: https://gtfs.org/documentation/overview/
- GTFS Realtime: https://gtfs.org/documentation/realtime/
- GTFS realtime libraries/resources: https://gtfs.org/resources/producing-data/

## Routing/maps
- OpenTripPlanner: https://www.opentripplanner.org/
- OTP docs: https://docs.opentripplanner.org/en/latest/
- OTP data sources: https://docs.opentripplanner.org/en/latest/Data-Sources/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- OpenFreeMap: https://openfreemap.org/quick_start/

## OpenStreetMap
- License/attribution: https://www.openstreetmap.org/copyright
- India Geofabrik extract: https://download.geofabrik.de/asia/india.html
- Northern Zone extract: https://download.geofabrik.de/asia/india/northern-zone.html
- Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/

## Strategic evidence
- Parliamentary committee / National Bus Digital Grid, 11 Aug 2026:
  https://www.pib.gov.in/PressReleasePage.aspx?PRID=2297871

---

# 6. Submission facts to remember

From the official Builder Brief/FAQ:

- Deadline: **Aug 28, 2026, 8:00 PM IST**
- No grace period
- Solo or team of 2
- Codex mandatory and meaningful
- Working prototype, not Figma-only
- Public browser link required
- Reviewers will not download an app
- Every feature shown must work
- Use mock/synthetic data for government systems
- No unapproved live government system integration
- Video ≤2 minutes
- First minute = citizen demo
- Second minute = how/why built
- Summary <250 words
- Top 250 reviewed Aug 28–Sep 1
- Top 250 improve/resubmit by Sep 7
- Finalists present in Bengaluru Sep 12

---

# 7. Final pre-submit question

Before adding any feature, ask:

> **Does this make an unfamiliar bus journey easier to understand or more trustworthy in the 2-minute demo?**

If no, cut it.
