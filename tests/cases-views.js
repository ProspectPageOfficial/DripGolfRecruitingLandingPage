/**
 * tests/cases-views.js — view render smoke tests.
 *
 * These cases do not check what a view SAYS, only that it CAN say it. A
 * ReferenceError inside a template literal (the classic \"used a variable that
 * wasn't a parameter\") never trips a pure-maths test, but it will freeze the
 * app for a signed-in golfer -- exactly the failure mode that shipped once.
 *
 * The rule from now on: every top-level view export that is called from
 * main.js gets a render case here. If it takes props, hand it a shaped fixture
 * good enough to reach the end of the template.
 */
import { dashboardView } from "../js/views/dashboard.js";
import { fitView } from "../js/views/fit.js";
import { landing } from "../js/views/landing.js";
import { authView } from "../js/views/auth.js";
import { provenanceView } from "../js/views/provenance.js";
import { buildGolfer } from "../js/data/golfer.js";

const luke = buildGolfer();

const withAcademics = {
  ...luke,
  gpa: 3.85,
  sat: 1450,
};

/** A view render is \"ok\" as long as it returns a non-empty string. */
const rendersFine = (assert, name, produce) => {
  const out = produce();
  assert.equal(typeof out, "string", `${name} must return a string`);
  assert.ok(out.length > 100, `${name} produced only ${out.length} chars`);
};

export const viewCases = [
  {
    name: "landing view renders",
    run: (assert) => rendersFine(assert, "landing", () => landing()),
  },
  {
    name: "auth view renders",
    run: (assert) => rendersFine(assert, "authView", () => authView()),
  },
  {
    name: "provenance view renders",
    run: (assert) => rendersFine(assert, "provenanceView", () => provenanceView()),
  },
  {
    name: "dashboard renders for a scorable golfer without academics",
    run: (assert) => {
      // The exact shape that shipped a ReferenceError once -- collegePanel
      // referenced `profile` without receiving it, so the dashboard crashed
      // the instant a signed-in golfer landed on it.
      rendersFine(assert, "dashboardView(luke)", () => dashboardView(luke, true));
    },
  },
  {
    name: "dashboard renders for a golfer with full academics",
    run: (assert) => {
      rendersFine(assert, "dashboardView(withAcademics)",
        () => dashboardView(withAcademics, true));
    },
  },
  {
    name: "dashboard renders when the live read is offline",
    run: (assert) => {
      // The offline notice + no `Live` pill path -- separate branch from the
      // happy-path render.
      rendersFine(assert, "dashboardView(luke, false)",
        () => dashboardView(luke, false));
    },
  },
  {
    name: "dashboard renders for a golfer with no national rank",
    run: (assert) => {
      // isScorable() short-circuits to the empty state. Kept as a case so
      // that path is exercised on every run rather than only in production.
      const unranked = { ...luke, nationalRank: undefined };
      rendersFine(assert, "dashboardView(unranked)",
        () => dashboardView(unranked, true));
    },
  },
  {
    name: "fit view renders without academics",
    run: (assert) => rendersFine(assert, "fitView(luke)", () => fitView(luke, {})),
  },
  {
    name: "fit view renders with academics (versus stack shows GPA + SAT)",
    run: (assert) => {
      const out = fitView(withAcademics, {});
      assert.equal(typeof out, "string");
      assert.ok(out.length > 100);
      // The academic versus blocks must reach the DOM when GPA and SAT are
      // on file -- their absence is what tipped off the last regression.
      assert.ok(out.includes("School avg GPA"), "GPA versus block missing");
      assert.ok(out.includes("School avg SAT"), "SAT versus block missing");
    },
  },
  {
    name: "fit view falls back to the incomplete state when rank is missing",
    run: (assert) => {
      const noRank = { ...luke, nationalRank: undefined };
      const out = fitView(noRank, {});
      assert.ok(out.includes("Almost there"),
        "no-rank golfer should hit the incomplete-state screen");
    },
  },
];
