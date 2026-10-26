/**
 * views/signup.js — the "Create account" survey and the mock dashboard it opens.
 *
 * A DEMO of what onboarding a second golfer looks like. It asks every question
 * the Personal Bio section of a golfer's page answers (lukethomasselzer.com is
 * the reference) plus the two golf numbers the fit engine runs on, one short
 * step at a time, then drops the new golfer onto a dashboard built from their
 * answers -- the same dashboard and Best Fit views Luke gets.
 *
 * No account is created. The auth adapter still has exactly one account (see
 * auth/store.js) and this file never calls it. The answers live in
 * sessionStorage for the tab, minus the password, so a refresh keeps the
 * preview and closing the tab throws it away. When the real multi-golfer build
 * lands, the finish step becomes `auth.signUp()` plus an insert into the
 * `golfer` table, and the survey itself does not change.
 */
import { html, raw, formData, initials, extLink } from "../lib/dom.js";
import { sitePreview } from "../lib/thumbs.js";
import { normalizeLive } from "../data/live.js";
import { loadRoster, loadProfile, matchPlayers, isGirlsDivision } from "../data/dripgolf.js";
import { domainStep, bindDomainStep, checkoutStep, bindCheckoutStep, setupTracker } from "./domain.js";

export const MOCK_KEY = "dg.demo.signup";

/**
 * The survey, as data. Adding a question is one entry, not a template edit.
 *   required: must be filled before Next works
 *   wide:     spans both columns of the step grid
 */
const STEPS = [
  {
    key: "account",
    title: "Create your account",
    blurb: "Accounts are for parents and guardians. You will use this to sign in, edit your golfer's page and see fit scores.",
    fields: [
      { name: "email", label: "Email", type: "email", required: true, wide: true,
        placeholder: "you@example.com", autocomplete: "email" },
      { name: "password", label: "Password", type: "password", required: true, wide: true,
        placeholder: "At least 8 characters", autocomplete: "new-password", minLength: 8 },
      // Children's privacy rests on this: the account holder is an adult
      // responsible for the golfer, never the child (see views/legal.js).
      { name: "guardian", type: "consent", required: true, wide: true,
        label: "I am 18 or older and the parent or legal guardian of the golfer, and I agree to the Terms of Service and Privacy Policy." },
    ],
  },
  {
    key: "about",
    title: "About the player",
    blurb: "The basics a coach sees first. Play on the Drip Golf Tour? Start typing your name and pick yourself to fill in what the tour already has.",
    note: "Not in Drip Golf's database? That's OK. Fill these in yourself and create your account as normal.",
    fields: [
      { name: "firstName", label: "First name", required: true,
        placeholder: "Ava", autocomplete: "given-name" },
      { name: "lastName", label: "Last name", required: true,
        placeholder: "Reed", autocomplete: "family-name" },
      { name: "hometown", label: "Hometown", placeholder: "Charlotte, NC" },
      { name: "age", label: "Age", type: "number", placeholder: "13" },
      { name: "height", label: "Height", placeholder: "5'4\"" },
      { name: "weight", label: "Weight", placeholder: "120 lbs" },
    ],
  },
  {
    key: "contact",
    title: "Contact details",
    blurb: "Where a coach can reach you.",
    fields: [
      { name: "address", label: "Home address", wide: true, placeholder: "123 Fairway Dr, Charlotte, NC", autocomplete: "street-address" },
      { name: "phone", label: "Phone", type: "tel", wide: true, placeholder: "(555) 555-0123", autocomplete: "tel" },
    ],
  },
  {
    key: "school",
    title: "School & academics",
    blurb: "GPA and test scores are optional. Add them and Academic Fit switches on.",
    fields: [
      { name: "classYear", label: "Class year", type: "select", required: true,
        options: ["2027", "2028", "2029", "2030", "2031", "2032", "2033"].map((y) => `Class of ${y}`) },
      { name: "school", label: "Currently attending", placeholder: "Your high school" },
      { name: "gpa", label: "GPA", placeholder: "3.8" },
      { name: "sat", label: "SAT / ACT", placeholder: "1400 or 31" },
    ],
  },
  {
    key: "golf",
    title: "Your golf",
    blurb: "Your JGS national rank is what College Best Fit scores you on.",
    fields: [
      { name: "gender", label: "Team", type: "select", required: true,
        options: [["men", "Men's golf"], ["women", "Women's golf"]] },
      { name: "nationalRank", label: "JGS national rank", type: "number", required: true,
        placeholder: "10557", hint: "From your Junior Golf Scoreboard profile." },
      { name: "scoringAvg", label: "Scoring average", type: "number", placeholder: "81.1" },
    ],
  },
  {
    key: "story",
    title: "Your story",
    blurb: "Your elevator speech: character, accomplishments, goals, work ethic and interests beyond your scores.",
    fields: [
      { name: "bio", label: "Player bio", type: "textarea", wide: true,
        placeholder: "Tell coaches who you are..." },
    ],
  },
  {
    key: "social",
    title: "Social links",
    blurb: "All optional. Only the ones you fill in appear on your page.",
    fields: [
      { name: "instagram", label: "Instagram", placeholder: "@handle" },
      { name: "twitter", label: "X / Twitter", placeholder: "@handle" },
      { name: "tiktok", label: "TikTok", placeholder: "@handle" },
      { name: "youtube", label: "YouTube", placeholder: "Channel link" },
      { name: "facebook", label: "Facebook", placeholder: "Profile link" },
      { name: "linkedin", label: "LinkedIn", placeholder: "Profile link" },
      { name: "website", label: "Website", type: "url", wide: true, placeholder: "https://" },
    ],
  },
  // Custom steps render their own markup (views/domain.js) instead of a field grid.
  {
    key: "domain",
    title: "Choose your web address",
    blurb: "Your own .com that opens your recruiting page. It is included with your plan.",
    fields: [],
    custom: domainStep,
  },
  {
    key: "checkout",
    title: "Review & pay",
    blurb: "Pick your plan. Your domain is only bought once payment goes through.",
    fields: [],
    custom: checkoutStep,
  },
];

const PAGE_ROWS = [
  ["Hometown", "hometown"], ["Home address", "address"], ["Phone", "phone"],
  ["Age", "age"], ["Height", "height"], ["Weight", "weight"],
  ["Class year", "classYear"], ["Currently attending", "school"],
  ["GPA", "gpa"], ["SAT / ACT", "sat"],
];

const SOCIALS = STEPS.find((s) => s.key === "social").fields;

/** html`` escapes nested strings, so fragments built with it go back in via raw(). */
const each = (items, fn) => raw(items.map(fn).join(""));

function field(f) {
  const id = `su-${f.name}`;
  const common = html`id="${id}" name="${f.name}" ${raw(f.required ? "required" : "")}`;
  let control;
  if (f.type === "consent") {
    return html`
      <div class="field survey-wide">
        <label class="consent-check" for="${id}">
          <input type="checkbox" id="${id}" name="${f.name}" required />
          <span>${f.label}
            <a href="#/terms" target="_blank" rel="noopener">Terms</a> &middot;
            <a href="#/privacy" target="_blank" rel="noopener">Privacy</a></span>
        </label>
      </div>`;
  }
  if (f.type === "select") {
    control = html`<select ${raw(common)}>
      <option value="">Choose...</option>
      ${each(f.options, (o) => {
        const [value, label] = Array.isArray(o) ? o : [o, o];
        return html`<option value="${value}">${label}</option>`;
      })}
    </select>`;
  } else if (f.type === "textarea") {
    control = html`<textarea ${raw(common)} placeholder="${f.placeholder || ""}"></textarea>`;
  } else {
    control = html`<input ${raw(common)} type="${f.type || "text"}"
      placeholder="${f.placeholder || ""}" autocomplete="${f.autocomplete || "off"}"
      ${raw(f.type === "number" ? 'step="any" min="0"' : "")}
      ${raw(f.minLength ? `minlength="${f.minLength}"` : "")} />`;
  }
  return html`
    <div class="field ${f.wide ? "survey-wide" : ""}">
      <label for="${id}">${f.label}${raw(f.required ? ' <span aria-hidden="true">*</span>' : "")}</label>
      ${raw(control)}
      ${f.hint ? raw(html`<span class="field-hint">${f.hint}</span>`) : ""}
      ${f.name === "firstName" ? raw(html`<ul class="drip-suggest" id="su-drip" role="listbox" hidden></ul>`) : ""}
    </div>`;
}

export function signupView() {
  return html`
    <div class="container auth-wrap">
      <div class="card survey-card stack">
        <div>
          <span class="eyebrow">New golfer</span>
          <h1 class="serif" style="margin-top:.5rem">Build your recruiting page.</h1>
        </div>

        <div class="survey-progress" aria-hidden="true"><span id="su-bar"></span></div>
        <p class="muted survey-count" id="su-count" aria-live="polite"></p>

        <div id="su-msg"></div>

        <form id="signup-form" class="stack" novalidate>
          ${each(STEPS, (s, i) => html`
            <fieldset class="survey-step stack-sm" data-step="${i}" data-key="${s.key}" ${raw(i ? "hidden" : "")}>
              <legend class="serif survey-title">${s.title}</legend>
              <p class="muted survey-blurb">${s.blurb}</p>
              ${s.note ? raw(html`<p class="field-hint survey-note">${s.note}</p>`) : ""}
              ${s.custom ? raw(s.custom()) : raw(html`<div class="survey-grid">${each(s.fields, field)}</div>`)}
              ${s.key === "about" ? raw(html`<p class="drip-filled" id="su-drip-note" aria-live="polite" hidden></p>`) : ""}
            </fieldset>`)}

          <div class="row row-between">
            <button class="btn btn-ghost" type="button" data-nav="back">Back</button>
            <button class="btn" type="submit" id="su-next">Next</button>
          </div>
        </form>

        <p class="auth-switch center">
          Already have an account? <a href="#/login">Sign in</a>.
        </p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// The mock golfer: survey answers in the shape the dashboard and fit engine read
// ---------------------------------------------------------------------------

/** Survey answers from this tab, or null if the survey has not been finished. */
export function loadAnswers() {
  try {
    return JSON.parse(sessionStorage.getItem(MOCK_KEY));
  } catch {
    return null;
  }
}

/**
 * Turn answers into a golfer. Identity fields go through the same
 * normalizeLive() the real site's /api/personal does, so free-form GPA and
 * SAT/ACT strings get parsed exactly the way Luke's would.
 */
export function mockGolfer(a) {
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? undefined : Number(v));
  return {
    id: "mock",
    gender: a.gender === "women" ? "women" : "men",
    nationalRank: num(a.nationalRank),
    scoringAvg: num(a.scoringAvg),
    ...normalizeLive({
      name: a.name, hometown: a.hometown, class_year: a.classYear, age: a.age,
      currently_attending: a.school, height: a.height, weight: a.weight, bio: a.bio,
      gpa: a.gpa, test_scores: a.sat,
    }),
  };
}

/**
 * The left half of the mock dashboard. Luke's shows a live frame of his real
 * site; a new golfer has no site yet, so this renders what theirs would say.
 */
/**
 * After a real sign-up the page exists, so show it: the same live, scaled
 * frame Luke's dashboard shows of his site, pointed at /<slug>. "Edit" goes
 * through Sign in, which lands the parent on the page in owner mode.
 */
export function livePagePanel(a, editHref = "#/login") {
  const site = {
    url: `/${a.liveSlug}`,
    previewUrl: `/${a.liveSlug}?role=visitor`,
    host: `dripgolfrecruiting.com/${a.liveSlug}`,
  };
  return html`
    <div class="card">
      <div class="row row-between">
        <span class="eyebrow">Your page &mdash; ${site.host}</span>
        <span class="pill pill-likely">Live</span>
      </div>

      ${raw(sitePreview(site))}

      <div class="row panel-foot">
        <a class="btn btn-sm" href="${site.url}" target="_blank" rel="noopener">Open my page</a>
        <a class="btn btn-sm btn-ghost" href="${editHref}">Edit my page</a>
      </div>
    </div>
  `;
}

export function mockPagePanel(a) {
  if (a.liveSlug) return livePagePanel(a);
  const socials = SOCIALS.filter((s) => a[s.name]);
  return html`
    <div class="card">
      <div class="row row-between">
        <span class="eyebrow">Your page &mdash; preview</span>
        <span class="pill pill-plain">Draft</span>
      </div>

      <div class="mock-page stack">
        <div class="row">
          <div class="survey-avatar">${initials(a.name)}</div>
          <div>
            <b class="serif mock-page-name">${a.name}</b>
            <span class="thumb-meta">${[a.classYear, a.hometown].filter(Boolean).join(" · ")}</span>
          </div>
        </div>

        <dl class="survey-review">
          ${each(PAGE_ROWS.filter(([, k]) => a[k]), ([label, k]) => html`
            <div><dt>${label}</dt><dd>${a[k]}</dd></div>`)}
        </dl>

        ${a.bio ? raw(html`<div><dt class="mock-page-dt">Player Bio</dt>
          <p class="survey-bio">${a.bio}</p></div>`) : ""}

        ${socials.length ? raw(html`<dl class="survey-review">${each(socials, (s) => html`
          <div><dt>${s.label}</dt><dd>${a[s.name]}</dd></div>`)}</dl>`) : ""}
      </div>

      <div class="row panel-foot">
        <a class="btn btn-sm" href="#/signup">Start over</a>
        <a class="btn btn-sm btn-ghost" href="#/login">Sign in</a>
      </div>
    </div>
  `;
}

/** Shown above the mock dashboard so nobody mistakes the preview for a real account. */
/**
 * After a real sign-up, while the email is still unconfirmed: the one thing
 * left to do. bindWelcome() removes it as soon as the server says the
 * account is confirmed. Once confirmed there is nothing left to say -- the
 * page panel beside it already links the live page.
 */
const liveBanner = (a) => html`
  <div class="alert alert-ok live-banner">
    <b>${a.firstName}'s page is live.</b>
    It's at <a href="/${a.liveSlug}" target="_blank" rel="noopener">dripgolfrecruiting.com/${a.liveSlug}</a>.
    One last step: open the email we sent to ${a.email} and click the link to
    confirm your account. It signs you in to your dashboard. After that, use
    Sign in at the top of this site with the same email and password.
  </div>
`;

/**
 * Watch for the confirmation (on load, when the tab is shown again, and every
 * 15s while visible) and drop the reminder once it lands. Stops when the
 * banner leaves the page, so navigating away leaves no timer behind.
 */
export function bindWelcome(root) {
  const answers = loadAnswers();
  const banner = root.querySelector(".live-banner");
  if (!banner || !answers?.liveSlug || !answers.needsEmailConfirm) return;

  let timer;
  const stop = () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onShow);
  };
  const check = async () => {
    if (!banner.isConnected) return stop();
    try {
      const res = await fetch("/api/golfer", { headers: { "X-Golfer": answers.liveSlug }, cache: "no-store" });
      if (!res.ok || !(await res.json()).ownerConfirmed) return;
    } catch {
      return; // offline: try again next time
    }
    answers.needsEmailConfirm = false;
    try { sessionStorage.setItem(MOCK_KEY, JSON.stringify(answers)); } catch { /* fine */ }
    banner.remove();
    stop();
  };
  const onShow = () => { if (document.visibilityState === "visible") check(); };

  document.addEventListener("visibilitychange", onShow);
  timer = setInterval(() => { if (document.visibilityState === "visible") check(); }, 15000);
  check();
}

export const mockBanner = (a) => html`
  ${raw(a.liveSlug ? (a.needsEmailConfirm ? liveBanner(a) : "") : html`
  <div class="banner-demo row row-between">
    <span>
      <b>Demo preview.</b> This dashboard is built from ${a.name}'s survey
      answers. No account was created, nothing was charged and nothing left
      this browser tab.
    </span>
  </div>`)}
  ${raw(a.domain ? setupTracker(a) : "")}
`;

/**
 * POST the survey to /api/signup (netlify/functions/signup.mjs), which makes
 * the Supabase account and the golfer's page in one step.
 *
 *   { slug, needsEmailConfirm }  account and page created
 *   { error }                    something the parent can fix (shown on the step)
 *   {}                           sign-ups closed or no server: demo preview
 */
async function createAccount(answers) {
  let res;
  try {
    res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...answers, guardian: answers.guardian === "on" }),
    });
  } catch {
    return {};
  }
  if (res.status === 403 || res.status === 404 || res.status === 405) return {};
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error || "Something went wrong creating your account. Please try again." };
  return { slug: body.slug, needsEmailConfirm: !!body.needsEmailConfirm };
}

export function bindSignup(root, { onDone }) {
  const form = root.querySelector("#signup-form");
  if (!form) return;
  let steps = [...form.querySelectorAll(".survey-step")];
  // While payments and domain buying are not built, a real sign-up skips the
  // two demo-only steps. "beta" flips on when /api/signup says sign-ups are
  // open; until then (or with no server) the full demo survey runs.
  let beta = false;
  const DEMO_ONLY = ["domain", "checkout"];
  const back = form.querySelector("[data-nav='back']");
  const next = form.querySelector("#su-next");
  const bar = root.querySelector("#su-bar");
  const count = root.querySelector("#su-count");
  const msg = root.querySelector("#su-msg");
  let at = 0;

  // Custom steps, keyed by STEPS[].key: onShow() refreshes them, problem()
  // adds a check the generic required/email/number rules cannot express.
  const domain = bindDomainStep(form);
  const checkout = bindCheckoutStep(form);
  const custom = { domain, checkout };
  const isLast = () => at === steps.length - 1;
  const nextLabel = () => (isLast() ? (beta ? "Create my page" : checkout.payLabel()) : "Next");
  const keyAt = (i) => steps[i]?.dataset.key;
  form.querySelectorAll("input[name='plan']").forEach((r) =>
    r.addEventListener("change", () => (next.textContent = nextLabel())));

  const show = (i) => {
    at = i;
    steps.forEach((s, j) => (s.hidden = j !== i));
    back.style.visibility = i ? "visible" : "hidden";
    custom[keyAt(i)]?.onShow();
    next.textContent = nextLabel();
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    msg.innerHTML = "";
    steps[i].querySelector("input, select, textarea")?.focus();
  };

  /** First problem on the current step, as a sentence, or null. */
  const problem = () => {
    for (const el of steps[at].querySelectorAll("input, select, textarea")) {
      const label = el.labels[0]?.textContent.replace("*", "").trim();
      if (el.type === "checkbox" && el.required && !el.checked)
        return { el, text: "Please confirm you are the golfer's parent or legal guardian to continue." };
      if (el.required && !el.value.trim()) return { el, text: `${label} is required.` };
      if (el.type === "email" && el.value && !/^\S+@\S+\.\S+$/.test(el.value))
        return { el, text: "Enter a valid email address." };
      if (el.minLength > 0 && el.value && el.value.length < el.minLength)
        return { el, text: `${label} must be at least ${el.minLength} characters.` };
      if (el.type === "number" && el.validity.badInput)
        return { el, text: `${label} must be a number.` };
    }
    const text = custom[keyAt(at)]?.problem?.();
    if (text) return { el: steps[at].querySelector("input"), text };
    return null;
  };

  back.addEventListener("click", () => show(Math.max(0, at - 1)));
  bindLookup(form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (next.disabled) return; // a sign-up is already on its way
    const bad = problem();
    if (bad) {
      msg.innerHTML = html`<div class="alert alert-error">${bad.text}</div>`;
      bad.el.focus();
      return;
    }
    if (at < steps.length - 1) return show(at + 1);

    const answers = formData(form);
    answers.name = [answers.firstName, answers.lastName].map((s) => s.trim()).filter(Boolean).join(" ");

    // Create the real account and page. While sign-ups are closed (or with
    // no server, e.g. serve.py) this falls back to the demo preview.
    const label = next.textContent;
    next.disabled = true;
    next.textContent = "Creating your page...";
    const result = await createAccount(answers);
    next.disabled = false;
    next.textContent = label;
    if (result.error) {
      msg.innerHTML = html`<div class="alert alert-error">${result.error}</div>`;
      return;
    }
    if (result.slug) {
      answers.liveSlug = result.slug;
      answers.needsEmailConfirm = result.needsEmailConfirm;
    }

    delete answers.password; // never stored in the browser, not even for the preview
    sessionStorage.setItem(MOCK_KEY, JSON.stringify(answers));
    onDone();
  });

  show(0);

  fetch("/api/signup")
    .then((r) => (r.ok ? r.json() : {}))
    .then(({ open }) => {
      if (!open) return;
      beta = true;
      for (const el of steps) if (DEMO_ONLY.includes(el.dataset.key)) el.remove();
      steps = steps.filter((el) => !DEMO_ONLY.includes(el.dataset.key));
      root.querySelector(".survey-card h1")?.insertAdjacentHTML("afterend",
        '<p class="pill pill-likely beta-pill">Free beta &middot; no payment needed</p>');
      show(Math.min(at, steps.length - 1));
    })
    .catch(() => { /* no server (serve.py): stay on the demo survey */ });
}

// ---------------------------------------------------------------------------
// Drip Golf lookup: type a name, pick yourself, the survey fills in
// ---------------------------------------------------------------------------

/**
 * Set a control's value; a <select> without that option gets one added. The
 * control flashes sage so the golfer sees what the tour filled in. A control
 * on a later step flashes when that step is shown: animations do not run on
 * hidden elements.
 */
function put(form, name, value) {
  const el = form.elements[name];
  if (!el || value == null || value === "") return false;
  if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === String(value))) {
    el.add(new Option(String(value), String(value)));
  }
  el.value = String(value);
  el.classList.remove("drip-autofilled");
  void el.offsetWidth; // restart the flash when a second pick refills the same box
  el.classList.add("drip-autofilled");
  el.addEventListener("animationend", () => el.classList.remove("drip-autofilled"), { once: true });
  return true;
}

/**
 * The suggestion list under First name. It searches both name boxes, so
 * "Ph" + "Bu" narrows to Phoenix Button. Picking a player overwrites what the
 * tour knows -- the golfer asked for it by picking -- and everything stays
 * editable afterwards. If the lookup is down the list never appears.
 */
function bindLookup(form) {
  const list = form.querySelector("#su-drip");
  const note = form.querySelector("#su-drip-note");
  const first = form.elements.firstName;
  const last = form.elements.lastName;
  if (!list || !first || !last) return;
  loadRoster(); // warm it up while they fill in step 1
  let matches = [];
  let active = -1;
  let picked = null;

  const paint = () => {
    list.innerHTML = matches.map((p, i) => html`
      <li role="option" id="su-drip-${i}" data-i="${i}" aria-selected="${String(i === active)}">
        <b>${p.name}</b>
        <span>${[p.hometown, p.classYear && `Class of ${p.classYear}`, p.season ? `${p.division}, ${p.season}` : p.division].filter(Boolean).join(" · ")}</span>
      </li>`).join("");
    list.hidden = !matches.length;
    for (const el of [first, last]) {
      el.setAttribute("aria-expanded", String(!!matches.length));
      el.setAttribute("aria-activedescendant", active >= 0 ? `su-drip-${active}` : "");
    }
  };

  const close = () => {
    matches = [];
    active = -1;
    paint();
  };

  const search = async () => {
    const roster = await loadRoster();
    // A box still holding the picked player's name does not narrow the search.
    // Otherwise, after picking Fenton Scott, backspacing "Fenton" only ever
    // finds Scotts -- the golfer is starting over, so search what they type.
    const typed = (el, key) => (picked && el.value === picked[key] ? "" : el.value);
    matches = matchPlayers(roster, typed(first, "firstName"), typed(last, "lastName"));
    active = -1;
    paint();
  };

  const pick = async (p) => {
    picked = p;
    close();
    put(form, "firstName", p.firstName);
    put(form, "lastName", p.lastName);
    const filled = ["name"];
    if (put(form, "hometown", p.hometown)) filled.push("hometown");
    if (put(form, "classYear", p.classYear && `Class of ${p.classYear}`)) filled.push("class year");
    put(form, "gender", isGirlsDivision(p.division) ? "women" : "men");
    if (put(form, "scoringAvg", p.scoringAvg)) filled.push("scoring average");
    note.hidden = false;
    note.classList.add("is-loading");
    note.textContent = `Found ${p.name} on the Drip Golf Tour. Looking up age and JGS rank...`;

    const prof = await loadProfile(p.id);
    if (picked !== p) return; // picked someone else while this was loading
    if (put(form, "age", prof.age)) filled.push("age");
    if (put(form, "nationalRank", prof.jgsRank)) filled.push("JGS rank");
    note.classList.remove("is-loading");
    note.textContent = `Found you, ${p.firstName}! Filled from the Drip Golf Tour: ${filled.join(", ")}. Check each step and change anything that is off.`;
  };

  for (const el of [first, last]) {
    el.setAttribute("role", "combobox");
    el.setAttribute("aria-controls", "su-drip");
    el.setAttribute("aria-autocomplete", "list");
    el.setAttribute("aria-expanded", "false");
    el.addEventListener("input", search);
    el.addEventListener("blur", () => setTimeout(close, 150));
    el.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        active = (active + step + matches.length) % matches.length;
        paint();
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault(); // pick, do not submit the step
        pick(matches[active]);
      } else if (e.key === "Escape") {
        close();
      }
    });
  }

  // mousedown, not click: it lands before the input's blur hides the list.
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    e.preventDefault();
    pick(matches[Number(li.dataset.i)]);
  });
}
