/**
 * Production backend: Supabase Postgres + Supabase Auth.
 *
 * Uses the SERVICE ROLE key, which bypasses Row Level Security, so this file
 * must only ever run server-side (Netlify Functions). The tables have RLS on
 * with no policies at all -- nobody holding the public key can read or write
 * them directly; every access goes through a function that has already
 * checked who is asking. See supabase/schema.sql.
 */
import { createClient } from "@supabase/supabase-js";

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } };

const toSession = (s) =>
  s && {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    user: { id: s.user.id, email: s.user.email },
  };

export function supabaseDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(url, key, NO_PERSIST);
  // Sign-in calls get a throwaway client each, so one golfer's session can
  // never linger in a warm function instance and leak into the next request.
  const fresh = () => createClient(url, key, NO_PERSIST);

  const one = async (query) => {
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    getGolferBySlug: (slug) => one(admin.from("golfers").select("*").eq("slug", slug)),
    getGolferByDomain: (host) => one(admin.from("golfers").select("*").eq("domain", host)),

    async getGolfersByOwner(ownerId) {
      const { data, error } = await admin.from("golfers").select("*").eq("owner_id", ownerId).order("created_at");
      if (error) throw new Error(error.message);
      return data || [];
    },

    async slugTaken(slug) {
      return !!(await one(admin.from("golfers").select("id").eq("slug", slug)));
    },

    async createGolfer({ ownerId, slug, name, domain = null }) {
      const { data, error } = await admin
        .from("golfers")
        .insert({ owner_id: ownerId, slug, name, domain })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async getDoc(golferId, key) {
      const row = await one(admin.from("golfer_docs").select("value").eq("golfer_id", golferId).eq("key", key));
      return row ? row.value : null;
    },

    async setDoc(golferId, key, value) {
      const { error } = await admin
        .from("golfer_docs")
        .upsert({ golfer_id: golferId, key, value, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },

    async deleteDoc(golferId, key) {
      const { error } = await admin.from("golfer_docs").delete().eq("golfer_id", golferId).eq("key", key);
      if (error) throw new Error(error.message);
    },

    async signUp(email, password) {
      // auth.signUp, not admin.createUser: it honours the project's
      // "Confirm email" setting, so an address has to be real before it can
      // sign in. With confirmation on, `session` comes back null.
      const { data, error } = await fresh().auth.signUp({ email, password });
      if (error) return { error: error.message };
      // With "Confirm email" on, Supabase answers a sign-up for an address
      // that already has an account with a look-alike user and no
      // identities, rather than an error (so addresses can't be probed).
      // Creating a page for that user would fail; say so plainly instead.
      if (!data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
        return { error: "An account with this email already exists. Sign in instead." };
      }
      return { user: { id: data.user.id, email: data.user.email }, session: toSession(data.session) };
    },

    async signIn(email, password) {
      const { data, error } = await fresh().auth.signInWithPassword({ email, password });
      return error ? null : toSession(data.session);
    },

    async refresh(refreshToken) {
      const { data, error } = await fresh().auth.refreshSession({ refresh_token: refreshToken });
      return error ? null : toSession(data.session);
    },

    async isConfirmed(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return !error && !!data?.user?.email_confirmed_at;
    },

    async deleteAccount(userId, golferIds) {
      // Uploaded files first: they live under <golfer id>/ in each bucket and
      // nothing in Postgres cascades into Storage.
      for (const bucket of ["golfer-videos", "golfer-photos"]) {
        for (const gid of golferIds) {
          const { data, error } = await admin.storage.from(bucket).list(gid, { limit: 1000 });
          if (error) throw new Error(error.message);
          const paths = (data || []).map((f) => `${gid}/${f.name}`);
          if (paths.length) {
            const { error: rmError } = await admin.storage.from(bucket).remove(paths);
            if (rmError) throw new Error(rmError.message);
          }
        }
      }
      // golfers -> golfer_docs cascade. Deleting the user would cascade to
      // golfers too; doing it explicitly keeps this right if that key changes.
      const { error } = await admin.from("golfers").delete().eq("owner_id", userId);
      if (error) throw new Error(error.message);
      const { error: authError } = await admin.auth.admin.deleteUser(userId);
      if (authError) throw new Error(authError.message);
    },

    async userFromToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
    },
  };
}
