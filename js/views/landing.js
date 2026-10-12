/**
 * views/landing.js — the signed-out front door.
 * Short copy, big type, and a golf scorecard instead of a dashboard
 * screenshot. Says what it is, shows the price, then gets out of the way.
 */
import { html, raw } from "../lib/dom.js";
import { colleges } from "../data/colleges.js";
import { tierFor } from "../lib/fit.js";

/**
 * Illustrative only -- the hero scorecard, not anyone's real scores.
 * Marked the way a scorecard marks holes: circle = Likely, square = Reach.
 */
const CARD = [91, 84, 72, 63, 48, 37];

const scorecard = () => html`
  <div class="scorecard" aria-hidden="true">
    <table>
      <tr class="sc-head"><th>Program</th>${raw(CARD.map((_, i) => html`<td>${String.fromCharCode(65 + i)}</td>`).join(""))}</tr>
      <tr><th>Fit</th>${raw(CARD.map((s) => html`<td><span class="mark mark-${tierFor(s)}">${s}</span></td>`).join(""))}</tr>
    </table>
    <div class="sc-legend">
      <span><i class="mark mark-likely"></i>Likely</span>
      <span><i class="mark mark-target"></i>Target</span>
      <span><i class="mark mark-reach"></i>Reach</span>
    </div>
  </div>
`;

const STEPS = [
  ["Build your page", "Bio, results and swing video. One link."],
  ["See your fit", `${colleges.length.toLocaleString()} NCAA programs, scored 0–100.`],
  ["Send it to coaches", "Post a result once. Everything updates."],
];

/**
 * The plans. Data, not markup: adding a tier is a few lines in this array.
 * `cta` points at #/signup because there is no checkout yet -- when Stripe
 * lands, this field is the one place that changes.
 */
const TIERS = [
  {
    name: "Non-Members",
    price: "$50",
    cadence: "/ month",
    upfront: "+ $299 one-time setup",
    featured: false,
    cta: "Get started",
  },
  {
    name: "Drip Golf Premium Members",
    price: "$25",
    cadence: "/ month",
    was: "$50",
    badge: "50% off monthly",
    upfront: "Save $25 every month",
    featured: true,
    cta: "Claim member pricing",
  },
];

const PERKS = [
  "Personal recruiting page",
  "College Best Fit scores",
  "Tournament & stat history",
  "Live preview for coaches",
];

const ticketHalf = (t) => html`
  <div class="ticket-half${t.featured ? " ticket-featured" : ""}">
    ${raw(t.badge ? html`<span class="plan-badge">${t.badge}</span>` : "")}
    <div class="plan-name">${t.name}</div>
    <div class="plan-price serif">
      ${raw(t.was ? html`<s>${t.was}</s>` : "")}${t.price}<small>${` ${t.cadence}`}</small>
    </div>
    <div class="plan-upfront">${t.upfront}</div>
    <a class="btn btn-lg btn-block ${t.featured ? "btn-cream" : ""}" href="#/signup">${t.cta} &rarr;</a>
  </div>
`;

export function landing() {
  return html`
    <section class="hero">
      <div class="container">
        <span class="eyebrow">Drip Golf Recruiting</span>
        <h1 class="serif">Your game,<br /><em class="accent">on the record.</em></h1>
        <div class="hero-foot">
          <p class="lede">One page for coaches. A fit score for every college program.</p>
          <div class="row hero-actions">
            <a class="btn btn-lg" href="#/signup">Build my page &rarr;</a>
            <a class="btn btn-lg btn-ghost" href="#/login">Sign in</a>
          </div>
        </div>
        ${raw(scorecard())}
      </div>
    </section>

    <section class="section">
      <div class="container">
        <ol class="steps">
          ${raw(STEPS.map(([title, body], i) => html`
            <li>
              <span class="step-num serif">0${i + 1}</span>
              <h3 class="serif">${title}</h3>
              <p>${body}</p>
            </li>`).join(""))}
        </ol>
      </div>
    </section>

    <!-- Deliberately no id="pricing" and no nav link to it. Routing here is
         hash-based, so <a href="#pricing"> would set location.hash, wake the
         router, match no route and render "That page does not exist." -->
    <section class="section section-green">
      <div class="container">
        <span class="eyebrow">Pricing</span>
        <h2 class="section-title serif">Members pay <em>half.</em></h2>
        <div class="ticket">
          ${raw(TIERS.map(ticketHalf).join(""))}
        </div>
        <ul class="ticket-perks">
          <li class="ticket-perks-lead">Both plans include</li>
          ${raw(PERKS.map((p) => html`<li>${p}</li>`).join(""))}
        </ul>
      </div>
    </section>

    <section class="container closer">
      <h2 class="serif">Your next coach is <em class="accent">one link</em> away.</h2>
      <a class="btn btn-lg" href="#/signup">Get started &rarr;</a>
    </section>
  `;
}
