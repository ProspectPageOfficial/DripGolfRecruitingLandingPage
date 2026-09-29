/**
 * views/fit.js — College Best Fit.
 *
 * This view is deliberately dumb. It owns layout and event wiring; every
 * decision about what a number MEANS lives in lib/fit.js. If you ever find
 * yourself writing `if (score > 78)` in this file, stop -- that belongs in the
 * engine, where it can be tested without a browser.
 */
import { html, raw, money, commas, extLink } from "../lib/dom.js";
import { PUBLIC_SITE } from "../config.js";
import {
  dial,
  tierPill,
  empty,
  rankVersus,
  gpaVersus,
  satVersus,
  coachCard,
} from "../lib/components.js";
import { schoolLogo } from "../lib/thumbs.js";
import {
  rankSchools,
  pickHighlight,
  groupByTier,
  TIER_COPY,
  headCoachFor,
  coachGenderFor,
} from "../lib/fit.js";
import { colleges } from "../data/colleges.js";
import { provenanceDetails } from "./provenance.js";

const TIER_ORDER = ["likely", "target", "reach"];

/**
 * The engine needs national rank and nothing else. GPA and SAT are optional --
 * a middle schooler has neither, and locking them out of the whole feature
 * over a test they cannot sit for four years would be absurd.
 *
 * Scoring average is no longer required either: the athletic score is now a
 * rank-vs-rank comparison against the roster's senior-year JGS rank, so the
 * golfer's own average is displayed as context rather than fed into the model.
 */
const REQUIRED = ["nationalRank"];

export function fitView(profile, prefs = {}) {
  const missing = REQUIRED.filter((f) => profile?.[f] == null);
  if (missing.length) return incompleteState(missing);

  const ranked = rankSchools(profile, colleges, prefs);
  const groups = groupByTier(ranked);
  // Same pick as the dashboard's Best Fit panel. With ~900 programs the raw
  // top score is usually the easiest team to make, not the one worth leading
  // with; pickHighlight features the strongest program within a few points.
  const best = pickHighlight(ranked);

  return html`
    <div class="container section-tight stack">
      <div>
        <span class="eyebrow">College Best Fit</span>
        <h1 class="serif" style="font-size:clamp(2rem,4.5vw,3rem);margin:.5rem 0">
          Where you actually stack up.
        </h1>
      </div>

      ${raw(best ? summaryCard(profile, best) : "")}
      ${raw(searchBar(prefs))}

      <div id="fit-results" class="stack-sm">
        ${raw(renderResults(ranked, groups, profile))}
      </div>

      ${raw(provenanceDetails())}
    </div>
  `;
}

/**
 * The summary card is now just the identity of the school plus the trio of
 * head-to-head comparisons that produced its score. No meters, no scalar
 * stats, no banners: any of those describe the fit ABOUT the numbers, which
 * is what the user asked to strip out. The versus blocks show the two
 * numbers themselves, which is the whole point.
 */
function summaryCard(profile, best) {
  const { fit, school } = best;
  return html`
    <div class="card">
      <div class="fit-hero">
        ${raw(dial(fit.overall, fit.tier))}
        <div class="stack-sm">
          <div class="row">
            <span class="eyebrow">Best match</span>
            ${raw(tierPill(fit.tier))}
          </div>
          <h2 class="serif" style="font-size:1.65rem">${school.name}</h2>
          <p class="muted" style="font-size:.85rem">${schoolMeta(school)}</p>
          ${raw(versusStack(profile, school, fit, "md"))}
          ${raw(coachAction(profile, school, "prominent"))}
        </div>
      </div>
    </div>
  `;
}

/**
 * A single school-name search input. Live filtering happens in bindFit --
 * this function only paints the initial input, so a typed query survives an
 * accidental refresh (the value is pulled from the incoming prefs).
 *
 * The old dropdown filter form (division / region / tuition / public) went
 * away with this change. Anyone who wants those back should un-strip the
 * previous `filterBar` in git history rather than layering both.
 */
function searchBar(prefs) {
  const initial = typeof prefs.search === "string" ? prefs.search : "";
  return html`
    <div class="card card-flat">
      <label for="p-search" class="eyebrow" style="display:block;margin-bottom:.6rem">
        Search schools
      </label>
      <input id="p-search" name="search" type="search" autocomplete="off"
             spellcheck="false" placeholder="Stanford, ACC, ..."
             value="${initial}"
             class="search-input" />
      <p class="field-hint" style="margin-top:.5rem">
        Matches school names and conferences. Filters the list &mdash; scores
        do not move.
      </p>
    </div>
  `;
}

/**
 * With ~900 programs a tier can hold hundreds of rows, and every row pulls a
 * logo. Show the best PAGE of each tier; "Show all" opens the rest.
 */
const PAGE = 25;

/** "D1 · #4 · SEC · Southwest · $12k/yr", skipping whatever is not on file. */
function schoolMeta(school, withTuition = false) {
  return [
    school.division,
    school.nationalRank != null ? `#${school.nationalRank}` : null,
    school.conference,
    school.region ?? school.state,
    withTuition && Number.isFinite(school.tuition) ? `${money(school.tuition)}/yr` : null,
  ].filter(Boolean).join(" · ");
}

function tierBlock(tier, rows, profile, expanded = false) {
  if (!rows.length) return "";
  const shown = expanded ? rows : rows.slice(0, PAGE);
  return html`
    <div class="tier-head">
      ${raw(tierPill(tier))}
      <h3>${TIER_COPY[tier].blurb}</h3>
      <span class="count">${rows.length} ${rows.length === 1 ? "program" : "programs"}</span>
    </div>
    <div class="stack-sm">${raw(shown.map((r) => schoolRow(r, profile)).join(""))}</div>
    ${raw(rows.length > shown.length
      ? html`<button class="btn btn-sm btn-ghost btn-block" type="button" data-more="${tier}">
          Show all ${rows.length} ${TIER_COPY[tier].label} programs
        </button>`
      : "")}
  `;
}

/**
 * Paint the tiered results (or an empty state). Extracted from `fitView` so
 * the live-search handler in bindFit can re-render just this container on
 * every keystroke without disturbing the search input's focus or caret.
 */
function renderResults(ranked, groups, profile, expanded = new Set()) {
  if (!ranked.length) {
    return empty("No schools match that search. Clear it to see the full list.");
  }
  return TIER_ORDER.map((tier) => tierBlock(tier, groups[tier], profile, expanded.has(tier))).join("");
}

function schoolRow({ school, fit }, profile) {
  return html`
    <div>
      <div class="school-row" data-school="${school.id}" role="button" tabindex="0"
           aria-expanded="false">
        ${raw(schoolLogo(school, fit.tier))}
        <div class="school-score" style="color:var(--tier-${fit.tier})">${fit.overall}</div>
        <div>
          <div class="school-name">${school.name}</div>
          <div class="school-meta">${schoolMeta(school, true)}</div>
          <div class="school-versus">
            <span class="school-versus-side">
              <span class="school-versus-lbl">Your JGS rank</span>
              <b>#${commas(profile.nationalRank)}</b>
            </span>
            <span class="school-versus-vs">vs</span>
            <span class="school-versus-side">
              <span class="school-versus-lbl">Roster HS avg${school.rankSource === "conference-estimate" ? " (est.)" : ""}</span>
              <b style="color:var(--tier-${fit.tier})">#${commas(school.avgRosterSeniorJgsRank)}</b>
            </span>
          </div>
        </div>
        ${raw(tierPill(fit.tier))}
      </div>
      <div class="school-detail" data-detail="${school.id}" hidden>
        ${raw(detailBody(school, fit, profile))}
      </div>
    </div>
  `;
}

/**
 * The expanded description of a fit is the same three head-to-head
 * comparisons and nothing else. Component meters, capped-fit alerts and
 * roster/tuition stats all described the fit; they did not SHOW the two
 * numbers being compared. That is what the versus blocks are for, and the
 * detail body is now those blocks only.
 */
function detailBody(school, fit, profile) {
  return html`
    ${raw(versusStack(profile, school, fit, "md"))}
    ${raw(coachAction(profile, school, "subtle"))}
  `;
}

/**
 * The one thing on this view that isn't the head-to-head comparison but earns
 * its place anyway: who the head coach is and how to reach them. A recruit
 * who trusts a fit still needs to reach someone. Two styles -- "prominent"
 * for the summary card, "subtle" for row details -- so the long row list
 * does not shout.
 */
function coachAction(profile, school, style = "prominent") {
  return coachCard(headCoachFor(school, coachGenderFor(profile)), style);
}

function incompleteState(missing) {
  const NAMES = {
    nationalRank: "national rank",
  };
  return html`
    <div class="container section-tight">
      <div class="card stack">
        <span class="eyebrow">College Best Fit</span>
        <h1 class="serif" style="font-size:2rem">Almost there.</h1>
        <p class="muted" style="font-size:.92rem">
          We need ${missing.length} more ${missing.length === 1 ? "number" : "numbers"}
          before we can score you honestly:
          <b>${missing.map((m) => NAMES[m]).join(", ")}</b>.
          Guessing on your behalf would produce a confident, useless answer.
        </p>
        <p class="field-hint">
          These come from your published results, not from a form here &mdash;
          this app reads your site rather than keeping its own copy.
        </p>
        <div>${raw(extLink(PUBLIC_SITE.url, "Open my site", "btn"))}</div>
      </div>
    </div>
  `;
}

/**
 * Render the trio of head-to-head comparisons that back the fit score:
 * rank vs roster average, GPA vs school average, SAT vs school average.
 *
 * Each block only appears when its inputs are on file -- rank without
 * academics still gets a rank block; academics without rank get GPA and SAT.
 * Nothing is invented to fill an empty slot, which is the same rule the
 * scoring engine follows for those inputs.
 */
function versusStack(profile, school, fit, size) {
  const rank = fit.rankKnown
    ? rankVersus({
        yourRank: profile.nationalRank,
        rosterRank: school.avgRosterSeniorJgsRank,
        estimated: school.rankSource === "conference-estimate",
        tier: fit.tier,
        size,
      })
    : "";

  const gpa = fit.academicKnown && Number.isFinite(school.avgGPA)
    ? gpaVersus({
        yourGpa: profile.gpa,
        schoolGpa: school.avgGPA,
        tier: fit.tier,
        size,
      })
    : "";

  const sat = fit.academicKnown && Number.isFinite(school.avgSAT)
    ? satVersus({
        yourSat: profile.sat,
        schoolSat: school.avgSAT,
        tier: fit.tier,
        size,
      })
    : "";

  if (!rank && !gpa && !sat) return "";

  return html`
    <div class="versus-stack">
      ${raw(rank)}
      ${raw(gpa || sat
        ? html`<div class="versus-stack-academics">${raw(gpa)}${raw(sat)}</div>`
        : "")}
    </div>
  `;
}

/**
 * Wire search + row expansion.
 *
 * The search input runs LOCALLY: on every keystroke we recompute the tiered
 * result list and swap the `#fit-results` container's contents. A full route
 * re-render would blow away the input's focus and caret, which is exactly
 * the frustration a live-search field is supposed to avoid.
 *
 * @param {HTMLElement} root  the app container
 * @param {Object} opts
 * @param {Object} opts.profile  the golfer whose numbers score the schools.
 *   Required, because live search re-runs `rankSchools` on every keystroke.
 */
export function bindFit(root, { profile }) {
  const searchEl = root.querySelector("#p-search");
  const resultsEl = root.querySelector("#fit-results");

  // Tiers the golfer has opened with "Show all". A new search closes them
  // again, since a different query is a different list.
  const expanded = new Set();

  const applySearch = () => {
    if (!resultsEl) return;
    const prefs = { search: searchEl?.value ?? "" };
    const ranked = rankSchools(profile, colleges, prefs);
    const groups = groupByTier(ranked);
    resultsEl.innerHTML = renderResults(ranked, groups, profile, expanded);
  };

  searchEl?.addEventListener("input", () => {
    expanded.clear();
    applySearch();
  });

  const toggle = (rowEl) => {
    const id = rowEl.dataset.school;
    const detail = root.querySelector(`[data-detail="${id}"]`);
    if (!detail) return;
    const open = detail.hasAttribute("hidden");
    detail.toggleAttribute("hidden", !open);
    rowEl.classList.toggle("open", open);
    rowEl.setAttribute("aria-expanded", String(open));
  };

  // Event delegation on `root` survives the innerHTML swap in applySearch,
  // which would detach any listener attached directly to a row element.
  root.addEventListener("click", (e) => {
    const more = e.target.closest("[data-more]");
    if (more) {
      expanded.add(more.dataset.more);
      applySearch();
      return;
    }
    const row = e.target.closest(".school-row");
    if (row) toggle(row);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".school-row");
    if (!row) return;
    e.preventDefault();
    toggle(row);
  });
}
