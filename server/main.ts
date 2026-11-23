// HTTP server: Wowhead model-viewer data (local mirror + allowlisted CDN proxy), the game's guild tabard layer
// textures, and the Solid app (Vite middleware in dev, the built files in production). Tabard images are composited
// in the browser; the server only serves files.
import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TabardService } from "./tabardService.ts";
import { ZamMirror } from "./zam.ts";
import { ModelCrawler } from "./modelCrawler.ts";
import { RateLimiter, clientIp, isAllowedZamPath, isKnownEnv, securityHeaders } from "./security.ts";
import { VERSIONS, classesFor, gearFor, racesFor } from "../src/data/characters.ts";
import { FAKE_DISPLAY_BASE, FAKE_TEXTURE_BASE, FRONT_VIEW_VERSION } from "../shared/tabard.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT ?? 5173);
/** Listen on localhost by default; put a reverse proxy (TLS, compression) in front for public access. */
const HOST = process.env.HOST ?? "127.0.0.1";
/** Behind a reverse proxy: take the client address from X-Forwarded-For (for rate limits). */
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
/** "off": serve model data only from the local mirror, never contact Wowhead's CDN. */
const MODEL_FETCH = process.env.MODEL_FETCH !== "off";

// Vite's dev server exposes source files and dev endpoints: never on a network interface unless explicitly allowed.
const LOOPBACK = ["127.0.0.1", "::1", "localhost"];
if (!PROD && !LOOPBACK.includes(HOST) && process.env.DEV_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to start dev mode on ${HOST}: dev mode exposes source files. Use "npm start" (production),`);
  console.error("or set DEV_ALLOW_REMOTE=1 if you really want dev mode reachable from the network.");
  process.exit(1);
}
const CACHE_DIR = resolve(ROOT, process.env.CACHE_DIR ?? ".cache");
/** Optional: a local WoW install. Without one the server uses the texture pack in TEXTURE_DIR. */
const WOW_PATH = process.env.WOW_PATH ?? "";
const WOW_PRODUCT = process.env.WOW_PRODUCT ?? "wowf";
const TEXTURE_DIR = resolve(ROOT, process.env.TEXTURE_DIR ?? "data/textures");
/** Local mirror of Wowhead's model viewer data (filled by `npm run fetch-models` and by live requests). */
const MODEL_DIR = resolve(ROOT, process.env.MODEL_DIR ?? "data/zam");

const tabards = new TabardService({ wowPath: WOW_PATH, product: WOW_PRODUCT, cacheDir: CACHE_DIR, textureDir: TEXTURE_DIR });

const MIME: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res: http.ServerResponse, status: number, body: Buffer | string, type = "text/plain", cache = "no-cache") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache });
  res.end(body);
}

const IMMUTABLE = "public, max-age=31536000, immutable";

// ---- Abuse limits ----------------------------------------------------------------------------------------
// Per client: model files the mirror doesn't have yet (each costs a download from Wowhead) and prefetch requests.
const upstreamLimit = new RateLimiter(400, 200);
const prefetchLimit = new RateLimiter(20, 10);

/** Only the races and gear the app shows may be prefetched (per Wowhead data set). */
const allowedPrefetch = new Map<string, { chr: Set<number>; items: Set<string> }>();
for (const v of VERSIONS) {
  const entry = allowedPrefetch.get(v.env) ?? { chr: new Set<number>(), items: new Set<string>() };
  for (const r of racesFor(v)) {
    for (const m of r.models) entry.chr.add(m);
    for (const cls of classesFor(v, r))
      for (const level of ["mid", "end"] as const)
        for (const [slot, display] of gearFor(v, cls, level)?.items ?? []) entry.items.add(`${slot}:${display}`);
  }
  allowedPrefetch.set(v.env, entry);
}

function tooMany(res: http.ServerResponse) {
  res.writeHead(429, { "Content-Type": "text/plain", "Retry-After": "10", "Cache-Control": "no-store" });
  res.end("too many requests");
}

// ---- Wowhead model viewer proxy ------------------------------------------------------------------------

const zam = new ZamMirror(MODEL_DIR, { fetchUpstream: MODEL_FETCH });
/** Background downloads for /api/prefetch (few parallel requests, so live model loads keep priority). */
const prefetcher = new ModelCrawler(zam, 2, true);
const zamFetch = (path: string) => zam.getLive(path);

/** The synthetic tabard item/texture IDs only exist in the browser; Wowhead doesn't have them, so don't ask. */
function isSynthetic(path: string) {
  const meta = path.match(/\/meta\/armor\/19\/(\d+)\.json$/);
  if (meta) return Number(meta[1]) >= FAKE_DISPLAY_BASE;
  const tex = path.match(/\/textures\/(\d+)\.\w+$/);
  return !!tex && Number(tex[1]) >= FAKE_TEXTURE_BASE;
}

async function handleZam(path: string, res: http.ServerResponse, ip: string) {
  // The synthetic guild tabard item and its textures never reach the server: the page's service worker answers them.
  // Wowhead data: only the file kinds the viewer uses, and downloads count against a limit.
  if (!isAllowedZamPath(path) || isSynthetic(path)) return send(res, 404, "not found");
  if (!zam.has(path) && !upstreamLimit.take(ip)) return tooMany(res);
  const { status, body } = await zamFetch(path);
  // Images may be cached by the browser. Model data (m2, skin, skel, bone, anim, json) is served from our disk cache
  // instantly anyway, and some browsers fail to write large model files to their cache (ERR_CACHE_WRITE_FAILURE),
  // which then breaks the model load - so those are not stored by the browser at all.
  const ext = extname(path);
  const cache = status !== 200 ? "no-cache" : [".webp", ".png", ".jpg"].includes(ext) ? "public, max-age=86400" : "no-store";
  const type = status === 200 ? (MIME[ext] ?? "application/octet-stream") : "text/plain";
  send(res, status, body, type, cache);
}

// ---- Tabard API ------------------------------------------------------------------------------------------

/**
 * Texture files are cached forever only when the URL carries this server's image version. A page that is newer or
 * older than the server (e.g. reloaded before a restart) gets no-cache, so a stale texture can never stick.
 */
const textureCache = (url: URL) => (url.searchParams.get("v") === String(FRONT_VIEW_VERSION) ? IMMUTABLE : "no-cache");

async function handleApi(url: URL, res: http.ServerResponse, ip: string) {
  if (url.pathname === "/api/status") {
    const s = await tabards.status();
    // Don't reveal server paths: only whether textures are available and from where.
    return send(res, 200, JSON.stringify({ ok: s.ok, source: s.source ?? null }), MIME[".json"]);
  }
  if (url.pathname === "/api/prefetch") {
    // Warm the model mirror in the background: ?env=wrath&chr=1,2,3&items=5:12345,7:678
    if (!MODEL_FETCH) return send(res, 202, "mirror only");
    if (!prefetchLimit.take(ip)) return tooMany(res);
    const env = url.searchParams.get("env") ?? "";
    const allowed = isKnownEnv(env) ? allowedPrefetch.get(env) : undefined;
    if (!allowed) return send(res, 400, "bad env");
    const ints = (s: string) => s.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    for (const id of ints(url.searchParams.get("chr") ?? "").slice(0, 100))
      if (allowed.chr.has(id)) prefetcher.character(env, id);
    for (const pair of (url.searchParams.get("items") ?? "").split(",").slice(0, 60)) {
      if (!allowed.items.has(pair)) continue;
      const [slot, display] = pair.split(":").map(Number);
      prefetcher.item(env, slot, display);
    }
    prefetcher.kick().catch(() => {});
    return send(res, 202, "queued");
  }
  // The game's tabard layer textures (only the ~7,000 guild tabard file IDs) and the UI emblem sheet.
  const layer = url.pathname.match(/^\/api\/layer\/(\d{1,7})\.webp$/);
  if (layer) {
    const id = Number(layer[1]);
    if (!tabards.isTabardFile(id)) return send(res, 404, "not found");
    return send(res, 200, await tabards.layerWebp(id), MIME[".webp"], textureCache(url));
  }
  if (url.pathname === "/api/emblems/ui.webp")
    return send(res, 200, await tabards.uiEmblemSheetWebp(), MIME[".webp"], textureCache(url));
  send(res, 404, "not found");
}

// ---- App -------------------------------------------------------------------------------------------------

type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
let vite: Middleware | null = null;
if (!PROD) {
  const { createServer } = await import("vite");
  const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "spa" });
  vite = server.middlewares as unknown as Middleware;
}

function serveStatic(pathname: string, res: http.ServerResponse) {
  const dist = join(ROOT, "dist");
  let file = resolve(dist, "." + normalize(pathname));
  if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) file = join(dist, "index.html");
  const cache = pathname.startsWith("/assets/") ? IMMUTABLE : "no-cache";
  send(res, 200, readFileSync(file), MIME[extname(file)] ?? "application/octet-stream", cache);
}

const HEADERS = securityHeaders(PROD);

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  // The app only reads: anything but GET/HEAD is refused (except for Vite's dev server).
  if (req.method !== "GET" && req.method !== "HEAD" && !vite) return send(res, 405, "method not allowed");
  if ((req.url?.length ?? 0) > 4096) return send(res, 414, "uri too long");
  const url = new URL(req.url ?? "/", "http://localhost");
  const ip = clientIp(req, TRUST_PROXY);
  try {
    if (url.pathname.startsWith("/zam/")) return await handleZam(url.pathname.slice(5), res, ip);
    if (url.pathname.startsWith("/api/")) return await handleApi(url, res, ip);
    if (vite) return vite(req, res, () => send(res, 404, "not found"));
    serveStatic(url.pathname, res);
  } catch (e) {
    console.error(`[server] ${req.url}:`, e);
    // Details stay in the server log; clients only learn that something failed.
    if (!res.headersSent) send(res, 500, PROD ? "internal error" : (e as Error).message);
  }
});
server.requestTimeout = 60000;
server.headersTimeout = 20000;

server.listen(PORT, HOST, () => {
  console.log(`Tabard designer running at http://${HOST}:${PORT} (${PROD ? "production" : "dev"})`);
  if (!MODEL_FETCH) console.log("Model data: local mirror only (MODEL_FETCH=off)");
  tabards.status().then((s) => {
    if (s.source === "install") console.log(`Tabard textures: WoW install at ${WOW_PATH} (${s.product} ${s.version})`);
    else if (s.source === "pack") console.log(`Tabard textures: texture pack in ${TEXTURE_DIR}`);
    else console.warn(`No tabard textures: set WOW_PATH, or build the pack with "npm run extract" and copy it to ${TEXTURE_DIR}`);
  });
});
