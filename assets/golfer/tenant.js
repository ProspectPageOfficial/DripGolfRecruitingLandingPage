/* ======================================================================
   tenant.js — makes the single-golfer page serve any golfer.

   Loaded before every other script on golfer.html. Three jobs:

   1. WHO. On the shared host the golfer is the first path segment
      (/ava-reed). On a golfer's own domain (avareed.com) there is no
      segment and the server works it out from the domain.

   2. EVERY /api CALL. window.fetch is wrapped so each "/api/..." request
      carries X-Golfer (when known) and the owner's access token. The page's
      existing modules (UserScores, SwingVideos, PersonalBio...) keep calling
      fetch("/api/tournaments") exactly as they always did -- which is why
      they did not need rewriting. An expired token is refreshed once, then
      a 401 falls through to the modules' existing "prompt for owner" path.

   3. DATA. load() fetches /api/golfer and fills PORTFOLIO_DATA in place,
      replacing the copy of Luke's results that used to be baked into the
      HTML.
   ====================================================================== */
window.DripTenant = (function () {
  const seg = decodeURIComponent(location.pathname.split("/")[1] || "").toLowerCase();
  const slug = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(seg) && !seg.endsWith(".html") ? seg : "";
  // Session and role are per golfer: being Ava's owner in this tab must not
  // make Luke's page, one click away on the same host, open in owner mode.
  const key = slug || location.hostname;
  const SESSION_KEY = "dg_session:" + key;

  let golfer = null;
  const nativeFetch = window.fetch.bind(window);

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function saveSession(s) {
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* private mode: owner just signs in again next load */ }
  }

  function withHeaders(init) {
    init = init || {};
    const h = new Headers(init.headers || {});
    h.delete("X-Owner-Password"); // the old modules still send it, empty; nothing reads it
    if (slug) h.set("X-Golfer", slug);
    const s = session();
    if (s && s.access_token) h.set("Authorization", "Bearer " + s.access_token);
    return Object.assign({}, init, { headers: h });
  }

  async function refresh() {
    const s = session();
    if (!s || !s.refresh_token) return false;
    const res = await nativeFetch("/api/login", withHeaders({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    }));
    if (!res.ok) { saveSession(null); return false; }
    saveSession((await res.json()).session);
    return true;
  }

  window.fetch = async function (input, init) {
    if (typeof input !== "string" || !input.startsWith("/api/")) return nativeFetch(input, init);
    let res = await nativeFetch(input, withHeaders(init));
    if (res.status === 401 && input !== "/api/login" && (await refresh())) {
      res = await nativeFetch(input, withHeaders(init));
    }
    return res;
  };

  /** Fill `target` (PORTFOLIO_DATA) in place. False when no golfer lives here. */
  async function load(target) {
    const res = await fetch("/api/golfer", { cache: "no-store" });
    if (!res.ok) return false;
    golfer = await res.json();
    const p = golfer.portfolio || {};
    target.seasons = p.seasons || {};
    target.personal = Object.assign({ name: golfer.name }, p.personal || {});
    target.golf = Object.assign({ stats: {}, rankings: {}, scoring: {} }, p.golf || {});
    document.title = golfer.name + " — Golfer Portfolio";
    return true;
  }

  /** { ok } or { ok: false, error } -- the gate shows `error` as-is. */
  async function login(email, password) {
    let res;
    try {
      res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection." };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || "Sign-in failed." };
    saveSession(body.session);
    return { ok: true };
  }

  return {
    slug,
    key,
    load,
    login,
    logout: () => saveSession(null),
    hasSession: () => !!(session() && session().access_token),
    session,
    golfer: () => golfer,
    firstName: () => String((golfer && golfer.name) || "").split(/\s+/)[0],
  };
})();
