/**
 * tests/cases.js — every case, runner-agnostic.
 *
 * Each case receives a minimal `assert` object with ok/equal/notEqual/deepEqual.
 * That tiny interface is the only thing a runner must provide, so the SAME
 * cases execute under node:test (CI) and in the browser (this machine has no
 * Node installed). Writing them twice would guarantee the two copies disagree
 * within a month.
 *
 * Split in two because the file crossed 600 lines, and because the halves
 * genuinely answer different questions: cases-data.js asks "is this number
 * real?", cases-fit.js asks "is this number computed correctly?". A case can
 * fail in one file without implicating the other.
 */
import { dataCases } from "./cases-data.js";
import { fitCases } from "./cases-fit.js";

export const cases = [...dataCases, ...fitCases];
