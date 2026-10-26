/**
 * Local-only backend: one JSON file, so the whole site can be run and
 * clicked through without a Supabase project. Only loads when DRIP_DEV=1.
 *
 * Passwords are scrypt-hashed even here -- the file is plain text on disk,
 * and "it's only dev" is how real passwords end up in a test fixture.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const HOUR = 3600;

export function devDb(file = process.env.DRIP_DEV_DB || ".dev-data/db.json") {
  const load = () => {
    try { return JSON.parse(readFileSync(file, "utf8")); }
    catch { return { users: [], golfers: [], docs: {}, tokens: {} }; }
  };
  const save = (d) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(d, null, 2));
  };

  const hash = (pw, salt = randomBytes(16).toString("hex")) =>
    `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
  const check = (pw, stored) => {
    const [salt, h] = stored.split(":");
    return timingSafeEqual(Buffer.from(h, "hex"), scryptSync(pw, salt, 32));
  };

  const issue = (d, user) => {
    const access = randomBytes(24).toString("hex");
    const refresh = randomBytes(24).toString("hex");
    const expires_at = Math.floor(Date.now() / 1000) + HOUR;
    d.tokens[access] = { userId: user.id, expires_at };
    d.tokens[`r:${refresh}`] = { userId: user.id };
    return { access_token: access, refresh_token: refresh, expires_at, user: { id: user.id, email: user.email } };
  };

  return {
    async getGolferBySlug(slug) { return load().golfers.find((g) => g.slug === slug) || null; },
    async getGolferByDomain(host) { return load().golfers.find((g) => g.domain === host) || null; },
    async getGolfersByOwner(ownerId) { return load().golfers.filter((g) => g.owner_id === ownerId); },
    async slugTaken(slug) { return load().golfers.some((g) => g.slug === slug); },

    async createGolfer({ ownerId, slug, name, domain = null }) {
      const d = load();
      if (d.golfers.some((g) => g.slug === slug)) throw new Error("duplicate slug");
      const golfer = { id: randomUUID(), owner_id: ownerId, slug, name, domain };
      d.golfers.push(golfer);
      save(d);
      return golfer;
    },

    async getDoc(golferId, key) { return load().docs[`${golferId}/${key}`] ?? null; },
    async setDoc(golferId, key, value) { const d = load(); d.docs[`${golferId}/${key}`] = value; save(d); },
    async deleteDoc(golferId, key) { const d = load(); delete d.docs[`${golferId}/${key}`]; save(d); },

    async signUp(email, password) {
      const d = load();
      email = email.toLowerCase();
      if (d.users.some((u) => u.email === email)) return { error: "User already registered" };
      const user = { id: randomUUID(), email, password: hash(password) };
      d.users.push(user);
      const session = issue(d, user);
      save(d);
      return { user: { id: user.id, email }, session };
    },

    async signIn(email, password) {
      const d = load();
      const user = d.users.find((u) => u.email === String(email).toLowerCase());
      if (!user || !check(password, user.password)) return null;
      const session = issue(d, user);
      save(d);
      return session;
    },

    async refresh(refreshToken) {
      const d = load();
      const t = d.tokens[`r:${refreshToken}`];
      const user = t && d.users.find((u) => u.id === t.userId);
      if (!user) return null;
      delete d.tokens[`r:${refreshToken}`];
      const session = issue(d, user);
      save(d);
      return session;
    },

    // The dev backend has no confirmation emails: every account is confirmed.
    async isConfirmed(userId) { return load().users.some((u) => u.id === userId); },

    async deleteAccount(userId, golferIds) {
      const d = load();
      d.users = d.users.filter((u) => u.id !== userId);
      d.golfers = d.golfers.filter((g) => g.owner_id !== userId);
      for (const k of Object.keys(d.docs)) if (golferIds.includes(k.split("/")[0])) delete d.docs[k];
      for (const [k, t] of Object.entries(d.tokens)) if (t.userId === userId) delete d.tokens[k];
      save(d);
    },

    async userFromToken(token) {
      const d = load();
      const t = d.tokens[token];
      if (!t || t.expires_at < Date.now() / 1000) return null;
      const user = d.users.find((u) => u.id === t.userId);
      return user ? { id: user.id, email: user.email } : null;
    },
  };
}
