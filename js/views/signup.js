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
import { html, raw, formData, initials } from "../lib/dom.js";
import { normalizeLive } from "../data/live.js";
import { loadRoster, loadProfile, matchPlayers, isGirlsDivision } from "../data/dripgolf.js";

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
    blurb: "This is how you will sign in to edit your page and see your fit scores.",
    fields: [
      { name: "email", label: "Email", type: "email", required: true, wide: true,
        placeholder: "you@example.com", autocomplete: "email" },
      { name: "password", label: "Password", type: "password", required: true, wide: true,
        placeholder: "At least 8 characters", autocomplete: "new-password", minLength: 8 },
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
            <fieldset class="survey-step stack-sm" data-step="${i}" ${raw(i ? "hidden" : "")}>
              <legend class="serif survey-title">${s.title}</legend>
              <p class="muted survey-blurb">${s.blurb}</p>
              ${s.note ? raw(html`<p class="field-hint survey-note">${s.note}</p>`) : ""}
              <div class="survey-grid">${each(s.fields, field)}</div>
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
export function mockPagePanel(a) {
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
export const mockBanner = (a) => html`
  <div class="banner-demo row row-between">
    <span>
      <b>Demo preview.</b> This dashboard is built from ${a.name}'s survey
      answers. No account was created and nothing left this browser tab.
    </span>
  </div>
`;

export function bindSignup(root, { onDone }) {
  const form = root.querySelector("#signup-form");
  if (!form) return;
  const steps = [...form.querySelectorAll(".survey-step")];
  const back = form.querySelector("[data-nav='back']");
  const next = form.querySelector("#su-next");
  const bar = root.querySelector("#su-bar");
  const count = root.querySelector("#su-count");
  const msg = root.querySelector("#su-msg");
  let at = 0;

  const show = (i) => {
    at = i;
    steps.forEach((s, j) => (s.hidden = j !== i));
    back.style.visibility = i ? "visible" : "hidden";
    next.textContent = i === steps.length - 1 ? "Create account" : "Next";
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    msg.innerHTML = "";
    steps[i].querySelector("input, select, textarea")?.focus();
  };

  /** First problem on the current step, as a sentence, or null. */
  const problem = () => {
    for (const el of steps[at].querySelectorAll("input, select, textarea")) {
      const label = el.labels[0]?.textContent.replace("*", "").trim();
      if (el.required && !el.value.trim()) return { el, text: `${label} is required.` };
      if (el.type === "email" && el.value && !/^\S+@\S+\.\S+$/.test(el.value))
        return { el, text: "Enter a valid email address." };
      if (el.minLength > 0 && el.value && el.value.length < el.minLength)
        return { el, text: `${label} must be at least ${el.minLength} characters.` };
      if (el.type === "number" && el.validity.badInput)
        return { el, text: `${label} must be a number.` };
    }
    return null;
  };

  back.addEventListener("click", () => show(Math.max(0, at - 1)));
  bindLookup(form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const bad = problem();
    if (bad) {
      msg.innerHTML = html`<div class="alert alert-error">${bad.text}</div>`;
      bad.el.focus();
      return;
    }
    if (at < steps.length - 1) return show(at + 1);

    const answers = formData(form);
    answers.name = [answers.firstName, answers.lastName].map((s) => s.trim()).filter(Boolean).join(" ");
    delete answers.password; // never leaves the form, not even into the preview
    sessionStorage.setItem(MOCK_KEY, JSON.stringify(answers));
    onDone();
  });

  show(0);
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
