/**
 * lib/components.js — presentational pieces reused across screens.
 *
 * The dial and the meter appear on the dashboard, the fit list AND the school
 * detail panel. Defining them once is the difference between "change the ring
 * thickness" being a one-line edit and a three-file scavenger hunt.
 */
import { html, raw } from "./dom.js";
import { TIER_COPY } from "./fit.js";

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

/** Empty-state block. Better than rendering nothing and looking broken. */
export const empty = (message) => html`<div class="empty">${message}</div>`;
