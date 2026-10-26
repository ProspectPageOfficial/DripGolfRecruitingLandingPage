/**
 * views/auth.js — sign in.
 *
 * Two kinds of sign-in share this form:
 *   - the demo account (Luke) -- browser-only, opens the demo dashboard
 *   - a real parent account (made by the sign-up survey) -- checked by
 *     /api/my-page, then the parent lands on their golfer's page, signed in
 *     and ready to edit (lib/mypage.js)
 */
import { html, raw, formData, extLink } from "../lib/dom.js";
import { auth } from "../auth/store.js";
import { DEMO_LOGIN, PUBLIC_SITE } from "../config.js";
import { findMyPage, openMyPage, AUTH_NOTICE_KEY } from "../lib/mypage.js";

/** A one-time message left by the confirmation-email link (main.js). */
function takeNotice() {
  try {
    const text = sessionStorage.getItem(AUTH_NOTICE_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return text;
  } catch {
    return null;
  }
}

export function authView() {
  const notice = takeNotice();
  return html`
    <div class="container auth-wrap">
      <div class="card auth-card stack">
        <div>
          <span class="eyebrow">Welcome back</span>
          <h1 class="serif" style="margin-top:.5rem">Sign in.</h1>
          <p class="muted" style="font-size:.88rem">
            Parents: use the email and password you signed up with. You'll go
            straight to your golfer's page, ready to edit.
          </p>
        </div>

        <div id="auth-msg">${raw(notice ? html`<div class="alert alert-ok">${notice}</div>` : "")}</div>

        <form id="auth-form" class="stack-sm" novalidate>
          <div class="field">
            <label for="f-email">Email</label>
            <input id="f-email" name="email" type="email" autocomplete="email"
                   required placeholder="you@example.com" />
          </div>
          <div class="field">
            <label for="f-password">Password</label>
            <input id="f-password" name="password" type="password" required
                   autocomplete="current-password"
                   placeholder="At least 8 characters" />
          </div>
          <button class="btn btn-block" type="submit" style="margin-top:.5rem">
            Sign in
          </button>
        </form>

        <a class="btn btn-ghost btn-block" href="#/signup">Create account</a>

        <div class="demo-hint stack-sm">
          <b>Demo login</b> &mdash; click to fill the form.
          <button class="btn btn-sm btn-ghost btn-block" type="button"
                  data-fill="${DEMO_LOGIN.email}" data-pw="${DEMO_LOGIN.password}"
                  style="justify-content:flex-start;text-align:left">
            ${DEMO_LOGIN.name} &mdash; ${DEMO_LOGIN.note}
          </button>
          <span>Nothing leaves this browser.</span>
        </div>

        <p class="auth-switch center">
          Coaches do not need an account &mdash;
          ${raw(extLink(PUBLIC_SITE.url, "view the public page"))}.
        </p>
      </div>
    </div>
  `;
}

/** Wire the form up after the view is in the DOM. */
export function bindAuth(root, { onDone }) {
  const form = root.querySelector("#auth-form");
  const msg = root.querySelector("#auth-msg");

  // Convenience only. Real credentials would never be one click from a form.
  root.querySelector("[data-fill]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    root.querySelector("#f-email").value = btn.dataset.fill;
    root.querySelector("#f-password").value = btn.dataset.pw;
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    msg.innerHTML = "";

    const { email, password } = formData(form);

    // The demo account lives only in this browser; everyone else is real.
    if (email.trim().toLowerCase() === DEMO_LOGIN.email) {
      const { data, error } = await auth.signInWithPassword({ email, password });
      if (error) {
        msg.innerHTML = html`<div class="alert alert-error">${error.message}</div>`;
        button.disabled = false;
        return;
      }
      onDone(data.user);
      return;
    }

    const found = await findMyPage({ email, password });
    if (found.slug) return openMyPage(found.slug, found.session);
    msg.innerHTML = html`<div class="alert alert-error">${found.error}</div>`;
    button.disabled = false;
  });
}
