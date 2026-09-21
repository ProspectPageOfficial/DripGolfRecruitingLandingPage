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
} from "../lib/components.js";
import { schoolLogo } from "../lib/thumbs.js";
import {
  rankSchools,
  groupByTier,
  TIER_COPY,
  yearsToGraduation,
} from "../lib/fit.js";
import { measureTrend } from "../lib/trend.js";
import { colleges, DIVISIONS, REGIONS } from "../data/colleges.js";
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

  const years = yearsToGraduation(profile);
  const trend = measureTrend(profile.tournaments);

  const ranked = rankSchools(profile, colleges, prefs);
  const groups = groupByTier(ranked);
  const best = ranked[0];

  return html`
    <div class="container section-tight stack">
      <div>
        <span class="eyebrow">College Best Fit</span>
        <h1 class="serif" style="font-size:clamp(2rem,4.5vw,3rem);margin:.5rem 0">
          Where you actually stack up.
        </h1>
        <p class="muted" style="font-size:.92rem;max-width:60ch">
          Every program scored against your JGS rank and your grades. Expand
          any school to see exactly which input moved the number.
        </p>
      </div>

      ${raw(years != null ? enrolmentNote(years) : "")}
      ${raw(best ? summaryCard(profile, best) : "")}
      ${raw(trendCard(trend))}
      ${raw(filterBar(prefs))}

      <div id="fit-results" class="stack-sm">
        ${raw(
          ranked.length
            ? TIER_ORDER.map((tier) => tierBlock(tier, groups[tier], profile)).join("")
            : empty("No programs match those filters. Loosen one and try again.")
        )}
      </div>

      ${raw(provenanceDetails())}
    </div>
  `;
}

/**
 * The "you are N years out" caveat used to introduce a strokes-per-year
 * scenario picker. That whole apparatus went away when the Fit engine moved
 * to a rank-vs-rank comparison, because the roster's senior-year JGS rank is
 * a real historical fact and does not need a projection to be fair to a
 * younger golfer. The note stays as context -- "you are 5 years out" is still
 * information a golfer should have when reading a Reach tile.
 */
function enrolmentNote(years) {
  if (years <= 0) return "";
  return html`
    <div class="card card-flat" style="border-color:var(--sage)">
      <span class="eyebrow">Timing</span>
      <p style="font-size:.93rem;margin-top:.6rem">
        You are <b>${years} ${years === 1 ? "year" : "years"}</b> from enrolling.
        Your JGS rank today is compared against the AVERAGE senior-year JGS
        rank of each roster's current players &mdash; a rank-vs-rank comparison
        so a 13-year-old is not being measured against 22-year-olds.
      </p>
    </div>
  `;
}

/** What the golfer's own rounds actually say. Facts, not forecasts. */
function trendCard(trend) {
  if (!trend || trend.measurable === false) return "";

  const dir = trend.strokesPerYear < 0 ? "-" : "+";
  return html`
    <div class="card card-flat">
      <span class="eyebrow">Your measured trend</span>
      <div class="row" style="gap:.6rem;align-items:baseline;margin-top:.6rem">
        <span class="pill ${trend.reliable ? "pill-likely" : "pill-plain"}">
          ${dir}${Math.abs(trend.strokesPerYear)} strokes / yr
        </span>
        ${raw(trend.reliable ? "" : html`<span class="pill pill-target">Noisy</span>`)}
      </div>
      <p class="field-hint" style="margin-top:.4rem">${trend.note}</p>
      <div class="grid grid-4" style="margin-top:.8rem">
        ${raw(
          trend.seasons
            .map(
              (s) => html`<div class="stat">
                <div class="val" style="font-size:1.3rem">${s.avg}</div>
                <div class="lbl">${s.season} &middot; ${s.rounds} rounds</div>
              </div>`
            )
            .join("")
        )}
      </div>
      <p class="field-hint" style="margin-top:.6rem">
        Shown as context, not fed into the fit score. The engine now compares
        your JGS rank against each roster's senior-year JGS rank instead of
        chasing a strokes-per-year projection.
      </p>
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
          <p class="muted" style="font-size:.85rem">
            ${school.division} &middot; #${school.nationalRank} &middot;
            ${school.conference} &middot; ${school.region}
          </p>
          ${raw(versusStack(profile, school, fit, "md"))}
        </div>
      </div>
    </div>
  `;
}

function filterBar(prefs) {
  const options = (list, selected) =>
    list
      .map((v) => html`<option value="${v}" ${raw(selected === v ? "selected" : "")}>${v}</option>`)
      .join("");

  return html`
    <div class="card card-flat">
      <span class="eyebrow" style="margin-bottom:.8rem;display:flex">Preferences</span>
      <form id="fit-filters" class="filters">
        <div class="field">
          <label for="p-div">Division</label>
          <select id="p-div" name="division">
            <option value="">Any division</option>
            ${raw(options(DIVISIONS, prefs.divisions?.[0]))}
          </select>
        </div>
        <div class="field">
          <label for="p-reg">Region</label>
          <select id="p-reg" name="region">
            <option value="">Anywhere</option>
            ${raw(options(REGIONS, prefs.regions?.[0]))}
          </select>
        </div>
        <div class="field">
          <label for="p-tui">Max tuition</label>
          <select id="p-tui" name="maxTuition">
            <option value="">No limit</option>
            ${raw(
              [15000, 30000, 45000, 65000]
                .map(
                  (v) =>
                    html`<option value="${v}" ${raw(Number(prefs.maxTuition) === v ? "selected" : "")}>
                      Under ${money(v)}
                    </option>`
                )
                .join("")
            )}
          </select>
        </div>
        <div class="field">
          <label for="p-pub">School type</label>
          <select id="p-pub" name="publicOnly">
            <option value="">Any</option>
            <option value="1" ${raw(prefs.publicOnly ? "selected" : "")}>Public only</option>
          </select>
        </div>
      </form>
      <p class="field-hint" style="margin-top:.7rem">
        Preferences filter the list; they never inflate a score. Mixing "what I
        want" into "where I fit" gives you a number that means neither.
      </p>
    </div>
  `;
}

function tierBlock(tier, rows, profile) {
  if (!rows.length) return "";
  return html`
    <div class="tier-head">
      ${raw(tierPill(tier))}
      <h3>${TIER_COPY[tier].blurb}</h3>
      <span class="count">${rows.length} ${rows.length === 1 ? "program" : "programs"}</span>
    </div>
    <div class="stack-sm">${raw(rows.map((r) => schoolRow(r, profile)).join(""))}</div>
  `;
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
          <div class="school-meta">
            ${school.division} &middot; #${school.nationalRank} &middot;
            ${school.conference} &middot; ${school.region} &middot;
            ${money(school.tuition)}/yr
          </div>
          <div class="school-versus">
            <span class="school-versus-side">
              <span class="school-versus-lbl">You</span>
              <b>#${commas(profile.nationalRank)}</b>
            </span>
            <span class="school-versus-vs">vs</span>
            <span class="school-versus-side">
              <span class="school-versus-lbl">Roster HS avg</span>
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
  return versusStack(profile, school, fit, "md");
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
        tier: fit.tier,
        size,
      })
    : "";

  const gpa = fit.academicKnown
    ? gpaVersus({
        yourGpa: profile.gpa,
        schoolGpa: school.avgGPA,
        tier: fit.tier,
        size,
      })
    : "";

  const sat = fit.academicKnown
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

/** Wire filters + row expansion. Called after the view lands in the DOM. */
export function bindFit(root, { onPrefsChange }) {
  const form = root.querySelector("#fit-filters");

  const emit = () => {
    const f = form ? Object.fromEntries(new FormData(form).entries()) : {};
    onPrefsChange({
      divisions: f.division ? [f.division] : [],
      regions: f.region ? [f.region] : [],
      maxTuition: f.maxTuition ? Number(f.maxTuition) : null,
      publicOnly: Boolean(f.publicOnly),
    });
  };

  form?.addEventListener("change", emit);

  const toggle = (rowEl) => {
    const id = rowEl.dataset.school;
    const detail = root.querySelector(`[data-detail="${id}"]`);
    if (!detail) return;
    const open = detail.hasAttribute("hidden");
    detail.toggleAttribute("hidden", !open);
    rowEl.classList.toggle("open", open);
    rowEl.setAttribute("aria-expanded", String(open));
  };

  root.addEventListener("click", (e) => {
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
