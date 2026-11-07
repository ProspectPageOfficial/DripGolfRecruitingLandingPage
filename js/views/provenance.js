/**
 * views/provenance.js — the "where do these numbers come from" disclosure.
 *
 * Rendered as a collapsed <details> on the Fit page and as a full page at
 * #/data. Collapsed so it does not shout over the product, present so nobody
 * can demo this to an investor, a parent or a coach without the caveat being
 * one click away.
 */
import { html, raw } from "../lib/dom.js";
import { PROVENANCE, STATUS, provenanceSummary } from "../data/provenance.js";

const ESTIMATE_NOTE = html`<b>Fit scores are estimates.</b> Each program's
  roster rank is estimated from its conference and marked "est." on screen.
  School facts, SAT and tuition come from public sources. Use fit scores as a
  starting point for building a list, not as a measurement.`;

function rows() {
  return PROVENANCE.map(
    (row) => html`
      <tr>
        <td><span class="pill pill-${STATUS[row.status].tone}">${STATUS[row.status].label}</span></td>
        <td><b>${row.what}</b><br />
          <span class="muted" style="font-size:.76rem">${row.group}</span>
        </td>
        <td class="muted" style="font-size:.8rem">${row.source}</td>
      </tr>
    `
  ).join("");
}

function table() {
  return html`
    <table class="data">
      <thead><tr><th>Status</th><th>What</th><th>Where it came from</th></tr></thead>
      <tbody>${raw(rows())}</tbody>
    </table>
  `;
}

export function provenanceSummaryLine() {
  const t = provenanceSummary();
  return html`${t.real} from real sources &middot; ${t.assumption} estimates and assumptions`;
}

/** Collapsed disclosure for embedding under a results screen. */
export const provenanceDetails = () => html`
  <details class="card card-flat" style="margin-top:1.2rem">
    <summary style="cursor:pointer;font-size:.86rem;font-weight:600">
      Where do these numbers come from?
      <span class="muted" style="font-weight:400">
        &mdash; ${raw(provenanceSummaryLine())}
      </span>
    </summary>
    <div style="margin-top:1rem">
      <p style="font-size:.88rem;margin-bottom:1rem">${raw(ESTIMATE_NOTE)}</p>
      ${raw(table())}
    </div>
  </details>
`;

/** Full page at #/data. */
export const provenanceView = () => html`
  <div class="container section-tight stack">
    <div>
      <span class="eyebrow">Data sources</span>
      <h1 class="serif" style="font-size:clamp(1.9rem,4vw,2.8rem);margin:.5rem 0">
        Where our data comes from.
      </h1>
    </div>

    <p style="font-size:.92rem;max-width:62ch">${raw(ESTIMATE_NOTE)}</p>

    <div class="card">${raw(table())}</div>
  </div>
`;
