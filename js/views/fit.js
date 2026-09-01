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
import { dial, meter, tierPill, empty } from "../lib/components.js";
import { schoolLogo } from "../lib/thumbs.js";
import {
  rankSchools,
  groupByTier,
  projectGolfer,
  yearsToGraduation,
  IMPROVEMENT,
  TIER_COPY,
} from "../lib/fit.js";
import {
  measureTrend,
  SCENARIOS,
  DEFAULT_SCENARIO,
  scenarioByKey,
} from "../lib/trend.js";
import { colleges, DIVISIONS, REGIONS } from "../data/colleges.js";
import { provenanceDetails } from "./provenance.js";

const TIER_ORDER = ["likely", "target", "reach"];

/**
 * The engine needs these two and nothing else. GPA and SAT are OPTIONAL --
 * a middle schooler has neither, and locking them out of the whole feature
 * over a test they cannot sit for four years would be absurd.
 */
const REQUIRED = ["scoringAvg", "nationalRank"];

export function fitView(profile, prefs = {}) {
  const missing = REQUIRED.filter((f) => profile?.[f] == null);
  if (missing.length) return incompleteState(missing);

  // Golfers years away from enrolling are scored against a SCENARIO they pick,
  // not against a rate we invented. See lib/trend.js for why.
  const scenario = scenarioByKey(prefs.scenario ?? DEFAULT_SCENARIO);
  const projection = projectGolfer(profile, {
    strokesPerYear: scenario.strokesPerYear,
  });
  const scored = projection.golfer;
  const years = yearsToGraduation(profile);
  const showPlanner = years != null && years >= IMPROVEMENT.minYears;
  const trend = showPlanner ? measureTrend(profile.tournaments) : null;

  const ranked = rankSchools(scored, colleges, prefs);
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
          Every program scored against your game and your grades. Expand any
          school to see exactly which input moved the number.
        </p>
      </div>

      ${raw(showPlanner ? plannerCard(projection, scenario, trend, years) : "")}
      ${raw(best ? summaryCard(scored, best, projection) : "")}
      ${raw(filterBar(prefs))}

      <div id="fit-results" class="stack-sm">
        ${raw(
          ranked.length
            ? TIER_ORDER.map((tier) => tierBlock(tier, groups[tier])).join("")
            : empty("No programs match those filters. Loosen one and try again.")
        )}
      </div>

      ${raw(provenanceDetails())}
    </div>
  `;
}

/**
 * The planner. Deliberately shows THREE things in this order:
 *   1. what the golfer's own scores actually say (fact),
 *   2. the what-if they have chosen (assumption, theirs to change),
 *   3. the resulting number (consequence).
 * Presenting 2 without 1 is how you end up with a confident lie.
 */
function plannerCard(projection, scenario, trend, years) {
  const horizon = Math.min(years, IMPROVEMENT.maxYears);

  return html`
    <div class="card card-flat" style="border-color:var(--sage)">
      <span class="eyebrow">Planning ahead</span>
      <p style="font-size:.93rem;margin-top:.6rem">
        You are <b>${years} years</b> from enrolling, so comparing today's card
        against today's rosters would not tell you much. Pick a scenario and we
        will score the version of you that shows up on campus.
      </p>

      ${raw(trendBlock(trend))}

      <div style="margin-top:1.1rem">
        <form id="fit-scenario" class="filters">
          <div class="field">
            <label for="p-scen">Scenario</label>
            <select id="p-scen" name="scenario">
              ${raw(
                SCENARIOS.map(
                  (s) => html`<option value="${s.key}" ${raw(s.key === scenario.key ? "selected" : "")}>
                      ${s.label}${raw(s.strokesPerYear ? ` (${Math.abs(s.strokesPerYear)}/yr)` : "")}
                    </option>`
                ).join("")
              )}
            </select>
            <span class="field-hint">${scenario.blurb}</span>
          </div>
          <div class="field">
            <label>Scoring average used</label>
            <div class="stat" style="text-align:left">
              <div class="val" style="font-size:1.3rem">
                ${projection.currentScoringAvg}${raw(
                  projection.projected
                    ? ` &rarr; ${projection.projectedScoringAvg}`
                    : ""
                )}
              </div>
              <div class="lbl">
                ${raw(
                  projection.projected
                    ? `over ${horizon} years`
                    : "today's card, unchanged"
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      <p class="field-hint" style="margin-top:.9rem">
        This is a what-if, not a forecast. National ranking is excluded from a
        projection on purpose &mdash; an overall junior rank puts every
        13-year-old behind every 17-year-old, so it measures age, not ceiling.
      </p>
    </div>
  `;
}

/** What the golfer's own rounds actually say. Facts before assumptions. */
function trendBlock(trend) {
  if (!trend) return "";

  if (!trend.measurable) {
    return html`<p class="field-hint" style="margin-top:.8rem">
      <b>Your measured trend:</b> ${trend.note}
    </p>`;
  }

  const dir = trend.strokesPerYear < 0 ? "-" : "+";
  return html`
    <div style="margin-top:1rem">
      <div class="row" style="gap:.6rem;align-items:baseline">
        <b style="font-size:.88rem">Your measured trend:</b>
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
    </div>
  `;
}

function summaryCard(profile, best, projection) {
  const { fit, school } = best;
  const academicsKnown = fit.academicKnown;
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
          <div class="grid grid-2" style="margin-top:.5rem">
            ${raw(meter("Athletic fit", fit.athletic, "Can you compete on this roster?"))}
            ${raw(
              academicsKnown
                ? meter("Academic fit", fit.academic, "Do your grades match the school?")
                : html`<div class="meter">
                    <div class="meter-top"><span>Academic fit</span><b>&mdash;</b></div>
                    <div class="meter-bar"></div>
                    <span class="field-hint">Not scored yet &mdash; no GPA or test score on file.</span>
                  </div>`
            )}
          </div>
        </div>
      </div>
      <div class="grid grid-4" style="margin-top:1.4rem">
        <div class="stat">
          <div class="val">${profile.scoringAvg}</div>
          <div class="lbl">${raw(projection?.projected ? "Projected avg" : "Scoring avg")}</div>
        </div>
        <div class="stat">
          <div class="val">${fit.rankKnown ? "#" + commas(profile.nationalRank) : "\u2014"}</div>
          <div class="lbl">${raw(fit.rankKnown ? "National rank" : "Rank (n/a yet)")}</div>
        </div>
        <div class="stat"><div class="val">${academicsKnown ? Number(profile.gpa).toFixed(2) : "\u2014"}</div><div class="lbl">GPA</div></div>
        <div class="stat"><div class="val">${academicsKnown ? profile.sat : "\u2014"}</div><div class="lbl">SAT</div></div>
      </div>
      ${raw(
        academicsKnown
          ? ""
          : html`<div class="banner-demo" style="margin:1.2rem 0 0">
              <b>Athletic fit only.</b> These scores reflect your game, not your
              grades. Add a GPA and test score when you have them and every
              number here re-weights automatically. We will not guess them for you.
            </div>`
      )}
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

function tierBlock(tier, rows) {
  if (!rows.length) return "";
  return html`
    <div class="tier-head">
      ${raw(tierPill(tier))}
      <h3>${TIER_COPY[tier].blurb}</h3>
      <span class="count">${rows.length} ${rows.length === 1 ? "program" : "programs"}</span>
    </div>
    <div class="stack-sm">${raw(rows.map(schoolRow).join(""))}</div>
  `;
}

function schoolRow({ school, fit }) {
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
            ${money(school.tuition)}/yr &middot; team avg ${school.teamScoringAvg}
          </div>
        </div>
        ${raw(tierPill(fit.tier))}
      </div>
      <div class="school-detail" data-detail="${school.id}" hidden>
        ${raw(detailBody(school, fit))}
      </div>
    </div>
  `;
}

function detailBody(school, fit) {
  return html`
    <div class="grid grid-2">
      ${raw(fit.components.map((c) => meter(c.label, c.score, c.detail)).join(""))}
    </div>
    ${raw(
      fit.capped
        ? html`<div class="alert alert-error" style="margin-top:.9rem">
            Overall score capped: academic fit is the limiting factor here, not
            your golf. Lifting GPA or test scores unlocks this program.
          </div>`
        : ""
    )}
    <div class="grid grid-4" style="margin-top:1rem">
      <div class="stat"><div class="val">${school.teamScoringAvg}</div><div class="lbl">Team avg</div></div>
      <div class="stat"><div class="val">#${commas(school.recruitRank)}</div><div class="lbl">Typical recruit</div></div>
      <div class="stat"><div class="val">${school.acceptRate}%</div><div class="lbl">Accept rate</div></div>
      <div class="stat"><div class="val">${school.roster}</div><div class="lbl">Roster size</div></div>
    </div>
  `;
}

function incompleteState(missing) {
  const NAMES = {
    scoringAvg: "scoring average",
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

/** Wire filters + row expansion. Called after the view lands in the DOM. */
export function bindFit(root, { onPrefsChange, prefs = {} }) {
  const form = root.querySelector("#fit-filters");
  const scenarioForm = root.querySelector("#fit-scenario");

  const emit = () => {
    const f = form ? Object.fromEntries(new FormData(form).entries()) : {};
    const s = scenarioForm
      ? Object.fromEntries(new FormData(scenarioForm).entries())
      : {};
    onPrefsChange({
      divisions: f.division ? [f.division] : [],
      regions: f.region ? [f.region] : [],
      maxTuition: f.maxTuition ? Number(f.maxTuition) : null,
      publicOnly: Boolean(f.publicOnly),
      scenario: s.scenario ?? prefs.scenario ?? DEFAULT_SCENARIO,
    });
  };

  form?.addEventListener("change", emit);
  scenarioForm?.addEventListener("change", emit);

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
