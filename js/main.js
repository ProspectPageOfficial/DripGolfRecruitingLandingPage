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
import { dashboardView } from "./views/dashboard.js";
import { fitView, bindFit } from "./views/fit.js";
import { provenanceView } from "./views/provenance.js";

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
];

/**
 * Transient UI state only. Anything that must survive a refresh belongs on the
 * website, not here -- one source of truth per fact.
 *
 * `live` holds the last successful read of /api/personal. It is fetched once at
 * boot rather than per route: navigating between two screens is not new
 * evidence that the golfer's hometown changed.
 */
const ui = { prefs: {}, live: {}, liveOk: false };

// ---------------------------------------------------------------------------
// Route table. Declarative beats a switch statement nobody wants to touch.
//   auth: true     -> must be signed in, else bounced to #/login
//   redirect: url  -> leaves the app entirely; nothing is rendered
// ---------------------------------------------------------------------------
const ROUTES = [
  { path: /^\/?$/,         key: "home",      render: () => landing() },
  { path: /^\/login$/,     key: "login",     render: () => authView() },
  { path: /^\/data$/,      key: "data",      render: () => provenanceView() },

  // The public page is a separate deployment, so this app no longer renders a
  // copy of it. The route survives purely so links already sitting in a coach's
  // inbox land on the real site instead of a 404 -- deleting a URL other people
  // hold is not a refactor, it is breaking someone else's bookmark.
  { path: /^\/page$/,      key: "profile",   redirect: PUBLIC_SITE.url },
  { path: /^\/dashboard$/, key: "dashboard", auth: true, render: (ctx) => dashboardView(ctx.golfer, ctx.liveOk) },
  { path: /^\/fit$/,       key: "fit",       auth: true, render: (ctx) => fitView(ctx.golfer, ui.prefs) },

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

  if (route.auth && !ctx.user) {
    location.hash = "#/login";
    return;
  }

  paint(ctx, route.key, route.render(ctx));
  bindFor(route.key);
}

function paint(ctx, active, body) {
  root.innerHTML = page(ctx.user, ctx.golfer, active, body);
  root.querySelector("[data-action='signout']")?.addEventListener("click", async () => {
    await auth.signOut();
    location.hash = "#/";
    router();
  });
  window.scrollTo(0, 0);
}

/** Per-route event wiring. Views stay pure-ish; binding is explicit. */
function bindFor(key) {
  if (key === "login") {
    bindAuth(root, {
      onDone: () => {
        location.hash = "#/dashboard";
        router();
      },
    });
  }

  if (key === "fit") {
    bindFit(root, {
      prefs: ui.prefs,
      onPrefsChange: (prefs) => {
        ui.prefs = prefs;
        router();
      },
    });
  }
}

const notFound = () => html`
  <div class="container section">
    ${raw(empty("That page does not exist."))}
    <p class="center" style="margin-top:1rem"><a class="btn btn-ghost" href="#/">Back home</a></p>
  </div>
`;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  // Retired stores. Removed on every boot so a browser that ran an older build
  // does not keep serving a stale, editable golfer record forever.
  localStorage.removeItem("dg.demo.profiles");
  localStorage.removeItem("dg.demo.golfer");

  await seedOwnerAccount(DEMO_LOGIN);

  // Read the golfer's own website. Never throws; on failure the snapshot
  // stands and the UI says so rather than pretending the read succeeded.
  const live = await fetchLiveProfile();
  ui.live = live.ok ? normalizeLive(live.data) : {};
  ui.liveOk = live.ok;

  window.addEventListener("hashchange", router);
  await router();
}

/** Escape hatch for reviewers who have mangled the demo data. */
window.resetDripGolfDemo = () => {
  STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  location.hash = "#/";
  location.reload();
};

boot();
