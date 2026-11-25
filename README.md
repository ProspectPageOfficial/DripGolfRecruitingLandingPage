# Drip Golf Recruiting

The web app behind [dripgolfrecruiting.com](https://dripgolfrecruiting.com).
It helps junior golfers and their parents build a recruiting page and share it
with college coaches as one link.

One repo serves everything:

| Part | Address | What it is |
|---|---|---|
| Marketing site | `/` | Landing page, FAQ, terms, privacy |
| Accounts | `/#/signup`, `/#/login`, `/#/my` | Sign-up survey, sign-in, password reset, dashboard, account deletion |
| College Best Fit | `/#/my/fit` | A 0-100 fit score against 887 college golf programs |
| Golfer pages | `/<name>`, e.g. `/ava-reed` | A golfer's public page: bio, results, rankings, swing videos, downloadable resume |

Coaches and visitors never sign in. Accounts belong to a parent or guardian,
who must confirm that at sign-up.

## Status

| Feature | State |
|---|---|
| Accounts, golfer pages, page editing, resume | Built |
| College Best Fit | Built. Roster ranks are estimates, see [below](#where-the-data-comes-from) |
| Real sign-ups | Off unless `SIGNUPS_ENABLED=true` is set in Netlify |
| Payments | **Not built.** The checkout step is a mockup |
| Buying a custom domain | **Not built.** The domain step is a mockup |
| Serving a golfer on their own domain | The API supports it (`golfers.domain`); the domain itself is set up by hand |

When sign-ups are on, the survey skips the two mockup steps and creates a real
account. When they are off, or there is no API (as with `serve.py`), it runs as
a demo: no account is made and the answers stay in that browser tab.

## Run it locally

You need Node 22 or newer.

```
npm ci
npm run pages
```

Open <http://localhost:8888>. This runs the app, golfer pages and API together,
using a local file database in `.dev-data/` (git-ignored) with sign-ups on.
Create an account through the survey to get a golfer page to work with. No
email is sent locally: password-reset links are written to the `outbox` list in
`.dev-data/db.json`.

> If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in your
> environment, `npm run pages` uses that **real** Supabase project instead.

To work on the front end only, without Node or the API:

```
python serve.py          # http://127.0.0.1:8080
```

Use `serve.py` rather than `python -m http.server`. It turns caching off, so
the browser never runs an old copy of a module you just edited. Opening the
files directly (`file://`) does not work because the app uses ES modules.

## Tests

```
npm test
```

This runs the app tests (scoring, data and views) and then the API tests, which
include checks that one golfer's owner cannot change another golfer's page.
GitHub Actions runs the same command on every pull request and every push to
`main`.

Without Node, start `serve.py` and open
<http://127.0.0.1:8080/tests/runner.html> to run the scoring, data and view
cases in the browser. It does not cover the API or the data-scraping tools.

## How it is built

- **Front end:** plain JavaScript ES modules, HTML and CSS. No framework and no
  build step.
- **API:** Netlify Functions, one file per endpoint.
- **Accounts, database and file storage:** Supabase.
- **Hosting:** Netlify publishes the repo root. `netlify.toml` sets cache and
  security headers and 404s files that should not be public.

```
index.html              the app's entry point
golfer.html             template for every golfer page
css/                    tokens.css (brand colors), app.css (everything else)
assets/golfer/          golfer page scripts and styles
js/
  main.js               hash router and sign-in guard
  config.js             app name, example page, demo account
  auth/store.js         demo account sign-in only (browser-based)
  data/                 college, coach, roster and tour data; account reads
  lib/fit.js            the scoring engine: pure functions, no DOM or network
  lib/                  shared UI and helpers
  views/                one file per screen
netlify/functions/      the API
  _lib/tenant.mjs       which golfer a request is for, and is the caller the owner
  _lib/db.mjs           data layer: Supabase in production, local file in dev
supabase/schema.sql     database schema, access rules and storage buckets
tools/                  data generators, golfer import, local server
tests/                  app tests; tests/pages/ holds the API tests
mockup.html             internal design study, not served
```

### Golfer pages

Netlify sends any single-segment address, such as `/ava-reed`, to
`golfer.html`. `assets/golfer/tenant.js` works out which golfer it is, adds an
`X-Golfer` header (and the owner's token, when signed in) to every `/api/` call,
and fills the page from `/api/golfer`.

`X-Golfer` only picks which page is being looked at. Every write also checks
that the signed-in user owns that golfer.

### API

| Endpoint | Purpose |
|---|---|
| `/api/signup` | Create an account and its golfer page; says whether sign-ups are open |
| `/api/login` | Sign in to one golfer's page |
| `/api/my-page` | Sign in from the homepage and find the account's page |
| `/api/password-reset`, `/api/password-update` | Forgot password |
| `/api/delete-account` | Permanently delete an account, its pages and uploads |
| `/api/golfer` | Public page data |
| `/api/personal` | Personal bio fields |
| `/api/golf-stats` | Rankings |
| `/api/golf-scoring` | Linked Drip Golf Tour profile, and the scoring stats shown on the resume |
| `/api/tournaments`, `/api/upcoming-tournaments` | Results and schedule |
| `/api/swing-videos`, `/api/featured-swing` | Swing videos |
| `/api/resume` | The owner's edits to the generated resume |
| `/api/theme` | Page colors |
| `/api/drip-golf` | Drip Golf Tour standings and player profiles |

### Database and security

Two tables: `golfers` (one row per page) and `golfer_docs` (one JSON document
per golfer per key). Both have Row Level Security on with **no policies**, so
the public key cannot read or write them. All access goes through the API,
which uses the service role key and checks ownership.

Photos and swing videos upload straight from the browser to two public Supabase
Storage buckets. Anyone can view them, but owners can only upload into their
own golfer's folder.

The example account in `js/config.js` is a browser-only demo behind "See a live
example". It is not a real account and protects nothing. Do not reuse
`js/auth/store.js` for real sign-in.

## Deploying

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
   It is safe to re-run.
2. In Supabase Auth, allow the site's address as a redirect URL. Confirmation
   and password-reset links return to the homepage.
3. Connect the repo to Netlify and set these environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project address |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Public key the page uses for uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Secret.** Server-side only, bypasses Row Level Security |
| `SIGNUPS_ENABLED` | No | `true` lets the survey create real accounts |
| `UPLOAD_MAX_MB` | No | Upload size limit, default 50. Match it to the Supabase plan |

To move an existing single-golfer site onto this one, use
`npm run import-golfer`. The options are at the top of
`tools/import-golfer.mjs`.

## How the fit score works

Everything is in `js/lib/fit.js`, with the weights and cutoffs as named
constants at the top.

```
Athletic Fit = the golfer's JGS national rank
             / the average senior-year JGS rank of the current roster
             -> a ratio of 0.5 scores 100, a ratio of 3.0 scores 0

Academic Fit = 0.55 * GPA vs school average
             + 0.45 * SAT vs school average (ACT is converted to SAT)

Overall      = 0.62 * Athletic + 0.38 * Academic

Likely >= 78   Target >= 58   Reach < 58
```

JGS is Junior Golf Scoreboard. The rules behind the numbers:

- **Scores explain themselves.** Every school shows what moved its number.
- **Rank, not scoring average.** Comparing a junior's scoring average with a
  college team's punishes younger golfers. Comparing junior rank with junior
  rank does not, and needs no projection.
- **Missing inputs are never zero.** With no academics, the score is athletic
  only, and the reverse. With neither, the school is not scored at all. No
  program has an average GPA on file today, so academics currently run on SAT
  wherever the school has one.
- **The academic gate.** Academic fit below 30 caps the overall score at 55.
- **Preferences filter, they never score.**
- **Women's teams** use the girls' ranking list. Boys'-scale roster numbers are
  converted by the size of the two lists.
- **Roster outlook** (players graduating before the golfer enrolls) is shown
  beside the score and is not part of it.

## Where the data comes from

| Data | Status | Source |
|---|---|---|
| 883 NCAA D1-D3 programs: name, division, conference, state, website, teams | Real | NCAA member directory |
| 4 NAIA programs | Partial | Entered by hand; no academic data on file |
| SAT, admission rate, tuition | Real where available | College Scorecard, US Dept. of Education |
| Average GPA | None on file | No free public source |
| **Average roster JGS rank** | **Estimated** | Modelled from conference tier, shown as "(est.)" |
| Score weights, bands and tier cutoffs | Assumption | Chosen, not validated against recruiting outcomes |
| Head coaches and contacts | Real, goes stale | School athletics sites. 26 men's programs checked by hand, the rest read automatically |
| Roster class-year counts | Real, goes stale | School roster pages. Counts only, no names |
| Golfer results, stats and rankings | From the family or the tour | Entered by the owner or read from the Drip Golf Tour |

The athletic score depends entirely on roster rank, so fit scores are a
starting point for building a list, not a measurement. Real values would need
historical JGS ranks joined to each roster, and JGS has no public export.

`js/data/provenance.js` is the in-app version of this table, shown at `/#/data`.
If you add a data field, add it there too.

### Refreshing the data

| Run | Updates | When |
|---|---|---|
| `node tools/gen-colleges.mjs <csv>` | `colleges-ncaa.js` | Yearly |
| `node tools/gen-coaches.mjs` | `coaches-ncaa.js` | Before each fall season |
| `node tools/gen-rosters.mjs` | `rosters-ncaa.js` | Each August, after coaches |
| `node tools/gen-dripgolf-history.mjs` | `dripgolf-history.js` | When a tour season ends; add it to `PAST_SEASONS` first |

- The CSV is "Most Recent Cohorts - Institution" from
  <https://collegescorecard.ed.gov/data/>.
- Coach and roster pages are cached in `tools/.cache/`. Add `--refresh` to
  download them again.
- Files marked GENERATED should not be edited by hand.
- The 26 hand-checked coaches in `js/data/coaches.js` need a manual re-check
  each season.
- `JGS_POOL` in `js/lib/fit.js` holds the size of the boys' and girls' ranking
  lists. Update it once a season.
- The current tour season is read live by `/api/drip-golf`. It parses
  dripgolftour.com's HTML, so a redesign there can break the lookup. Sign-up
  still works if it does.

## Known issues

- `npm run sync` does not work. It calls `_ref/gen_luke.py`, and `_ref/` is not
  in the repo. It was used to regenerate the example golfer's results in
  `js/data/luke-season.js`.
- Some code comments still describe the original one-golfer demo, including
  those in `js/main.js`, `js/config.js` and `js/auth/store.js`.
