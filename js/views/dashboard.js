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
  rosterOutlook,
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
 *
 * `mock` is the sign-up demo (views/signup.js): a golfer with no site yet. It
 * swaps the live frame for a rendered preview of their answers, points the
 * Best Fit link at the mock's own fit page, and drops the notices that talk
 * about Luke's site.
 *
 * `canDelete` is set only for a real account (#/my): it adds the
 * delete-account section at the bottom.
 *
 * @param {{pagePanel:string, banner:string, fitHref:string, canDelete?:boolean}} [mock]
 */
export function dashboardView(profile, liveOk = true, mock = null) {
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

      ${raw(mock ? mock.banner : liveOk ? "" : offlineNotice())}

      <div class="dual">
        ${raw(mock ? mock.pagePanel : myPagePanel(liveOk))}
        ${raw(collegePanel(highlight, academics, profile, mock?.fitHref))}
      </div>

      ${raw(mock || academics || !isScorable(profile) ? "" : academicsNotice())}

      ${raw(mock?.canDelete ? deleteAccountPanel(profile) : "")}

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
const collegePanel = (highlight, academics, profile, fitHref = "#/fit") => {
  const note = academics ? "" : "athletic only";
  return html`
    <div class="card">
      <div class="row row-between">
        <span class="eyebrow">Best fit${raw(note ? ` &mdash; ${note}` : "")}</span>
        <a class="btn btn-sm btn-ghost" href="${fitHref}">See all Good Fits</a>
      </div>

      ${raw(
        highlight
          ? topPick(highlight, profile, fitHref)
          : empty("Add your JGS national rank to unlock fit scores.")
      )}
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
const topPick = ({ school, fit }, profile, fitHref) => {
  const coach = headCoachFor(school, coachGenderFor(profile));
  return html`
    <div class="top-pick">
      <a class="top-pick-link" href="${fitHref}">
        <div class="top-pick-head">
          ${raw(schoolLogo(school, fit.tier))}
          <span class="top-pick-body">
            <b class="top-pick-name">${school.name}</b>
            <span class="thumb-meta">
              ${school.division} &middot; ${school.conference}
            </span>
            ${raw(rosterOutlook(school, profile) ? html`<span class="school-roster">${rosterOutlook(school, profile).text}</span>` : "")}
            <span class="row" style="gap:.4rem;margin-top:.35rem">${raw(tierPill(fit.tier))}</span>
          </span>
          <b class="top-pick-score" style="color:var(--tier-${fit.tier})">${fit.overall}</b>
        </div>
        ${raw(fit.rankKnown ? rankVersus({
          yourRank: profile.nationalRank,
          rosterRank: school.avgRosterSeniorJgsRank,
          estimated: school.rankSource === "conference-estimate",
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

/**
 * Bottom of a real account's dashboard. The button only opens the form; the
 * delete itself needs the password typed again, because nothing about it can
 * be undone.
 */
const deleteAccountPanel = (profile) => html`
  <div class="card danger-zone">
    <div class="row row-between">
      <span>
        <b>Delete account</b><br>
        <span class="field-hint">Permanently removes your account, ${firstName(profile.name)}'s page,
        and every photo, video and edit on it.</span>
      </span>
      <button type="button" class="btn btn-sm btn-danger" data-action="delete-open">Delete account</button>
    </div>
    <form class="stack danger-form" data-delete-form hidden novalidate>
      <div class="alert alert-error">
        This can't be undone. The page stops working for anyone you've sent the link to.
      </div>
      <div class="field">
        <label for="delete-password">Type your password to confirm</label>
        <input id="delete-password" type="password" autocomplete="current-password" required>
      </div>
      <div data-delete-msg role="status" aria-live="polite"></div>
      <div class="row">
        <button type="submit" class="btn btn-sm btn-danger">Delete my account forever</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="delete-cancel">Cancel</button>
      </div>
    </form>
  </div>
`;

/**
 * Wires the delete section. `onDeleted` runs after the server confirms; the
 * caller signs the tab out and leaves.
 */
export function bindDeleteAccount(root, { email, onDeleted }) {
  const form = root.querySelector("[data-delete-form]");
  if (!form) return;
  const openBtn = root.querySelector("[data-action='delete-open']");
  const msg = form.querySelector("[data-delete-msg]");
  const input = form.querySelector("#delete-password");
  const submit = form.querySelector("button[type='submit']");
  const say = (text) => { msg.innerHTML = text ? html`<div class="alert alert-error">${text}</div>` : ""; };

  openBtn.addEventListener("click", () => {
    form.hidden = false;
    openBtn.hidden = true;
    input.focus();
  });
  form.querySelector("[data-action='delete-cancel']").addEventListener("click", () => {
    form.hidden = true;
    openBtn.hidden = false;
    input.value = "";
    say("");
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!input.value) return say("Type your password to confirm.");
    submit.disabled = true;
    say("");
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: input.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return say(body.error || "Couldn't delete the account. Please try again.");
      onDeleted();
    } catch {
      say("Couldn't reach the server. Check your connection and try again.");
    } finally {
      submit.disabled = false;
    }
  });
}

const firstName = (name) => String(name || "there").split(" ")[0];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
