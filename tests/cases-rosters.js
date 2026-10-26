/**
 * tests/cases-rosters.js — reading class years off roster pages
 * (tools/gen-rosters.mjs). Node only: the tool imports node:fs.
 */
import { classYear, summarize, parseSidearmRoster, seasonFor } from "../tools/gen-rosters.mjs";

export const rosterCases = [
  {
    name: "class labels are read the way schools write them",
    run: (assert) => {
      const cases = { "Fr.": 1, "R-So.": 2, "Junior": 3, "Sr.": 4, "R-Sr.": 4, "Gr.": 5, "5th": 5,
        "Graduate Student": 5, "Redshirt Freshman": 1, "": null, "Coach": null };
      for (const [label, want] of Object.entries(cases)) assert.equal(classYear(label), want, label);
    },
  },
  {
    name: "a roster is only counted when it really is one",
    run: (assert) => {
      assert.equal(summarize([1, null]), null, "two players is a stub page, not a roster");
      assert.deepEqual(summarize([1, 1, 4, 5, null]), { size: 5, byYear: { 1: 2, 2: 0, 3: 0, 4: 1, 5: 1 } });
      const html = '<li class="sidearm-roster-player" data-player-id="1"><span class="sidearm-roster-player-academic-year">Fr.</span></li>' +
        '<li class="sidearm-roster-player" data-player-id="2"><span class="sidearm-roster-player-academic-year hide-on-large">Sr.</span></li>' +
        '<li class="sidearm-roster-player" data-player-id="3"><span class="sidearm-roster-player-academic-year">Gr.</span></li>';
      assert.deepEqual(parseSidearmRoster(html), [1, 4, 5]);
    },
  },
  {
    name: "the season rolls over in August",
    run: (assert) => {
      assert.equal(seasonFor(new Date("2026-10-26")), "2026-27");
      assert.equal(seasonFor(new Date("2027-05-01")), "2026-27");
      assert.equal(seasonFor(new Date("2027-08-15")), "2027-28");
    },
  },
];
