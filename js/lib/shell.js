/**
 * lib/shell.js — the chrome every screen shares: announce bar, nav, footer.
 *
 * Lives in one place so a nav change is a one-file change. The moment you
 * paste a <nav> into a second view, you have signed up for maintaining two
 * navs forever.
 */
import { html, raw, initials, isExternal, extLink } from "./dom.js";
import { PUBLIC_SITE } from "../config.js";

export function nav(user, golfer, active) {
  const links = user
    ? [
        ["#/dashboard", "Dashboard", "dashboard"],
        ["#/fit", "College Best Fit", "fit"],
        // No "Edit": this app reads the golfer's site, it does not write to it.
        [PUBLIC_SITE.url, "My Page", "profile"],
      ]
    : [
        [PUBLIC_SITE.url, "The Page", "profile"],
        ["#/login", "Sign In", "login"],
      ];

  return html`
    <div class="announce">
      Demo build <span>&mdash;</span> data lives in your browser only.
      <b>Nothing is sent anywhere.</b>
    </div>
    <div class="container">
      <nav class="nav">
        <a class="nav-brand" href="#/">
          <img src="assets/logo.png" alt="Drip Golf" />
          <span>Drip Golf</span>
        </a>
        <div class="nav-links">
          ${raw(
            links
              .map(([href, label, key]) =>
                // Detected from the href rather than flagged in the table: a
                // fourth tuple slot saying "yes this http:// link is external"
                // is a fact the href already states, and two places to state
                // one fact is one place to get it wrong.
                isExternal(href)
                  ? extLink(href, label)
                  : html`<a href="${href}" class="${key === active ? "active" : ""}">${label}</a>`
              )
              .join("")
          )}
          ${raw(
            user
              ? html`<button class="btn btn-sm btn-ghost" data-action="signout">
                    Sign out (${initials(golfer?.name ?? user.email)})
                  </button>`
              : html`<a class="btn btn-sm" href="#/login">Sign in</a>`
          )}
        </div>
      </nav>
    </div>
  `;
}

export const footer = () => html`
  <div class="container">
    <div class="footer row row-between">
      <span>Drip Golf Recruiting &mdash; recruiting page demo.</span>
      <a href="#/data" style="text-decoration:underline">
        College data is invented &mdash; see sources
      </a>
    </div>
  </div>
`;

/** Wrap a view's inner HTML in the shared chrome. */
export const page = (user, golfer, active, body) => html`
  ${raw(nav(user, golfer, active))}
  <main>${raw(body)}</main>
  ${raw(footer())}
`;
