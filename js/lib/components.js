/**
 * lib/components.js — presentational pieces reused across screens.
 *
 * The dial and the meter appear on the dashboard, the fit list AND the school
 * detail panel. Defining them once is the difference between "change the ring
 * thickness" being a one-line edit and a three-file scavenger hunt.
 */
import { html, raw, commas, initials } from "./dom.js";
import { TIER_COPY, rankVerdict, gpaVerdict, satVerdict } from "./fit.js";
import { COACHES_VERIFIED } from "../data/coaches.js";

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
 * @param {string} [opts.yourLabel="You"] label above the golfer's number. Each
 *   stat wrapper below sets this to the specific stat ("Your JGS rank", "Your
 *   GPA", "Your SAT") so "You" never appears without context.
 * @param {string} [opts.tier="target"]
 * @param {"sm"|"md"} [opts.size="md"]
 */
export function statVersus({
  label,
  yourLabel = "You",
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
        <span class="stat-versus-label">${yourLabel}</span>
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
    yourLabel: "Your JGS rank",
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
    yourLabel: "Your GPA",
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
    yourLabel: "Your SAT",
    yourDisplay: commas(yourSat),
    theirDisplay: commas(schoolSat),
    direction, phrase, tier, size,
  });
}

/** Empty-state block. Better than rendering nothing and looking broken. */
export const empty = (message) => html`<div class="empty">${message}</div>`;

/** "2026-09-26" -> "Sep 2026". Parsed by hand so no timezone can shift it. */
const monthYear = (iso) => {
  const [y, m] = String(iso).split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : String(iso);
};

/** Digits only, so "(405) 269-6293" dials as tel:4052696293. Extensions drop. */
const telHref = (phone) => "tel:" + String(phone).split(/ext/i)[0].replace(/[^\d+]/g, "");

/**
 * The head coach's name and contact details, shown in place rather than
 * behind a link. `coach` comes from headCoachFor(); null renders an honest
 * "not on file" line instead of an empty box.
 *
 * Email and phone are mailto:/tel: so a tap opens the golfer's own mail or
 * phone app -- the details stay readable on the card either way.
 *
 * @param {Object|null} coach
 * @param {"prominent"|"subtle"} style
 */
export function coachCard(coach, style = "prominent") {
  if (!coach) {
    return html`
      <div class="coach-card coach-card-${style}">
        <div class="coach-card-body">
          <span class="coach-card-eyebrow">Head coach</span>
          <span class="muted">Contact not on file yet.</span>
        </div>
      </div>
    `;
  }
  const email = coach.email
    ? html`<a href="mailto:${coach.email}">${coach.email}</a>`
    : html`<span class="muted">Email not published</span>`;
  const phone = coach.phone
    ? html`<a href="${telHref(coach.phone)}">${coach.phone}</a>`
    : html`<span class="muted">Phone not published</span>`;
  return html`
    <div class="coach-card coach-card-${style}">
      ${raw(coachPhoto(coach))}
      <div class="coach-card-body">
        <span class="coach-card-eyebrow">Head coach</span>
        <b class="coach-card-name">${coach.name}</b>
        <span class="coach-card-title muted">${coach.title}</span>
        <span class="coach-card-contact">${raw(email)}${raw(phone)}</span>
        <span class="coach-card-verified">Verified ${monthYear(COACHES_VERIFIED)}</span>
      </div>
    </div>
  `;
}

/**
 * The coach's headshot, layered OVER their initials -- the same trick as
 * schoolLogo(): the initials always render, the photo covers them, and a
 * photo that fails removes itself so the initials show through. `onerror` is
 * a fixed string with no interpolation; the URL is escaped by html``.
 *
 * The alt text is empty on purpose: the name is printed right beside it, so
 * a screen reader announcing it twice would be noise.
 */
const coachPhoto = (coach) => html`
  <span class="coach-photo" aria-hidden="true">
    <span class="coach-photo-initials">${initials(coach.name)}</span>
    ${raw(
      coach.photo
        ? html`<img src="${coach.photo}" alt="" loading="lazy"
                 referrerpolicy="no-referrer" onerror="this.remove()" />`
        : ""
    )}
  </span>
`;
