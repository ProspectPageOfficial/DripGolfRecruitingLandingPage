/**
 * tests/cases.js — every case, runner-agnostic.
 *
 * Each case receives a minimal `assert` object with ok/equal/notEqual/deepEqual.
 * That tiny interface is the only thing a runner must provide, so the SAME
 * cases execute under node:test (CI) and in the browser (this machine has no
 * Node installed). Writing them twice would guarantee the two copies disagree
 * within a month.
 *
 * Split into files because they answer different questions:
 *   cases-data.js  "is this number real?"
 *   cases-fit.js   "is this number computed correctly?"
 *   cases-views.js "does the screen actually render at all?"
 * A case can fail in one file without implicating the others.
 */
import { dataCases } from "./cases-data.js";
import { fitCases } from "./cases-fit.js";
import { viewCases } from "./cases-views.js";

export const cases = [...dataCases, ...fitCases, ...viewCases];
