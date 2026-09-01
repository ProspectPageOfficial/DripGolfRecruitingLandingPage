/**
 * views/landing.js — the signed-out front door.
 * Explains the two things the account unlocks, then gets out of the way.
 */
import { html, raw, extLink } from "../lib/dom.js";
import { colleges } from "../data/colleges.js";
import { PUBLIC_SITE } from "../config.js";

const FEATURES = [
  {
    num: "01",
    title: "One recruiting page",
    body:
      `Bio, season history, tournament results and swing video, already live ` +
      `at ${PUBLIC_SITE.host}. Send coaches one link instead of a ` +
      `nine-attachment email.`,
  },
  {
    num: "02",
    title: "College Best Fit",
    body:
      "Score yourself against every program in the database on scoring average, " +
      "national rank, GPA and test scores. Sorted into Likely, Target and Reach " +
      "so you stop guessing.",
  },
  {
    num: "03",
    title: "Update it once",
    body:
      "Change your scoring average in one place. Your public page and your fit " +
      "scores both move. No spreadsheet, no re-uploading a PDF every fortnight.",
  },
];

/**
 * The plans, lifted from the marketing page this app replaced.
 *
 * Data, not markup, for the same reason FEATURES is: adding a tier should be
 * four lines in an array, not a copy-pasted <article> that drifts out of sync
 * with its siblings the first time the button style changes.
 *
 * `cta` points at #/login because that is the only real action this app has.
 * There is no checkout yet -- when Stripe lands, this field is the one place
 * that changes, and nothing else in this file needs to know.
 */
const TIERS = [
  {
    name: "Prospect",
    price: "$19",
    cadence: "/ month",
    popular: true,
    cta: "Get Prospect",
    perks: [
      "Beautiful profile page",
      "Tournament log",
      "Unlimited swing vault",
      "PDF recruit resume",
      "Custom colors & theme",
      "Viewer analytics",
      "Drip Golf Recruiting subdomain",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/ month",
    popular: false,
    cta: "Go Pro",
    perks: [
      "Everything in Prospect",
      "Your own domain",
      "Sponsor media kit",
      "Priority support",
      "Featured on the Roster",
    ],
  },
];

const tierCard = (t) => html`
  <article class="card tier${t.popular ? " popular" : ""}">
    <div class="name serif">${t.name}</div>
    <div class="price serif">${t.price}<small>${` ${t.cadence}`}</small></div>
    <ul>
      ${raw(t.perks.map((p) => html`<li>${p}</li>`).join(""))}
    </ul>
    <a class="btn btn-block ${t.popular ? "btn-cream" : "btn-ghost"}" href="#/login">${t.cta}</a>
  </article>
`;

export function landing() {
  return html`
    <div class="container">
      <section class="hero">
        <span class="eyebrow">A home for the next generation of golf</span>
        <h1 class="serif">
          Your recruiting,<br />finally in one place.
        </h1>
        <p class="lede">
          One page for a junior golfer's whole recruiting story. Keep the season
          current, and find out which college programs actually fit &mdash;
          backed by numbers instead of vibes.
        </p>
        <div class="hero-actions row">
          ${raw(extLink(PUBLIC_SITE.url, "See the page", "btn"))}
          <a class="btn btn-ghost" href="#/login">Sign in to edit</a>
        </div>
      </section>

      <section class="section-tight">
        <div class="grid grid-3">
          ${raw(
            FEATURES.map(
              (f) => html`
                <article class="card feature-card">
                  <span class="num serif">${f.num}</span>
                  <h3>${f.title}</h3>
                  <p>${f.body}</p>
                </article>
              `
            ).join("")
          )}
        </div>
      </section>

      <section class="section-tight">
        <div class="card">
          <span class="eyebrow">The Fit Score</span>
          <h2 class="serif" style="font-size:1.9rem;margin:.6rem 0 .4rem">
            One number. The full picture.
          </h2>
          <p class="muted" style="max-width:62ch;font-size:.92rem">
            Every program is scored on two dimensions &mdash; can you compete on
            that roster, and do your grades clear the door. Both halves are shown,
            never hidden behind a single mystery number.
          </p>
          <div class="grid grid-4" style="margin-top:1.4rem">
            <div class="stat"><div class="val">${colleges.length}</div><div class="lbl">Programs scored</div></div>
            <div class="stat"><div class="val">4</div><div class="lbl">Inputs weighted</div></div>
            <div class="stat"><div class="val">3</div><div class="lbl">Fit tiers</div></div>
            <div class="stat"><div class="val">D1&ndash;NAIA</div><div class="lbl">Coverage</div></div>
          </div>
        </div>
      </section>

      <!-- Deliberately no id="pricing" and no nav link to it. Routing here is
           hash-based, so <a href="#pricing"> would set location.hash, wake the
           router, match no route and render "That page does not exist." An
           anchor and a route cannot share the fragment; the router won. -->
      <section class="section-tight">
        <div class="center">
          <span class="eyebrow">Pricing</span>
          <h2 class="serif" style="font-size:1.9rem;margin:.6rem 0 .4rem">
            Simple plans. <em>Fair prices.</em>
          </h2>
          <p class="muted" style="font-size:.92rem">
            Choose the plan that fits your journey. Cancel anytime.
          </p>
        </div>
        <div class="grid grid-2" style="margin-top:1.8rem">
          ${raw(TIERS.map(tierCard).join(""))}
        </div>
      </section>
    </div>
  `;
}
