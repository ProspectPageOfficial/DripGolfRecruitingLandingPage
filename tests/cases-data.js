/**
 * tests/cases-data.js — where every number came from.
 *
 * These cases do not test arithmetic. They test PROVENANCE: that every number
 * on screen can be traced to lukethomasselzer.com, that nothing was retyped by
 * hand, and that the site does not contradict itself.
 *
 * The most valuable case here is the cross-check between the scoring average
 * the site publishes and the one recomputed from the results it also publishes.
 * If those ever diverge, every fit score is built on the disagreement.
 */
import { hasAcademics, graduationYear, scoreSchool } from "../js/lib/fit.js";
import { rollingScoringAvg, RANKING_WINDOW_EVENTS } from "../js/lib/trend.js";
import {
  normalizeLive,
  isPlaceholder,
  stripLabel,
  fetchLiveProfile,
  parseGpa,
  parseSat,
  ACT_TO_SAT,
} from "../js/data/live.js";
import { colleges } from "../js/data/colleges.js";
import { GOLFER_SNAPSHOT, buildGolfer } from "../js/data/golfer.js";
import { lukeSeason, lukePublished } from "../js/data/luke-season.js";
import { PROVENANCE, STATUS, hasFabricatedData } from "../js/data/provenance.js";

const luke = buildGolfer();
export const dataCases = [
  {
    name: "the site's published average agrees with its own rounds",
    run: (assert) => {
      // THE cross-check. lukePublished.scoringAvg is what the site prints;
      // rollingScoringAvg recomputes it from the 29 results it also prints.
      // If these ever diverge, the site is contradicting itself and every fit
      // score is built on the disagreement -- so it fails here first.
      assert.equal(lukePublished.scoringAvg, 81.12);
      assert.equal(rollingScoringAvg(lukeSeason), lukePublished.scoringAvg);
      assert.equal(buildGolfer().scoringAvg, 81.12);
    },
  },
  {
    name: "published stats are generated, never hand-typed",
    run: (assert) => {
      // Guards against someone "fixing" a stat by editing golfer.js instead of
      // the website. Every one of these must arrive via lukePublished.
      for (const key of ["scoringAvg", "nationalRank", "dripRank", "tugrRank",
                         "divisionRank", "differential", "eventsPlayed"]) {
        assert.equal(GOLFER_SNAPSHOT[key], lukePublished[key], key);
      }
      assert.equal(lukePublished.nationalRank, 10557);
      assert.equal(lukePublished.eventsPlayed, RANKING_WINDOW_EVENTS);
    },
  },
  {
    name: "the career mean is NOT the published average (window matters)",
    run: (assert) => {
      // Averaging all 55 rounds gives 80.65 -- close enough to look right and
      // wrong enough to be a different metric wearing the same name.
      assert.notEqual(rollingScoringAvg(lukeSeason, 999), lukePublished.scoringAvg);
      assert.equal(RANKING_WINDOW_EVENTS, 8);
    },
  },
  {
    name: "scoring average truncates at the boundary, matching the site",
    run: (assert) => {
      // 1298 / 16 = 81.125 exactly. Half-up gives 81.13; the site says 81.12.
      assert.equal(rollingScoringAvg([{ date: "2026-01-01", rounds: [81, 81, 81, 82] }]), 81.25);
      assert.equal(rollingScoringAvg([{ date: "2026-01-01", rounds: [80, 81] }]), 80.5);
    },
  },
  {
    name: "live values override the snapshot, and only for keys sent",
    run: (assert) => {
      const merged = buildGolfer(normalizeLive({ hometown: "Raleigh, NC" }));
      assert.equal(merged.hometown, "Raleigh, NC");
      assert.equal(merged.name, GOLFER_SNAPSHOT.name); // untouched
      assert.equal(merged.nationalRank, GOLFER_SNAPSHOT.nationalRank);
    },
  },
  {
    name: "placeholder junk in the live blob never reaches the profile",
    run: (assert) => {
      assert.ok(isPlaceholder("TEST"));
      assert.ok(isPlaceholder("Test Coach Name"));
      assert.ok(isPlaceholder("   "));
      assert.ok(isPlaceholder(null));
      assert.ok(!isPlaceholder("Luke Thomas Selzer"));
      // A live "TEST" name must fall back, not greet the golfer as TEST.
      assert.equal(buildGolfer(normalizeLive({ name: "TEST" })).name, GOLFER_SNAPSHOT.name);
    },
  },
  {
    name: "the site stores labels inside values; those get stripped",
    run: (assert) => {
      assert.equal(stripLabel("Age: 13"), "13");
      assert.equal(stripLabel("13"), "13");
      assert.equal(normalizeLive({ age: "Age: 13" }).age, "13");
      // Class year keeps its text -- graduationYear() parses the digits out.
      assert.equal(normalizeLive({ class_year: "Class of 2031" }).class_year, "Class of 2031");
    },
  },
  {
    name: "normalizeLive() ignores fields this app has no screen for",
    run: (assert) => {
      const clean = normalizeLive({ name: "Luke", coach_phone: "911", instagram: "x" });
      assert.deepEqual(Object.keys(clean), ["name"]);
      assert.deepEqual(normalizeLive(null), {});
      assert.deepEqual(normalizeLive("nope"), {});
    },
  },
  {
    name: "parseGpa reads whatever a golfer might type into the field",
    run: (assert) => {
      // The site accepts free-form strings; the parser has to survive them.
      assert.equal(parseGpa("3.85"), 3.85);
      assert.equal(parseGpa("3.85 / 4.0"), 3.85);
      assert.equal(parseGpa("GPA: 3.9"), 3.9);
      assert.equal(parseGpa("4.2 weighted"), 4.2, "weighted GPAs pass through as typed");
      assert.equal(parseGpa("  3.7  "), 3.7);
    },
  },
  {
    name: "parseGpa returns null rather than inventing a GPA",
    run: (assert) => {
      // Every one of these must fail cleanly so hasAcademics() drops the
      // input instead of scoring nonsense.
      assert.equal(parseGpa(""), null);
      assert.equal(parseGpa(null), null);
      assert.equal(parseGpa("N/A"), null);
      assert.equal(parseGpa("no GPA yet"), null);
      assert.equal(parseGpa("0"), null, "zero is not a real GPA");
      assert.equal(parseGpa("42"), null, "way out of range");
    },
  },
  {
    name: "parseSat prefers an explicit SAT number when present",
    run: (assert) => {
      assert.equal(parseSat("1420"), 1420);
      assert.equal(parseSat("1420 SAT"), 1420);
      assert.equal(parseSat("SAT: 1500"), 1500);
      // Mixed SAT + ACT -- SAT wins because it is the axis the engine uses.
      assert.equal(parseSat("1420 / 31"), 1420);
      assert.equal(parseSat("SAT 1500 (ACT 34)"), 1500);
    },
  },
  {
    name: "parseSat converts a bare ACT via the concordance",
    run: (assert) => {
      assert.equal(parseSat("31 ACT"), ACT_TO_SAT[31]);
      assert.equal(parseSat("ACT: 24"), ACT_TO_SAT[24]);
      // A bare "36" cannot be an SAT (below the 400 floor) but is a valid
      // perfect ACT, so the concordance takes over.
      assert.equal(parseSat("36"), ACT_TO_SAT[36]);
      // Sanity-check that the concordance is monotone -- a higher ACT never
      // maps to a lower SAT. A typo here would silently rearrange fit scores.
      const acts = Object.keys(ACT_TO_SAT).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < acts.length; i += 1) {
        assert.ok(
          ACT_TO_SAT[acts[i]] > ACT_TO_SAT[acts[i - 1]],
          `concordance not monotone at ACT ${acts[i]}`
        );
      }
    },
  },
  {
    name: "parseSat refuses to invent a score outside the concordance",
    run: (assert) => {
      assert.equal(parseSat(""), null);
      assert.equal(parseSat("no score"), null);
      assert.equal(parseSat("8 ACT"), null, "concordance stops at 9");
      assert.equal(parseSat("1700"), null, "above the SAT ceiling");
      assert.equal(parseSat("200"), null, "below the SAT floor and above ACT");
    },
  },
  {
    name: "normalizeLive translates the site's free-form academics into numbers",
    run: (assert) => {
      const clean = normalizeLive({ gpa: "3.85 / 4.0", test_scores: "31 ACT" });
      assert.equal(clean.gpa, 3.85, "GPA is a number, not the raw string");
      assert.equal(clean.sat, ACT_TO_SAT[31], "ACT was concorded to SAT for the engine");
      assert.equal("test_scores" in clean, false,
        "raw label field must not leak into the profile");
    },
  },
  {
    name: "normalizeLive drops academics it cannot parse rather than scoring zero",
    run: (assert) => {
      // Unknown and bad are different facts. An unparseable string must
      // vanish so hasAcademics() answers "not on file", not "grades of 0".
      const clean = normalizeLive({ gpa: "coming soon", test_scores: "TBD" });
      assert.equal("gpa" in clean, false);
      assert.equal("sat" in clean, false);
      assert.equal("test_scores" in clean, false);
    },
  },
  {
    name: "live academics reach the fit engine and light up Academic Fit",
    run: (assert) => {
      // End-to-end: what the site publishes -> what the engine scores.
      const golfer = {
        scoringAvg: 74,
        nationalRank: 200,
        ...normalizeLive({ gpa: "3.9", test_scores: "1400 SAT" }),
      };
      assert.equal(hasAcademics(golfer), true);
      const school = {
        teamScoringAvg: 74.5, recruitRank: 250,
        avgGPA: 3.7, avgSAT: 1350,
      };
      const fit = scoreSchool(golfer, school);
      assert.equal(fit.academicKnown, true);
      assert.ok(fit.academic > 0, "academics should score above zero when GPA/SAT clear the bar");
      // Components must include gpa and testing rows now.
      const keys = fit.components.map((c) => c.key);
      assert.ok(keys.includes("gpa"), "gpa component missing from scored fit");
      assert.ok(keys.includes("testing"), "testing component missing from scored fit");
    },
  },
  {
    name: "a failed live read resolves rather than throwing",
    run: async (assert) => {
      const boom = () => Promise.reject(new Error("offline"));
      const result = await fetchLiveProfile({ fetchImpl: boom });
      assert.equal(result.ok, false);
      assert.equal(result.data, null);
    },
  },
  {
    name: "every college carries a domain so its logo can be fetched",
    run: (assert) => {
      for (const school of colleges) {
        assert.ok(school.domain, school.name + " has no domain");
        assert.ok(school.domain.includes("."), school.domain);
      }
    },
  },
  {
    name: "Luke's seeded profile matches his published stats and has no academics",
    run: (assert) => {
      assert.ok(luke, "demo-luke seed missing");
      assert.equal(luke.scoringAvg, 81.12, "published JGS scoring average");
      assert.equal(luke.nationalRank, 10557, "published Overall JGS rank");
      assert.equal(luke.dripRank, 30);
      assert.equal(luke.divisionRank, 31);
      assert.equal(luke.class_year, "Class of 2031");
      assert.equal(luke.gpa, undefined, "a 13-year-old must not have a GPA");
      assert.equal(luke.sat, undefined, "a 13-year-old must not have an SAT");
      assert.equal(hasAcademics(luke), false);
      // A FLOOR, not an exact count. Luke adds tournaments to his site and the
      // generator merges them, so pinning the exact number would turn "the
      // golfer played a round" into a failing build. The floor still catches
      // the failure that matters: the generator silently losing history.
      assert.ok(luke.tournaments.length >= 29,
        `expected at least 29 events, got ${luke.tournaments.length}`);
    },
  },
  {
    name: "Luke's real tournament data is well formed",
    run: (assert) => {
      const seen = new Set();
      for (const e of luke.tournaments) {
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(e.date), `bad date: ${e.date}`);
        assert.ok(e.event, "event missing a name");
        assert.ok(Array.isArray(e.rounds));
        for (const s of e.rounds) {
          assert.ok(Number.isFinite(s) && s > 0 && s < 130, `bad score ${s}`);
        }
        seen.add(e.date + e.event);
      }
      // Duplicates are the specific risk of merging the scraped history with
      // the owner-added blob: a doubled event double-counts in the average.
      assert.equal(seen.size, luke.tournaments.length, "duplicate event rows");
      // Newest first, so the page reads like a season log.
      const dates = luke.tournaments.map((e) => e.date);
      assert.deepEqual(dates, dates.slice().sort().reverse(), "not sorted newest-first");
    },
  },
  // ---- data provenance -------------------------------------------------
  {
    name: "every provenance row is complete and uses a known status",
    run: (assert) => {
      assert.ok(PROVENANCE.length > 0);
      for (const row of PROVENANCE) {
        assert.ok(STATUS[row.status], `unknown status: ${row.status}`);
        assert.ok(row.what, "row missing a description");
        assert.ok(row.source, "row missing a source");
        assert.ok(row.group, "row missing a group");
      }
    },
  },
  {
    name: "the invented college data is still declared as invented",
    run: (assert) => {
      // This case is a tripwire, not a checkmark. It exists so that the day
      // someone swaps in real college data and forgets to update provenance,
      // the suite complains. If you have replaced the dataset, update
      // provenance.js and this case flips to asserting the opposite.
      assert.equal(
        hasFabricatedData(), true,
        "provenance says nothing is fabricated - has the college data really " +
        "been replaced? If so, update this test."
      );
      const invented = PROVENANCE.filter((r) => r.status === "fabricated");
      assert.ok(
        invented.some((r) => r.group === "College database"),
        "the fabricated college data must stay declared until it is replaced"
      );
    },
  },
  {
    name: "Luke's real data is declared real, and the model's guesses are not",
    run: (assert) => {
      const real = PROVENANCE.filter((r) => r.status === "real");
      assert.ok(
        real.some((r) => r.source.includes("PORTFOLIO_DATA")),
        "Luke's sourced stats should be marked real"
      );
      const model = PROVENANCE.filter((r) => r.group === "Fit model");
      assert.ok(model.length >= 3);
      assert.ok(
        model.every((r) => r.status === "assumption"),
        "no part of the fit model may claim to be a measurement"
      );
    },
  },
  {
    name: "the seeded college dataset is internally coherent",
    run: (assert) => {
      const ids = new Set();
      for (const c of colleges) {
        assert.ok(!ids.has(c.id), `duplicate college id: ${c.id}`);
        ids.add(c.id);
        assert.ok(c.teamScoringAvg > 60 && c.teamScoringAvg < 85, `bad avg: ${c.id}`);
        assert.ok(c.avgGPA > 0 && c.avgGPA <= 4.3, `bad GPA: ${c.id}`);
        assert.ok(c.avgSAT > 400 && c.avgSAT <= 1600, `bad SAT: ${c.id}`);
        assert.ok(c.recruitRank > 0, `bad recruitRank: ${c.id}`);
      }
    },
  },
];
