/**
 * lib/components.js — presentational pieces reused across screens.
 *
 * The dial and the meter appear on the dashboard, the fit list AND the school
 * detail panel. Defining them once is the difference between "change the ring
 * thickness" being a one-line edit and a three-file scavenger hunt.
 */
import { html, raw, commas } from "./dom.js";
import { TIER_COPY, rankVerdict, gpaVerdict, satVerdict } from "./fit.js";

const TIER_STROKE = {
  likely: "var(--tier-likely)",
  target: "var(--tier-target)",
  reach: "var(--tier-reach)",
};

/**
 * Circular score gauge.
 * @param {number} value 0-100
 * @param {string} tier  likely | target | reach
 */
export function dial(value, tier = "target", size = 150) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);

  return html`
    <div class="dial" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" aria-hidden="true">
        <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}"
                stroke-width="${stroke}" />
        <circle class="fill" cx="${size / 2}" cy="${size / 2}" r="${r}"
                stroke-width="${stroke}"
                stroke="${TIER_STROKE[tier]}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}" />
      </svg>
      <div class="dial-num">${Math.round(value)}</div>
    </div>
  `;
}

/** Labelled 0-100 progress bar. */
export function meter(label, value, hint = "") {
  return html`
    <div class="meter">
      <div class="meter-top">
        <span>${label}</span>
        <b>${Math.round(value)}</b>
      </div>
      <div class="meter-bar"><i style="width:${Math.max(2, value)}%"></i></div>
      ${raw(hint ? html`<span class="field-hint">${hint}</span>` : "")}
    </div>
  `;
}

export const tierPill = (tier) =>
  html`<span class="pill pill-${tier}">${TIER_COPY[tier].label}</span>`;

/**
 * Head-to-head comparison of any stat where a golfer has one number and a
 * benchmark (roster / school average) has another. "Ahead" always means the
 * golfer is doing better, whether the underlying metric rewards LOWER (rank)
 * or HIGHER (GPA, SAT) numbers -- so the CSS tint reads correctly across
 * all three stats.
 *
 * The tier-typed wrappers below (`rankVersus`, `gpaVersus`, `satVersus`)
 * hide the display-formatting bits, so callers just pass raw numbers.
 *
 * @param {Object}  opts
 * @param {string}  opts.label      what the right-hand number represents
 * @param {string}  opts.yourDisplay pre-formatted string for the golfer's value
 * @param {string}  opts.theirDisplay pre-formatted string for the benchmark
 * @param {string}  opts.direction  "ahead" | "behind" | "level"
 * @param {string}  opts.phrase     one-line verdict shown under the pair
 * @param {string} [opts.tier="target"]
 * @param {"sm"|"md"} [opts.size="md"]
 */
export function statVersus({
  label,
  yourDisplay,
  theirDisplay,
  direction,
  phrase,
  tier = "target",
  size = "md",
}) {
  const cls = `stat-versus stat-versus-${size}`;
  return html`
    <div class="${cls}" data-direction="${direction}">
      <div class="stat-versus-side">
        <span class="stat-versus-label">You</span>
        <b class="stat-versus-num">${yourDisplay}</b>
      </div>
      <span class="stat-versus-vs" aria-hidden="true">vs</span>
      <div class="stat-versus-side">
        <span class="stat-versus-label">${label}</span>
        <b class="stat-versus-num" style="color:var(--tier-${tier})">${theirDisplay}</b>
      </div>
      ${raw(phrase ? html`<p class="stat-versus-phrase">${phrase}</p>` : "")}
    </div>
  `;
}

/** JGS rank versus the roster's average senior-year JGS rank. */
export function rankVersus({ yourRank, rosterRank, tier = "target", size = "md" }) {
  const { direction, phrase } = rankVerdict(yourRank, rosterRank);
  return statVersus({
    label: "Roster HS-senior avg",
    yourDisplay: `#${commas(yourRank)}`,
    theirDisplay: `#${commas(rosterRank)}`,
    direction, phrase, tier, size,
  });
}

/** GPA versus the school's admitted average. */
export function gpaVersus({ yourGpa, schoolGpa, tier = "target", size = "md" }) {
  const { direction, phrase } = gpaVerdict(yourGpa, schoolGpa);
  return statVersus({
    label: "School avg GPA",
    yourDisplay: Number(yourGpa).toFixed(2),
    theirDisplay: Number(schoolGpa).toFixed(2),
    direction, phrase, tier, size,
  });
}

/** SAT versus the school's admitted average. */
export function satVersus({ yourSat, schoolSat, tier = "target", size = "md" }) {
  const { direction, phrase } = satVerdict(yourSat, schoolSat);
  return statVersus({
    label: "School avg SAT",
    yourDisplay: commas(yourSat),
    theirDisplay: commas(schoolSat),
    direction, phrase, tier, size,
  });
}

/** Empty-state block. Better than rendering nothing and looking broken. */
export const empty = (message) => html`<div class="empty">${message}</div>`;
