/**
 * views/landing.js — the signed-out front door.
 * Short copy, big type, one product preview. Says what it is, shows the
 * price, then gets out of the way.
 */
import { html, raw } from "../lib/dom.js";
import { dial, tierPill } from "../lib/components.js";
import { colleges } from "../data/colleges.js";

const FEATURES = [
  { icon: "⚑", title: "One link", body: "Your whole recruiting story on one page coaches actually open." },
  { icon: "◎", title: "Best Fit", body: "Every NCAA program scored 0–100. Likely, Target, Reach." },
  { icon: "↻", title: "Always current", body: "Post a result once. Page and fit scores update together." },
];

/**
 * The plans. Data, not markup: adding a tier is a few lines in this array,
 * not a copy-pasted <article> that drifts from its sibling.
 *
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

const tierCard = (t) => html`
  <article class="plan${t.featured ? " plan-featured" : ""}">
    ${raw(t.badge ? html`<span class="plan-badge">${t.badge}</span>` : "")}
    <div class="plan-name">${t.name}</div>
    <div class="plan-price serif">
      ${raw(t.was ? html`<s>${t.was}</s>` : "")}${t.price}<small>${` ${t.cadence}`}</small>
    </div>
    <div class="plan-upfront">${t.upfront ?? " "}</div>
    <ul>${raw(PERKS.map((p) => html`<li>${p}</li>`).join(""))}</ul>
    <a class="btn btn-lg btn-block ${t.featured ? "btn-sage" : ""}" href="#/signup">${t.cta} &rarr;</a>
  </article>
`;

/** Illustrative only -- the hero's product preview, not anyone's real scores. */
const PREVIEW = [
  { school: "Program A", score: 86, tier: "likely" },
  { school: "Program B", score: 67, tier: "target" },
  { school: "Program C", score: 41, tier: "reach" },
];

const heroPreview = () => html`
  <div class="hero-preview" aria-hidden="true">
    <div class="hp-head">
      <span class="eyebrow">College Best Fit</span>
      <span class="hp-live">&bull; Live</span>
    </div>
    <div class="hp-top">
      ${raw(dial(86, "likely", 120))}
      <div>
        <div class="hp-label">Top fit</div>
        <div class="hp-school serif">Program A</div>
        ${raw(tierPill("likely"))}
      </div>
    </div>
    <ul class="hp-list">
      ${raw(PREVIEW.map((p) => html`
        <li>
          <span>${p.school}</span>
          <i class="hp-bar"><b class="hp-${p.tier}" style="width:${p.score}%"></b></i>
          <strong>${p.score}</strong>
        </li>`).join(""))}
    </ul>
  </div>
`;

export function landing() {
  return html`
    <section class="hero">
      <div class="container hero-split">
      <div>
        <span class="eyebrow">Drip Golf Recruiting</span>
        <h1 class="serif">Get seen.<br />Get <em class="accent">recruited.</em></h1>
        <p class="lede">One page for your game. A fit score for every college program.</p>
        <div class="hero-actions row">
          <a class="btn btn-lg" href="#/signup">Build my page &rarr;</a>
          <a class="btn btn-lg btn-ghost" href="#/login">Sign in</a>
        </div>
      </div>
      ${raw(heroPreview())}
      </div>
    </section>

    <section class="band-ink">
      <div class="container stat-strip">
        <div><b class="serif">${colleges.length.toLocaleString()}</b><span>Programs scored</span></div>
        <div><b class="serif">D1&ndash;D3</b><span>Full NCAA coverage</span></div>
        <div><b class="serif">1</b><span>Link for every coach</span></div>
        <div><b class="serif">0</b><span>Guesswork</span></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
      <h2 class="section-title serif">Everything you need. <em class="accent">Nothing you don&rsquo;t.</em></h2>
      <div class="grid grid-3">
        ${raw(FEATURES.map((f) => html`
          <article class="feature">
            <span class="feature-icon">${f.icon}</span>
            <h3 class="serif">${f.title}</h3>
            <p>${f.body}</p>
          </article>`).join(""))}
      </div>
      </div>
    </section>

    <!-- Deliberately no id="pricing" and no nav link to it. Routing here is
         hash-based, so <a href="#pricing"> would set location.hash, wake the
         router, match no route and render "That page does not exist." -->
    <section class="section section-cream2">
      <div class="container">
        <div class="center">
          <span class="eyebrow">Pricing</span>
          <h2 class="section-title serif">Members pay <em class="accent">half.</em></h2>
        </div>
        <div class="plans">${raw(TIERS.map(tierCard).join(""))}</div>
      </div>
    </section>

    <section class="container">
      <div class="cta-band">
        <h2 class="serif">Your next coach is one link away.</h2>
        <a class="btn btn-lg btn-cream" href="#/signup">Get started &rarr;</a>
      </div>
    </section>
  `;
}
