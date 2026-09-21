/**
 * tests/setup.js — Node-side polyfills for browser globals the modules touch
 * at import time.
 *
 * The app runs in a browser and reaches for `localStorage`, `sessionStorage`
 * and `crypto.subtle` at module init. In Node those are undefined, so a
 * Node-side test that so much as imports `auth/store.js` explodes before a
 * single case runs.
 *
 * The fix is not to make production code Node-aware -- it is browser code and
 * it should stay browser code. It is to hand Node minimal shims that behave
 * enough like the real thing to let a module import cleanly. Anything trying
 * to actually SIGN IN inside a test still needs real crypto; that is fine,
 * the sign-in flow is exercised in the browser runner, not here.
 *
 * MUST be imported before any app module that touches these globals. The
 * entry point (fit.test.mjs) imports it first for that reason.
 */

/** Tiny in-memory Storage. Enough to satisfy get/set/remove/clear. */
class MemoryStorage {
  #data = new Map();
  get length() { return this.#data.size; }
  key(i) { return [...this.#data.keys()][i] ?? null; }
  getItem(k) { return this.#data.has(k) ? this.#data.get(k) : null; }
  setItem(k, v) { this.#data.set(String(k), String(v)); }
  removeItem(k) { this.#data.delete(k); }
  clear() { this.#data.clear(); }
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = new MemoryStorage();
}
if (typeof globalThis.sessionStorage === "undefined") {
  globalThis.sessionStorage = new MemoryStorage();
}

// Node 20+ exposes `crypto.subtle` via `node:crypto` webcrypto. Bind it onto
// globalThis if the code expects a plain global `crypto` (which browsers give
// for free).
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  globalThis.crypto = webcrypto;
}
