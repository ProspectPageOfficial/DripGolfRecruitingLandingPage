/**
 * views/landing.js — the signed-out front door.
 * Short copy, big type. Says what it is, shows the price, then gets out
 * of the way.
 */
import { html, raw } from "../lib/dom.js";
import { sitePreview } from "../lib/thumbs.js";
import { colleges } from "../data/colleges.js";
import { PUBLIC_SITE } from "../config.js";

/**
 * Each step is a screenshot of this app run for "Ava Reed", a made-up golfer
 * entered through the sign-up demo (#/signup -> #/welcome). Never a real
 * player: these images are public, and real juniors are minors. Re-shoot
 * them when the UI changes; they will not update on their own.
 */
const STEPS = [
  {
    title: "Build your page",
    body: "Bio, results and swing video. One link.",
    img: "assets/example-page.webp",
    alt: "Example recruiting page preview for a sample golfer: hometown, age, height, class year, school and GPA",
  },
  {
    title: "See your fit",
    body: `${colleges.length.toLocaleString()} NCAA programs, scored 0–100.`,
    img: "assets/example-fit.webp",
    alt: "Example College Best Fit result: a score of 88, Likely, comparing the golfer's rank, GPA and SAT with the program's averages",
  },
  {
    title: "Send it to coaches",
    body: "Pick your targets. Send each coach one link.",
    img: "assets/example-share.webp",
    alt: "Example list of Likely-fit college programs, each with its fit score, conference and roster rank",
  },
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
        <div class="hero-grid">
          <div>
            <span class="eyebrow">Drip Golf Recruiting</span>
            <h1 class="serif">Your College Recruiting is <em class="accent">One Link</em> Away</h1>
          </div>
          <!-- The whole card is the link, to the example golfer's dashboard
               (#/example signs into the demo account). The preview is the
               same live, scaled frame the dashboard itself shows
               (pointer-events: none), so clicks fall through to the <a>. -->
          <a class="live-example" href="#/example">
            ${raw(sitePreview(PUBLIC_SITE))}
            <span class="btn btn-lg btn-block">See a live example &rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <ol class="steps">
          ${raw(STEPS.map((step, i) => html`
            <li>
              <span class="step-num serif">0${i + 1}</span>
              <h3 class="serif">${step.title}</h3>
              <p>${step.body}</p>
              <img class="step-img" src="${step.img}" alt="${step.alt}" loading="lazy" width="1200" height="750" />
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
  `;
}
