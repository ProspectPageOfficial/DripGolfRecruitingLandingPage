/**
 * lib/components.js — presentational pieces reused across screens.
 *
 * The dial and the meter appear on the dashboard, the fit list AND the school
 * detail panel. Defining them once is the difference between "change the ring
 * thickness" being a one-line edit and a three-file scavenger hunt.
 */
import { html, raw, commas } from "./dom.js";
import { TIER_COPY, rankVerdict } from "./fit.js";

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
 * Head-to-head rank comparison. Shows the golfer's JGS rank next to the
 * roster's average senior-year JGS rank so the fit isn't just a summary
 * number -- the two inputs that produced it are on screen too.
 *
 * @param {Object}  opts
 * @param {number}  opts.yourRank
 * @param {number}  opts.rosterRank
 * @param {string} [opts.tier="target"] tints the roster number so it reads as
 *   the target the golfer is measured against, using the same likely/target/
 *   reach palette as the rest of the score.
 * @param {"sm"|"md"} [opts.size="md"] `sm` fits inside the dashboard top-pick;
 *   `md` is the fit-page hero treatment.
 */
export function rankVersus({ yourRank, rosterRank, tier = "target", size = "md" }) {
  const { direction, phrase } = rankVerdict(yourRank, rosterRank);
  const cls = `rank-versus rank-versus-${size}`;
  return html`
    <div class="${cls}" data-direction="${direction}">
      <div class="rank-versus-side">
        <span class="rank-versus-label">You</span>
        <b class="rank-versus-num">#${commas(yourRank)}</b>
      </div>
      <span class="rank-versus-vs" aria-hidden="true">vs</span>
      <div class="rank-versus-side">
        <span class="rank-versus-label">Roster HS-senior avg</span>
        <b class="rank-versus-num" style="color:var(--tier-${tier})">#${commas(rosterRank)}</b>
      </div>
      ${raw(phrase ? html`<p class="rank-versus-phrase">${phrase}</p>` : "")}
    </div>
  `;
}

/** Empty-state block. Better than rendering nothing and looking broken. */
export const empty = (message) => html`<div class="empty">${message}</div>`;
