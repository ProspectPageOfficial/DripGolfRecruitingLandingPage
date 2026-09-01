/**
 * views/auth.js — sign in.
 *
 * That is the whole surface. There is no sign-up mode and no mode toggle,
 * because there is no second golfer to sign up: the owner account is
 * provisioned, everyone else is a coach who only ever reads the public page.
 */
import { html, raw, formData, extLink } from "../lib/dom.js";
import { auth } from "../auth/store.js";
import { DEMO_LOGIN, PUBLIC_SITE } from "../config.js";

export function authView() {
  return html`
    <div class="container auth-wrap">
      <div class="card auth-card stack">
        <div>
          <span class="eyebrow">Welcome back</span>
          <h1 class="serif" style="margin-top:.5rem">Sign in.</h1>
          <p class="muted" style="font-size:.88rem">
            Your numbers, your page, your fit scores. Pick up where you left off.
          </p>
        </div>

        <div id="auth-msg"></div>

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
    const { data, error } = await auth.signInWithPassword({ email, password });

    if (error) {
      msg.innerHTML = html`<div class="alert alert-error">${error.message}</div>`;
      button.disabled = false;
      return;
    }

    onDone(data.user);
  });
}
