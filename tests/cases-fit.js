/**
 * tests/cases-fit.js — the fit engine's maths.
 *
 * The scoring engine: scales, tiers, weights, preferences, and the golfer's
 * measured trend. Pure maths on fixed fixtures -- no network, no storage, and
 * no opinion about where the golfer's numbers came from.
 *
 * The projection / strokes-per-year-scenario suite that used to live here was
 * retired when the engine switched to comparing JGS rank against each
 * roster's senior-year JGS rank. That signal is age-normalized by
 * construction, so a 13-year-old no longer needs a what-if to be scored
 * fairly.
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
  isScorable,
  yearsToGraduation,
  graduationYear,
  rankVerdict,
  gpaVerdict,
  satVerdict,
  headCoachFor,
  coachGenderFor,
  TIERS,
  ACADEMIC_GATE,
} from "../js/lib/fit.js";
import {
  measureTrend,
  seasonAverages,
  rollingScoringAvg,
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
const stanford = collegeById["stanford"];
const adrian = collegeById["adrian"];
/** Two schools identical but for the thing under test. */
const pick = (division, overall, avgRosterSeniorJgsRank = 300) => ({
  school: { name: division + overall, division, avgRosterSeniorJgsRank },
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
    name: "pickHighlight() breaks same-division ties on the tougher roster",
    run: (assert) => {
      // Lower avg senior-year JGS rank = higher-ranked HS players = tougher.
      const ranked = [pick("D1", 80, 220), pick("D1", 78, 70)];
      assert.equal(pickHighlight(ranked).school.avgRosterSeniorJgsRank, 70);
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
      assert.equal(scale(0.5, 0.5, 3.0), 100);
      assert.equal(scale(3.0, 0.5, 3.0), 0);
      assert.equal(scale(-99, 0.5, 3.0), 100);
      assert.equal(scale(99, 0.5, 3.0), 0);
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
    name: "ranking well beneath the roster's HS avg produces a dominant athletic score",
    run: (assert) => {
      // Adrian's roster averaged #1100 as HS seniors; an elite golfer at #8
      // is a ratio of 0.007 -- deep into the 100 band.
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
    name: "every scored fit ships with three human-readable components",
    run: (assert) => {
      // Roster-rank + GPA + testing. Academics-only or athletic-only cases
      // ship with fewer; those are covered in their own dedicated cases.
      const fit = scoreSchool(mid, stanford);
      assert.equal(fit.components.length, 3);
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
    name: "matchesPrefs search matches name + conference, case-insensitive",
    run: (assert) => {
      // Substring on name.
      assert.equal(matchesPrefs(stanford, { search: "stan" }), true);
      assert.equal(matchesPrefs(stanford, { search: "STAN" }), true);
      // Substring on conference.
      assert.equal(matchesPrefs(stanford, { search: stanford.conference }), true);
      // No match -> filtered out.
      assert.equal(matchesPrefs(stanford, { search: "xyzzy" }), false);
      // Empty / whitespace-only search must not empty the list.
      assert.equal(matchesPrefs(stanford, { search: "" }), true);
      assert.equal(matchesPrefs(stanford, { search: "   " }), true);
    },
  },
  {
    name: "search filter integrates through rankSchools and drops non-matches",
    run: (assert) => {
      const filtered = rankSchools(mid, colleges, { search: "stan" });
      assert.ok(filtered.length >= 1, "expected Stanford in results");
      assert.ok(
        filtered.every((r) => /stan/i.test(r.school.name) || /stan/i.test(r.school.conference || "")),
        "search leaked a non-matching school into the results"
      );
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
    name: "isScorable() requires only a national rank",
    run: (assert) => {
      assert.equal(isScorable(mid), true);
      assert.equal(isScorable(noAcademics), true);
      assert.equal(isScorable({ scoringAvg: 70 }), false);
      assert.equal(isScorable({}), false);
      assert.equal(isScorable(null), false);
    },
  },
  {
    name: "a golfer with no academics is scored on athletic fit alone",
    run: (assert) => {
      const fit = scoreSchool(noAcademics, adrian);
      assert.equal(fit.academicKnown, false);
      assert.equal(fit.academic, null, "academic must be null, never 0");
      assert.equal(fit.overall, fit.athletic, "overall should equal athletic");
      assert.equal(fit.components.length, 1, "only the roster-rank component without academics");
      assert.equal(fit.components[0].key, "roster-rank");
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
    name: "a golfer with academics but no rank is scored on academics alone",
    run: (assert) => {
      // Symmetric to the noAcademics case. Refuses to guess a rank the same
      // way it refuses to guess a GPA.
      const noRank = { gpa: 3.9, sat: 1450 };
      const fit = scoreSchool(noRank, stanford);
      assert.equal(fit.rankKnown, false);
      assert.equal(fit.athletic, null, "athletic must be null, never 0");
      assert.equal(fit.overall, fit.academic);
      assert.equal(fit.components.length, 2, "gpa + testing only");
    },
  },
  {
    name: "a golfer with neither rank nor academics is unscorable, not zero",
    run: (assert) => {
      const blank = { scoringAvg: 74 };
      const fit = scoreSchool(blank, stanford);
      assert.equal(fit.overall, null);
      assert.equal(fit.athletic, null);
      assert.equal(fit.academic, null);
    },
  },
  {
    name: "rankSchools drops unscorable schools rather than sorting nulls",
    run: (assert) => {
      const blank = { scoringAvg: 74 };
      const ranked = rankSchools(blank, colleges);
      assert.equal(ranked.length, 0);
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
    name: "rankVerdict() classifies ahead / behind / level and expresses the ratio",
    run: (assert) => {
      const ahead = rankVerdict(50, 200);      // you're 4x ahead
      assert.equal(ahead.direction, "ahead");
      assert.equal(ahead.multiple, 4);
      assert.ok(ahead.phrase.includes("ahead"));

      const behind = rankVerdict(10557, 340);  // Luke-ish
      assert.equal(behind.direction, "behind");
      assert.ok(behind.multiple > 10);
      assert.ok(behind.phrase.includes("behind"));

      const level = rankVerdict(100, 100);
      assert.equal(level.direction, "level");
      assert.ok(level.phrase.toLowerCase().includes("level"));

      // Big gaps snap to whole numbers, small gaps keep one decimal.
      assert.equal(rankVerdict(50, 100).multiple, 2);
      assert.equal(rankVerdict(80, 100).multiple, 1.3);

      // Junk inputs don't crash and don't lie.
      assert.equal(rankVerdict(100, 0).phrase, "");
      assert.equal(rankVerdict(100, -5).phrase, "");
    },
  },
  {
    name: "the roster-rank component's detail borrows rankVerdict's wording",
    run: (assert) => {
      // One source of truth for the sentence -- if this ever splits, the
      // number on screen and the phrase next to it can disagree.
      const golfer = { nationalRank: 200 };
      const school = { avgRosterSeniorJgsRank: 100 };
      const fit = scoreSchool(golfer, school);
      const roster = fit.components.find((c) => c.key === "roster-rank");
      assert.ok(roster.detail.includes("behind"));
      assert.ok(roster.detail.includes("HS-senior"));
    },
  },
  {
    name: "gpaVerdict() reports delta as ahead / behind / level",
    run: (assert) => {
      const ahead = gpaVerdict(3.9, 3.7);
      assert.equal(ahead.direction, "ahead");
      assert.equal(ahead.delta, 0.2);
      assert.ok(ahead.phrase.includes("+0.20"));
      assert.ok(ahead.phrase.toLowerCase().includes("above"));

      const behind = gpaVerdict(3.2, 3.85);
      assert.equal(behind.direction, "behind");
      assert.ok(behind.phrase.includes("0.65"));
      assert.ok(behind.phrase.toLowerCase().includes("below"));

      // Inside the noise threshold -> level, no misleading "+0.01" claim.
      assert.equal(gpaVerdict(3.51, 3.50).direction, "level");

      // Junk inputs must not throw or lie.
      assert.equal(gpaVerdict(3.5, null).phrase, "");
      assert.equal(gpaVerdict(undefined, 3.5).direction, "level");
    },
  },
  {
    name: "satVerdict() reports delta as ahead / behind / level",
    run: (assert) => {
      const ahead = satVerdict(1450, 1300);
      assert.equal(ahead.direction, "ahead");
      assert.equal(ahead.delta, 150);
      assert.ok(ahead.phrase.includes("+150"));

      const behind = satVerdict(1100, 1400);
      assert.equal(behind.direction, "behind");
      assert.ok(behind.phrase.includes("300"));
      assert.ok(behind.phrase.toLowerCase().includes("below"));

      // Within ten points is inside the noise threshold.
      assert.equal(satVerdict(1355, 1350).direction, "level");

      assert.equal(satVerdict(1400, null).phrase, "");
      assert.equal(satVerdict(NaN, 1400).direction, "level");
    },
  },
  {
    name: "gpa + testing component details borrow the verdict wording",
    run: (assert) => {
      // Same DRY guarantee as the roster-rank component: the sentence on
      // screen matches the verdict on the versus block.
      const fit = scoreSchool(
        { nationalRank: 100, gpa: 3.9, sat: 1450 },
        { avgRosterSeniorJgsRank: 200, avgGPA: 3.7, avgSAT: 1300 }
      );
      const gpa = fit.components.find((c) => c.key === "gpa");
      const testing = fit.components.find((c) => c.key === "testing");
      assert.ok(gpa.detail.toLowerCase().includes("above"));
      assert.ok(testing.detail.includes("+150"));
    },
  },
  {
    name: "coachGenderFor defaults to men and honours women when set",
    run: (assert) => {
      assert.equal(coachGenderFor({}), "men");
      assert.equal(coachGenderFor(null), "men");
      assert.equal(coachGenderFor({ gender: "men" }), "men");
      assert.equal(coachGenderFor({ gender: "women" }), "women");
      // Anything unrecognised falls back to men rather than to "unknown",
      // because the UI needs a team to look a coach up, not a shrug.
      assert.equal(coachGenderFor({ gender: "nonbinary" }), "men");
    },
  },
  {
    name: "headCoachFor returns the coach on file for the requested team",
    run: (assert) => {
      const school = {
        name: "Stanford University",
        headCoaches: {
          men: { name: "Conrad Ray", title: "Director of Men's Golf", email: "conrad.ray@stanford.edu", phone: "650-725-2052" },
        },
      };
      const coach = headCoachFor(school, "men");
      assert.equal(coach.name, "Conrad Ray");
      assert.equal(coach.email, "conrad.ray@stanford.edu");
      assert.equal(coach.phone, "650-725-2052");
      // No women's entry on file -> null, never the men's coach by mistake.
      assert.equal(headCoachFor(school, "women"), null);
    },
  },
  {
    name: "headCoachFor returns null when no coach is on file",
    run: (assert) => {
      assert.equal(headCoachFor({ name: "Nowhere U" }, "men"), null);
      assert.equal(headCoachFor({ headCoaches: null }, "men"), null);
      assert.equal(headCoachFor({ headCoaches: { men: { name: "  " } } }, "men"), null);
      assert.equal(headCoachFor(null), null);
    },
  },
  {
    name: "headCoachFor treats blank email/phone as unpublished",
    run: (assert) => {
      // A stored empty string is a common data-entry bug -- it must render
      // as "not published", not as an empty mailto: link.
      const coach = headCoachFor({
        headCoaches: { men: { name: "Jack Kennedy", title: "", email: "  ", phone: "" } },
      });
      assert.equal(coach.email, null);
      assert.equal(coach.phone, null);
      assert.equal(coach.title, "Head Coach");
      assert.equal(coach.photo, null);
    },
  },
  {
    name: "headCoachFor keeps https photos and drops anything else",
    run: (assert) => {
      const withPhoto = (photo) =>
        headCoachFor({ headCoaches: { men: { name: "Alan Bratton", photo } } }).photo;
      assert.equal(withPhoto("https://okstate.com/a.jpg"), "https://okstate.com/a.jpg");
      assert.equal(withPhoto("http://okstate.com/a.jpg"), null);
      assert.equal(withPhoto("javascript:alert(1)"), null);
      assert.equal(withPhoto(undefined), null);
    },
  },
  {
    name: "every college row with a coach on file has a name and a source",
    run: (assert) => {
      for (const c of colleges) {
        const men = c.headCoaches?.men;
        if (!men) continue;
        assert.ok(men.name && men.name.trim(), `${c.id}: coach name missing`);
        assert.ok(/^https:\/\//.test(men.source), `${c.id}: coach source URL missing`);
        if (men.email) assert.ok(/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(men.email), `${c.id}: bad email`);
        if (men.photo) assert.ok(/^https:\/\//.test(men.photo), `${c.id}: photo must be https`);
      }
      // All but one program (WashU lists no men's team) carry a coach.
      assert.equal(colleges.filter((c) => c.headCoaches?.men).length, colleges.length - 1);
    },
  },
  {
    name: "Luke at #10,557 is honestly all-Reach today, and the engine says so",
    run: (assert) => {
      // Under the OLD engine this outcome was the whole reason projection
      // existed -- a middle-schooler compared to current college roster
      // scoring averages had no path forward. Under the NEW rank-vs-rank
      // engine the answer is the same when the golfer's rank is genuinely
      // 10,000+ places behind every roster in the database: honest, not
      // hopeful. The right way to help him is to ship college rows whose
      // rosters actually recruited players ranked outside the top 1,000 as
      // HS seniors -- not to bolt a fabricated improvement rate on top.
      const groups = groupByTier(rankSchools(luke, colleges));
      assert.equal(groups.likely.length, 0);
      assert.equal(groups.target.length, 0);
      assert.equal(groups.reach.length, colleges.length);
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
];
