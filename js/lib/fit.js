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
 *   Athletic Fit  (one signal, age-normalized on purpose)
 *     - roster rank : golfer's current JGS national rank vs the AVERAGE
 *                     senior-year JGS rank of the players currently on the
 *                     roster. Rank-vs-rank is apples-to-apples in a way that a
 *                     junior's scoring average vs a college roster's scoring
 *                     average never is: both numbers were produced by teenage
 *                     golfers competing under the same ranking system.
 *   Academic Fit
 *     - gpa       : golfer GPA vs the school's average admitted GPA
 *     - testing   : golfer SAT vs the school's average admitted SAT
 *
 * Golf outweighs grades because this is a golf recruiting product, but
 * academics are a hard gate at selective schools — see ACADEMIC_GATE.
 *
 * WHY THE OLD SCORING-AVERAGE COMPONENT IS GONE
 *   Comparing a junior's 18-hole scoring average to a college roster's team
 *   average punished younger golfers by construction and needed a projection
 *   layer to compensate. Projection meant either inventing a strokes-per-year
 *   rate or asking the golfer to pick one, both of which parked a made-up
 *   number at the centre of the score. The roster's senior-year JGS rank is a
 *   real historical fact about real players and does not need a projection to
 *   be fair to a 13-year-old.
 */

// ---------------------------------------------------------------------------
// Tunables. Change the model here and nowhere else.
// ---------------------------------------------------------------------------

export const WEIGHTS = Object.freeze({
  athletic: 0.62,
  academic: 0.38,
  // within academic
  gpa: 0.55,
  testing: 0.45,
});

export const BANDS = Object.freeze({
  /** Ratio of golferRank / avgRosterSeniorJgsRank that maps to 100/0.
   *  0.5 = you rank twice as high as the average roster player was as a HS
   *  senior (a stone-cold fit). 3.0 = you are three times worse (a stretch). */
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
 * why one function handles rank ratios (lower is better) and GPA (higher is
 * better) without splitting into two near-identical helpers. DRY.
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

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------
//
// Each verdict turns two numbers into a plain-English direction ("ahead",
// "behind", or "level") plus a phrase suitable for showing under a visual
// comparison. "Ahead" always means "the golfer is doing better than the
// benchmark", regardless of whether the underlying metric rewards lower
// (rank) or higher (GPA, SAT) numbers. That is what lets one CSS tint colour
// the whole comparison block correctly across three different stats.
//
// These live in fit.js so BOTH the scoring engine (as a component `detail`
// string) and the UI (as the label under a visual pair) can share them. One
// source of truth stops the number on screen from disagreeing with the
// sentence next to it.

/**
 * Compare a golfer's rank to a roster's average senior-year rank. Ratio-based
 * because ranks span orders of magnitude and a "3.2\u00d7 behind" reads far
 * better than a raw delta of "10,217 places behind".
 *
 * @param {number} golferRank
 * @param {number} rosterRank
 * @returns {{ratio:?number, direction:"ahead"|"behind"|"level",
 *            multiple:number, phrase:string}}
 */
export function rankVerdict(golferRank, rosterRank) {
  const ratio = golferRank / rosterRank;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { ratio: null, direction: "level", multiple: 1, phrase: "" };
  }
  // Round on a coarser grid the further apart the two ranks get. "3.2x" is
  // useful; "31.4x" is theatre -- the underlying data isn't that precise.
  const raw = ratio < 1 ? 1 / ratio : ratio;
  const multiple = raw >= 10 ? Math.round(raw) : Math.round(raw * 10) / 10;

  if (Math.abs(ratio - 1) < 0.05) {
    return { ratio, direction: "level", multiple: 1,
      phrase: "You rank about level with the roster's HS-senior average." };
  }
  const direction = ratio < 1 ? "ahead" : "behind";
  const phrase = direction === "ahead"
    ? `You rank ${multiple}\u00d7 ahead of the roster's HS-senior average.`
    : `You rank ${multiple}\u00d7 behind the roster's HS-senior average.`;
  return { ratio, direction, multiple, phrase };
}

/**
 * Compare a golfer's GPA to a school's admitted average. Delta-based -- GPA
 * lives on a 0-4 scale, so "+0.15" is the language admissions counsellors
 * actually use. A ratio would be nonsense on a bounded scale.
 *
 * @param {number} golferGpa
 * @param {number} schoolGpa
 * @returns {{delta:?number, direction:"ahead"|"behind"|"level", phrase:string}}
 */
export function gpaVerdict(golferGpa, schoolGpa) {
  if (!Number.isFinite(golferGpa) || !Number.isFinite(schoolGpa)) {
    return { delta: null, direction: "level", phrase: "" };
  }
  const delta = Math.round((golferGpa - schoolGpa) * 100) / 100;
  // 0.03 GPA points is inside the noise of a single quarter's grades. Calling
  // that a difference implies a precision the input does not have.
  if (Math.abs(delta) < 0.03) {
    return { delta, direction: "level",
      phrase: "Your GPA is roughly level with the school's average." };
  }
  const direction = delta > 0 ? "ahead" : "behind";
  const magnitude = Math.abs(delta).toFixed(2);
  const phrase = direction === "ahead"
    ? `Your GPA sits +${magnitude} above the school's average.`
    : `Your GPA sits ${magnitude} below the school's average.`;
  return { delta, direction, phrase };
}

/**
 * Compare a golfer's SAT to a school's admitted average. Delta-based on the
 * ~400-1600 scale; SAT sub-scores aren't linearly meaningful below ten points
 * or so, which is why the level threshold sits there.
 *
 * @param {number} golferSat
 * @param {number} schoolSat
 * @returns {{delta:?number, direction:"ahead"|"behind"|"level", phrase:string}}
 */
export function satVerdict(golferSat, schoolSat) {
  if (!Number.isFinite(golferSat) || !Number.isFinite(schoolSat)) {
    return { delta: null, direction: "level", phrase: "" };
  }
  const delta = Math.round(golferSat - schoolSat);
  if (Math.abs(delta) < 10) {
    return { delta, direction: "level",
      phrase: "Your SAT is roughly level with the school's average." };
  }
  const direction = delta > 0 ? "ahead" : "behind";
  const magnitude = Math.abs(delta);
  const phrase = direction === "ahead"
    ? `Your SAT sits +${magnitude} above the school's average.`
    : `Your SAT sits ${magnitude} below the school's average.`;
  return { delta, direction, phrase };
}

function rosterRankComponent(golfer, school) {
  const ratio = golfer.nationalRank / school.avgRosterSeniorJgsRank;
  const score = scale(ratio, BANDS.rankBest, BANDS.rankWorst);
  const { phrase } = rankVerdict(golfer.nationalRank, school.avgRosterSeniorJgsRank);
  const detail =
    `You rank #${golfer.nationalRank}; this roster's current players ` +
    `averaged #${school.avgRosterSeniorJgsRank} at the end of high school. ` +
    phrase;
  return { score, detail };
}

function gpaComponent(golfer, school) {
  const delta = golfer.gpa - school.avgGPA;
  const score = scale(delta, BANDS.gpaBest, BANDS.gpaWorst);
  const { phrase } = gpaVerdict(golfer.gpa, school.avgGPA);
  const detail =
    `Your ${golfer.gpa.toFixed(2)} GPA vs the school's ${school.avgGPA.toFixed(2)} average. ` +
    phrase;
  return { score, detail };
}

function testingComponent(golfer, school) {
  const delta = golfer.sat - school.avgSAT;
  const score = scale(delta, BANDS.satBest, BANDS.satWorst);
  const { phrase } = satVerdict(golfer.sat, school.avgSAT);
  const detail =
    `Your ${golfer.sat} SAT vs the school's ${school.avgSAT} average. ` + phrase;
  return { score, detail };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Head coach contact
// ---------------------------------------------------------------------------
//
// Each college row can carry `headCoaches: { men, women }`, merged in from
// data/coaches.js -- real names and contact details copied from each
// program's official staff page, with a verification date. The golfer sees
// the coach's name, email and phone right on the card instead of being sent
// off-site to hunt for them.
//
// The tradeoff is staleness: coach turnover is ~10-15% a year, so the data
// file carries a verified-on date that the UI prints next to every card.

/**
 * The team side whose coach we show. Falls back to men's when the golfer
 * profile does not publish a gender -- Luke's site does not carry the field,
 * and a null default would hide the coach card entirely.
 *
 * @param {Object} golfer
 * @returns {"men"|"women"}
 */
export function coachGenderFor(golfer) {
  return golfer?.gender === "women" ? "women" : "men";
}

/**
 * The head coach on file for a program, or null when none is.
 *
 * Blank / whitespace-only email and phone values are normalised to null so a
 * data-entry slip renders as "not published" rather than an empty mailto.
 *
 * @param {Object} school
 * @param {"men"|"women"} gender
 * @returns {{name:string, title:string, email:string|null, phone:string|null}|null}
 */
export function headCoachFor(school, gender = "men") {
  const coach = school?.headCoaches?.[gender];
  if (!coach || typeof coach.name !== "string" || !coach.name.trim()) return null;
  const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    name: coach.name.trim(),
    title: clean(coach.title) ?? "Head Coach",
    email: clean(coach.email),
    phone: clean(coach.phone),
  };
}

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

/** Athletic fit needs a national rank. Everything else in the engine is optional. */
export const isScorable = (golfer) =>
  Number.isFinite(Number(golfer?.nationalRank));

/** Pull a 4-digit graduation year out of "Class of 2031". Kept for UI copy
 *  ("you are N years from enrolling") even though projection no longer uses it. */
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
 * Score one golfer against one school.
 * @returns {{overall:number, athletic:?number, academic:?number, tier:string,
 *            components:Array, capped:boolean, academicKnown:boolean,
 *            rankKnown:boolean}}
 *
 * `athletic` is null when the golfer has no national rank on file.
 * `academic` is null when the golfer has no GPA/SAT on file. Render both as
 * "not yet", NEVER as zero -- unknown and bad are different facts, and
 * conflating them tells a golfer he is a poor athlete/student when he is
 * simply un-measured.
 */
export function scoreSchool(golfer, school) {
  const rankKnown = isScorable(golfer);
  const academicsKnown = hasAcademics(golfer);
  const components = [];

  // No rank AND no academics -> nothing to score. Refusing to guess is the
  // feature; this returns an explicit unscored result rather than a zero.
  if (!rankKnown && !academicsKnown) {
    return {
      overall: null,
      athletic: null,
      academic: null,
      academicKnown: false,
      rankKnown: false,
      tier: "reach",
      capped: false,
      components,
    };
  }

  let athletic = null;
  if (rankKnown) {
    const roster = rosterRankComponent(golfer, school);
    athletic = roster.score;
    components.push({
      key: "roster-rank",
      label: "Roster fit",
      ...roster,
      score: round(roster.score, 0),
    });
  }

  // No academics on file -> Athletic Fit stands alone. We deliberately do NOT
  // substitute a league-average GPA to fill the gap. A fabricated input yields
  // a confident wrong answer, which is the worst thing a recruiting tool can
  // produce.
  if (!academicsKnown) {
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

  // No rank on file -> Academic Fit stands alone. Symmetric to the athletic-
  // only branch above: an input we cannot fairly compare is dropped, not zeroed.
  if (!rankKnown) {
    components.push(
      { key: "gpa",     label: "GPA",        ...gpa,     score: round(gpa.score, 0) },
      { key: "testing", label: "Test score", ...testing, score: round(testing.score, 0) }
    );
    return {
      overall: round(academic, 0),
      athletic: null,
      academic: round(academic, 0),
      academicKnown: true,
      rankKnown: false,
      tier: tierFor(academic),
      capped: false,
      components,
    };
  }

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
    rankKnown: true,
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
  const { divisions, regions, maxTuition, publicOnly, search } = prefs;
  if (divisions?.length && !divisions.includes(school.division)) return false;
  if (regions?.length && !regions.includes(school.region)) return false;
  if (maxTuition && school.tuition > maxTuition) return false;
  if (publicOnly && school.type !== "Public") return false;
  // Text search across name + conference. Case-insensitive substring: "stan"
  // finds Stanford, "acc" finds every ACC school. Whitespace-only input is
  // treated as no filter -- a stray space should not empty the list.
  if (typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    const haystack = `${school.name} ${school.conference || ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

/**
 * Score a golfer against a list of schools, filtered and ranked.
 * Schools that come back unscorable (both rank and academics missing) are
 * dropped rather than sorted as null.
 * @returns {Array<{school:Object, fit:Object}>} best fit first.
 */
export function rankSchools(golfer, schools, prefs = {}) {
  return schools
    .filter((s) => matchesPrefs(s, prefs))
    .map((school) => ({ school, fit: scoreSchool(golfer, school) }))
    .filter((row) => row.fit.overall != null)
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
 * Ties inside a division break on avgRosterSeniorJgsRank -- a real, measured
 * number -- rather than on array order, so the answer does not depend on how
 * the data file happens to be sorted. Lower rank = tougher roster.
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

    // Same division: the tougher roster wins. Lower avg senior-year rank means
    // the current players were higher-ranked juniors -- a real, measured fact
    // about who this program signs, not a stylistic preference.
    return row.school.avgRosterSeniorJgsRank < leader.school.avgRosterSeniorJgsRank
      ? row
      : leader;
  }, shortlist[0]);
}

/** Bucket ranked results into likely/target/reach, preserving order. */
export function groupByTier(ranked) {
  const groups = { likely: [], target: [], reach: [] };
  for (const row of ranked) groups[row.fit.tier].push(row);
  return groups;
}
