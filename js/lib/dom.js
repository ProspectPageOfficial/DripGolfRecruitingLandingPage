/**
 * lib/dom.js — the smallest useful view layer.
 *
 * A tagged template that escapes every interpolation by default. Opt out
 * explicitly with raw(). Safe-by-default beats remembering to escape, because
 * nobody remembers to escape.
 *
 * This is deliberately ~40 lines instead of a framework. The demo has six
 * screens; pulling in React to render six screens would be the exact opposite
 * of YAGNI.
 */

const RAW = Symbol("raw");

/** Mark a string as pre-escaped, trusted HTML. */
export const raw = (value) => ({ [RAW]: String(value) });

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(value) {
  if (value == null || value === false) return "";
  if (Array.isArray(value)) return value.map(render).join("");
  if (typeof value === "object" && RAW in value) return value[RAW];
  return escapeHtml(value);
}

/** html`<p>${untrusted}</p>` -> escaped string. */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => out + str + render(values[i]), "");
}

/** Does this href leave the app? Cheap enough to be the only rule anywhere. */
export const isExternal = (href) => /^https?:\/\//i.test(String(href));

/**
 * A link that leaves this app for a site we do not control.
 *
 * `rel="noopener"` is not decoration. Without it the opened tab receives a live
 * `window.opener` handle pointing back here and can silently navigate this tab
 * anywhere it likes. `noreferrer` rides along because the destination has no
 * business knowing which screen the click came from.
 *
 * The arrow is `aria-hidden` and paired with real text, so a screen reader
 * announces "opens in a new tab" instead of reading out a glyph. Sighted users
 * get the affordance, everyone else gets the sentence -- same information, two
 * channels, one function.
 */
export const extLink = (href, label, cls = "") => html`
  <a href="${href}" class="${cls}" target="_blank" rel="noopener noreferrer"
     >${label}<span aria-hidden="true"> \u2197</span
     ><span class="sr-only"> (opens in a new tab)</span></a
  >
`;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Read a <form> into a plain object. */
export const formData = (form) => Object.fromEntries(new FormData(form).entries());

/** "1234" -> "1,234" */
export const commas = (n) => Number(n).toLocaleString("en-US");

/** 62484 -> "$62k" */
export const money = (n) =>
  n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${commas(n)}`;

/** Initials for the avatar fallback. */
export const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
