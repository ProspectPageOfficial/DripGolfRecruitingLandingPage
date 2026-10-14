/**
 * /api/drip-golf — the Drip Golf Tour standings as JSON, for the sign-up lookup.
 *
 *   GET /api/drip-golf             -> { players: [...] } across DRIP_DIVISIONS
 *   GET /api/drip-golf?player=123  -> { age, jgsRank, tugrRank } from one profile
 *
 * dripgolftour.com sends no CORS headers, so the browser cannot read it
 * directly; this reads it server-side. It also turns away requests without a
 * browser-like User-Agent (plain curl gets a 403), hence the headers below.
 *
 * Only fixed tour URLs are ever fetched -- the one input, `player`, must be all
 * digits -- so this cannot be pointed at anything else.
 *
 * The standings change after each event, not each minute, so Netlify's CDN
 * holds the answer for an hour and serves the stale copy while refreshing.
 */
import {
  DRIP_DIVISIONS, PLAYER_ID, standingsUrl, profileUrl, parseStandings, parseProfile,
} from "../../js/data/dripgolf.js";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function page(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ...(status === 200 && {
        "Netlify-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      }),
    },
  });

export default async (req) => {
  const player = new URL(req.url).searchParams.get("player");
  try {
    if (player != null) {
      if (!PLAYER_ID.test(player)) return json({ error: "bad player id" }, 400);
      return json(parseProfile(await page(profileUrl(player))));
    }
    const pages = await Promise.allSettled(DRIP_DIVISIONS.map((d) => page(standingsUrl(d.id))));
    // A player who moved up a division mid-season is listed in both; keep the first.
    const seen = new Set();
    const players = pages
      .flatMap((p, i) => (p.status === "fulfilled" ? parseStandings(p.value, DRIP_DIVISIONS[i].name) : []))
      .filter((p) => !seen.has(p.id) && seen.add(p.id));
    if (!players.length) return json({ error: "standings unavailable", players: [] }, 502);
    return json({ players });
  } catch (err) {
    console.error(err);
    return json({ error: "tour site unavailable", players: [] }, 502);
  }
};

export const config = { path: "/api/drip-golf" };
