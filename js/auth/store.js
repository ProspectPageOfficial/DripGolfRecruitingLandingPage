/**
 * auth/store.js — the demo authentication adapter.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LOOKS THE WAY IT DOES
 * ---------------------------------------------------------------------------
 * The method names below are deliberately identical to Supabase Auth's:
 *
 *     signInWithPassword({ email, password })
 *     signOut()
 *     getUser()
 *     onAuthStateChange(cb)
 *
 * There is no signUp(). This is one golfer's recruiting site, not a platform
 * anyone can join -- the owner account is provisioned, not self-served. An
 * unreachable sign-up path is just a second door to guard for no benefit.
 *
 * ...and every method returns Supabase's `{ data, error }` envelope.
 *
 * That's the Dependency Inversion Principle doing real work: the rest of the
 * app depends on this *shape*, never on localStorage. When you swap in the real
 * thing, you delete the guts of this file, drop in
 *
 *     import { createClient } from "@supabase/supabase-js";
 *     export const auth = createClient(URL, ANON_KEY).auth;
 *
 * ...and not a single view file changes.
 *
 * ---------------------------------------------------------------------------
 *   THIS IS A DEMO. IT IS NOT SECURE. 
 * ---------------------------------------------------------------------------
 * Passwords are hashed with SHA-256 purely so the demo doesn't display
 * plaintext in devtools. SHA-256 is FAST, which is exactly wrong for passwords
 * — a GPU chews through billions per second. Real auth needs bcrypt/argon2 on a
 * SERVER. Everything here is client-side and trivially bypassed by anyone who
 * opens the console. That is fine for a clickable demo and catastrophic in
 * production. Ship Supabase, not this.
 */

const USERS_KEY = "dg.demo.users";
const SESSION_KEY = "dg.demo.session";

// --- tiny storage helpers ---------------------------------------------------

/**
 * One accessor, two backings. Written as a factory rather than two near-copies
 * of the same try/catch, because the only thing that differs is *how long the
 * data should outlive the visitor*.
 */
const storeFor = (backing) => ({
  read(key, fallback) {
    try {
      return JSON.parse(backing.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    backing.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    backing.removeItem(key);
  },
});

/**
 * The account outlives the visit; the session must not.
 *
 * `users` is localStorage because the provisioned owner account is a fact about
 * this browser, not about this visit -- re-seeding it on every load would be
 * pointless churn.
 *
 * `sessions` is sessionStorage because SIGNED OUT IS THE DEFAULT. This is the
 * front door of a public site: the first thing a stranger sees must be the
 * landing page and the pricing, never somebody else's dashboard. A session in
 * localStorage survives closing the browser, so a single sign-in three weeks
 * ago silently turns the marketing page into a private cockpit forever.
 *
 * sessionStorage is scoped to the tab, which lands exactly where we want: a
 * refresh mid-session keeps you signed in (reloading is not logging out), while
 * a new visitor, a new tab, or a reopened browser all start signed out.
 */
const users = storeFor(localStorage);
const sessions = storeFor(sessionStorage);

const ok = (data) => ({ data, error: null });
const fail = (message) => ({ data: null, error: { message } });

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

/** Demo-grade digest. See the shouty warning above. */
async function digest(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- subscribers ------------------------------------------------------------

const listeners = new Set();
const emit = (event, session) => listeners.forEach((cb) => cb(event, session));

// --- the adapter ------------------------------------------------------------

export const auth = {
  /** Mirrors supabase.auth.signInWithPassword. */
  async signInWithPassword({ email, password }) {
    const mail = normalizeEmail(email);
    const user = users.read(USERS_KEY, {})[mail];

    // Same error message for "no such user" and "wrong password" on purpose —
    // otherwise the login form doubles as an account-enumeration oracle.
    const wrong = fail("Invalid email or password.");
    if (!user) return wrong;
    if ((await digest(password)) !== user.password_hash) return wrong;

    return this._startSession(user);
  },

  async signOut() {
    sessions.remove(SESSION_KEY);
    emit("SIGNED_OUT", null);
    return { error: null };
  },

  /** Mirrors supabase.auth.getUser() — always `{ data: { user }, error }`. */
  async getUser() {
    const session = sessions.read(SESSION_KEY, null);
    if (!session) return { data: { user: null }, error: null };
    if (Date.now() > session.expires_at) {
      await this.signOut();
      return { data: { user: null }, error: null };
    }
    const user = users.read(USERS_KEY, {})[session.email];
    if (!user) {
      await this.signOut();
      return { data: { user: null }, error: null };
    }
    return { data: { user: publicUser(user) }, error: null };
  },

  /** Mirrors supabase.auth.onAuthStateChange — returns an unsubscribe handle. */
  onAuthStateChange(callback) {
    listeners.add(callback);
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },

  /**
   * Update the signed-in user's metadata. Mirrors supabase.auth.updateUser.
   * NOTE for the real build: `user_metadata` is user-writable, so it must
   * never hold anything privileged (is_admin, subscription_tier, verified).
   * Those belong in a `golfer` column guarded by RLS.
   */
  async updateUser({ meta }) {
    const { data } = await this.getUser();
    if (!data.user) return fail("Not signed in.");
    const table = users.read(USERS_KEY, {});
    const record = table[data.user.email];
    record.user_metadata = { ...record.user_metadata, ...meta };
    users.write(USERS_KEY, table);
    emit("USER_UPDATED", null);
    return ok({ user: publicUser(record) });
  },

  _startSession(user) {
    const session = {
      email: user.email,
      // A second, independent guard. sessionStorage already ends the session
      // when the tab does, but "restore my tabs" can resurrect one, so an
      // absolute deadline still earns its keep. A real session cookie would be
      // HttpOnly + Secure + SameSite, which web storage fundamentally cannot
      // be. Another reason this is a demo.
      expires_at: Date.now() + 12 * 60 * 60 * 1000,
    };
    sessions.write(SESSION_KEY, session);
    const safe = publicUser(user);
    emit("SIGNED_IN", session);
    return ok({ user: safe, session });
  },
};

/** Strip the hash before anything outside this module sees a user. */
function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Provision the owner account so the reviewer can log straight in. Idempotent.
 *
 * The user id is the golfer record id rather than a random uuid: in production
 * the `golfer` row is keyed by `auth.users(id)`, so the two ids being equal is
 * the schema, not a demo convenience.
 *
 * This writes the store as a map containing EXACTLY ONE entry, rather than
 * merging the owner into whatever was already there. That is deliberate: the
 * old multi-golfer build left other accounts in this key, and every one of them
 * could still sign in and edit the owner's record. "There is one account" has
 * to be enforced by the write, not assumed by the reader -- an invariant you
 * only hope for is not an invariant.
 *
 * The map shape stays because Supabase's `auth.users` genuinely IS a table; we
 * simply never have a second row in it.
 */
export async function seedOwnerAccount({ email, password, golferId, name }) {
  const mail = normalizeEmail(email);
  const existing = users.read(USERS_KEY, {});
  const keys = Object.keys(existing);
  if (keys.length === 1 && existing[mail]?.id === golferId) return;

  // Anything else in here is a leftover. Dropping it also invalidates its
  // session for free -- getUser() signs out any session whose email is gone.
  users.write(USERS_KEY, {
    [mail]: {
      id: golferId,
      email: mail,
      created_at: existing[mail]?.created_at ?? new Date().toISOString(),
      password_hash: await digest(password),
      user_metadata: { name },
    },
  });
}
