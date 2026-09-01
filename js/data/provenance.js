/**
 * data/provenance.js — where every number on screen actually came from.
 *
 * WHY THIS FILE EXISTS
 * The person building this product is not a golfer, and neither is the agent
 * that wrote it. That is a normal situation and a survivable one -- but it
 * means nobody involved can look at "team scoring average 76.8" and instinctively
 * think "that is wrong". The usual safety net (domain intuition) is absent.
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
    what: "Every team scoring average",
    source: "INVENTED. Real source would be Golfstat / Clippd team season stats",
  },
  {
    group: "College database",
    status: "fabricated",
    what: "Every 'typical recruit rank'",
    source: "INVENTED. Real source would be JGS/AJGA ranks of actual signed recruits",
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
    what: "Component weights (scoring 68/32 rank, athletic 62/38 academic)",
    source: "A modelling choice. Not validated against any recruiting outcome data",
  },
  {
    group: "Fit model",
    status: "assumption",
    what: "Tier thresholds (Likely 78+, Target 58+)",
    source: "A modelling choice. Not validated against any recruiting outcome data",
  },
  {
    group: "Fit model",
    status: "assumption",
    what: "Improvement scenarios (0 / 1 / 2 strokes per year)",
    source: "Explicitly user-chosen. Luke's own measured trend is +0.12/yr and noisy",
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
