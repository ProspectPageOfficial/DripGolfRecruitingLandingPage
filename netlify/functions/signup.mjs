/**
 * /api/signup — create an account AND the golfer's page in one step.
 *
 * GET  -> { open }   whether sign-ups are switched on (the survey asks first)
 * POST { email, password, firstName, lastName, guardian: true, ...survey answers }
 *   -> 201 { slug, path, session, needsEmailConfirm }
 *
 * Field names are the recruiting app's sign-up survey names (classYear,
 * school, sat, address...) so its "Create account" step can post its answers
 * straight here. They are mapped onto the page's Personal Bio fields and run
 * through the same whitelist /api/personal uses.
 *
 * CLOSED unless SIGNUPS_ENABLED=true. Until payment is wired in, an open
 * endpoint would let anyone mint public pages on your domain. When Stripe
 * lands, this is called from the payment webhook instead, and the flag goes.
 */
import { getDb } from "./_lib/db.mjs";
import { json, preflight, readJson } from "./_lib/http.mjs";
import { SLUG_RE } from "./_lib/tenant.mjs";
import { normalize as normalizePersonal } from "./personal.mjs";
import { EMPTY_PORTFOLIO } from "./golfer.mjs";

/** Survey field -> Personal Bio field, where the names differ. */
const RENAME = {
  classYear: "class_year",
  school: "currently_attending",
  address: "home_address",
  sat: "test_scores",
};

/** "Mary-Kate", "O'Neil" -> "mary-kate-oneil" */
export function baseSlug(first, last) {
  const part = (s) =>
    String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-");
  return [part(first), part(last)].filter(Boolean).join("-").slice(0, 50).replace(/-+$/, "") || "golfer";
}

/** First free slug: ava-reed, ava-reed-2, ava-reed-3... */
export async function freeSlug(db, base) {
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (SLUG_RE.test(slug) && !(await db.slugTaken(slug))) return slug;
  }
  throw new Error("No free address for this name");
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return preflight();
  if (req.method === "GET") return json(200, { open: process.env.SIGNUPS_ENABLED === "true" });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (process.env.SIGNUPS_ENABLED !== "true") {
    return json(403, { error: "Sign-ups are not open yet." });
  }

  const body = (await readJson(req)) || {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: "Enter a valid email address." });
  if (password.length < 8) return json(400, { error: "Password must be at least 8 characters." });
  if (!firstName || !lastName) return json(400, { error: "First and last name are required." });
  // Children's privacy: accounts belong to an adult parent or guardian, never
  // the golfer (see the Terms and Privacy Policy, js/views/legal.js).
  if (body.guardian !== true && body.guardian !== "on") {
    return json(400, { error: "Please confirm you are the golfer's parent or legal guardian." });
  }

  const db = await getDb();
  const name = `${firstName} ${lastName}`;

  const account = await db.signUp(email, password);
  if (account.error) return json(400, { error: account.error });

  // Two sign-ups racing for "ava-reed" both see it free; the database's
  // unique constraint lets one win, and the loser takes the next number.
  let golfer;
  for (let attempt = 0; !golfer; attempt++) {
    const slug = await freeSlug(db, baseSlug(firstName, lastName));
    try {
      golfer = await db.createGolfer({ ownerId: account.user.id, slug, name });
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }

  const fields = { name };
  for (const [k, v] of Object.entries(body)) fields[RENAME[k] || k] = v;
  const personal = normalizePersonal(fields);
  await db.setDoc(golfer.id, "personal-overrides", personal);

  const stats = {};
  if (body.nationalRank) stats["Overall JGS Rank"] = String(body.nationalRank);
  if (body.scoringAvg) stats["Scoring Average"] = String(body.scoringAvg);
  await db.setDoc(golfer.id, "portfolio", {
    ...EMPTY_PORTFOLIO,
    // Men's or women's golf: which coach the dashboard shows for each school.
    team: body.gender === "women" ? "women" : "men",
    personal: { name, class_year: personal.class_year || "", hometown: personal.hometown || "" },
    golf: { ...EMPTY_PORTFOLIO.golf, stats },
  });

  return json(201, {
    slug: golfer.slug,
    path: `/${golfer.slug}`,
    session: account.session,
    needsEmailConfirm: !account.session,
  });
}

export const config = { path: "/api/signup" };
