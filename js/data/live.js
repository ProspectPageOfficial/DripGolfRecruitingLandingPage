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
 */
export const LIVE_FIELDS = Object.freeze([
  "name", "hometown", "class_year", "age",
  "currently_attending", "height", "weight", "photo", "bio",
]);

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
 * Take only the fields we use, drop placeholders, strip embedded labels.
 * Pure and exported so the normalisation is testable without a network.
 */
export function normalizeLive(raw) {
  const clean = {};
  if (!raw || typeof raw !== "object") return clean;

  for (const field of LIVE_FIELDS) {
    const value = raw[field];
    if (isPlaceholder(value)) continue;
    clean[field] = stripLabel(value);
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
