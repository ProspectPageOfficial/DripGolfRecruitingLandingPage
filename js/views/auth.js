/**
 * views/auth.js — sign in.
 *
 * Two kinds of sign-in share this form:
 *   - the demo account (Luke) -- browser-only, opens the demo dashboard
 *   - a real parent account (made by the sign-up survey) -- checked by
 *     /api/my-page, then the parent lands on their dashboard (#/my), with
 *     "Edit my page" one click away (data/account.js, lib/mypage.js)
 */
import { html, raw, formData } from "../lib/dom.js";
import { auth } from "../auth/store.js";
import { DEMO_LOGIN } from "../config.js";
import { findMyPage, AUTH_NOTICE_KEY, RESET_KEY } from "../lib/mypage.js";
import { saveAccount } from "../data/account.js";

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
            <a class="field-hint auth-forgot" href="#/forgot">Forgot password?</a>
          </div>
          <button class="btn btn-block" type="submit" style="margin-top:.5rem">
            Sign in
          </button>
        </form>

        <a class="btn btn-ghost btn-block" href="#/signup">Create account</a>

        <p class="auth-switch center">Coaches do not need an account.</p>
      </div>
    </div>
  `;
}

/** Wire the form up after the view is in the DOM. */
export function bindAuth(root, { onDone }) {
  const form = root.querySelector("#auth-form");
  const msg = root.querySelector("#auth-msg");

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
    if (found.slug) {
      saveAccount(found.slug, found.session);
      location.hash = "#/my";
      return;
    }
    msg.innerHTML = html`<div class="alert alert-error">${found.error}</div>`;
    button.disabled = false;
  });
}

// ---------------------------------------------------------------------------
// Forgot password (#/forgot) and choosing a new one (#/reset-password)
// ---------------------------------------------------------------------------

/** Ask for the account email; /api/password-reset emails a link. */
export function forgotView() {
  return html`
    <div class="container auth-wrap">
      <div class="card auth-card stack">
        <div>
          <span class="eyebrow">Forgot password</span>
          <h1 class="serif" style="margin-top:.5rem">Reset your password.</h1>
          <p class="muted" style="font-size:.9rem">
            Enter the email you signed up with and we'll send you a link to
            choose a new password.
          </p>
        </div>
        <div id="forgot-msg" aria-live="polite"></div>
        <form id="forgot-form" class="stack-sm" novalidate>
          <div class="field">
            <label for="fp-email">Email</label>
            <input id="fp-email" name="email" type="email" autocomplete="email"
                   required placeholder="you@example.com" />
          </div>
          <button class="btn btn-block" type="submit" style="margin-top:.5rem">Email me a reset link</button>
        </form>
        <p class="auth-switch center"><a href="#/login">Back to sign in</a></p>
      </div>
    </div>
  `;
}

export function bindForgot(root) {
  const form = root.querySelector("#forgot-form");
  const msg = root.querySelector("#forgot-msg");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      msg.innerHTML = html`<div class="alert alert-error">Enter a valid email address.</div>`;
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    msg.innerHTML = "";
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg.innerHTML = html`<div class="alert alert-error">${body.error || "Something went wrong. Please try again."}</div>`;
        button.disabled = false;
        return;
      }
      form.remove(); // done with it; .stack-sm's display would override `hidden`
      msg.innerHTML = html`<div class="alert alert-ok">
        If an account uses ${email}, we've emailed it a link to reset the
        password. It can take a few minutes, so check your spam folder too.
        The link works once and expires after an hour.</div>`;
    } catch {
      msg.innerHTML = html`<div class="alert alert-error">Couldn't reach the server. Check your connection and try again.</div>`;
      button.disabled = false;
    }
  });
}

const resetToken = () => {
  try { return JSON.parse(sessionStorage.getItem(RESET_KEY) || "null")?.access_token || null; }
  catch { return null; }
};

/** Choose a new password, using the recovery token main.js kept from the link. */
export function resetView() {
  if (!resetToken()) {
    return html`
      <div class="container auth-wrap">
        <div class="card auth-card stack">
          <div>
            <span class="eyebrow">New password</span>
            <h1 class="serif" style="margin-top:.5rem">Open your reset link.</h1>
            <p class="muted" style="font-size:.9rem">
              To choose a new password, open the link in your reset email. If
              it has expired, request a new one.
            </p>
          </div>
          <a class="btn btn-block" href="#/forgot">Email me a new link</a>
          <p class="auth-switch center"><a href="#/login">Back to sign in</a></p>
        </div>
      </div>
    `;
  }
  return html`
    <div class="container auth-wrap">
      <div class="card auth-card stack">
        <div>
          <span class="eyebrow">New password</span>
          <h1 class="serif" style="margin-top:.5rem">Choose a new password.</h1>
        </div>
        <div id="reset-msg" aria-live="polite"></div>
        <form id="reset-form" class="stack-sm" novalidate>
          <div class="field">
            <label for="rp-password">New password</label>
            <input id="rp-password" name="password" type="password" autocomplete="new-password"
                   required minlength="8" placeholder="At least 8 characters" />
          </div>
          <div class="field">
            <label for="rp-confirm">Type it again</label>
            <input id="rp-confirm" name="confirm" type="password" autocomplete="new-password" required />
          </div>
          <button class="btn btn-block" type="submit" style="margin-top:.5rem">Save new password</button>
        </form>
      </div>
    </div>
  `;
}

export function bindReset(root) {
  const form = root.querySelector("#reset-form");
  const msg = root.querySelector("#reset-msg");
  const say = (text) => { msg.innerHTML = html`<div class="alert alert-error">${text}</div>`; };
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { password, confirm } = formData(form);
    if (password.length < 8) return say("Password must be at least 8 characters.");
    if (password !== confirm) return say("The two passwords don't match.");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    msg.innerHTML = "";
    try {
      const res = await fetch("/api/password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resetToken()}` },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          sessionStorage.removeItem(RESET_KEY);
          sessionStorage.setItem(AUTH_NOTICE_KEY, "Your password is updated. Sign in with your new password.");
        } catch { /* storage blocked: the sign-in page just shows no notice */ }
        location.hash = "#/login";
        return;
      }
      if (res.status === 401) {
        try { sessionStorage.removeItem(RESET_KEY); } catch { /* fine */ }
        msg.innerHTML = html`<div class="alert alert-error">${body.error}
          <a href="#/forgot">Email me a new link</a>.</div>`;
        form.remove();
        return;
      }
      say(body.error || "Couldn't save the new password. Please try again.");
    } catch {
      say("Couldn't reach the server. Check your connection and try again.");
    }
    button.disabled = false;
  });
}
