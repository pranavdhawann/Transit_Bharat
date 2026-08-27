# Deploying BharaTransit to Netlify

Target: a public URL that opens in incognito without requesting access, which
is a hackathon non-negotiable. Budget ~30 minutes including the smoke test.

`netlify.toml` in the repo root already pins the build command, Node version
and the Next.js plugin, so the dashboard defaults do not need editing.

---

## 0. Before you start

Everything must be committed and pushed. Netlify builds from the Git remote,
not from your working tree — uncommitted work simply will not be deployed.

```bash
git add -A && git commit -m "Delhi pilot: search coverage, auto first/last mile, stateless demo scenario" && git push origin master
```

Confirm the local build is green first. A build that fails on Netlify costs
about four minutes per attempt:

```bash
npm run typecheck && npm test && npm run build
```

---

## 1. Create the site

1. Log in at [app.netlify.com](https://app.netlify.com).
2. **Add new site → Import an existing project → GitHub**, authorise, and pick
   `pranavdhawann/Transit_Bharat`.
3. Netlify reads `netlify.toml`, so build command, publish directory and the
   Next.js plugin are already filled in. Leave them alone.
4. Branch to deploy: `master`.
5. **Deploy site.**

The first build takes roughly 2–4 minutes. Watch the deploy log; the important
line near the end is that the Next.js plugin generated the function handlers
for the `/api/*` routes.

---

## 2. Environment variables

**Site configuration → Environment variables → Add a variable.**

| Key | Value | Needed? |
| --- | --- | --- |
| `OPENAI_API_KEY` | your key | Only if you want the real OpenAI parse path instead of the labelled heuristic fallback |
| `OPENAI_MODEL` | e.g. `gpt-5-mini` | Optional; the code already defaults to this |

Scope them to **Production**, then **trigger a redeploy** — environment
variables are read at build/run time and an existing deploy will not pick them
up on its own.

Without `OPENAI_API_KEY` the app does not break: `/api/ai/preferences` falls
back to the keyword heuristic and honestly reports `"source": "heuristic"`.

Never commit the key. `.env` and `.env*.local` are already gitignored.

---

## 3. Set a memorable site name

**Site configuration → General → Site details → Change site name.**

Something like `bharatransit` gives you `https://bharatransit.netlify.app`,
which reads far better in a submission form and on video than the generated
`spontaneous-tapioca-1a2b3c.netlify.app`.

---

## 4. Smoke test — do this in an incognito window

Logged-in-only access is a submission failure, and your own browser session
will hide that from you. Open a private window and walk the actual demo:

- [ ] `/` loads, no login wall, no Netlify password prompt
- [ ] Focus the **From** box → "Popular places" suggestions appear
- [ ] Type `chandni` → Chandni Chowk appears; type `du north` → Delhi
      University North Campus appears
- [ ] Demo chip **Munirka → Connaught Place** → **Find my route** → cards show
      real times, fares and a non-zero walking distance
- [ ] The map draws tiles **and the coloured route line** *(this is the one
      that has been fragile — check it explicitly)*
- [ ] **Simulate delay (demo)** → the bus option is marked disrupted and an
      ALTERNATIVE appears
- [ ] Reload the page → the delay is **still applied** (it lives in
      sessionStorage, not server memory)
- [ ] **Start GO navigation** → step through to 100% without a console error
- [ ] `/about` renders the live network statistics
- [ ] Open the URL on a phone — the layout is the one judges will see

The reload check matters most. It is the thing that would previously have
broken in production: the scenario used to live in server memory, and Netlify
Functions do not share memory between invocations, so the delay would appear
to do nothing on roughly every other request. It is now carried by the client.

---

## 5. Keep the demo URL stable

Netlify gives every deploy its own permalink and only moves the main site URL
when a build succeeds, so a broken push cannot take the demo down. Still:

- Submit the **site URL** (`bharatransit.netlify.app`), not a deploy
  permalink — permalinks look like a build artefact to a judge.
- Once you have recorded the video, stop pushing to `master`. If you must keep
  working, branch, and let Netlify build deploy previews instead.
- **Site configuration → Build & deploy → Locked deploys** freezes the live
  site at a known-good build. Worth doing once the video is recorded.

---

## Troubleshooting

**Build fails on a type error.** Netlify runs the same `next build` you do, and
`next build` typechecks. Run `npm run typecheck` locally and fix it there —
the loop is much faster.

**Build fails on the Node version.** `netlify.toml` pins `NODE_VERSION = "20"`.
If a dependency needs newer, raise it there rather than in the dashboard, so
the setting lives in the repo.

**API routes 404.** The Next.js plugin did not run. Confirm
`@netlify/plugin-nextjs` appears in the deploy log's plugin list, and that the
publish directory is `.next` and not `out` — `out` means a static export was
attempted, which cannot serve the dynamic API routes this app needs.

**Map is blank on the deployed site but fine locally.** Tiles come from
OpenFreeMap over HTTPS; check the browser console for a CSP or mixed-content
error rather than assuming the map code broke.

**The delay demo behaves inconsistently.** It should not any more, but if it
does, confirm the browser is actually sending the scenario: the
`POST /api/journeys` request body should contain a `scenario` object once the
delay is triggered. If sessionStorage is blocked (some privacy modes), the
delay will only hold within a single page view.
