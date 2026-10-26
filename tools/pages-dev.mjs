/**
 * Local stand-in for Netlify: serves the site, runs netlify/functions/*.mjs
 * for /api/*, and applies the same routing as netlify.toml -- the recruiting
 * app at /, a golfer's page at /<slug>.
 *
 *   npm run pages          -> http://localhost:8888/  and  /<slug>
 *
 * (serve.py is still the quick way to run just the app; it has no /api.)
 *
 * Uses the local file backend (DRIP_DEV=1, data in .dev-data/) unless
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set in the environment, in
 * which case it talks to your real Supabase project.
 *
 * To test a golfer's own domain locally, open http://<domain>.localhost:8888
 * after giving that golfer the domain "<domain>.localhost".
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

process.env.DRIP_DEV ??= "1";
process.env.SIGNUPS_ENABLED ??= "true";

const PORT = Number(process.env.PORT || 8888);
const ROOT = process.cwd();
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };

async function runFunction(name, req, body) {
  if (!/^[a-z0-9-]+$/.test(name)) return new Response("Not found", { status: 404 });
  let mod;
  try {
    mod = await import(pathToFileURL(join(process.cwd(), "netlify/functions", `${name}.mjs`)).href);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const url = `http://${req.headers.host}${req.url.replace(/^\/api\/[^/?]+/, `/.netlify/functions/${name}`)}`;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  });
  return mod.default(request);
}

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const path = new URL(req.url, "http://x").pathname;

  try {
    const api = /^\/api\/([^/]+)/.exec(path);
    if (api) {
      const out = await runFunction(api[1], req, body);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }

    // Same rules as netlify.toml: "/" is the app, a real file wins, and any
    // other single segment ("/ava-reed") is a golfer's page.
    if (path === "/") {
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-store" });
      res.end(await readFile(join(ROOT, "index.html")));
      return;
    }
    const file = normalize(join(ROOT, decodeURIComponent(path)));
    if (file.startsWith(ROOT)) {
      try {
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(data);
        return;
      } catch { /* fall through to the template */ }
    }
    if (/^\/[^/]+\/?$/.test(path)) {
      res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-store" });
      res.end(await readFile(join(ROOT, "golfer.html")));
      return;
    }
    res.writeHead(404).end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500).end(String(err.message || err));
  }
}).listen(PORT, () => {
  const mode = process.env.SUPABASE_URL ? "Supabase" : "local file backend (.dev-data/)";
  console.log(`Drip Golf Pages on http://localhost:${PORT}  [${mode}]`);
});
