/**
 * data/dripgolf.js — look a new golfer up in the Drip Golf Tour standings.
 *
 * The sign-up survey asks for a first and last name. As those are typed, this
 * module matches them against the players on the tour's public standings, and
 * picking a match fills in what Drip Golf already knows: hometown, class year,
 * scoring average, and (from the player's profile page) age and JGS rank.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A SERVER FUNCTION IN THE MIDDLE
 * ---------------------------------------------------------------------------
 * dripgolftour.com sends no CORS headers, so a browser on this origin cannot
 * read its pages. netlify/functions/drip-golf.mjs fetches them server-side and
 * hands back JSON from /api/drip-golf. The parsers live HERE rather than in the
 * function so the Node tests can exercise them on a fixture without a network.
 *
 * Parsing is regex over the tour's HTML, which is honest about being fragile:
 * if Drip Golf redesigns the standings table, the list comes back empty and the
 * survey simply works as it did before -- type the name, fill the fields. A
 * lookup that fails quietly costs a few keystrokes; one that throws costs a
 * sign-up.
 */

const TOUR_ORIGIN = "https://www.dripgolftour.com";
const SEASON_ID = 1178; // 2026-27

/**
 * The standings pages searched. High School Boys is the page the lookup was
 * specced against; the two younger boys' divisions sit beside it on the same
 * season, so a middle-schooler signing up is found too.
 */
export const DRIP_DIVISIONS = Object.freeze([
  { id: 4074, name: "High School Boys" },
  { id: 59, name: "Middle School Boys" },
  { id: 354, name: "Future Stars Boys" },
]);

export const standingsUrl = (divisionId) =>
  `${TOUR_ORIGIN}/Public/Standings?TourID=17&TourSeasonID=${SEASON_ID}&DivisionID=${divisionId}&TourRankingSystemID=0`;

export const profileUrl = (playerId) =>
  `${TOUR_ORIGIN}/Public/PlayerProfile?PlayerID=${playerId}&TourSeasonID=${SEASON_ID}`;

export const PLAYER_ID = /^\d{1,9}$/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const cell = (row, cls) => {
  const m = row.match(new RegExp(`class="${cls}"[^>]*>([^<]*)<`));
  return m ? decode(m[1]) : "";
};

const num = (s) => (s === "" || !Number.isFinite(Number(s)) ? undefined : Number(s));

/** "Jack Jack Freeman" -> ["Jack Jack", "Freeman"]; a suffix stays with the surname. */
export function splitName(full) {
  const parts = decode(full).split(" ").filter(Boolean);
  if (parts.length < 2) return [parts[0] || "", ""];
  let cut = parts.length - 1;
  if (cut > 1 && /^(jr|sr|i{2,3}|iv)\.?$/i.test(parts[cut])) cut -= 1;
  return [parts.slice(0, cut).join(" "), parts.slice(cut).join(" ")];
}

/** One standings page -> the players on it. */
export function parseStandings(page, division = "") {
  const players = [];
  for (const row of String(page).split(/<tr\b/i).slice(1)) {
    const link = row.match(/PlayerID=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!link) continue;
    const [firstName, lastName] = splitName(link[2]);
    players.push({
      id: link[1],
      name: decode(link[2]),
      firstName,
      lastName,
      division,
      rank: decode(row.match(/<td[^>]*>([^<]*)<\/td>/)?.[1] ?? ""),
      hometown: cell(row, "standingshometown"),
      classYear: cell(row, "standingsgradyear"),
      points: num(cell(row, "CalculatedField1")),
      scoringAvg: num(cell(row, "CalculatedField7")),
      events: num(cell(row, "EventsPlayed")),
    });
  }
  return players;
}

/** A player profile page -> the extra facts the standings table leaves out. */
export function parseProfile(page) {
  const grab = (re) => decode(String(page).match(re)?.[1] ?? "");
  return {
    age: num(grab(/Age:\s*(\d+)/)),
    jgsRank: num(grab(/Overall JGS Rank:\s*(\d+)/)),
    tugrRank: num(grab(/TUGR Rank:\s*(\d+)/)),
  };
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Players whose names start with what has been typed so far. Either box may be
 * empty; with both empty there is nothing to suggest.
 */
export function matchPlayers(players, first, last, limit = 6) {
  const f = fold(first);
  const l = fold(last);
  if (!f && !l) return [];
  return players
    .filter((p) => (!f || fold(p.firstName).startsWith(f)) && (!l || fold(p.lastName).startsWith(l)))
    .slice(0, limit);
}

/** Lazy, once per page load: every player across DRIP_DIVISIONS, or [] if the lookup is down. */
let roster;
export function loadRoster() {
  roster ??= fetch("/api/drip-golf")
    .then((r) => (r.ok ? r.json() : { players: [] }))
    .then((d) => (Array.isArray(d.players) ? d.players : []))
    .catch(() => []);
  return roster;
}

/** Age and JGS rank for one player, or {} if the profile could not be read. */
export function loadProfile(id) {
  if (!PLAYER_ID.test(String(id))) return Promise.resolve({});
  return fetch(`/api/drip-golf?player=${id}`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
}
