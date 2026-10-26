/**
 * main.js — bootstrap, routing, and the guard that decides who sees what.
 *
 * Routing is hash-based on purpose: the demo opens straight off the filesystem
 * with no server, no build step, no npm install. Two seconds to review beats a
 * toolchain.
 *
 * There is one golfer and one account, so there are no route params anywhere in
 * this file. Nothing to look up by id, nothing to disambiguate by slug.
 */
import { auth, seedOwnerAccount } from "./auth/store.js";
import { buildGolfer } from "./data/golfer.js";
import { fetchLiveProfile, normalizeLive } from "./data/live.js";
import { DEMO_LOGIN, PUBLIC_SITE } from "./config.js";
import { page } from "./lib/shell.js";
import { html, raw } from "./lib/dom.js";
import { empty } from "./lib/components.js";

import { landing } from "./views/landing.js";
import { authView, bindAuth } from "./views/auth.js";
import {
  signupView, bindSignup, bindWelcome, loadAnswers, mockGolfer, mockPagePanel, mockBanner, MOCK_KEY,
  livePagePanel,
} from "./views/signup.js";
import { loadAccount, saveAccount, clearAccount, fetchAccountGolfer } from "./data/account.js";
import { dashboardView } from "./views/dashboard.js";
import { fitView, bindFit } from "./views/fit.js";
import { provenanceView } from "./views/provenance.js";
import { faqView } from "./views/faq.js";
import { termsView, privacyView } from "./views/legal.js";
import { findMyPage, openMyPage, AUTH_NOTICE_KEY } from "./lib/mypage.js";

const root = document.getElementById("app");

/**
 * Every key this demo owns. `dg.demo.golfer` and `dg.demo.profiles` are both
 * retired -- the golfer record is read from the live site now, and the
 * multi-golfer table went with the single-golfer cut. They stay listed so a
 * browser that ran an older build gets them swept up rather than carrying dead
 * blobs around forever.
 */
const STORAGE_KEYS = [
  "dg.demo.users",
  "dg.demo.session",
  "dg.demo.golfer",
  "dg.demo.profiles",
  MOCK_KEY,
];

/**
 * Transient UI state only. Anything that must survive a refresh belongs on the
 * website, not here -- one source of truth per fact.
 *
 * `live` holds the last successful read of /api/personal. It is fetched once at
 * boot rather than per route: navigating between two screens is not new
 * evidence that the golfer's hometown changed.
 *
 * The `prefs` slot that used to live here went away with the Fit-view filter
 * form. Search now runs locally inside bindFit and does not need to survive a
 * route change; if a persistent pref lands back on the roadmap, put it here.
 */
const ui = { live: {}, liveOk: false };

// ---------------------------------------------------------------------------
// Route table. Declarative beats a switch statement nobody wants to touch.
//   auth: true     -> must be signed in, else bounced to #/login
//   redirect: url  -> leaves the app entirely; nothing is rendered
// ---------------------------------------------------------------------------
const ROUTES = [
  { path: /^\/?$/,         key: "home",      render: () => landing() },
  { path: /^\/login$/,     key: "login",     render: () => authView() },
  { path: /^\/signup$/,    key: "signup",    render: () => signupView() },

  // The sign-up demo's mock dashboard. Signed out on purpose -- no account was
  // made -- so it is guarded by "finished the survey" instead of by auth.
  { path: /^\/welcome$/,     key: "welcome",     mock: true, render: (ctx) => dashboardView(ctx.mock, true, {
      pagePanel: mockPagePanel(ctx.answers), banner: mockBanner(ctx.answers), fitHref: "#/welcome/fit",
    }) },
  { path: /^\/welcome\/fit$/, key: "welcome-fit", mock: true, render: (ctx) => fitView(ctx.mock) },
  // A real parent account (sign-up survey + Supabase). Guarded by having
  // signed in on this tab; the golfer is read from the page's own API.
  { path: /^\/my$/,        key: "my",        account: true, render: (ctx) => dashboardView(ctx.mine, true, {
      pagePanel: livePagePanel({ liveSlug: ctx.account.slug }, "#/my/edit"), banner: "", fitHref: "#/my/fit",
    }) },
  { path: /^\/my\/fit$/,   key: "my-fit",    account: true, render: (ctx) => fitView(ctx.mine) },
  // Opens the golfer page already signed in (owner mode), same tab.
  { path: /^\/my\/edit$/,  key: "my-edit",   account: true, editPage: true },
  { path: /^\/data$/,      key: "data",      render: () => provenanceView() },
  { path: /^\/faq$/,       key: "faq",       render: () => faqView() },
  { path: /^\/terms$/,     key: "terms",     render: () => termsView() },
  { path: /^\/privacy$/,   key: "privacy",   render: () => privacyView() },

  // The public page is a separate deployment, so this app no longer renders a
  // copy of it. The route survives purely so links already sitting in a coach's
  // inbox land on the real site instead of a 404 -- deleting a URL other people
  // hold is not a refactor, it is breaking someone else's bookmark.
  { path: /^\/page$/,      key: "profile",   redirect: PUBLIC_SITE.url },
  { path: /^\/dashboard$/, key: "dashboard", auth: true, render: (ctx) => dashboardView(ctx.golfer, ctx.liveOk) },

  // The landing page's "See a live example" card. Signs the visitor into the
  // demo account and lands on its dashboard -- the same thing the sign-in
  // page's one-click demo button does, minus the form. Auth here is the
  // browser-only mock, so this hands out nothing a visitor could not already
  // click their way to.
  { path: /^\/example$/,   key: "example",   demoLogin: true },
  { path: /^\/fit$/,       key: "fit",       auth: true, render: (ctx) => fitView(ctx.golfer) },

  // #/edit is gone: there is nothing in this app left to edit. Anyone landing
  // on a stale link goes to the site, which is the only place editing happens.
  { path: /^\/edit$/,      key: "edit",      redirect: PUBLIC_SITE.url },
];

// ---------------------------------------------------------------------------
// Render pipeline
// ---------------------------------------------------------------------------

async function router() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const { data } = await auth.getUser();
  const ctx = {
    user: data.user,
    golfer: buildGolfer(ui.live),
    liveOk: ui.liveOk,
  };

  const route = ROUTES.find((r) => r.path.test(hash));
  if (!route) return paint(ctx, "home", notFound());

  // `replace`, not `href`: it overwrites this history entry rather than adding
  // one, so pressing Back returns to the screen before #/page instead of
  // re-entering the redirect and bouncing straight back out again.
  if (route.redirect) return location.replace(route.redirect);

  // `replace` for the same reason: Back from the dashboard should return to
  // the landing page, not re-run the sign-in and bounce forward again.
  if (route.demoLogin) {
    if (!ctx.user) await auth.signInWithPassword({ email: DEMO_LOGIN.email, password: DEMO_LOGIN.password });
    return location.replace("#/dashboard");
  }

  if (route.mock) {
    ctx.answers = loadAnswers();
    if (!ctx.answers) {
      location.hash = "#/signup";
      return;
    }
    ctx.mock = mockGolfer(ctx.answers);
  }

  if (route.auth && !ctx.user) {
    location.hash = "#/login";
    return;
  }

  if (route.account) {
    ctx.account = loadAccount();
    if (!ctx.account) {
      location.hash = "#/login";
      return;
    }
    if (route.editPage) {
      // Swap this history entry for the dashboard first, so Back from the
      // page lands on #/my instead of re-entering this hop.
      history.replaceState(null, "", "#/my");
      return openMyPage(ctx.account.slug, ctx.account.session);
    }
    ctx.mine = await fetchAccountGolfer(ctx.account.slug);
    if (!ctx.mine) return paint(ctx, route.key, accountUnavailable());
  }

  paint(ctx, route.key, route.render(ctx));
  bindFor(route.key, ctx);
}

function paint(ctx, active, body) {
  root.innerHTML = ctx.account
    ? page(null, ctx.mine, active, body, { account: ctx.account.slug })
    : ctx.mock
    ? page(null, ctx.mock, active, body, true)
    : page(ctx.user, ctx.golfer, active, body);
  root.querySelector("[data-action='account-signout']")?.addEventListener("click", () => {
    clearAccount();
    location.hash = "#/";
  });
  root.querySelector("[data-action='signout']")?.addEventListener("click", async () => {
    await auth.signOut();
    location.hash = "#/";
    router();
  });
  window.scrollTo(0, 0);
}

/** Per-route event wiring. Views stay pure-ish; binding is explicit. */
function bindFor(key, ctx = {}) {
  if (key === "my-fit") bindFit(root, { profile: ctx.mine });
  if (key === "login") {
    bindAuth(root, {
      onDone: () => {
        location.hash = "#/dashboard";
        router();
      },
    });
  }

  if (key === "signup") {
    bindSignup(root, {
      onDone: () => {
        location.hash = "#/welcome";
      },
    });
  }

  if (key === "welcome") bindWelcome(root);
  if (key === "welcome-fit") bindFit(root, { profile: mockGolfer(loadAnswers()) });

  if (key === "fit") {
    // The Fit view now filters locally as-you-type; there is no pref that has
    // to survive a route change, so nothing round-trips through main.js's ui
    // state. That is why `onPrefsChange` is gone from the payload.
    bindFit(root, { profile: buildGolfer(ui.live) });
  }
}

/** The account is signed in but its page could not be read (network, or deleted). */
const accountUnavailable = () => html`
  <div class="container section">
    ${raw(empty("We couldn't load your golfer's page just now. Check your connection and try again."))}
    <p class="center" style="margin-top:1rem"><a class="btn btn-ghost" href="#/my">Try again</a></p>
  </div>
`;

const notFound = () => html`
  <div class="container section">
    ${raw(empty("That page does not exist."))}
    <p class="center" style="margin-top:1rem"><a class="btn btn-ghost" href="#/">Back home</a></p>
  </div>
`;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Supabase's "confirm your email" link comes back to the site root with the
 * new session in the URL fragment (#access_token=...&refresh_token=...), or
 * an error (#error=...&error_description=...). Turn that into the parent
 * landing on their golfer's page, signed in. Returns true when it handled
 * the URL, so the normal router does not try to route "#access_token=...".
 */
async function finishEmailLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("access_token") && !params.has("error") && !params.has("error_description")) return false;
  history.replaceState(null, "", location.pathname + "#/login");

  const notice = (text) => {
    try { sessionStorage.setItem(AUTH_NOTICE_KEY, text); } catch { /* shown nowhere; harmless */ }
  };
  if (params.has("error") || params.has("error_description")) {
    notice("That confirmation link has expired or was already used. If you've confirmed before, sign in below.");
    return false;
  }
  root.innerHTML = '<p class="center muted" style="margin-top:20vh">Confirming your email...</p>';
  const found = await findMyPage({
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    expiresAt: Number(params.get("expires_at")) || null,
  });
  if (found.slug) {
    saveAccount(found.slug, found.session);
    location.replace("#/my");
    return false; // let boot() continue and route to the dashboard
  }
  notice(("Your email is confirmed. " + (found.error || "") + " Sign in below.").replace(/\s+/g, " "));
  return false;
}

async function boot() {
  if (await finishEmailLink()) return;

  // Retired stores. Removed on every boot so a browser that ran an older build
  // does not keep serving a stale, editable golfer record forever.
  localStorage.removeItem("dg.demo.profiles");
  localStorage.removeItem("dg.demo.golfer");

  // Sessions moved to sessionStorage so that signed out is the default (see
  // auth/store.js). A localStorage session written by an older build would
  // outlive the browser and keep dropping a returning visitor straight into
  // the dashboard -- the exact behaviour that change removes. Sweeping the old
  // key here is what actually retires it: shipping the new store without this
  // leaves every existing visitor on the old one, signed in, forever.
  localStorage.removeItem("dg.demo.session");

  await seedOwnerAccount(DEMO_LOGIN);

  // Read the golfer's own website. Never throws; on failure the snapshot
  // stands and the UI says so rather than pretending the read succeeded.
  const live = await fetchLiveProfile();
  ui.live = live.ok ? normalizeLive(live.data) : {};
  ui.liveOk = live.ok;

  window.addEventListener("hashchange", router);
  await router();
}

/**
 * Escape hatch for reviewers who have mangled the demo data.
 *
 * Clears both backings for every key. The session lives in sessionStorage and
 * everything else in localStorage, but a reset that has to remember which is
 * which is a reset that eventually forgets -- and the one key it forgets is the
 * one keeping you signed in.
 */
window.resetDripGolfDemo = () => {
  STORAGE_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  location.hash = "#/";
  location.reload();
};

boot();
