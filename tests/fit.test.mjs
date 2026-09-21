/**
 * tests/fit.test.mjs — Node runner. `npm test` (needs Node 18+).
 *
 * Thin adapter: it owns zero assertions of its own, it just hands node:assert
 * to the shared cases. The browser runner at tests/runner.html does the same
 * job with a hand-rolled assert.
 *
 * `setup.js` is imported FIRST so its polyfills (localStorage, sessionStorage,
 * crypto) are on globalThis before any app module runs its top-level code.
 */
import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { cases } from "./cases.js";

for (const c of cases) {
  test(c.name, () => c.run(assert));
}
