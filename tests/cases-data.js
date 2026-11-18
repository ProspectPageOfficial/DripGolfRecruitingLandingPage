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
import {
  parseStandings, parseProfile, parseScoring, parseTournaments, matchPlayers, splitName, mergeRosters, isGirlsDivision, PLAYER_ID,
} from "../js/data/dripgolf.js";
import { DRIP_HISTORY } from "../js/data/dripgolf-history.js";
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
        avgRosterSeniorJgsRank: 250,
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
    name: "no college data is declared as invented any more",
    run: (assert) => {
      // This used to be a tripwire asserting the invented college numbers
      // were still declared. They were replaced (Oct 2026), so it now asserts
      // the opposite: the college database has no "Invented" rows. Roster
      // ranks are an estimate, declared as an assumption, not invented.
      const invented = PROVENANCE.filter((r) => r.status === "fabricated" && r.group === "College database");
      assert.equal(invented.length, 0, "a College database row is still marked invented");
      void hasFabricatedData;
    },
  },
  {
    name: "golfer data is declared real, and the model's guesses are not",
    run: (assert) => {
      const real = PROVENANCE.filter((r) => r.status === "real");
      assert.ok(
        real.some((r) => r.group === "Golfer profile"),
        "the golfer's sourced data should be marked real"
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
        assert.ok(
          c.avgRosterSeniorJgsRank > 0 && c.avgRosterSeniorJgsRank < 20000,
          `bad avgRosterSeniorJgsRank: ${c.id}`
        );
        // Generated rows may lack a benchmark (Scorecard has no GPA, and some
        // schools publish no SAT); a number that IS there must be in range.
        if (c.avgGPA != null) assert.ok(c.avgGPA > 0 && c.avgGPA <= 4.3, `bad GPA: ${c.id}`);
        if (c.avgSAT != null) assert.ok(c.avgSAT > 400 && c.avgSAT <= 1600, `bad SAT: ${c.id}`);
        assert.equal(c.rankSource, "conference-estimate", `no rankSource: ${c.id}`);
        if (c.programs) assert.ok(c.programs.men || c.programs.women, `${c.id} fields no golf team`);
      }
      // Nothing invented: there is no public source for a school's average GPA.
      for (const c of colleges) assert.equal(c.avgGPA ?? null, null, `invented GPA on ${c.id}`);
    },
  },
  {
    name: "the college list covers every NCAA golf program, not a sample",
    run: (assert) => {
      assert.ok(colleges.length > 800, `only ${colleges.length} programs`);
      for (const d of ["D1", "D2", "D3", "NAIA"]) {
        assert.ok(colleges.some((c) => c.division === d), `no ${d} programs`);
      }
    },
  },

  // ---- Drip Golf Tour lookup (made-up players in the tour's real markup) ----
  {
    name: "Drip Golf standings rows parse into players, every division on the page",
    run: (assert) => {
      // Shaped like the tour's redesigned (Nov 2026) standings page.
      const row = (rank, id, name, town, year, avg) => `
        <tr class="standings__row" data-name="${name.toLowerCase()}">
          <td class="standings__td standings__td--rank standings__td--rank-top">
            ${rank}
          </td>
          <td class="standings__td standings__td--mvmt"><span class="standings__mvmt standings__mvmt--none">&mdash;</span></td>
          <td class="standings__td standings__td--player">
            <a class="standings__name" href="/profile/${id}/x?season=2026-27">${name}</a>
            <span class="standings__meta">${town} &#xB7; ${year}</span>
          </td>
          <td class="standings__td standings__td--hometown">${town}</td>
          <td class="standings__td standings__td--grad">${year}</td>
          <td class="standings__td standings__td--num standings__td--main"
              data-label="Points">90.00</td>
          <td class="standings__td standings__td--num"
              data-label="Differential">0.00</td>
          <td class="standings__td standings__td--num"
              data-label="Scoring Average">${avg}</td>
          <td class="standings__td standings__td--num"
              data-label="Events">2</td>
        </tr>`;
      const panel = (slug, name, rows) => `
        <div class="standings__division js-standings-divpanel" data-division="${slug}">
          <div class="standings__division-header">
            <span class="standings__division-name">${name}</span>
            <span class="standings__division-season">2026-27</span>
          </div>
          <table><tbody>${rows}</tbody></table>
        </div>`;
      const page = panel("high-school-boys", "High School Boys",
        row("1", "101", "Sam Carter", "Austin, TX", "2029", "71.25") +
        row("T2", "102", "Jos&#233; Ruiz Jr.", "Cary, NC", "2031", "74.50")) +
        panel("middle-school-boys", "Middle School Boys", row("T2", "103", "Mary Kate Lane", "Durham, NC", "2032", ""));
      const ps = parseStandings(page);
      assert.equal(ps.length, 3);
      assert.deepEqual(
        { ...ps[0] },
        { id: "101", name: "Sam Carter", firstName: "Sam", lastName: "Carter", division: "High School Boys",
          rank: "1", hometown: "Austin, TX", classYear: "2029", points: 90, scoringAvg: 71.25, events: 2 });
      assert.equal(ps[1].name, "José Ruiz Jr.");
      assert.deepEqual(splitName(ps[1].name), ["José", "Ruiz Jr."]);
      assert.equal(ps[2].division, "Middle School Boys", "each player keeps their own division");
      assert.deepEqual(splitName(ps[2].name), ["Mary Kate", "Lane"]);
      assert.equal(ps[2].scoringAvg, undefined, "a blank cell is missing, not zero");
      assert.deepEqual(parseStandings("<p>redesigned again</p>"), []);
    },
  },
  {
    name: "Drip Golf name lookup matches on either box, ignoring case and accents",
    run: (assert) => {
      const ps = [
        { id: "1", firstName: "José", lastName: "Ruiz" },
        { id: "2", firstName: "Joseph", lastName: "Ray" },
        { id: "3", firstName: "Sam", lastName: "Rudd" },
      ];
      const ids = (f, l) => matchPlayers(ps, f, l).map((p) => p.id).join(",");
      assert.equal(ids("JOSE", "ru"), "1", "accent and case folded");
      assert.equal(ids("jos", ""), "1,2");
      assert.equal(ids("", "ru"), "1,3");
      assert.equal(ids("j", "ra"), "2");
      assert.equal(ids("", ""), "", "nothing typed, nothing suggested");
    },
  },
  {
    name: "Drip Golf roster: this season's row wins, past seasons fill in the rest",
    run: (assert) => {
      const current = [{ id: "1", hometown: "Cary, NC" }, { id: "2", hometown: "Apex, NC" }];
      const past = [{ id: "2", hometown: "Durham, NC", season: "2023" }, { id: "3", season: "2021-2022" }];
      const merged = mergeRosters(current, past);
      assert.deepEqual(merged.map((p) => p.id), ["1", "2", "3"]);
      assert.equal(merged[1].hometown, "Apex, NC", "a golfer still playing keeps this season's row");
      assert.deepEqual(mergeRosters([], past).map((p) => p.id), ["2", "3"], "live half down, history still matches");
    },
  },
  {
    name: "Drip Golf girls' division picks the women's team",
    run: (assert) => {
      assert.equal(isGirlsDivision("Female Elite"), true);
      assert.equal(isGirlsDivision("HS Fresh/Soph (Boys)"), false);
      assert.equal(isGirlsDivision(undefined), false);
    },
  },
  {
    name: "Drip Golf history snapshot is well-formed",
    run: (assert) => {
      assert.ok(DRIP_HISTORY.length > 1000, "snapshot looks truncated");
      assert.equal(new Set(DRIP_HISTORY.map((p) => p.id)).size, DRIP_HISTORY.length, "one row per golfer");
      for (const p of DRIP_HISTORY) {
        assert.ok(PLAYER_ID.test(p.id) && p.firstName && p.season, `bad row ${JSON.stringify(p)}`);
      }
    },
  },
  {
    name: "Drip Golf profile yields age, JGS rank and TUGR rank",
    run: (assert) => {
      // Shaped like the tour's redesigned (Nov 2026) profile page.
      const page = `<h1 class="player-profile__name">Sam Carter</h1>
        <div class="player-profile__bio">Austin, TX &#xB7; Class of 2029 &#xB7; Age 15</div>
        <div class="player-profile__rankorg">
          <img class="player-profile__rankorg-logo" src="x.png" alt="Junior Golf Scoreboard" title="Junior Golf Scoreboard" />
          <span class="player-profile__rankorg-rank">Overall Rank: <strong>1929</strong></span>
        </div>
        <div class="player-profile__rankorg">
          <img class="player-profile__rankorg-logo" src="y.png" alt="The Universal Golf Rankings" title="The Universal Golf Rankings" />
          <span class="player-profile__rankorg-rank">Overall Rank: <strong>658</strong></span>
        </div>`;
      assert.deepEqual(parseProfile(page), { age: 15, jgsRank: 1929, tugrRank: 658 });
      assert.deepEqual(parseProfile("<p>redesigned</p>"),
        { age: undefined, jgsRank: undefined, tugrRank: undefined });
    },
  },
  {
    name: "Drip Golf profile yields the Golf Bio scoring stats",
    run: (assert) => {
      const type = (label, count, pct) => `<li class="player-profile__type"><div class="player-profile__type-head">
        <span class="player-profile__type-label">${label}</span>
        <span class="player-profile__type-count">${count} <span class="player-profile__type-pct">(${pct})</span></span>
        </div></li>`;
      const tile = (value, label) => `<div class="player-profile__tile">
        <span class="player-profile__tile-value">${value}</span>
        <span class="player-profile__tile-label">${label}</span></div>`;
      const page = `<h2 class="player-profile__panel-title">Scoring Types</h2><ul class="player-profile__types">
        ${type("Eagles", 0, "0.0%")}${type("Birdies", 20, "13.9%")}${type("Pars", 84, "58.3%")}
        ${type("Bogeys", 34, "23.6%")}${type("Doubles", 5, "3.5%")}${type("Others", 1, "0.7%")}</ul>
        <h2 class="player-profile__panel-title">Scoring Profile</h2>
        ${tile("3.28", "Par 3 Avg")}${tile("4.23", "Par 4 Avg")}${tile("5.00", "Par 5 Avg")}`;
      assert.deepEqual(parseScoring(page), {
        "Par 3's": "3.28", "Par 4's": "4.23", "Par 5's": "5.00",
        Eagles: "0 (0.0%)", Birdies: "20 (13.9%)", Pars: "84 (58.3%)",
        Bogeys: "34 (23.6%)", Doubles: "5 (3.5%)", Others: "1 (0.7%)",
      });
      assert.deepEqual(parseScoring("<p>redesigned</p>"), {}, "a redesign gives nothing, not wrong numbers");
    },
  },
  {
    name: "Drip Golf profile yields the golfer's tournament history",
    run: (assert) => {
      const round = (eventId, n, score, toPar) => `
        <label for="sc-${eventId}-${n}" class="player-profile__tnmt-round sc-r${n}">
          <span class="player-profile__tnmt-round-no">R${n}</span>
          <span class="player-profile__tnmt-round-score">${score}</span>
          <span class="player-profile__tnmt-round-topar">${toPar}</span>
        </label>`;
      const card = (eventId, name, date, place, total, points, rounds, course) => `
        <div class="player-profile__tnmt-card">
          <div class="player-profile__tnmt-head">
            <a class="player-profile__tnmt-name" href="/leaderboard/${eventId}/x">${name}</a>
            <span class="player-profile__tnmt-date">${date}</span>
          </div>
          <div class="player-profile__tnmt-meta"><span class="player-profile__tnmt-div">High School Boys</span></div>
          <div class="player-profile__tnmt-body">
            <div class="player-profile__tnmt-place" title="Place"><span class="player-profile__tnmt-place-text">${place}</span></div>
            <div class="player-profile__tnmt-stats">
              <div class="player-profile__tnmt-stat"><span class="player-profile__tnmt-rlabel">Total</span>
                <span class="player-profile__tnmt-rval">${total}</span></div>
              <div class="player-profile__tnmt-stat"><span class="player-profile__tnmt-rlabel">Points</span>
                <span class="player-profile__tnmt-rval">${points}</span></div>
            </div>
          </div>
          <div class="player-profile__tnmt-rounds">${rounds}</div>
          <div class="player-profile__sc-panels">
            ${rounds.match(/tnmt-round-no/g).map((_, i) => `<div class="player-profile__sc-panel sc-p${i + 1}">
              <div class="player-profile__sc-course">${course}</div></div>`).join("")}
          </div>
        </div>`;
      const page = `<h2 class="player-profile__panel-title">Tournament Results</h2><div class="player-profile__tnmts">
        ${card(32398, "DGT &quot;Fall Classic&quot; at Pine CC", "Oct 17, 2026", "T32", "163 (&#x2B;21)", "18.5",
          round(32398, 1, 84, "&#x2B;13") + round(32398, 2, 79, "&#x2B;8"), "Pine CC")}
        ${card(31000, "Spring Open", "Mar 7, 2025", "1", "142 (-2)", "500", round(31000, 1, 70, "-1") + round(31000, 2, 72, "E"), "Oak Hills")}
        </div>`;
      const ts = parseTournaments(page);
      assert.equal(ts.length, 2);
      assert.deepEqual(ts[0], {
        year: "2026", date: "10/17/2026", name: 'DGT "Fall Classic" at Pine CC', division: "High School Boys",
        place: "T32", total: "163 (+21)", points: "18.5",
        rounds: [{ round: "1", score: "84 (+13)", course: "Pine CC" }, { round: "2", score: "79 (+8)", course: "Pine CC" }],
      });
      assert.equal(ts[1].date, "3/7/2025");
      assert.equal(ts[1].rounds[1].score, "72 (E)", "even par stays E");
      assert.deepEqual(parseTournaments("<p>redesigned</p>"), []);
    },
  },
];
