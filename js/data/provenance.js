/**
 * data/provenance.js — where every number on screen actually came from.
 *
 * WHY THIS FILE EXISTS
 * The person building this product is not a golfer, and neither is the agent
 * that wrote it. That is a normal situation and a survivable one -- but it
 * means nobody involved can look at "average senior-year JGS rank 320" and
 * instinctively think "that is wrong". The usual safety net (domain
 * intuition) is absent.
 *
 * So the software has to carry the warning itself, in one place, and show it in
 * the UI rather than burying it in a README nobody opens twice.
 *
 * RULE: if you add a field to the app, add its provenance here. A number with
 * no entry in this file is a number nobody has vouched for.
 *
 * `status` is deliberately blunt:
 *   "real"        - sourced from a real system, traceable, safe to show.
 *   "fabricated"  - invented to make the demo move. MUST NOT ship.
 *   "assumption"  - a modelling choice, not a measurement. User-visible.
 */

export const STATUS = Object.freeze({
  real: { label: "Real", tone: "likely" },
  fabricated: { label: "Invented", tone: "reach" },
  assumption: { label: "Assumption", tone: "target" },
});

export const PROVENANCE = Object.freeze([
  {
    group: "Golfer profile",
    status: "real",
    what: "Name, hometown, class year, age, photo, height/weight, bio",
    source: "FETCHED LIVE on every page load from lukethomasselzer.com/api/personal",
  },
  {
    group: "Golfer profile",
    status: "real",
    what: "GPA and SAT/ACT (whenever the site publishes them)",
    source: "FETCHED LIVE from /api/personal. Free-form strings ('3.85 / 4.0', '31 ACT') parsed into a numeric GPA and an SAT-equivalent via the College Board / ACT concordance. Absent for Luke on purpose - he is 13",
  },
  {
    group: "Golfer profile",
    status: "real",
    what: "All 29 tournament results, 56 rounds, 2024-2026",
    source: "PORTFOLIO_DATA on the live page -> _ref/gen_luke.py. Snapshot: that page sends no CORS header, so a browser cannot read it directly",
  },
  {
    group: "Golfer profile",
    status: "real",
    what: "Scoring average 81.12",
    source: "COMPUTED from the 29 published results using the JGS 8-event window. Not stored, not typed - a test pins it to the published figure",
  },
  {
    group: "Golfer profile",
    status: "real",
    what: "JGS #10,557, TUGR #8,571, division rank #31, differential 10.61",
    source: "PORTFOLIO_DATA snapshot. These are rankings, not derivable from rounds - they need the site to publish them",
  },
  {
    group: "Golfer profile",
    status: "fabricated",
    what: "Marcus Hale and Ava Nakamura, entirely",
    source: "Invented so the academic half of the engine is demonstrable",
  },
  {
    group: "College database",
    status: "fabricated",
    what: "Every average senior-year JGS rank of the current roster",
    source: "INVENTED. Real source would be JGS historical rank snapshots joined against each program's currently published roster (name + grad year). Requires a JGS data agreement -- no legitimate public export exists at the moment",
  },
  {
    group: "College database",
    status: "fabricated",
    what: "Every average GPA, SAT, tuition and acceptance rate",
    source: "INVENTED. Real source is IPEDS / Common Data Set - free, public, citable",
  },
  {
    group: "College database",
    status: "real",
    what: "School names, divisions and conferences only",
    source: "Public knowledge",
  },
  {
    group: "Fit model",
    status: "assumption",
    what: "Component weights (athletic 62 / academic 38, GPA 55 / SAT 45 inside academic)",
    source: "A modelling choice. Not validated against any recruiting outcome data",
  },
  {
    group: "Fit model",
    status: "assumption",
    what: "Athletic score band (rank ratio 0.5 -> 100, 3.0 -> 0)",
    source: "A modelling choice. The 'rank twice as high as the roster averaged' ceiling and 'three times worse' floor are picks, not measurements",
  },
  {
    group: "Fit model",
    status: "assumption",
    what: "Tier thresholds (Likely 78+, Target 58+)",
    source: "A modelling choice. Not validated against any recruiting outcome data",
  },
  {
    group: "Coach outreach",
    status: "assumption",
    what: "Head coach names, emails and phone numbers are NOT stored on college rows",
    source: "Deliberate. Coach turnover is ~10-15% per year, so any stored record would send a recruit's cold email to a stranger before long. The app links OUT to each program's own coach page (via `athleticsGolfUrl`) when a URL is on file, and to a Google search scoped to '{school} men's/women's golf head coach' otherwise",
  },
]);

/** Counts for the summary line, so it can never drift from the table. */
export function provenanceSummary() {
  const tally = { real: 0, fabricated: 0, assumption: 0 };
  for (const row of PROVENANCE) tally[row.status] += 1;
  return tally;
}

/** True while any fabricated data remains. Gate real launches on this. */
export const hasFabricatedData = () =>
  PROVENANCE.some((row) => row.status === "fabricated");
