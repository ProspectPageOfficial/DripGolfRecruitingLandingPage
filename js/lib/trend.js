/**
 * lib/trend.js — measure a golfer's ACTUAL scoring trend from their own rounds.
 *
 * WHY THIS EXISTS
 * The projection in fit.js originally used a hardcoded 1.6 strokes/year of
 * improvement. That number was invented. When we finally checked it against
 * Luke Selzer's 29 real events it turned out to be wrong by roughly 1.6
 * strokes/year:
 *
 *     2024  22 rounds  avg 79.27  stdev 4.53
 *     2025  27 rounds  avg 82.04  stdev 4.22   (+2.76 - he got worse)
 *     2026   6 rounds  avg 79.50  stdev 2.57   (-2.54 - he got better)
 *     mean year-over-year change: +0.11 strokes/yr
 *
 * His trend is flat, and the round-to-round noise (~4.4 strokes) is larger
 * than any annual signal in the data. Projecting an 8-stroke gain out of that
 * was not a model, it was wishful thinking with a decimal point.
 *
 * So: measure what we can, report the uncertainty honestly, and let the golfer
 * choose the assumption rather than burying our guess inside the maths.
 *
 * Pure functions. No DOM, no storage.
 */

/** Below this a card is a partial/9-hole round, not an 18-hole score. */
export const FULL_ROUND_MIN = 55;

/** Fewer rounds than this in a season and the average is meaningless. */
export const MIN_ROUNDS_PER_SEASON = 4;

/**
 * Events in the Junior Golf Scoreboard rolling ranking window.
 *
 * NOT a number this file chose. JGS averages a golfer's most recent events
 * rather than their whole career, and 8 is the window that reproduces Luke's
 * published 81.12 EXACTLY from the rounds his own site lists. His career mean
 * across all 55 full rounds is 80.65 -- close enough to look right and wrong
 * enough to matter.
 *
 * That difference is the entire reason this constant is written down. Shipping
 * 80.65 under the label "scoring average" would be publishing a private metric
 * next to a public rank that was computed a different way, and nobody would
 * ever catch it.
 */
export const RANKING_WINDOW_EVENTS = 8;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Season-by-season scoring averages, oldest first.
 * @returns {Array<{season:string, rounds:number, avg:number, stdev:number,
 *                  best:number, worst:number}>}
 */
export function seasonAverages(tournaments = []) {
  const buckets = new Map();

  for (const event of tournaments) {
    const season = event.season ?? String(event.date ?? "").slice(0, 4);
    if (!season) continue;
    const scores = (event.rounds ?? []).filter((s) => s >= FULL_ROUND_MIN);
    if (!scores.length) continue;
    if (!buckets.has(season)) buckets.set(season, []);
    buckets.get(season).push(...scores);
  }

  return [...buckets.entries()]
    .filter(([, scores]) => scores.length >= MIN_ROUNDS_PER_SEASON)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([season, scores]) => ({
      season,
      rounds: scores.length,
      avg: round2(mean(scores)),
      stdev: round2(stdev(scores)),
      best: Math.min(...scores),
      worst: Math.max(...scores),
    }));
}

/**
 * The golfer's scoring average, derived from the rounds their site publishes.
 *
 * Exists so no human ever types this number in. It is computed from the same
 * tournament data the public site lists, using JGS's rolling window, and is
 * verified against the published figure by a test case.
 *
 * Returns null rather than 0 when there is nothing to average -- a golfer with
 * no rounds does not have a scoring average of zero, they have no average, and
 * the Fit engine already knows how to handle a missing input.
 *
 * @param {Array} tournaments newest first or oldest first; sorted internally.
 * @returns {?number}
 */
export function rollingScoringAvg(tournaments = [], window = RANKING_WINDOW_EVENTS) {
  // TRUNCATED, not rounded. Luke's 16 counting rounds total 1298, so the exact
  // mean is 81.125 -- dead on a rounding boundary. His site publishes 81.12,
  // which is the truncation; half-up rounding would give 81.13 and disagree
  // with the number printed on his own page.
  //
  // Inferred from a single observation, so treat it as provisional. It is safe
  // to be wrong here: the app displays the site's PUBLISHED figure, and this
  // function only exists to cross-check it, with a test holding the two
  // together.
  const played = tournaments
    .filter((e) => (e.rounds ?? []).some((s) => s >= FULL_ROUND_MIN))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, window);

  const scores = played.flatMap((e) =>
    (e.rounds ?? []).filter((s) => s >= FULL_ROUND_MIN)
  );

  return scores.length ? Math.floor(mean(scores) * 100) / 100 : null;
}

/**
 * Measure the golfer's own year-over-year trend.
 *
 * @returns {{
 *   seasons: Array, measurable: boolean, strokesPerYear: ?number,
 *   volatility: ?number, reliable: boolean, note: string
 * }}
 *   `strokesPerYear` is NEGATIVE when improving, to match how the projection
 *   consumes it. `reliable` is false whenever the noise swamps the signal,
 *   which for a junior golfer is most of the time.
 */
export function measureTrend(tournaments = []) {
  const seasons = seasonAverages(tournaments);

  if (seasons.length < 2) {
    return {
      seasons,
      measurable: false,
      strokesPerYear: null,
      volatility: seasons[0]?.stdev ?? null,
      reliable: false,
      note:
        seasons.length === 1
          ? "Only one season of scores on file, so there is no trend to measure yet."
          : "Not enough scores on file to measure a trend.",
    };
  }

  // Average of the year-over-year deltas. Simple on purpose: with three data
  // points a regression would look more authoritative without being more true.
  const deltas = seasons
    .slice(1)
    .map((s, i) => s.avg - seasons[i].avg);
  const strokesPerYear = round2(mean(deltas));
  const volatility = round2(mean(seasons.map((s) => s.stdev)));

  // If a single round swings further than a whole year of "progress", the
  // trend is noise wearing a trenchcoat.
  const reliable = Math.abs(strokesPerYear) > volatility / 2;

  const direction =
    strokesPerYear < -0.25 ? "improving" : strokesPerYear > 0.25 ? "sliding" : "flat";

  return {
    seasons,
    measurable: true,
    strokesPerYear,
    volatility,
    reliable,
    note: reliable
      ? `Measured across ${seasons.length} seasons: ${direction}.`
      : `Measured across ${seasons.length} seasons the trend is ${direction}, but ` +
        `round-to-round swing (${volatility} strokes) is larger than the yearly ` +
        `change (${Math.abs(strokesPerYear)}). Treat it as noise, not a trajectory.`,
  };
}

/**
 * Scenarios a golfer can plan against.
 *
 * These are explicitly WHAT-IFS, not predictions. Nobody involved in building
 * this knows the true junior improvement curve, so the honest move is to put
 * the assumption in front of the user instead of hiding it in a constant.
 *
 * `strokesPerYear` is negative for improvement.
 */
export const SCENARIOS = Object.freeze([
  Object.freeze({ key: "hold", label: "No change", strokesPerYear: 0,
    blurb: "You keep shooting what you shoot today." }),
  Object.freeze({ key: "steady", label: "Steady gains", strokesPerYear: -1,
    blurb: "One stroke a year. Modest, consistent progress." }),
  Object.freeze({ key: "strong", label: "Strong gains", strokesPerYear: -2,
    blurb: "Two strokes a year. Growth spurt plus serious practice." }),
]);

/** Conservative default: assume nothing until the data earns it. */
export const DEFAULT_SCENARIO = "steady";

export const scenarioByKey = (key) =>
  SCENARIOS.find((s) => s.key === key) ?? SCENARIOS.find((s) => s.key === DEFAULT_SCENARIO);
