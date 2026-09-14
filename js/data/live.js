/**
 * data/live.js — read the golfer's identity from the golfer's own website.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE REPLACED AN EDITOR
 * ---------------------------------------------------------------------------
 * This app used to keep its own editable copy of Luke's name, hometown, class
 * year and photo. Two copies of one fact is not redundancy, it is a bug with a
 * delay on it: the moment someone edited the real site, this app was wrong and
 * had no way to know.
 *
 * The site already publishes all of it at `/api/personal`, GET is public, and
 * the endpoint sends `Access-Control-Allow-Origin: *`. So the app reads it. It
 * does not cache it, does not let anyone override it, and has no UI to edit it.
 * If a value here is wrong, it is wrong on the website, which is exactly where
 * someone should go and fix it.
 *
 * ACADEMICS FLOW THROUGH HERE TOO
 * The site publishes GPA and SAT/ACT as free-form strings ("3.85 / 4.0",
 * "31 ACT", "1420 SAT"). The fit engine wants numbers. Parsing lives here,
 * next to the rest of normalisation, so the boundary between "what the site
 * publishes" and "what the engine sees" stays in one file.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not fetch the athletic numbers, because they are not there to fetch:
 * `/api/tournaments` returns four events with empty `rounds` arrays, and the 29
 * real results live in PORTFOLIO_DATA inside the page HTML, which is served
 * WITHOUT CORS headers and therefore cannot be read by a browser on another
 * origin. Those come from a generated snapshot instead -- see data/golfer.js.
 * Pretending otherwise would mean quietly shipping stale numbers labelled live.
 */
import { PUBLIC_SITE } from "../config.js";

export const PERSONAL_ENDPOINT = `${PUBLIC_SITE.url}/api/personal`;

/**
 * Fields this app actually uses. Everything else the endpoint returns --
 * coach details, six social handles, home address, phone -- is ignored rather
 * than merged "just in case". Pulling data you have no screen for is how a
 * profile object becomes a junk drawer.
 *
 * `gpa` and `test_scores` are the site's free-form academic fields; they get
 * parsed into numeric `gpa` / `sat` for the fit engine below.
 */
export const LIVE_FIELDS = Object.freeze([
  "name", "hometown", "class_year", "age",
  "currently_attending", "height", "weight", "photo", "bio",
  "gpa", "test_scores",
]);

/**
 * ACT -> SAT concordance (College Board / ACT joint tables, 2018 revision).
 *
 * We keep ONE academic axis inside the fit engine so scoreSchool() does not
 * need parallel ACT logic and every band/weight is defined once. Converting on
 * the read side means the engine never learns which test the golfer sat -- it
 * just sees a comparable number, which is what "concordance" is for.
 *
 * Only integer ACT composites appear on real score reports, so a table beats a
 * regression. Below 9 we return null rather than extrapolating: the concordance
 * itself stops there, and inventing a mapping past the source is exactly the
 * kind of confident-and-wrong the fit engine already warns against.
 */
export const ACT_TO_SAT = Object.freeze({
  36: 1590, 35: 1540, 34: 1500, 33: 1460, 32: 1420, 31: 1390, 30: 1360,
  29: 1330, 28: 1300, 27: 1260, 26: 1230, 25: 1200, 24: 1170, 23: 1140,
  22: 1110, 21: 1080, 20: 1050, 19: 1020, 18:  980, 17:  940, 16:  900,
  15:  860, 14:  820, 13:  780, 12:  740, 11:  710, 10:  680,  9:  650,
});

/**
 * Extract a GPA number from a free-form site value.
 *
 * The site stores GPA as whatever the owner types: "3.85", "3.85 / 4.0",
 * "4.2 weighted", "GPA: 3.9". We pull the first plausible number and let the
 * engine compare it. We deliberately do NOT try to un-weight a weighted GPA --
 * the site does not tell us the scale, and guessing would turn "you said 4.2"
 * into "we decided you meant 3.8". If a golfer publishes a weighted GPA next to
 * an unweighted college average, their fit is generous and visibly so; that is
 * better than a silent scale conversion nobody can audit.
 *
 * Returns null on anything unparseable or wildly out of range, so the engine's
 * hasAcademics() check drops the input rather than scoring nonsense.
 */
export function parseGpa(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  // Upper bound of 5.5 leaves room for weighted scales (5.0 is common) while
  // still rejecting a stray SAT that landed in the wrong field.
  if (!Number.isFinite(n) || n <= 0 || n > 5.5) return null;
  return n;
}

/**
 * Extract an SAT-equivalent score from a free-form site value.
 *
 * Accepts anything a golfer might type: "1420", "1420 SAT", "31 ACT",
 * "1420 / 31 ACT", "SAT 1500 (ACT 34)". Prefers an explicit SAT-range number
 * when one is present; otherwise falls back to a valid ACT via ACT_TO_SAT.
 *
 * Range gates are deliberate:
 *   - SAT: 400-1600, the actual bounds of the test
 *   - ACT: integer 9-36, the range the concordance actually covers
 * Anything outside those is treated as "not really a score" rather than
 * silently mapped -- the fit engine will then treat academics as unknown.
 */
export function parseSat(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const numbers = Array.from(text.matchAll(/\d+(?:\.\d+)?/g), (m) => Number(m[0]));
  const sat = numbers.find((n) => n >= 400 && n <= 1600);
  if (sat) return Math.round(sat);
  const act = numbers.find((n) => Number.isInteger(n) && n >= 9 && n <= 36);
  return act ? ACT_TO_SAT[act] : null;
}

/**
 * The live blob currently contains real placeholder text -- "Test Coach Name",
 * "TEST" in every social field, "911-1111-1111". None of those fields are used
 * here, but the guard stays because the day someone types "TEST" into `name`
 * should not be the day the dashboard greets "Afternoon, TEST."
 *
 * Falling back to the snapshot is the right move: it is the last value known to
 * be real, and a stale true name beats a live fake one.
 */
export const isPlaceholder = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return true;
  return /^test\b/i.test(text) || /^(n\/?a|tbd|todo|xxx+)$/i.test(text);
};

/** "Age: 13" -> "13". The site stores labels inside its values. */
export const stripLabel = (value) =>
  String(value ?? "").replace(/^[A-Za-z ]{2,20}:\s*/, "").trim();

/**
 * Take only the fields we use, drop placeholders, strip embedded labels, and
 * translate the site's free-form academic strings into the numbers the fit
 * engine expects.
 *
 * Pure and exported so the normalisation is testable without a network.
 *
 * Academic translation rule: if the value cannot be parsed into a real
 * number, it is DROPPED. Leaving a raw string on the profile would either
 * blow up the engine or -- worse -- coerce to NaN and score as zero,
 * telling a golfer their grades are a problem when in fact we just could
 * not read what they typed. hasAcademics() then treats it as "not on
 * file", which is the honest answer.
 */
export function normalizeLive(raw) {
  const clean = {};
  if (!raw || typeof raw !== "object") return clean;

  for (const field of LIVE_FIELDS) {
    const value = raw[field];
    if (isPlaceholder(value)) continue;
    clean[field] = stripLabel(value);
  }

  // Academic fields are published as free-form strings; the engine needs
  // numbers on `gpa` and `sat`. We overwrite `gpa` in place (still a GPA,
  // just typed) and rename `test_scores` -> `sat` because "test_scores" is
  // a site-side label for a UI card, not a fit-engine input.
  if (clean.gpa != null) {
    const gpa = parseGpa(clean.gpa);
    if (gpa == null) delete clean.gpa;
    else clean.gpa = gpa;
  }
  if (clean.test_scores != null) {
    const sat = parseSat(clean.test_scores);
    delete clean.test_scores;
    if (sat != null) clean.sat = sat;
  }

  return clean;
}

// There is deliberately no mergeLive() here. Spreading the normalised result
// over the snapshot is one line, and data/golfer.js already owns it in
// buildGolfer() -- a second helper doing the same spread would just be a second
// place for the precedence rule to be got wrong.

/**
 * Fetch the live profile. NEVER throws.
 *
 * Offline, rate-limited, DNS-poisoned, Netlify having a moment -- every one of
 * those resolves to `{ ok: false }` and the caller keeps the snapshot. A
 * recruiting dashboard that renders a stack trace because someone else's CDN
 * blinked is worse than one showing yesterday's hometown.
 *
 * @returns {Promise<{ok:boolean, data:?Object, error:?string}>}
 */
export async function fetchLiveProfile({ timeoutMs = 6000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(PERSONAL_ENDPOINT, {
      signal: controller.signal,
      // The endpoint sets no-store itself; this stops a browser or proxy
      // deciding otherwise and serving us a cached identity.
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, data: null, error: `HTTP ${response.status}` };
    return { ok: true, data: await response.json(), error: null };
  } catch (err) {
    return { ok: false, data: null, error: err?.name === "AbortError" ? "timeout" : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
