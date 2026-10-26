/**
 * lib/mypage.js — getting a parent from this app to their golfer's page,
 * already signed in.
 *
 * The golfer page (golfer.html + assets/golfer/tenant.js) keeps its session
 * in sessionStorage under per-golfer keys. Both pages are on this same
 * origin and the hand-off happens in the same tab, so writing those keys
 * here and then navigating is all "signed in" takes. The key names must
 * match tenant.js and the OwnerGate in golfer.html.
 */

/** Sign-in from the homepage, or the confirmation-email link. */
export async function findMyPage({ email, password, accessToken, refreshToken, expiresAt } = {}) {
  let res;
  try {
    res = await fetch("/api/my-page", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(accessToken ? { refresh_token: refreshToken, expires_at: expiresAt } : { email, password }),
    });
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again." };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error || "Sign-in failed. Please try again.", status: res.status };
  return { slug: body.slug, session: body.session };
}

/** Hand the session to the golfer page and go there in owner (edit) mode. */
export function openMyPage(slug, session) {
  try {
    sessionStorage.setItem(`dg_session:${slug}`, JSON.stringify(session));
    sessionStorage.setItem(`dg_role:${slug}`, "owner");
  } catch {
    /* storage blocked: the page opens and asks them to sign in there */
  }
  location.href = `/${slug}`;
}

/** One-time message for the sign-in screen (e.g. an expired email link). */
export const AUTH_NOTICE_KEY = "dg.auth.notice";
