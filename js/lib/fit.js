/**
 * fit.js — the College Best-Fit scoring engine.
 *
 * DESIGN RULES (please keep them):
 *   1. Pure functions only. No DOM, no fetch, no localStorage, no `window`.
 *      Feed it data, get data back. That makes it unit-testable today and
 *      liftable into a Postgres function / edge function tomorrow with zero
 *      rewrites.
 *   2. Every weight and threshold is a named constant in WEIGHTS/BANDS below.
 *      Magic numbers buried in an if-statement are how a scoring model becomes
 *      folklore nobody dares touch.
 *   3. Every score ships with its *reasoning*. A bare "87" is a horoscope; a
 *      golfer needs to know which lever to pull. Explicit is better than
 *      implicit.
 *
 * MODEL
 *   Fit = weighted blend of Athletic Fit and Academic Fit, each 0-100.
 *
 *   Athletic Fit
 *     - scoring   : golfer scoring average vs the team's average
 *     - ranking   : golfer national rank vs the rank the program typically recruits
 *   Academic Fit
 *     - gpa       : golfer GPA vs the school's average admitted GPA
 *     - testing   : golfer SAT vs the school's average admitted SAT
 *
 * Golf outweighs grades because this is a golf recruiting product, but
 * academics are a hard gate at selective schools — see ACADEMIC_GATE.
 */

// ---------------------------------------------------------------------------
// Tunables. Change the model here and nowhere else.
// ---------------------------------------------------------------------------

export const WEIGHTS = Object.freeze({
  athletic: 0.62,
  academic: 0.38,
  // within athletic
  scoring: 0.68,
  ranking: 0.32,
  // within academic
  gpa: 0.55,
  testing: 0.45,
});

export const BANDS = Object.freeze({
  /** Strokes better(-)/worse(+) than the team average that map to 100/0. */
  scoringBest: -1.5,
  scoringWorst: 6.0,
  /** Ratio of golferRank / programRecruitRank that maps to 100/0. */
  rankBest: 0.5,
  rankWorst: 3.0,
  /** GPA points above/below the school average that map to 100/0. */
  gpaBest: 0.35,
  gpaWorst: -0.75,
  /** SAT points above/below the school average that map to 100/0. */
  satBest: 120,
  satWorst: -260,
});

export const TIERS = Object.freeze({
  likely: 78,
  target: 58,
});

/**
 * Bounds on any forward projection.
 *
 * WHY PROJECTION EXISTS AT ALL
 * Comparing a 13-year-old's scoring average against a CURRENT college roster is
 * meaningless -- he does not arrive on campus for five years. Scored raw, Luke
 * Selzer lands on 0/100 at 24 of 27 programs. That is not insight, it is a
 * child being told he is worthless at golf.
 *
 * WHY THE RATE IS NOT DEFINED HERE
 * This module used to carry `strokesPerYear: 1.6`. That number was invented,
 * and Luke's 29 real events measured his actual trend at +0.11 strokes/year --
 * flat, with round-to-round noise larger than any annual signal. A fabricated
 * constant buried in the engine is exactly the kind of confident-and-wrong that
 * this whole file is supposed to avoid.
 *
 * So the rate is now an ARGUMENT, chosen by the golfer from SCENARIOS in
 * lib/trend.js and labelled in the UI as a what-if. See README.
 */
export const IMPROVEMENT = Object.freeze({
  /** Nobody projects below this. Keeps the maths from promising a 12-year-old a 62. */
  floor: 68.0,
  /** Beyond this horizon the projection is fantasy, so stop compounding. */
  maxYears: 5,
  /** Only project when a golfer is at least this many years out. */
  minYears: 2,
});

/**
 * If academic fit is catastrophic, no amount of golf saves the application.
 * Caps the overall score rather than silently letting a 95 athletic score
 * drag an academically impossible school into "Likely".
 */
export const ACADEMIC_GATE = Object.freeze({ below: 30, capOverall: 55 });

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

export const clamp = (n, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/**
 * Map `value` from the range [best, worst] onto [100, 0], clamped.
 * Works whether `best` is numerically higher or lower than `worst`, which is
 * why scoring average (lower is better) and GPA (higher is better) can share
 * one function instead of two near-identical ones. DRY.
 */
export function scale(value, best, worst) {
  if (best === worst) return 50;
  return clamp(((value - worst) / (best - worst)) * 100);
}

const round = (n, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------------
// Component scores — each returns { score, detail }
// ---------------------------------------------------------------------------

function scoringComponent(golfer, school) {
  const gap = golfer.scoringAvg - school.teamScoringAvg; // negative == better
  const score = scale(gap, BANDS.scoringBest, BANDS.scoringWorst);
  const abs = Math.abs(round(gap, 1));
  const detail =
    gap <= 0
      ? `Your ${golfer.scoringAvg} average is ${abs} better than the roster's ${school.teamScoringAvg}.`
      : `Your ${golfer.scoringAvg} average is ${abs} behind the roster's ${school.teamScoringAvg}.`;
  return { score, detail };
}

function rankingComponent(golfer, school) {
  const ratio = golfer.nationalRank / school.recruitRank; // <1 == better
  const score = scale(ratio, BANDS.rankBest, BANDS.rankWorst);
  const detail =
    ratio <= 1
      ? `You rank #${golfer.nationalRank} nationally; this program typically recruits around #${school.recruitRank}.`
      : `You rank #${golfer.nationalRank}; this program typically recruits around #${school.recruitRank}.`;
  return { score, detail };
}

function gpaComponent(golfer, school) {
  const delta = golfer.gpa - school.avgGPA;
  const score = scale(delta, BANDS.gpaBest, BANDS.gpaWorst);
  const detail = `Your ${golfer.gpa.toFixed(2)} GPA vs the school's ${school.avgGPA.toFixed(2)} average.`;
  return { score, detail };
}

function testingComponent(golfer, school) {
  const delta = golfer.sat - school.avgSAT;
  const score = scale(delta, BANDS.satBest, BANDS.satWorst);
  const detail = `Your ${golfer.sat} SAT vs the school's ${school.avgSAT} average.`;
  return { score, detail };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function tierFor(overall) {
  if (overall >= TIERS.likely) return "likely";
  if (overall >= TIERS.target) return "target";
  return "reach";
}

export const TIER_COPY = Object.freeze({
  likely: { label: "Likely", blurb: "A strong-odds program to pursue." },
  target: { label: "Target", blurb: "A realistic program to prioritize." },
  reach:  { label: "Reach",  blurb: "A stretch program to chase." },
});

/** Academics can only be scored once BOTH numbers exist. */
export const hasAcademics = (golfer) =>
  Number.isFinite(Number(golfer?.gpa)) &&
  Number.isFinite(Number(golfer?.sat)) &&
  golfer?.gpa != null &&
  golfer?.sat != null;

/**
 * A national junior rank is only comparable to a program's recruit rank when
 * the golfer is actually in the recruiting pool. A 13-year-old sits behind
 * every 17-year-old in the country by construction, so his overall rank says
 * nothing about his ceiling. Projection turns this off explicitly.
 */
export const hasComparableRank = (golfer) =>
  golfer?.nationalRank != null && golfer?.rankComparable !== false;

/** Pull a 4-digit graduation year out of "Class of 2031". */
export function graduationYear(golfer) {
  const match = String(golfer?.class_year ?? "").match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Whole years between today and the golfer's graduation. Null if unknown. */
export function yearsToGraduation(golfer, today = new Date()) {
  const grad = graduationYear(golfer);
  return grad == null ? null : grad - today.getFullYear();
}

/**
 * Project a young golfer forward to their enrolment year.
 *
 * Returns the golfer unchanged (and `projected: false`) for anyone inside the
 * recruiting window -- seniors and juniors get scored on what they actually
 * shoot today, because that is what coaches are looking at. Also returns them
 * unchanged when the chosen rate is 0, because "no change" is a legitimate and
 * arguably the most defensible scenario.
 *
 * @param {Object} golfer
 * @param {Object} [options]
 * @param {number} [options.strokesPerYear=0] NEGATIVE improves. Supplied by the
 *   caller from SCENARIOS -- this module refuses to invent one.
 * @param {Date} [options.today]
 * @returns {{golfer:Object, projected:boolean, years:?number,
 *            strokesPerYear:number,
 *            currentScoringAvg:?number, projectedScoringAvg:?number}}
 */
export function projectGolfer(golfer, { strokesPerYear = 0, today = new Date() } = {}) {
  const years = yearsToGraduation(golfer, today);
  const unchanged = {
    golfer,
    projected: false,
    years,
    strokesPerYear,
    currentScoringAvg: golfer?.scoringAvg ?? null,
    projectedScoringAvg: null,
  };

  if (years == null || years < IMPROVEMENT.minYears) return unchanged;
  if (!Number.isFinite(Number(golfer?.scoringAvg))) return unchanged;
  if (!strokesPerYear) return unchanged;

  const horizon = Math.min(years, IMPROVEMENT.maxYears);
  const projectedScoringAvg = Math.max(
    IMPROVEMENT.floor,
    Number(golfer.scoringAvg) + horizon * strokesPerYear
  );

  return {
    golfer: {
      ...golfer,
      scoringAvg: Math.round(projectedScoringAvg * 100) / 100,
      // Today's overall junior rank is not comparable to a college recruit
      // rank once we are talking about a future version of this golfer.
      rankComparable: false,
    },
    projected: true,
    years,
    strokesPerYear,
    currentScoringAvg: Number(golfer.scoringAvg),
    projectedScoringAvg: Math.round(projectedScoringAvg * 100) / 100,
  };
}
/**
 * Score one golfer against one school.
 * @returns {{overall:number, athletic:number, academic:?number, tier:string,
 *            components:Array, capped:boolean, academicKnown:boolean}}
 *
 * `academic` is null when the golfer has no GPA/SAT on file. Render that as
 * "not yet", NEVER as zero -- unknown and bad are different facts, and
 * conflating them tells a 13-year-old he is a poor student.
 */
export function scoreSchool(golfer, school) {
  const scoring = scoringComponent(golfer, school);
  const rankKnown = hasComparableRank(golfer);

  const components = [
    { key: "scoring", label: "Scoring average", ...scoring, score: round(scoring.score, 0) },
  ];

  // Same principle as academics: an input we cannot fairly compare is dropped
  // and its weight redistributed, never silently scored as zero.
  let athletic = scoring.score;
  if (rankKnown) {
    const ranking = rankingComponent(golfer, school);
    athletic = scoring.score * WEIGHTS.scoring + ranking.score * WEIGHTS.ranking;
    components.push({
      key: "ranking",
      label: "National ranking",
      ...ranking,
      score: round(ranking.score, 0),
    });
  }

  // No academics on file -> Athletic Fit stands alone. We deliberately do NOT
  // substitute a league-average GPA to fill the gap. A fabricated input yields
  // a confident wrong answer, which is the worst thing a recruiting tool can
  // produce. Refusing to guess is the feature.
  if (!hasAcademics(golfer)) {
    return {
      overall: round(athletic, 0),
      athletic: round(athletic, 0),
      academic: null,
      academicKnown: false,
      rankKnown,
      tier: tierFor(athletic),
      capped: false,
      components,
    };
  }

  const gpa = gpaComponent(golfer, school);
  const testing = testingComponent(golfer, school);
  const academic = gpa.score * WEIGHTS.gpa + testing.score * WEIGHTS.testing;

  let overall = athletic * WEIGHTS.athletic + academic * WEIGHTS.academic;

  const capped = academic < ACADEMIC_GATE.below && overall > ACADEMIC_GATE.capOverall;
  if (capped) overall = ACADEMIC_GATE.capOverall;

  components.push(
    { key: "gpa",     label: "GPA",        ...gpa,     score: round(gpa.score, 0) },
    { key: "testing", label: "Test score", ...testing, score: round(testing.score, 0) }
  );

  return {
    overall: round(overall, 0),
    athletic: round(athletic, 0),
    academic: round(academic, 0),
    academicKnown: true,
    rankKnown,
    tier: tierFor(overall),
    capped,
    components,
  };
}

/**
 * Does this school survive the golfer's hard preferences?
 * Preferences FILTER, they do not nudge the score — mixing "what I want" into
 * "where I fit" produces a number that means neither thing.
 */
export function matchesPrefs(school, prefs = {}) {
  const { divisions, regions, maxTuition, publicOnly } = prefs;
  if (divisions?.length && !divisions.includes(school.division)) return false;
  if (regions?.length && !regions.includes(school.region)) return false;
  if (maxTuition && school.tuition > maxTuition) return false;
  if (publicOnly && school.type !== "Public") return false;
  return true;
}

/**
 * Score a golfer against a list of schools, filtered and ranked.
 * @returns {Array<{school:Object, fit:Object}>} best fit first.
 */
export function rankSchools(golfer, schools, prefs = {}) {
  return schools
    .filter((s) => matchesPrefs(s, prefs))
    .map((school) => ({ school, fit: scoreSchool(golfer, school) }))
    .sort((a, b) => b.fit.overall - a.fit.overall);
}

/**
 * How competitive a program is as a place to play golf, strongest first.
 *
 * NAIA sits above D3 deliberately: Keiser and Dalton State recruit nationally
 * and beat most of D2, while D3 golf cannot offer athletic money at all. Sorted
 * by how hard it is to get minutes, not by how famous the school is.
 */
export const PROGRAM_STRENGTH = Object.freeze({ D1: 4, D2: 3, NAIA: 2, D3: 1 });

/** How far below the best fit a school can sit and still count as "comparable". */
export const HIGHLIGHT_BAND = 12;

/**
 * Choose the ONE school to feature, given an already-ranked list.
 *
 * ---------------------------------------------------------------------------
 * THIS DOES NOT TOUCH THE SCORE. READ THIS BEFORE "SIMPLIFYING" IT.
 * ---------------------------------------------------------------------------
 * The obvious implementation is to add a division bonus inside scoreSchool()
 * so D1 programs score higher. That would be a lie: wanting D1 does not make a
 * golfer fit D1, and a fit number that has ambition baked into it means
 * neither "where I fit" nor "what I want". The same rule already governs
 * matchesPrefs(). Scores stay honest; only the CHOICE OF WHAT TO FEATURE
 * changes here.
 *
 * The rule: take everything within HIGHLIGHT_BAND points of the best fit --
 * those are statistically indistinguishable given how coarse this data is --
 * and among that shortlist feature the most competitive program.
 *
 * Why this is not cheating: a golfer who fits Adrian (76.8 team average) at 15
 * and Carnegie Mellon (75.4) at 14 is, within the noise, an equally plausible
 * recruit at both. Leading with the stronger program is a better
 * recommendation, and leading with whichever happened to win by one point is
 * false precision.
 *
 * Ties inside a division break on teamScoringAvg -- a real, measured number --
 * rather than on array order, so the answer does not depend on how the data
 * file happens to be sorted.
 *
 * @param {Array<{school:Object, fit:Object}>} ranked best-fit-first
 * @returns {{school:Object, fit:Object}|null}
 */
export function pickHighlight(ranked, band = HIGHLIGHT_BAND) {
  if (!ranked?.length) return null;

  const best = ranked[0].fit.overall;
  const shortlist = ranked.filter((row) => best - row.fit.overall <= band);

  return shortlist.reduce((leader, row) => {
    const byStrength =
      (PROGRAM_STRENGTH[row.school.division] ?? 0) -
      (PROGRAM_STRENGTH[leader.school.division] ?? 0);
    if (byStrength !== 0) return byStrength > 0 ? row : leader;

    // Same division: the tougher team wins. Lower stroke average = tougher.
    return row.school.teamScoringAvg < leader.school.teamScoringAvg ? row : leader;
  }, shortlist[0]);
}

/** Bucket ranked results into likely/target/reach, preserving order. */
export function groupByTier(ranked) {
  const groups = { likely: [], target: [], reach: [] };
  for (const row of ranked) groups[row.fit.tier].push(row);
  return groups;
}
