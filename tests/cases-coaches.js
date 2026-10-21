/**
 * tests/cases-coaches.js — the rules that pick a head coach off a school's
 * staff page (tools/gen-coaches.mjs), and the merge that puts one on every
 * college that has one.
 *
 * Getting the title rule wrong puts the wrong person on a card a golfer will
 * email -- a strength coach, or the women's coach on a men's program -- so
 * every rule has a case.
 */
import { pickHeadCoach, cleanName, sizedPhoto } from "../tools/gen-coaches.mjs";
import { colleges } from "../js/data/colleges.js";
import { headCoachFor } from "../js/lib/fit.js";

const picks = (title, team = "men") => !!pickHeadCoach([{ name: "Pat Lee", title }], team);

export const coachCases = [
  {
    name: "head coach titles are recognised",
    run: (assert) => {
      for (const t of ["Head Coach", "Interim Head Coach", "Head Golf Coach", "Director of Golf",
        "Director of Men's & Women's Golf", "Head Men's and Women's Golf Coach"]) {
        assert.ok(picks(t), `should pick "${t}"`);
      }
    },
  },
  {
    name: "assistants and other sports' coaches are never picked",
    run: (assert) => {
      for (const t of ["Assistant Coach", "Associate Head Coach", "Head Strength & Conditioning Coach",
        "Head Volleyball Coach", "Volunteer Assistant Coach", "Director of Operations",
        "Director of Athletic Communications Men's Basketball, Softball, Women's Golf"]) {
        assert.ok(!picks(t), `should not pick "${t}"`);
      }
    },
  },
  {
    name: "a combined golf page gives each team its own coach",
    run: (assert) => {
      const staff = [
        { name: "Men Coach", title: "Head Men's Golf Coach" },
        { name: "Women Coach", title: "Head Women's Golf Coach" },
      ];
      assert.equal(pickHeadCoach(staff, "men").name, "Men Coach");
      assert.equal(pickHeadCoach(staff, "women").name, "Women Coach");
      assert.ok(!picks("Head Women's Golf Coach", "men"), "women's coach is not the men's coach");
      assert.ok(!picks("Head Men's Golf Coach", "women"), "men's coach is not the women's coach");
    },
  },
  {
    name: "alumni class years are dropped from names, photos are https and resized",
    run: (assert) => {
      assert.equal(cleanName("Brent Greenwood '14"), "Brent Greenwood");
      assert.equal(cleanName("Ann O'Neil"), "Ann O'Neil");
      assert.equal(sizedPhoto("http://x.com/a.jpg"), null);
      assert.ok(sizedPhoto("https://okstate.com/images/2024/8/23/a.JPG").startsWith("https://images.sidearmdev.com/resize?"));
    },
  },
  {
    name: "hand-verified coaches win over collected ones",
    run: (assert) => {
      const ok = colleges.find((c) => c.id === "oklahoma-st");
      assert.equal(headCoachFor(ok, "men").name, "Alan Bratton");
      assert.equal(headCoachFor(ok, "men").checked, "2026-09-26");
    },
  },
  {
    name: "most programs have a head coach on file",
    run: (assert) => {
      // ~80% at the last collection. The rest are athletics sites that were
      // down, behind a bot wall, or on a layout the collector cannot read.
      // This floor catches a parser regression, not the last few percent.
      const teams = colleges.flatMap((c) => ["men", "women"].filter((t) => c.programs?.[t]).map((t) => headCoachFor(c, t)));
      const share = teams.filter(Boolean).length / teams.length;
      assert.ok(share > 0.75, `only ${Math.round(share * 100)}% of teams have a coach`);
    },
  },
];
