/**
 * Shared response helpers. Every function used to carry its own copy of
 * these; one copy means one place to change the CORS policy.
 */
export const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  // X-Golfer picks the golfer on the shared host (dripgolf.../ava-reed);
  // Authorization carries the signed-in owner's Supabase access token.
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Golfer",
};

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

export async function readJson(req) {
  try { return await req.json(); } catch { return undefined; }
}
