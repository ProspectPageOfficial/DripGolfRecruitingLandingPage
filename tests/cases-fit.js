/**
 * tests/cases-fit.js — the fit engine's maths.
 *
 * The scoring engine: scales, tiers, weights, preferences, projection and the
 * measured trend. Pure maths on fixed fixtures -- no network, no storage, and
 * no opinion about where the golfer's numbers came from.
 */
import {
  scoreSchool,
  rankSchools,
  pickHighlight,
  groupByTier,
  PROGRAM_STRENGTH,
  HIGHLIGHT_BAND,
  matchesPrefs,
  tierFor,
  scale,
  hasAcademics,
  hasComparableRank,
  projectGolfer,
  yearsToGraduation,
  graduationYear,
  IMPROVEMENT,
  TIERS,
  ACADEMIC_GATE,
} from "../js/lib/fit.js";
import {
  measureTrend,
  seasonAverages,
  scenarioByKey,
  rollingScoringAvg,
  SCENARIOS,
  DEFAULT_SCENARIO,
} from "../js/lib/trend.js";
import { colleges, collegeById } from "../js/data/colleges.js";
import { buildGolfer } from "../js/data/golfer.js";

const elite = { scoringAvg: 69.5, nationalRank: 8, gpa: 3.97, sat: 1540 };
const mid = { scoringAvg: 73.2, nationalRank: 165, gpa: 3.5, sat: 1200 };
const brainyButRusty = { scoringAvg: 78.0, nationalRank: 900, gpa: 4.0, sat: 1580 };
const golfOnly = { scoringAvg: 69.0, nationalRank: 5, gpa: 2.1, sat: 820 };
/** A middle schooler: real game, no academics on file. Modelled on Luke. */
const noAcademics = { scoringAvg: 81.12, nationalRank: 10557 };
const luke = buildGolfer();
/** Fixed clock so "years to graduation" cases do not rot next January. */
const AT_2026 = new Date("2026-06-01T12:00:00");
const stanford = collegeById["stanford"];
const adrian = collegeById["adrian"];
/** Two schools identical but for the thing under test. */
const pick = (division, overall, teamScoringAvg = 73) => ({
  school: { name: division + overall, division, teamScoringAvg },
  fit: { overall, tier: "target" },
});
export const fitCases = [
  {
    name: "rollingScoringAvg() ignores partial rounds and empty events",
    run: (assert) => {
      const events = [
        { date: "2026-01-01", rounds: [80, 22] },  // 22 is a 9-hole card
        { date: "2025-01-01", rounds: [] },        // registered, never played
        { date: "2024-01-01", rounds: [82] },
      ];
      assert.equal(rollingScoringAvg(events), 81);
      assert.equal(rollingScoringAvg([]), null);
      assert.equal(rollingScoringAvg(undefined), null);
      assert.equal(rollingScoringAvg([{ date: "2026-01-01", rounds: [] }]), null);
    },
  },
  {
    name: "pickHighlight() prefers the stronger program among comparable fits",
    run: (assert) => {
      // The D3 wins on raw score, but by less than the band -- inside the noise
      // of this data, which makes the D1 the better recommendation.
      assert.equal(pickHighlight([pick("D3", 60), pick("D1", 55)]).school.division, "D1");
    },
  },
  {
    name: "pickHighlight() will NOT reach past the band for a stronger program",
    run: (assert) => {
      // A genuinely better fit stays the answer. Ambition does not get to
      // override a gap this size, or the recommendation becomes a wish.
      const far = [pick("D3", 90), pick("D1", 90 - HIGHLIGHT_BAND - 1)];
      assert.equal(pickHighlight(far).school.division, "D3");
    },
  },
  {
    name: "pickHighlight() breaks same-division ties on the tougher team",
    run: (assert) => {
      const ranked = [pick("D1", 80, 72.5), pick("D1", 78, 69.9)];
      assert.equal(pickHighlight(ranked).school.teamScoringAvg, 69.9);
    },
  },
  {
    name: "program strength orders D1 > D2 > NAIA > D3",
    run: (assert) => {
      assert.ok(PROGRAM_STRENGTH.D1 > PROGRAM_STRENGTH.D2);
      assert.ok(PROGRAM_STRENGTH.D2 > PROGRAM_STRENGTH.NAIA);
      assert.ok(PROGRAM_STRENGTH.NAIA > PROGRAM_STRENGTH.D3);
    },
  },
  {
    name: "pickHighlight() returns null rather than throwing on nothing",
    run: (assert) => {
      assert.equal(pickHighlight([]), null);
      assert.equal(pickHighlight(undefined), null);
    },
  },
  {
    name: "pickHighlight() changes only the CHOICE, never the fit scores",
    run: (assert) => {
      // The guard on this whole design. If featuring a D1 ever inflates what
      // that D1 scored, ambition has leaked into the engine and every number
      // in the product is suspect.
      const ranked = rankSchools(elite, colleges);
      const before = ranked.map((r) => r.fit.overall);
      pickHighlight(ranked);
      assert.deepEqual(ranked.map((r) => r.fit.overall), before);
    },
  },
  {
    name: "scale() maps best/worst onto 100/0 and clamps outside the range",
    run: (assert) => {
      assert.equal(scale(-1.5, -1.5, 6), 100);
      assert.equal(scale(6, -1.5, 6), 0);
      assert.equal(scale(-99, -1.5, 6), 100);
      assert.equal(scale(99, -1.5, 6), 0);
    },
  },
  {
    name: "scale() handles higher-is-better ranges identically",
    run: (assert) => {
      assert.equal(scale(0.35, 0.35, -0.75), 100);
      assert.equal(scale(-0.75, 0.35, -0.75), 0);
    },
  },
  {
    name: "tier boundaries are inclusive at the threshold",
    run: (assert) => {
      assert.equal(tierFor(TIERS.likely), "likely");
      assert.equal(tierFor(TIERS.likely - 0.001), "target");
      assert.equal(tierFor(TIERS.target), "target");
      assert.equal(tierFor(TIERS.target - 0.001), "reach");
    },
  },
  {
    name: "every score and sub-score stays inside 0-100 for every golfer/school pair",
    run: (assert) => {
      for (const golfer of [elite, mid, brainyButRusty, golfOnly]) {
        for (const school of colleges) {
          const fit = scoreSchool(golfer, school);
          for (const key of ["overall", "athletic", "academic"]) {
            assert.ok(
              fit[key] >= 0 && fit[key] <= 100,
              `${key}=${fit[key]} out of range at ${school.id}`
            );
          }
        }
      }
    },
  },
  {
    name: "an elite golfer outscores a mid golfer at the same school",
    run: (assert) => {
      assert.ok(
        scoreSchool(elite, stanford).overall > scoreSchool(mid, stanford).overall
      );
    },
  },
  {
    name: "beating the team average produces a dominant athletic score",
    run: (assert) => {
      const fit = scoreSchool(elite, adrian);
      assert.ok(fit.athletic > 90, `expected >90, got ${fit.athletic}`);
    },
  },
  {
    name: "the academic gate caps a golf-only prodigy at a selective school",
    run: (assert) => {
      const fit = scoreSchool(golfOnly, stanford);
      assert.equal(fit.capped, true);
      assert.ok(fit.overall <= ACADEMIC_GATE.capOverall);
      assert.notEqual(fit.tier, "likely");
    },
  },
  {
    name: "every score ships with four human-readable components",
    run: (assert) => {
      const fit = scoreSchool(mid, stanford);
      assert.equal(fit.components.length, 4);
      for (const c of fit.components) {
        assert.ok(c.label, "component missing label");
        assert.ok(c.detail, "component missing reasoning");
        assert.equal(typeof c.score, "number");
      }
    },
  },
  {
    name: "preferences filter the list without altering any score",
    run: (assert) => {
      const unfiltered = rankSchools(mid, colleges);
      const d3only = rankSchools(mid, colleges, { divisions: ["D3"] });
      assert.ok(d3only.length < unfiltered.length);
      assert.ok(d3only.every((r) => r.school.division === "D3"));
      const pick = d3only[0];
      const same = unfiltered.find((r) => r.school.id === pick.school.id);
      assert.equal(pick.fit.overall, same.fit.overall);
    },
  },
  {
    name: "matchesPrefs respects tuition ceiling and public-only",
    run: (assert) => {
      assert.equal(matchesPrefs(stanford, { maxTuition: 15000 }), false);
      assert.equal(matchesPrefs(stanford, { publicOnly: true }), false);
      assert.equal(matchesPrefs(collegeById["texas"], { publicOnly: true }), true);
    },
  },
  {
    name: "impossible filter combos return empty, not garbage",
    run: (assert) => {
      const none = rankSchools(mid, colleges, { divisions: ["D1"], maxTuition: 1 });
      assert.equal(none.length, 0);
      assert.deepEqual(groupByTier(none), { likely: [], target: [], reach: [] });
    },
  },
  {
    name: "results come back sorted best-fit first",
    run: (assert) => {
      const ranked = rankSchools(mid, colleges);
      for (let i = 1; i < ranked.length; i += 1) {
        assert.ok(
          ranked[i - 1].fit.overall >= ranked[i].fit.overall,
          "ranking not monotonically descending"
        );
      }
    },
  },
  {
    name: "groupByTier preserves every school",
    run: (assert) => {
      const ranked = rankSchools(mid, colleges);
      const g = groupByTier(ranked);
      assert.equal(g.likely.length + g.target.length + g.reach.length, ranked.length);
    },
  },
  {
    name: "a stronger student gets a better academic fit at a selective school",
    run: (assert) => {
      assert.ok(
        scoreSchool(brainyButRusty, stanford).academic >
          scoreSchool(mid, stanford).academic
      );
    },
  },
  {
    name: "hasAcademics() requires BOTH gpa and sat",
    run: (assert) => {
      assert.equal(hasAcademics(mid), true);
      assert.equal(hasAcademics(noAcademics), false);
      assert.equal(hasAcademics({ scoringAvg: 70, nationalRank: 5, gpa: 3.5 }), false);
      assert.equal(hasAcademics({ scoringAvg: 70, nationalRank: 5, sat: 1200 }), false);
    },
  },
  {
    name: "a golfer with no academics is scored on athletic fit alone",
    run: (assert) => {
      const fit = scoreSchool(noAcademics, adrian);
      assert.equal(fit.academicKnown, false);
      assert.equal(fit.academic, null, "academic must be null, never 0");
      assert.equal(fit.overall, fit.athletic, "overall should equal athletic");
      assert.equal(fit.components.length, 2, "only two components without academics");
      assert.equal(fit.capped, false, "the academic gate must not fire");
    },
  },
  {
    name: "missing academics never fabricates a score across the whole database",
    run: (assert) => {
      for (const school of colleges) {
        const fit = scoreSchool(noAcademics, school);
        assert.equal(fit.academic, null);
        assert.ok(Number.isFinite(fit.overall));
        assert.ok(fit.overall >= 0 && fit.overall <= 100);
      }
    },
  },
  {
    name: "ranking still works end to end for a golfer with no academics",
    run: (assert) => {
      const ranked = rankSchools(noAcademics, colleges);
      assert.equal(ranked.length, colleges.length);
      for (let i = 1; i < ranked.length; i += 1) {
        assert.ok(ranked[i - 1].fit.overall >= ranked[i].fit.overall);
      }
    },
  },
  {
    name: "graduationYear parses 'Class of YYYY' and survives junk",
    run: (assert) => {
      assert.equal(graduationYear({ class_year: "Class of 2031" }), 2031);
      assert.equal(graduationYear({ class_year: "2027" }), 2027);
      assert.equal(graduationYear({ class_year: "" }), null);
      assert.equal(graduationYear({}), null);
    },
  },
  {
    name: "yearsToGraduation counts from the supplied date",
    run: (assert) => {
      const at = (y) => new Date(`${y}-06-01T12:00:00`);
      assert.equal(yearsToGraduation({ class_year: "Class of 2031" }, at(2026)), 5);
      assert.equal(yearsToGraduation({ class_year: "Class of 2027" }, at(2026)), 1);
    },
  },
  {
    name: "golfers inside the recruiting window are NOT projected",
    run: (assert) => {
      const senior = { ...mid, class_year: "Class of 2027" };
      const p = projectGolfer(senior, { strokesPerYear: -2, today: AT_2026 });
      assert.equal(p.projected, false, "a golfer 1 year out must be scored as-is");
      assert.equal(p.golfer.scoringAvg, senior.scoringAvg);
      assert.equal(hasComparableRank(p.golfer), true);
    },
  },
  {
    name: "a zero rate means no projection, even years out",
    run: (assert) => {
      const p = projectGolfer(luke, { strokesPerYear: 0, today: AT_2026 });
      assert.equal(p.projected, false, "'no change' must leave the golfer alone");
      assert.equal(p.golfer.scoringAvg, 81.12);
      assert.equal(hasComparableRank(p.golfer), true);
    },
  },
  {
    name: "the projection rate comes from the caller, never from the engine",
    run: (assert) => {
      assert.equal(
        IMPROVEMENT.strokesPerYear, undefined,
        "fit.js must not carry an invented improvement rate"
      );
      const slow = projectGolfer(luke, { strokesPerYear: -1, today: AT_2026 });
      const fast = projectGolfer(luke, { strokesPerYear: -2, today: AT_2026 });
      assert.ok(fast.projectedScoringAvg < slow.projectedScoringAvg);
      assert.ok(Math.abs(slow.projectedScoringAvg - (81.12 - 5)) < 0.01);
      assert.ok(Math.abs(fast.projectedScoringAvg - (81.12 - 10)) < 0.01);
    },
  },
  {
    name: "a golfer years out loses rank comparability once projected",
    run: (assert) => {
      const p = projectGolfer(luke, { strokesPerYear: -2, today: AT_2026 });
      assert.equal(p.projected, true);
      assert.equal(p.years, 5);
      assert.equal(p.currentScoringAvg, 81.12);
      assert.ok(p.projectedScoringAvg < p.currentScoringAvg);
      assert.equal(hasComparableRank(p.golfer), false);
    },
  },
  {
    name: "projection never drops below the floor",
    run: (assert) => {
      const prodigy = { scoringAvg: 70.0, nationalRank: 3, class_year: "Class of 2033" };
      const p = projectGolfer(prodigy, { strokesPerYear: -3, today: AT_2026 });
      assert.ok(
        p.projectedScoringAvg >= IMPROVEMENT.floor,
        `projected ${p.projectedScoringAvg} below floor ${IMPROVEMENT.floor}`
      );
    },
  },
  {
    name: "an incomparable rank is dropped, not scored as zero",
    run: (assert) => {
      const asis = scoreSchool(luke, adrian);
      const p = projectGolfer(luke, { strokesPerYear: -2, today: AT_2026 });
      const projected = scoreSchool(p.golfer, adrian);
      assert.equal(asis.rankKnown, true);
      assert.equal(projected.rankKnown, false);
      assert.equal(projected.components.length, 1, "only the scoring component survives");
      assert.ok(
        projected.overall > asis.overall,
        "dropping an unfair zero must not make the score worse"
      );
    },
  },
  {
    name: "scoring Luke as-is really is the bleak all-Reach case",
    run: (assert) => {
      const groups = groupByTier(rankSchools(luke, colleges));
      assert.equal(groups.likely.length + groups.target.length, 0,
        "unprojected, a 13-year-old is all Reach - this is the problem");
    },
  },
  {
    name: "a chosen scenario turns Luke's results into an actual plan",
    run: (assert) => {
      const p = projectGolfer(luke, { strokesPerYear: -2, today: AT_2026 });
      const groups = groupByTier(rankSchools(p.golfer, colleges));
      assert.ok(
        groups.likely.length + groups.target.length > 0,
        "under a growth scenario he must have real programs to aim at"
      );
    },
  },

  // ---- measured trend -------------------------------------------------
  {
    name: "seasonAverages buckets by season and drops partial rounds",
    run: (assert) => {
      const seasons = seasonAverages(luke.tournaments);
      assert.equal(seasons.length, 3, "2024, 2025, 2026");
      assert.deepEqual(seasons.map((s) => s.season), ["2024", "2025", "2026"]);
      // The 22 at Kiawah is a partial card and must be excluded.
      const all = luke.tournaments.flatMap((e) => e.rounds);
      assert.ok(all.includes(22), "fixture should contain the partial round");
      assert.ok(
        seasons.every((s) => s.best >= 55),
        "a partial round leaked into the season stats"
      );
    },
  },
  {
    name: "Luke's measured trend is flat, and honestly flagged as noisy",
    run: (assert) => {
      const t = measureTrend(luke.tournaments);
      assert.equal(t.measurable, true);
      assert.ok(
        Math.abs(t.strokesPerYear) < 1,
        `expected a near-flat trend, got ${t.strokesPerYear}`
      );
      assert.ok(t.volatility > 3, "junior scoring is volatile; we should say so");
      assert.equal(t.reliable, false, "noise exceeds signal - must not claim a trajectory");
      assert.ok(t.note.toLowerCase().includes("noise"));
    },
  },
  {
    name: "a golfer with too little history reports no measurable trend",
    run: (assert) => {
      const t = measureTrend([
        { season: "2026", rounds: [74, 75, 76, 77] },
      ]);
      assert.equal(t.measurable, false);
      assert.equal(t.strokesPerYear, null);
      assert.equal(t.reliable, false);
      assert.ok(t.note.length > 0, "must explain itself rather than show a blank");
    },
  },
  {
    name: "measureTrend detects a genuine, low-noise improvement",
    run: (assert) => {
      const t = measureTrend([
        { season: "2024", rounds: [80, 80, 81, 79] },
        { season: "2025", rounds: [77, 77, 78, 76] },
        { season: "2026", rounds: [74, 74, 75, 73] },
      ]);
      assert.equal(t.measurable, true);
      assert.ok(t.strokesPerYear < -2, `expected clear improvement, got ${t.strokesPerYear}`);
      assert.equal(t.reliable, true, "a clean signal should be reported as reliable");
    },
  },
  {
    name: "scenarios are what-ifs with a conservative default",
    run: (assert) => {
      assert.equal(SCENARIOS.length, 3);
      assert.ok(SCENARIOS.every((s) => s.strokesPerYear <= 0), "no scenario predicts decline");
      assert.equal(scenarioByKey("hold").strokesPerYear, 0);
      assert.equal(scenarioByKey("nonsense").key, DEFAULT_SCENARIO, "unknown key falls back");
    },
  },
];
