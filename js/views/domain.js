/**
 * views/domain.js — the sign-up demo's "your own web address" flow.
 *
 * DEMO ONLY. Three things here stand in for real services:
 *
 *   isTaken()        -> a registrar's availability API (Porkbun, Namecheap...)
 *   the checkout     -> Stripe Checkout, hosted by Stripe. This page never asks
 *                       for a card, in the demo or in the real build.
 *   setupTracker()   -> the webhook chain that runs AFTER payment clears:
 *                       Stripe "payment succeeded" -> buy the domain from the
 *                       prepaid registrar balance -> add it to the Netlify
 *                       site -> Netlify issues HTTPS -> email the family.
 *
 * The order matters and is the point of the demo: the domain is chosen in the
 * survey but only BOUGHT after payment, so a family that quits at checkout
 * costs nothing. The free dripgolfrecruiting.com/<slug> address goes live
 * first, so there is always something to send a coach while the domain sets
 * up.
 *
 * Domains are printed, never linked: "avareed.com" may be a real site that
 * belongs to somebody else.
 */
import { html, raw } from "../lib/dom.js";

export const FREE_HOST = "dripgolfrecruiting.com";

/** Placeholder registrar price. Real numbers come back from the registrar API. */
export const DOMAIN_PRICE = 11.08;

/** Monthly / setup prices per plan. Mirrors the TIERS cards on the landing page. */
export const PLANS = Object.freeze({
  nonMember: { label: "Non-member", monthly: 50, setup: 299 },
  member: { label: "Drip Golf Premium member", monthly: 25, setup: 0, setupWas: 299 },
});

/** "Ava", "Reed" -> "avareed". Letters and digits only; a domain cannot hold "'". */
const squash = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** "Ava", "Reed" -> "ava-reed", the free address path. */
export const freeSlug = (first, last) =>
  [first, last].map(squash).filter(Boolean).join("-") || "your-name";

/** Typed text -> a domain: trimmed, lowercased, ".com" added when there is no dot. */
export function normalizeDomain(input) {
  const d = String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!d) return "";
  return d.includes(".") ? d : `${d}.com`;
}

export const isValidDomain = (d) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{2,})+$/.test(d);

/**
 * Pretend registrar lookup. Deterministic, so the same name gives the same
 * answer every time you demo it, and roughly one exact-name .com in three
 * comes back taken -- often enough that the suggestions get shown off.
 */
const ALWAYS_TAKEN = new Set(["johnsmith.com", "mikejohnson.com", "chrisbrown.com", "golf.com"]);
export function isTaken(domain) {
  if (ALWAYS_TAKEN.has(domain)) return true;
  let h = 0;
  for (const c of domain) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 3 === 0;
}

/** Alternatives offered under the box, best first, already-taken ones dropped. */
export function suggestDomains(first, last, classYear) {
  const f = squash(first);
  const l = squash(last);
  if (!f && !l) return [];
  const year = String(classYear || "").match(/\d{4}/)?.[0];
  const base = `${f}${l}`;
  return [...new Set([
    `${base}.com`,
    `${base}golf.com`,
    year && `${base}${year}.com`,
    f && l && `${f[0]}${l}golf.com`,
    `${base}golfer.com`,
    // .com only: endings like .golf cost several times more a year, which
    // would break "included with your plan".
  ].filter(Boolean))].filter((d) => !isTaken(d)).slice(0, 4);
}

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

// ---------------------------------------------------------------------------
// Survey step: choose your web address
// ---------------------------------------------------------------------------

export const domainStep = () => html`
  <div class="dom-pick stack-sm">
    <div class="field">
      <label for="su-domain">Your web address <span aria-hidden="true">*</span></label>
      <input id="su-domain" name="domain" type="text" autocomplete="off" spellcheck="false"
             placeholder="avareed.com" required />
      <p class="dom-status" id="su-dom-status" aria-live="polite"></p>
    </div>
    <div>
      <span class="field-hint">Suggestions</span>
      <ul class="dom-suggest" id="su-dom-suggest"></ul>
    </div>
    <label class="dom-own">
      <input type="checkbox" name="ownDomain" id="su-own" />
      I already own this domain &mdash; just connect it
    </label>
    <p class="dom-free">
      While your domain sets up, your page is live right away at
      <b id="su-dom-free">${FREE_HOST}/your-name</b>
    </p>
  </div>
`;

/** Wire the address step. `form` is the survey form; values are read live from it. */
export function bindDomainStep(form) {
  const input = form.elements.domain;
  const own = form.elements.ownDomain;
  const status = form.querySelector("#su-dom-status");
  const list = form.querySelector("#su-dom-suggest");
  const free = form.querySelector("#su-dom-free");
  if (!input) return { onShow() {} };
  let timer;

  const check = () => {
    clearTimeout(timer);
    const d = normalizeDomain(input.value);
    status.className = "dom-status";
    if (!d) return (status.textContent = "");
    if (!isValidDomain(d)) {
      status.classList.add("is-bad");
      return (status.textContent = "That doesn't look like a web address yet.");
    }
    if (own.checked) {
      status.classList.add("is-ok");
      return (status.textContent = `We'll connect ${d}. You'll get one setting to change where you bought it.`);
    }
    status.classList.add("is-loading");
    status.textContent = `Checking ${d}...`;
    // The lookup is instant; the pause is there so the demo reads like a real network call.
    timer = setTimeout(() => {
      status.className = "dom-status";
      if (isTaken(d)) {
        status.classList.add("is-bad");
        status.textContent = `${d} is taken. Pick one of the suggestions below.`;
      } else {
        status.classList.add("is-ok");
        status.textContent = `${d} is available. Included with your plan.`;
      }
    }, 450);
  };

  const paintSuggestions = () => {
    const first = form.elements.firstName.value;
    const last = form.elements.lastName.value;
    const picks = suggestDomains(first, last, form.elements.classYear.value);
    list.innerHTML = picks.map((d) => html`
      <li><button type="button" class="dom-chip" data-domain="${d}">
        <span>${d}</span><small>Available</small>
      </button></li>`).join("");
    free.textContent = `${FREE_HOST}/${freeSlug(first, last)}`;
    return picks;
  };

  input.addEventListener("input", check);
  own.addEventListener("change", check);
  list.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-domain]");
    if (!chip) return;
    input.value = chip.dataset.domain;
    own.checked = false;
    check();
  });

  return {
    /** Called when the step is shown: names may have changed since last time. */
    onShow() {
      paintSuggestions();
      if (!input.value) {
        // Start on the exact name even when it is taken -- seeing "taken" and
        // picking a suggestion is the part of the flow worth demoing.
        const exact = `${squash(form.elements.firstName.value)}${squash(form.elements.lastName.value)}.com`;
        if (exact !== ".com") input.value = exact;
      }
      check();
    },
    /** Blocking problem with the current choice, as a sentence, or null. */
    problem() {
      const d = normalizeDomain(input.value);
      if (!d) return "Choose a web address, or pick a suggestion.";
      if (!isValidDomain(d)) return "That doesn't look like a web address yet.";
      if (!own.checked && isTaken(d)) return `${d} is taken. Pick one of the suggestions.`;
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Survey step: review and pay (demo checkout)
// ---------------------------------------------------------------------------

export const checkoutStep = () => html`
  <div class="stack-sm">
    <div class="dom-plans" role="radiogroup" aria-label="Plan">
      ${raw(Object.entries(PLANS).map(([key, p]) => html`
        <label class="dom-plan">
          <input type="radio" name="plan" value="${key}" ${raw(key === "member" ? "checked" : "")} />
          <span><b>${p.label}</b>
            <small>${money(p.monthly)}/month &middot; ${p.setup ? `${money(p.setup)} setup` : "setup fee waived"}</small>
          </span>
        </label>`).join(""))}
    </div>
    <div class="dom-receipt" id="su-receipt"></div>
    <p class="field-hint">
      <b>Demo checkout.</b> The real build sends you to Stripe's secure payment
      page here. This demo asks for no card and charges nothing.
    </p>
  </div>
`;

/** Line items for a plan + domain choice. Shared by the receipt and the tracker. */
export function orderFor(planKey, domain, ownDomain) {
  const plan = PLANS[planKey] || PLANS.nonMember;
  const lines = [
    [`${plan.label} plan, first month`, money(plan.monthly)],
    [plan.setup ? "One-time setup" : "One-time setup (waived for members)", plan.setup ? money(plan.setup) : raw(html`<s>${money(plan.setupWas)}</s> $0`)],
    [ownDomain ? `Connect ${domain}` : `${domain}, first year`, "Included"],
  ];
  return { plan, lines, total: plan.monthly + plan.setup };
}

export function bindCheckoutStep(form) {
  const receipt = form.querySelector("#su-receipt");
  const paint = () => {
    const d = normalizeDomain(form.elements.domain.value) || "your domain";
    const { lines, total } = orderFor(form.elements.plan.value, d, form.elements.ownDomain.checked);
    receipt.innerHTML = html`
      <dl>${raw(lines.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`).join(""))}</dl>
      <div class="dom-total"><span>Due today</span><b>${money(total)}</b></div>`;
  };
  form.querySelectorAll("input[name='plan']").forEach((r) => r.addEventListener("change", paint));
  return { onShow: paint, payLabel: () => `Pay ${money(orderFor(form.elements.plan.value).total)} & create account` };
}

// ---------------------------------------------------------------------------
// After payment: what the server would be doing, shown as a live checklist
// ---------------------------------------------------------------------------

/**
 * The mock dashboard's setup tracker. Each row ticks over on a CSS delay, so it
 * plays out like the real webhook chain without any timers to clean up.
 */
export function setupTracker(a) {
  const domain = normalizeDomain(a.domain) || "your domain";
  const own = !!a.ownDomain;
  const free = `${FREE_HOST}/${freeSlug(a.firstName, a.lastName)}`;
  const { total } = orderFor(a.plan, domain, own);

  const steps = [
    ["Payment received", `${money(total)} through Stripe`],
    ["Free address live", free],
    own
      ? ["Waiting for your domain settings", `Where you bought ${domain}, point it at Drip Golf. We'll email the exact setting.`, "waiting"]
      : ["Domain bought", `${domain}, registered for one year from Drip Golf's prepaid balance (${money(DOMAIN_PRICE)})`],
    ["Connected to your page", `${domain} now opens your recruiting page`, own && "waiting"],
    ["Secure connection (HTTPS) ready", "Certificate issued automatically", own && "waiting"],
    ["Live", `Email sent: "Your page is now live at ${domain}"`, own && "waiting"],
  ];

  return html`
    <div class="card dom-track">
      <div class="row row-between">
        <span class="eyebrow">Your web address</span>
        <b class="dom-track-domain">${domain}</b>
      </div>
      <ol class="dom-steps">
        ${raw(steps.map(([title, detail, waiting], i) => html`
          <li class="${waiting ? "is-waiting" : ""}" style="--d:${0.4 + i * 1.1}s">
            <span class="dom-dot" aria-hidden="true"></span>
            <span class="dom-step-text">
              <b>${title}</b>
              <small>${detail}</small>
            </span>
            <span class="dom-step-state">
              <span class="when-pending">${waiting ? "Waiting" : "Working..."}</span>
              <span class="when-done">Done</span>
            </span>
          </li>`).join(""))}
      </ol>
      <p class="field-hint">
        Demo: nothing was bought or charged. In the real build each step is
        your server reacting to Stripe and the domain registrar, usually within
        a few minutes.
      </p>
    </div>
  `;
}
