/**
 * lib/shell.js — the chrome every screen shares: announce bar, nav, footer.
 *
 * Lives in one place so a nav change is a one-file change. The moment you
 * paste a <nav> into a second view, you have signed up for maintaining two
 * navs forever.
 */
import { html, raw, initials, isExternal, extLink } from "./dom.js";
import { PUBLIC_SITE } from "../config.js";

/**
 * `mock` is one of:
 *   false                  signed out, or the Luke demo account (`user`)
 *   true                   the sign-up demo's preview dashboard
 *   { account: "<slug>" }  a real parent account (data/account.js)
 */
export function nav(user, golfer, active, mock = false) {
  const account = mock && typeof mock === "object" ? mock.account : null;
  // Signed-out visitors get no nav links — the "FAQ", "Sign in" and "Create
  // account" buttons below are the only affordances they need. Anything else (like a "The Page" tab) is noise
  // for someone who hasn't opted in yet, and duplicating "Sign In" here would
  // just repeat the button rendered a few lines down.
  // The sign-up demo's mock dashboard gets the signed-in tabs, pointed at its
  // own routes, so the preview looks like the real thing without an account.
  const links = account
    ? [
        ["#/my", "Dashboard", "my"],
        ["#/my/fit", "College Best Fit", "my-fit"],
        ["#/my/edit", "Edit my page", "my-edit"],
      ]
    : mock
    ? [
        ["#/welcome", "Dashboard", "welcome"],
        ["#/welcome/fit", "College Best Fit", "welcome-fit"],
      ]
    : user
    ? [
        ["#/dashboard", "Dashboard", "dashboard"],
        ["#/fit", "College Best Fit", "fit"],
        // No "Edit": this app reads the golfer's site, it does not write to it.
        [PUBLIC_SITE.url, "My Page", "profile"],
      ]
    : [];

  return html`
    <!-- Was "data lives in your browser only. Nothing is sent anywhere."
         That stopped being true when Create account started saving real
         accounts, so it must not come back while sign-ups are live. -->
    <div class="announce">
      Free beta <span>&mdash;</span> College Best Fit scores are estimates.
      <a href="#/faq"><b>How they work</b></a>
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
          <!-- On every screen, signed in or not: a parent deciding whether to
               sign up is exactly who has questions. -->
          <a class="btn btn-sm btn-ghost${active === "faq" ? " active" : ""}" href="#/faq">FAQ</a>
          ${raw(
            account
              ? html`<button class="btn btn-sm btn-ghost" data-action="account-signout">
                    Sign out (${initials(golfer?.name)})
                  </button>`
              : mock
              ? html`<a class="btn btn-sm btn-ghost" href="#/signup">
                    Exit preview (${initials(golfer?.name)})
                  </a>`
              : user
              ? html`<button class="btn btn-sm btn-ghost" data-action="signout">
                    Sign out (${initials(golfer?.name ?? user.email)})
                  </button>`
              : html`<a class="btn btn-sm" href="#/login">Sign in</a>
                  <a class="btn btn-sm btn-ghost" href="#/signup">Create account</a>`
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
      <span class="row">
        <a href="#/faq" style="text-decoration:underline">FAQ</a>
        <a href="#/terms" style="text-decoration:underline">Terms</a>
        <a href="#/privacy" style="text-decoration:underline">Privacy</a>
        <a href="#/data" style="text-decoration:underline">
          Roster ranks are estimates &mdash; see sources
        </a>
      </span>
    </div>
  </div>
`;

/** Wrap a view's inner HTML in the shared chrome. */
export const page = (user, golfer, active, body, mock = false) => html`
  ${raw(nav(user, golfer, active, mock))}
  <main>${raw(body)}</main>
  ${raw(footer())}
`;
