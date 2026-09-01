/**
 * lib/thumbs.js — the visual vocabulary of the "dual" dashboard.
 *
 * Two thumbnail types, defined once so the dashboard and the Fit screen cannot
 * drift into looking like two different products:
 *
 *   schoolLogo()   — a program's real logo, with a monogram underneath it
 *   sitePreview()  — a live, scaled-down frame of the golfer's real public site
 *
 * ---------------------------------------------------------------------------
 * LOGOS, AND THE LINE THIS FILE WILL NOT CROSS
 * ---------------------------------------------------------------------------
 * These are real schools, so we never DRAW a crest for one -- inventing a
 * trademark to decorate fabricated statistics is how a demo becomes a legal
 * problem. What we do instead is fetch the favicon the institution already
 * publishes on its own domain. That is quotation, not fabrication.
 *
 * Every logo therefore has a guaranteed fallback: the monogram underneath it.
 * Roughly one school in seven serves a blank placeholder icon or none at all,
 * so the fallback is a NORMAL code path, not an error case. If the image 404s,
 * is blocked, or the reviewer is offline, the <img> deletes itself and the
 * monogram shows through. A logo slot must never render as an empty grey box.
 *
 * The monogram is tinted by FIT TIER rather than by a per-school colour hashed
 * out of the name. Two reasons, and the second is the important one:
 *
 *   1. tokens.css forbids raw hex outside itself. A generated palette would
 *      smuggle colour decisions into JavaScript, which is exactly the drift
 *      that rule exists to stop.
 *   2. A random colour per school carries NO information. Tier colour means the
 *      thumbnail is readable at a glance -- a wall of sage is good news, a wall
 *      of rust is not. Decoration that encodes nothing is just noise.
 */
import { html, raw } from "./dom.js";
import { logoUrl } from "../config.js";

/**
 * Words that identify nothing. "University of Texas" and "Texas" should not
 * produce different monograms, because to a reader they are the same school.
 * "State" is deliberately NOT here: it distinguishes Oklahoma State from
 * Oklahoma City, and Kent State from Kent.
 */
const GENERIC_WORDS = new Set(["university", "college", "of", "the", "at", "and", "&"]);

/**
 * "Oklahoma State University" -> "OS", "Stanford University" -> "ST".
 *
 * Not reusing dom.js `initials()`: that takes one letter per word, so every
 * single-word school ("Stanford", "Furman", "Emory") would collapse to a lonely
 * letter in a 44px box. Different problem, different function.
 */
export function monogramText(name) {
  const words = String(name || "")
    .split(/\s+/)
    .filter((word) => word && !GENERIC_WORDS.has(word.toLowerCase()));

  if (!words.length) return "?";
  const text = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map((w) => w[0]).join("");
  return text.toUpperCase();
}

/** The tinted square itself. Exported so the Fit screen can use it inline. */
export const monogram = (name, tier = "target") => html`
  <span class="monogram monogram-${tier}" aria-hidden="true">${monogramText(name)}</span>
`;

/**
 * The school's own logo, layered OVER its monogram.
 *
 * The monogram is always rendered; the image sits on top and hides it. When the
 * image fails it removes itself and the letters underneath are revealed -- no
 * loading flicker, no empty box, no broken-image glyph, and nothing to wire up.
 *
 * `onerror` is a fixed string containing no interpolation, so a hostile value
 * in the data file has nothing to inject into. The URL itself is escaped by the
 * html`` tag like every other interpolation.
 *
 * @param {{name:string, domain?:string}} school
 * @param {string} tier fit tier, used to tint the fallback monogram
 */
export const schoolLogo = (school, tier = "target", size = 128) => html`
  <span class="logo-slot">
    ${raw(monogram(school.name, tier))}
    ${raw(
      school.domain
        ? html`<img src="${logoUrl(school.domain, size)}" alt=""
                 loading="lazy" referrerpolicy="no-referrer"
                 onerror="this.remove()" />`
        : ""
    )}
  </span>
`;

/**
 * A live preview of the golfer's REAL public site.
 *
 * This frames the actual deployed domain, not a local mock of it. That is the
 * whole point: the caption says `lukethomasselzer.com`, so the pixels above the
 * caption had better be lukethomasselzer.com. A preview that quietly rendered a
 * look-alike would be the interface telling a small lie, and an interface that
 * lies about something this easy to check will not be believed about the fit
 * scores either.
 *
 * A screenshot would have been the easy option and the wrong one -- stale the
 * moment the golfer edits the real site, and refreshing it means a build step
 * this demo deliberately does not have.
 *
 * Hardening, in order of how much it matters:
 *   sandbox      — no `allow-top-navigation`, so the framed site cannot steal
 *                  this tab. Scripts stay on so the page renders as coaches see
 *                  it; forms, popups and downloads are all denied.
 *   aria-hidden  — decorative duplicate. The real link sits next to it.
 *   tabindex=-1  — keyboard users never get trapped in a 40%-scale viewport.
 *   no-referrer  — the public site has no business knowing about this app.
 *
 * @param {{url:string, host:string}} site
 */
export const sitePreview = (site) => html`
  <div class="site-thumb">
    <iframe src="${site.url}" title="Preview of ${site.host}"
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
            aria-hidden="true" tabindex="-1" loading="lazy" scrolling="no"></iframe>
    <span class="thumb-url">${site.host}</span>
  </div>
`;
