/**
 * config.js — demo constants that would become env vars in the real build.
 *
 * When this becomes a Supabase app, SUPABASE_URL and SUPABASE_ANON_KEY land
 * here too. The anon key is genuinely safe to ship in the bundle -- it is a
 * public identifier, and Row Level Security is what actually protects the
 * data. The SERVICE ROLE key is the one that must never leave a server.
 */

/**
 * The owner account. Singular, because this is one golfer's recruiting site.
 * `golferId` must match the seeded golfer record id, or signing in would land
 * on an empty page.
 */
export const DEMO_LOGIN = Object.freeze({
  email: "luke@dripgolf.demo",
  password: "dripgolf2026",
  golferId: "luke",
  name: "Luke Thomas Selzer",
  note: "real published stats, age 13 - athletic fit only",
});

export const APP_NAME = "Drip Golf Recruiting";

/**
 * Where college logos come from.
 *
 * A favicon lookup, not an image we drew: the school publishes this mark about
 * itself, so rendering it is quotation rather than trademark invention. That
 * distinction is why logos are allowed here at all -- see lib/thumbs.js.
 *
 * One template in one place, because the day this needs an API key or a
 * self-hosted mirror should be a one-line change, not a hunt through views.
 * Every request is a third party learning a school was looked at, which is why
 * the <img> that uses this sets `referrerpolicy="no-referrer"`.
 */
export const logoUrl = (domain, size = 128) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

/**
 * The golfer's public recruiting page.
 *
 * This is a SEPARATE, already-deployed site -- its own repo, its own Netlify
 * project, its own domain. This app is the private cockpit (edit, dashboard,
 * College Best Fit); that site is the thing you actually send to a coach.
 *
 * Keeping them apart is the point rather than an accident: a coach opening a
 * recruiting link must never be one click from an editor, and the public page
 * has to stay up even while this app is mid-deploy.
 *
 * `host` exists so the UI can print a clean domain without three call sites
 * each inventing their own way to strip "https://". One fact, one place --
 * change the domain here and the nav, the preview caption and the landing copy
 * all follow.
 */
export const PUBLIC_SITE = Object.freeze({
  url: "https://lukethomasselzer.com",
  host: "lukethomasselzer.com",
  repo: "https://github.com/ProspectPageOfficial/LukeThomasSelzer.com",
});
