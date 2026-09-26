/**
 * views/dashboard.js — what a golfer sees straight after signing in.
 *
 * Laid out as a DUAL: the left panel is what coaches see today (a live frame of
 * the real public page), the right is where the golfer could go (one fit
 * recommendation). Present state and future state, side by side, because the
 * whole point of the product is the gap between them.
 *
 * A hub, not a destination. Every panel ends in a link somewhere more useful.
 */
import { html, raw, extLink } from "../lib/dom.js";
import { empty, tierPill, rankVersus, coachCard } from "../lib/components.js";
import { schoolLogo, sitePreview } from "../lib/thumbs.js";
import {
  rankSchools,
  pickHighlight,
  hasAcademics,
  isScorable,
  headCoachFor,
  coachGenderFor,
} from "../lib/fit.js";
import { colleges } from "../data/colleges.js";
import { PUBLIC_SITE } from "../config.js";

/**
 * The "N% complete" dial and the "still missing: bio" prompt both used to live
 * here. They went with the editor: this app has no way to fill a gap in, so
 * nagging about one would be pointing at a door with no handle. The website
 * owns those fields and is where they get finished.
 *
 * The strokes-per-year projection banner that used to live here went the same
 * way when the Fit engine switched to a rank-vs-rank comparison. The new
 * athletic metric compares a junior's JGS rank against the AVERAGE senior-year
 * JGS rank of the roster's current players -- age-normalized by construction,
 * so no what-if is needed to score a 13-year-old fairly.
 */
export function dashboardView(profile, liveOk = true) {
  const ranked = isScorable(profile) ? rankSchools(profile, colleges) : [];
  const highlight = pickHighlight(ranked);
  const academics = hasAcademics(profile);

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
        ${raw(collegePanel(highlight, academics, profile))}
      </div>

      ${raw(academics || !isScorable(profile) ? "" : academicsNotice())}

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
      unaffected &mdash; they run on your JGS rank.
    </span>
    ${raw(extLink(PUBLIC_SITE.url, "Check the site", "btn btn-sm btn-sage"))}
  </div>
`;

/** Right half: where the golfer is going. One name, not a shortlist. */
const collegePanel = (highlight, academics, profile) => {
  const note = academics ? "" : "athletic only";
  return html`
    <div class="card">
      <div class="row row-between">
        <span class="eyebrow">Best fit${raw(note ? ` &mdash; ${note}` : "")}</span>
        <a class="btn btn-sm btn-ghost" href="#/fit">See all Good Fits</a>
      </div>

      ${raw(
        highlight
          ? topPick(highlight, profile)
          : empty("Add your JGS national rank to unlock fit scores.")
      )}

      <p class="field-hint panel-foot">
        Logos belong to the schools and are served from their own sites. The
        numbers beside them are this demo's invention &mdash;
        <a href="#/data" style="text-decoration:underline">see sources</a>.
      </p>
    </div>
  `;
};

/**
 * The single recommendation. Big enough to read as an answer rather than as
 * the first row of a table the golfer is expected to scan.
 *
 * The rank versus block is the whole point: without it, the golfer sees
 * "Emory, fit 62, Target" and has to trust the number. With it, the two ranks
 * that produced the score are visible on the same tile, so the recommendation
 * shows its work.
 */
/**
 * The top-pick tile is a link to #/fit for the rest of the page, with the
 * head coach's contact card underneath it -- outside the <a>, so tapping the
 * coach's email or phone does not also bounce the golfer to #/fit.
 */
const topPick = ({ school, fit }, profile) => {
  const coach = headCoachFor(school, coachGenderFor(profile));
  return html`
    <div class="top-pick">
      <a class="top-pick-link" href="#/fit">
        <div class="top-pick-head">
          ${raw(schoolLogo(school, fit.tier))}
          <span class="top-pick-body">
            <b class="top-pick-name">${school.name}</b>
            <span class="thumb-meta">
              ${school.division} &middot; ${school.conference}
            </span>
            <span class="row" style="gap:.4rem;margin-top:.35rem">${raw(tierPill(fit.tier))}</span>
          </span>
          <b class="top-pick-score" style="color:var(--tier-${fit.tier})">${fit.overall}</b>
        </div>
        ${raw(fit.rankKnown ? rankVersus({
          yourRank: profile.nationalRank,
          rosterRank: school.avgRosterSeniorJgsRank,
          tier: fit.tier,
          size: "sm",
        }) : "")}
      </a>
      ${raw(coachCard(coach, "prominent"))}
    </div>
  `;
};

/**
 * The site now owns GPA and SAT/ACT fields, so the notice points at the
 * place a golfer can actually fill them in. Same rule as the profile: this
 * app does not edit -- it reads. Publish on the site, refresh here.
 */
const academicsNotice = () => html`
  <div class="banner-demo row row-between">
    <span>
      <b>Academic Fit is not scored yet.</b> No GPA or test score is published
      for you &mdash; which is right, at 13. The athletic half is scored on its
      own and the academic weight is redistributed rather than counted as zero.
      Add them on your site when you have them and every fit re-weights
      automatically.
    </span>
    ${raw(extLink(PUBLIC_SITE.url, "Add on my site", "btn btn-sm btn-sage"))}
  </div>
`;

const firstName = (name) => String(name || "there").split(" ")[0];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
