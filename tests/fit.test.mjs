/**
 * tests/fit.test.mjs — Node runner. `npm test` (needs Node 18+).
 *
 * Thin adapter: it owns zero assertions of its own, it just hands node:assert
 * to the shared cases. The browser runner at tests/runner.html does the same
 * job with a hand-rolled assert.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { cases } from "./cases.js";

for (const c of cases) {
  test(c.name, () => c.run(assert));
}
