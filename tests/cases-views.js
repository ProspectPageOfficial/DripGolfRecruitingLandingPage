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
import { signupView, mockGolfer, mockPagePanel, mockBanner } from "../js/views/signup.js";
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
    name: "sign-in page links to the sign-up survey",
    run: (assert) => assert.ok(authView().includes('href="#/signup"'), "Create account link missing"),
  },
  {
    name: "sign-up survey renders every Personal Bio question",
    run: (assert) => {
      const out = signupView();
      rendersFine(assert, "signupView", () => out);
      for (const name of ["email", "password", "name", "hometown", "address", "phone", "age",
        "height", "weight", "classYear", "school", "gpa", "sat", "bio", "instagram", "website"]) {
        assert.ok(out.includes(`name="${name}"`), `survey is missing ${name}`);
      }
    },
  },
  {
    name: "sign-up answers become a golfer the fit engine can score",
    run: (assert) => {
      const g = mockGolfer({ name: "Ava Reed", classYear: "Class of 2029", gender: "women",
        nationalRank: "850", gpa: "3.9 / 4.0", sat: "31" });
      assert.equal(g.name, "Ava Reed");
      assert.equal(g.class_year, "Class of 2029");
      assert.equal(g.nationalRank, 850);
      assert.equal(g.gender, "women");
      assert.equal(g.gpa, 3.9);
      assert.equal(g.sat, 1390, "ACT 31 should concord to SAT 1390, same as the live read");
    },
  },
  {
    name: "mock dashboard renders the survey answers instead of Luke's site",
    run: (assert) => {
      const answers = { name: "Ava Reed", hometown: "Austin, TX", classYear: "Class of 2029",
        gender: "women", nationalRank: "850", bio: "Plays <b>fast</b>." };
      const out = dashboardView(mockGolfer(answers), true, {
        pagePanel: mockPagePanel(answers), banner: mockBanner(answers), fitHref: "#/welcome/fit",
      });
      rendersFine(assert, "dashboardView(mock)", () => out);
      assert.ok(out.includes("Ava Reed") && out.includes("Austin, TX"), "answers missing");
      assert.ok(out.includes('href="#/welcome/fit"'), "Best Fit link should stay in the mock");
      assert.ok(!out.includes("<iframe"), "mock must not frame Luke's live site");
      assert.ok(!out.includes("<b>fast</b>"), "bio must be escaped");
    },
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
    name: "fit view labels the golfer's rank as 'Your JGS rank'",
    run: (assert) => {
      // Guards against the label sliding back to a bare "You" -- which reads
      // ambiguously when three head-to-head blocks are stacked.
      const out = fitView(luke, {});
      assert.ok(out.includes("Your JGS rank"),
        "rank versus block must label its left side 'Your JGS rank'");
    },
  },
  {
    name: "fit view shows the top pick's head coach contact in place",
    run: (assert) => {
      // The summary card shows the coach's name and contact details directly,
      // and no longer sends the golfer off-site to a Google search.
      const out = fitView(luke, {});
      assert.ok(out.includes("coach-card"), "summary card should show a coach card");
      assert.ok(out.includes("mailto:"), "coach email should be shown");
      assert.ok(out.includes("coach-photo"), "coach headshot slot should render");
      assert.ok(out.includes('onerror="this.remove()"'),
        "a broken headshot must remove itself and reveal the initials");
      assert.ok(!out.includes("https://www.google.com/search"),
        "coach search links should be gone");
    },
  },
  {
    name: "dashboard shows the top pick's head coach contact in place",
    run: (assert) => {
      const out = dashboardView(luke, true);
      assert.ok(out.includes("coach-card"), "dashboard top pick should show a coach card");
      assert.ok(out.includes("Head coach"), "coach card should be labelled");
    },
  },
  {
    name: "fit view ships a search input and no measured-trend card",
    run: (assert) => {
      const out = fitView(luke, {});
      assert.ok(out.includes('id="p-search"'), "search input missing from fit view");
      assert.ok(!out.includes("Your measured trend"),
        "measured trend card should not be rendered any more");
      assert.ok(!out.includes("Preferences"),
        "old preferences form should not be rendered any more");
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
