/**
 * The functions, end to end, against the local file backend.
 *
 * The cases that matter most are the isolation ones: with many golfers on
 * one site, the bug that must never ship is "Ava's parent edits Luke's page"
 * or "Ava's data shows up on Luke's page".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setDbForTests } from "../../netlify/functions/_lib/db.mjs";
import { devDb } from "../../netlify/functions/_lib/db-dev.mjs";
import signup, { baseSlug } from "../../netlify/functions/signup.mjs";
import login from "../../netlify/functions/login.mjs";
import golfer from "../../netlify/functions/golfer.mjs";
import myPage from "../../netlify/functions/my-page.mjs";
import golfStats, { cleanRank } from "../../netlify/functions/golf-stats.mjs";
import personal from "../../netlify/functions/personal.mjs";
import tournaments from "../../netlify/functions/tournaments.mjs";
import { portfolioFromHtml } from "../../tools/import-golfer.mjs";

const db = devDb(join(mkdtempSync(join(tmpdir(), "dgp-")), "db.json"));
setDbForTests(db);
process.env.SIGNUPS_ENABLED = "true";

const req = (fn, { method = "GET", golfer: slug, host = "pages.test", token, body } = {}) => {
  const headers = { "Content-Type": "application/json", host };
  if (slug) headers["X-Golfer"] = slug;
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`http://${host}/.netlify/functions/${fn}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
};
const call = async (handler, fn, opts) => {
  const res = await handler(req(fn, opts));
  return { status: res.status, body: await res.json().catch(() => null) };
};

// One shared setup that every test awaits. (A top-level before() hook is not
// reliably finished before the first test on Node 20.)
let ava; let luke;
const ready = (async () => {
  ava = (await call(signup, "signup", { method: "POST", body: {
    guardian: true, email: "ava@example.com", password: "ava-password-1", firstName: "Ava", lastName: "Reed",
    hometown: "Austin, TX", classYear: "Class of 2029", sat: "1400", nationalRank: "850",
  } })).body;
  luke = (await call(signup, "signup", { method: "POST", body: {
    guardian: true, email: "luke@example.com", password: "luke-password-1", firstName: "Luke", lastName: "Selzer",
  } })).body;
})();

test("sign-up creates a page at /<first>-<last> with the survey answers on it", async () => {
  await ready;
  assert.equal(ava.slug, "ava-reed");
  assert.ok(ava.session?.access_token, "dev backend signs the new owner straight in");
  const page = await call(golfer, "golfer", { golfer: "ava-reed" });
  assert.equal(page.status, 200);
  assert.equal(page.body.name, "Ava Reed");
  assert.equal(page.body.ownerConfirmed, true, "dev accounts count as confirmed");
  assert.equal(page.body.storage.maxUploadMB, 50, "the page is told the upload limit (Supabase free plan)");
  assert.equal(page.body.portfolio.golf.stats["Overall JGS Rank"], "850");
  assert.equal(page.body.portfolio.team, "men", "team is saved for the coach cards");
  const bio = await call(personal, "personal", { golfer: "ava-reed" });
  assert.equal(bio.body.hometown, "Austin, TX");
  assert.equal(bio.body.class_year, "Class of 2029", "survey classYear maps to class_year");
  assert.equal(bio.body.test_scores, "1400", "survey sat maps to test_scores");
});

test("a second golfer with the same name gets the next free address", async () => {
  await ready;
  const twin = await call(signup, "signup", { method: "POST", body: {
    guardian: true, email: "ava2@example.com", password: "ava-password-2", firstName: "Ava", lastName: "Reed" } });
  assert.equal(twin.status, 201);
  assert.equal(twin.body.slug, "ava-reed-2");
});

test("sign-up is refused without the parent/guardian confirmation", async () => {
  await ready;
  const res = await call(signup, "signup", { method: "POST", body: {
    email: "kid@example.com", password: "password-123", firstName: "Kid", lastName: "Golfer" } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /parent or legal guardian/);
});

test("slugs drop punctuation and accents", () => {
  assert.equal(baseSlug("Mary-Kate", "O'Neil"), "mary-kate-oneil");
  assert.equal(baseSlug("José", "Núñez"), "jose-nunez");
});

test("sign-ups are refused unless SIGNUPS_ENABLED=true", async () => {
  await ready;
  process.env.SIGNUPS_ENABLED = "false";
  try {
    const res = await call(signup, "signup", { method: "POST", body: {
      guardian: true, email: "x@example.com", password: "password-123", firstName: "X", lastName: "Y" } });
    assert.equal(res.status, 403);
  } finally {
    process.env.SIGNUPS_ENABLED = "true";
  }
});

test("an unknown address is a 404, not someone else's page", async () => {
  await ready;
  assert.equal((await call(golfer, "golfer", { golfer: "nobody-here" })).status, 404);
  assert.equal((await call(golfer, "golfer", { host: "unclaimed.test" })).status, 404);
});

test("a golfer's own domain serves their page without any slug", async () => {
  await ready;
  await db.createGolfer({ ownerId: "someone", slug: "sam-park", name: "Sam Park", domain: "sampark.test" });
  const res = await call(golfer, "golfer", { host: "www.SamPark.test" });
  assert.equal(res.status, 200);
  assert.equal(res.body.slug, "sam-park", "www. and capitals are ignored");
});

test("the owner can edit their own page", async () => {
  await ready;
  const res = await call(personal, "personal", { method: "PUT", golfer: "ava-reed",
    token: ava.session.access_token, body: { name: "Ava Reed", bio: "Hits it far." } });
  assert.equal(res.status, 200);
  assert.equal((await call(personal, "personal", { golfer: "ava-reed" })).body.bio, "Hits it far.");
});

test("nobody can edit a page without signing in", async () => {
  await ready;
  const res = await call(personal, "personal", { method: "PUT", golfer: "ava-reed", body: { bio: "hacked" } });
  assert.equal(res.status, 401);
});

test("one golfer's owner cannot edit another golfer's page", async () => {
  await ready;
  const res = await call(personal, "personal", { method: "PUT", golfer: "ava-reed",
    token: luke.session.access_token, body: { bio: "Luke's parent was here" } });
  assert.equal(res.status, 401);
  const add = await call(tournaments, "tournaments", { method: "POST", golfer: "ava-reed",
    token: luke.session.access_token, body: { name: "Fake Open" } });
  assert.equal(add.status, 401);
  assert.notEqual((await call(personal, "personal", { golfer: "ava-reed" })).body.bio, "Luke's parent was here");
});

test("a forged token is rejected", async () => {
  await ready;
  const res = await call(personal, "personal", { method: "PUT", golfer: "ava-reed", token: "not-a-real-token", body: { bio: "x" } });
  assert.equal(res.status, 401);
});

test("data stays on its own golfer's page", async () => {
  await ready;
  await call(tournaments, "tournaments", { method: "POST", golfer: "ava-reed",
    token: ava.session.access_token, body: { name: "Austin Junior Classic", year: "2026" } });
  const avas = (await call(tournaments, "tournaments", { golfer: "ava-reed" })).body.tournaments;
  const lukes = (await call(tournaments, "tournaments", { golfer: "luke-selzer" })).body.tournaments;
  assert.ok(avas.some((t) => t.name === "Austin Junior Classic"));
  assert.ok(!lukes.some((t) => t.name === "Austin Junior Classic"), "Ava's tournament leaked onto Luke's page");
});

test("signing in: wrong password 401, someone else's page 403, own page 200", async () => {
  await ready;
  const wrong = await call(login, "login", { method: "POST", golfer: "ava-reed",
    body: { email: "ava@example.com", password: "nope-nope-nope" } });
  assert.equal(wrong.status, 401);

  const otherPage = await call(login, "login", { method: "POST", golfer: "luke-selzer",
    body: { email: "ava@example.com", password: "ava-password-1" } });
  assert.equal(otherPage.status, 403);
  assert.equal(otherPage.body.session, undefined, "no session handed out for a page you don't own");

  const ok = await call(login, "login", { method: "POST", golfer: "ava-reed",
    body: { email: "AVA@example.com ", password: "ava-password-1" } });
  assert.equal(ok.status, 200);

  const refreshed = await call(login, "login", { method: "POST", golfer: "ava-reed",
    body: { refresh_token: ok.body.session.refresh_token } });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.session.access_token, ok.body.session.access_token);
});

test("the import reads an old page's pasted-in results", () => {
  const html = `<script>\nconst PORTFOLIO_DATA = {\n  "seasons": { "2025": [{ "name": "X" }] },\n  "personal": { "name": "Y" },\n  "golf": {}\n};\n</script>`;
  const p = portfolioFromHtml(html);
  assert.equal(p.seasons["2025"][0].name, "X");
  assert.equal(p.personal.name, "Y");
});

test("signing in from the homepage finds the parent's own golfer page", async () => {
  await ready;
  const ok = await call(myPage, "my-page", { method: "POST", body: { email: "ava@example.com", password: "ava-password-1" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.slug, "ava-reed");
  assert.ok(ok.body.session.access_token);

  const wrong = await call(myPage, "my-page", { method: "POST", body: { email: "ava@example.com", password: "wrong-pass-1" } });
  assert.equal(wrong.status, 401);

  // The confirmation-email link: tokens in, same page out.
  const viaLink = await call(myPage, "my-page", { method: "POST", token: ok.body.session.access_token,
    body: { refresh_token: ok.body.session.refresh_token } });
  assert.equal(viaLink.status, 200);
  assert.equal(viaLink.body.slug, "ava-reed");

  const forged = await call(myPage, "my-page", { method: "POST", token: "forged", body: {} });
  assert.equal(forged.status, 401);
});

test("the survey can ask whether sign-ups are open", async () => {
  await ready;
  assert.equal((await call(signup, "signup")).body.open, true);
  process.env.SIGNUPS_ENABLED = "false";
  try { assert.equal((await call(signup, "signup")).body.open, false); }
  finally { process.env.SIGNUPS_ENABLED = "true"; }
});

test("an owner can edit their rankings and every reader sees them", async () => {
  await ready;
  const put = await call(golfStats, "golf-stats", { method: "PUT", golfer: "ava-reed", token: ava.session.access_token,
    body: { "Overall JGS Rank": "#1,234", "TUGR Rank": "900", "CGA Rank": "n/a", "Drip Golf Rank": "12" } });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body, { "Overall JGS Rank": "1234", "TUGR Rank": "900", "CGA Rank": "N/A", "Drip Golf Rank": "12" });

  // /api/golfer layers them over the sign-up value (850), which is what the
  // page, the dashboard and College Best Fit read.
  const page = await call(golfer, "golfer", { golfer: "ava-reed" });
  assert.equal(page.body.portfolio.golf.stats["Overall JGS Rank"], "1234");
  assert.equal(page.body.portfolio.golf.stats["CGA Rank"], "N/A");

  // A blank box drops the owner's value and falls back to the original.
  await call(golfStats, "golf-stats", { method: "PUT", golfer: "ava-reed", token: ava.session.access_token,
    body: { "Overall JGS Rank": "" } });
  const back = await call(golfer, "golfer", { golfer: "ava-reed" });
  assert.equal(back.body.portfolio.golf.stats["Overall JGS Rank"], "850");
  assert.equal(back.body.portfolio.golf.stats["TUGR Rank"], "900", "other ranks untouched");
});

test("rankings are owner-only and must be real numbers", async () => {
  await ready;
  const anon = await call(golfStats, "golf-stats", { method: "PUT", golfer: "ava-reed", body: { "TUGR Rank": "1" } });
  assert.equal(anon.status, 401);
  const other = await call(golfStats, "golf-stats", { method: "PUT", golfer: "ava-reed", token: luke.session.access_token,
    body: { "TUGR Rank": "1" } });
  assert.equal(other.status, 401, "another family cannot set Ava's ranks");
  const bad = await call(golfStats, "golf-stats", { method: "PUT", golfer: "ava-reed", token: ava.session.access_token,
    body: { "Overall JGS Rank": "top 10" } });
  assert.equal(bad.status, 400);
  assert.deepEqual(cleanRank(" 0 "), { error: cleanRank("x").error });
  assert.deepEqual(cleanRank("12,080"), { value: "12080" });
});

test("every inline script on the golfer page parses", async () => {
  // A single broken character in golfer.html takes every golfer's page down,
  // and none of the API tests above would notice. Parse (not run) each
  // inline <script> so a syntax error fails here instead of in production.
  const { readFileSync } = await import("node:fs");
  const html = readFileSync(new URL("../../golfer.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, "expected the page's inline scripts");
  scripts.forEach((code, i) => {
    assert.doesNotThrow(() => new Function(code), `inline script #${i + 1} has a syntax error`);
  });
});
