/**
 * views/dashboard.js — what a golfer sees straight after signing in.
 *
 * Laid out as a DUAL: the left panel is what coaches see today (a live frame of
 * the real public page), the right is where the golfer could go (fit tiles).
 * Present state and future state, side by side, because the whole point of the
 * product is the gap between them.
 *
 * A hub, not a destination. Every panel ends in a link somewhere more useful.
 */
import { html, raw, extLink } from "../lib/dom.js";
import { empty, tierPill } from "../lib/components.js";
import { schoolLogo, sitePreview } from "../lib/thumbs.js";
import {
  rankSchools,
  pickHighlight,
  hasAcademics,
  projectGolfer,
  yearsToGraduation,
  IMPROVEMENT,
} from "../lib/fit.js";
import { scenarioByKey, DEFAULT_SCENARIO } from "../lib/trend.js";
import { colleges } from "../data/colleges.js";
import { PUBLIC_SITE } from "../config.js";

/**
 * The "N% complete" dial and the "still missing: bio" prompt both used to live
 * here. They went with the editor: this app has no way to fill a gap in, so
 * nagging about one would be pointing at a door with no handle. The website
 * owns those fields and is where they get finished.
 */
export function dashboardView(profile, liveOk = true) {
  const scorable = ["scoringAvg", "nationalRank"].every((k) => profile?.[k] != null);

  // This used to score against today's rosters with no projection at all, on
  // the principle that a dashboard should not assume anything. In practice that
  // produced a headline of "Carnegie Mellon, fit 3, Reach" for a 13-year-old --
  // technically unassuming and completely useless. Refusing to state an
  // assumption did not remove the assumption; it just hid the fact that
  // comparing a middle schooler to a current college roster IS one.
  //
  // So the dashboard now uses the SAME default scenario the Fit screen opens
  // on, imported rather than redeclared, and says so on screen. One default,
  // one place, and the golfer can change it in the planner.
  const scenario = scenarioByKey(DEFAULT_SCENARIO);
  const projection = projectGolfer(profile, { strokesPerYear: scenario.strokesPerYear });
  // ONE recommendation, not six. A grid of tiles asks the golfer to do the
  // comparing; a dashboard is supposed to have already done it. The full list
  // is one click away and that is where comparing belongs.
  const ranked = scorable ? rankSchools(projection.golfer, colleges) : [];
  const highlight = pickHighlight(ranked);
  const academics = hasAcademics(profile);
  // Kept ONLY to suppress the academics nag. A golfer this far out has not sat
  // the SAT and asking for one is noise, not a prompt.
  const years = yearsToGraduation(profile);
  const earlyDays = years != null && years >= IMPROVEMENT.minYears;

  return html`
    <div class="container section-tight stack">
      <div>
        <span class="eyebrow">Dashboard</span>
        <h1 class="serif" style="font-size:clamp(1.9rem,4vw,2.8rem);margin:.5rem 0">
          ${greeting()}, ${firstName(profile.name)}.
        </h1>
      </div>

      ${raw(liveOk ? "" : offlineNotice())}

      <div class="dual">
        ${raw(myPagePanel(liveOk))}
        ${raw(collegePanel(highlight, projection, scenario, academics))}
      </div>

      ${raw(academics || !scorable || earlyDays ? "" : academicsNotice())}

    </div>
  `;
}

/**
 * Left half: what a coach actually sees. A live frame of the real, deployed
 * site beats any amount of prose claiming the page looks good.
 */
const myPagePanel = (liveOk) => html`
  <div class="card">
    <div class="row row-between">
      <span class="eyebrow">Your page &mdash; ${PUBLIC_SITE.host}</span>
      ${raw(liveOk ? html`<span class="pill pill-likely">Live</span>` : "")}
    </div>

    ${raw(sitePreview(PUBLIC_SITE))}

    <p class="field-hint">
      Your name, hometown and class year are read from this site every time this
      page loads. Edit them there and they change here &mdash; there is no second
      copy to keep in step.
    </p>

    <div class="row panel-foot">
      ${raw(extLink(PUBLIC_SITE.url, "Open my page", "btn btn-sm"))}
      ${raw(extLink(PUBLIC_SITE.url, "Edit on my site", "btn btn-sm btn-ghost"))}
    </div>
  </div>
`;

/**
 * Shown only when the live read failed. Says which values are stale rather than
 * a generic "something went wrong" -- the golfer can then judge whether it
 * matters, which a spinner or a shrug never lets them do.
 */
const offlineNotice = () => html`
  <div class="banner-demo row row-between">
    <span>
      <b>Could not reach ${PUBLIC_SITE.host}.</b> Your name, hometown and class
      year are the last known values, so they may be out of date. Fit scores are
      unaffected &mdash; they run on your tournament results.
    </span>
    ${raw(extLink(PUBLIC_SITE.url, "Check the site", "btn btn-sm btn-sage"))}
  </div>
`;

/**
 * What the fit number does NOT account for. An unqualified score is a promise,
 * and this product is in no position to make one.
 */
const caveat = (projection, academics) =>
  projection.projected ? "projected" : academics ? "" : "athletic only";

/** Right half: where the golfer is going. One name, not a shortlist. */
const collegePanel = (highlight, projection, scenario, academics) => {
  const note = caveat(projection, academics);
  return html`
    <div class="card">
      <div class="row row-between">
        <span class="eyebrow">Best fit${raw(note ? ` &mdash; ${note}` : "")}</span>
        <a class="btn btn-sm btn-ghost" href="#/fit">See all Good Fits</a>
      </div>

      ${raw(
        highlight
          ? topPick(highlight)
          : empty("Add your scoring average and national rank to unlock fit scores.")
      )}

      ${raw(highlight ? assumption(projection, scenario) : "")}

      <p class="field-hint panel-foot">
        Logos belong to the schools and are served from their own sites. The
        numbers beside them are this demo's invention &mdash;
        <a href="#/data" style="text-decoration:underline">see sources</a>.
      </p>
    </div>
  `;
};

/**
 * The assumption, stated where the number is -- not buried in a tooltip.
 *
 * A projected score with the projection hidden is just a wrong score. Naming
 * the rate and linking to the control that changes it is the difference between
 * a forecast and a fib.
 */
const assumption = (projection, scenario) =>
  projection.projected
    ? html`<p class="field-hint">
        Assumes <b>${scenario.label.toLowerCase()}</b> &mdash;
        ${scenario.blurb} That puts you around
        <b>${projection.projectedScoringAvg}</b> in ${projection.years} years,
        when you enrol. <a href="#/fit" style="text-decoration:underline">Change
        the assumption</a>.
      </p>`
    : "";

/**
 * The single recommendation. Big enough to read as an answer rather than as
 * the first row of a table the golfer is expected to scan.
 */
const topPick = ({ school, fit }) => html`
  <a class="top-pick" href="#/fit">
    ${raw(schoolLogo(school, fit.tier))}
    <span class="top-pick-body">
      <b class="top-pick-name">${school.name}</b>
      <span class="thumb-meta">
        ${school.division} &middot; ${school.conference} &middot; team avg
        ${school.teamScoringAvg}
      </span>
      <span class="row" style="gap:.4rem;margin-top:.35rem">${raw(tierPill(fit.tier))}</span>
    </span>
    <b class="top-pick-score" style="color:var(--tier-${fit.tier})">${fit.overall}</b>
  </a>
`;

// The "you are N years from enrolling, these are today's numbers" banner used
// to live here. It was removed when the panel started projecting: it announced
// the opposite of what the panel now does, and a screen that contradicts itself
// costs more trust than the banner ever bought. The assumption line under the
// pick says the same thing, in the place the number actually is.

/**
 * No button. There is deliberately nowhere to send anyone: this app cannot
 * edit, and the site's own /api/personal has no gpa or sat field either. A
 * call-to-action pointing at a form that does not exist is worse than none.
 */
const academicsNotice = () => html`
  <div class="banner-demo">
    <span>
      <b>Academic Fit is not scored yet.</b> No GPA or test score is published
      for you &mdash; which is right, at 13. The athletic half is scored on its
      own and the academic weight is redistributed rather than counted as zero.
    </span>
  </div>
`;

const firstName = (name) => String(name || "there").split(" ")[0];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
