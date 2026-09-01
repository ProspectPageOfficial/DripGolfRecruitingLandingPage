/**
 * views/provenance.js — the "where do these numbers come from" disclosure.
 *
 * Rendered as a collapsed <details> on the Fit page and as a full page at
 * #/data. Collapsed so it does not shout over the product, present so nobody
 * can demo this to an investor, a parent or a coach without the caveat being
 * one click away.
 */
import { html, raw, extLink } from "../lib/dom.js";
import { PROVENANCE, STATUS, provenanceSummary } from "../data/provenance.js";
import { PUBLIC_SITE } from "../config.js";

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
  return html`${t.real} real &middot; ${t.fabricated} invented &middot; ${t.assumption} assumptions`;
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
      <div class="alert alert-error" style="margin-bottom:1rem">
        <b>Every college statistic in this demo is invented.</b> School names are
        real; the numbers attached to them are not. Do not show these figures to
        a golfer, a parent or a coach as though they were researched.
      </div>
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
        What is real, and what is not.
      </h1>
      <p class="muted" style="font-size:.92rem;max-width:62ch">
        Nobody who built this demo is a golf recruiting expert, so the software
        states its own sources rather than relying on someone to spot a wrong
        number. ${raw(provenanceSummaryLine())}.
      </p>
    </div>

    <div class="alert alert-error">
      <b>Not shippable as-is.</b> The entire college database is fabricated.
      Replacing it is the single largest task between this demo and a product
      anyone should pay for.
    </div>

    <div class="card">${raw(table())}</div>

    <div class="card stack-sm">
      <span class="eyebrow">The one thing here that is not a demo</span>
      <p style="font-size:.9rem">
        The public recruiting page is real, deployed and independent of this
        app &mdash; its own repo, its own domain. Every "My Page" link in this
        interface opens it directly rather than a local imitation, so what you
        see is what a coach sees.
      </p>
      <div class="row">
        ${raw(extLink(PUBLIC_SITE.url, PUBLIC_SITE.host, "btn btn-sm"))}
        ${raw(extLink(PUBLIC_SITE.repo, "Source on GitHub", "btn btn-sm btn-ghost"))}
      </div>
    </div>

    <div class="card stack-sm">
      <span class="eyebrow">How to replace the invented data</span>
      <p style="font-size:.9rem">
        Two of the three sources below are free and citable, and none of them
        require you to know anything about golf &mdash; they are lookups, not
        judgement calls.
      </p>
      <table class="data">
        <thead><tr><th>Data</th><th>Source</th><th>Cost</th></tr></thead>
        <tbody>
          <tr>
            <td><b>GPA, SAT, tuition, acceptance rate</b></td>
            <td>IPEDS / College Scorecard &mdash; US Dept. of Education, bulk CSV + API</td>
            <td class="muted">Free</td>
          </tr>
          <tr>
            <td><b>Team scoring averages</b></td>
            <td>Golfstat or Clippd college team season stats</td>
            <td class="muted">Licensed</td>
          </tr>
          <tr>
            <td><b>Typical recruit rank</b></td>
            <td>Junior Golf Scoreboard / AJGA ranks of golfers who actually signed</td>
            <td class="muted">Licensed</td>
          </tr>
        </tbody>
      </table>
      <p class="field-hint">
        The scoring engine does not change when the data becomes real. That is
        the entire reason lib/fit.js is a pure function with no data baked into it.
      </p>
    </div>
  </div>
`;
